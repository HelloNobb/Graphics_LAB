import * as THREE from 'three';
import { orbit, options, rng } from '../../../shared/helpers.js';
import { checkerCanvas, canvasTexture } from '../../../shared/textures.js';
import { createCurveUniforms, applyCurve } from './curve.js';

export const params = {
  curve: 0.006,
  mode: 0,
  side: 0,
  speed: 8,
  shadowPatch: true,
  frustumCulled: false,
};

const LEN = 220; // 반복되는 세상의 길이

export function create({ canvas, gui, params, quality }) {
  const scene = new THREE.Scene();
  const skyColor = new THREE.Color('#9fd3ff');
  scene.background = skyColor;
  scene.fog = new THREE.Fog(skyColor, 70, 160);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
  camera.position.set(0, 5, 12);

  const U = createCurveUniforms();
  const curved = (mat) => applyCurve(mat, U);
  const depthMat = applyCurve(new THREE.MeshDepthMaterial(), U);

  // 땅: 휘어 보이려면 정점이 촘촘해야 한다
  const groundTex = canvasTexture(checkerCanvas(128, 2, '#7ccf6a', '#6abd5a'), { repeat: [10, 110] });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, LEN * 2, 30, quality === 'low' ? 160 : 260), curved(new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 })));
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -LEN + 20;
  ground.receiveShadow = true;
  scene.add(ground);
  const roadTex = canvasTexture(checkerCanvas(64, 2, '#5b5f69', '#62666f'), { repeat: [1, 110] });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(6, LEN * 2, 3, quality === 'low' ? 160 : 260), curved(new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.9 })));
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.02, -LEN + 20);
  road.receiveShadow = true;
  scene.add(road);

  // 움직이는 물체들: 집(개별 메시 → 컬링 문제가 보임), 나무(InstancedMesh)
  const r = rng(9);
  const movers = [];
  const houseColors = ['#f4a261', '#e76f51', '#e9c46a', '#8ecae6', '#cdb4db', '#f1faee'];
  const bodyGeo = new THREE.BoxGeometry(3, 2.4, 3);
  bodyGeo.translate(0, 1.2, 0);
  const roofGeo = new THREE.ConeGeometry(2.5, 1.6, 4);
  roofGeo.rotateY(Math.PI / 4);
  roofGeo.translate(0, 3.2, 0);
  const roofMat = curved(new THREE.MeshStandardMaterial({ color: '#9b2f2f', roughness: 0.7 }));
  const bodyMats = houseColors.map((c) => curved(new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 })));
  const houses = [];
  for (let z = 0; z < LEN; z += 11) {
    for (const side of [-1, 1]) {
      if (r() < 0.25) continue;
      const g = new THREE.Group();
      const body = new THREE.Mesh(bodyGeo, bodyMats[Math.floor(r() * bodyMats.length)]);
      const roof = new THREE.Mesh(roofGeo, roofMat);
      for (const m of [body, roof]) {
        m.castShadow = m.receiveShadow = true;
        m.customDepthMaterial = depthMat;
        houses.push(m);
      }
      g.add(body, roof);
      g.position.set(side * (8 + r() * 6), 0, -z);
      g.rotation.y = r() * 0.6 - 0.3;
      g.scale.setScalar(0.8 + r() * 0.5);
      scene.add(g);
      movers.push(g);
    }
  }

  const TREES = 260;
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.25, 1.4, 6);
  trunkGeo.translate(0, 0.7, 0);
  const leafGeo = new THREE.IcosahedronGeometry(1.1, 0);
  leafGeo.translate(0, 2.2, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, curved(new THREE.MeshStandardMaterial({ color: '#6b4a32' })), TREES);
  const leaves = new THREE.InstancedMesh(leafGeo, curved(new THREE.MeshStandardMaterial({ color: '#2e8b57', flatShading: true })), TREES);
  const trees = [];
  for (let i = 0; i < TREES; i++) {
    const side = r() < 0.5 ? -1 : 1;
    trees.push({ x: side * (4.5 + r() * 26), z: -r() * LEN, s: 0.7 + r() * 0.8, ry: r() * 6 });
  }
  for (const m of [trunks, leaves]) {
    m.castShadow = m.receiveShadow = true;
    m.customDepthMaterial = depthMat;
    m.frustumCulled = false; // 인스턴스가 세상 전체에 퍼져 있음
    scene.add(m);
  }

  scene.add(new THREE.HemisphereLight('#dff1ff', '#55703e', 1.6));
  const sun = new THREE.DirectionalLight('#fff2d6', 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 120 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.04;
  sun.position.set(-20, 40, 10);
  sun.target.position.set(0, 0, -15);
  scene.add(sun, sun.target);

  const apply = () => {
    U.uCurve.value = params.curve;
    U.uMode.value = Number(params.mode);
    U.uSide.value = params.side;
    for (const m of houses) {
      m.customDepthMaterial = params.shadowPatch ? depthMat : undefined;
      m.frustumCulled = params.frustumCulled;
    }
    trunks.customDepthMaterial = leaves.customDepthMaterial = params.shadowPatch ? depthMat : undefined;
  };
  apply();

  gui.add(params, 'curve', 0, 0.025, 0.0005).name('휘는 강도 k').onChange(apply);
  gui.add(params, 'mode', options([['구형 (작은 행성)', 0], ['원통형 (앞뒤로만)', 1]])).name('모드').onChange(apply);
  gui.add(params, 'side', -0.012, 0.012, 0.0005).name('옆으로 휘기').onChange(apply);
  gui.add(params, 'speed', 0, 30, 0.5).name('이동 속도');
  gui.add(params, 'shadowPatch').name('그림자도 휘기').onChange(apply);
  gui.add(params, 'frustumCulled').name('frustumCulled (집)').onChange(apply);

  const mtx = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  const p = new THREE.Vector3();
  let travel = 0;
  const wrap = (z) => ((((z + 20) % LEN) + LEN) % LEN) - LEN + 20; // 카메라 뒤로 지나가면 맨 앞으로

  return {
    scene,
    camera,
    controls: orbit(camera, canvas, [0, 1.5, -8], { maxPolarAngle: THREE.MathUtils.degToRad(84), minDistance: 4, maxDistance: 40 }),
    update(dt) {
      const step = dt * params.speed;
      travel += step;
      groundTex.offset.y = (travel / (LEN * 2)) * 110;
      roadTex.offset.y = groundTex.offset.y;
      for (const g of movers) g.position.z = wrap(g.position.z + step);
      trees.forEach((t, i) => {
        t.z = wrap(t.z + step);
        p.set(t.x, 0, t.z);
        quat.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, t.ry);
        scl.setScalar(t.s);
        mtx.compose(p, quat, scl);
        trunks.setMatrixAt(i, mtx);
        leaves.setMatrixAt(i, mtx);
      });
      trunks.instanceMatrix.needsUpdate = leaves.instanceMatrix.needsUpdate = true;
      U.uOrigin.value.copy(camera.position);
    },
  };
}
