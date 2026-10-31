import * as THREE from 'three';
import { orbit, options } from '../../../shared/helpers.js';
import { uvGridCanvas, canvasTexture } from '../../../shared/textures.js';

export const params = {
  shape: 'sphere',
  showUV: false,
  repeat: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  autoRotate: true,
};

const shapes = {
  plane: () => new THREE.PlaneGeometry(2.6, 2.6),
  box: () => new THREE.BoxGeometry(1.8, 1.8, 1.8),
  sphere: () => new THREE.SphereGeometry(1.3, 64, 32),
  cylinder: () => new THREE.CylinderGeometry(1, 1, 2.2, 48),
  torus: () => new THREE.TorusGeometry(1, 0.45, 32, 96),
};

export function create({ renderer, canvas, gui, params }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0f1217');
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 1, 5);

  const tex = canvasTexture(uvGridCanvas(), { anisotropy: renderer.capabilities.getMaxAnisotropy() });
  tex.center.set(0.5, 0.5);
  const texMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
  const uvMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uRepeat: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uRepeat;
      void main() {
        vec2 uv = fract(vUv * uRepeat);
        gl_FragColor = vec4(uv, 0.0, 1.0);
        #include <colorspace_fragment>
      }`,
  });

  const mesh = new THREE.Mesh(shapes[params.shape](), texMat);
  scene.add(mesh);

  const apply = () => {
    tex.repeat.set(params.repeat, params.repeat);
    tex.offset.set(params.offsetX, params.offsetY);
    tex.rotation = THREE.MathUtils.degToRad(params.rotation);
    uvMat.uniforms.uRepeat.value = params.repeat;
    mesh.material = params.showUV ? uvMat : texMat;
  };
  const setShape = () => {
    mesh.geometry.dispose();
    mesh.geometry = shapes[params.shape]();
  };
  apply();

  gui.add(params, 'shape', options([['평면', 'plane'], ['박스', 'box'], ['구', 'sphere'], ['원기둥', 'cylinder'], ['토러스', 'torus']])).name('모양').onChange(setShape);
  gui.add(params, 'showUV').name('UV를 색으로 보기').onChange(apply);
  gui.add(params, 'repeat', 0.25, 6, 0.25).name('repeat').onChange(apply);
  gui.add(params, 'offsetX', -1, 1, 0.01).name('offset U').onChange(apply);
  gui.add(params, 'offsetY', -1, 1, 0.01).name('offset V').onChange(apply);
  gui.add(params, 'rotation', -180, 180, 1).name('rotation (°)').onChange(apply);
  gui.add(params, 'autoRotate').name('자동 회전');

  return {
    scene,
    camera,
    controls: orbit(camera, canvas),
    update(dt) {
      if (params.autoRotate) mesh.rotation.y += dt * 0.35;
    },
    dispose() {
      texMat.dispose();
      uvMat.dispose();
      tex.dispose();
    },
  };
}
