// 데모들이 공통으로 쓰는 작은 도우미
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/** 감쇠가 켜진 OrbitControls */
export function orbit(camera, canvas, target = [0, 0, 0], opts = {}) {
  const c = new OrbitControls(camera, canvas);
  c.enableDamping = true;
  c.dampingFactor = 0.08;
  c.target.set(...target);
  Object.assign(c, opts);
  c.update();
  return c;
}

export const deg = THREE.MathUtils.degToRad;

/** 결정적 의사 난수 (매번 같은 배치를 얻기 위해) */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** 화면에 맞춘 풀스크린 사각형용 카메라·지오메트리 */
export function fullscreenQuad(material) {
  const geo = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  return mesh;
}

/** 선택 목록 → lil-gui options 객체 */
export const options = (arr) => Object.fromEntries(arr.map((x) => (Array.isArray(x) ? x : [x, x])));
