import * as THREE from 'three';
import { orbit, options } from '../../../shared/helpers.js';
import { brickColorCanvas, brickHeightCanvas, heightToNormalCanvas, canvasTexture, thumbnail } from '../../../shared/textures.js';

export const params = {
  mode: 'normal',
  normalScale: 1.2,
  bumpScale: 3,
  displacementScale: 0.08,
  colorMap: true,
  lightSpeed: 0.6,
  lightHeight: 0.6,
  lightIntensity: 6,
};

export function create(ctx) {
  const { renderer, canvas, gui, params, quality } = ctx;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0b0d11');
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0.6, 0.4, 4.2);

  const heightCv = brickHeightCanvas(512);
  const normalCv = heightToNormalCanvas(heightCv, 3);
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const colorTex = canvasTexture(brickColorCanvas(512), { repeat: [2, 2], anisotropy: aniso });
  const heightTex = canvasTexture(heightCv, { color: false, repeat: [2, 2], anisotropy: aniso });
  const normalTex = canvasTexture(normalCv, { color: false, repeat: [2, 2], anisotropy: aniso });

  thumbnail(ctx, heightCv, '높이맵');
  thumbnail(ctx, normalCv, '노멀맵');

  const seg = quality === 'low' ? 160 : 256;
  const material = new THREE.MeshStandardMaterial({ roughness: 0.85 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(4, 4, seg, seg), material);
  scene.add(wall);
  const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1, 64, 64, 64), material);
  cube.position.set(1.4, -0.9, 0.9);
  cube.rotation.y = -0.5;
  scene.add(cube);

  scene.add(new THREE.AmbientLight('#ffffff', 0.08));
  const light = new THREE.PointLight('#ffe3b8', params.lightIntensity, 0, 1.5);
  light.add(new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' })));
  scene.add(light);

  const apply = () => {
    material.map = params.colorMap ? colorTex : null;
    material.color.set(params.colorMap ? '#ffffff' : '#9a8f86');
    material.normalMap = params.mode === 'normal' ? normalTex : null;
    material.bumpMap = params.mode === 'bump' ? heightTex : null;
    material.displacementMap = params.mode === 'displacement' ? heightTex : null;
    material.normalScale.setScalar(params.normalScale);
    material.bumpScale = params.bumpScale;
    material.displacementScale = params.displacementScale;
    material.displacementBias = -params.displacementScale / 2;
    if (params.mode === 'displacement') {
      // 실제로 정점이 움직이므로 노멀은 노멀맵으로 보정
      material.normalMap = normalTex;
    }
    light.intensity = params.lightIntensity;
    material.needsUpdate = true; // 맵의 유무가 바뀌면 셰이더 재컴파일
  };
  apply();

  gui.add(params, 'mode', options([['없음 (평평)', 'none'], ['노멀맵', 'normal'], ['범프맵', 'bump'], ['디스플레이스먼트 + 노멀맵', 'displacement']])).name('방식').onChange(apply);
  gui.add(params, 'normalScale', -3, 3, 0.05).name('normalScale').onChange(apply);
  gui.add(params, 'bumpScale', 0, 10, 0.1).name('bumpScale').onChange(apply);
  gui.add(params, 'displacementScale', 0, 0.3, 0.005).name('displacementScale').onChange(apply);
  gui.add(params, 'colorMap').name('색상 맵').onChange(apply);
  gui.add(params, 'lightSpeed', 0, 2, 0.01).name('광원 속도');
  gui.add(params, 'lightHeight', 0.1, 2, 0.01).name('광원과 벽 거리');
  gui.add(params, 'lightIntensity', 0, 20, 0.1).name('광원 세기').onChange(apply);

  let t = 0;
  return {
    scene,
    camera,
    controls: orbit(camera, canvas),
    update(dt) {
      t += dt * params.lightSpeed;
      light.position.set(Math.cos(t) * 1.6, Math.sin(t * 1.3) * 1.4, params.lightHeight);
    },
    dispose() {
      [colorTex, heightTex, normalTex].forEach((x) => x.dispose());
    },
  };
}
