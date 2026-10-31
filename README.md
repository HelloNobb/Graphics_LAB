# 그래픽스 실험실 (Graphics Lab)

Three.js(WebGLRenderer) + Vite로 만든 실시간 3D 그래픽스 학습 사이트입니다.
16개 카테고리, 29개 인터랙티브 데모가 있고, 각 데모는 **한국어 개념 설명 → 캔버스 데모 → lil-gui 파라미터 조절** 순서로 구성되어 있습니다.

배포 주소: https://hellonobb.github.io/Graphics_LAB/

| # | 카테고리 | 데모 |
|---|---|---|
| 01 | 기초 | 씬·카메라·렌더러 / 렌더 루프와 deltaTime / 좌표계와 변환 / 씬 그래프 |
| 02 | 카메라 | 원근 vs 직교 / OrbitControls |
| 03 | 지오메트리 | 기본 지오메트리 갤러리 / 버텍스·노멀 시각화 |
| 04 | 재질 | Basic·Lambert·Phong·Standard 비교 / PBR 거칠기 × 금속성 |
| 05 | 조명 | Ambient·Hemisphere·Directional·Point·Spot + 헬퍼 |
| 06 | 그림자 | 섀도우 맵 원리 / 아티팩트 실험실(애크니·피터 패닝·계단) |
| 07 | 텍스처 | UV / 래핑과 필터링 / 노멀맵·범프·디스플레이스먼트 |
| 08 | 환경 | 환경맵과 CubeCamera 실시간 반사 / 안개 |
| 09 | 셰이더 입문 | 프래그먼트 셰이더 / 버텍스 셰이더 |
| 10 | 바다 | Gerstner 파도 + 프레넬·스페큘러 + CPU 부표 |
| 11 | 둥근 세상 | onBeforeCompile 커브드 월드 (그림자·컬링 함정 포함) |
| 12 | 툰 셰이딩 | gradientMap + 반전 헐 / 후처리 엣지 외곽선 |
| 13 | 인스턴싱 | 풀잎 수만 개 + GPU 바람 |
| 14 | 파티클 | 은하 생성기 / 상태 없는 GPU 분수 |
| 15 | 포스트프로세싱 | Bloom + 비네트·RGB 분리·필름 그레인, 전/후 비교 |
| 16 | 성능 | 드로우콜(개별·병합·인스턴싱) / LOD와 절두체 컬링 |

## 로컬 실행

```bash
npm install
npm run dev        # 개발 서버
npm run build      # dist/ 생성
npm run smoke      # 빌드 결과로 전 데모 스모크 테스트 (Playwright, --mobile / --shots / --only=d-10-01)
```

## 구조

```
src/
├─ main.js                 레지스트리 → 섹션 DOM → DemoManager
├─ core/
│  ├─ registry.js          import.meta.glob으로 데모 자동 수집 (폴더 숫자 접두사 순)
│  ├─ DemoManager.js       IntersectionObserver + 동시 활성 상한 + 유예 해제
│  ├─ DemoHost.js          데모 1개의 생명주기 (렌더러·GUI·루프·dispose·포스터)
│  ├─ touchGuard.js        모바일 "탭해서 조작" (스크롤 함정 방지)
│  ├─ statsOverlay.js      FPS · 드로우콜 · 삼각형
│  ├─ dispose.js           GPU 자원 해제
│  └─ device.js            모바일 판별, 품질 프리셋
├─ shared/                 절차적 텍스처, 환경맵, GLSL 노이즈, 헬퍼
└─ demos/<NN-카테고리>/<NN-데모>/
   ├─ meta.js              제목·비율·렌더러 옵션 (eager)
   ├─ content.html         한국어 설명. <!--demo--> 아래는 캔버스 밑에 표시
   └─ demo.js              export const params, export function create(ctx) (lazy)
```

### WebGL 컨텍스트 관리

브라우저는 동시에 쓸 수 있는 WebGL 컨텍스트 수를 제한합니다. 이 사이트는 **IntersectionObserver로 화면 근처의 데모만 초기화하고, 벗어나면 dispose**합니다.

- 화면 300px 전부터 미리 초기화하고, 실제로 보일 때만 렌더합니다.
- 동시에 살아 있는 데모는 데스크톱 4개, 모바일 2개까지입니다. 넘으면 화면 중앙에서 가장 먼 데모부터 해제합니다.
- 벗어난 데모는 1.5초 유예 후 해제하고, `renderer.forceContextLoss()`로 컨텍스트를 즉시 반납합니다.
- 해제 직전 마지막 프레임을 포스터로 남기고, GUI 값은 보존합니다.

렌더러 하나로 scissor 렌더링하는 방식 대신 이 방식을 고른 이유는 [PLAN.md](PLAN.md) 0장에 정리했습니다.
요약하면 섀도우 타입, 톤매핑, 안티앨리어싱, 후처리처럼 데모마다 다른 렌더러 설정이 학습 내용 자체이고, 모바일 스크롤 동기화와 장애 격리에도 유리하기 때문입니다.

## 새 데모 추가

```bash
npm run new-demo -- 05-lights 02-rect-area-light
```

`scripts/demo-template`이 복사됩니다. `demo.js`의 `create(ctx)`는 `{ scene, camera, controls?, update?(dt, t), render?(dt), resize?(w, h), dispose? }`를 반환하면 됩니다.
`ctx`에는 `renderer, canvas, gui, hud, params, quality, track(), onDispose(), addLabel(), restart()`가 들어 있습니다. 씬 안의 자원은 Host가 자동으로 해제합니다.

## 배포

`main`에 push하면 `.github/workflows/deploy.yml`이 빌드해서 GitHub Pages에 배포합니다(저장소 Settings → Pages → Source: GitHub Actions).
`vite.config.js`의 `base: './'` 덕분에 저장소 이름과 관계없이 동작합니다.
