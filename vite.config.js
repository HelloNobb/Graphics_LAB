import { defineConfig } from 'vite';

export default defineConfig({
  // 상대 경로: https://<user>.github.io/<repo>/ 처럼 하위 경로에 배포돼도 저장소 이름과 무관하게 동작
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
});
