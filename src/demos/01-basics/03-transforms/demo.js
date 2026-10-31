import * as THREE from 'three';
import { orbit, deg, options } from '../../../shared/helpers.js';

export const params = {
  px: 0, py: 1, pz: 0,
  rx: 0, ry: 30, rz: 0,
  sx: 1, sy: 1, sz: 1,
  order: 'XYZ',
  showLocal: true,
  showWorld: true,
  showMatrix: true,
};

function makePlane() {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: '#e8ecf3', roughness: 0.5 });
  const accent = new THREE.MeshStandardMaterial({ color: '#ff8a65', roughness: 0.5 });
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 1.8, 16), body);
  fuselage.rotation.x = Math.PI / 2; // 기수(앞)가 +Z
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 16), accent);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 1.1;
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.05, 0.45), body);
  wing.position.z = 0.15;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.25), body);
  tail.position.z = -0.8;
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.4, 0.3), accent);
  fin.position.set(0, 0.22, -0.8);
  g.add(fuselage, nose, wing, tail, fin);
  return g;
}

export function create({ canvas, gui, hud, params }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0f1217');
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(5, 4, 6.5);

  const grid = new THREE.GridHelper(10, 10, '#4a5262', '#262b35');
  const worldAxes = new THREE.AxesHelper(4);
  worldAxes.material.depthTest = false;
  worldAxes.renderOrder = 1;
  scene.add(grid, worldAxes);

  const plane = makePlane();
  const localAxes = new THREE.AxesHelper(1.4);
  localAxes.material.depthTest = false;
  localAxes.renderOrder = 2;
  plane.add(localAxes);
  scene.add(plane);

  scene.add(new THREE.HemisphereLight('#ffffff', '#2a2f3a', 1.6));
  const sun = new THREE.DirectionalLight('#ffffff', 2);
  sun.position.set(3, 5, 2);
  scene.add(sun);

  const apply = () => {
    plane.position.set(params.px, params.py, params.pz);
    plane.rotation.set(deg(params.rx), deg(params.ry), deg(params.rz), params.order);
    plane.scale.set(params.sx, params.sy, params.sz);
    localAxes.visible = params.showLocal;
    worldAxes.visible = params.showWorld;
    if (!params.showMatrix) hud.textContent = '';
  };
  apply();

  const fp = gui.addFolder('위치 position');
  fp.add(params, 'px', -4, 4, 0.01).name('X').onChange(apply);
  fp.add(params, 'py', -2, 4, 0.01).name('Y').onChange(apply);
  fp.add(params, 'pz', -4, 4, 0.01).name('Z').onChange(apply);
  const fr = gui.addFolder('회전 rotation (°)');
  fr.add(params, 'rx', -180, 180, 1).name('X').onChange(apply);
  fr.add(params, 'ry', -180, 180, 1).name('Y').onChange(apply);
  fr.add(params, 'rz', -180, 180, 1).name('Z').onChange(apply);
  fr.add(params, 'order', options(['XYZ', 'XZY', 'YXZ', 'YZX', 'ZXY', 'ZYX'])).name('회전 순서').onChange(apply);
  const fs = gui.addFolder('크기 scale').close();
  fs.add(params, 'sx', 0.2, 3, 0.01).name('X').onChange(apply);
  fs.add(params, 'sy', 0.2, 3, 0.01).name('Y').onChange(apply);
  fs.add(params, 'sz', 0.2, 3, 0.01).name('Z').onChange(apply);
  gui.add(params, 'showLocal').name('로컬 축 표시').onChange(apply);
  gui.add(params, 'showWorld').name('월드 축 표시').onChange(apply);
  gui.add(params, 'showMatrix').name('모델 행렬 표시').onChange(apply);

  const f = (n) => (n >= 0 ? ' ' : '') + n.toFixed(2);
  return {
    scene,
    camera,
    controls: orbit(camera, canvas, [0, 0.8, 0]),
    update() {
      if (!params.showMatrix) return;
      plane.updateMatrixWorld();
      const e = plane.matrixWorld.elements; // column-major
      const rows = [0, 1, 2, 3].map((r) => `[${f(e[r])} ${f(e[r + 4])} ${f(e[r + 8])} ${f(e[r + 12])} ]`);
      hud.textContent = `모델 행렬 M = T·R·S\n${rows.join('\n')}`;
    },
  };
}
