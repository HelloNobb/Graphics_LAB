import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { orbit, options } from '../../../shared/helpers.js';
import { toonGradient } from '../../../shared/textures.js';

export const params = {
  shading: 'toon',
  steps: 3,
  rim: 0.45,
  outline: 'hull',
  thickness: 3,
  outlineColor: '#15121c',
  edgeThreshold: 0.25,
  animate: true,
};

// 반전 헐: 클립 공간에서 노멀 방향으로 밀어 화면상 일정한 두께(px)를 유지
const hullVertex = /* glsl */ `
uniform float uThickness;
uniform vec2 uResolution;
void main() {
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vec3 viewNormal = normalize(normalMatrix * normal);
  vec2 dir = normalize((projectionMatrix * vec4(viewNormal, 0.0)).xy + 1e-6);
  clip.xy += dir * uThickness * 2.0 / uResolution * clip.w;
  gl_Position = clip;
}`;
const hullFragment = /* glsl */ `
uniform vec3 uColor;
void main() {
  gl_FragColor = vec4(uColor, 1.0);
  #include <colorspace_fragment>
}`;

// 후처리 엣지: 깊이 + 노멀 버퍼에 Sobel
const EdgeShader = {
  uniforms: {
    tDiffuse: { value: null },
    tNormal: { value: null },
    tDepth: { value: null },
    uResolution: { value: new THREE.Vector2() },
    uColor: { value: new THREE.Color() },
    uThreshold: { value: 0.25 },
    uThickness: { value: 1 },
    cameraNear: { value: 0.1 },
    cameraFar: { value: 100 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    #include <packing>
    uniform sampler2D tDiffuse, tNormal, tDepth;
    uniform vec2 uResolution;
    uniform vec3 uColor;
    uniform float uThreshold, uThickness, cameraNear, cameraFar;
    varying vec2 vUv;
    float depthAt(vec2 uv) {
      float z = texture2D(tDepth, uv).x;
      return -perspectiveDepthToViewZ(z, cameraNear, cameraFar); // 선형 깊이 (m)
    }
    void main() {
      vec2 px = uThickness / uResolution;
      float gx = 0.0, gy = 0.0;
      vec3 nx = vec3(0.0), ny = vec3(0.0);
      float center = depthAt(vUv);
      for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) {
        vec2 o = vec2(float(i), float(j));
        float w = (i == 0 || j == 0) ? 2.0 : 1.0;
        vec2 uv = vUv + o * px;
        float d = depthAt(uv) / center;           // 거리에 무관하게 상대 비교
        vec3 n = texture2D(tNormal, uv).xyz * 2.0 - 1.0;
        gx += d * float(i) * w;  gy += d * float(j) * w;
        nx += n * float(i) * w;  ny += n * float(j) * w;
      }
      float depthEdge = sqrt(gx * gx + gy * gy);
      float normalEdge = sqrt(dot(nx, nx) + dot(ny, ny));
      float edge = max(step(uThreshold * 0.4, depthEdge), step(uThreshold * 4.0, normalEdge));
      vec4 base = texture2D(tDiffuse, vUv);
      gl_FragColor = vec4(mix(base.rgb, uColor, edge), base.a);
    }`,
};

export function create({ renderer, canvas, gui, params, width, height, track }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f3efe6');
  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 60);
  camera.position.set(6, 4.5, 8);

  let gradient = toonGradient(params.steps);
  const rimUniform = { value: params.rim };
  const toon = (color) => {
    const m = new THREE.MeshToonMaterial({ color, gradientMap: gradient });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uRim = rimUniform;
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'uniform float uRim;\nvoid main() {')
        .replace(
          '#include <opaque_fragment>',
          `float rimDot = 1.0 - max(dot(normalize(normal), normalize(vViewPosition)), 0.0);
           outgoingLight += step(0.68, rimDot) * uRim * diffuseColor.rgb;
           #include <opaque_fragment>`,
        );
    };
    return m;
  };
  const standard = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.55 });

  const objects = [];
  const add = (geo, color, pos, rot = [0, 0, 0]) => {
    const toonMat = toon(color);
    const stdMat = standard(color);
    const mesh = new THREE.Mesh(geo, toonMat);
    mesh.position.set(...pos);
    mesh.rotation.set(...rot);
    mesh.userData = { toonMat, stdMat };
    scene.add(mesh);
    objects.push(mesh);
    return mesh;
  };
  const knot = add(new THREE.TorusKnotGeometry(0.9, 0.32, 200, 32), '#ff8a65', [0, 1.8, 0]);
  add(new THREE.SphereGeometry(0.9, 64, 32), '#5ec2ff', [-2.6, 0.9, 1.2]);
  add(new THREE.BoxGeometry(1.4, 1.4, 1.4), '#ffd166', [2.6, 0.7, 1.2], [0, 0.6, 0]);
  add(new THREE.CapsuleGeometry(0.5, 1.2, 8, 24), '#a78bfa', [1.6, 1.1, -2]);
  add(new THREE.ConeGeometry(0.8, 1.6, 48), '#7cf0c5', [-1.8, 0.8, -1.8]);
  const floor = add(new THREE.CylinderGeometry(5.5, 5.5, 0.3, 96), '#e7dccb', [0, -0.15, 0]);

  scene.add(new THREE.AmbientLight('#ffffff', 0.5));
  const sun = new THREE.DirectionalLight('#ffffff', 2.4);
  sun.position.set(4, 7, 5);
  scene.add(sun);

  // ── 반전 헐 ─────────────────────────
  const hullMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uThickness: { value: params.thickness }, uResolution: { value: new THREE.Vector2(width, height) }, uColor: { value: new THREE.Color(params.outlineColor) } },
    vertexShader: hullVertex,
    fragmentShader: hullFragment,
  });
  const hulls = objects.filter((o) => o !== floor).map((o) => {
    const h = new THREE.Mesh(o.geometry, hullMat);
    o.add(h);
    return h;
  });

  // ── 후처리 엣지 ─────────────────────
  const normalRT = track(new THREE.WebGLRenderTarget(1, 1, { depthTexture: new THREE.DepthTexture(1, 1) }));
  const normalMat = new THREE.MeshNormalMaterial();
  const composer = track(new EffectComposer(renderer, track(new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType }))));
  composer.addPass(new RenderPass(scene, camera));
  const edgePass = new ShaderPass(EdgeShader);
  edgePass.uniforms.tNormal.value = normalRT.texture;
  edgePass.uniforms.tDepth.value = normalRT.depthTexture;
  composer.addPass(edgePass);
  composer.addPass(new OutputPass());
  track(normalMat);

  const apply = () => {
    for (const o of objects) o.material = params.shading === 'toon' ? o.userData.toonMat : o.userData.stdMat;
    rimUniform.value = params.rim;
    hullMat.uniforms.uThickness.value = params.thickness;
    hullMat.uniforms.uColor.value.set(params.outlineColor);
    hulls.forEach((h) => (h.visible = params.outline === 'hull'));
    edgePass.uniforms.uColor.value.set(params.outlineColor);
    edgePass.uniforms.uThreshold.value = params.edgeThreshold;
    edgePass.uniforms.uThickness.value = Math.max(1, params.thickness / 2.5);
  };
  const setSteps = () => {
    const old = gradient;
    gradient = toonGradient(params.steps);
    objects.forEach((o) => (o.userData.toonMat.gradientMap = gradient));
    old.dispose();
  };
  apply();

  gui.add(params, 'shading', options([['툰 (MeshToonMaterial)', 'toon'], ['일반 (Standard)', 'standard']])).name('셰이딩 비교').onChange(apply);
  gui.add(params, 'steps', 2, 8, 1).name('명암 단계 수').onChange(setSteps);
  gui.add(params, 'rim', 0, 1, 0.01).name('림 라이트').onChange(apply);
  gui.add(params, 'outline', options([['A. 반전 헐', 'hull'], ['B. 후처리 엣지', 'post'], ['없음', 'none']])).name('외곽선 방식').onChange(apply);
  gui.add(params, 'thickness', 0.5, 8, 0.1).name('두께 (px)').onChange(apply);
  gui.addColor(params, 'outlineColor').name('외곽선 색').onChange(apply);
  gui.add(params, 'edgeThreshold', 0.05, 1, 0.01).name('엣지 민감도 (B)').onChange(apply);
  gui.add(params, 'animate').name('회전');

  return {
    scene,
    camera,
    controls: orbit(camera, canvas, [0, 1, 0]),
    resize(w, h) {
      const pr = renderer.getPixelRatio();
      hullMat.uniforms.uResolution.value.set(w, h);
      composer.setPixelRatio(pr);
      composer.setSize(w, h);
      normalRT.setSize(w * pr, h * pr);
      edgePass.uniforms.uResolution.value.set(w * pr, h * pr);
    },
    update(dt) {
      if (params.animate) knot.rotation.y += dt * 0.5;
      edgePass.uniforms.cameraNear.value = camera.near;
      edgePass.uniforms.cameraFar.value = camera.far;
    },
    render(dt) {
      if (params.outline !== 'post') {
        renderer.render(scene, camera);
        return;
      }
      // 1) 노멀 + 깊이 버퍼 렌더
      scene.overrideMaterial = normalMat;
      const bg = scene.background;
      scene.background = null;
      renderer.setRenderTarget(normalRT);
      renderer.setClearColor(0x8080ff, 1);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.setClearColor(0x000000, 1);
      scene.background = bg;
      scene.overrideMaterial = null;
      // 2) 색 렌더 + 엣지 합성
      composer.render(dt);
    },
    dispose() {
      objects.forEach((o) => {
        o.userData.toonMat.dispose();
        o.userData.stdMat.dispose();
      });
      gradient.dispose();
      composer.passes.forEach((p) => p.dispose?.());
    },
  };
}
