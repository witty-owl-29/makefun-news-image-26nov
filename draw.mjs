// draw.mjs — "THE 26TH": a one-day world news front page for Thursday 26 November 2026.
// Draws the whole 1024x1024 image in pure Node (stdlib only): a tiny RGBA canvas,
// vector stroke type, flat-colour illustrations, and a hand-rolled PNG encoder.
// Run: node draw.mjs  -> writes entry.png beside this file.

import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

// ---------------------------------------------------------------- palette
const C = {
  paper:  [251, 245, 233], // warm ivory broadsheet
  paper2: [244, 236, 216], // slightly deeper ivory for panels
  ink:    [26, 36, 51],    // deep navy ink
  inkSoft:[58, 68, 86],
  crimson:[164, 19, 60],   // masthead red
  crimsonD:[122, 12, 44],
  gold:   [192, 138, 44],
  goldL:  [224, 178, 92],
  forest: [30, 91, 74],
  sage:   [122, 155, 126],
  land:   [220, 207, 175], // map land
  sea:    [214, 231, 240],
  sky:    [186, 214, 235],
  skyD:   [140, 180, 214],
  sand:   [242, 227, 198],
  rose:   [243, 217, 217],
  flame:  [232, 96, 32],
  flameY: [245, 178, 44],
  white:  [255, 255, 255],
  black:  [0, 0, 0],
};

// ---------------------------------------------------------------- canvas
const W = 1024, H = 1024;
const buf = Buffer.alloc(W * H * 4);
function px(x, y, c, a = 1) {
  x = x | 0; y = y | 0;
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  if (a >= 1) { buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255; return; }
  buf[i]     = Math.round(buf[i] * (1 - a) + c[0] * a);
  buf[i + 1] = Math.round(buf[i + 1] * (1 - a) + c[1] * a);
  buf[i + 2] = Math.round(buf[i + 2] * (1 - a) + c[2] * a);
  buf[i + 3] = 255;
}
function rect(x, y, w, h, c, a = 1) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px(i, j, c, a);
}
function vgrad(x, y, w, h, cTop, cBot) {
  for (let j = 0; j < h; j++) {
    const t = h <= 1 ? 0 : j / (h - 1);
    const c = [0, 1, 2].map(k => Math.round(cTop[k] + (cBot[k] - cTop[k]) * t));
    rect(x, y + j, w, 1, c);
  }
}
function disc(cx, cy, r, c, a = 1) {
  cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
    for (let i = -dx; i <= dx; i++) px(cx + i, cy + dy, c, a);
  }
}
function ring(cx, cy, r, w, c) {
  for (let k = 0; k < w; k++) {
    const rr = r - k;
    for (let a = 0; a < 360; a += 1) {
      const t = a * Math.PI / 180;
      px(cx + rr * Math.cos(t), cy + rr * Math.sin(t), c);
    }
  }
}
function line(x0, y0, x1, y1, w, c) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(len * 2));
  const r = Math.max(0.6, w / 2);
  for (let s = 0; s <= steps; s++) {
    disc(x0 + dx * s / steps, y0 + dy * s / steps, r, c);
  }
}
function polyline(pts, w, c) {
  for (let i = 0; i < pts.length - 1; i++) line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w, c);
}
// scanline polygon fill
function poly(pts, c, a = 1) {
  let minY = Infinity, maxY = -Infinity;
  for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  minY = Math.max(0, Math.ceil(minY)); maxY = Math.min(H - 1, Math.floor(maxY));
  for (let y = minY; y <= maxY; y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        xs.push(x0 + (y - y0) * (x1 - x0) / (y1 - y0));
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) px(x, y, c, a);
    }
  }
}
function ellipse(cx, cy, rx, ry, c, a = 1) {
  for (let dy = -ry; dy <= ry; dy++) {
    const dx = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry))));
    for (let i = -dx; i <= dx; i++) px(cx + i, cy + dy, c, a);
  }
}
function ellipsePts(cx, cy, rx, ry, n = 28) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = i / n * Math.PI * 2;
    pts.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
  }
  return pts;
}
function rrect(x, y, w, h, r, c, a = 1) {
  rect(x + r, y, w - 2 * r, h, c, a);
  rect(x, y + r, w, h - 2 * r, c, a);
  disc(x + r, y + r, r, c, a); disc(x + w - r, y + r, r, c, a);
  disc(x + r, y + h - r, r, c, a); disc(x + w - r, y + h - r, r, c, a);
}
function shadow(x, y, w, h, r = 4) {
  rrect(x + 3, y + 4, w, h, r, [0, 0, 0], 0.10);
}
// ---------------------------------------------------------------- PNG encoder
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
function crc32(b) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}
function encodePNG() {
  const raw = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 4)] = 0; // filter: none
    buf.copy(raw, y * (1 + W * 4) + 1, y * W * 4, (y + 1) * W * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- stroke font
// A clean sans-style stroke font I drew on a 5-wide x 7-tall grid (y down).
// Every glyph is a list of strokes; each stroke is a list of [x, y] points.
// Single-point strokes render as round dots. All type in the image is caps.
const FONT = {
  A: [[[0, 7], [2.5, 0], [5, 7]], [[1.3, 4.6], [3.7, 4.6]]],
  B: [[[0, 0], [0, 7]], [[0, 0], [3, 0], [5, 1.5], [5, 2.5], [3, 3.5], [0, 3.5]], [[0, 3.5], [3, 3.5], [5, 4.5], [5, 6], [3, 7], [0, 7]]],
  C: [[[5, 1.5], [3.5, 0], [1.5, 0], [0, 1.5], [0, 5.5], [1.5, 7], [3.5, 7], [5, 5.5]]],
  D: [[[0, 0], [0, 7], [3, 7], [5, 5], [5, 2], [3, 0], [0, 0]]],
  E: [[[5, 0], [0, 0], [0, 7], [5, 7]], [[0, 3.5], [3.5, 3.5]]],
  F: [[[0, 0], [0, 7]], [[0, 0], [5, 0]], [[0, 3.5], [3.5, 3.5]]],
  G: [[[5, 1.5], [3.5, 0], [1.5, 0], [0, 1.5], [0, 5.5], [1.5, 7], [3.5, 7], [5, 5.5], [5, 3.5], [3, 3.5]]],
  H: [[[0, 0], [0, 7]], [[5, 0], [5, 7]], [[0, 3.5], [5, 3.5]]],
  I: [[[2.5, 0], [2.5, 7]], [[0.5, 0], [4.5, 0]], [[0.5, 7], [4.5, 7]]],
  J: [[[2, 0], [5, 0], [5, 5.5], [3.5, 7], [1.5, 7], [0.5, 6]]],
  K: [[[0, 0], [0, 7]], [[5, 0], [1, 3.5], [5, 7]]],
  L: [[[0, 0], [0, 7], [5, 7]]],
  M: [[[0, 7], [0, 0], [2.5, 4], [5, 0], [5, 7]]],
  N: [[[0, 7], [0, 0], [5, 7], [5, 0]]],
  O: [[[1.5, 0], [3.5, 0], [5, 1.5], [5, 5.5], [3.5, 7], [1.5, 7], [0, 5.5], [0, 1.5], [1.5, 0]]],
  P: [[[0, 7], [0, 0], [3, 0], [5, 1.5], [5, 2.5], [3, 3.5], [0, 3.5]]],
  Q: [[[1.5, 0], [3.5, 0], [5, 1.5], [5, 5.5], [3.5, 7], [1.5, 7], [0, 5.5], [0, 1.5], [1.5, 0]], [[3.5, 5], [5, 7]]],
  R: [[[0, 7], [0, 0], [3, 0], [5, 1.5], [5, 2.5], [3, 3.5], [0, 3.5]], [[2.5, 3.5], [5, 7]]],
  S: [[[4.5, 1], [3, 0], [1.5, 0], [0.5, 1], [0.5, 2.5], [1.5, 3.5], [3.5, 3.5], [4.5, 4.5], [4.5, 6], [3, 7], [1.5, 7], [0.5, 6]]],
  T: [[[0, 0], [5, 0]], [[2.5, 0], [2.5, 7]]],
  U: [[[0, 0], [0, 5.5], [1.5, 7], [3.5, 7], [5, 5.5], [5, 0]]],
  V: [[[0, 0], [2.5, 7], [5, 0]]],
  W: [[[0, 0], [1.2, 7], [2.5, 3.5], [3.8, 7], [5, 0]]],
  X: [[[0, 0], [5, 7]], [[5, 0], [0, 7]]],
  Y: [[[0, 0], [2.5, 3.5], [5, 0]], [[2.5, 3.5], [2.5, 7]]],
  Z: [[[0, 0], [5, 0], [0, 7], [5, 7]]],
  '0': [[[1.5, 0], [3.5, 0], [5, 1.5], [5, 5.5], [3.5, 7], [1.5, 7], [0, 5.5], [0, 1.5], [1.5, 0]], [[1.5, 5.5], [3.5, 1.5]]],
  '1': [[[1, 1.5], [2.5, 0], [2.5, 7]], [[0.5, 7], [4.5, 7]]],
  '2': [[[0.5, 1.5], [1.5, 0], [3.5, 0], [4.5, 1.5], [4.5, 2.5], [0.5, 7], [4.5, 7]]],
  '3': [[[0.5, 0], [3.5, 0], [4.5, 1], [4.5, 2.5], [3, 3.5], [4.5, 4.5], [4.5, 6], [3.5, 7], [0.5, 7]]],
  '4': [[[3.5, 0], [3.5, 7]], [[0, 5], [5, 5]], [[0.5, 4.5], [3.5, 0]]],
  '5': [[[5, 0], [0, 0], [0, 3.5], [3, 3.5], [5, 5], [5, 6], [3.5, 7], [1, 7], [0, 6]]],
  '6': [[[5, 1], [3.5, 0], [1.5, 0], [0, 1.5], [0, 5.5], [1.5, 7], [3.5, 7], [5, 5], [5, 3.5], [3, 3.5], [1, 3.5]]],
  '7': [[[0, 0], [5, 0], [2, 7]]],
  '8': [[[1.5, 0], [3.5, 0], [5, 1.5], [5, 2.5], [3.5, 3.5], [1.5, 3.5], [0, 2.5], [0, 1.5], [1.5, 0]], [[1.5, 3.5], [3.5, 3.5], [5, 4.5], [5, 5.5], [3.5, 7], [1.5, 7], [0, 5.5], [0, 4.5], [1.5, 3.5]]],
  '9': [[[0, 5.5], [0, 1.5], [1.5, 0], [3.5, 0], [5, 1.5], [5, 5.5], [3.5, 7], [1.5, 7], [0, 6]], [[0, 3.5], [5, 3.5]]],
  '.': [[[2.5, 6.8]]],
  ',': [[[2.5, 6.2], [2, 8]]],
  ':': [[[2.5, 2]], [[2.5, 5.5]]],
  ';': [[[2.5, 2]], [[2.5, 5.5], [2, 7.5]]],
  '!': [[[2.5, 0], [2.5, 4.5]], [[2.5, 6.5]]],
  '?': [[[1, 1.5], [2, 0], [3.5, 0], [4.5, 1], [4.5, 2.5], [3, 3.5], [2.5, 4.5]], [[2.5, 6.5]]],
  "'": [[[2.5, 0], [2, 2]]],
  '"': [[[1.5, 0], [1, 1.8]], [[3.5, 0], [3, 1.8]]],
  '-': [[[0, 3.5], [5, 3.5]]],
  '(': [[[4, 0], [2.5, 1], [2, 3.5], [2.5, 6], [4, 7]]],
  ')': [[[1, 0], [2.5, 1], [3, 3.5], [2.5, 6], [1, 7]]],
  '/': [[[5, 0], [0, 7]]],
  '%': [[[5, 0], [0, 7]], [[1.2, 1.2]], [[3.8, 5.8]]],
  '+': [[[2.5, 1], [2.5, 6]], [[0, 3.5], [5, 3.5]]],
  '=': [[[0, 2], [5, 2]], [[0, 5], [5, 5]]],
  '$': [[[4, 1], [3, 0], [1.5, 0], [0.5, 1], [0.5, 2.5], [2, 3.5], [4, 3.5], [4.5, 4.5], [4.5, 6], [3, 7], [1.5, 7], [0.5, 6]], [[2.5, -0.6], [2.5, 7.6]]],
  '·': [[[2.5, 3.5]]],
  '—': [[[0, 3.5], [5, 3.5]]],
};
const ADV = { I: 3.4, J: 3.8, L: 4.2, T: 4.8, M: 5.9, W: 5.9, ' ': 3.2, '.': 3.0, ',': 3.0, ':': 3.0, ';': 3.0, '!': 3.4, "'": 2.6, '"': 4.4, '-': 4.2, '—': 5.6, '(': 3.6, ')': 3.6, '/': 4.6, '%': 5.9, '+': 5.2, '=': 5.2, '$': 5.5, '·': 3.0 };
function adv(ch) { return (ADV[ch] ?? 5.5); }
function textWidth(s, size) {
  const u = size / 7;
  let w = 0;
  for (const ch of s) w += adv(ch) * u;
  return w - (s.length ? 0.6 * u : 0);
}
function drawGlyph(ch, x, y, size, c) {
  const g = FONT[ch];
  if (!g) return;
  const u = size / 7;
  const sw = Math.max(1.1, size * 0.17);
  for (const stroke of g) {
    if (stroke.length === 1) { disc(x + stroke[0][0] * u, y + stroke[0][1] * u, sw * 0.62, c); continue; }
    const pts = stroke.map(p => [x + p[0] * u, y + p[1] * u]);
    polyline(pts, sw, c);
  }
}
// Draw one line of text; returns width drawn. y = top of cap height.
function drawText(s, x, y, size, c, align = 'left') {
  s = s.toUpperCase();
  const w = textWidth(s, size);
  let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  for (const ch of s) {
    drawGlyph(ch, cx, y, size, c);
    cx += adv(ch) * (size / 7);
  }
  return w;
}
// Wrap text to maxWidth; returns array of lines.
function wrap(s, size, maxWidth) {
  const words = s.toUpperCase().split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (textWidth(t, size) <= maxWidth || !cur) cur = t;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}
// Draw wrapped text in a box; returns total height used.
function drawPara(s, x, y, size, c, maxWidth, lh = null) {
  const lines = wrap(s, size, maxWidth);
  const step = lh ?? Math.round(size * 1.32);
  lines.forEach((ln, i) => drawText(ln, x, y + i * step, size, c));
  return lines.length * step;
}

// ---------------------------------------------------------------- illustrations
// Every picture is drawn from simple flat shapes — no copied artwork.
function flameShape(x, y, w, h, c1, c2) {
  // teardrop flame: outer in c1, inner in c2
  poly([[x + w * 0.5, y], [x + w * 0.82, y + h * 0.42], [x + w * 0.95, y + h * 0.62],
        [x + w * 0.78, y + h], [x + w * 0.22, y + h], [x + w * 0.05, y + h * 0.62],
        [x + w * 0.18, y + h * 0.42]], c1);
  poly([[x + w * 0.5, y + h * 0.35], [x + w * 0.68, y + h * 0.6], [x + w * 0.62, y + h * 0.85],
        [x + w * 0.38, y + h * 0.85], [x + w * 0.32, y + h * 0.6]], c2);
}
function burst(x, y, r, c) {
  // explosion star: 8 spikes
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push([x + rr * Math.cos(a), y + rr * Math.sin(a)]);
  }
  poly(pts, c);
  disc(x, y, r * 0.32, C.white);
}
function iconTruck(x, y, s) {
  rect(x, y + s * 0.42, s * 0.62, s * 0.4, C.crimson);
  rect(x + s * 0.62, y + s * 0.52, s * 0.26, s * 0.3, C.ink);
  rect(x + s * 0.66, y + s * 0.56, s * 0.14, s * 0.12, C.sky);
  disc(x + s * 0.2, y + s * 0.86, s * 0.09, C.ink);
  disc(x + s * 0.48, y + s * 0.86, s * 0.09, C.ink);
  disc(x + s * 0.76, y + s * 0.86, s * 0.09, C.ink);
  flameShape(x + s * 0.18, y - s * 0.02, s * 0.3, s * 0.4, C.flame, C.flameY);
}
function iconAtom(x, y, s) {
  disc(x + s / 2, y + s / 2, s * 0.1, C.crimson);
  const e1 = ellipsePts(x + s / 2, y + s / 2, s * 0.42, s * 0.16, 24);
  const e2 = ellipsePts(x + s / 2, y + s / 2, s * 0.42, s * 0.16, 24).map(p => {
    const a = Math.PI / 3;
    const dx = p[0] - (x + s / 2), dy = p[1] - (y + s / 2);
    return [x + s / 2 + dx * Math.cos(a) - dy * Math.sin(a), y + s / 2 + dx * Math.sin(a) + dy * Math.cos(a)];
  });
  const e3 = ellipsePts(x + s / 2, y + s / 2, s * 0.42, s * 0.16, 24).map(p => {
    const a = -Math.PI / 3;
    const dx = p[0] - (x + s / 2), dy = p[1] - (y + s / 2);
    return [x + s / 2 + dx * Math.cos(a) - dy * Math.sin(a), y + s / 2 + dx * Math.sin(a) + dy * Math.cos(a)];
  });
  polyline(e1, Math.max(1.5, s * 0.045), C.ink);
  polyline(e2, Math.max(1.5, s * 0.045), C.ink);
  polyline(e3, Math.max(1.5, s * 0.045), C.ink);
}
function iconJet(x, y, s) {
  poly([[x + s * 0.95, y + s * 0.5], [x + s * 0.7, y + s * 0.42], [x + s * 0.55, y + s * 0.18],
        [x + s * 0.42, y + s * 0.42], [x + s * 0.12, y + s * 0.38], [x + s * 0.02, y + s * 0.5],
        [x + s * 0.12, y + s * 0.62], [x + s * 0.42, y + s * 0.58], [x + s * 0.55, y + s * 0.82],
        [x + s * 0.7, y + s * 0.58]], C.ink);
  burst(x + s * 0.82, y + s * 0.22, s * 0.16, C.flame);
}
function iconStation(x, y, s) {
  rect(x + s * 0.08, y + s * 0.42, s * 0.3, s * 0.16, C.gold);
  rect(x + s * 0.62, y + s * 0.42, s * 0.3, s * 0.16, C.gold);
  rect(x + s * 0.4, y + s * 0.34, s * 0.2, s * 0.32, C.ink);
  rect(x + s * 0.44, y + s * 0.3, s * 0.12, s * 0.08, C.crimson);
  disc(x + s * 0.5, y + s * 0.2, s * 0.04, C.flameY);
  disc(x + s * 0.2, y + s * 0.16, s * 0.03, C.white);
  disc(x + s * 0.82, y + s * 0.26, s * 0.03, C.white);
}
function iconSatellite(x, y, s) {
  rect(x + s * 0.38, y + s * 0.4, s * 0.24, s * 0.2, C.ink);
  rect(x + s * 0.06, y + s * 0.42, s * 0.28, s * 0.16, C.gold);
  rect(x + s * 0.66, y + s * 0.42, s * 0.28, s * 0.16, C.gold);
  line(x + s * 0.5, y + s * 0.4, x + s * 0.62, y + s * 0.14, Math.max(1.5, s * 0.04), C.ink);
  disc(x + s * 0.64, y + s * 0.12, s * 0.05, C.crimson);
  line(x + s * 0.2, y + s * 0.75, x + s * 0.38, y + s * 0.62, Math.max(1.5, s * 0.04), C.inkSoft);
  line(x + s * 0.34, y + s * 0.82, x + s * 0.44, y + s * 0.66, Math.max(1.5, s * 0.04), C.inkSoft);
}
function iconGavel(x, y, s) {
  poly([[x + s * 0.15, y + s * 0.18], [x + s * 0.55, y + s * 0.05], [x + s * 0.62, y + s * 0.18], [x + s * 0.22, y + s * 0.31]], C.ink);
  line(x + s * 0.45, y + s * 0.3, x + s * 0.78, y + s * 0.72, Math.max(2, s * 0.07), C.gold);
  rect(x + s * 0.1, y + s * 0.78, s * 0.8, s * 0.1, C.crimson);
}
function iconChartDown(x, y, s) {
  line(x + s * 0.1, y + s * 0.9, x + s * 0.1, y + s * 0.1, Math.max(1.5, s * 0.04), C.inkSoft);
  line(x + s * 0.1, y + s * 0.9, x + s * 0.92, y + s * 0.9, Math.max(1.5, s * 0.04), C.inkSoft);
  polyline([[x + s * 0.14, y + s * 0.2], [x + s * 0.4, y + s * 0.42], [x + s * 0.58, y + s * 0.34], [x + s * 0.86, y + s * 0.72]], Math.max(2, s * 0.06), C.crimson);
  poly([[x + s * 0.86, y + s * 0.72], [x + s * 0.68, y + s * 0.66], [x + s * 0.8, y + s * 0.84]], C.crimson);
}
function iconBoat(x, y, s) {
  poly([[x + s * 0.08, y + s * 0.5], [x + s * 0.92, y + s * 0.5], [x + s * 0.78, y + s * 0.74], [x + s * 0.22, y + s * 0.74]], C.crimson);
  line(x + s * 0.5, y + s * 0.5, x + s * 0.5, y + s * 0.14, Math.max(1.5, s * 0.04), C.ink);
  poly([[x + s * 0.52, y + s * 0.16], [x + s * 0.52, y + s * 0.44], [x + s * 0.8, y + s * 0.44]], C.gold);
  for (let i = 0; i < 3; i++) {
    const yy = y + s * (0.84 + i * 0.05);
    polyline([[x + s * 0.08, yy], [x + s * 0.3, yy - s * 0.03], [x + s * 0.55, yy], [x + s * 0.78, yy - s * 0.03], [x + s * 0.94, yy]], Math.max(1.5, s * 0.035), C.skyD);
  }
}
function iconPlane(x, y, s) {
  poly([[x + s * 0.92, y + s * 0.42], [x + s * 0.68, y + s * 0.36], [x + s * 0.52, y + s * 0.14],
        [x + s * 0.4, y + s * 0.36], [x + s * 0.12, y + s * 0.32], [x + s * 0.04, y + s * 0.44],
        [x + s * 0.12, y + s * 0.56], [x + s * 0.4, y + s * 0.52], [x + s * 0.52, y + s * 0.76],
        [x + s * 0.68, y + s * 0.48]], C.ink);
  line(x + s * 0.1, y + s * 0.82, x + s * 0.9, y + s * 0.82, Math.max(1.5, s * 0.04), C.crimson);
}
function iconBars(x, y, s) {
  const hs = [0.35, 0.55, 0.42, 0.75];
  hs.forEach((h, i) => rect(x + s * (0.1 + i * 0.22), y + s * (0.9 - h), s * 0.14, s * h, i === 3 ? C.forest : C.gold));
  line(x + s * 0.08, y + s * 0.9, x + s * 0.92, y + s * 0.9, Math.max(1.5, s * 0.04), C.ink);
}
function iconBall(x, y, s) {
  disc(x + s / 2, y + s / 2, s * 0.44, C.white);
  ring(x + s / 2, y + s / 2, s * 0.44, Math.max(1.5, s * 0.04), C.ink);
  poly([[x + s * 0.5, y + s * 0.36], [x + s * 0.62, y + s * 0.46], [x + s * 0.57, y + s * 0.6], [x + s * 0.43, y + s * 0.6], [x + s * 0.38, y + s * 0.46]], C.ink);
  line(x + s * 0.5, y + s * 0.36, x + s * 0.5, y + s * 0.1, Math.max(1.5, s * 0.04), C.ink);
  line(x + s * 0.62, y + s * 0.46, x + s * 0.86, y + s * 0.4, Math.max(1.5, s * 0.04), C.ink);
  line(x + s * 0.38, y + s * 0.46, x + s * 0.14, y + s * 0.4, Math.max(1.5, s * 0.04), C.ink);
}
function iconGlobe(x, y, s) {
  disc(x + s / 2, y + s / 2, s * 0.44, C.sea);
  ring(x + s / 2, y + s / 2, s * 0.44, Math.max(1.5, s * 0.04), C.ink);
  ellipse(x + s / 2, y + s / 2, s * 0.2, s * 0.44, C.land);
  line(x + s * 0.06, y + s / 2, x + s * 0.94, y + s / 2, Math.max(1.2, s * 0.03), C.inkSoft);
}
function iconChip(x, y, s) {
  rect(x + s * 0.28, y + s * 0.28, s * 0.44, s * 0.44, C.ink);
  rect(x + s * 0.4, y + s * 0.4, s * 0.2, s * 0.2, C.gold);
  for (let i = 0; i < 3; i++) {
    const o = s * (0.34 + i * 0.16);
    line(x + o, y + s * 0.12, x + o, y + s * 0.28, Math.max(1.5, s * 0.04), C.ink);
    line(x + o, y + s * 0.72, x + o, y + s * 0.88, Math.max(1.5, s * 0.04), C.ink);
    line(x + s * 0.12, y + o, x + s * 0.28, y + o, Math.max(1.5, s * 0.04), C.ink);
    line(x + s * 0.72, y + o, x + s * 0.88, y + o, Math.max(1.5, s * 0.04), C.ink);
  }
}
function iconBolt(x, y, s) {
  poly([[x + s * 0.55, y + s * 0.05], [x + s * 0.2, y + s * 0.55], [x + s * 0.45, y + s * 0.55],
        [x + s * 0.4, y + s * 0.95], [x + s * 0.8, y + s * 0.42], [x + s * 0.55, y + s * 0.42]], C.flameY);
}
function iconDrop(x, y, s) {
  poly([[x + s * 0.5, y + s * 0.06], [x + s * 0.86, y + s * 0.55], [x + s * 0.78, y + s * 0.78],
        [x + s * 0.5, y + s * 0.94], [x + s * 0.22, y + s * 0.78], [x + s * 0.14, y + s * 0.55]], C.ink);
}
function iconCandle(x, y, s) {
  rect(x + s * 0.42, y + s * 0.34, s * 0.16, s * 0.5, C.white);
  rect(x + s * 0.3, y + s * 0.84, s * 0.4, s * 0.08, C.gold);
  flameShape(x + s * 0.4, y + s * 0.04, s * 0.2, s * 0.28, C.flame, C.flameY);
}
function iconDoc(x, y, s) {
  poly([[x + s * 0.2, y + s * 0.06], [x + s * 0.68, y + s * 0.06], [x + s * 0.82, y + s * 0.2],
        [x + s * 0.82, y + s * 0.94], [x + s * 0.2, y + s * 0.94]], C.white);
  polyline([[x + s * 0.2, y + s * 0.06], [x + s * 0.68, y + s * 0.06], [x + s * 0.82, y + s * 0.2], [x + s * 0.82, y + s * 0.94], [x + s * 0.2, y + s * 0.94], [x + s * 0.2, y + s * 0.06]], Math.max(1.5, s * 0.045), C.ink);
  for (let i = 0; i < 3; i++) line(x + s * 0.32, y + s * (0.32 + i * 0.18), x + s * 0.7, y + s * (0.32 + i * 0.18), Math.max(1.2, s * 0.035), C.inkSoft);
}
function iconMega(x, y, s) {
  poly([[x + s * 0.1, y + s * 0.42], [x + s * 0.42, y + s * 0.28], [x + s * 0.42, y + s * 0.68], [x + s * 0.1, y + s * 0.58]], C.crimson);
  poly([[x + s * 0.42, y + s * 0.28], [x + s * 0.88, y + s * 0.12], [x + s * 0.88, y + s * 0.84], [x + s * 0.42, y + s * 0.68]], C.gold);
  line(x + s * 0.3, y + s * 0.68, x + s * 0.3, y + s * 0.88, Math.max(1.5, s * 0.05), C.ink);
}
function iconStar(x, y, s) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? s * 0.46 : s * 0.2;
    pts.push([x + s / 2 + rr * Math.cos(a), y + s / 2 + rr * Math.sin(a)]);
  }
  poly(pts, C.gold);
}
function iconBuilding(x, y, s) {
  rect(x + s * 0.14, y + s * 0.2, s * 0.32, s * 0.68, C.ink);
  rect(x + s * 0.54, y + s * 0.38, s * 0.32, s * 0.5, C.inkSoft);
  for (let r = 0; r < 3; r++) for (let cI = 0; cI < 2; cI++)
    rect(x + s * (0.2 + cI * 0.14), y + s * (0.3 + r * 0.18), s * 0.06, s * 0.08, C.flameY);
}
// tiny brief icons (12px): simple category glyphs
const BRIEF_ICONS = {
  flame: (x, y, s) => flameShape(x, y, s, s, C.flame, C.flameY),
  gavel: (x, y, s) => iconGavel(x, y, s),
  chart: (x, y, s) => iconChartDown(x, y, s),
  globe: (x, y, s) => iconGlobe(x, y, s),
  rocket: (x, y, s) => iconStation(x, y, s),
  chip: (x, y, s) => iconChip(x, y, s),
  plane: (x, y, s) => iconPlane(x, y, s),
  boat: (x, y, s) => iconBoat(x, y, s),
  bolt: (x, y, s) => iconBolt(x, y, s),
  drop: (x, y, s) => iconDrop(x, y, s),
  candle: (x, y, s) => iconCandle(x, y, s),
  doc: (x, y, s) => iconDoc(x, y, s),
  mega: (x, y, s) => iconMega(x, y, s),
  star: (x, y, s) => iconStar(x, y, s),
  building: (x, y, s) => iconBuilding(x, y, s),
  atom: (x, y, s) => iconAtom(x, y, s),
  jet: (x, y, s) => iconJet(x, y, s),
  sat: (x, y, s) => iconSatellite(x, y, s),
  bars: (x, y, s) => iconBars(x, y, s),
  ball: (x, y, s) => iconBall(x, y, s),
  truck: (x, y, s) => iconTruck(x, y, s),
};

// ---------------------------------------------------------------- lead scenes
function sceneTariffs(x, y, w, h) {
  vgrad(x, y, w, h, C.sky, [226, 238, 246]);
  disc(x + w * 0.82, y + h * 0.2, h * 0.13, C.flameY);
  // sea
  rect(x, y + h * 0.72, w, h * 0.28, [58, 110, 150]);
  polyline([[x, y + h * 0.72], [x + w * 0.2, y + h * 0.68], [x + w * 0.45, y + h * 0.74], [x + w * 0.7, y + h * 0.69], [x + w, y + h * 0.73]], 2, [120, 170, 200]);
  // ship hull
  poly([[x + w * 0.06, y + h * 0.62], [x + w * 0.94, y + h * 0.62], [x + w * 0.84, y + h * 0.82], [x + w * 0.16, y + h * 0.82]], C.ink);
  // containers
  rect(x + w * 0.14, y + h * 0.34, w * 0.2, h * 0.28, C.crimson);
  rect(x + w * 0.36, y + h * 0.34, w * 0.2, h * 0.28, C.gold);
  rect(x + w * 0.58, y + h * 0.34, w * 0.2, h * 0.28, C.forest);
  rect(x + w * 0.25, y + h * 0.12, w * 0.2, h * 0.22, C.white);
  rect(x + w * 0.47, y + h * 0.12, w * 0.2, h * 0.22, C.crimson);
  // container ribs
  for (let i = 0; i < 4; i++) {
    line(x + w * (0.18 + i * 0.05), y + h * 0.36, x + w * (0.18 + i * 0.05), y + h * 0.6, 1.5, [255, 255, 255]);
    line(x + w * (0.40 + i * 0.05), y + h * 0.36, x + w * (0.40 + i * 0.05), y + h * 0.6, 1.5, [255, 255, 255]);
    line(x + w * (0.62 + i * 0.05), y + h * 0.36, x + w * (0.62 + i * 0.05), y + h * 0.6, 1.5, [255, 255, 255]);
  }
  // big % badge
  disc(x + w * 0.86, y + h * 0.24, h * 0.2, C.crimson);
  ring(x + w * 0.86, y + h * 0.24, h * 0.2, 3, C.white);
  drawText('%', x + w * 0.86, y + h * 0.24 - h * 0.115, h * 0.23, C.white, 'center');
}
function sceneRefinery(x, y, w, h) {
  vgrad(x, y, w, h, [250, 214, 170], [238, 170, 120]);
  // ground
  rect(x, y + h * 0.78, w, h * 0.22, [74, 62, 52]);
  // towers
  rect(x + w * 0.1, y + h * 0.3, w * 0.12, h * 0.5, C.ink);
  rect(x + w * 0.26, y + h * 0.18, w * 0.12, h * 0.62, C.ink);
  rect(x + w * 0.42, y + h * 0.38, w * 0.16, h * 0.42, C.inkSoft);
  // flare stack
  rect(x + w * 0.62, y + h * 0.1, w * 0.05, h * 0.7, C.ink);
  flameShape(x + w * 0.6, y + h * 0.0, w * 0.09, h * 0.16, C.flame, C.flameY);
  // storage tanks
  ellipse(x + w * 0.82, y + h * 0.68, w * 0.09, h * 0.05, C.white);
  rect(x + w * 0.73, y + h * 0.68, w * 0.18, h * 0.12, C.white);
  // pipes
  line(x + w * 0.1, y + h * 0.55, x + w * 0.62, y + h * 0.55, 3, C.gold);
  line(x + w * 0.26, y + h * 0.42, x + w * 0.62, y + h * 0.42, 3, C.gold);
  // smoke puffs
  disc(x + w * 0.2, y + h * 0.16, h * 0.05, [255, 255, 255], 0.75);
  disc(x + w * 0.32, y + h * 0.1, h * 0.06, [255, 255, 255], 0.6);
  disc(x + w * 0.14, y + h * 0.08, h * 0.04, [255, 255, 255], 0.5);
  // big flame at base right
  flameShape(x + w * 0.66, y + h * 0.62, w * 0.1, h * 0.18, C.flame, C.flameY);
}
function sceneStorm(x, y, w, h) {
  vgrad(x, y, w, h, [52, 68, 92], [120, 140, 165]);
  // rain
  for (let i = 0; i < 14; i++) {
    const rx = x + w * (0.04 + i * 0.07);
    const ry = y + h * (0.12 + (i % 4) * 0.16);
    line(rx, ry, rx - w * 0.02, ry + h * 0.1, 2, [200, 220, 235]);
  }
  // storm clouds
  ellipse(x + w * 0.28, y + h * 0.16, w * 0.2, h * 0.09, [38, 50, 68]);
  ellipse(x + w * 0.62, y + h * 0.12, w * 0.22, h * 0.1, [38, 50, 68]);
  ellipse(x + w * 0.85, y + h * 0.22, w * 0.14, h * 0.07, [52, 68, 92]);
  // parade balloon: big golden balloon with a crimson centre stripe
  ellipse(x + w * 0.5, y + h * 0.52, w * 0.2, h * 0.2, C.flameY);
  ellipse(x + w * 0.5, y + h * 0.52, w * 0.07, h * 0.2, C.crimson);
  ellipse(x + w * 0.43, y + h * 0.44, w * 0.05, h * 0.07, C.white);
  // balloon strings
  line(x + w * 0.5, y + h * 0.72, x + w * 0.42, y + h * 0.92, 2, C.white);
  line(x + w * 0.5, y + h * 0.72, x + w * 0.58, y + h * 0.92, 2, C.white);
  // street
  rect(x, y + h * 0.9, w, h * 0.1, [30, 38, 54]);
  // wind lines
  polyline([[x + w * 0.06, y + h * 0.3], [x + w * 0.2, y + h * 0.28], [x + w * 0.3, y + h * 0.32]], 2, [255, 255, 255]);
  polyline([[x + w * 0.72, y + h * 0.38], [x + w * 0.86, y + h * 0.36], [x + w * 0.94, y + h * 0.4]], 2, [255, 255, 255]);
}

// ---------------------------------------------------------------- world map
// Stylised continents on an equirectangular grid; pins are numbered stories.
function mapXY(lon, lat) {
  return [(lon + 180) / 360 * 1024, (75 - lat) / 130 * 112];
}
const CONTINENTS = [
  [[-168, 66], [-140, 70], [-110, 68], [-90, 66], [-75, 58], [-60, 48], [-70, 42], [-80, 32], [-90, 22], [-100, 18], [-115, 28], [-125, 40], [-150, 58], [-165, 60]],
  [[-80, 10], [-60, 8], [-40, -5], [-35, -15], [-45, -30], [-60, -40], [-70, -35], [-75, -20], [-80, -5]],
  [[-10, 36], [0, 44], [10, 45], [20, 42], [30, 44], [35, 40], [28, 36], [15, 38], [5, 36], [-5, 36]],
  [[-10, 35], [10, 37], [30, 32], [35, 28], [42, 15], [48, 10], [52, 12], [45, 0], [40, -15], [35, -28], [25, -32], [18, -30], [12, -18], [8, 0], [-5, 10], [-15, 20]],
  [[40, 55], [60, 60], [80, 70], [110, 72], [140, 70], [160, 65], [155, 55], [140, 40], [130, 35], [120, 25], [105, 10], [95, 8], [85, 20], [75, 8], [65, 25], [55, 30], [45, 40]],
  [[114, -22], [130, -12], [142, -12], [150, -25], [150, -37], [140, -38], [130, -32], [115, -32]],
];
function drawMap(x, y, w, h, pins) {
  rect(x, y, w, h, C.sea);
  for (const cont of CONTINENTS) {
    const pts = cont.map(([lo, la]) => {
      const [mx, my] = mapXY(lo, la);
      return [x + mx * (w / 1024), y + my * (h / 112)];
    });
    poly(pts, C.land);
  }
  for (const p of pins) {
    const [mx, my] = mapXY(p.lon, p.lat);
    const px0 = x + mx * (w / 1024), py0 = y + my * (h / 112);
    disc(px0, py0, 8, C.crimson);
    ring(px0, py0, 8, 2, C.white);
    drawText(String(p.n), px0, py0 - 5, 10, C.white, 'center');
  }
}

// ---------------------------------------------------------------- the day's news
// Every story below was reported on Thursday 26 November 2026 (any time zone),
// verified against the morning news cycle: Reuters summaries, KCNA, Kyiv Post,
// France 24, Times of India, Geo News, Middle East Eye, 6abc, FinScans,
// Moscow Times, UEFA, UN Women, ANI and the day's digests. Nothing invented.
const LEADS = [
  {
    kicker: 'TRADE WAR · WASHINGTON', icon: 'tariffs',
    head: 'US TARIFFS HIT 14 NATIONS',
    deck: 'New duties on China, the EU, Japan and India over overcapacity.',
    src: 'REUTERS',
  },
  {
    kicker: 'ENERGY · RED SEA', icon: 'refinery',
    head: 'HOUTHIS HIT SAUDI REFINERY',
    deck: 'Attacks on Saudi ports and Ras Tanura lift Brent above $95.',
    src: 'REUTERS',
  },
  {
    kicker: 'WEATHER · NEW YORK', icon: 'storm',
    head: "STORM STOPS MACY'S 100TH PARADE",
    deck: "The first weather delay in the parade's 100-year history.",
    src: 'THE TRAVELER',
  },
];
const PICS = [
  { head: 'TANKER FIRE KILLS 31 IN CAIRO', deck: 'Fuel tanker overturns on the ring road; 21 hurt.', src: 'REUTERS', icon: 'truck' },
  { head: 'KIM: DEPLOY NUKES WIDER', deck: 'North Korea to spread tactical nuclear arms, KCNA says.', src: 'KCNA', icon: 'atom' },
  { head: 'UKRAINE HITS RUSSIAN AIRBASE', deck: 'Five jets damaged at Savasleyka; Kyiv mall struck.', src: 'KYIV POST', icon: 'jet' },
  { head: 'FIRST PAKISTANI IN SPACE', deck: "Zeeshan Ali boards China's Tiangong station.", src: 'SHENZHOU-24', icon: 'station' },
  { head: 'SPACEX CLEARED FOR 1M SATELLITES', deck: 'FCC authorises orbital data-centre fleet.', src: 'TIMES OF INDIA', icon: 'sat' },
  { head: 'JUDGE BLOCKS BIRTHRIGHT ORDER', deck: "Second court halts Trump's citizenship curbs.", src: 'REUTERS', icon: 'gavel' },
  { head: 'AI SELL-OFF NEARS BEAR MARKET', deck: 'Nasdaq slides as AI shares keep falling.', src: 'REUTERS', icon: 'chart' },
  { head: 'GAZA STRIKES KILL HAMAS CHIEF', deck: 'Israeli strikes hit Hamas security head.', src: 'ONETURN', icon: 'burst' },
  { head: '2,000 MIGRANTS REACH CANARIES', deck: "One day's arrivals strain island shelters.", src: 'ONETURN', icon: 'boat' },
  { head: 'US: LEAVE IRAN NOW', deck: 'Washington warns citizens as war fears grow.', src: 'ONETURN', icon: 'plane' },
  { head: 'US GDP REVISED SHARPLY UP', deck: 'Third-quarter growth beats forecasts.', src: 'REUTERS', icon: 'bars' },
  { head: 'LIVERPOOL WIN 3-0 AT BRUGGE', deck: 'Isak and Wirtz score in Champions League.', src: 'UEFA', icon: 'ball' },
];
const BRIEFS = [
  ['NVIDIA ON DOWNGRADE WATCH — RTRS', 'chip'],
  ['CDC: 9 MEASLES DEATHS IN 2026 — RTRS', 'doc'],
  ['MURMANSK GOVERNOR HELD IN PROBE — RTRS', 'gavel'],
  ['LEBANON TO OPEN 2ND AIRPORT — RTRS', 'plane'],
  ['DOZENS OF STATES: STOP RIOT AGENT — RTRS', 'globe'],
  ['CULT LEADER CONVICTED AGAIN — RTRS', 'gavel'],
  ['KUSHNER: ISRAEL, THINK ECONOMY — GJ', 'mega'],
  ['MUMBAI MARKS 18 YEARS SINCE 26/11 — ANI', 'candle'],
  ['AUSTRALIA CURBS TECH GIANTS — SL', 'chip'],
  ['TOP CHINA OFFICIAL UNDER PROBE — SL', 'doc'],
  ['PATCH FIXES EXPLOITED LINUX FLAW — SL', 'bolt'],
  ['US: 15% TARIFFS ON TAIWAN GOODS — SL', 'chart'],
  ['FEDEX JET OVERRUNS MIAMI RUNWAY — GJ', 'plane'],
  ['BGP HIJACK DIVERTS BITCOIN POWER — FSC', 'bolt'],
  ['UK PLANS DEFI RULES AFTER HACK — FSC', 'doc'],
  ['GOLD NEAR 15-MONTH LOW — FSC', 'bars'],
  ['RAYTHEON WINS NAVY MISSILE DEAL — SL', 'jet'],
  ['F-15EX FIGHTERS SHOWN AT KADENA — SL', 'jet'],
  ['GAZA: 28,000+ WOMEN WIDOWED — UNW', 'candle'],
  ['UKRAINE DRONES HIT AZOT PLANT — FC', 'jet'],
  ['US GROUP BUYS LUKOIL ASSETS, $10B — MT', 'drop'],
  ['TRUMP PARDONS 2 TURKEYS — RTRS', 'star'],
  ['PAKISTAN KILLS 12 IN BALOCHISTAN — GEO', 'jet'],
  ['HOUTHI SHELLING KILLS 1 NEAR TAIZ — MEE', 'flame'],
  ['MECCA PACT TESTED BY CLASHES — SL', 'globe'],
  ['US RAPS S. KOREA OVER COUPANG FINE — SL', 'chart'],
  ['FORT HOOD GUNMAN SEEKS STAY — RTRS', 'gavel'],
  ['ARMY BLOWS UP EXPLOSIVE STORES — RTRS', 'flame'],
  ["RADAR OUTAGE DELAYS O'HARE — RTRS", 'plane'],
  ['THOMAS MARKLE CHARGED IN US — RTRS', 'doc'],
  ['PHILLY THANKSGIVING PARADE AXED — 6ABC', 'flame'],
  ['ECUADOR, US REVIEW OPERATIONS — RTRS', 'globe'],
  ['DAY AGAINST VIOLENCE ON WOMEN — UNW', 'mega'],
  ['HUANG RETURN FUELS AI DEBATE — RTRS', 'chip'],
  ['STORM SNARLS THANKSGIVING TRAVEL — TRV', 'flame'],
];
const NUMBERS = [
  ['31', 'KILLED IN CAIRO FIRE'],
  ['$95', 'BRENT CRUDE A BARREL'],
  ['14', 'TARIFF TARGETS'],
  ['1M', 'SATELLITES AUTHORISED'],
  ['2,000', 'MIGRANTS IN A DAY'],
];
const PINS = [
  { n: 1, lon: -77, lat: 39 }, { n: 2, lon: 31, lat: 28 }, { n: 3, lon: 47, lat: 25 },
  { n: 4, lon: 126, lat: 39 }, { n: 5, lon: 30, lat: 58 }, { n: 6, lon: 73, lat: 19 },
  { n: 7, lon: -16, lat: 28 }, { n: 8, lon: 116, lat: 40 },
];
const PIC_ICONS = {
  truck: iconTruck, atom: iconAtom, jet: iconJet, station: iconStation, sat: iconSatellite,
  gavel: iconGavel, chart: iconChartDown, burst: (x, y, s) => burst(x + s / 2, y + s / 2, s * 0.36, C.flame),
  boat: iconBoat, plane: iconPlane, bars: iconBars, ball: iconBall,
};

// ---------------------------------------------------------------- helpers
function kickerBar(x, y, label, size = 11) {
  rect(x, y, 4, size + 2, C.crimson);
  drawText(label, x + 10, y, size, C.crimson);
}
function sectionLabel(x, y, label) {
  drawText(label, x, y, 12, C.crimson);
  const w = textWidth(label, 12);
  line(x + w + 10, y + 6, 1024 - 26, y + 6, 2, C.gold);
}
function fitText(s, size, maxWidth) {
  s = s.toUpperCase();
  if (textWidth(s, size) <= maxWidth) return s;
  let t = s;
  while (t.length > 4 && textWidth(t + '...', size) > maxWidth) t = t.slice(0, -1);
  return t + '...';
}

// ---------------------------------------------------------------- layout
const M = 26; // side margin
rect(0, 0, W, H, C.paper);

// ---- masthead: crimson band, big title, date line
rect(0, 0, W, 92, C.crimson);
rect(0, 92, W, 3, C.gold);
drawText('THE 26TH', 512, 10, 56, C.white, 'center');
drawText('THURSDAY 26 NOVEMBER 2026 · THE WORLD IN ONE PICTURE', 512, 70, 13, C.goldL, 'center');

// ---- numbers ticker
const tickY = 92, tickH = 40;
{
  const cw = (W - 2 * M) / 5;
  NUMBERS.forEach(([num, lab], i) => {
    const cx = M + i * cw;
    drawText(num, cx + cw / 2, tickY + 2, 24, C.crimson, 'center');
    drawText(lab, cx + cw / 2, tickY + 30, 9, C.inkSoft, 'center');
    if (i > 0) line(cx, tickY + 6, cx, tickY + tickH - 2, 1, C.gold);
  });
  line(M, tickY + tickH + 2, W - M, tickY + tickH + 2, 2, C.gold);
}

// ---- three leads
const leadY = 140, leadW = (W - 2 * M - 2 * 14) / 3, leadH = 250;
LEADS.forEach((L, i) => {
  const x = M + i * (leadW + 14);
  shadow(x, leadY, leadW, leadH);
  rrect(x, leadY, leadW, leadH, 5, C.white);
  // illustration
  const ih = 118;
  if (L.icon === 'tariffs') sceneTariffs(x + 6, leadY + 6, leadW - 12, ih);
  if (L.icon === 'refinery') sceneRefinery(x + 6, leadY + 6, leadW - 12, ih);
  if (L.icon === 'storm') sceneStorm(x + 6, leadY + 6, leadW - 12, ih);
  rect(x + 6, leadY + 6 + ih, leadW - 12, 2, C.gold);
  // kicker, headline, deck, source
  const tx = x + 12, tw = leadW - 24;
  drawText(L.kicker, tx, leadY + 132, 10, C.crimson);
  drawPara(L.head, tx, leadY + 146, 19, C.ink, tw, 26);
  drawPara(L.deck, tx, leadY + 198, 11, C.inkSoft, tw, 15);
  drawText('SOURCE: ' + L.src, tx, leadY + leadH - 14, 9, C.gold);
});

// ---- picture stories: 4 x 3 grid
sectionLabel(M, 392, 'THE DAY IN PICTURES');
{
  const cw = (W - 2 * M - 3 * 12) / 4, ch = 78, gapY = 6, gy = 410;
  PICS.forEach((P, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const x = M + col * (cw + 12), y = gy + row * (ch + gapY);
    rrect(x, y, cw, ch, 4, C.paper2);
    // icon tile
    rrect(x + 6, y + 6, 56, 56, 4, C.white);
    PIC_ICONS[P.icon](x + 6 + 4, y + 6 + 4, 48);
    const tx = x + 70, tw = cw - 78;
    drawPara(P.head, tx, y + 7, 12.5, C.ink, tw, 18);
    drawText(P.src, tx, y + ch - 15, 9, C.crimson);
  });
}

// ---- map
drawText('WHERE IT HAPPENED', M, 664, 12, C.crimson);
line(M + textWidth('WHERE IT HAPPENED', 12) + 10, 670, 400, 670, 2, C.gold);
drawText('1 WASHINGTON · 2 CAIRO · 3 RIYADH · 4 PYONGYANG · 5 KYIV · 6 MUMBAI · 7 CANARY IS. · 8 BEIJING', W - M - 4, 666, 9, C.inkSoft, 'right');
drawMap(M, 682, W - 2 * M, 80, PINS);
line(M, 682, W - M, 682, 1, C.gold);
line(M, 762, W - M, 762, 1, C.gold);

// ---- briefs: 3 columns x 12 rows
sectionLabel(M, 770, 'ALSO ON THIS DAY');
{
  const colW = (W - 2 * M - 2 * 10) / 3, rowH = 14.5, gy = 790;
  BRIEFS.forEach((b, i) => {
    const col = Math.floor(i / 12), row = i % 12;
    const x = M + col * (colW + 10), y = gy + row * rowH;
    BRIEF_ICONS[b[1]](x, y - 1, 12);
    drawText(fitText(b[0], 10.5, colW - 20), x + 18, y, 10.5, C.ink);
  });
}

// ---- footer: date check
line(M, 968, W - M, 968, 2, C.crimson);
drawText('DATE CHECK — EVERY STORY ABOVE WAS REPORTED ON THURSDAY 26 NOVEMBER 2026.', M, 976, 11, C.crimson);
drawText('SOURCES: REUTERS · KCNA · KYIV POST · FRANCE 24 · TIMES OF INDIA · GEO NEWS · MIDDLE EAST EYE · 6ABC · FINSCANS · MOSCOW TIMES · UEFA · UN WOMEN · ANI · FEEDCAST · ONETURN', M, 991, 8, C.inkSoft);
drawText('50 STORIES · 10 REGIONS · DRAWN IN CODE · NO PHOTOGRAPHS', M, 1005, 9, C.inkSoft);

// ---------------------------------------------------------------- write it
const png = encodePNG();
writeFileSync(new URL('./entry.png', import.meta.url), png);
console.log('entry.png bytes:', png.length);
console.log('stories:', LEADS.length + PICS.length + BRIEFS.length);
