import * as THREE from 'three';
import noise from '../../../shared/glsl/noise.glsl?raw';
import { orbit } from '../../../shared/helpers.js';

const isLow = (q) => q === 'low';

export const params = {
  count: 0, // 0이면 품질에 따라 자동 (create에서 결정)
  strength: 0.9,
  speed: 1,
  direction: 30,
  height: 1,
  baseColor: '#1f4d1a',
  tipColor: '#b6d96a',
};

const FIELD = 36;

function bladeGeometry() {
  // 4단 사다리꼴 + 뾰족한 끝 = 삼각형 9개
  const segs = 4;
  const pos = [];
  const hs = [];
  for (let i = 0; i <= segs; i++) {
    const h = i / segs;
    const w = 0.055 * (1 - h * 0.85);
    pos.push(-w, h, 0, w, h, 0);
    hs.push(h, h);
  }
  pos.push(0, 1.12, 0);
  hs.push(1);
  const idx = [];
  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
  }
  idx.push(segs * 2, segs * 2 + 1, segs * 2 + 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aHeight', new THREE.Float32BufferAttribute(hs, 1));
  g.setIndex(idx);
  return g;
}

const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uStrength;
uniform float uSpeed;
uniform vec2 uWindDir;
uniform float uHeight;
attribute float aHeight;
varying float vH;
varying float vRand;
varying float vGust;
varying float vFog;

${noise}

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec3 p = position;
  p.y *= uHeight;
  vec4 world = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vec3 root = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float h = aHeight;

  float gust = snoise(root.xz * 0.06 - uWindDir * uTime * uSpeed * 0.8) * 0.5 + 0.5;   // 큰 바람결
  float flutter = sin(uTime * 4.0 * uSpeed + root.x * 1.7 + root.z * 1.3) * 0.06;    // 잔떨림
  float bend = (gust * uStrength + flutter) * h * h;
  world.xz += uWindDir * bend;
  world.y -= bend * bend * 0.45;

  vH = h;
  vRand = hash(root.xz);
  vGust = gust;
  vec4 mv = viewMatrix * world;
  vFog = smoothstep(18.0, 40.0, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const fragmentShader = /* glsl */ `
uniform vec3 uBase;
uniform vec3 uTip;
uniform vec3 uFogColor;
varying float vH;
varying float vRand;
varying float vGust;
varying float vFog;
void main() {
  vec3 tip = uTip * (0.8 + vRand * 0.4);
  vec3 col = mix(uBase, tip, smoothstep(0.0, 1.0, vH));
  col *= 0.85 + vGust * 0.35 * vH;           // 바람에 눕는 곳은 햇빛을 더 받아 밝게
  col = mix(col, uFogColor, vFog);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export function create({ canvas, gui, hud, params, quality }) {
  if (!params.count) params.count = isLow(quality) ? 12000 : 60000;
  const scene = new THREE.Scene();
  const fogColor = new THREE.Color('#b9d7ea');
  scene.background = fogColor;
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  camera.position.set(0, 3.2, 13);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(FIELD * 1.6, 64),
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color('#2b4a1e') }, uFogColor: { value: fogColor } },
      vertexShader: /* glsl */ `varying float vFog; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vFog = smoothstep(18.0, 40.0, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform vec3 uFogColor;
        varying float vFog;
        void main() {
          gl_FragColor = vec4(mix(uColor, uFogColor, vFog), 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const uniforms = {
    uTime: { value: 0 },
    uStrength: { value: params.strength },
    uSpeed: { value: params.speed },
    uWindDir: { value: new THREE.Vector2() },
    uHeight: { value: params.height },
    uBase: { value: new THREE.Color(params.baseColor) },
    uTip: { value: new THREE.Color(params.tipColor) },
    uFogColor: { value: fogColor },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, side: THREE.DoubleSide });
  const geometry = bladeGeometry();
  let grass = null;

  const build = () => {
    if (grass) {
      scene.remove(grass);
      grass.dispose();
    }
    const n = params.count;
    grass = new THREE.InstancedMesh(geometry, material, n);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < n; i++) {
      // 원형 들판에 고르게 (반지름은 sqrt로 분포 보정)
      const r = Math.sqrt(Math.random()) * FIELD;
      const a = Math.random() * Math.PI * 2;
      p.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      q.setFromAxisAngle(up, Math.random() * Math.PI);
      const k = 0.6 + Math.random() * 0.8;
      s.set(1 + Math.random() * 0.6, k, 1);
      grass.setMatrixAt(i, m.compose(p, q, s));
    }
    grass.instanceMatrix.needsUpdate = true;
    grass.frustumCulled = false;
    scene.add(grass);
    hud.textContent = `풀잎 ${n.toLocaleString()}개 · 삼각형 ${(n * 9).toLocaleString()}개 → 드로우콜 1회`;
  };
  build();

  const apply = () => {
    uniforms.uStrength.value = params.strength;
    uniforms.uSpeed.value = params.speed;
    const a = THREE.MathUtils.degToRad(params.direction);
    uniforms.uWindDir.value.set(Math.cos(a), Math.sin(a));
    uniforms.uHeight.value = params.height;
    uniforms.uBase.value.set(params.baseColor);
    uniforms.uTip.value.set(params.tipColor);
  };
  apply();

  gui.add(params, 'count', 1000, 200000, 1000).name('풀잎 개수').onFinishChange(build);
  gui.add(params, 'strength', 0, 2, 0.01).name('바람 세기').onChange(apply);
  gui.add(params, 'speed', 0, 3, 0.01).name('바람 속도').onChange(apply);
  gui.add(params, 'direction', -180, 180, 1).name('바람 방향 (°)').onChange(apply);
  gui.add(params, 'height', 0.3, 2.5, 0.01).name('풀 높이').onChange(apply);
  gui.addColor(params, 'baseColor').name('뿌리 색').onChange(apply);
  gui.addColor(params, 'tipColor').name('끝 색').onChange(apply);

  return {
    scene,
    camera,
    controls: orbit(camera, canvas, [0, 0.6, 0], { maxPolarAngle: THREE.MathUtils.degToRad(85), minDistance: 2, maxDistance: 35 }),
    update(dt) {
      uniforms.uTime.value += dt;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
