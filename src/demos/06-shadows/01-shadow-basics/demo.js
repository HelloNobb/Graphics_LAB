import * as THREE from 'three';
import { orbit, options } from '../../../shared/helpers.js';

export const params = {
  light: 'directional',
  type: 'PCF',
  radius: 3,
  castShadow: true,
  receiveShadow: true,
  shadowIntensity: 1,
  showCamera: false,
  animate: true,
};

const TYPES = { Basic: THREE.BasicShadowMap, PCF: THREE.PCFShadowMap, VSM: THREE.VSMShadowMap };

export function create({ renderer, canvas, gui, params }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0d1015');
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(7, 7, 10);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: '#a7adb8', roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const casters = [];
  const add = (geo, color, pos) => {
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));
    m.position.set(...pos);
    scene.add(m);
    casters.push(m);
    return m;
  };
  const knot = add(new THREE.TorusKnotGeometry(0.7, 0.25, 128, 20), '#e8e8ee', [0, 2, 0]);
  add(new THREE.BoxGeometry(1.2, 2.4, 1.2), '#d9654b', [-2.6, 1.2, 1.2]);
  add(new THREE.SphereGeometry(0.8, 48, 24), '#5e8bff', [2.4, 0.8, 1.4]);
  add(new THREE.ConeGeometry(0.7, 1.8, 32), '#e9d38f', [1.2, 0.9, -2.4]);
  const ring = add(new THREE.TorusGeometry(0.9, 0.15, 16, 64), '#7cf0c5', [-1.6, 1.4, -2.2]);

  scene.add(new THREE.HemisphereLight('#c8d6ff', '#3a3530', 0.6));

  const dir = new THREE.DirectionalLight('#fff4e0', 2.6);
  dir.shadow.camera.left = dir.shadow.camera.bottom = -6;
  dir.shadow.camera.right = dir.shadow.camera.top = 6;
  dir.shadow.camera.near = 1;
  dir.shadow.camera.far = 30;
  const spot = new THREE.SpotLight('#fff4e0', 220, 0, THREE.MathUtils.degToRad(40), 0.3, 2);
  const point = new THREE.PointLight('#fff4e0', 60, 0, 2);
  point.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' })));
  const lights = { directional: dir, spot, point };
  for (const l of Object.values(lights)) {
    l.castShadow = true;
    l.shadow.mapSize.set(1024, 1024);
    l.shadow.bias = -0.0005;
    l.shadow.normalBias = 0.02;
    scene.add(l);
  }
  scene.add(spot.target);
  const dirHelper = new THREE.CameraHelper(dir.shadow.camera);
  const spotHelper = new THREE.CameraHelper(spot.shadow.camera);
  scene.add(dirHelper, spotHelper);

  const resetShadowMaps = () => {
    for (const l of Object.values(lights)) {
      l.shadow.map?.dispose();
      l.shadow.map = null;
    }
    scene.traverse((o) => {
      if (o.material) o.material.needsUpdate = true; // 섀도우 타입이 바뀌면 셰이더 재컴파일 필요
    });
  };

  const apply = () => {
    for (const [name, l] of Object.entries(lights)) {
      l.visible = params.light === name;
      l.shadow.radius = params.radius;
      l.shadow.blurSamples = 12;
      l.shadow.intensity = params.shadowIntensity;
    }
    casters.forEach((m) => (m.castShadow = params.castShadow));
    casters.forEach((m) => (m.receiveShadow = true));
    floor.receiveShadow = params.receiveShadow;
    dirHelper.visible = params.showCamera && params.light === 'directional';
    spotHelper.visible = params.showCamera && params.light === 'spot';
  };
  const setType = () => {
    renderer.shadowMap.type = TYPES[params.type];
    resetShadowMaps();
  };
  setType();
  apply();

  gui.add(params, 'light', options([['방향광 (태양)', 'directional'], ['스포트라이트', 'spot'], ['점광원 (큐브 6면)', 'point']])).name('광원').onChange(apply);
  gui.add(params, 'type', options(Object.keys(TYPES))).name('섀도우 타입').onChange(setType);
  gui.add(params, 'radius', 0, 12, 0.1).name('radius (흐림)').onChange(apply);
  gui.add(params, 'shadowIntensity', 0, 1, 0.01).name('그림자 진하기').onChange(apply);
  gui.add(params, 'castShadow').name('물체 castShadow').onChange(apply);
  gui.add(params, 'receiveShadow').name('바닥 receiveShadow').onChange(apply);
  gui.add(params, 'showCamera').name('그림자 카메라 표시').onChange(apply);
  gui.add(params, 'animate').name('움직이기');

  let t = 0;
  return {
    scene,
    camera,
    controls: orbit(camera, canvas, [0, 1, 0]),
    update(dt) {
      if (params.animate) t += dt;
      knot.rotation.set(t * 0.4, t * 0.6, 0);
      ring.rotation.y = t * 0.8;
      dir.position.set(Math.cos(t * 0.25) * 6, 8, Math.sin(t * 0.25) * 6);
      spot.position.set(Math.cos(t * 0.3) * 5, 7, Math.sin(t * 0.3) * 5);
      point.position.set(Math.cos(t * 0.6) * 2.2, 3.6 + Math.sin(t) * 0.4, Math.sin(t * 0.6) * 2.2);
      dir.shadow.camera.updateMatrixWorld();
      dirHelper.update();
      spotHelper.update();
    },
  };
}
