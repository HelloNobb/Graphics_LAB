// 외부 HDR 없이 쓰는 스튜디오 환경맵: RoomEnvironment 씬을 PMREM으로 미리 필터링.
// PMREM(Prefiltered Mipmapped Radiance Environment Map)은 거칠기별로 흐린 반사 이미지를
// 미리 만들어 둔 것이라, PBR 재질의 roughness 값에 맞는 반사를 빠르게 찾아 쓸 수 있다.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/** @returns {THREE.WebGLRenderTarget} — .texture를 scene.environment 등에 사용. 데모에서 ctx.track(rt) 할 것 */
export function roomEnvironment(renderer, blur = 0.04) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const rt = pmrem.fromScene(room, blur);
  room.dispose();
  pmrem.dispose();
  return rt;
}
