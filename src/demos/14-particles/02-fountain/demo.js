import * as THREE from 'three';
import { orbit, options } from '../../../shared/helpers.js';

export const params = {
  count: 0,
  gravity: -9.8,
  speed: 1,
  spread: 18,
  life: 2.6,
  size: 14,
  start: '#bfe9ff',
  end: '#2f6bff',
  blending: 'additive',
  bounce: true,
};

const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uGravity;
uniform float uSpeed;
uniform float uLife;
uniform float uSize;
uniform float uPixelRatio;
uniform float uBounce;
attribute vec3 aVelocity;
attribute float aOffset;
varying float vAge;
void main() {
  float age = mod(uTime + aOffset * uLife, uLife);
  vec3 v = aVelocity * uSpeed;
  vec3 p = v * age + 0.5 * vec3(0.0, uGravity, 0.0) * age * age;
  if (uBounce > 0.5 && p.y < 0.0) p.y = -p.y * 0.25;   // 바닥에서 약하게 튀기
  vAge = age / uLife;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * (1.0 - vAge * 0.6) * uPixelRatio / -mv.z;
}`;

const fragmentShader = /* glsl */ `
uniform vec3 uStart;
uniform vec3 uEnd;
varying float vAge;
void main() {
  float d = distance(gl_PointCoord, vec2(0.5));
  if (d > 0.5) discard;
  float alpha = (1.0 - smoothstep(0.2, 0.5, d)) * (1.0 - vAge);
  vec3 col = mix(uStart, uEnd, vAge);
  gl_FragColor = vec4(col * alpha, alpha);
  #include <colorspace_fragment>
}`;

export function create({ renderer, canvas, gui, hud, params, quality }) {
  if (!params.count) params.count = quality === 'low' ? 20000 : 60000;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#06080d');
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  camera.position.set(9, 6, 13);

  const basin = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.4, 0.4, 64), new THREE.MeshStandardMaterial({ color: '#2a3140', roughness: 0.8 }));
  basin.position.y = -0.25;
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.3, 0.6, 16), new THREE.MeshStandardMaterial({ color: '#c0c6d2', metalness: 0.8, roughness: 0.3 }));
  nozzle.position.y = 0.1;
  scene.add(basin, nozzle, new THREE.HemisphereLight('#9fb4ff', '#111', 1.2));

  const uniforms = {
    uTime: { value: 0 },
    uGravity: { value: params.gravity },
    uSpeed: { value: params.speed },
    uLife: { value: params.life },
    uSize: { value: params.size },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uBounce: { value: 1 },
    uStart: { value: new THREE.Color(params.start) },
    uEnd: { value: new THREE.Color(params.end) },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false, premultipliedAlpha: true });
  const points = new THREE.Points(new THREE.BufferGeometry(), material);
  points.frustumCulled = false;
  scene.add(points);

  const generate = () => {
    const n = params.count;
    const vel = new Float32Array(n * 3);
    const off = new Float32Array(n);
    const spread = THREE.MathUtils.degToRad(params.spread);
    for (let i = 0; i < n; i++) {
      // 위쪽 원뿔 안의 무작위 방향
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(1 - Math.random() * (1 - Math.cos(spread)));
      const s = 8 + Math.random() * 2.5;
      vel.set([Math.sin(phi) * Math.cos(theta) * s, Math.cos(phi) * s, Math.sin(phi) * Math.sin(theta) * s], i * 3);
      off[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); // 셰이더에서 계산 (자리만)
    g.setAttribute('aVelocity', new THREE.BufferAttribute(vel, 3));
    g.setAttribute('aOffset', new THREE.BufferAttribute(off, 1));
    points.geometry.dispose();
    points.geometry = g;
    hud.textContent = `파티클 ${n.toLocaleString()}개 · 매 프레임 갱신되는 값: uTime 1개`;
  };

  const apply = () => {
    uniforms.uGravity.value = params.gravity;
    uniforms.uSpeed.value = params.speed;
    uniforms.uLife.value = params.life;
    uniforms.uSize.value = params.size;
    uniforms.uStart.value.set(params.start);
    uniforms.uEnd.value.set(params.end);
    uniforms.uBounce.value = params.bounce ? 1 : 0;
    material.blending = params.blending === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending;
  };
  generate();
  apply();

  gui.add(params, 'count', 1000, 200000, 1000).name('개수').onFinishChange(generate);
  gui.add(params, 'spread', 1, 90, 1).name('퍼짐 각도 (°)').onFinishChange(generate);
  gui.add(params, 'gravity', -20, 10, 0.1).name('중력 g').onChange(apply);
  gui.add(params, 'speed', 0.2, 2, 0.01).name('분출 속도 배율').onChange(apply);
  gui.add(params, 'life', 0.5, 6, 0.1).name('수명 (초)').onChange(apply);
  gui.add(params, 'size', 2, 40, 1).name('크기').onChange(apply);
  gui.addColor(params, 'start').name('처음 색').onChange(apply);
  gui.addColor(params, 'end').name('나중 색').onChange(apply);
  gui.add(params, 'blending', options([['Additive (더하기)', 'additive'], ['Normal (덮기)', 'normal']])).name('블렌딩').onChange(apply);
  gui.add(params, 'bounce').name('바닥에서 튀기').onChange(apply);

  return {
    scene,
    camera,
    controls: orbit(camera, canvas, [0, 3, 0]),
    update(dt) {
      uniforms.uTime.value += dt;
    },
  };
}
