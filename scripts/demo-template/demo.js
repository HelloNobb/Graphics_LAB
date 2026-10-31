import * as THREE from 'three';
import { orbit } from '../../../shared/helpers.js';

// GUI 상태 초깃값. DemoHost가 복사해 보관하므로 화면을 벗어났다 돌아와도 값이 유지된다.
export const params = {
  speed: 1,
  color: '#7cf0c5',
};

export function create({ canvas, gui, params }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#101318');
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(3, 2, 4);

  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color: params.color }));
  scene.add(mesh, new THREE.HemisphereLight('#ffffff', '#334', 2));

  gui.add(params, 'speed', 0, 5, 0.01).name('회전 속도');
  gui.addColor(params, 'color').name('색').onChange((v) => mesh.material.color.set(v));

  return {
    scene,
    camera,
    controls: orbit(camera, canvas),
    update(dt) {
      mesh.rotation.y += dt * params.speed;
    },
  };
}
