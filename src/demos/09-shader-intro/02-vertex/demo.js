import * as THREE from 'three';
import noise from '../../../shared/glsl/noise.glsl?raw';
import { orbit, options } from '../../../shared/helpers.js';

export const params = {
  mode: 1,
  amp: 0.25,
  freq: 2.2,
  speed: 1,
  shading: 1,
  colorA: '#1d2b64',
  colorB: '#ffb86b',
  wireframe: false,
};

const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uAmp;
uniform float uFreq;
uniform int uMode;
varying vec3 vNormal;
varying vec3 vViewPos;
varying float vDisp;

${noise}

void main() {
  float d;
  if (uMode == 0) {
    d = sin(position.y * uFreq * 2.0 + uTime * 2.0) * uAmp;                 // 가로 물결
  } else if (uMode == 1) {
    d = snoise(position * uFreq * 0.6 + vec3(0.0, uTime * 0.4, 0.0)) * uAmp; // 노이즈 덩어리
  } else {
    d = sin(position.x * uFreq * 2.0 + uTime) * sin(position.y * uFreq * 2.0 + uTime * 1.3)
      * sin(position.z * uFreq * 2.0 + uTime * 0.7) * uAmp * 1.6;            // 격자 진동
  }
  vec3 p = position + normal * d;
  vDisp = d;
  vNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vViewPos = mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

const fragmentShader = /* glsl */ `
uniform int uShading;
uniform float uAmp;
uniform vec3 uColorA;
uniform vec3 uColorB;
varying vec3 vNormal;
varying vec3 vViewPos;
varying float vDisp;

void main() {
  vec3 n = uShading == 0
    ? normalize(vNormal)                                      // 변형 전 노멀 (틀림)
    : normalize(cross(dFdx(vViewPos), dFdy(vViewPos)));       // 화면 미분으로 얻은 실제 면 방향
  vec3 col;
  if (uShading == 2) {
    col = n * 0.5 + 0.5;
  } else {
    vec3 L = normalize(vec3(0.5, 0.8, 0.6));                  // 뷰 공간 광원 방향
    vec3 V = normalize(-vViewPos);
    float diff = max(dot(n, L), 0.0);
    float spec = pow(max(dot(reflect(-L, n), V), 0.0), 40.0);
    vec3 base = mix(uColorA, uColorB, smoothstep(-uAmp, uAmp, vDisp));
    col = base * (0.18 + 0.9 * diff) + spec * 0.35;
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export function create({ canvas, gui, params, quality }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0d1015');
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0.5, 4.6);

  const uniforms = {
    uTime: { value: 0 },
    uAmp: { value: params.amp },
    uFreq: { value: params.freq },
    uMode: { value: params.mode },
    uShading: { value: params.shading },
    uColorA: { value: new THREE.Color(params.colorA) },
    uColorB: { value: new THREE.Color(params.colorB) },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, wireframe: params.wireframe });
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3, quality === 'low' ? 40 : 72), material);
  scene.add(mesh);

  const apply = () => {
    uniforms.uAmp.value = params.amp;
    uniforms.uFreq.value = params.freq;
    uniforms.uMode.value = Number(params.mode);
    uniforms.uShading.value = Number(params.shading);
    uniforms.uColorA.value.set(params.colorA);
    uniforms.uColorB.value.set(params.colorB);
    material.wireframe = params.wireframe;
  };
  gui.add(params, 'mode', options([['물결 (sin)', 0], ['노이즈 덩어리', 1], ['격자 진동', 2]])).name('변형').onChange(apply);
  gui.add(params, 'amp', 0, 0.8, 0.01).name('진폭').onChange(apply);
  gui.add(params, 'freq', 0.2, 6, 0.01).name('주파수').onChange(apply);
  gui.add(params, 'speed', 0, 3, 0.01).name('속도');
  gui.add(params, 'shading', options([['원래 노멀 (틀림)', 0], ['미분 노멀 dFdx/dFdy', 1], ['노멀을 색으로', 2]])).name('셰이딩').onChange(apply);
  gui.addColor(params, 'colorA').name('들어간 곳 색').onChange(apply);
  gui.addColor(params, 'colorB').name('튀어나온 곳 색').onChange(apply);
  gui.add(params, 'wireframe').name('와이어프레임').onChange(apply);

  return {
    scene,
    camera,
    controls: orbit(camera, canvas),
    update(dt) {
      uniforms.uTime.value += dt * params.speed;
      mesh.rotation.y += dt * 0.1;
    },
  };
}
