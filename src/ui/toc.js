// 목차: 데스크톱은 왼쪽 고정 사이드바, 모바일은 드로어. 현재 보고 있는 데모를 하이라이트.
import { pad2 } from './section.js';

export function renderToc(categories, nav) {
  const list = document.createElement('ol');
  list.className = 'toc__list';
  for (const cat of categories) {
    const li = document.createElement('li');
    li.className = 'toc__cat';
    li.innerHTML = `<a href="#c-${pad2(cat.num)}"><span class="toc__num">${pad2(cat.num)}</span>${cat.title}</a>`;
    const sub = document.createElement('ol');
    for (const d of cat.demos) {
      const s = document.createElement('li');
      s.innerHTML = `<a href="#${d.id}" data-target="${d.id}">${d.meta.title}</a>`;
      sub.appendChild(s);
    }
    li.appendChild(sub);
    list.appendChild(li);
  }
  nav.innerHTML = '<p class="toc__title">목차</p>';
  nav.appendChild(list);

  // 모바일 드로어
  const toggle = document.querySelector('.toc-toggle');
  const backdrop = document.querySelector('.toc-backdrop');
  const setOpen = (open) => {
    document.body.classList.toggle('toc-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    backdrop.hidden = !open;
  };
  toggle.addEventListener('click', () => setOpen(!document.body.classList.contains('toc-open')));
  backdrop.addEventListener('click', () => setOpen(false));
  nav.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (e) => e.key === 'Escape' && setOpen(false));

  // 현재 위치 하이라이트
  const links = new Map([...nav.querySelectorAll('a[data-target]')].map((a) => [a.dataset.target, a]));
  const visible = new Set();
  let current = null;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) (e.isIntersecting ? visible.add : visible.delete).call(visible, e.target.id);
      const first = [...links.keys()].find((id) => visible.has(id));
      if (first && first !== current) {
        links.get(current)?.classList.remove('is-current');
        current = first;
        const a = links.get(current);
        a.classList.add('is-current');
        if (!document.body.classList.contains('toc-open') && nav.scrollHeight > nav.clientHeight) {
          const top = a.offsetTop - nav.clientHeight / 2;
          nav.scrollTo({ top, behavior: 'smooth' });
        }
      }
    },
    { rootMargin: '-35% 0px -55% 0px' },
  );
  for (const id of links.keys()) io.observe(document.getElementById(id));
}
