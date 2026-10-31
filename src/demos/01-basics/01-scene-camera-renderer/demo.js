import * as THREE from 'three';
import { orbit } from '../../../shared/helpers.js';

export const params = {
  background: '#11151b',
  color: '#7cf0c5',
  antialias: true,
  pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
  light: true,
  wireframe: false,
  rotate: true,
};

export function create({ renderer, canvas, gui, hud, params, restart }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(params.background);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(3, 2, 4);

  const material = new THREE.MeshStandardMaterial({ color: params.color, roughness: 0.4, wireframe: params.wireframe });
  const cube = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), material);
  scene.add(cube);

  const key = new THREE.DirectionalLight('#ffffff', 3);
  key.position.set(3, 4, 2);
  const fill = new THREE.AmbientLight('#8899bb', 0.4);
  scene.add(key, fill);
  key.visible = fill.visible = params.light;

  const applyRatio = () => {
    renderer.setPixelRatio(params.pixelRatio);
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  };
  applyRatio();

  gui.addColor(params, 'background').name('배경색').onChange((v) => scene.background.set(v));
  gui.addColor(params, 'color').name('큐브 색').onChange((v) => material.color.set(v));
  gui.add(params, 'light').name('조명').onChange((v) => (key.visible = fill.visible = v));
  gui.add(params, 'wireframe').name('와이어프레임').onChange((v) => (material.wireframe = v));
  gui.add(params, 'rotate').name('회전');
  gui.add(params, 'pixelRatio', 0.25, 2, 0.25).name('pixelRatio').onChange(applyRatio);
  gui.add(params, 'antialias').name('안티앨리어싱 (재시작)').onChange(() => restart());

  return {
    scene,
    camera,
    controls: orbit(camera, canvas),
    resize() {
      applyRatio();
    },
    update(dt) {
      if (params.rotate) {
        cube.rotation.x += dt * 0.4;
        cube.rotation.y += dt * 0.6;
      }
      const w = renderer.domElement.width;
      const h = renderer.domElement.height;
      hud.textContent = `캔버스 ${w}×${h}px  (CSS ${canvas.clientWidth}×${canvas.clientHeight} × ${params.pixelRatio})`;
    },
  };
}
