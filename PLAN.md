# 그래픽스 실험실 — 구현 계획 (PLAN.md)

> **상태: Phase 0~6 구현 완료.** 29개 데모 전부 스모크 테스트 통과 (데스크톱·모바일 에뮬레이션).
> 구현 중 바뀐 점: three r186에서 `PCFSoftShadowMap`이 제거되어 그림자 타입은 Basic/PCF/VSM만 다룹니다.
> 데스크톱 GUI는 캔버스 위에 겹치지 않고 오른쪽 열에 둡니다(컨테이너 폭 820px 이하면 캔버스 아래).
> 데스크톱에서는 캔버스를 한 번 클릭해야 휠 줌이 켜집니다(페이지 스크롤 중 의도치 않은 줌 방지).
> three와 lil-gui는 첫 데모가 다가올 때 동적으로 로드해서 첫 페이지 JS는 약 27KB입니다.

Three.js(`WebGLRenderer`) + Vite로 만드는 정적 학습 사이트입니다.
카테고리별 섹션마다 **한국어 개념 설명 → 인터랙티브 데모 캔버스 → lil-gui 파라미터 조절** 순서로 구성하고,
GitHub Actions로 GitHub Pages에 자동 배포합니다.

---

## 0. 핵심 설계 결정: WebGL 컨텍스트 관리

브라우저는 페이지당 활성 WebGL 컨텍스트 수를 제한합니다(Chrome 데스크톱 약 16개, 모바일은 그보다 적은 경우가 많음).
한도를 넘으면 가장 오래된 컨텍스트가 강제로 사라집니다(`CONTEXT_LOST`). 데모가 약 30개이므로 전부 상시 띄울 수 없습니다.

### 선택: **IntersectionObserver 지연 초기화 + dispose 방식** (동시 활성 상한 + LRU)

| 기준 | IO + dispose (선택) | 렌더러 1개 + scissor |
|---|---|---|
| 데모별 렌더러 설정 (`shadowMap.type`, `toneMapping`, `antialias`, `pixelRatio`) | 데모마다 독립 | 공유 상태라 매 프레임 바꾸고 되돌려야 함. `antialias`는 아예 데모별로 다르게 못 씀 |
| 포스트프로세싱 (`EffectComposer`) | 그대로 사용 | composer가 전체 크기 렌더 타깃 기준이라 scissor 영역에 맞추려면 별도 처리가 필요함 |
| 모바일 스크롤 | 각 캔버스가 문서 흐름 안에 있어 스크롤과 자연스럽게 같이 움직임 | 화면 고정 캔버스 1장을 스크롤 위치에 맞춰 그리는 구조라, iOS 주소창 변화나 관성 스크롤 때 한 프레임씩 어긋나는 현상이 생기기 쉬움 |
| 장애 격리 | 데모 하나의 셰이더 에러·컨텍스트 손실이 다른 데모에 영향 없음 | 공유 렌더러라 하나가 깨지면 전부 영향 |
| "새 데모 추가가 쉬운 구조" | 데모는 렌더러를 받아서 그리기만 하면 됨 (일반 Three.js 예제 코드와 같음) | 모든 데모가 viewport/scissor 규약과 공유 상태 복원 규칙을 지켜야 함 |
| 단점 | 진입할 때 컨텍스트 생성과 셰이더 컴파일 비용(수십~수백 ms) | 컨텍스트 1개라 GPU 자원 공유에 유리하고 진입 비용이 거의 없음 |

**선택 이유 요약:** 이 사이트는 섀도우 타입, 톤매핑, 블룸, 안티앨리어싱처럼 **렌더러 수준 설정이 데모마다 다른 것 자체가 학습 내용**입니다.
그래서 렌더러를 분리하는 쪽이 훨씬 단순하고 안전합니다. 진입 비용은 아래 장치로 줄입니다.

### 동작 규칙 (`DemoManager`)
- **선행 초기화:** IO `rootMargin: '300px 0px'` — 화면에 들어오기 조금 전에 초기화를 시작합니다.
- **히스테리시스:** 뷰포트에서 벗어난 뒤 바로 dispose하지 않고 1.5초 유예합니다. 위아래로 왔다 갔다 하는 스크롤에 생성/해제가 반복되지 않게 하기 위해서입니다.
- **동시 활성 상한:** 데스크톱 4개, 모바일 2개. 넘으면 뷰포트에서 가장 먼 데모부터 dispose합니다(LRU 방식).
- **완전 해제:** 씬을 순회해 geometry/material/texture를 dispose하고, `renderer.dispose()`와 `renderer.forceContextLoss()`를 호출한 뒤 canvas를 DOM에서 제거합니다. GC를 기다리지 않고 컨텍스트를 즉시 반납합니다.
- **포스터 이미지:** dispose 직전에 마지막 프레임을 `canvas.toDataURL()`로 찍어 박스 배경으로 남깁니다. 비활성 상태에서도 빈 박스가 보이지 않습니다.
- **GUI 상태 보존:** 파라미터 객체는 Host가 갖고 있으므로, 다시 들어와도 사용자가 바꾼 값이 유지됩니다.
- **일시정지:** 박스가 부분적으로만 보여도 렌더하지만, 탭이 숨겨지면(`visibilitychange`) 루프를 멈춥니다.
- **컨텍스트 손실 대응:** `webglcontextlost`가 발생하면 "다시 시작" 버튼을 표시합니다.

> 한 데모 **안에서** 화면을 나눠 보여줘야 할 때(예: 원근 vs 직교 비교)는 그 데모의 렌더러 하나로 viewport/scissor 분할을 씁니다.
> 컨텍스트를 아끼는 효과도 있습니다.

---

## 1. 기술 스택

| 항목 | 선택 | 비고 |
|---|---|---|
| 번들러 | Vite (최신 안정 버전) | `base: './'`(상대 경로)로 저장소 이름과 상관없이 Pages 하위 경로에서 동작 |
| 3D | `three` (버전 고정), `three/addons/*` | OrbitControls, EffectComposer, RoomEnvironment, BufferGeometryUtils, 헬퍼들 |
| GUI | `lil-gui` | 데모 박스 내부 컨테이너에 붙이고, 모바일에서는 기본으로 접힌 상태 |
| 언어 | Vanilla JS (ES Modules) | 학습용이라 빌드 단계를 최소화. 셰이더는 `.glsl` 파일을 `?raw`로 import (플러그인 불필요) |
| 에셋 | **절차적 생성** (CanvasTexture/DataTexture, RoomEnvironment) | 외부 이미지/HDR 라이선스와 용량 문제가 없음. 필요하면 나중에 `public/`에 추가 |
| 테스트 | Playwright 스모크 테스트 | 클라우드 컨테이너에 Chromium이 미리 설치되어 있음 |

---

## 2. 디렉터리 구조

```
/ (저장소 루트)
├─ index.html
├─ vite.config.js
├─ package.json
├─ PLAN.md / README.md
├─ .github/workflows/deploy.yml      # GitHub Pages 배포
├─ scripts/new-demo.mjs              # 데모 폴더 스캐폴딩 (scripts/demo-template 복사): npm run new-demo -- 05-lights spot-detail
├─ scripts/smoke.cjs                 # 전체 스크롤, 콘솔 에러·활성 컨텍스트 수 검사 (npm run smoke)
├─ public/favicon.svg
└─ src/
   ├─ main.js                        # 레지스트리 → 섹션 DOM 생성 → DemoManager 시작
   ├─ styles/main.css
   ├─ core/
   │  ├─ registry.js                 # import.meta.glob으로 카테고리·데모 자동 수집
   │  ├─ DemoManager.js              # IntersectionObserver, 동시 활성 상한, LRU
   │  ├─ DemoHost.js                 # 박스 1개의 생명주기: 렌더러 생성 → 루프 → dispose
   │  ├─ gui.js                      # lil-gui 생성, 모바일 접기, 리셋 버튼
   │  ├─ touchGuard.js               # 모바일: "탭해서 조작" ↔ 페이지 스크롤 전환
   │  ├─ statsOverlay.js             # FPS, 드로우콜, 삼각형 수 (renderer.info)
   │  ├─ dispose.js                  # 씬 순회 GPU 자원 해제, track() 헬퍼
   │  └─ device.js                   # 모바일/저사양 판별, 품질 프리셋 (low/high)
   ├─ shared/
   │  ├─ textures.js                 # 체커, UV 그리드, 벽돌 높이맵→노멀맵, 툰 그라디언트
   │  ├─ environment.js              # PMREM + RoomEnvironment 캐시
   │  └─ glsl/noise.glsl             # simplex/value noise 공용 조각
   ├─ ui/
   │  ├─ toc.js                      # 목차 (데스크톱 고정 사이드바 / 모바일 드로어), 현재 섹션 표시
   │  └─ section.js                  # 카테고리 섹션과 데모 박스 DOM 템플릿
   └─ demos/
      ├─ 01-basics/
      │  ├─ category.js              # { title, intro(HTML) }
      │  ├─ 01-scene-camera-renderer/
      │  │  ├─ meta.js               # 제목, 박스 비율, 렌더러 옵션 (가벼움 → eager import)
      │  │  ├─ content.html          # 한국어 개념 설명 (eager, ?raw)
      │  │  └─ demo.js               # 실제 데모 (lazy, 코드 분할)
      │  └─ 02-render-loop/ ...
      ├─ 10-ocean/
      │  └─ 01-gerstner/
      │     ├─ meta.js, content.html, demo.js
      │     ├─ gerstner.js           # CPU 측 동일 공식 (부표를 띄우는 용도)
      │     ├─ ocean.vert.glsl
      │     └─ ocean.frag.glsl
```

**정렬 규칙:** 폴더 이름의 숫자 접두사 순서대로 정렬합니다. 카테고리를 추가하려면 폴더를 하나 만들면 되고, 데모를 추가하려면 하위 폴더를 하나 만들면 됩니다.
코드 수정은 필요 없습니다.

### 2.1 데모 모듈 인터페이스

```js
// meta.js — 페이지 뼈대(목차/제목)를 three 로드 없이 그리기 위해 분리
export default {
  title: '씬 · 카메라 · 렌더러',
  aspect: 16 / 9,                 // 박스 비율 (모바일에서는 최소 4:3로 보정)
  renderer: { antialias: true, shadows: false, toneMapping: 'ACES' }, // 선택
  heavy: false,                   // true면 모바일에서 low 품질로 시작
};

// demo.js
export const params = { speed: 1, color: '#44aa88' };   // GUI 상태 초깃값 (Host가 복사해서 보존)

export function create({ renderer, canvas, container, gui, params, quality, track }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  gui.add(params, 'speed', 0, 5).name('회전 속도');
  return {
    scene, camera,          // 있으면 Host가 기본 render()와 aspect 갱신을 처리
    update(dt, elapsed) {}, // 매 프레임 호출 (dt는 초 단위, 최대 0.1로 클램프)
    resize(w, h) {},        // 선택
    render() {},            // 선택: composer나 분할 화면 등 직접 그릴 때
    dispose() {},           // 선택: 씬 밖 자원 (composer, controls, 이벤트). 씬 내부 자원은 Host가 자동 해제
  };
}
```

`DemoHost`가 공통으로 처리하는 것: canvas/렌더러 생성, `pixelRatio = min(dpr, 2)` (low 품질이면 1.5), `ResizeObserver`,
`outputColorSpace = SRGB`, 렌더 루프(`setAnimationLoop`), 통계 오버레이, OrbitControls 터치 가드 연동, 에러 표시, 포스터 캡처.

---

## 3. 페이지 구성

- **헤더:** 사이트 제목, 한 줄 소개, WebGL2 지원 여부 확인 (미지원이면 안내 문구 표시)
- **목차:** 데스크톱에서는 왼쪽 고정 사이드바, 모바일에서는 상단 버튼으로 여는 드로어. 현재 보고 있는 섹션을 하이라이트하고 `#hash` 앵커로 이동
- **카테고리 섹션:** `h2` + 카테고리 소개 → 데모 블록 반복
- **데모 블록:** `h3` 제목 → 개념 설명(`content.html`, 핵심 원리, 필요하면 짧은 코드나 수식) → 캔버스 박스(오른쪽 위 lil-gui, 왼쪽 아래 통계 오버레이, "조작 팁" 한 줄)
- 설명 문체: 초보자 대상. "무엇을 → 왜 → 데모에서 무엇을 바꿔보면 무엇이 보이는지" 3단 구성. 각 데모 끝에 **"해볼 것"** 체크리스트 2~3개

### 모바일 대응
- **스크롤 함정 방지:** OrbitControls는 캔버스에 `touch-action: none`을 걸어서, 손가락이 캔버스 위에 있으면 페이지가 스크롤되지 않습니다.
  → 터치 기기에서는 기본으로 컨트롤을 끄고 **"탭해서 조작"** 오버레이를 보여줍니다. 탭하면 활성화되고, 박스 밖을 탭하거나 화면에서 벗어나면 다시 비활성화됩니다.
- lil-gui는 기본으로 접힌 상태이고 폭을 줄입니다. 박스 높이는 `min(aspect 높이, 70svh)`로 제한합니다.
- 품질 프리셋: 풀 개수, 파티클 수, 바다 메시 분할 수, 섀도우맵 해상도를 low에서 낮춥니다. GUI에서 직접 올릴 수도 있습니다.
- 동시 활성 상한 2개, `pixelRatio` 상한 1.5.

---

## 4. 데모 목록 (16개 카테고리, 29개 데모)

표기: **[GUI]** = 조절 가능한 주요 파라미터

### 01. 기초
| # | 데모 | 내용 | [GUI] |
|---|---|---|---|
| 1-1 | 씬 · 카메라 · 렌더러 | 최소 구성 3요소. 회전하는 큐브 하나 | 배경색, 큐브 색, 안티앨리어싱(렌더러 재생성), pixelRatio |
| 1-2 | 렌더 루프와 deltaTime | 프레임 기준 회전과 시간 기준 회전 큐브 2개를 나란히 보여줌. FPS를 제한하면 차이가 드러남 | 가상 FPS 제한(15/30/60/무제한), 일시정지, 속도 |
| 1-3 | 좌표계와 변환 | 오른손 좌표계, AxesHelper/GridHelper, 이동·회전·크기 | position/rotation/scale, Euler 회전 순서, 로컬/월드 축 표시 |
| 1-4 | 씬 그래프 (부모-자식) | 태양-지구-달 계층. 부모 변환이 자식에게 전파됨 | 각 공전/자전 속도, 로컬 축 표시, "달을 월드로 떼어내기" 토글 |

### 02. 카메라
| 2-1 | 원근 vs 직교 | 같은 씬을 좌우 분할로 동시에 렌더(scissor). 세 번째 시점에서 CameraHelper로 절두체 표시 | FOV, 직교 zoom, near/far, 분할/단일 보기 |
| 2-2 | OrbitControls | 궤도 회전, 줌, 팬. target 마커 표시 | damping, autoRotate, 최소/최대 거리, 극각 제한, pan 허용 |

### 03. 지오메트리와 메시
| 3-1 | 기본 지오메트리 갤러리 | Box/Sphere/Cylinder/Cone/Torus/TorusKnot | 종류, 분할 수, 와이어프레임 |
| 3-2 | 버텍스·노멀 시각화 | BufferGeometry를 직접 구성(position/normal/index). 정점은 Points, 노멀은 VertexNormalsHelper로 표시. flat과 smooth 셰이딩 차이 | 정점·노멀 표시, 노멀 길이, flat/smooth, 노이즈 변위 크기 |

### 04. 재질
| 4-1 | 재질 비교 | Basic/Lambert/Phong/Standard 구체 4개를 같은 조명 아래 나란히 배치 | 색, Phong shininess, 조명 회전, 와이어프레임 |
| 4-2 | PBR 거칠기 × 금속성 | 5×5 구체 그리드 (가로 roughness, 세로 metalness). 환경맵 유무에 따른 차이 | 환경맵 on/off, envMapIntensity, 기본색, clearcoat(Physical) |

### 05. 조명
| 5-1 | 조명 종류 비교 | Ambient/Hemisphere/Directional/Point/Spot을 개별 on/off. 각 Helper 표시 | 종류별 on/off·강도·색, Spot 각도·penumbra, Point distance·decay, 헬퍼 표시 |

### 06. 그림자
| 6-1 | 섀도우맵 기본 | castShadow/receiveShadow, 섀도우 타입 비교 | 타입(Basic/PCF/VSM — r186에서 PCFSoft는 제거되어 PCF의 radius로 대체), 광원 종류, 그림자 카메라 헬퍼 |
| 6-2 | 아티팩트 실험실 | 해상도, 바이어스, 절두체 크기에 따른 계단 현상·shadow acne·peter-panning 재현 | mapSize 128~4096, bias, normalBias, 절두체 크기, "acne 재현"/"peter-panning 재현" 프리셋 |

### 07. 텍스처
| 7-1 | UV 좌표 | UV를 색으로 표시하는 셰이더와 UV 그리드 텍스처를 평면/구/박스에 적용 | 형상, repeat, offset, rotation, UV 색 보기 |
| 7-2 | 래핑과 필터링 | Repeat/Clamp/Mirrored. 긴 바닥으로 밉맵과 비등방 필터링 차이 확인 | wrapS/T, mag/minFilter, 밉맵, anisotropy |
| 7-3 | 노멀맵 | 절차적 벽돌 높이맵에서 노멀맵을 생성. 움직이는 광원으로 입체감 확인 | normalMap on/off, normalScale, bump/displacement 비교, 광원 속도 |

### 08. 환경맵과 반사, 안개
| 8-1 | 환경맵과 반사 | PMREM(RoomEnvironment) 정적 반사 + CubeCamera 실시간 반사(주변 물체가 움직임) | 정적/동적, roughness, metalness, CubeCamera 해상도, 배경으로 표시 |
| 8-2 | 안개 | 기둥이 길게 늘어선 복도. Fog(선형)와 FogExp2(지수) 비교 | 종류, near/far, density, 색 (배경색과 동기화) |

### 09. 셰이더 입문
| 9-1 | 프래그먼트 셰이더 | 평면에 uv와 uTime으로 패턴을 그림. 프리셋: 그라디언트/줄무늬/원/노이즈 | 프리셋, 주파수, 색 2개, 시간 속도, 셰이더 코드 보기 |
| 9-2 | 버텍스 셰이더 | 구 정점을 노멀 방향으로 sin 변위. varying으로 노멀을 색으로 전달 | 진폭, 주파수, 속도, 와이어프레임 |

### 10. 바다 물결
| 10-1 | Gerstner 파도 | 버텍스 셰이더에서 4개 파의 합(방향, 파장, steepness)과 해석적 노멀 계산. 프래그먼트에서 Schlick Fresnel, 하늘 그라디언트 반사, 태양 스페큘러, 깊이에 따른 색, 파고 기반 거품. CPU에서 같은 공식으로 계산해 부표를 띄움 | 파별 방향·파장·steepness, 태양 방향, 물 색, 거품 임계값, 메시 해상도, 와이어프레임 |

### 11. 둥글게 말리는 세상
| 11-1 | Curved World | `onBeforeCompile`로 Standard 재질에 셰이더 코드를 주입: `worldPos.y -= k · (dx² + dz²)` (카메라 기준 거리²). 앞으로 달리는 무한 지면과 나무, 건물 | 휘는 강도 k (0이면 평면과 비교), 모드(구형/원통형 롤), 이동 속도, 그림자용 depth 재질 패치 on/off (그림자가 어긋나는 것 시연) |

해설 포인트: 실제 지오메트리는 그대로 두고 **그릴 때만** 휘게 만듭니다. 그래서 frustum culling이 휘기 전 위치로 판정해 물체가 갑자기 사라질 수 있고(→ bounding 확대 또는 `frustumCulled=false`), 그림자 패스도 같은 변환이 필요합니다(`customDepthMaterial`).

### 12. 툰 셰이딩 + 외곽선
| 12-1 | 툰 셰이딩과 외곽선 | MeshToonMaterial + 계단형 gradientMap(Nearest 필터). 외곽선 2방식: ① Inverted Hull(노멀 방향으로 부풀린 뒷면 메시) ② 후처리 엣지(깊이·노멀 Sobel) | 단계 수(2~5), 외곽선 방식, 두께, 색, 림 라이트 |

### 13. 인스턴싱
| 13-1 | 풀밭 수만 개 + 바람 | InstancedMesh(풀잎 지오메트리)와 인스턴스별 위치·회전·크기. 버텍스 셰이더에서 노이즈 기반 바람 (뿌리는 고정, 끝으로 갈수록 크게 휨). 뿌리에서 끝으로 색 그라디언트. 드로우콜 1회 표시 | 개수(모바일 1만, 데스크톱 5만, 최대 20만), 바람 세기·속도·방향, 풀 높이, 통계 |

### 14. 파티클
| 14-1 | 은하 생성기 | Points + 커스텀 셰이더(부드러운 원, additive blending, 거리별 크기). 나선 팔, 회전, 무작위성 | 개수, 팔 수, 반지름, spin, 무작위성, 안쪽/바깥 색 |
| 14-2 | 분수 (시간 기반 GPU 파티클) | CPU 업데이트 없이 초기 속도와 시작 시각 attribute만 넘기고, 셰이더에서 `p = p0 + v·t + ½g·t²` 계산 | 개수, 중력, 분출 속도, 수명, 크기 |

### 15. 포스트프로세싱
| 15-1 | 블룸과 후처리 체인 | EffectComposer: RenderPass → UnrealBloomPass → (선택) 비네트/필름 그레인/RGB shift 커스텀 ShaderPass → OutputPass | 블룸 threshold/strength/radius, 각 패스 on/off, 톤매핑 노출 |

### 16. 성능
| 16-1 | 드로우콜 | 큐브 N개를 ① 개별 Mesh ② 병합 지오메트리(mergeGeometries) ③ InstancedMesh로 비교. `renderer.info`의 calls·triangles와 FPS를 실시간 표시 | 개수, 방식, 움직임 on/off (병합은 개별 이동이 어렵다는 점 시연) |
| 16-2 | LOD와 컬링 | THREE.LOD 3단계(디테일별 색 구분). 물체가 많은 필드에서 카메라가 자동 비행. 삼각형 수 변화 표시 | LOD 거리 임계값, 레벨 색 표시, LOD on/off, frustum culling on/off |

(1-1 ~ 16-2: 기초 4 + 카메라 2 + 지오메트리 2 + 재질 2 + 조명 1 + 그림자 2 + 텍스처 3 + 환경 2 + 셰이더 2 + 바다 1 + 곡면 1 + 툰 1 + 인스턴싱 1 + 파티클 2 + 후처리 1 + 성능 2 = **29개**. 구현 중 필요하면 서브 데모를 추가합니다.)

---

## 5. 배포 (GitHub Actions → GitHub Pages)

`.github/workflows/deploy.yml`
- 트리거: `main` 브랜치 push, `workflow_dispatch`
- 권한: `contents: read`, `pages: write`, `id-token: write`. `concurrency: pages`
- 잡: checkout → setup-node(22, npm 캐시) → `npm ci` → `npm run build` → `actions/upload-pages-artifact` (`dist`) → `actions/deploy-pages`
- `vite.config.js`: `base: './'`. 페이지가 하나라 라우터가 없으므로 상대 경로면 `https://<user>.github.io/<repo>/`에서 그대로 동작합니다.

**사용자가 한 번 해야 할 설정:** 저장소 Settings → Pages → Source를 **"GitHub Actions"** 로 지정.

---

## 6. 구현 순서

각 단계가 끝날 때마다 `npm run build`가 통과하는지와 Playwright 스모크 테스트를 확인한 뒤 커밋하고 push합니다.

1. ✅ **Phase 0 — 스캐폴딩과 배포 파이프라인**
   Vite 프로젝트, 의존성 고정, `index.html`·CSS 뼈대, `deploy.yml`, README. 빈 페이지라도 **먼저 배포해서 Pages 경로 문제를 일찍 확인**합니다.
2. ✅ **Phase 1 — 코어 프레임워크** (가장 중요)
   `registry` → `DemoHost` → `DemoManager`(IO, 상한, LRU, 유예, 포스터) → `gui`, `touchGuard`, `statsOverlay`, `dispose`, `device` → `_template`과 `new-demo` 스크립트.
   데모 1-1 하나로 검증: 스크롤 진입/이탈 때 생성·해제, 컨텍스트 수, GUI 값 보존, 모바일 터치 가드.
   스모크 테스트를 작성합니다: 전 구간을 스크롤하며 `console.error`가 0건인지, 동시 활성 캔버스 수가 상한 이하인지 검사.
3. ✅ **Phase 2 — 기본기 ①** 카테고리 01~03 (데모 8개) + `shared/textures.js`
4. ✅ **Phase 3 — 기본기 ②** 카테고리 04~08 (데모 10개) + `shared/environment.js`
5. ✅ **Phase 4 — 셰이더 응용** 09 → 10 → 11 → 12 (데모 5개) + `shared/glsl/noise.glsl`
6. ✅ **Phase 5 — 대량 렌더링과 후처리** 13 → 14 → 15 → 16 (데모 6개)
7. ✅ **Phase 6 — 마감**
   목차 드로어, 현재 섹션 하이라이트, 설명 문구 다듬기, 모바일 뷰포트(375px) Playwright 스크린샷 점검, 저사양 품질 프리셋 튜닝, README(로컬 실행 방법, 데모 추가 방법).

---

## 7. 클라우드 세션 진행 시 확인 사항

- 현재 작업 디렉터리(`/home/user`)는 **git 저장소가 아니고 비어 있습니다.** 배포하려면 push할 GitHub 저장소가 필요합니다.
  → 구현을 시작하기 전에 **저장소 이름(owner/repo)과 기본 브랜치**를 알려주세요. 세션에 연결한 뒤 그 저장소 루트에서 작업합니다.
- `.github/workflows/` 파일을 push하려면 GitHub 쪽에서 workflow 권한이 필요합니다. 거부되면 워크플로 파일 내용을 드릴 테니 웹 UI에서 직접 추가하면 됩니다.
- 컨테이너는 임시 환경이므로 각 Phase가 끝날 때마다 커밋하고 push합니다.
- 헤드리스 Chromium의 WebGL은 소프트웨어 렌더링(SwiftShader)이라 느립니다. 스모크 테스트는 성능이 아니라 **에러 여부와 생명주기 검증용**입니다. 실제 성능과 모바일 체감은 배포된 페이지를 실기기에서 확인해야 합니다.
