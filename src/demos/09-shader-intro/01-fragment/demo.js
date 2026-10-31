import * as THREE from 'three';
import noise from '../../../shared/glsl/noise.glsl?raw';
import { fullscreenQuad, options } from '../../../shared/helpers.js';

export const params = {
  preset: 4,
  freq: 8,
  speed: 1,
  colorA: '#0b1d51',
  colorB: '#7cf0c5',
};

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0); // 카메라 없이 화면에 바로
}`;

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uFreq;
uniform int uPreset;
varying vec2 vUv;

${noise}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * snoise(p); p *= 2.02; a *= 0.5; }
  return v;
}

void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);   // 가운데가 (0,0), 비율 보정
  vec2 m = (uMouse - 0.5) * vec2(aspect, 1.0);
  float t = uTime;
  float v;
  if (uPreset == 0) {
    v = vUv.x;                                              // 그라디언트
  } else if (uPreset == 1) {
    v = step(0.5, fract(vUv.x * uFreq + t * 0.2));         // 줄무늬
  } else if (uPreset == 2) {
    float d = length(p - m);
    v = 0.5 + 0.5 * sin(d * uFreq * 6.0 - t * 4.0);        // 동심원
    v *= smoothstep(0.9, 0.0, d);
  } else if (uPreset == 3) {
    v = fbm(p * uFreq * 0.3 + vec2(t * 0.1, 0.0)) * 0.6 + 0.5; // 노이즈
  } else {
    v = sin(p.x * uFreq + t)                                // 플라즈마: sin 여러 개의 합
      + sin(p.y * uFreq * 0.8 - t * 1.3)
      + sin((p.x + p.y) * uFreq * 0.6 + t * 0.7)
      + sin(length(p) * uFreq * 1.4 - t);
    v = v * 0.125 + 0.5;
  }
  vec3 col = mix(uColorA, uColorB, clamp(v, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export function create({ canvas, gui, params, onDispose, width, height }) {
  const scene = new THREE.Scene();
  const camera = new THREE.Camera(); // 셰이더가 좌표를 직접 정하므로 형식상 필요할 뿐
  const uniforms = {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(width, height) },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uColorA: { value: new THREE.Color(params.colorA) },
    uColorB: { value: new THREE.Color(params.colorB) },
    uFreq: { value: params.freq },
    uPreset: { value: params.preset },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader });
  scene.add(fullscreenQuad(material));

  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    uniforms.uMouse.value.set((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height);
  };
  canvas.addEventListener('pointermove', onMove);
  onDispose(() => canvas.removeEventListener('pointermove', onMove));

  const apply = () => {
    uniforms.uPreset.value = Number(params.preset);
    uniforms.uFreq.value = params.freq;
    uniforms.uColorA.value.set(params.colorA);
    uniforms.uColorB.value.set(params.colorB);
  };
  gui.add(params, 'preset', options([['그라디언트', 0], ['줄무늬', 1], ['동심원 (마우스)', 2], ['노이즈 (fBm)', 3], ['플라즈마', 4]])).name('패턴').onChange(apply);
  gui.add(params, 'freq', 1, 40, 0.1).name('주파수').onChange(apply);
  gui.add(params, 'speed', 0, 4, 0.01).name('시간 속도');
  gui.addColor(params, 'colorA').name('색 A').onChange(apply);
  gui.addColor(params, 'colorB').name('색 B').onChange(apply);

  return {
    scene,
    camera,
    resize(w, h) {
      uniforms.uResolution.value.set(w, h);
    },
    update(dt) {
      uniforms.uTime.value += dt * params.speed;
    },
  };
}
