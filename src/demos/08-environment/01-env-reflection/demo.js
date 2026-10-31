import * as THREE from 'three';
import { orbit, options } from '../../../shared/helpers.js';
import { roomEnvironment } from '../../../shared/environment.js';
import { checkerCanvas, canvasTexture } from '../../../shared/textures.js';

export const params = {
  mode: 'dynamic',
  roughness: 0.05,
  metalness: 1,
  color: '#ffffff',
  envIntensity: 1,
  cubeRes: '256',
  showBackground: false,
  animate: true,
};

export function create({ renderer, canvas, gui, params, track }) {
  const scene = new THREE.Scene();
  const bgColor = new THREE.Color('#1b2130');
  scene.background = bgColor;
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  camera.position.set(5, 3.2, 7);

  const staticEnv = track(roomEnvironment(renderer)).texture;

  const floorTex = canvasTexture(checkerCanvas(256, 2, '#d5d9e2', '#3a4150'), { repeat: [12, 12], anisotropy: 8 });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(20, 64), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.8 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // 반사되는 주인공
  const sphereMat = new THREE.MeshStandardMaterial({ color: params.color, metalness: params.metalness, roughness: params.roughness });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1.3, 64, 32), sphereMat);
  sphere.position.y = 1.4;
  scene.add(sphere);

  // 주변을 도는 물체들
  const orbiters = new THREE.Group();
  const colors = ['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff', '#c77dff', '#ff9f45'];
  colors.forEach((c, i) => {
    const geo = i % 2 ? new THREE.BoxGeometry(0.7, 0.7, 0.7) : new THREE.IcosahedronGeometry(0.45, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, emissive: c, emissiveIntensity: 0.25 }));
    const a = (i / colors.length) * Math.PI * 2;
    m.position.set(Math.cos(a) * 3.2, 1.2 + (i % 3) * 0.5, Math.sin(a) * 3.2);
    orbiters.add(m);
  });
  scene.add(orbiters);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 4, 16), new THREE.MeshStandardMaterial({ color: '#e8e2d0', roughness: 0.6 }));
    p.position.set(Math.cos(a) * 8, 2, Math.sin(a) * 8);
    scene.add(p);
  }

  scene.add(new THREE.HemisphereLight('#bcd0ff', '#3b3329', 1.2));
  const sun = new THREE.DirectionalLight('#fff2df', 2.2);
  sun.position.set(5, 8, 3);
  scene.add(sun);

  let cubeRT = new THREE.WebGLCubeRenderTarget(Number(params.cubeRes), { type: THREE.HalfFloatType });
  const cubeCamera = new THREE.CubeCamera(0.1, 100, cubeRT);
  scene.add(cubeCamera);

  const apply = () => {
    if (cubeRT.width !== Number(params.cubeRes)) {
      cubeRT.dispose();
      cubeRT = new THREE.WebGLCubeRenderTarget(Number(params.cubeRes), { type: THREE.HalfFloatType });
      cubeCamera.renderTarget = cubeRT;
    }
    sphereMat.color.set(params.color);
    sphereMat.roughness = params.roughness;
    sphereMat.metalness = params.metalness;
    sphereMat.envMapIntensity = params.envIntensity;
    sphereMat.envMap = params.mode === 'static' ? staticEnv : params.mode === 'dynamic' ? cubeRT.texture : null;
    sphereMat.needsUpdate = true;
    scene.background = params.mode === 'static' && params.showBackground ? staticEnv : bgColor;
  };
  apply();

  gui.add(params, 'mode', options([['환경맵 없음', 'none'], ['정적 환경맵 (PMREM)', 'static'], ['실시간 CubeCamera', 'dynamic']])).name('반사 방식').onChange(apply);
  gui.add(params, 'roughness', 0, 1, 0.01).name('거칠기').onChange(apply);
  gui.add(params, 'metalness', 0, 1, 0.01).name('금속성').onChange(apply);
  gui.addColor(params, 'color').name('색').onChange(apply);
  gui.add(params, 'envIntensity', 0, 3, 0.01).name('envMapIntensity').onChange(apply);
  gui.add(params, 'cubeRes', options(['16', '32', '64', '128', '256', '512'])).name('CubeCamera 해상도').onChange(apply);
  gui.add(params, 'showBackground').name('정적 환경맵을 배경으로').onChange(apply);
  gui.add(params, 'animate').name('움직이기');

  let t = 0;
  return {
    scene,
    camera,
    controls: orbit(camera, canvas, [0, 1.3, 0], { maxPolarAngle: Math.PI / 2 - 0.05 }),
    update(dt) {
      if (params.animate) t += dt;
      orbiters.rotation.y = t * 0.5;
      orbiters.children.forEach((m, i) => {
        m.rotation.set(t * (0.5 + i * 0.1), t * 0.7, 0);
        m.position.y = 1.2 + Math.sin(t * 1.5 + i) * 0.6;
      });
    },
    render() {
      if (params.mode === 'dynamic') {
        sphere.visible = false;
        cubeCamera.position.copy(sphere.position);
        cubeCamera.update(renderer, scene);
        sphere.visible = true;
      }
      renderer.render(scene, camera);
    },
    dispose() {
      cubeRT.dispose();
      floorTex.dispose();
    },
  };
}
