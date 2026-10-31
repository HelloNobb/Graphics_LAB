// 기기 특성 판별과 품질 프리셋
const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/** 주 입력이 터치인가 (스크롤 vs 카메라 조작 충돌을 막아야 하는 기기) */
export const isTouch = coarse || (navigator.maxTouchPoints > 0 && !matchMedia('(pointer: fine)').matches);

/** 작은 화면의 터치 기기 = 모바일로 간주 */
export const isMobile = isTouch && Math.min(screen.width, screen.height) < 900;

/** 'low' | 'high' — 데모가 개수·해상도를 정할 때 참고 */
export const quality = isMobile ? 'low' : 'high';

/** 동시에 살아 있을 수 있는 데모(=WebGL 컨텍스트) 수 */
export const MAX_ACTIVE = isMobile ? 2 : 4;

/** 렌더러 pixelRatio 상한 */
export const MAX_PIXEL_RATIO = isMobile ? 1.5 : 2;

export function hasWebGL2() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    const ok = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return ok;
  } catch {
    return false;
  }
}
