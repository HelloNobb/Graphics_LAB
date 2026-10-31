import * as THREE from 'three';
import { orbit } from '../../../shared/helpers.js';

export const params = {
  color: '#d9654b',
  shininess: 60,
  specular: '#444444',
  roughness: 0.35,
  metalness: 0,
  ambient: 0.15,
  moveLight: true,
  wireframe: false,
};

export function create({ canvas, gui, params, addLabel }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0d1015');
  const camera = new THREE.PerspectiveCamera(30, 2, 0.1, 100);
  camera.position.set(0, 0.6, 13);

  const geo = new THREE.SphereGeometry(1, 64, 32);
  const mats = [
    ['Basic', new THREE.MeshBasicMaterial({ color: params.color })],
    ['Lambert', new THREE.MeshLambertMaterial({ color: params.color })],
    ['Phong', new THREE.MeshPhongMaterial({ color: params.color, shininess: params.shininess, specular: params.specular })],
    ['Standard', new THREE.MeshStandardMaterial({ color: params.color, roughness: params.roughness, metalness: params.metalness })],
  ];
  const meshes = mats.map(([name, m]) => {
    const mesh = new THREE.Mesh(geo, m);
    scene.add(mesh);
    return { mesh, label: addLabel(name, { transform: 'translate(-50%, 0)' }) };
  });

  const ambient = new THREE.AmbientLight('#ffffff', params.ambient);
  const key = new THREE.DirectionalLight('#ffffff', 2.2);
  key.position.set(-3, 4, 5);
  const point = new THREE.PointLight('#ffffff', 25, 0, 2);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  point.add(bulb);
  point.position.set(0, 1.5, 3);
  scene.add(ambient, key, point);

  const setAll = (fn) => mats.forEach(([, m]) => fn(m));
  gui.addColor(params, 'color').name('기본 색').onChange((v) => setAll((m) => m.color.set(v)));
  gui.add(params, 'shininess', 1, 300, 1).name('Phong shininess').onChange((v) => (mats[2][1].shininess = v));
  gui.addColor(params, 'specular').name('Phong specular').onChange((v) => mats[2][1].specular.set(v));
  gui.add(params, 'roughness', 0, 1, 0.01).name('Standard 거칠기').onChange((v) => (mats[3][1].roughness = v));
  gui.add(params, 'metalness', 0, 1, 0.01).name('Standard 금속성').onChange((v) => (mats[3][1].metalness = v));
  gui.add(params, 'ambient', 0, 1, 0.01).name('환경광 세기').onChange((v) => (ambient.intensity = v));
  gui.add(params, 'moveLight').name('점광원 움직이기');
  gui.add(params, 'wireframe').name('와이어프레임').onChange((v) => setAll((m) => (m.wireframe = v)));

  let w = 1;
  let h = 1;
  const v = new THREE.Vector3();
  const layout = () => {
    const grid = w / h < 1.4; // 좁은 화면: 2×2
    meshes.forEach(({ mesh }, i) => {
      if (grid) mesh.position.set((i % 2 ? 1 : -1) * 1.35, (i < 2 ? 1 : -1) * 1.45, 0);
      else mesh.position.set((i - 1.5) * 2.6, 0, 0);
    });
    camera.position.z = grid ? 14 : 13;
  };

  return {
    scene,
    camera,
    controls: orbit(camera, canvas),
    resize(nw, nh) {
      w = nw;
      h = nh;
      layout();
    },
    update(dt, t) {
      if (params.moveLight) point.position.set(Math.sin(t * 0.8) * 5, 1.2 + Math.sin(t * 1.3) * 1.2, 2.6);
      for (const { mesh, label } of meshes) {
        v.copy(mesh.position);
        v.y -= 1.12;
        v.project(camera);
        label.style.left = `${((v.x + 1) / 2) * w}px`;
        label.style.top = `${((1 - v.y) / 2) * h}px`;
      }
    },
  };
}
