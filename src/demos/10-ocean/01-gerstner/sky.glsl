// 하늘 색: 수평선 → 천정 그라디언트 + 태양 원반 + 태양 주변 광륜
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;

vec3 skyColor(vec3 dir) {
  float y = max(dir.y, 0.0);
  vec3 c = mix(uSkyHorizon, uSkyTop, pow(y, 0.45));
  float sd = max(dot(dir, uSunDir), 0.0);
  c += uSunColor * (pow(sd, 900.0) * 30.0 + pow(sd, 12.0) * 0.35);
  return c;
}
