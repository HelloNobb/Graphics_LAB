// Gerstner 파도 4개 합성. uWaves[i] = (방향x, 방향z, steepness Q, 파장 λ)
uniform float uTime;
uniform vec4 uWaves[4];
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vHeight;

const float G = 9.81;
const float TAU = 6.28318530718;

vec3 gerstner(vec4 w, vec3 p, inout vec3 tangent, inout vec3 binormal) {
  float steep = w.z;
  float k = TAU / w.w;
  float c = sqrt(G / k);           // 분산 관계: 긴 파도가 더 빠르다
  vec2 d = normalize(w.xy);
  float f = k * (dot(d, p.xz) - c * uTime);
  float a = steep / k;
  float s = sin(f);
  float co = cos(f);
  // 위치를 x,z로 미분한 값 누적 → 노멀 계산용
  tangent += vec3(-d.x * d.x * steep * s, d.x * steep * co, -d.x * d.y * steep * s);
  binormal += vec3(-d.x * d.y * steep * s, d.y * steep * co, -d.y * d.y * steep * s);
  return vec3(d.x * a * co, a * s, d.y * a * co);
}

void main() {
  vec3 grid = (modelMatrix * vec4(position, 1.0)).xyz;
  vec3 tangent = vec3(1.0, 0.0, 0.0);
  vec3 binormal = vec3(0.0, 0.0, 1.0);
  vec3 p = grid;
  for (int i = 0; i < 4; i++) p += gerstner(uWaves[i], grid, tangent, binormal);
  vNormal = normalize(cross(binormal, tangent));
  vWorldPos = p;
  vHeight = p.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
