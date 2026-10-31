import * as THREE from 'three';
import { options } from '../../../shared/helpers.js';

export const params = {
  fps: '60',
  speed: 1.2,
  paused: false,
};

export function create({ gui, hud, params, addLabel }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0f1217');
  const camera = new THREE.PerspectiveCamera(40, 2, 0.1, 100);
  camera.position.set(0, 1.2, 7);
  camera.lookAt(0, 0, 0);

  const geo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
  const frameCube = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#ff8a65', roughness: 0.5 }));
  const timeCube = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#7cf0c5', roughness: 0.5 }));
  scene.add(frameCube, timeCube);

  // 회전량이 보이도록 바늘 달기
  for (const c of [frameCube, timeCube]) {
    const needle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.2), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    needle.position.set(0, 0.76, 0.3);
    c.add(needle);
  }

  scene.add(new THREE.HemisphereLight('#ffffff', '#223', 1.5));
  const dir = new THREE.DirectionalLight('#ffffff', 2);
  dir.position.set(2, 3, 4);
  scene.add(dir);

  addLabel('프레임 기준: += 0.02', { left: '8%', bottom: '14%' });
  addLabel('시간 기준: += speed × dt', { right: '8%', bottom: '14%' });

  gui.add(params, 'fps', options([['15 FPS (느린 폰)', '15'], ['30 FPS', '30'], ['60 FPS (기준)', '60'], ['144 FPS (게이밍 모니터 흉내)', '144']])).name('FPS 제한');
  gui.add(params, 'speed', 0, 4, 0.1).name('목표 속도 (rad/s)');
  gui.add(params, 'paused').name('일시정지');

  let acc = 0;
  let ticks = 0;
  let tickTimer = 0;
  let shownFps = 0;

  const layout = (w, h) => {
    const x = w / h > 1.5 ? 2 : 1.4;
    frameCube.position.x = -x;
    timeCube.position.x = x;
    camera.position.z = w / h > 1.5 ? 7 : 8.5;
  };

  return {
    scene,
    camera,
    resize: layout,
    update(dt) {
      if (params.paused) return;
      const target = Number(params.fps);
      // 144는 실제로 그 빈도로 그릴 수 없으므로, 한 프레임에 여러 '틱'을 실행해 흉내 낸다.
      acc += dt;
      const step = 1 / target;
      let n = 0;
      while (acc >= step && n < 8) {
        acc -= step;
        n++;
        frameCube.rotation.y += 0.02 * (params.speed / 1.2); // 60fps 기준으로 맞춘 "프레임당 회전"
        timeCube.rotation.y += params.speed * step;
        ticks++;
      }
      if (acc > step * 8) acc = 0;
      tickTimer += dt;
      if (tickTimer > 0.5) {
        shownFps = Math.round(ticks / tickTimer);
        ticks = 0;
        tickTimer = 0;
      }
      const deg = (r) => ((THREE.MathUtils.radToDeg(r) % 360) + 360) % 360;
      hud.textContent = `업데이트 ${shownFps}회/초\n왼쪽 각도 ${deg(frameCube.rotation.y).toFixed(0)}°  오른쪽 ${deg(timeCube.rotation.y).toFixed(0)}°`;
    },
  };
}
