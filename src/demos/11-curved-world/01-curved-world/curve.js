// onBeforeCompile로 기존 재질에 "둥근 세상" 변형을 주입하는 헬퍼.
// 같은 uniform 객체를 공유하므로 값 하나만 바꾸면 모든 재질에 반영된다.
import * as THREE from 'three';

export function createCurveUniforms() {
  return {
    uCurve: { value: 0.006 },
    uSide: { value: 0 },
    uMode: { value: 0 }, // 0: 구형, 1: 원통형(앞뒤로만)
    uOrigin: { value: new THREE.Vector3() },
  };
}

const CURVE_GLSL = /* glsl */ `
{
  mat4 curveModel = modelMatrix;
  #ifdef USE_INSTANCING
    curveModel = modelMatrix * instanceMatrix;
  #endif
  vec4 curveWorld = curveModel * vec4(transformed, 1.0);
  vec3 cd = curveWorld.xyz - uOrigin;
  float dist2 = uMode == 0 ? dot(cd.xz, cd.xz) : cd.z * cd.z;
  vec3 curveOffset = vec3(uSide * cd.z * cd.z, -uCurve * dist2, 0.0);
  transformed += inverse(mat3(curveModel)) * curveOffset;
}
`;

export function applyCurve(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader =
      'uniform float uCurve;\nuniform float uSide;\nuniform int uMode;\nuniform vec3 uOrigin;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${CURVE_GLSL}`);
  };
  material.customProgramCacheKey = () => 'curved-world';
  return material;
}
