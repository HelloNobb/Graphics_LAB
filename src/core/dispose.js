// GPU 자원 해제 유틸리티.
// Three.js 객체는 JS 가비지 컬렉션만으로는 GPU 메모리(버퍼, 텍스처, 셰이더 프로그램)가 풀리지 않는다.
// 반드시 geometry/material/texture/renderTarget의 dispose()를 호출해야 한다.

function disposeMaterial(material) {
  for (const value of Object.values(material)) {
    if (value && value.isTexture) value.dispose();
  }
  if (material.uniforms) {
    for (const u of Object.values(material.uniforms)) {
      const v = u && u.value;
      if (v && v.isTexture) v.dispose();
      if (Array.isArray(v)) v.forEach((t) => t && t.isTexture && t.dispose());
    }
  }
  material.dispose();
}

/** 객체와 모든 자식의 geometry/material/texture를 해제 */
export function disposeObject(root) {
  if (!root) return;
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(disposeMaterial);
    }
    for (const key of ['customDepthMaterial', 'customDistanceMaterial']) {
      if (obj[key]) disposeMaterial(obj[key]);
    }
    if (obj.isLight && obj.shadow && obj.shadow.map) obj.shadow.map.dispose();
    if (typeof obj.dispose === 'function' && !obj.isScene) {
      // 헬퍼(CameraHelper, VertexNormalsHelper 등)·InstancedMesh·LOD 등
      try { obj.dispose(); } catch { /* 일부 객체는 이미 해제됨 */ }
    }
  });
  if (root.isScene) {
    if (root.background && root.background.isTexture) root.background.dispose();
    if (root.environment && root.environment.isTexture) root.environment.dispose();
  }
}

/** 임의 자원 해제: dispose()가 있으면 호출, 씬/Object3D면 트리 전체 해제 */
export function disposeAny(x) {
  if (!x) return;
  if (x.isObject3D) disposeObject(x);
  else if (x.isMaterial) disposeMaterial(x);
  else if (typeof x.dispose === 'function') x.dispose();
}
