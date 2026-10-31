uniform vec3 uDeep;
uniform vec3 uShallow;
uniform float uMaxHeight;
uniform float uFoam;
uniform float uSpecPower;
uniform float uFadeDist;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vHeight;

// skyColor()는 sky.glsl에서 앞에 붙는다

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float NdotV = max(dot(N, V), 0.0);

  // 1) 프레넬 (Schlick): 비스듬히 볼수록 반사가 강해진다
  float fresnel = 0.02 + 0.98 * pow(1.0 - NdotV, 5.0);

  // 2) 하늘 반사
  vec3 R = reflect(-V, N);
  R.y = abs(R.y);
  vec3 reflection = skyColor(R);

  // 3) 물 자체의 색: 마루는 얕은 색, 골은 깊은 색 + 태양 난반사
  float h = clamp(vHeight / max(uMaxHeight, 0.001) * 0.5 + 0.5, 0.0, 1.0);
  float diffuse = max(dot(N, uSunDir), 0.0);
  vec3 water = mix(uDeep, uShallow, h * h) * (0.35 + 0.65 * diffuse);
  // 가짜 하위표면 산란: 태양을 마주 볼 때 얇은 마루가 밝게 비침
  float sss = pow(max(dot(V, -uSunDir), 0.0), 3.0) * smoothstep(0.45, 1.0, h);
  water += uShallow * sss * 0.8;

  vec3 col = mix(water, reflection, fresnel);

  // 4) 태양 스페큘러 (Blinn-Phong)
  vec3 H = normalize(uSunDir + V);
  col += uSunColor * pow(max(dot(N, H), 0.0), uSpecPower) * 3.0 * smoothstep(-0.05, 0.1, uSunDir.y);

  // 5) 거품: 가장 높은 마루
  float foam = smoothstep(uFoam, 1.0, h);
  col = mix(col, vec3(0.9, 0.95, 1.0), foam * 0.85);

  // 6) 수평선으로 갈수록 하늘색에 녹이기 (메시 끝 숨기기)
  float dist = length(vWorldPos.xz - cameraPosition.xz);
  vec3 horizon = skyColor(normalize(vec3(-V.x, 0.0, -V.z)));
  col = mix(col, horizon, smoothstep(uFadeDist * 0.55, uFadeDist, dist));

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
