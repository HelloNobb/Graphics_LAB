import * as THREE from 'three';
import { orbit, options } from '../../../shared/helpers.js';
import { gerstnerAt, maxAmplitude } from './gerstner.js';
import skyGlsl from './sky.glsl?raw';
import oceanVert from './ocean.vert.glsl?raw';
import oceanFrag from './ocean.frag.glsl?raw';

const PRESETS = {
  calm: [
    { angle: 0, steepness: 0.08, wavelength: 26 },
    { angle: 40, steepness: 0.06, wavelength: 14 },
    { angle: -55, steepness: 0.05, wavelength: 8 },
    { angle: 80, steepness: 0.04, wavelength: 4.5 },
  ],
  normal: [
    { angle: 0, steepness: 0.2, wavelength: 30 },
    { angle: 35, steepness: 0.16, wavelength: 16 },
    { angle: -50, steepness: 0.13, wavelength: 9 },
    { angle: 75, steepness: 0.1, wavelength: 5 },
  ],
  storm: [
    { angle: 10, steepness: 0.3, wavelength: 46 },
    { angle: 40, steepness: 0.24, wavelength: 24 },
    { angle: -30, steepness: 0.2, wavelength: 13 },
    { angle: 70, steepness: 0.14, wavelength: 6.5 },
  ],
};

export const params = {
  waves: structuredClone(PRESETS.normal),
  timeScale: 1,
  sunElevation: 18,
  sunAzimuth: -100,
  deep: '#062a43',
  shallow: '#1f8f8a',
  foam: 0.82,
  specPower: 260,
  wireframe: false,
  buoys: true,
};

export function create({ canvas, gui, params, quality }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(0, 6, 20);

  const sunDir = new THREE.Vector3();
  const skyUniforms = {
    uSunDir: { value: sunDir },
    uSunColor: { value: new THREE.Color('#ffe0b0') },
    uSkyTop: { value: new THREE.Color('#2f6fb3') },
    uSkyHorizon: { value: new THREE.Color('#cfe0ee') },
  };

  // 하늘 돔: 카메라를 따라다니는 큰 구 안쪽에 하늘 셰이더
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(500, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: skyUniforms,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        ${skyGlsl}
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          vec3 c = skyColor(vec3(d.x, max(d.y, 0.0), d.z));
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  sky.renderOrder = -1;
  scene.add(sky);

  // 바다
  const SIZE = 180;
  const segs = quality === 'low' ? 200 : 360;
  const waveUniform = [0, 1, 2, 3].map(() => new THREE.Vector4());
  const oceanUniforms = {
    ...skyUniforms,
    uTime: { value: 0 },
    uWaves: { value: waveUniform },
    uDeep: { value: new THREE.Color() },
    uShallow: { value: new THREE.Color() },
    uMaxHeight: { value: 1 },
    uFoam: { value: params.foam },
    uSpecPower: { value: params.specPower },
    uFadeDist: { value: SIZE * 0.48 },
  };
  const oceanGeo = new THREE.PlaneGeometry(SIZE, SIZE, segs, segs);
  oceanGeo.rotateX(-Math.PI / 2);
  const oceanMat = new THREE.ShaderMaterial({
    uniforms: oceanUniforms,
    vertexShader: oceanVert,
    fragmentShader: skyGlsl + oceanFrag,
  });
  const ocean = new THREE.Mesh(oceanGeo, oceanMat);
  ocean.frustumCulled = false; // 정점이 셰이더에서 움직이므로 바운딩 구가 정확하지 않음
  scene.add(ocean);

  // 부표 (CPU에서 같은 Gerstner 공식으로 위치·기울기 계산)
  const buoys = [];
  const buoyGroup = new THREE.Group();
  scene.add(buoyGroup);
  scene.add(new THREE.HemisphereLight('#cfe0ee', '#0a2a40', 1.2));
  const sunLight = new THREE.DirectionalLight('#fff0d8', 3);
  scene.add(sunLight);
  const red = new THREE.MeshStandardMaterial({ color: '#e0412f', roughness: 0.5 });
  const white = new THREE.MeshStandardMaterial({ color: '#f2f2f2', roughness: 0.5 });
  [[-6, 4], [5, -3], [1, 9], [-10, -8]].forEach(([x, z]) => {
    const b = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 0.9, 20), red);
    body.position.y = 0.1;
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.18, 20), white);
    stripe.position.y = 0.35;
    const mast = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.1, 16), red);
    mast.position.y = 1.05;
    b.add(body, stripe, mast);
    buoyGroup.add(b);
    buoys.push({ obj: b, x, z, normal: new THREE.Vector3(0, 1, 0) });
  });

  const applyWaves = () => {
    params.waves.forEach((w, i) => {
      const a = THREE.MathUtils.degToRad(w.angle);
      waveUniform[i].set(Math.cos(a), Math.sin(a), w.steepness, w.wavelength);
    });
    oceanUniforms.uMaxHeight.value = maxAmplitude(params.waves);
  };
  const applyLook = () => {
    const el = THREE.MathUtils.degToRad(params.sunElevation);
    const az = THREE.MathUtils.degToRad(params.sunAzimuth);
    sunDir.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).normalize();
    sunLight.position.copy(sunDir).multiplyScalar(50);
    // 해가 낮으면 노을빛
    const low = 1 - THREE.MathUtils.smoothstep(params.sunElevation, 2, 30);
    skyUniforms.uSunColor.value.set('#fff1d6').lerp(new THREE.Color('#ff8a3d'), low);
    skyUniforms.uSkyHorizon.value.set('#cfe0ee').lerp(new THREE.Color('#f2a66b'), low * 0.8);
    skyUniforms.uSkyTop.value.set('#2f6fb3').lerp(new THREE.Color('#3b3f6b'), low * 0.6);
    oceanUniforms.uDeep.value.set(params.deep);
    oceanUniforms.uShallow.value.set(params.shallow);
    oceanUniforms.uFoam.value = params.foam;
    oceanUniforms.uSpecPower.value = params.specPower;
    oceanMat.wireframe = params.wireframe;
    buoyGroup.visible = params.buoys;
  };
  applyWaves();
  applyLook();

  const refresh = () => {
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
    applyWaves();
  };
  const fp = gui.addFolder('프리셋');
  fp.add({ f: () => ((params.waves = structuredClone(PRESETS.calm)), rebind(), refresh()) }, 'f').name('잔잔함');
  fp.add({ f: () => ((params.waves = structuredClone(PRESETS.normal)), rebind(), refresh()) }, 'f').name('보통');
  fp.add({ f: () => ((params.waves = structuredClone(PRESETS.storm)), rebind(), refresh()) }, 'f').name('폭풍');

  const waveFolders = [];
  const rebind = () => {
    waveFolders.forEach((f) => f.destroy());
    waveFolders.length = 0;
    params.waves.forEach((w, i) => {
      const f = gui.addFolder(`파도 ${i + 1}`).close();
      f.add(w, 'angle', -180, 180, 1).name('방향 (°)').onChange(applyWaves);
      f.add(w, 'steepness', 0, 1, 0.01).name('가파름 Q').onChange(applyWaves);
      f.add(w, 'wavelength', 1, 80, 0.5).name('파장 λ (m)').onChange(applyWaves);
      waveFolders.push(f);
    });
  };
  const fl = gui.addFolder('빛과 색');
  fl.add(params, 'sunElevation', 1, 80, 0.5).name('태양 고도 (°)').onChange(applyLook);
  fl.add(params, 'sunAzimuth', -180, 180, 1).name('태양 방위 (°)').onChange(applyLook);
  fl.addColor(params, 'deep').name('깊은 물').onChange(applyLook);
  fl.addColor(params, 'shallow').name('얕은 물').onChange(applyLook);
  fl.add(params, 'foam', 0.5, 1, 0.01).name('거품 임계값').onChange(applyLook);
  fl.add(params, 'specPower', 20, 1000, 1).name('스페큘러 날카로움').onChange(applyLook);
  gui.add(params, 'timeScale', 0, 3, 0.01).name('시간 배속');
  gui.add(params, 'wireframe').name('와이어프레임').onChange(applyLook);
  gui.add(params, 'buoys').name('부표').onChange(applyLook);
  rebind();

  const pos = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion();
  return {
    scene,
    camera,
    controls: orbit(camera, canvas, [0, 0, 0], { maxPolarAngle: THREE.MathUtils.degToRad(86), minDistance: 4, maxDistance: 70 }),
    update(dt) {
      oceanUniforms.uTime.value += dt * params.timeScale;
      sky.position.copy(camera.position);
      if (params.buoys) {
        const t = oceanUniforms.uTime.value;
        for (const b of buoys) {
          gerstnerAt(params.waves, b.x, b.z, t, pos, nrm);
          b.obj.position.copy(pos);
          b.normal.lerp(nrm, 0.15); // 살짝 늦게 따라가 무게감
          q.setFromUnitVectors(up, b.normal.clone().normalize());
          b.obj.quaternion.copy(q);
        }
      }
    },
  };
}
