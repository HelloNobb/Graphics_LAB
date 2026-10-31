export default {
  title: '씬 · 카메라 · 렌더러',
  aspect: 16 / 9,
  tip: '드래그: 회전 · 휠: 줌 · 안티앨리어싱은 렌더러를 새로 만들어야 바뀌므로 데모가 재시작됩니다.',
  renderer: (p) => ({ antialias: p.antialias }),
};
