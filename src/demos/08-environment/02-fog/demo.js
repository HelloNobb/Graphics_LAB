import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { orbit, options, rng } from '../../../shared/helpers.js';

export const params = {
  type: 'Fog',
  color: '#b9c7d9',
  near: 6,
  far: 60,
  density: 0.035,
  syncBackground: true,
  move: true,
};

export function create({ canvas, gui, params }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 300);
  camera.position.set(0, 2.2, 8);

  const LEN = 160;
  const world = new THREE.Group();
  scene.add(world);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, LEN * 2), new THREE.MeshStandardMaterial({ color: '#6c7a5c', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(4, LEN * 2), new THREE.MeshStandardMaterial({ color: '#4a4d55', roughness: 0.9 }));
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.01;
  scene.add(road);

  // 정적인 배경은 재질별로 지오메트리를 하나로 합쳐 드로우콜을 줄인다 (16장 참고)
  const r = rng(5);
  const parts = { trunk: [], leaf: [], lamp: [] };
  const place = (geo, list, x, y, z, s = 1) => list.push(geo.clone().scale(s, s, s).translate(x, y * s, z));
  const trunk = new THREE.CylinderGeometry(0.15, 0.2, 1.4, 8);
  const leaves = new THREE.ConeGeometry(0.9, 2.6, 8);
  const lamp = new THREE.BoxGeometry(0.2, 3.2, 0.2);
  for (let z = 0; z < LEN; z += 4) {
    for (const side of [-1, 1]) {
      place(lamp, parts.lamp, side * 2.8, 1.6, -z);
      for (let k = 0; k < 2; k++) {
        const x = side * (5 + r() * 12);
        const tz = -z - r() * 4;
        const s = 0.8 + r() * 0.8;
        place(trunk, parts.trunk, x, 0.7, tz, s);
        place(leaves, parts.leaf, x, 2.4, tz, s);
      }
    }
  }
  const mats = {
    trunk: new THREE.MeshStandardMaterial({ color: '#5a3e2b' }),
    leaf: new THREE.MeshStandardMaterial({ color: '#2f6b3f', flatShading: true }),
    lamp: new THREE.MeshStandardMaterial({ color: '#d9dde5', roughness: 0.4 }),
  };
  for (const key of Object.keys(parts)) {
    world.add(new THREE.Mesh(mergeGeometries(parts[key]), mats[key]));
    parts[key].forEach((g) => g.dispose());
  }
  [trunk, leaves, lamp].forEach((g) => g.dispose());
  // 반복 이동을 위해 한 벌 더 (지오메트리·재질 공유)
  const copy = world.clone();
  copy.position.z = -LEN;
  scene.add(copy);

  scene.add(new THREE.HemisphereLight('#dfe8f5', '#4b4434', 1.6));
  const sun = new THREE.DirectionalLight('#ffffff', 1.6);
  sun.position.set(-3, 6, 2);
  scene.add(sun);

  const fogLinear = new THREE.Fog(params.color, params.near, params.far);
  const fogExp = new THREE.FogExp2(params.color, params.density);
  const bgDefault = new THREE.Color('#2a3140');

  const apply = () => {
    fogLinear.color.set(params.color);
    fogLinear.near = params.near;
    fogLinear.far = Math.max(params.far, params.near + 0.5);
    fogExp.color.set(params.color);
    fogExp.density = params.density;
    scene.fog = params.type === 'Fog' ? fogLinear : params.type === 'FogExp2' ? fogExp : null;
    scene.background = params.syncBackground ? new THREE.Color(params.color) : bgDefault;
  };
  apply();

  gui.add(params, 'type', options([['Fog (선형)', 'Fog'], ['FogExp2 (지수)', 'FogExp2'], ['없음', 'none']])).name('안개 종류').onChange(apply);
  gui.addColor(params, 'color').name('안개 색').onChange(apply);
  gui.add(params, 'near', 0, 60, 0.5).name('near (Fog)').onChange(apply);
  gui.add(params, 'far', 1, 200, 1).name('far (Fog)').onChange(apply);
  gui.add(params, 'density', 0, 0.12, 0.001).name('density (Exp2)').onChange(apply);
  gui.add(params, 'syncBackground').name('배경색과 맞추기').onChange(apply);
  gui.add(params, 'move').name('앞으로 이동');

  let z = 0;
  return {
    scene,
    camera,
    controls: orbit(camera, canvas, [0, 1.6, -10], { maxPolarAngle: Math.PI / 2 - 0.02 }),
    update(dt) {
      if (!params.move) return;
      z = (z + dt * 6) % LEN;
      world.position.z = z;
      copy.position.z = z - LEN;
    },
  };
}
