import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { orbit, options, rng } from '../../../shared/helpers.js';

export const params = {
  mode: 'instanced',
  count: 0,
  animate: true,
};

const PALETTE = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c77dff', '#ff9f45', '#7cf0c5', '#e8e8ee'];

export function create({ renderer, canvas, gui, hud, params, quality }) {
  if (!params.count) params.count = quality === 'low' ? 1500 : 4000;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0d1015');
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 300);
  camera.position.set(26, 20, 32);
  scene.add(new THREE.HemisphereLight('#ffffff', '#202430', 1.2));
  const sun = new THREE.DirectionalLight('#ffffff', 2);
  sun.position.set(5, 10, 7);
  scene.add(sun);

  const box = new THREE.BoxGeometry(0.6, 0.6, 0.6);
  const colorMats = PALETTE.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));
  const vcMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
  const instMat = new THREE.MeshStandardMaterial({ roughness: 0.6 });
  const root = new THREE.Group();
  scene.add(root);

  let items = []; // { pos, phase, color }
  let meshes = [];
  let merged = null;
  let instanced = null;

  const clear = () => {
    root.clear();
    meshes = [];
    merged?.geometry.dispose();
    merged = null;
    instanced?.dispose();
    instanced = null;
    root.rotation.set(0, 0, 0);
  };

  const build = () => {
    clear();
    const r = rng(42);
    const n = params.count;
    const side = Math.ceil(Math.cbrt(n));
    items = Array.from({ length: n }, (_, i) => ({
      pos: new THREE.Vector3((i % side) - side / 2, Math.floor(i / (side * side)) - side / 2, (Math.floor(i / side) % side) - side / 2).multiplyScalar(1.1),
      phase: r() * Math.PI * 2,
      color: Math.floor(r() * PALETTE.length),
    }));
    if (params.mode === 'mesh') {
      for (const it of items) {
        const m = new THREE.Mesh(box, colorMats[it.color]);
        m.position.copy(it.pos);
        root.add(m);
        meshes.push(m);
      }
    } else if (params.mode === 'merged') {
      const tmp = new THREE.Color();
      const parts = items.map((it) => {
        const g = box.clone();
        g.translate(it.pos.x, it.pos.y, it.pos.z);
        tmp.set(PALETTE[it.color]);
        const c = new Float32Array(g.attributes.position.count * 3);
        for (let i = 0; i < c.length; i += 3) c.set([tmp.r, tmp.g, tmp.b], i);
        g.setAttribute('color', new THREE.BufferAttribute(c, 3));
        return g;
      });
      merged = new THREE.Mesh(mergeGeometries(parts), vcMat);
      parts.forEach((g) => g.dispose());
      root.add(merged);
    } else {
      instanced = new THREE.InstancedMesh(box, instMat, n);
      const m = new THREE.Matrix4();
      const c = new THREE.Color();
      items.forEach((it, i) => {
        instanced.setMatrixAt(i, m.makeTranslation(it.pos));
        instanced.setColorAt(i, c.set(PALETTE[it.color]));
      });
      root.add(instanced);
    }
  };
  build();

  gui.add(params, 'mode', options([['개별 Mesh N개', 'mesh'], ['병합 (mergeGeometries)', 'merged'], ['InstancedMesh', 'instanced']])).name('방식').onChange(build);
  gui.add(params, 'count', 100, quality === 'low' ? 6000 : 15000, 100).name('큐브 개수').onFinishChange(build);
  gui.add(params, 'animate').name('개별 회전 움직임');

  const mtx = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const one = new THREE.Vector3(1, 1, 1);
  let updMs = 0;
  let renMs = 0;
  let acc = 0;
  let t = 0;

  return {
    scene,
    camera,
    controls: orbit(camera, canvas),
    update(dt) {
      const t0 = performance.now();
      if (params.animate) {
        t += dt;
        if (params.mode === 'mesh') {
          meshes.forEach((m, i) => m.rotation.set(t + items[i].phase, t * 0.7, 0));
        } else if (params.mode === 'merged') {
          root.rotation.y = t * 0.3; // 통째로만 가능
        } else {
          items.forEach((it, i) => {
            q.setFromEuler(e.set(t + it.phase, t * 0.7, 0));
            instanced.setMatrixAt(i, mtx.compose(it.pos, q, one));
          });
          instanced.instanceMatrix.needsUpdate = true;
        }
      }
      updMs = updMs * 0.9 + (performance.now() - t0) * 0.1;
    },
    render() {
      const t0 = performance.now();
      renderer.render(scene, camera);
      renMs = renMs * 0.9 + (performance.now() - t0) * 0.1;
      acc++;
      if (acc % 15 === 0) {
        hud.textContent = `JS 업데이트 ${updMs.toFixed(2)} ms\nrenderer.render() ${renMs.toFixed(2)} ms (CPU 측 명령 제출 시간)`;
      }
    },
    dispose() {
      clear();
      box.dispose();
      [...colorMats, vcMat, instMat].forEach((m) => m.dispose());
    },
  };
}
