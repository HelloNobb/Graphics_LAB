import * as THREE from 'three';
import { orbit, options } from '../../../shared/helpers.js';

export const params = {
  mode: 'split',
  fov: 50,
  orthoZoom: 1,
  near: 0.5,
  far: 40,
  dolly: false,
};

export function create({ renderer, canvas, gui, hud, params, addLabel, width, height }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0f1217');

  scene.add(new THREE.GridHelper(40, 40, '#3a4150', '#22262e'));
  const pillarGeo = new THREE.BoxGeometry(0.6, 2.4, 0.6);
  const matA = new THREE.MeshStandardMaterial({ color: '#8fb4ff', roughness: 0.6 });
  const matB = new THREE.MeshStandardMaterial({ color: '#ffb86b', roughness: 0.6 });
  for (let i = -8; i <= 8; i++) {
    for (const side of [-1, 1]) {
      const p = new THREE.Mesh(pillarGeo, i % 2 ? matA : matB);
      p.position.set(side * 3, 1.2, i * 2.2);
      scene.add(p);
    }
  }
  const hero = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), new THREE.MeshStandardMaterial({ color: '#7cf0c5', roughness: 0.4 }));
  hero.position.y = 0.7;
  scene.add(hero);
  scene.add(new THREE.HemisphereLight('#ffffff', '#223', 1.4));
  const sun = new THREE.DirectionalLight('#ffffff', 2);
  sun.position.set(4, 8, 5);
  scene.add(sun);

  const persp = new THREE.PerspectiveCamera(params.fov, 1, params.near, params.far);
  persp.position.set(6, 5, 10);
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, params.near, params.far);
  const observer = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
  observer.position.set(30, 26, 34);
  observer.lookAt(0, 0, 0);

  const perspHelper = new THREE.CameraHelper(persp);
  const orthoHelper = new THREE.CameraHelper(ortho);
  perspHelper.setColors(new THREE.Color('#7cf0c5'), new THREE.Color('#7cf0c5'), new THREE.Color('#ffffff'), new THREE.Color('#7cf0c5'), new THREE.Color('#7cf0c5'));
  orthoHelper.setColors(new THREE.Color('#ff7a85'), new THREE.Color('#ff7a85'), new THREE.Color('#ffffff'), new THREE.Color('#ff7a85'), new THREE.Color('#ff7a85'));
  scene.add(perspHelper, orthoHelper);

  const controls = orbit(persp, canvas, [0, 0.7, 0]);

  const labelL = addLabel('원근 Perspective', { left: '10px', bottom: '34px', color: '#7cf0c5' });
  const labelR = addLabel('직교 Orthographic', { right: '10px', bottom: '34px', color: '#ff7a85' });

  gui.add(params, 'mode', options([['분할 비교', 'split'], ['원근만', 'persp'], ['직교만', 'ortho'], ['관찰자 시점', 'observer']])).name('보기');
  gui.add(params, 'fov', 5, 120, 1).name('원근 FOV (°)').listen();
  gui.add(params, 'orthoZoom', 0.2, 4, 0.01).name('직교 zoom');
  gui.add(params, 'near', 0.1, 10, 0.1).name('near');
  gui.add(params, 'far', 5, 80, 1).name('far');
  gui.add(params, 'dolly').name('돌리 줌 (현기증 효과)');

  let w = width;
  let h = height;
  let dollyT = 0;
  const tmp = new THREE.Vector3();

  const fitCameras = (aspect) => {
    persp.fov = params.fov;
    persp.aspect = aspect;
    persp.near = params.near;
    persp.far = params.far;
    persp.updateProjectionMatrix();
    // 직교 카메라 크기를 "target 거리에서 원근 카메라가 보는 높이"에 맞춘다
    const dist = persp.position.distanceTo(controls.target);
    const halfH = (dist * Math.tan(THREE.MathUtils.degToRad(params.fov) / 2)) / params.orthoZoom;
    ortho.left = -halfH * aspect;
    ortho.right = halfH * aspect;
    ortho.top = halfH;
    ortho.bottom = -halfH;
    ortho.near = params.near;
    ortho.far = params.far;
    ortho.updateProjectionMatrix();
    ortho.position.copy(persp.position);
    ortho.quaternion.copy(persp.quaternion);
    ortho.updateMatrixWorld();
    perspHelper.update();
    orthoHelper.update();
  };

  const view = (cam, x, y, vw, vh) => {
    renderer.setViewport(x, y, vw, vh);
    renderer.setScissor(x, y, vw, vh);
    renderer.render(scene, cam);
  };

  return {
    scene,
    controls,
    resize(nw, nh) {
      w = nw;
      h = nh;
      observer.aspect = w / h;
      observer.updateProjectionMatrix();
    },
    update(dt) {
      if (params.dolly) {
        // 화면 속 큐브의 크기(= 거리 × tan(fov/2))를 일정하게 유지하면서 fov를 바꾼다
        dollyT += dt * 0.6;
        params.fov = 55 + Math.sin(dollyT) * 40;
        const keep = 10 * Math.tan(THREE.MathUtils.degToRad(55) / 2);
        const dist = keep / Math.tan(THREE.MathUtils.degToRad(params.fov) / 2);
        tmp.subVectors(persp.position, controls.target).setLength(dist);
        persp.position.copy(controls.target).add(tmp);
      }
      hud.textContent = `FOV ${params.fov.toFixed(0)}°  거리 ${persp.position.distanceTo(controls.target).toFixed(1)}`;
      labelL.style.display = params.mode === 'split' || params.mode === 'persp' ? '' : 'none';
      labelR.style.display = params.mode === 'split' || params.mode === 'ortho' ? '' : 'none';
      if (params.mode === 'ortho') Object.assign(labelR.style, { right: '10px' });
    },
    render() {
      const split = params.mode === 'split';
      fitCameras(split ? w / 2 / h : w / h);
      const showHelpers = params.mode === 'observer';
      perspHelper.visible = orthoHelper.visible = showHelpers;
      renderer.setScissorTest(true);
      if (split) {
        view(persp, 0, 0, w / 2, h);
        view(ortho, w / 2, 0, w / 2, h);
      } else {
        view(params.mode === 'persp' ? persp : params.mode === 'ortho' ? ortho : observer, 0, 0, w, h);
      }
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, w, h);
    },
  };
}
