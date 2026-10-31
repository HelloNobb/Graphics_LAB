// 어떤 데모를 살려 둘지 결정한다.
//
// - nearIO  (rootMargin 300px): 화면에 들어오기 조금 전에 미리 초기화 시작
// - visIO   (rootMargin 0):     실제로 보일 때만 렌더 (여유 영역에 있을 땐 루프만 돌고 그리지 않음)
// - 동시 활성 상한 MAX_ACTIVE: 넘으면 화면 중앙에서 가장 먼 데모부터 즉시 해제
// - 히스테리시스: 화면을 벗어난 데모는 1.5초 유예 후 해제 (위아래로 살짝 스크롤할 때 재생성 방지)
import { MAX_ACTIVE } from './device.js';

const STOP_DELAY = 1500;

export class DemoManager {
  constructor(hosts) {
    this.hosts = hosts;
    this.wanted = new Set();
    const byEl = new Map(hosts.map((h) => [h.stage, h]));

    this.nearIO = new IntersectionObserver(
      (entries) => {
        for (const e of entries) byEl.get(e.target).near = e.isIntersecting;
        this.schedule();
      },
      { rootMargin: '300px 0px 300px 0px' },
    );
    this.visIO = new IntersectionObserver((entries) => {
      for (const e of entries) byEl.get(e.target).visible = e.isIntersecting;
    });

    for (const h of hosts) {
      this.nearIO.observe(h.stage);
      this.visIO.observe(h.stage);
    }
    // 스크롤하면 "화면 중앙에서의 거리" 우선순위가 바뀌므로 재평가
    window.addEventListener('scroll', () => this.schedule(), { passive: true });
    window.addEventListener('resize', () => this.schedule(), { passive: true });
  }

  schedule() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.update();
    });
  }

  distance(h) {
    const r = h.stage.getBoundingClientRect();
    return Math.abs((r.top + r.bottom) / 2 - window.innerHeight / 2);
  }

  update() {
    const near = this.hosts
      .filter((h) => h.near && h.state !== 'error')
      .map((h) => [h, this.distance(h)])
      .sort((a, b) => a[1] - b[1])
      .map(([h]) => h);
    this.wanted = new Set(near.slice(0, MAX_ACTIVE));

    const alive = this.hosts.filter((h) => h.isAlive());
    const toStart = [...this.wanted].filter((h) => !h.isAlive());
    let count = alive.length + toStart.length;

    // 원하지 않는 데모: 상한을 넘으면 즉시, 아니면 유예 후 해제 (먼 것부터)
    const extra = alive
      .filter((h) => !this.wanted.has(h))
      .sort((a, b) => this.distance(b) - this.distance(a));
    for (const h of extra) {
      if (count > MAX_ACTIVE) {
        h.stop();
        count--;
      } else if (!h.stopTimer) {
        h.stopTimer = setTimeout(() => {
          h.stopTimer = null;
          if (!this.wanted.has(h)) h.stop();
        }, STOP_DELAY);
      }
    }

    for (const h of this.wanted) {
      clearTimeout(h.stopTimer);
      h.stopTimer = null;
      if (!h.isAlive()) h.start();
    }
  }

  /** 디버그/테스트용: 현재 살아 있는 WebGL 컨텍스트 수 */
  activeCount() {
    return this.hosts.filter((h) => h.isAlive()).length;
  }
}
