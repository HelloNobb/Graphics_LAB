import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';
import { RGBShiftShader } from 'three/addons/shaders/RGBShiftShader.js';
import { orbit } from '../../../shared/helpers.js';

export const params = {
  bloom: true,
  threshold: 1,
  strength: 0.6,
  radius: 0.35,
  emissive: 2.5,
  exposure: 1,
  vignette: true,
  vignetteDarkness: 0.9,
  rgbShift: false,
  rgbAmount: 0.0025,
  film: false,
  filmIntensity: 0.6,
  compare: false,
};

export function create({ renderer, canvas, gui, params, stage, onDispose, track }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#05060a');
  scene.fog = new THREE.Fog('#05060a', 18, 40);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 3.5, 12);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: '#15171d', roughness: 0.55, metalness: 0.4 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  scene.add(new THREE.HemisphereLight('#4455aa', '#000000', 0.4));

  // 네온 오브젝트 (emissive > 1 → HDR로 밝음)
  const neonColors = ['#ff2e88', '#29e6ff', '#ffd23f', '#7c4dff', '#3dff8b'];
  const neonMats = [];
  const neon = (color) => {
    const m = new THREE.MeshStandardMaterial({ color: '#111111', emissive: color, emissiveIntensity: params.emissive, roughness: 0.4 });
    neonMats.push(m);
    return m;
  };
  const rings = [];
  neonColors.forEach((c, i) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.4 + i * 0.55, 0.05, 12, 128), neon(c));
    ring.position.y = 3;
    ring.rotation.x = Math.PI / 2 + i * 0.3;
    scene.add(ring);
    rings.push(ring);
    const light = new THREE.PointLight(c, 3, 10, 2);
    light.position.set(Math.cos(i * 1.26) * 4, 0.6, Math.sin(i * 1.26) * 4);
    scene.add(light);
  });
  const orbs = neonColors.map((c, i) => {
    const o = new THREE.Mesh(new THREE.SphereGeometry(0.25, 24, 12), neon(c));
    scene.add(o);
    return o;
  });
  // 비교용: 발광하지 않는 흰 물체 (threshold에 따라 번질 수도, 아닐 수도)
  const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.6, 0.2, 128, 16), new THREE.MeshStandardMaterial({ color: '#e8e8ee', roughness: 0.3, metalness: 0.2 }));
  knot.position.y = 3;
  scene.add(knot);
  for (let i = 0; i < 11; i++) {
    const a = Math.PI * (1.05 + (i / 10) * 0.9); // 카메라 반대편 반원에만 배치
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.5 + (i % 3), 0.12), neon(neonColors[i % neonColors.length]));
    bar.position.set(Math.cos(a) * 9, bar.geometry.parameters.height / 2, Math.sin(a) * 9);
    scene.add(bar);
  }

  // ── 후처리 체인 ─────────────────────
  const rt = track(new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
  const composer = track(new EffectComposer(renderer, rt));
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), params.strength, params.radius, params.threshold);
  const rgbPass = new ShaderPass(RGBShiftShader);
  const filmPass = new FilmPass(params.filmIntensity, false);
  const vignettePass = new ShaderPass(VignetteShader);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(bloomPass);
  composer.addPass(rgbPass);
  composer.addPass(filmPass);
  composer.addPass(vignettePass);
  composer.addPass(new OutputPass());

  // 비교선
  const divider = document.createElement('div');
  divider.className = 'demo-divider';
  divider.innerHTML = '<span>원본</span><span>후처리</span>';
  stage.appendChild(divider);
  onDispose(() => divider.remove());

  const apply = () => {
    bloomPass.enabled = params.bloom;
    bloomPass.threshold = params.threshold;
    bloomPass.strength = params.strength;
    bloomPass.radius = params.radius;
    neonMats.forEach((m) => (m.emissiveIntensity = params.emissive));
    renderer.toneMappingExposure = params.exposure;
    vignettePass.enabled = params.vignette;
    vignettePass.uniforms.darkness.value = params.vignetteDarkness;
    vignettePass.uniforms.offset.value = 1;
    rgbPass.enabled = params.rgbShift;
    rgbPass.uniforms.amount.value = params.rgbAmount;
    filmPass.enabled = params.film;
    filmPass.uniforms.intensity.value = params.filmIntensity;
    divider.hidden = !params.compare;
  };
  apply();

  const fb = gui.addFolder('Bloom');
  fb.add(params, 'bloom').name('켜기').onChange(apply);
  fb.add(params, 'threshold', 0, 2, 0.01).name('threshold (밝기 기준)').onChange(apply);
  fb.add(params, 'strength', 0, 3, 0.01).name('strength (세기)').onChange(apply);
  fb.add(params, 'radius', 0, 1, 0.01).name('radius (번짐)').onChange(apply);
  gui.add(params, 'emissive', 0, 8, 0.01).name('발광 세기 (emissive)').onChange(apply);
  gui.add(params, 'exposure', 0.2, 3, 0.01).name('노출 (톤매핑)').onChange(apply);
  const fo = gui.addFolder('기타 패스').close();
  fo.add(params, 'vignette').name('비네트').onChange(apply);
  fo.add(params, 'vignetteDarkness', 0, 1, 0.01).name('비네트 진하기').onChange(apply);
  fo.add(params, 'rgbShift').name('RGB 분리').onChange(apply);
  fo.add(params, 'rgbAmount', 0, 0.02, 0.0005).name('RGB 분리 양').onChange(apply);
  fo.add(params, 'film').name('필름 그레인').onChange(apply);
  fo.add(params, 'filmIntensity', 0, 2, 0.01).name('그레인 세기').onChange(apply);
  gui.add(params, 'compare').name('전/후 비교 (왼쪽=원본)').onChange(apply);

  let w = 1;
  let h = 1;
  return {
    scene,
    camera,
    controls: orbit(camera, canvas, [0, 2.5, 0], { maxPolarAngle: THREE.MathUtils.degToRad(88) }),
    resize(nw, nh) {
      w = nw;
      h = nh;
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
    },
    update(dt, t) {
      rings.forEach((r, i) => {
        r.rotation.z += dt * (0.2 + i * 0.12) * (i % 2 ? 1 : -1);
        r.rotation.x = Math.PI / 2 + Math.sin(t * 0.4 + i) * 0.5;
      });
      orbs.forEach((o, i) => {
        const a = t * 0.6 + (i / orbs.length) * Math.PI * 2;
        o.position.set(Math.cos(a) * 5, 1 + Math.sin(t * 1.3 + i) * 0.6, Math.sin(a) * 5);
      });
      knot.rotation.y += dt * 0.5;
    },
    render(dt) {
      composer.render(dt);
      if (params.compare) {
        // 왼쪽 절반에 후처리 없는 원본을 덮어 그린다
        renderer.setRenderTarget(null);
        renderer.setScissorTest(true);
        renderer.setScissor(0, 0, w / 2, h);
        renderer.render(scene, camera);
        renderer.setScissorTest(false);
      }
    },
    dispose() {
      composer.passes.forEach((p) => p.dispose?.());
    },
  };
}
