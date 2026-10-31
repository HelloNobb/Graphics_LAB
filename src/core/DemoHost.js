// 데모 박스 1개의 생명주기를 담당한다.
//   idle ──start()──▶ loading ──▶ active ──stop()──▶ idle
//                         └────────▶ error (다시 시작 버튼)
// start(): demo.js 동적 import → 캔버스·WebGLRenderer·lil-gui 생성 → demo.create(ctx) → 렌더 루프
// stop():  마지막 프레임을 포스터로 저장 → 모든 GPU 자원 dispose → forceContextLoss()로 컨텍스트 즉시 반납
// three와 lil-gui는 첫 데모가 화면에 다가올 때 동적으로 불러온다 → 첫 페이지 로드에는 텍스트만 포함.
import { disposeObject, disposeAny } from './dispose.js';
import { StatsOverlay } from './statsOverlay.js';
import { TouchGuard } from './touchGuard.js';
import { isTouch, isMobile, quality, MAX_PIXEL_RATIO } from './device.js';

let THREE;
let GUI;
let libsPromise;
const loadLibs = () =>
  (libsPromise ??= Promise.all([import('three'), import('lil-gui')]).then(([t, g]) => {
    THREE = t;
    GUI = g.default;
  }));

const toneMapping = (name) =>
  ({
    ACES: THREE.ACESFilmicToneMapping,
    AgX: THREE.AgXToneMapping,
    Neutral: THREE.NeutralToneMapping,
    Reinhard: THREE.ReinhardToneMapping,
  })[name] ?? THREE.NoToneMapping;

export class DemoHost {
  /**
   * @param {object} entry  registry 항목 (meta, load 등)
   * @param {HTMLElement} stage  캔버스가 들어갈 박스
   * @param {HTMLElement} guiWrap  lil-gui 컨테이너
   */
  constructor(entry, stage, guiWrap) {
    this.entry = entry;
    this.stage = stage;
    this.guiWrap = guiWrap;
    this.state = 'idle';
    this.token = 0;
    this.params = null; // GUI 상태: stop/start 사이에도 보존
    this.defaults = null;
    this.near = false; // DemoManager가 갱신 (뷰포트 + 여유 영역 안)
    this.visible = false; // 실제로 화면에 보이는지 (안 보이면 렌더 생략)
    this.stopTimer = null;
    this.r = null; // 현재 살아 있는 자원 묶음
    this.setStateClass();
  }

  isAlive() {
    return this.state === 'loading' || this.state === 'active';
  }

  setStateClass() {
    this.stage.dataset.state = this.state;
  }

  async start() {
    if (this.isAlive()) return;
    const token = ++this.token;
    this.state = 'loading';
    this.setStateClass();
    try {
      const [mod] = await Promise.all([this.entry.load(), loadLibs()]);
      if (token !== this.token) return; // 로딩 중에 stop()됨
      if (!this.params) {
        this.defaults = structuredClone(mod.params || {});
        this.params = structuredClone(this.defaults);
      }
      await this.mount(mod, token);
    } catch (err) {
      if (token === this.token) this.fail(err);
    }
  }

  async mount(mod, token) {
    const { meta } = this.entry;
    const r = (this.r = { tracked: [], cleanups: [] });

    // ── 캔버스 & 렌더러 ──────────────────────────────
    const canvas = (r.canvas = document.createElement('canvas'));
    canvas.className = 'demo-canvas';
    this.stage.prepend(canvas);

    const ro = typeof meta.renderer === 'function' ? meta.renderer(this.params) : meta.renderer || {};
    const renderer = (r.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: ro.antialias ?? true,
      powerPreference: 'high-performance',
    }));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = toneMapping(ro.toneMapping);
    renderer.toneMappingExposure = ro.exposure ?? 1;
    if (ro.shadows) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
    }
    renderer.info.autoReset = false;

    const onLost = (e) => {
      e.preventDefault();
      this.fail(new Error('GPU 컨텍스트가 손실되었습니다. (다른 탭이나 앱이 GPU를 많이 쓰고 있을 수 있어요)'));
    };
    canvas.addEventListener('webglcontextlost', onLost);
    r.cleanups.push(() => canvas.removeEventListener('webglcontextlost', onLost));

    const size = () => ({
      width: Math.max(1, this.stage.clientWidth),
      height: Math.max(1, this.stage.clientHeight),
    });
    let { width, height } = size();
    renderer.setSize(width, height, false);

    // ── GUI · HUD · 통계 ─────────────────────────────
    const gui = (r.gui = new GUI({ container: this.guiWrap, title: '파라미터' }));
    if (window.matchMedia('(max-width: 760px)').matches) gui.close();

    const hud = (r.hud = document.createElement('div'));
    hud.className = 'demo-hud';
    this.stage.appendChild(hud);

    r.stats = meta.stats === false ? null : new StatsOverlay(this.stage);

    // ── 데모 생성 ───────────────────────────────────
    const host = this;
    const ctx = {
      THREE,
      renderer,
      canvas,
      stage: this.stage,
      gui,
      hud,
      params: this.params,
      defaults: this.defaults,
      quality,
      isTouch,
      isMobile,
      get width() { return width; },
      get height() { return height; },
      get elapsed() { return host.elapsed; },
      /** 씬 밖에서 만든 자원(렌더 타깃, composer, 텍스처 등)을 등록해 두면 stop() 때 자동 해제 */
      track(x) {
        r.tracked.push(x);
        return x;
      },
      /** 이벤트 리스너 등 정리 함수 등록 */
      onDispose(fn) {
        r.cleanups.push(fn);
      },
      /** 박스 위에 텍스트 라벨 추가 (left/top은 CSS 값) */
      addLabel(text, style = {}) {
        const el = document.createElement('div');
        el.className = 'demo-label';
        el.textContent = text;
        Object.assign(el.style, style);
        host.stage.appendChild(el);
        r.cleanups.push(() => el.remove());
        return el;
      },
      /** 렌더러 재생성이 필요한 옵션(antialias 등)을 바꿨을 때 */
      restart: () => this.restart(),
    };

    const api = (r.api = (await mod.create(ctx)) || {});
    if (token !== this.token) {
      this.teardown(r);
      return;
    }

    // ↺ 기본값: 파라미터를 초기값으로 되돌리고 데모 재시작
    gui.add({ reset: () => {
      for (const k of Object.keys(this.params)) delete this.params[k];
      Object.assign(this.params, structuredClone(this.defaults));
      this.restart();
    } }, 'reset').name('↺ 기본값');

    // ── OrbitControls 연동 (터치 가드 / 휠 줌 가드) ────
    const controls = api.controls;
    if (controls) {
      if (isTouch) {
        controls.enabled = false;
        canvas.style.touchAction = 'pan-y';
        r.guard = new TouchGuard(this.stage, (active) => {
          controls.enabled = active;
          canvas.style.touchAction = active ? 'none' : 'pan-y';
        });
      } else if (controls.enableZoom) {
        // 데스크톱: 페이지를 휠로 스크롤하다가 캔버스 위에서 갑자기 줌되는 것을 막는다.
        // 캔버스를 한 번 클릭하면 줌 가능, 박스를 벗어나면 다시 해제.
        controls.enableZoom = false;
        const on = () => (controls.enableZoom = true);
        const off = () => (controls.enableZoom = false);
        this.stage.addEventListener('pointerdown', on);
        this.stage.addEventListener('pointerleave', off);
        r.cleanups.push(() => {
          this.stage.removeEventListener('pointerdown', on);
          this.stage.removeEventListener('pointerleave', off);
        });
        this.stage.classList.add('has-zoom-guard');
      }
    }

    // ── 리사이즈 ────────────────────────────────────
    const applySize = () => {
      ({ width, height } = size());
      renderer.setSize(width, height, false);
      if (api.camera && api.camera.isPerspectiveCamera) {
        api.camera.aspect = width / height;
        api.camera.updateProjectionMatrix();
      }
      api.resize?.(width, height);
    };
    applySize();
    const resizeObs = new ResizeObserver(applySize);
    resizeObs.observe(this.stage);
    r.cleanups.push(() => resizeObs.disconnect());

    // ── 렌더 루프 ───────────────────────────────────
    this.elapsed = 0;
    let last = performance.now();
    renderer.setAnimationLoop((now) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (!this.visible || document.hidden) return; // 화면 밖이면 GPU를 쉬게 한다
      try {
        this.elapsed += dt;
        renderer.info.reset();
        controls?.update?.(dt);
        api.update?.(dt, this.elapsed);
        this.renderFrame(dt);
        r.stats?.update(dt, renderer.info);
      } catch (err) {
        this.fail(err);
      }
    });

    this.state = 'active';
    this.setStateClass();
  }

  renderFrame(dt = 0) {
    const { api, renderer } = this.r;
    if (api.render) api.render(dt);
    else if (api.scene && api.camera) renderer.render(api.scene, api.camera);
  }

  /** 데모 정지 + 모든 자원 해제 */
  stop({ poster = true } = {}) {
    clearTimeout(this.stopTimer);
    this.stopTimer = null;
    if (!this.isAlive()) return;
    this.token++;
    if (this.r) {
      if (poster && this.state === 'active') this.capturePoster();
      this.teardown(this.r);
    }
    this.state = 'idle';
    this.setStateClass();
  }

  async restart() {
    this.stop({ poster: false });
    await this.start();
  }

  capturePoster() {
    try {
      // preserveDrawingBuffer 없이도, 같은 태스크 안에서 render 직후 읽으면 픽셀이 남아 있다.
      this.r.renderer.info.reset();
      this.renderFrame(0);
      const url = this.r.canvas.toDataURL('image/jpeg', 0.8);
      this.stage.style.setProperty('--poster', `url("${url}")`);
    } catch {
      /* 포스터는 선택 사항 */
    }
  }

  teardown(r) {
    if (!r) return;
    if (this.r === r) this.r = null;
    const safe = (fn) => {
      try { fn(); } catch (e) { console.warn('[DemoHost] dispose 중 경고', e); }
    };
    safe(() => r.renderer?.setAnimationLoop(null));
    safe(() => r.api?.dispose?.());
    safe(() => r.api?.controls?.dispose?.());
    safe(() => disposeObject(r.api?.scene));
    r.tracked.forEach((x) => safe(() => disposeAny(x)));
    r.cleanups.forEach((fn) => safe(fn));
    safe(() => r.gui?.destroy());
    safe(() => r.hud?.remove());
    safe(() => r.stats?.dispose());
    safe(() => r.guard?.dispose());
    this.stage.classList.remove('is-interactive', 'has-zoom-guard');
    safe(() => {
      r.renderer.dispose();
      r.renderer.forceContextLoss(); // GC를 기다리지 않고 WebGL 컨텍스트 반납
    });
    safe(() => r.canvas.remove());
  }

  fail(err) {
    console.error(`[${this.entry.dir}]`, err);
    this.token++;
    this.teardown(this.r);
    this.state = 'error';
    this.setStateClass();
    let box = this.stage.querySelector('.demo-error');
    if (!box) {
      box = document.createElement('div');
      box.className = 'demo-error';
      box.innerHTML = '<p></p><button type="button">다시 시작</button>';
      box.querySelector('button').addEventListener('click', () => {
        box.remove();
        this.state = 'idle';
        this.start();
      });
      this.stage.appendChild(box);
    }
    box.querySelector('p').textContent = `데모를 실행하지 못했습니다: ${err?.message || err}`;
  }
}
