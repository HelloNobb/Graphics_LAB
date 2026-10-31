import * as THREE from 'three';
import { orbit, options } from '../../../shared/helpers.js';
import { checkerCanvas, letterCanvas, canvasTexture } from '../../../shared/textures.js';

const WRAP = { Clamp: THREE.ClampToEdgeWrapping, Repeat: THREE.RepeatWrapping, Mirrored: THREE.MirroredRepeatWrapping };
const MAG = { Nearest: THREE.NearestFilter, Linear: THREE.LinearFilter };
const MIN = {
  Nearest: THREE.NearestFilter,
  Linear: THREE.LinearFilter,
  NearestMipmapNearest: THREE.NearestMipmapNearestFilter,
  LinearMipmapLinear: THREE.LinearMipmapLinearFilter,
};

export const params = {
  wrapS: 'Repeat',
  wrapT: 'Repeat',
  panelRepeat: 3,
  magFilter: 'Nearest',
  minFilter: 'LinearMipmapLinear',
  anisotropy: 1,
  floorRepeat: 40,
  drift: true,
};

export function create({ renderer, canvas, gui, params }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#151922');
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
  camera.position.set(0, 1.6, 6);

  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  // 바닥: 촘촘한 체커 → 필터링 차이가 크게 보인다
  const floorTex = canvasTexture(checkerCanvas(256, 2, '#f2f2f2', '#20242c'));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ map: floorTex }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // 패널: 작은 'F' 텍스처(64px) → 래핑 + 확대 필터 차이
  const letterTex = canvasTexture(letterCanvas(32));
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map: letterTex }));
  panel.position.set(-1.8, 1.6, 2);
  panel.rotation.y = 0.35;
  scene.add(panel);
  const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(2.4, 2.4)), new THREE.LineBasicMaterial({ color: '#ffffff' }));
  panel.add(frame);

  const apply = () => {
    letterTex.wrapS = WRAP[params.wrapS];
    letterTex.wrapT = WRAP[params.wrapT];
    letterTex.repeat.setScalar(params.panelRepeat);
    letterTex.offset.setScalar(-(params.panelRepeat - 1) / 2); // 가운데 칸이 원본(0~1)
    letterTex.magFilter = MAG[params.magFilter];
    floorTex.repeat.setScalar(params.floorRepeat);
    floorTex.magFilter = MAG[params.magFilter];
    floorTex.minFilter = MIN[params.minFilter];
    floorTex.generateMipmaps = params.minFilter.includes('Mipmap');
    floorTex.anisotropy = Math.min(params.anisotropy, maxAniso);
    letterTex.needsUpdate = true; // 래핑·필터 변경은 GPU 텍스처 재설정이 필요
    floorTex.needsUpdate = true;
  };
  apply();

  const fw = gui.addFolder('래핑 (패널)');
  fw.add(params, 'wrapS', options(Object.keys(WRAP))).name('wrapS (가로)').onChange(apply);
  fw.add(params, 'wrapT', options(Object.keys(WRAP))).name('wrapT (세로)').onChange(apply);
  fw.add(params, 'panelRepeat', 1, 5, 1).name('repeat').onChange(apply);
  const ff = gui.addFolder('필터링');
  ff.add(params, 'magFilter', options(Object.keys(MAG))).name('magFilter (확대)').onChange(apply);
  ff.add(params, 'minFilter', options(Object.keys(MIN))).name('minFilter (축소)').onChange(apply);
  ff.add(params, 'anisotropy', 1, 16, 1).name(`anisotropy (최대 ${maxAniso})`).onChange(apply);
  ff.add(params, 'floorRepeat', 4, 120, 1).name('바닥 반복 수').onChange(apply);
  gui.add(params, 'drift').name('카메라 천천히 이동');

  const controls = orbit(camera, canvas, [0, 1, -4], { maxPolarAngle: Math.PI / 2 - 0.05 });
  let t = 0;
  return {
    scene,
    camera,
    controls,
    update(dt) {
      if (!params.drift) return;
      t += dt;
      floor.position.z = (t * 0.6) % 20; // 바닥을 흘려 지글거림이 보이게
    },
  };
}
