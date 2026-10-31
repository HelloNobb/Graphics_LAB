// 데모 자동 수집.
// src/demos/<카테고리 폴더>/category.js            → 카테고리 제목·소개
// src/demos/<카테고리 폴더>/<데모 폴더>/meta.js     → 데모 제목·옵션 (eager: 페이지 뼈대용)
// src/demos/<카테고리 폴더>/<데모 폴더>/content.html → 한국어 설명 (eager, 문자열)
// src/demos/<카테고리 폴더>/<데모 폴더>/demo.js     → 실제 데모 (lazy: 화면에 다가올 때만 다운로드)
// 폴더 이름의 숫자 접두사 순서대로 정렬된다. 새 데모는 폴더만 추가하면 끝.

const categoryMods = import.meta.glob('../demos/*/category.js', { eager: true, import: 'default' });
const metaMods = import.meta.glob('../demos/*/*/meta.js', { eager: true, import: 'default' });
const contentMods = import.meta.glob('../demos/*/*/content.html', { eager: true, query: '?raw', import: 'default' });
const demoLoaders = import.meta.glob('../demos/*/*/demo.js');

const dirOf = (path) => path.replace(/^\.\.\/demos\//, '').replace(/\/[^/]+$/, '');
const num = (name) => {
  const m = /^(\d+)/.exec(name);
  return m ? Number(m[1]) : 0;
};

export function buildRegistry() {
  const categories = new Map();

  for (const [path, cat] of Object.entries(categoryMods)) {
    const dir = dirOf(path);
    categories.set(dir, { id: dir, num: num(dir), ...cat, demos: [] });
  }

  for (const [path, meta] of Object.entries(metaMods)) {
    const dir = dirOf(path); // "01-basics/01-scene-camera-renderer"
    const [catDir, demoDir] = dir.split('/');
    const category = categories.get(catDir);
    if (!category) {
      console.warn(`[registry] ${catDir}/category.js 가 없어 ${dir} 데모를 건너뜁니다.`);
      continue;
    }
    const loader = demoLoaders[`../demos/${dir}/demo.js`];
    if (!loader) {
      console.warn(`[registry] ${dir}/demo.js 가 없습니다.`);
      continue;
    }
    const raw = contentMods[`../demos/${dir}/content.html`] || '';
    const [before, after = ''] = raw.split('<!--demo-->');
    category.demos.push({
      id: `d-${catDir.replace(/-.*/, '')}-${demoDir.replace(/-.*/, '')}`,
      dir,
      num: num(demoDir),
      category,
      meta,
      contentBefore: before,
      contentAfter: after,
      load: loader,
    });
  }

  const list = [...categories.values()].sort((a, b) => a.num - b.num);
  list.forEach((c) => c.demos.sort((a, b) => a.num - b.num));
  return list.filter((c) => c.demos.length > 0);
}
