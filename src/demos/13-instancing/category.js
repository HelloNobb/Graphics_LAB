export default {
  title: '인스턴싱',
  en: 'InstancedMesh · GPU Wind',
  intro: `<p>같은 모양을 수만 번 그려야 할 때(풀, 나무, 군중, 총알)마다 <code>Mesh</code>를 하나씩 만들면 CPU가 GPU에 "이것 그려"라는 명령(<strong>드로우콜</strong>)을 수만 번 보내야 합니다.
  드로우콜 하나하나에 준비 비용이 있어서 몇천 개만 넘어도 GPU보다 CPU가 먼저 한계에 닿습니다.
  <strong>인스턴싱</strong>은 "이 모양을 이 행렬 목록대로 N번 그려"라는 <strong>단 한 번의 명령</strong>으로 해결합니다.</p>`,
};
