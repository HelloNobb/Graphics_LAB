import * as THREE from 'three';
import { orbit, options } from '../../../shared/helpers.js';

export const params = {
  solo: 'all',
  helpers: true,
  animate: true,
  ambient: { on: true, color: '#ffffff', intensity: 0.15 },
  hemi: { on: true, sky: '#8fb4ff', ground: '#6b4a2b', intensity: 0.6 },
  directional: { on: true, color: '#fff1dc', intensity: 1.6 },
  point: { on: true, color: '#ff9a4a', intensity: 25, distance: 0, decay: 2 },
  spot: { on: true, color: '#7cf0c5', intensity: 120, angle: 22, penumbra: 0.35, decay: 2 },
};

export function create({ canvas, gui, params }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0a0c10');
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(7, 6, 9);

  const std = (color, rough = 0.5) => new THREE.MeshStandardMaterial({ color, roughness: rough });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), std('#9aa0aa', 0.9));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.8, 0.28, 160, 24), std('#e8e8ee', 0.3));
  knot.position.y = 1.6;
  scene.add(knot);
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), std('#d9654b'));
  box.position.set(-3, 0.7, 1);
  scene.add(box);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.8, 48, 24), std('#5e8bff', 0.25));
  ball.position.set(3, 0.8, -0.5);
  scene.add(ball);
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 3, 32), std('#e9d38f'));
  pillar.position.set(-1.5, 1.5, -3);
  scene.add(pillar);

  const ambient = new THREE.AmbientLight();
  const hemi = new THREE.HemisphereLight();
  hemi.position.set(0, 6, 0);
  const dir = new THREE.DirectionalLight();
  dir.position.set(5, 8, 3);
  const point = new THREE.PointLight();
  point.add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' })));
  const spot = new THREE.SpotLight();
  spot.position.set(-5, 6, 3);
  scene.add(spot.target, ambient, hemi, dir, point, spot);

  const helpers = {
    hemi: new THREE.HemisphereLightHelper(hemi, 0.6),
    directional: new THREE.DirectionalLightHelper(dir, 1),
    point: new THREE.PointLightHelper(point, 0.35),
    spot: new THREE.SpotLightHelper(spot),
  };
  Object.values(helpers).forEach((h) => scene.add(h));

  const lights = { ambient, hemi, directional: dir, point, spot };
  const apply = () => {
    for (const [name, light] of Object.entries(lights)) {
      const p = params[name];
      light.visible = p.on && (params.solo === 'all' || params.solo === name);
      light.intensity = p.intensity;
      if (name === 'hemi') {
        light.color.set(p.sky);
        light.groundColor.set(p.ground);
      } else light.color.set(p.color);
      if (helpers[name]) helpers[name].visible = light.visible && params.helpers;
    }
    point.distance = params.point.distance;
    point.decay = params.point.decay;
    spot.angle = THREE.MathUtils.degToRad(params.spot.angle);
    spot.penumbra = params.spot.penumbra;
    spot.decay = params.spot.decay;
    Object.values(helpers).forEach((h) => h.update?.());
  };
  apply();

  gui.add(params, 'solo', options([['전부', 'all'], ['Ambient만', 'ambient'], ['Hemisphere만', 'hemi'], ['Directional만', 'directional'], ['Point만', 'point'], ['Spot만', 'spot']])).name('하나만 보기').onChange(apply);
  gui.add(params, 'helpers').name('헬퍼 표시').onChange(apply);
  gui.add(params, 'animate').name('광원 움직이기');
  const fa = gui.addFolder('AmbientLight').close();
  fa.add(params.ambient, 'on').name('켜기').onChange(apply);
  fa.addColor(params.ambient, 'color').name('색').onChange(apply);
  fa.add(params.ambient, 'intensity', 0, 2, 0.01).name('세기').onChange(apply);
  const fh = gui.addFolder('HemisphereLight').close();
  fh.add(params.hemi, 'on').name('켜기').onChange(apply);
  fh.addColor(params.hemi, 'sky').name('하늘색').onChange(apply);
  fh.addColor(params.hemi, 'ground').name('땅색').onChange(apply);
  fh.add(params.hemi, 'intensity', 0, 4, 0.01).name('세기').onChange(apply);
  const fd = gui.addFolder('DirectionalLight').close();
  fd.add(params.directional, 'on').name('켜기').onChange(apply);
  fd.addColor(params.directional, 'color').name('색').onChange(apply);
  fd.add(params.directional, 'intensity', 0, 6, 0.01).name('세기').onChange(apply);
  const fp = gui.addFolder('PointLight').close();
  fp.add(params.point, 'on').name('켜기').onChange(apply);
  fp.addColor(params.point, 'color').name('색').onChange(apply);
  fp.add(params.point, 'intensity', 0, 150, 0.5).name('세기 (cd)').onChange(apply);
  fp.add(params.point, 'distance', 0, 15, 0.1).name('distance (0=무한)').onChange(apply);
  fp.add(params.point, 'decay', 0, 3, 0.01).name('decay').onChange(apply);
  const fs = gui.addFolder('SpotLight').close();
  fs.add(params.spot, 'on').name('켜기').onChange(apply);
  fs.addColor(params.spot, 'color').name('색').onChange(apply);
  fs.add(params.spot, 'intensity', 0, 400, 1).name('세기 (cd)').onChange(apply);
  fs.add(params.spot, 'angle', 3, 60, 1).name('angle (°)').onChange(apply);
  fs.add(params.spot, 'penumbra', 0, 1, 0.01).name('penumbra').onChange(apply);
  fs.add(params.spot, 'decay', 0, 3, 0.01).name('decay').onChange(apply);

  let t = 0;
  return {
    scene,
    camera,
    controls: orbit(camera, canvas, [0, 1, 0]),
    update(dt) {
      if (params.animate) t += dt;
      knot.rotation.y = t * 0.3;
      point.position.set(Math.cos(t * 0.9) * 3.2, 1.2 + Math.sin(t * 1.7) * 0.5, Math.sin(t * 0.9) * 3.2);
      spot.target.position.set(Math.sin(t * 0.6) * 2.5, 0, Math.cos(t * 0.6) * 1.5);
      dir.position.set(Math.cos(t * 0.15) * 6, 8, Math.sin(t * 0.15) * 6);
      helpers.spot.update();
      helpers.directional.update();
    },
  };
}
