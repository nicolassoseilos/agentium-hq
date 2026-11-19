// Procedural textures painted on canvas — wood, stone, leather, rugs, facades.
// Nothing is downloaded; everything is generated once at start-up.
import * as THREE from 'three';

export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function finish(c, { repeat = [1, 1], color = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const hex = (c) => new THREE.Color(c);
function shade(color, f) {
  const c = hex(color).multiplyScalar(f);
  return `rgb(${Math.min(255, c.r * 255) | 0},${Math.min(255, c.g * 255) | 0},${Math.min(255, c.b * 255) | 0})`;
}

/** Long-grain wood (furniture, panels). */
export function wood({ base = '#6b4429', seed = 3, size = 512, rings = 70, repeat = [1, 1], vertical = false } = {}) {
  const [c, g] = canvas(size, size);
  const r = rng(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < rings; i++) {
    const y = r() * size;
    const amp = 2 + r() * 8;
    const f = 0.004 + r() * 0.01;
    g.strokeStyle = shade(base, 0.7 + r() * 0.5);
    g.globalAlpha = 0.15 + r() * 0.35;
    g.lineWidth = 0.6 + r() * 2.4;
    g.beginPath();
    for (let x = 0; x <= size; x += 8) {
      const yy = y + Math.sin(x * f + i) * amp + Math.sin(x * f * 3.1) * amp * 0.3;
      x === 0 ? g.moveTo(x, yy) : g.lineTo(x, yy);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
  if (vertical) {
    const [c2, g2] = canvas(size, size);
    g2.translate(size / 2, size / 2);
    g2.rotate(Math.PI / 2);
    g2.drawImage(c, -size / 2, -size / 2);
    return finish(c2, { repeat });
  }
  return finish(c, { repeat });
}

/** Wide plank floor. */
export function planks({ base = '#b48a5e', seed = 7, rows = 8, repeat = [4, 4], gap = '#00000055', vary = 0.18 } = {}) {
  const size = 1024;
  const [c, g] = canvas(size, size);
  const r = rng(seed);
  const rowH = size / rows;
  for (let row = 0; row < rows; row++) {
    let x = -r() * size * 0.5;
    while (x < size) {
      const len = size * (0.35 + r() * 0.5);
      g.fillStyle = shade(base, 1 - vary / 2 + r() * vary);
      g.fillRect(x, row * rowH, len, rowH);
      // grain
      for (let k = 0; k < 14; k++) {
        g.strokeStyle = shade(base, 0.75 + r() * 0.4);
        g.globalAlpha = 0.18;
        g.lineWidth = 1 + r() * 2;
        const yy = row * rowH + r() * rowH;
        g.beginPath();
        g.moveTo(x, yy);
        g.bezierCurveTo(x + len * 0.3, yy + (r() - 0.5) * 8, x + len * 0.6, yy + (r() - 0.5) * 8, x + len, yy);
        g.stroke();
      }
      g.globalAlpha = 1;
      g.fillStyle = gap;
      g.fillRect(x, row * rowH, 2, rowH);
      x += len;
    }
    g.fillStyle = gap;
    g.fillRect(0, row * rowH, size, 2);
  }
  return finish(c, { repeat });
}

export function noiseFill(g, w, h, r, color, alpha, count, sizeMax = 3) {
  g.fillStyle = color;
  for (let i = 0; i < count; i++) {
    g.globalAlpha = alpha * r();
    const s = 0.5 + r() * sizeMax;
    g.fillRect(r() * w, r() * h, s, s);
  }
  g.globalAlpha = 1;
}

export function concrete({ base = '#8d8a85', seed = 11, repeat = [3, 3] } = {}) {
  const size = 512;
  const [c, g] = canvas(size, size);
  const r = rng(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 60; i++) {
    const x = r() * size, y = r() * size, rad = 30 + r() * 120;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, `rgba(${r() > 0.5 ? '255,255,255' : '0,0,0'},${0.04 + r() * 0.05})`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
  }
  noiseFill(g, size, size, r, '#000', 0.25, 9000, 2);
  noiseFill(g, size, size, r, '#fff', 0.15, 4000, 2);
  // form-tie holes
  g.fillStyle = 'rgba(0,0,0,.25)';
  for (let y = 64; y < size; y += 128) for (let x = 64; x < size; x += 128) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
  return finish(c, { repeat });
}

export function marble({ base = '#eceae6', vein = '#9a9690', seed = 5, repeat = [2, 2] } = {}) {
  const size = 1024;
  const [c, g] = canvas(size, size);
  const r = rng(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 40; i++) {
    const x = r() * size, y = r() * size, rad = 60 + r() * 200;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, `rgba(160,155,150,${0.05 + r() * 0.07})`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
  }
  for (let v = 0; v < 26; v++) {
    let x = r() * size, y = r() * size;
    let ang = r() * Math.PI * 2;
    g.strokeStyle = vein;
    g.globalAlpha = 0.15 + r() * 0.45;
    g.lineWidth = 0.4 + r() * 1.8;
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 60; s++) {
      ang += (r() - 0.5) * 0.7;
      x += Math.cos(ang) * 14;
      y += Math.sin(ang) * 14;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
  return finish(c, { repeat });
}

/** Grey mottled rug like the penthouse reference. */
export function mottledRug({ base = '#8e9196', dark = '#2a2d33', seed = 9, repeat = [1, 1] } = {}) {
  const size = 1024;
  const [c, g] = canvas(size, size);
  const r = rng(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 420; i++) {
    const x = r() * size, y = r() * size, rad = 8 + r() * 55;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, dark + 'cc');
    grd.addColorStop(0.6, dark + '55');
    grd.addColorStop(1, dark + '00');
    g.fillStyle = grd;
    g.beginPath();
    g.ellipse(x, y, rad, rad * (0.5 + r() * 0.6), r() * 3, 0, 7);
    g.fill();
  }
  noiseFill(g, size, size, r, '#fff', 0.12, 20000, 2);
  noiseFill(g, size, size, r, '#000', 0.18, 20000, 2);
  // bound edge
  g.strokeStyle = 'rgba(30,30,34,.7)';
  g.lineWidth = 14;
  g.strokeRect(7, 7, size - 14, size - 14);
  return finish(c, { repeat });
}

/** Persian-style rug, warm reds and blues (sunset office reference). */
export function persianRug({ seed = 21 } = {}) {
  const w = 1024, h = 680;
  const [c, g] = canvas(w, h);
  const r = rng(seed);
  g.fillStyle = '#7b3a2a';
  g.fillRect(0, 0, w, h);
  const borders = ['#2c3d5a', '#c49a5a', '#5a2a22', '#2c3d5a'];
  borders.forEach((col, i) => {
    g.strokeStyle = col;
    g.lineWidth = 22 - i * 4;
    const m = 18 + i * 22;
    g.strokeRect(m, m, w - m * 2, h - m * 2);
  });
  g.save();
  g.translate(w / 2, h / 2);
  for (let k = 6; k > 0; k--) {
    g.fillStyle = k % 2 ? '#2c3d5a' : '#c9a15e';
    g.beginPath();
    const R = k * 38;
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      const rr = a % 2 ? R * 0.75 : R;
      g.lineTo(Math.cos(ang) * rr * 1.4, Math.sin(ang) * rr);
    }
    g.closePath();
    g.fill();
  }
  g.restore();
  noiseFill(g, w, h, r, '#e8d2a8', 0.25, 9000, 3);
  noiseFill(g, w, h, r, '#000', 0.25, 9000, 3);
  return finish(c);
}

/** Diamond-quilted leather (vault walls, chairs). */
export function quilted({ base = '#1b1b1d', line = '#0a0a0b', cell = 64, repeat = [4, 4], stud = null } = {}) {
  const size = 512;
  const [c, g] = canvas(size, size);
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  // soft pillow shading per diamond
  for (let y = -cell; y < size + cell; y += cell) {
    for (let x = -cell; x < size + cell; x += cell) {
      const grd = g.createRadialGradient(x + cell / 2, y + cell / 2, 2, x + cell / 2, y + cell / 2, cell * 0.7);
      grd.addColorStop(0, 'rgba(255,255,255,.07)');
      grd.addColorStop(1, 'rgba(0,0,0,.18)');
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(x + cell / 2, y);
      g.lineTo(x + cell, y + cell / 2);
      g.lineTo(x + cell / 2, y + cell);
      g.lineTo(x, y + cell / 2);
      g.fill();
    }
  }
  g.strokeStyle = line;
  g.lineWidth = 3;
  for (let i = -size; i < size * 2; i += cell) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + size, size); g.stroke();
    g.beginPath(); g.moveTo(i, size); g.lineTo(i + size, 0); g.stroke();
  }
  if (stud) {
    g.fillStyle = stud;
    for (let y = 0; y <= size; y += cell / 2) for (let x = (y / (cell / 2)) % 2 ? cell / 2 : 0; x <= size; x += cell) {
      g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill();
    }
  }
  return finish(c, { repeat });
}

/** Button-tufted leather for armchairs. */
export function tufted({ base = '#2a2c33', repeat = [2, 2] } = {}) {
  return quilted({ base, line: shade(base, 0.55), cell: 96, repeat, stud: shade(base, 0.4) });
}

/** Building facade windows. lit=true returns an emissive mask. */
export function facade({ seed = 1, cols = 16, rows = 40, glass = '#5b6f86', frame = '#2d3440', litRatio = 0.4, lit = false, warm = true } = {}) {
  const w = 256, h = 512;
  const [c, g] = canvas(w, h);
  const r = rng(seed);
  g.fillStyle = lit ? '#000' : frame;
  g.fillRect(0, 0, w, h);
  const cw = w / cols, ch = h / rows;
  for (let y = 0; y < rows; y++) {
    const floorLit = r() < 0.85;
    for (let x = 0; x < cols; x++) {
      const px = x * cw + cw * 0.14, py = y * ch + ch * 0.16;
      if (lit) {
        if (floorLit && r() < litRatio) {
          const t = r();
          g.fillStyle = warm ? (t < 0.7 ? `hsl(${36 + r() * 10},${70 + r() * 20}%,${55 + r() * 20}%)` : `hsl(200,30%,${70 + r() * 15}%)`) : '#bfe8ff';
          g.globalAlpha = 0.55 + r() * 0.45;
          g.fillRect(px, py, cw * 0.72, ch * 0.66);
        }
      } else {
        const l = 0.85 + r() * 0.3;
        g.fillStyle = shade(glass, l);
        g.fillRect(px, py, cw * 0.72, ch * 0.66);
        g.fillStyle = 'rgba(255,255,255,.08)';
        g.fillRect(px, py, cw * 0.72, ch * 0.2);
      }
      g.globalAlpha = 1;
    }
  }
  return finish(c, { color: true, aniso: 4 });
}

/** Thin blueprint drawing sheet. */
export function blueprint({ seed = 2, paper = '#eef1f4', ink = '#3b5f8f' } = {}) {
  const w = 512, h = 360;
  const [c, g] = canvas(w, h);
  const r = rng(seed);
  g.fillStyle = paper;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = ink;
  g.globalAlpha = 0.18;
  g.lineWidth = 1;
  for (let x = 0; x < w; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  for (let y = 0; y < h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  g.globalAlpha = 0.85;
  g.lineWidth = 2;
  for (let i = 0; i < 14; i++) {
    const x = 30 + r() * (w - 140), y = 30 + r() * (h - 120);
    g.strokeRect(x, y, 40 + r() * 120, 30 + r() * 80);
  }
  g.lineWidth = 1;
  for (let i = 0; i < 30; i++) {
    g.beginPath();
    g.moveTo(30 + r() * (w - 60), 30 + r() * (h - 60));
    g.lineTo(30 + r() * (w - 60), 30 + r() * (h - 60));
    g.stroke();
  }
  g.strokeRect(w - 130, h - 60, 110, 44);
  return finish(c);
}

/** Small mosaic tiles for the pool. */
export function mosaic({ base = '#1e8fa6', seed = 4, repeat = [6, 6] } = {}) {
  const size = 256;
  const [c, g] = canvas(size, size);
  const r = rng(seed);
  const n = 16, s = size / n;
  g.fillStyle = '#d7eef0';
  g.fillRect(0, 0, size, size);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    g.fillStyle = shade(base, 0.8 + r() * 0.45);
    g.fillRect(x * s + 1, y * s + 1, s - 2, s - 2);
  }
  return finish(c, { repeat });
}

/** Tileable value-noise normal map for water ripples. */
export function waterNormal({ seed = 8 } = {}) {
  const size = 256;
  const [c, g] = canvas(size, size);
  const r = rng(seed);
  const hgt = new Float32Array(size * size);
  const waves = Array.from({ length: 14 }, () => ({ kx: Math.round(1 + r() * 6) * (r() < 0.5 ? -1 : 1), ky: Math.round(1 + r() * 6), p: r() * 6.28, a: 0.3 + r() }));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0;
    for (const w of waves) v += Math.sin(((x * w.kx + y * w.ky) / size) * Math.PI * 2 + w.p) * w.a;
    hgt[y * size + x] = v;
  }
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    const dx = hgt[y * size + ((x + 1) % size)] - hgt[y * size + ((x - 1 + size) % size)];
    const dy = hgt[((y + 1) % size) * size + x] - hgt[((y - 1 + size) % size) * size + x];
    const n = new THREE.Vector3(-dx * 0.6, -dy * 0.6, 1).normalize();
    img.data[i * 4] = (n.x * 0.5 + 0.5) * 255;
    img.data[i * 4 + 1] = (n.y * 0.5 + 0.5) * 255;
    img.data[i * 4 + 2] = (n.z * 0.5 + 0.5) * 255;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return finish(c, { color: false, repeat: [3, 3] });
}

/** Row of book spines for shelves. */
export function books({ seed = 6, palette = ['#6b2e2a', '#2f3d4f', '#4a5a3a', '#8a6a3a', '#d8cfc0', '#222', '#7a4f2f', '#3c2a4a'] } = {}) {
  const w = 512, h = 128;
  const [c, g] = canvas(w, h);
  const r = rng(seed);
  g.fillStyle = '#1a120c';
  g.fillRect(0, 0, w, h);
  let x = 0;
  while (x < w) {
    const bw = 8 + r() * 16;
    const bh = h * (0.7 + r() * 0.3);
    g.fillStyle = palette[(r() * palette.length) | 0];
    g.fillRect(x, h - bh, bw - 1, bh);
    g.fillStyle = 'rgba(255,255,255,.12)';
    g.fillRect(x + 2, h - bh + 8, bw - 5, 2);
    g.fillRect(x + 2, h - 16, bw - 5, 2);
    x += bw;
    if (r() < 0.06) x += 20;
  }
  return finish(c);
}

/** Text / logo texture. */
export function textTexture(lines, { w = 1024, h = 256, bg = null, color = '#c9a46a', font = '500 120px "Cormorant Garamond", serif', spacing = 0.3, align = 'center' } = {}) {
  const [c, g] = canvas(w, h);
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.fillStyle = color;
  g.textBaseline = 'middle';
  g.textAlign = align;
  const arr = Array.isArray(lines) ? lines : [lines];
  arr.forEach((ln, i) => {
    const f = typeof ln === 'object' ? ln.font : font;
    const t = typeof ln === 'object' ? ln.text : ln;
    g.font = f;
    if ('letterSpacing' in g) g.letterSpacing = `${spacing}em`;
    const y = (h / (arr.length + 1)) * (i + 1);
    g.fillText(t, align === 'center' ? w / 2 : 20, y);
  });
  const t = finish(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Soft radial glow sprite. */
export function glow(color = '#ffffff') {
  const [c, g] = canvas(128, 128);
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, color);
  grd.addColorStop(0.25, color + 'aa');
  grd.addColorStop(1, color + '00');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Fabric with soft weave. */
export function fabric({ base = '#d9cfbf', seed = 12, repeat = [2, 2] } = {}) {
  const size = 256;
  const [c, g] = canvas(size, size);
  const r = rng(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  g.globalAlpha = 0.08;
  for (let i = 0; i < size; i += 3) {
    g.fillStyle = r() > 0.5 ? '#fff' : '#000';
    g.fillRect(0, i, size, 1);
    g.fillRect(i, 0, 1, size);
  }
  g.globalAlpha = 1;
  noiseFill(g, size, size, r, '#000', 0.12, 3000, 1.5);
  return finish(c, { repeat });
}

/** Vertical slatted wood panelling (planning room wall, bar). */
export function slats({ base = '#5a3a24', seed = 14, count = 24, repeat = [1, 1] } = {}) {
  const size = 512;
  const [c, g] = canvas(size, size);
  const r = rng(seed);
  const sw = size / count;
  for (let i = 0; i < count; i++) {
    g.fillStyle = shade(base, 0.85 + r() * 0.3);
    g.fillRect(i * sw, 0, sw, size);
    for (let k = 0; k < 6; k++) {
      g.strokeStyle = shade(base, 0.7 + r() * 0.3);
      g.globalAlpha = 0.25;
      g.beginPath();
      const xx = i * sw + r() * sw;
      g.moveTo(xx, 0);
      g.bezierCurveTo(xx + 3, size * 0.3, xx - 3, size * 0.6, xx, size);
      g.stroke();
    }
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(0,0,0,.45)';
    g.fillRect(i * sw + sw - 2, 0, 2, size);
  }
  return finish(c, { repeat });
}
