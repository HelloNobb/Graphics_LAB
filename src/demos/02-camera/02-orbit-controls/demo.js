import * as THREE from 'three';
import { orbit, rng } from '../../../shared/helpers.js';

export const params = {
  enableDamping: true,
  dampingFactor: 0.08,
  autoRotate: false,
  autoRotateSpeed: 2,
  rotateSpeed: 1,
  minDistance: 3,
  maxDistance: 30,
  minPolar: 0,
  maxPolar: 85,
  enablePan: true,
  showLimits: false,
};

export function create({ canvas, gui, hud, params }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#10141a');
  scene.fog = new THREE.Fog('#10141a', 30, 70);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  camera.position.set(10, 8, 12);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshStandardMaterial({ color: '#1d222b', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  scene.add(new THREE.GridHelper(60, 60, '#2c3340', '#20252e'));

  // 작은 도시
  const r = rng(3);
  const box = new THREE.BoxGeometry(1, 1, 1);
  box.translate(0, 0.5, 0);
  const palette = ['#8fb4ff', '#7cf0c5', '#ffb86b', '#d4d8e2', '#ff7a85'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }));
  for (let x = -6; x <= 6; x++)
    for (let z = -6; z <= 6; z++) {
      if (Math.abs(x) < 2 && Math.abs(z) < 2) continue;
      if (r() < 0.45) continue;
      const b = new THREE.Mesh(box, palette[Math.floor(r() * palette.length)]);
      b.position.set(x * 1.6, 0, z * 1.6);
      b.scale.set(0.6 + r() * 0.6, 0.5 + r() ** 2 * 5, 0.6 + r() * 0.6);
      scene.add(b);
    }
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 4, 24), new THREE.MeshStandardMaterial({ color: '#e8ecf3', roughness: 0.3, metalness: 0.2 }));
  tower.position.y = 2;
  scene.add(tower);

  scene.add(new THREE.HemisphereLight('#dfe8ff', '#1a1f28', 1.3));
  const sun = new THREE.DirectionalLight('#fff4e0', 2.5);
  sun.position.set(8, 12, 4);
  scene.add(sun);

  // target 마커
  const marker = new THREE.Group();
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 8), new THREE.MeshBasicMaterial({ color: '#ffd84a', depthTest: false }));
  dot.renderOrder = 5;
  marker.add(dot);
  scene.add(marker);

  const limitMat = (c) => new THREE.MeshBasicMaterial({ color: c, wireframe: true, transparent: true, opacity: 0.18 });
  const minSphere = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), limitMat('#7cf0c5'));
  const maxSphere = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), limitMat('#ff7a85'));
  marker.add(minSphere, maxSphere);

  const controls = orbit(camera, canvas, [0, 1.5, 0]);
  controls.saveState();

  const apply = () => {
    controls.enableDamping = params.enableDamping;
    controls.dampingFactor = params.dampingFactor;
    controls.autoRotate = params.autoRotate;
    controls.autoRotateSpeed = params.autoRotateSpeed;
    controls.rotateSpeed = params.rotateSpeed;
    controls.minDistance = params.minDistance;
    controls.maxDistance = Math.max(params.maxDistance, params.minDistance + 0.5);
    controls.minPolarAngle = THREE.MathUtils.degToRad(params.minPolar);
    controls.maxPolarAngle = THREE.MathUtils.degToRad(Math.max(params.maxPolar, params.minPolar + 1));
    controls.enablePan = params.enablePan;
    minSphere.scale.setScalar(controls.minDistance);
    maxSphere.scale.setScalar(controls.maxDistance);
    minSphere.visible = maxSphere.visible = params.showLimits;
  };
  apply();

  gui.add(params, 'enableDamping').name('damping (관성)').onChange(apply);
  gui.add(params, 'dampingFactor', 0.01, 0.3, 0.01).name('dampingFactor').onChange(apply);
  gui.add(params, 'autoRotate').name('자동 회전').onChange(apply);
  gui.add(params, 'autoRotateSpeed', -10, 10, 0.1).name('자동 회전 속도').onChange(apply);
  gui.add(params, 'rotateSpeed', 0.1, 3, 0.1).name('회전 감도').onChange(apply);
  gui.add(params, 'minDistance', 1, 15, 0.1).name('최소 거리').onChange(apply);
  gui.add(params, 'maxDistance', 5, 60, 0.5).name('최대 거리').onChange(apply);
  gui.add(params, 'minPolar', 0, 90, 1).name('최소 극각 (°)').onChange(apply);
  gui.add(params, 'maxPolar', 1, 180, 1).name('최대 극각 (°)').onChange(apply);
  gui.add(params, 'enablePan').name('팬(이동) 허용').onChange(apply);
  gui.add(params, 'showLimits').name('거리 한계 표시').onChange(apply);
  gui.add({ reset: () => controls.reset() }, 'reset').name('카메라 위치 리셋');

  const d = THREE.MathUtils.radToDeg;
  return {
    scene,
    camera,
    controls,
    update() {
      marker.position.copy(controls.target);
      hud.textContent = `거리 ${controls.getDistance().toFixed(1)}  극각 ${d(controls.getPolarAngle()).toFixed(0)}°  방위각 ${d(controls.getAzimuthalAngle()).toFixed(0)}°`;
    },
  };
}
