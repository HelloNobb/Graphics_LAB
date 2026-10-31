import './styles/main.css';
import { buildRegistry } from './core/registry.js';
import { DemoHost } from './core/DemoHost.js';
import { DemoManager } from './core/DemoManager.js';
import { hasWebGL2 } from './core/device.js';
import { renderCategory } from './ui/section.js';
import { renderToc } from './ui/toc.js';

const categories = buildRegistry();
const container = document.getElementById('sections');
const hosts = [];

for (const cat of categories) {
  const { section, slots } = renderCategory(cat);
  container.appendChild(section);
  for (const s of slots) hosts.push(new DemoHost(s.demo, s.stage, s.guiWrap));
}

renderToc(categories, document.getElementById('toc'));

if (hasWebGL2()) {
  const manager = new DemoManager(hosts);
  // 디버그·스모크 테스트용 훅
  window.__lab = { manager, hosts };
} else {
  document.querySelector('.hero__warn').hidden = false;
  document.body.classList.add('no-webgl');
}

// 해시로 들어온 경우 DOM 생성 후 다시 스크롤
if (location.hash) {
  requestAnimationFrame(() => document.querySelector(location.hash)?.scrollIntoView());
}
