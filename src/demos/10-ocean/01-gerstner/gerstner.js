// CPU 측 Gerstner 공식 — 셰이더(ocean.vert.glsl)와 똑같은 계산.
// 부표처럼 물 위에 떠야 하는 물체의 위치·기울기를 구할 때 쓴다.
import * as THREE from 'three';

const G = 9.81;

/**
 * @param {Array<{angle:number, steepness:number, wavelength:number}>} waves
 * @param {number} x  정지 상태의 격자 x
 * @param {number} z  정지 상태의 격자 z
 * @param {number} t  시간
 * @param {THREE.Vector3} outPos     변위된 위치
 * @param {THREE.Vector3} outNormal  표면 노멀
 */
export function gerstnerAt(waves, x, z, t, outPos, outNormal) {
  outPos.set(x, 0, z);
  const tangent = new THREE.Vector3(1, 0, 0);
  const binormal = new THREE.Vector3(0, 0, 1);
  for (const w of waves) {
    const k = (2 * Math.PI) / w.wavelength;
    const c = Math.sqrt(G / k);
    const dx = Math.cos(THREE.MathUtils.degToRad(w.angle));
    const dz = Math.sin(THREE.MathUtils.degToRad(w.angle));
    const f = k * (dx * x + dz * z - c * t);
    const a = w.steepness / k;
    const s = Math.sin(f);
    const co = Math.cos(f);
    outPos.x += dx * a * co;
    outPos.y += a * s;
    outPos.z += dz * a * co;
    tangent.x += -dx * dx * w.steepness * s;
    tangent.y += dx * w.steepness * co;
    tangent.z += -dx * dz * w.steepness * s;
    binormal.x += -dx * dz * w.steepness * s;
    binormal.y += dz * w.steepness * co;
    binormal.z += -dz * dz * w.steepness * s;
  }
  outNormal.crossVectors(binormal, tangent).normalize();
}

export function maxAmplitude(waves) {
  return waves.reduce((sum, w) => sum + w.steepness / ((2 * Math.PI) / w.wavelength), 0);
}
