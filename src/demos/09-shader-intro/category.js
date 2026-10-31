export default {
  title: '셰이더 입문',
  en: 'ShaderMaterial · Vertex Shader · Fragment Shader',
  intro: `<p>지금까지 쓴 재질은 모두 Three.js가 미리 써 둔 <strong>셰이더</strong>(GPU에서 도는 작은 프로그램)였습니다. <code>ShaderMaterial</code>을 쓰면 이것을 직접 작성할 수 있습니다.
  셰이더는 GLSL이라는 C 비슷한 언어로 쓰며, 두 단계로 나뉩니다.</p>
  <ul>
    <li><strong>버텍스 셰이더</strong>: <em>정점마다</em> 한 번씩 실행됩니다. 정점의 화면상 위치(<code>gl_Position</code>)를 결정합니다. 모양을 움직이고 비트는 일을 합니다.</li>
    <li><strong>프래그먼트 셰이더</strong>: 삼각형이 덮는 <em>픽셀마다</em> 한 번씩 실행됩니다. 그 픽셀의 색(<code>gl_FragColor</code>)을 결정합니다.</li>
  </ul>
  <p>둘 사이는 <strong>varying</strong>으로 이어집니다. 버텍스 셰이더가 정점에 값을 적어 두면, GPU가 삼각형 내부에서 보간해 프래그먼트 셰이더에 넘겨 줍니다.
  JavaScript에서 셰이더로 값을 넘길 때는 <strong>uniform</strong>을 씁니다. 모든 정점과 픽셀이 똑같이 받는 값이며, 시간이나 색, 마우스 위치 같은 것입니다.</p>`,
};
