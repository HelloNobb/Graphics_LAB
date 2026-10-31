import * as THREE from 'three';
import { orbit, rng } from '../../../shared/helpers.js';

export const params = {
  lod: true,
  d1: 14,
  d2: 32,
  hysteresis: 0.1,
  showColors: true,
  frustumCulled: true,
  autoFly: true,
};

export function create({ canvas, gui, hud, params, quality }) {
  const scene = new THREE.Scene();
  const bg = new THREE.Color('#0d1015');
  scene.background = bg;
  scene.fog = new THREE.Fog(bg, 60, 110);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  camera.position.set(0, 6, 40);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#1a1e26', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  scene.add(new THREE.HemisphereLight('#dfe8ff', '#1a1f28', 1.2));
  const sun = new THREE.DirectionalLight('#ffffff', 2);
  sun.position.set(10, 20, 5);
  scene.add(sun);

  const geos = [new THREE.SphereGeometry(1, 48, 32), new THREE.SphereGeometry(1, 16, 12), new THREE.SphereGeometry(1, 6, 4)];
  const triCounts = geos.map((g) => g.index.count / 3);
  const plain = new THREE.MeshStandardMaterial({ color: '#c9d1e0', roughness: 0.45, flatShading: false });
  const levelMats = ['#58d68d', '#f4d03f', '#ec7063'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }));

  const N = quality === 'low' ? 13 : 19;
  const SP = 5;
  const r = rng(7);
  const lods = [];
  const levelMeshes = [];
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const lod = new THREE.LOD();
      const meshes = geos.map((g) => new THREE.Mesh(g, plain));
      lod.position.set((i - (N - 1) / 2) * SP + (r() - 0.5) * 2, 1.2, (j - (N - 1) / 2) * SP + (r() - 0.5) * 2);
      lod.scale.setScalar(0.8 + r() * 0.8);
      lod.position.y = lod.scale.x;
      meshes.forEach((m, k) => lod.addLevel(m, k * 10, params.hysteresis));
      scene.add(lod);
      lods.push(lod);
      levelMeshes.push(meshes);
    }

  const apply = () => {
    for (let n = 0; n < lods.length; n++) {
      const lod = lods[n];
      const d = params.lod ? [0, params.d1, Math.max(params.d2, params.d1 + 1)] : [0, 1e6, 2e6];
      lod.levels.forEach((lv, k) => {
        lv.distance = d[k];
        lv.hysteresis = params.hysteresis;
        lv.object.material = params.showColors ? levelMats[k] : plain;
        lv.object.frustumCulled = params.frustumCulled;
      });
    }
  };
  apply();

  gui.add(params, 'lod').name('LOD 사용').onChange(apply);
  gui.add(params, 'd1', 2, 60, 0.5).name('고→중 전환 거리').onChange(apply);
  gui.add(params, 'd2', 4, 100, 0.5).name('중→저 전환 거리').onChange(apply);
  gui.add(params, 'hysteresis', 0, 0.5, 0.01).name('hysteresis').onChange(apply);
  gui.add(params, 'showColors').name('레벨 색 표시').onChange(apply);
  gui.add(params, 'frustumCulled').name('frustumCulled').onChange(apply);
  gui.add(params, 'autoFly').name('카메라 자동 비행');

  const controls = orbit(camera, canvas, [0, 1, 0], { maxPolarAngle: THREE.MathUtils.degToRad(85), maxDistance: 80 });
  let t = 0;
  let frame = 0;
  const counts = [0, 0, 0];
  return {
    scene,
    camera,
    controls,
    update(dt) {
      if (params.autoFly) {
        t += dt * 0.12;
        const R = 22;
        camera.position.set(Math.cos(t) * R, 4 + Math.sin(t * 2) * 1.5, Math.sin(t) * R);
        controls.target.set(Math.cos(t + 0.5) * R * 0.6, 1, Math.sin(t + 0.5) * R * 0.6);
      }
      if (++frame % 10 === 0) {
        counts.fill(0);
        lods.forEach((l) => counts[l.getCurrentLevel()]++);
        const tri = counts.reduce((s, c, k) => s + c * triCounts[k], 0);
        hud.textContent = `물체 ${lods.length}개 (레벨별 삼각형 ${triCounts.join(' / ')})\n고 ${counts[0]} · 중 ${counts[1]} · 저 ${counts[2]}  → LOD 적용 삼각형 ${tri.toLocaleString()}`;
      }
    },
    dispose() {
      geos.forEach((g) => g.dispose());
      [plain, ...levelMats].forEach((m) => m.dispose());
    },
  };
}
