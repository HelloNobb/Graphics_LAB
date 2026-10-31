import * as THREE from 'three';
import { orbit } from '../../../shared/helpers.js';

export const params = {
  earthOrbit: 0.35,
  earthSpin: 1.5,
  moonOrbit: 1.6,
  systemScale: 1,
  showAxes: false,
  showOrbits: true,
  detachMoon: false,
};

const ring = (radius, color) => {
  const pts = [];
  for (let i = 0; i <= 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
  }
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5 }));
};

export function create({ canvas, gui, params }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#07080c');
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  camera.position.set(0, 7, 10);

  // 별 배경
  const starGeo = new THREE.BufferGeometry();
  const sp = new Float32Array(1500 * 3);
  for (let i = 0; i < sp.length; i += 3) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(60 + Math.random() * 30);
    sp.set([v.x, v.y, v.z], i);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#aab4cc', size: 0.15 })));

  const system = new THREE.Group();
  scene.add(system);

  const sun = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), new THREE.MeshBasicMaterial({ color: '#ffcc55' }));
  system.add(sun);
  const sunLight = new THREE.PointLight('#fff3dd', 60, 0, 1.4);
  system.add(sunLight);
  scene.add(new THREE.AmbientLight('#334', 0.6));

  const earthOrbit = new THREE.Object3D();
  system.add(earthOrbit);
  const earthPivot = new THREE.Object3D();
  earthPivot.position.x = 4;
  earthOrbit.add(earthPivot);
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 32, 16),
    new THREE.MeshStandardMaterial({ color: '#3f7cff', roughness: 0.7, flatShading: true }),
  );
  earth.rotation.z = THREE.MathUtils.degToRad(23.4);
  earthPivot.add(earth);
  const moonOrbit = new THREE.Object3D();
  earthPivot.add(moonOrbit);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 12), new THREE.MeshStandardMaterial({ color: '#c9c9c9', roughness: 1 }));
  moon.position.x = 1.2;
  moonOrbit.add(moon);

  const earthRing = ring(4, '#4a5a80');
  const moonRing = ring(1.2, '#5a6070');
  system.add(earthRing);
  earthPivot.add(moonRing);

  const axes = [sun, earthOrbit, earth, moonOrbit, moon].map((o) => {
    const a = new THREE.AxesHelper(o === sun ? 2 : 0.8);
    a.material.depthTest = false;
    a.renderOrder = 2;
    o.add(a);
    return a;
  });

  const applyVis = () => {
    axes.forEach((a) => (a.visible = params.showAxes));
    earthRing.visible = moonRing.visible = params.showOrbits;
    system.scale.setScalar(params.systemScale);
  };
  applyVis();

  const setDetached = (v) => {
    // attach(): 월드 변환을 유지하면서 부모를 바꾼다
    if (v) scene.attach(moon);
    else {
      moonOrbit.attach(moon);
      moon.position.set(1.2, 0, 0);
      moon.rotation.set(0, 0, 0);
      moon.scale.setScalar(1);
    }
  };
  if (params.detachMoon) setDetached(true);

  gui.add(params, 'earthOrbit', 0, 2, 0.01).name('지구 공전 속도');
  gui.add(params, 'earthSpin', 0, 6, 0.01).name('지구 자전 속도');
  gui.add(params, 'moonOrbit', 0, 6, 0.01).name('달 공전 속도');
  gui.add(params, 'systemScale', 0.3, 2, 0.01).name('전체 크기 (부모 scale)').onChange(applyVis);
  gui.add(params, 'showAxes').name('로컬 축 표시').onChange(applyVis);
  gui.add(params, 'showOrbits').name('궤도 표시').onChange(applyVis);
  gui.add(params, 'detachMoon').name('달을 월드로 떼어내기').onChange(setDetached);

  return {
    scene,
    camera,
    controls: orbit(camera, canvas),
    update(dt) {
      earthOrbit.rotation.y += dt * params.earthOrbit;
      earth.rotation.y += dt * params.earthSpin;
      moonOrbit.rotation.y += dt * params.moonOrbit;
      sun.rotation.y += dt * 0.1;
    },
  };
}
