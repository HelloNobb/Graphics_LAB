// 절차적 텍스처 생성기.
// 캔버스(이미지 데이터)는 렌더러와 무관하므로 캐시해서 재사용하고,
// THREE.Texture는 데모(=렌더러)마다 새로 만든다 (dispose 시 서로 영향을 주지 않도록).
import * as THREE from 'three';

const cache = new Map();
const cached = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};

function canvas2d(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

/** 체커보드 */
export function checkerCanvas(size = 512, cells = 8, a = '#e8e8e8', b = '#3a3f4a') {
  return cached(`checker:${size}:${cells}:${a}:${b}`, () => {
    const [c, g] = canvas2d(size);
    const s = size / cells;
    for (let y = 0; y < cells; y++)
      for (let x = 0; x < cells; x++) {
        g.fillStyle = (x + y) % 2 ? b : a;
        g.fillRect(x * s, y * s, s, s);
      }
    return c;
  });
}

/** UV 테스트 그리드: 칸마다 색과 좌표 라벨 → 어느 부분이 어디에 붙는지 바로 보인다 */
export function uvGridCanvas(size = 1024, cells = 8) {
  return cached(`uvgrid:${size}:${cells}`, () => {
    const [c, g] = canvas2d(size);
    const s = size / cells;
    for (let y = 0; y < cells; y++)
      for (let x = 0; x < cells; x++) {
        const u = x / (cells - 1);
        const v = 1 - y / (cells - 1);
        g.fillStyle = `hsl(${Math.round(u * 300)}, ${45 + v * 35}%, ${30 + v * 30}%)`;
        g.fillRect(x * s, y * s, s, s);
        g.strokeStyle = 'rgba(255,255,255,0.35)';
        g.lineWidth = 2;
        g.strokeRect(x * s + 1, y * s + 1, s - 2, s - 2);
        g.fillStyle = 'rgba(255,255,255,0.92)';
        g.font = `600 ${Math.round(s * 0.26)}px sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(`${String.fromCharCode(65 + x)}${cells - y}`, x * s + s / 2, y * s + s / 2);
      }
    // 원점(0,0) = 왼쪽 아래 표시
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(s * 0.18, size - s * 0.18, s * 0.09, 0, Math.PI * 2);
    g.fill();
    return c;
  });
}

/** 방향을 알 수 있는 비대칭 문자 'F' 텍스처 (래핑·미러링 확인용) */
export function letterCanvas(size = 64, letter = 'F') {
  return cached(`letter:${size}:${letter}`, () => {
    const [c, g] = canvas2d(size);
    g.fillStyle = '#f4d35e';
    g.fillRect(0, 0, size, size);
    g.fillStyle = '#ee6352';
    g.fillRect(0, 0, size, size * 0.12);
    g.fillRect(0, 0, size * 0.12, size);
    g.fillStyle = '#1b1f27';
    g.font = `900 ${size * 0.82}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(letter, size * 0.55, size * 0.56);
    return c;
  });
}

/** 벽돌 레이아웃: 색상 맵과 높이 맵을 같은 배치로 생성 */
function brickLayout(size, rows, cols, mortar, cb) {
  const bh = size / rows;
  const bw = size / cols;
  for (let r = 0; r < rows; r++) {
    const shift = r % 2 ? bw / 2 : 0;
    for (let k = -1; k < cols + 1; k++) {
      const x = k * bw + shift;
      cb(x + mortar / 2, r * bh + mortar / 2, bw - mortar, bh - mortar, r, k);
    }
  }
}

const rand = (seed) => {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
};

export function brickColorCanvas(size = 512) {
  return cached(`brickColor:${size}`, () => {
    const [c, g] = canvas2d(size);
    const rnd = rand(7);
    g.fillStyle = '#8d8a84';
    g.fillRect(0, 0, size, size);
    brickLayout(size, 8, 4, size * 0.02, (x, y, w, h) => {
      const l = 30 + rnd() * 12;
      g.fillStyle = `hsl(${8 + rnd() * 14}, ${45 + rnd() * 15}%, ${l}%)`;
      g.fillRect(x, y, w, h);
      for (let i = 0; i < 60; i++) {
        g.fillStyle = `rgba(0,0,0,${rnd() * 0.12})`;
        g.fillRect(x + rnd() * w, y + rnd() * h, 2 + rnd() * 5, 2 + rnd() * 5);
      }
    });
    return c;
  });
}

export function brickHeightCanvas(size = 512) {
  return cached(`brickHeight:${size}`, () => {
    const [c, g] = canvas2d(size);
    const rnd = rand(11);
    g.fillStyle = '#000';
    g.fillRect(0, 0, size, size);
    brickLayout(size, 8, 4, size * 0.02, (x, y, w, h) => {
      // 가장자리는 둥글게 깎인 느낌을 주기 위해 그라디언트
      const bevel = size * 0.012;
      for (let i = 0; i < 4; i++) {
        const t = i / 3;
        g.fillStyle = `rgb(${Math.round(110 + t * 120)},0,0)`;
        g.fillRect(x + bevel * (1 - t) * 1.2 + t * bevel, y + t * bevel, w - 2 * t * bevel, h - 2 * t * bevel);
      }
      for (let i = 0; i < 40; i++) {
        g.fillStyle = `rgba(0,0,0,${0.1 + rnd() * 0.25})`;
        const r = 1 + rnd() * 4;
        g.beginPath();
        g.arc(x + rnd() * w, y + rnd() * h, r, 0, Math.PI * 2);
        g.fill();
      }
    });
    // R 채널만 썼으므로 회색조로 복사
    const img = g.getImageData(0, 0, size, size);
    for (let i = 0; i < img.data.length; i += 4) img.data[i + 1] = img.data[i + 2] = img.data[i];
    g.putImageData(img, 0, 0);
    return c;
  });
}

/** 높이 맵 → 탄젠트 공간 노멀 맵 (Sobel 미분). RGB = (nx, ny, nz) * 0.5 + 0.5 */
export function heightToNormalCanvas(heightCanvas, strength = 4) {
  return cached(`normal:${heightCanvas.width}:${strength}:${heightCanvas.dataset.key || ''}`, () => {
    const w = heightCanvas.width;
    const h = heightCanvas.height;
    const src = heightCanvas.getContext('2d').getImageData(0, 0, w, h).data;
    const [c, g] = canvas2d(w, h);
    const out = g.createImageData(w, h);
    const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x - 1, y) + H(x - 1, y + 1));
        const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x, y - 1) + H(x + 1, y - 1));
        // 캔버스 y는 아래로, 텍스처 v는 위로 → dy 부호 반전
        let nx = -dx * strength;
        let ny = dy * strength;
        let nz = 1;
        const len = Math.hypot(nx, ny, nz);
        nx /= len; ny /= len; nz /= len;
        const i = (y * w + x) * 4;
        out.data[i] = (nx * 0.5 + 0.5) * 255;
        out.data[i + 1] = (ny * 0.5 + 0.5) * 255;
        out.data[i + 2] = (nz * 0.5 + 0.5) * 255;
        out.data[i + 3] = 255;
      }
    g.putImageData(out, 0, 0);
    return c;
  });
}

/** 캔버스 → THREE.CanvasTexture. color=true면 sRGB(색상 맵), false면 Linear(노멀·높이 등 데이터 맵) */
export function canvasTexture(canvas, { color = true, repeat, wrap = THREE.RepeatWrapping, anisotropy } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = wrap;
  if (repeat) t.repeat.set(repeat[0], repeat[1] ?? repeat[0]);
  if (anisotropy) t.anisotropy = anisotropy;
  return t;
}

/** 툰 셰이딩용 계단형 그라디언트 (Nearest 필터로 경계가 뚜렷하게) */
export function toonGradient(steps = 3) {
  const data = new Uint8Array(steps * 4);
  for (let i = 0; i < steps; i++) {
    const v = Math.round((steps === 1 ? 1 : 0.18 + (0.82 * i) / (steps - 1)) * 255);
    data.set([v, v, v, 255], i * 4);
  }
  const t = new THREE.DataTexture(data, steps, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

/** 캔버스를 박스 위에 작은 썸네일로 띄우기 (설명용) */
export function thumbnail(ctx, canvas, caption, style) {
  const el = document.createElement('figure');
  el.className = 'demo-thumb';
  const img = new Image();
  img.src = canvas.toDataURL();
  img.alt = caption;
  el.append(img);
  const cap = document.createElement('figcaption');
  cap.textContent = caption;
  el.append(cap);
  Object.assign(el.style, style);
  ctx.stage.appendChild(el);
  ctx.onDispose(() => el.remove());
  return el;
}
