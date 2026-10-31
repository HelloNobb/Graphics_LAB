import * as THREE from 'three';
import { orbit } from '../../../shared/helpers.js';
import { roomEnvironment } from '../../../shared/environment.js';

export const params = {
  color: '#d9d9e0',
  envMap: true,
  envIntensity: 1,
  showBackground: false,
  directional: true,
  clearcoat: 0,
};

const N = 5;

export function create({ renderer, canvas, gui, params, addLabel, track }) {
  const scene = new THREE.Scene();
  const bg = new THREE.Color('#0d1015');
  scene.background = bg;
  const camera = new THREE.PerspectiveCamera(30, 1.6, 0.1, 100);
  camera.position.set(0, 0, 17);

  const envRT = track(roomEnvironment(renderer));
  const env = envRT.texture;

  const geo = new THREE.SphereGeometry(0.62, 48, 24);
  const mats = [];
  const group = new THREE.Group();
  for (let row = 0; row < N; row++)
    for (let col = 0; col < N; col++) {
      const m = new THREE.MeshPhysicalMaterial({
        color: params.color,
        roughness: col / (N - 1),
        metalness: row / (N - 1),
        clearcoat: params.clearcoat,
        clearcoatRoughness: 0.05,
      });
      mats.push(m);
      const s = new THREE.Mesh(geo, m);
      s.position.set((col - (N - 1) / 2) * 1.5, (row - (N - 1) / 2) * 1.5, 0);
      group.add(s);
    }
  scene.add(group);

  const dir = new THREE.DirectionalLight('#ffffff', 2.5);
  dir.position.set(-4, 5, 6);
  scene.add(dir);

  addLabel('거칠기 0 → 1  ▶', { left: '50%', bottom: '8px', transform: 'translateX(-50%)' });
  addLabel('금속성 0 → 1  ▶', { left: '8px', top: '50%', transform: 'translateY(-50%) rotate(-90deg)', transformOrigin: 'left top', marginTop: '60px' });

  const apply = () => {
    scene.environment = params.envMap ? env : null;
    scene.environmentIntensity = params.envIntensity;
    scene.background = params.envMap && params.showBackground ? env : bg;
    scene.backgroundBlurriness = 0.4;
    dir.visible = params.directional;
    mats.forEach((m) => {
      m.color.set(params.color);
      m.clearcoat = params.clearcoat;
    });
  };
  apply();

  gui.addColor(params, 'color').name('기본 색').onChange(apply);
  gui.add(params, 'envMap').name('환경맵 (IBL)').onChange(apply);
  gui.add(params, 'envIntensity', 0, 3, 0.01).name('환경맵 세기').onChange(apply);
  gui.add(params, 'showBackground').name('환경맵을 배경으로').onChange(apply);
  gui.add(params, 'directional').name('방향광').onChange(apply);
  gui.add(params, 'clearcoat', 0, 1, 0.01).name('clearcoat (Physical)').onChange(apply);

  return {
    scene,
    camera,
    controls: orbit(camera, canvas),
    resize(w, h) {
      // 그리드가 화면에 들어오도록 거리 조절
      const fit = Math.max(7.6 / (2 * Math.tan(THREE.MathUtils.degToRad(15)) * (w / h)), 7.6 / (2 * Math.tan(THREE.MathUtils.degToRad(15))));
      camera.position.setLength(fit * 1.12);
    },
  };
}
