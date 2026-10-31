// 스모크 테스트: 빌드 결과(dist)를 띄워 모든 데모를 차례로 스크롤하며
//  - 각 데모가 active 상태가 되는지
//  - 콘솔 에러/페이지 에러가 없는지
//  - 동시에 살아 있는 데모 수가 상한(MAX_ACTIVE)을 넘지 않는지
// 를 검사한다. 사용법: npm run build && npm run smoke [-- --mobile] [-- --only=d-10-01] [-- --shots]
// 헤드리스 Chromium의 WebGL은 소프트웨어(SwiftShader)라 느리다: 성능이 아니라 에러·생명주기 검증용.
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { chromium, devices } = require('playwright');

const args = process.argv.slice(2);
const mobile = args.includes('--mobile');
const shots = args.includes('--shots');
const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7);
const PORT = 4179;

function startServer() {
  const proc = spawn(process.execPath, [path.join(process.cwd(), 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORT), '--strictPort'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return new Promise((resolve, reject) => {
    proc.stdout.on('data', (d) => /Local/.test(String(d)) && resolve(proc));
    proc.stderr.on('data', (d) => process.stderr.write(d));
    proc.on('exit', (c) => reject(new Error('preview exited ' + c)));
    setTimeout(() => resolve(proc), 4000);
  });
}

(async () => {
  const server = await startServer();
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const context = await browser.newContext(mobile ? { ...devices['iPhone 13'], defaultBrowserType: undefined } : { viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
    if (m.type() === 'warning' && /THREE|WebGL/.test(m.text())) console.log('  ⚠', m.text().slice(0, 200));
  });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
  const ids = await page.$$eval('article.demo', (els) => els.map((e) => e.id));
  const max = await page.evaluate(() => (window.__lab ? window.__lab.manager.hosts.length : 0));
  console.log(`데모 ${ids.length}개, ${mobile ? '모바일' : '데스크톱'} 모드`);
  if (shots) fs.mkdirSync('screenshots', { recursive: true });

  let peak = 0;
  const failed = [];
  for (const id of ids) {
    if (only && id !== only) continue;
    const before = errors.length;
    await page.$eval(`#${id} .demo-stage`, (el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    let state = '';
    for (let i = 0; i < 80; i++) {
      await page.waitForTimeout(150);
      state = await page.$eval(`#${id} .demo-stage`, (el) => el.dataset.state);
      if (state === 'active' || state === 'error') break;
    }
    await page.waitForTimeout(900); // 몇 프레임 렌더
    const info = await page.evaluate((id) => {
      const lab = window.__lab;
      const h = lab.hosts.find((x) => x.entry.id === id);
      return { active: lab.manager.activeCount(), stats: h.stage.querySelector('.demo-stats')?.textContent || '', state: h.state };
    }, id);
    peak = Math.max(peak, info.active);
    const newErr = errors.slice(before);
    const ok = info.state === 'active' && newErr.length === 0;
    if (!ok) failed.push(id);
    console.log(`${ok ? '✓' : '✗'} ${id.padEnd(8)} state=${info.state} active=${info.active} ${info.stats}`);
    newErr.forEach((e) => console.log('    ', e.slice(0, 400)));
    if (shots) {
      const box = await page.$eval(`#${id} .demo-box`, (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: Math.min(r.height, window.innerHeight - r.y) };
      });
      await page.screenshot({ path: `screenshots/${id}${mobile ? '-m' : ''}.png`, clip: box, timeout: 120000 }).catch((e) => console.log('    (스크린샷 실패)', e.message.split('\n')[0]));
    }
  }
  const cap = await page.evaluate(() => window.__lab && window.__lab.manager.hosts.length);
  console.log(`\n최대 동시 활성: ${peak}  (전체 ${cap})`);
  console.log(failed.length ? `실패: ${failed.join(', ')}` : '모든 데모 통과');
  await browser.close();
  server.kill();
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
