import * as THREE from 'three';
import { orbit, options } from '../../../shared/helpers.js';

export const params = {
  type: 'TorusKnot',
  segA: 64,
  segB: 12,
  wireframe: true,
  flatShading: false,
  color: '#8fb4ff',
  autoRotate: true,
};

const vase = () => {
  const pts = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    pts.push(new THREE.Vector2(0.35 + Math.sin(t * Math.PI * 1.4 + 0.3) * 0.45 + t * 0.2, t * 2.4 - 1.2));
  }
  return pts;
};

const builders = {
  Box: (a, b) => new THREE.BoxGeometry(1.6, 1.6, 1.6, Math.ceil(a / 8), Math.ceil(b / 6), Math.ceil(a / 8)),
  Sphere: (a, b) => new THREE.SphereGeometry(1.2, Math.max(3, a), Math.max(2, b)),
  Cylinder: (a, b) => new THREE.CylinderGeometry(0.9, 0.9, 2, Math.max(3, a), Math.max(1, Math.ceil(b / 4))),
  Cone: (a, b) => new THREE.ConeGeometry(1, 2.1, Math.max(3, a), Math.max(1, Math.ceil(b / 4))),
  Torus: (a, b) => new THREE.TorusGeometry(0.95, 0.38, Math.max(3, b), Math.max(3, a)),
  TorusKnot: (a, b) => new THREE.TorusKnotGeometry(0.85, 0.28, Math.max(8, a * 2), Math.max(3, b)),
  Icosahedron: (a) => new THREE.IcosahedronGeometry(1.3, Math.min(8, Math.floor(a / 8))),
  Capsule: (a, b) => new THREE.CapsuleGeometry(0.65, 1.1, Math.max(1, Math.ceil(b / 3)), Math.max(3, a)),
  Lathe: (a) => new THREE.LatheGeometry(vase(), Math.max(3, a)),
};

export function create({ canvas, gui, hud, params }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0f1217');
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 1.4, 5.4);

  const material = new THREE.MeshStandardMaterial({
    color: params.color,
    roughness: 0.45,
    metalness: 0.1,
    flatShading: params.flatShading,
    side: THREE.DoubleSide,
    polygonOffset: true, // 와이어프레임과 겹칠 때 깜빡임 방지
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const wireMat = new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true, transparent: true, opacity: 0.35 });
  const mesh = new THREE.Mesh(undefined, material);
  const wire = new THREE.Mesh(undefined, wireMat);
  const group = new THREE.Group();
  group.add(mesh, wire);
  scene.add(group);

  scene.add(new THREE.HemisphereLight('#ffffff', '#252a35', 1.2));
  const key = new THREE.DirectionalLight('#ffffff', 2.4);
  key.position.set(3, 4, 5);
  const rim = new THREE.DirectionalLight('#7cf0c5', 1.5);
  rim.position.set(-4, 2, -3);
  scene.add(key, rim);

  const rebuild = () => {
    mesh.geometry?.dispose();
    const geo = builders[params.type](params.segA, params.segB);
    mesh.geometry = geo;
    wire.geometry = geo;
    const verts = geo.attributes.position.count;
    const tris = geo.index ? geo.index.count / 3 : verts / 3;
    hud.textContent = `${params.type}Geometry\n정점 ${verts.toLocaleString()} · 삼각형 ${tris.toLocaleString()}${geo.index ? ' (인덱스 사용)' : ''}`;
  };
  rebuild();

  gui.add(params, 'type', options(Object.keys(builders))).name('종류').onChange(rebuild);
  gui.add(params, 'segA', 3, 128, 1).name('분할 A (둘레)').onChange(rebuild);
  gui.add(params, 'segB', 1, 64, 1).name('분할 B (높이/단면)').onChange(rebuild);
  gui.add(params, 'wireframe').name('와이어프레임').onChange((v) => (wire.visible = v));
  gui.add(params, 'flatShading').name('flatShading').onChange((v) => {
    material.flatShading = v;
    material.needsUpdate = true; // 셰이더 재컴파일이 필요한 속성
  });
  gui.addColor(params, 'color').name('색').onChange((v) => material.color.set(v));
  gui.add(params, 'autoRotate').name('자동 회전');
  wire.visible = params.wireframe;

  return {
    scene,
    camera,
    controls: orbit(camera, canvas),
    update(dt) {
      if (params.autoRotate) group.rotation.y += dt * 0.4;
    },
    dispose() {
      mesh.geometry?.dispose();
    },
  };
}
