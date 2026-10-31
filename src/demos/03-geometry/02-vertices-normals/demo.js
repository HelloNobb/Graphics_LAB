import * as THREE from 'three';
import { VertexNormalsHelper } from 'three/addons/helpers/VertexNormalsHelper.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { orbit, options } from '../../../shared/helpers.js';

export const params = {
  shape: 'sphere',
  shading: 'smooth',
  displace: 0,
  showVertices: true,
  showNormals: true,
  normalLength: 0.25,
  showWire: true,
  pointSize: 6,
};

function quad() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0], 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  g.setIndex([0, 1, 2, 2, 1, 3]);
  return g;
}

function pyramid() {
  const g = new THREE.BufferGeometry();
  // 정점 5개를 4개의 옆면 + 바닥(2삼각형)이 공유
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 1.2, 0, -1, -0.6, 1, 1, -0.6, 1, 1, -0.6, -1, -1, -0.6, -1], 3));
  g.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1, 1, 4, 3, 1, 3, 2]);
  return g;
}

const shapes = {
  quad: () => quad(),
  pyramid: () => pyramid(),
  box: () => new THREE.BoxGeometry(1.6, 1.6, 1.6, 2, 2, 2),
  sphere: () => new THREE.SphereGeometry(1.2, 20, 14),
  torus: () => new THREE.TorusGeometry(0.9, 0.38, 12, 32),
};

// 위치 기반 결정적 노이즈 → 같은 위치의 정점은 같은 값 (이음새가 벌어지지 않음)
const noise = (x, y, z) => {
  const s = Math.sin(x * 3.1 + y * 1.7) * Math.cos(y * 2.3 - z * 3.7) + Math.sin(z * 4.1 + x * 2.9) * 0.5;
  return s;
};

export function create({ canvas, gui, hud, params }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0f1217');
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(2.6, 1.8, 4);

  const mat = new THREE.MeshStandardMaterial({
    color: '#5e6b82',
    roughness: 0.55,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const mesh = new THREE.Mesh(undefined, mat);
  const wire = new THREE.Mesh(undefined, new THREE.MeshBasicMaterial({ color: '#c8d3ea', wireframe: true, transparent: true, opacity: 0.3 }));
  const points = new THREE.Points(undefined, new THREE.PointsMaterial({ color: '#5fd3ff', size: params.pointSize, sizeAttenuation: false, depthTest: true }));
  scene.add(mesh, wire, points);
  let helper = null;

  scene.add(new THREE.HemisphereLight('#ffffff', '#1d2230', 1));
  const key = new THREE.DirectionalLight('#ffffff', 2.6);
  key.position.set(3, 4, 4);
  scene.add(key);

  const build = () => {
    let g = shapes[params.shape]();
    // smooth의 기준: 같은 위치 정점을 하나로 합친 뒤 노멀 평균
    g.deleteAttribute('uv');
    g.deleteAttribute('normal');
    g = mergeVertices(g);
    g.computeVertexNormals();
    if (params.displace > 0) {
      const p = g.attributes.position;
      const n = g.attributes.normal;
      for (let i = 0; i < p.count; i++) {
        const d = noise(p.getX(i), p.getY(i), p.getZ(i)) * params.displace;
        p.setXYZ(i, p.getX(i) + n.getX(i) * d, p.getY(i) + n.getY(i) * d, p.getZ(i) + n.getZ(i) * d);
      }
      g.computeVertexNormals();
    }
    if (params.shading === 'flat') {
      // 삼각형마다 정점을 따로 갖게 풀고 다시 계산 → 면 노멀
      const flat = g.toNonIndexed();
      g.dispose();
      g = flat;
      g.computeVertexNormals();
    }
    return g;
  };

  const rebuild = () => {
    const old = mesh.geometry;
    const g = build();
    mesh.geometry = wire.geometry = points.geometry = g;
    old?.dispose();
    if (helper) {
      scene.remove(helper);
      helper.dispose();
    }
    helper = new VertexNormalsHelper(mesh, params.normalLength, '#ffd84a');
    scene.add(helper);
    applyVis();
    const tris = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    hud.textContent = `정점 ${g.attributes.position.count} · 삼각형 ${tris}\n${g.index ? '인덱스 사용 (정점 공유)' : '인덱스 없음 (삼각형마다 정점 3개)'}`;
  };

  const applyVis = () => {
    points.visible = params.showVertices;
    points.material.size = params.pointSize;
    wire.visible = params.showWire;
    if (helper) {
      helper.visible = params.showNormals;
      helper.size = params.normalLength;
      helper.update();
    }
  };

  gui.add(params, 'shape', options([['직접 만든 사각형', 'quad'], ['직접 만든 피라미드', 'pyramid'], ['박스', 'box'], ['구', 'sphere'], ['토러스', 'torus']])).name('모양').onChange(rebuild);
  gui.add(params, 'shading', options([['smooth (정점 공유)', 'smooth'], ['flat (면마다 분리)', 'flat']])).name('셰이딩').onChange(rebuild);
  gui.add(params, 'displace', 0, 0.4, 0.01).name('울퉁불퉁 변위').onFinishChange(rebuild);
  gui.add(params, 'showVertices').name('정점 표시').onChange(applyVis);
  gui.add(params, 'pointSize', 2, 14, 1).name('정점 크기').onChange(applyVis);
  gui.add(params, 'showNormals').name('노멀 표시').onChange(applyVis);
  gui.add(params, 'normalLength', 0.05, 1, 0.01).name('노멀 길이').onChange(applyVis);
  gui.add(params, 'showWire').name('와이어프레임').onChange(applyVis);

  rebuild();

  return {
    scene,
    camera,
    controls: orbit(camera, canvas),
    dispose() {
      helper?.dispose();
    },
  };
}
