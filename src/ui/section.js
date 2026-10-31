// 카테고리 섹션과 데모 블록 DOM 생성
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};

export const pad2 = (n) => String(n).padStart(2, '0');

export function renderCategory(cat) {
  const section = el('section', 'category');
  section.id = `c-${pad2(cat.num)}`;
  section.innerHTML = `
    <header class="category__head">
      <span class="category__num">${pad2(cat.num)}</span>
      <div>
        <h2>${cat.title}</h2>
        ${cat.en ? `<p class="category__en">${cat.en}</p>` : ''}
      </div>
    </header>`;
  if (cat.intro) section.appendChild(el('div', 'category__intro prose', cat.intro));

  const slots = [];
  for (const demo of cat.demos) {
    const { meta } = demo;
    const article = el('article', 'demo');
    article.id = demo.id;
    const label = `${cat.num}-${demo.num}`;
    article.appendChild(el('h3', 'demo__title', `<span class="demo__num">${label}</span>${meta.title}`));
    if (demo.contentBefore.trim()) article.appendChild(el('div', 'prose', demo.contentBefore));

    const figure = el('figure', 'demo-box');
    const stage = el('div', 'demo-stage');
    const aspect = meta.aspect || 16 / 9;
    stage.style.setProperty('--aspect', aspect);
    stage.style.setProperty('--aspect-m', Math.min(aspect, meta.mobileAspect || 4 / 3));
    stage.appendChild(el('div', 'demo-placeholder', '<span class="spinner" aria-hidden="true"></span><span class="demo-placeholder__text">화면에 들어오면 데모가 시작됩니다</span>'));
    stage.setAttribute('role', 'img');
    stage.setAttribute('aria-label', `${meta.title} 인터랙티브 데모`);
    const guiWrap = el('div', 'demo-gui');
    figure.append(stage, guiWrap);
    if (meta.tip) figure.appendChild(el('figcaption', 'demo-tip', meta.tip));
    article.appendChild(figure);

    if (demo.contentAfter.trim()) article.appendChild(el('div', 'prose', demo.contentAfter));
    section.appendChild(article);
    slots.push({ demo, stage, guiWrap, label });
  }
  return { section, slots };
}
