// FPS · 드로우콜 · 삼각형 수 표시. renderer.info는 프레임 시작마다 수동으로 reset 한다
// (composer처럼 한 프레임에 render()를 여러 번 부르는 경우도 합산되도록 autoReset=false).

const fmt = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(n));

export class StatsOverlay {
  constructor(parent) {
    this.el = document.createElement('div');
    this.el.className = 'demo-stats';
    this.el.setAttribute('aria-hidden', 'true');
    parent.appendChild(this.el);
    this.frames = 0;
    this.acc = 0;
    this.fps = 0;
  }

  update(dt, info) {
    this.frames++;
    this.acc += dt;
    if (this.acc >= 0.5) {
      this.fps = Math.round(this.frames / this.acc);
      this.frames = 0;
      this.acc = 0;
      const r = info.render;
      this.el.textContent = `${this.fps} fps · 드로우콜 ${r.calls} · 삼각형 ${fmt(r.triangles)}${r.points ? ' · 점 ' + fmt(r.points) : ''}`;
    }
  }

  dispose() {
    this.el.remove();
  }
}
