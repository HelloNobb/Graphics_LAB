import * as THREE from 'three';
import { orbit, options } from '../../../shared/helpers.js';

export const params = {
  mapSize: '1024',
  bias: -0.0005,
  normalBias: 0.02,
  frustum: 6,
  elevation: 35,
  type: 'PCF',
  showCamera: false,
  spin: true,
};

const TYPES = { Basic: THREE.BasicShadowMap, PCF: THREE.PCFShadowMap };

export function create({ renderer, canvas, gui, hud, params }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0d1015');
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(5, 5.5, 8);

  const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), mat('#c3c7cf'));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const objs = [];
  const add = (mesh, pos) => {
    mesh.position.set(...pos);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    objs.push(mesh);
    return mesh;
  };
  add(new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), mat('#5e8bff')), [-1.8, 1, 0.5]);
  const knot = add(new THREE.Mesh(new THREE.TorusKnotGeometry(0.6, 0.22, 160, 24), mat('#e9d38f')), [1.6, 1.3, -0.6]);
  // 바닥에서 아주 살짝 떠 있는 판자 → 피터 패닝이 잘 보임
  add(new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 1.2), mat('#d9654b')), [0.2, 0.06, 2.2]);
  // 얇은 기둥 → 계단 현상이 잘 보임
  for (let i = 0; i < 5; i++) add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 12), mat('#7cf0c5')), [-3.2 + i * 0.35, 1.1, -2.4]);

  scene.add(new THREE.HemisphereLight('#c8d6ff', '#3a3530', 0.5));
  const light = new THREE.DirectionalLight('#fff4e0', 3);
  light.castShadow = true;
  scene.add(light, light.target);
  const helper = new THREE.CameraHelper(light.shadow.camera);
  scene.add(helper);

  const apply = () => {
    const size = Number(params.mapSize);
    if (light.shadow.mapSize.x !== size) {
      light.shadow.mapSize.set(size, size);
      light.shadow.map?.dispose();
      light.shadow.map = null; // 다음 렌더에서 새 크기로 생성
    }
    light.shadow.bias = params.bias;
    light.shadow.normalBias = params.normalBias;
    const c = light.shadow.camera;
    c.left = c.bottom = -params.frustum;
    c.right = c.top = params.frustum;
    c.near = 0.5;
    c.far = 40;
    c.updateProjectionMatrix();
    helper.visible = params.showCamera;
    const texel = (params.frustum * 2) / size;
    hud.textContent = `섀도우 맵 ${size}×${size}\n텍셀 1개 ≈ ${(texel * 100).toFixed(1)} cm (절두체 ${params.frustum * 2} m)`;
  };
  const setType = () => {
    renderer.shadowMap.type = TYPES[params.type];
    light.shadow.map?.dispose();
    light.shadow.map = null;
    scene.traverse((o) => o.material && (o.material.needsUpdate = true));
  };

  const refresh = () => {
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
    apply();
    setType();
  };
  const presets = {
    clean: () => Object.assign(params, { mapSize: '2048', bias: -0.0005, normalBias: 0.02, frustum: 5, elevation: 40, type: 'PCF' }),
    acne: () => Object.assign(params, { mapSize: '1024', bias: 0, normalBias: 0, frustum: 6, elevation: 18, type: 'Basic' }),
    peter: () => Object.assign(params, { mapSize: '2048', bias: -0.012, normalBias: 0, frustum: 5, elevation: 25, type: 'PCF' }),
    jaggy: () => Object.assign(params, { mapSize: '256', bias: -0.0005, normalBias: 0.02, frustum: 14, elevation: 45, type: 'Basic' }),
  };

  const fp = gui.addFolder('프리셋');
  fp.add({ f: () => (presets.clean(), refresh()) }, 'f').name('✓ 깔끔한 설정');
  fp.add({ f: () => (presets.acne(), refresh()) }, 'f').name('① 섀도우 애크니 재현');
  fp.add({ f: () => (presets.peter(), refresh()) }, 'f').name('② 피터 패닝 재현');
  fp.add({ f: () => (presets.jaggy(), refresh()) }, 'f').name('③ 계단 현상 재현');
  gui.add(params, 'mapSize', options(['128', '256', '512', '1024', '2048', '4096'])).name('mapSize').onChange(apply);
  gui.add(params, 'bias', -0.02, 0.005, 0.0001).name('bias').onChange(apply);
  gui.add(params, 'normalBias', 0, 0.2, 0.001).name('normalBias').onChange(apply);
  gui.add(params, 'frustum', 2, 20, 0.5).name('절두체 반경 (m)').onChange(apply);
  gui.add(params, 'elevation', 5, 85, 1).name('태양 고도 (°)');
  gui.add(params, 'type', options(Object.keys(TYPES))).name('섀도우 타입').onChange(setType);
  gui.add(params, 'showCamera').name('그림자 카메라 표시').onChange(apply);
  gui.add(params, 'spin').name('태양 회전');

  apply();
  setType();

  let az = 0.6;
  return {
    scene,
    camera,
    controls: orbit(camera, canvas, [0, 0.8, 0]),
    update(dt, t) {
      if (params.spin) az += dt * 0.15;
      const el = THREE.MathUtils.degToRad(params.elevation);
      light.position.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)).multiplyScalar(15);
      knot.rotation.y = t * 0.3;
      light.shadow.camera.updateMatrixWorld();
      helper.update();
    },
  };
}
