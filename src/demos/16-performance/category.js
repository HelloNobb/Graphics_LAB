export default {
  title: '성능',
  en: 'Draw Calls · Batching · LOD · Culling',
  intro: `<p>실시간 그래픽스는 한 프레임을 <strong>16.6ms(60fps)</strong> 안에 끝내야 합니다. 느려지는 원인은 크게 두 곳입니다.</p>
  <ul>
    <li><strong>CPU 병목</strong>: 드로우콜이 너무 많거나 JavaScript에서 매 프레임 할 일이 너무 많은 경우입니다. → 합치기, 인스턴싱</li>
    <li><strong>GPU 병목</strong>: 삼각형이 너무 많거나, 픽셀마다 계산이 무겁거나, 해상도가 너무 높은 경우입니다. → LOD, 컬링, pixelRatio 제한, 셰이더 단순화</li>
  </ul>
  <p>최적화는 무엇이 병목인지 <strong>측정</strong>하는 것부터 시작합니다. 이 사이트의 모든 데모는 왼쪽 아래에 FPS, 드로우콜, 삼각형 수를 표시합니다(<code>renderer.info</code>).</p>`,
};
