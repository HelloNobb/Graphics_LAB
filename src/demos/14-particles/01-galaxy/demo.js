import * as THREE from 'three';
import { orbit } from '../../../shared/helpers.js';

export const params = {
  count: 0,
  radius: 6,
  branches: 4,
  spin: 1.1,
  randomness: 0.35,
  randomnessPower: 3,
  inside: '#ff9a52',
  outside: '#3b5bff',
  size: 26,
  speed: 0.4,
};

const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uSize;
uniform float uPixelRatio;
attribute float aScale;
attribute vec3 aRandom;
varying vec3 vColor;
void main() {
  vec3 p = position;
  // 차등 회전: 안쪽(r 작음)이 더 빨리
  float r = length(p.xz);
  float angle = atan(p.x, p.z) + uTime / max(r, 0.3);
  p.x = sin(angle) * r;
  p.z = cos(angle) * r;
  p += aRandom;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * aScale * uPixelRatio / -mv.z;
  vColor = color;
}`;

const fragmentShader = /* glsl */ `
varying vec3 vColor;
void main() {
  float d = distance(gl_PointCoord, vec2(0.5));
  float strength = pow(1.0 - min(d * 2.0, 1.0), 2.4);   // 가운데가 밝은 부드러운 원
  gl_FragColor = vec4(vColor * strength, 1.0);
  #include <colorspace_fragment>
}`;

export function create({ renderer, canvas, gui, hud, params, quality }) {
  if (!params.count) params.count = quality === 'low' ? 60000 : 180000;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#030308');
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(4, 6, 9);

  const uniforms = {
    uTime: { value: 0 },
    uSize: { value: params.size },
    uPixelRatio: { value: renderer.getPixelRatio() },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  });
  const points = new THREE.Points(new THREE.BufferGeometry(), material);
  scene.add(points);

  const generate = () => {
    const n = params.count;
    const pos = new Float32Array(n * 3);
    const rnd = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const scale = new Float32Array(n);
    const cIn = new THREE.Color(params.inside);
    const cOut = new THREE.Color(params.outside);
    const c = new THREE.Color();
    const jitter = () => Math.pow(Math.random(), params.randomnessPower) * (Math.random() < 0.5 ? 1 : -1);
    for (let i = 0; i < n; i++) {
      const r = Math.random() * params.radius;
      const branch = ((i % params.branches) / params.branches) * Math.PI * 2;
      const spin = r * params.spin;
      pos.set([Math.cos(branch + spin) * r, 0, Math.sin(branch + spin) * r], i * 3);
      const k = params.randomness * r;
      rnd.set([jitter() * k, jitter() * k * 0.5, jitter() * k], i * 3);
      c.copy(cIn).lerp(cOut, r / params.radius);
      col.set([c.r, c.g, c.b], i * 3);
      scale[i] = Math.random() * 0.8 + 0.2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aRandom', new THREE.BufferAttribute(rnd, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
    points.geometry.dispose();
    points.geometry = g;
    hud.textContent = `점 ${n.toLocaleString()}개 → 드로우콜 1회`;
  };
  generate();

  gui.add(params, 'count', 1000, 400000, 1000).name('개수').onFinishChange(generate);
  gui.add(params, 'radius', 1, 12, 0.1).name('반지름').onFinishChange(generate);
  gui.add(params, 'branches', 2, 10, 1).name('팔 개수').onFinishChange(generate);
  gui.add(params, 'spin', -4, 4, 0.01).name('나선 비틀림').onFinishChange(generate);
  gui.add(params, 'randomness', 0, 1.5, 0.01).name('흩뿌림').onFinishChange(generate);
  gui.add(params, 'randomnessPower', 1, 8, 0.1).name('흩뿌림 집중도').onFinishChange(generate);
  gui.addColor(params, 'inside').name('안쪽 색').onFinishChange(generate);
  gui.addColor(params, 'outside').name('바깥 색').onFinishChange(generate);
  gui.add(params, 'size', 4, 80, 1).name('점 크기').onChange((v) => (uniforms.uSize.value = v));
  gui.add(params, 'speed', 0, 3, 0.01).name('시간 속도');

  return {
    scene,
    camera,
    controls: orbit(camera, canvas),
    update(dt) {
      uniforms.uTime.value += dt * params.speed;
    },
  };
}
