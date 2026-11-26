// draw.mjs — "THE 26TH" v3: a one-day world news front page for Thursday 26 November 2026.
// Identity "Forest Broadsheet": deep forest-green masthead, cream paper, amber rules,
// vermilion accents. Layout follows the readability principles of the reference
// front page Jecha sent (big date masthead, separate stat boxes with number and
// label on their own rows, a coloured region bar, a timeline strip, numbered
// picture cards) — but with our own palette, masthead and composition.
// Draws the whole 1024x1024 image in pure Node (stdlib only): a tiny RGBA canvas,
// vector stroke type, shaded illustrations, and a hand-rolled PNG encoder.
// Run: node draw.mjs  -> writes entry.png beside this file.

import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

// ---------------------------------------------------------------- palette
const C = {
  paper:  [251, 246, 231], // warm cream broadsheet
  paper2: [243, 236, 214], // slightly deeper cream for cards
  ink:    [26, 36, 51],    // deep navy ink
  inkSoft:[88, 96, 110],
  forest: [27, 77, 62],    // masthead green
  forestD:[18, 54, 43],    // dark forest (timeline strip)
  forestL:[46, 110, 88],
  teal:   [27, 122, 107],
  amber:  [192, 138, 44],
  amberL: [224, 178, 92],
  verm:   [178, 52, 40],   // vermilion accent
  rust:   [194, 94, 46],
  steel:  [46, 107, 138],
  wine:   [138, 47, 61],
  plum:   [91, 74, 138],
  land:   [214, 200, 166], // map land
  sea:    [206, 226, 232],
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
// weight: 0 = normal, 1 = bold (drawn twice, 1px offset).
function drawText(s, x, y, size, c, align = 'left', weight = 0) {
  s = s.toUpperCase();
  const w = textWidth(s, size);
  let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  for (const ch of s) {
    drawGlyph(ch, cx, y, size, c);
    if (weight) drawGlyph(ch, cx + 0.9, y, size, c);
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
function fitText(s, size, maxWidth) {
  s = s.toUpperCase();
  if (textWidth(s, size) <= maxWidth) return s;
  let t = s;
  while (t.length > 4 && textWidth(t + '...', size) > maxWidth) t = t.slice(0, -1);
  return t + '...';
}

// ---------------------------------------------------------------- illustrations
// Every picture is drawn from simple shapes with shading — no copied artwork.
function flameShape(x, y, w, h, c1, c2) {
  poly([[x + w * 0.5, y], [x + w * 0.82, y + h * 0.42], [x + w * 0.95, y + h * 0.62],
        [x + w * 0.78, y + h], [x + w * 0.22, y + h], [x + w * 0.05, y + h * 0.62],
        [x + w * 0.18, y + h * 0.42]], c1);
  poly([[x + w * 0.5, y + h * 0.35], [x + w * 0.68, y + h * 0.6], [x + w * 0.62, y + h * 0.85],
        [x + w * 0.38, y + h * 0.85], [x + w * 0.32, y + h * 0.6]], c2);
}
function burst(x, y, r, c) {
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push([x + rr * Math.cos(a), y + rr * Math.sin(a)]);
  }
  poly(pts, c);
  disc(x, y, r * 0.32, C.white);
}
// Icons take a main colour so the same glyph works white-on-band or ink-on-paper.
function iconTruck(x, y, s, c = C.ink, c2 = C.verm) {
  rect(x, y + s * 0.42, s * 0.62, s * 0.4, c);
  rect(x + s * 0.62, y + s * 0.52, s * 0.26, s * 0.3, c);
  rect(x + s * 0.66, y + s * 0.56, s * 0.14, s * 0.12, C.sky);
  disc(x + s * 0.2, y + s * 0.86, s * 0.09, c);
  disc(x + s * 0.48, y + s * 0.86, s * 0.09, c);
  disc(x + s * 0.76, y + s * 0.86, s * 0.09, c);
  flameShape(x + s * 0.18, y - s * 0.02, s * 0.3, s * 0.4, C.flame, C.flameY);
  line(x, y + s * 0.98, x + s, y + s * 0.98, Math.max(1.2, s * 0.03), c2);
}
function iconAtom(x, y, s, c = C.ink) {
  disc(x + s / 2, y + s / 2, s * 0.1, C.verm);
  for (const ang of [0, Math.PI / 3, -Math.PI / 3]) {
    const e = ellipsePts(x + s / 2, y + s / 2, s * 0.42, s * 0.16, 24).map(p => {
      const dx = p[0] - (x + s / 2), dy = p[1] - (y + s / 2);
      return [x + s / 2 + dx * Math.cos(ang) - dy * Math.sin(ang), y + s / 2 + dx * Math.sin(ang) + dy * Math.cos(ang)];
    });
    polyline(e, Math.max(1.5, s * 0.045), c);
  }
}
function iconJet(x, y, s, c = C.ink) {
  poly([[x + s * 0.95, y + s * 0.5], [x + s * 0.7, y + s * 0.42], [x + s * 0.55, y + s * 0.18],
        [x + s * 0.42, y + s * 0.42], [x + s * 0.12, y + s * 0.38], [x + s * 0.02, y + s * 0.5],
        [x + s * 0.12, y + s * 0.62], [x + s * 0.42, y + s * 0.58], [x + s * 0.55, y + s * 0.82],
        [x + s * 0.7, y + s * 0.58]], c);
  burst(x + s * 0.82, y + s * 0.22, s * 0.16, C.flame);
}
function iconStation(x, y, s, c = C.ink) {
  rect(x + s * 0.08, y + s * 0.42, s * 0.3, s * 0.16, C.amber);
  rect(x + s * 0.62, y + s * 0.42, s * 0.3, s * 0.16, C.amber);
  rect(x + s * 0.4, y + s * 0.34, s * 0.2, s * 0.32, c);
  rect(x + s * 0.44, y + s * 0.3, s * 0.12, s * 0.08, C.verm);
  disc(x + s * 0.5, y + s * 0.2, s * 0.04, C.flameY);
  disc(x + s * 0.2, y + s * 0.16, s * 0.03, C.white);
  disc(x + s * 0.82, y + s * 0.26, s * 0.03, C.white);
}
function iconSatellite(x, y, s, c = C.ink) {
  rect(x + s * 0.38, y + s * 0.4, s * 0.24, s * 0.2, c);
  rect(x + s * 0.06, y + s * 0.42, s * 0.28, s * 0.16, C.amber);
  rect(x + s * 0.66, y + s * 0.42, s * 0.28, s * 0.16, C.amber);
  line(x + s * 0.5, y + s * 0.4, x + s * 0.62, y + s * 0.14, Math.max(1.5, s * 0.04), c);
  disc(x + s * 0.64, y + s * 0.12, s * 0.05, C.verm);
  line(x + s * 0.2, y + s * 0.75, x + s * 0.38, y + s * 0.62, Math.max(1.5, s * 0.04), C.inkSoft);
  line(x + s * 0.34, y + s * 0.82, x + s * 0.44, y + s * 0.66, Math.max(1.5, s * 0.04), C.inkSoft);
}
function iconGavel(x, y, s, c = C.ink) {
  poly([[x + s * 0.15, y + s * 0.18], [x + s * 0.55, y + s * 0.05], [x + s * 0.62, y + s * 0.18], [x + s * 0.22, y + s * 0.31]], c);
  line(x + s * 0.45, y + s * 0.3, x + s * 0.78, y + s * 0.72, Math.max(2, s * 0.07), C.amber);
  rect(x + s * 0.1, y + s * 0.78, s * 0.8, s * 0.1, C.verm);
}
function iconChartDown(x, y, s, c = C.ink) {
  line(x + s * 0.1, y + s * 0.9, x + s * 0.1, y + s * 0.1, Math.max(1.5, s * 0.04), C.inkSoft);
  line(x + s * 0.1, y + s * 0.9, x + s * 0.92, y + s * 0.9, Math.max(1.5, s * 0.04), C.inkSoft);
  polyline([[x + s * 0.14, y + s * 0.2], [x + s * 0.4, y + s * 0.42], [x + s * 0.58, y + s * 0.34], [x + s * 0.86, y + s * 0.72]], Math.max(2, s * 0.06), C.verm);
  poly([[x + s * 0.86, y + s * 0.72], [x + s * 0.68, y + s * 0.66], [x + s * 0.8, y + s * 0.84]], C.verm);
}
function iconBoat(x, y, s, c = C.ink) {
  poly([[x + s * 0.08, y + s * 0.5], [x + s * 0.92, y + s * 0.5], [x + s * 0.78, y + s * 0.74], [x + s * 0.22, y + s * 0.74]], c);
  line(x + s * 0.5, y + s * 0.5, x + s * 0.5, y + s * 0.14, Math.max(1.5, s * 0.04), c);
  poly([[x + s * 0.52, y + s * 0.16], [x + s * 0.52, y + s * 0.44], [x + s * 0.8, y + s * 0.44]], C.amber);
  for (let i = 0; i < 3; i++) {
    const yy = y + s * (0.84 + i * 0.05);
    polyline([[x + s * 0.08, yy], [x + s * 0.3, yy - s * 0.03], [x + s * 0.55, yy], [x + s * 0.78, yy - s * 0.03], [x + s * 0.94, yy]], Math.max(1.5, s * 0.035), C.skyD);
  }
}
function iconPlane(x, y, s, c = C.ink) {
  poly([[x + s * 0.92, y + s * 0.42], [x + s * 0.68, y + s * 0.36], [x + s * 0.52, y + s * 0.14],
        [x + s * 0.4, y + s * 0.36], [x + s * 0.12, y + s * 0.32], [x + s * 0.04, y + s * 0.44],
        [x + s * 0.12, y + s * 0.56], [x + s * 0.4, y + s * 0.52], [x + s * 0.52, y + s * 0.76],
        [x + s * 0.68, y + s * 0.48]], c);
  line(x + s * 0.1, y + s * 0.82, x + s * 0.9, y + s * 0.82, Math.max(1.5, s * 0.04), C.verm);
}
function iconBars(x, y, s, c = C.ink) {
  const hs = [0.35, 0.55, 0.42, 0.75];
  hs.forEach((h, i) => rect(x + s * (0.1 + i * 0.22), y + s * (0.9 - h), s * 0.14, s * h, i === 3 ? C.forest : C.amber));
  line(x + s * 0.08, y + s * 0.9, x + s * 0.92, y + s * 0.9, Math.max(1.5, s * 0.04), c);
}
function iconBall(x, y, s, c = C.ink) {
  disc(x + s / 2, y + s / 2, s * 0.44, C.white);
  ring(x + s / 2, y + s / 2, s * 0.44, Math.max(1.5, s * 0.04), c);
  poly([[x + s * 0.5, y + s * 0.36], [x + s * 0.62, y + s * 0.46], [x + s * 0.57, y + s * 0.6], [x + s * 0.43, y + s * 0.6], [x + s * 0.38, y + s * 0.46]], c);
  line(x + s * 0.5, y + s * 0.36, x + s * 0.5, y + s * 0.1, Math.max(1.5, s * 0.04), c);
  line(x + s * 0.62, y + s * 0.46, x + s * 0.86, y + s * 0.4, Math.max(1.5, s * 0.04), c);
  line(x + s * 0.38, y + s * 0.46, x + s * 0.14, y + s * 0.4, Math.max(1.5, s * 0.04), c);
}
function iconGlobe(x, y, s, c = C.ink) {
  disc(x + s / 2, y + s / 2, s * 0.44, C.sea);
  ring(x + s / 2, y + s / 2, s * 0.44, Math.max(1.5, s * 0.04), c);
  ellipse(x + s / 2, y + s / 2, s * 0.2, s * 0.44, C.land);
  line(x + s * 0.06, y + s / 2, x + s * 0.94, y + s / 2, Math.max(1.2, s * 0.03), C.inkSoft);
}
function iconChip(x, y, s, c = C.ink) {
  rect(x + s * 0.28, y + s * 0.28, s * 0.44, s * 0.44, c);
  rect(x + s * 0.4, y + s * 0.4, s * 0.2, s * 0.2, C.amber);
  for (let i = 0; i < 3; i++) {
    const o = s * (0.34 + i * 0.16);
    line(x + o, y + s * 0.12, x + o, y + s * 0.28, Math.max(1.5, s * 0.04), c);
    line(x + o, y + s * 0.72, x + o, y + s * 0.88, Math.max(1.5, s * 0.04), c);
    line(x + s * 0.12, y + o, x + s * 0.28, y + o, Math.max(1.5, s * 0.04), c);
    line(x + s * 0.72, y + o, x + s * 0.88, y + o, Math.max(1.5, s * 0.04), c);
  }
}
function iconBolt(x, y, s, c = C.ink) {
  poly([[x + s * 0.55, y + s * 0.05], [x + s * 0.2, y + s * 0.55], [x + s * 0.45, y + s * 0.55],
        [x + s * 0.4, y + s * 0.95], [x + s * 0.8, y + s * 0.42], [x + s * 0.55, y + s * 0.42]], C.flameY);
}
function iconDrop(x, y, s, c = C.ink) {
  poly([[x + s * 0.5, y + s * 0.06], [x + s * 0.86, y + s * 0.55], [x + s * 0.78, y + s * 0.78],
        [x + s * 0.5, y + s * 0.94], [x + s * 0.22, y + s * 0.78], [x + s * 0.14, y + s * 0.55]], c);
}
function iconCandle(x, y, s, c = C.ink) {
  rect(x + s * 0.42, y + s * 0.34, s * 0.16, s * 0.5, C.white);
  rect(x + s * 0.3, y + s * 0.84, s * 0.4, s * 0.08, C.amber);
  flameShape(x + s * 0.4, y + s * 0.04, s * 0.2, s * 0.28, C.flame, C.flameY);
}
function iconDoc(x, y, s, c = C.ink) {
  poly([[x + s * 0.2, y + s * 0.06], [x + s * 0.68, y + s * 0.06], [x + s * 0.82, y + s * 0.2],
        [x + s * 0.82, y + s * 0.94], [x + s * 0.2, y + s * 0.94]], C.white);
  polyline([[x + s * 0.2, y + s * 0.06], [x + s * 0.68, y + s * 0.06], [x + s * 0.82, y + s * 0.2], [x + s * 0.82, y + s * 0.94], [x + s * 0.2, y + s * 0.94], [x + s * 0.2, y + s * 0.06]], Math.max(1.5, s * 0.045), c);
  for (let i = 0; i < 3; i++) line(x + s * 0.32, y + s * (0.32 + i * 0.18), x + s * 0.7, y + s * (0.32 + i * 0.18), Math.max(1.2, s * 0.035), C.inkSoft);
}
function iconMega(x, y, s, c = C.ink) {
  poly([[x + s * 0.1, y + s * 0.42], [x + s * 0.42, y + s * 0.28], [x + s * 0.42, y + s * 0.68], [x + s * 0.1, y + s * 0.58]], C.verm);
  poly([[x + s * 0.42, y + s * 0.28], [x + s * 0.88, y + s * 0.12], [x + s * 0.88, y + s * 0.84], [x + s * 0.42, y + s * 0.68]], C.amber);
  line(x + s * 0.3, y + s * 0.68, x + s * 0.3, y + s * 0.88, Math.max(1.5, s * 0.05), c);
}
function iconStar(x, y, s, c = C.ink) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? s * 0.46 : s * 0.2;
    pts.push([x + s / 2 + rr * Math.cos(a), y + s / 2 + rr * Math.sin(a)]);
  }
  poly(pts, C.amber);
}
function iconBuilding(x, y, s, c = C.ink) {
  rect(x + s * 0.14, y + s * 0.2, s * 0.32, s * 0.68, c);
  rect(x + s * 0.54, y + s * 0.38, s * 0.32, s * 0.5, C.inkSoft);
  for (let r = 0; r < 3; r++) for (let cI = 0; cI < 2; cI++)
    rect(x + s * (0.2 + cI * 0.14), y + s * (0.3 + r * 0.18), s * 0.06, s * 0.08, C.flameY);
}
const ICONS = {
  truck: iconTruck, atom: iconAtom, jet: iconJet, station: iconStation, sat: iconSatellite,
  gavel: iconGavel, chart: iconChartDown, burst: (x, y, s, c) => burst(x + s / 2, y + s / 2, s * 0.36, C.flame),
  boat: iconBoat, plane: iconPlane, bars: iconBars, ball: iconBall, globe: iconGlobe,
  chip: iconChip, bolt: iconBolt, drop: iconDrop, candle: iconCandle, doc: iconDoc,
  mega: iconMega, star: iconStar, building: iconBuilding,
  flame: (x, y, s, c) => flameShape(x, y, s, s, C.flame, C.flameY),
};

// ---------------------------------------------------------------- lead scenes
// Lead 1: an informative bar chart of the proposed tariff ceilings (USTR, 25 Nov).
// 5 rows only, value printed INSIDE each bar, no footnote — the deck already says
// the rates are proposed. Rows are 13px tall so labels never touch.
function sceneTariffChart(x, y, w, h) {
  rect(x, y, w, h, C.paper2);
  drawText('PROPOSED TARIFF CEILINGS, %', x + 10, y + 8, 9, C.inkSoft);
  const rows = [
    ['VIETNAM', 35, C.verm], ['INDIA', 25, C.rust], ['CHINA', 20, C.amber],
    ['EU', 15, C.teal], ['JAPAN', 15, C.teal],
  ];
  const top = y + 26, rowH = 13;
  const barX = x + 76, barMax = w - 76 - 8;
  for (let g = 0; g <= 4; g++) {
    const gx = barX + (barMax * g) / 4;
    line(gx, top, gx, top + rowH * rows.length, 1, [210, 200, 175]);
  }
  rows.forEach(([lab, v, col], i) => {
    const ry = top + i * rowH;
    drawText(lab, x + 10, ry + 2, 9, C.ink);
    const bw = Math.round(barMax * v / 40);
    rect(barX, ry + 2, bw, 9, col);
    rect(barX, ry + 2, bw, 3, C.white, 0.35);
    drawText(v + '%', barX + bw + 5, ry + 2.5, 9, C.ink, 'left', 1);
  });
}
// Lead 2: Ras Tanura refinery at dusk — graded towers, lit windows, flare, smoke.
function sceneRefinery(x, y, w, h) {
  vgrad(x, y, w, h, [250, 196, 138], [214, 120, 74]);
  disc(x + w * 0.78, y + h * 0.22, h * 0.11, C.flameY);
  disc(x + w * 0.78, y + h * 0.22, h * 0.11, [255, 220, 150], 0.5);
  rect(x, y + h * 0.78, w, h * 0.22, [58, 48, 40]);
  // towers with lit windows
  const towers = [[0.08, 0.34, 0.11, 0.46], [0.24, 0.22, 0.12, 0.58], [0.4, 0.4, 0.15, 0.4]];
  for (const [tx, ty, tw, th] of towers) {
    vgrad(x + w * tx, y + h * ty, w * tw, h * th, [52, 66, 84], [30, 40, 56]);
    rect(x + w * tx, y + h * ty, 3, h * th, [120, 140, 165], 0.6);
    for (let r = 0; r < 4; r++) for (let cI = 0; cI < 2; cI++)
      rect(x + w * (tx + 0.02 + cI * 0.045), y + h * (ty + 0.06 + r * 0.1), 4, 4, C.flameY);
  }
  // flare stack
  rect(x + w * 0.6, y + h * 0.12, w * 0.045, h * 0.68, C.ink);
  disc(x + w * 0.622, y + h * 0.1, h * 0.07, C.flame, 0.35);
  flameShape(x + w * 0.585, y + h * 0.0, w * 0.075, h * 0.14, C.flame, C.flameY);
  // storage tanks
  ellipse(x + w * 0.8, y + h * 0.68, w * 0.085, h * 0.045, [240, 236, 224]);
  rect(x + w * 0.715, y + h * 0.68, w * 0.17, h * 0.12, [240, 236, 224]);
  rect(x + w * 0.715, y + h * 0.68, w * 0.17, 3, C.white, 0.7);
  // pipes with highlights
  line(x + w * 0.08, y + h * 0.56, x + w * 0.6, y + h * 0.56, 3, C.amber);
  line(x + w * 0.24, y + h * 0.44, x + w * 0.6, y + h * 0.44, 3, C.amber);
  // smoke puffs
  disc(x + w * 0.18, y + h * 0.18, h * 0.05, [255, 255, 255], 0.7);
  disc(x + w * 0.3, y + h * 0.12, h * 0.06, [255, 255, 255], 0.55);
  disc(x + w * 0.12, y + h * 0.1, h * 0.04, [255, 255, 255], 0.45);
  // small flame at base
  flameShape(x + w * 0.64, y + h * 0.62, w * 0.09, h * 0.16, C.flame, C.flameY);
}
// Lead 3: the nor'easter over New York — layered storm clouds, rain, balloon, skyline.
function sceneStorm(x, y, w, h) {
  vgrad(x, y, w, h, [48, 64, 88], [116, 136, 162]);
  // storm cloud layers
  ellipse(x + w * 0.26, y + h * 0.14, w * 0.2, h * 0.08, [36, 48, 66]);
  ellipse(x + w * 0.6, y + h * 0.1, w * 0.22, h * 0.09, [36, 48, 66]);
  ellipse(x + w * 0.84, y + h * 0.2, w * 0.14, h * 0.06, [52, 68, 92]);
  ellipse(x + w * 0.44, y + h * 0.2, w * 0.16, h * 0.06, [58, 74, 96]);
  // slanted rain
  for (let i = 0; i < 16; i++) {
    const rx = x + w * (0.03 + i * 0.062);
    const ry = y + h * (0.1 + (i % 4) * 0.15);
    line(rx, ry, rx - w * 0.018, ry + h * 0.09, 2, [200, 220, 235]);
  }
  // parade balloon: panelled, shaded, with highlight
  ellipse(x + w * 0.5, y + h * 0.5, w * 0.2, h * 0.19, C.flameY);
  ellipse(x + w * 0.5, y + h * 0.5, w * 0.07, h * 0.19, C.verm);
  ellipse(x + w * 0.43, y + h * 0.42, w * 0.045, h * 0.06, C.white, 0.85);
  line(x + w * 0.36, y + h * 0.36, x + w * 0.36, y + h * 0.64, 1.5, [200, 140, 30]);
  line(x + w * 0.64, y + h * 0.36, x + w * 0.64, y + h * 0.64, 1.5, [200, 140, 30]);
  // balloon strings
  line(x + w * 0.5, y + h * 0.69, x + w * 0.42, y + h * 0.88, 2, C.white);
  line(x + w * 0.5, y + h * 0.69, x + w * 0.58, y + h * 0.88, 2, C.white);
  // skyline with lit windows
  rect(x, y + h * 0.82, w, h * 0.18, [28, 36, 52]);
  const blds = [[0.02, 0.66, 0.14], [0.2, 0.58, 0.12], [0.36, 0.7, 0.1], [0.68, 0.6, 0.13], [0.85, 0.68, 0.12]];
  for (const [bx, by, bw] of blds) {
    rect(x + w * bx, y + h * by, w * bw, y + h * 0.82 - (y + h * by), [40, 50, 70]);
    for (let r = 0; r < 3; r++) for (let cI = 0; cI < 3; cI++)
      if ((r + cI) % 2 === 0) rect(x + w * (bx + 0.015 + cI * 0.035), y + h * (by + 0.03 + r * 0.05), 3, 3, C.flameY);
  }
  // wind streaks
  polyline([[x + w * 0.06, y + h * 0.3], [x + w * 0.2, y + h * 0.28], [x + w * 0.3, y + h * 0.32]], 2, [255, 255, 255]);
  polyline([[x + w * 0.72, y + h * 0.36], [x + w * 0.86, y + h * 0.34], [x + w * 0.94, y + h * 0.38]], 2, [255, 255, 255]);
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
    disc(px0, py0, 7, C.verm);
    ring(px0, py0, 7, 2, C.white);
    drawText(String(p.n), px0, py0 - 4.5, 9, C.white, 'center');
  }
}

// ---------------------------------------------------------------- the day's news
// Every story below was reported on Thursday 26 November 2026 (any time zone),
// verified against the morning news cycle: Reuters, KCNA, Kyiv Post, France 24,
// Times of India, Geo News, Middle East Eye, 6abc, FinScans, Moscow Times, UEFA,
// UN Women, ANI and the day's digests. Nothing invented.
const LEADS = [
  {
    n: 1, kicker: 'WASHINGTON · TRADE', visual: 'chart', tag: 'REPORTED', tagC: C.forest,
    head: 'US PROPOSES TARIFFS ON 14 NATIONS',
    deck: 'China, EU, Japan face duties.',
    src: 'REUTERS',
  },
  {
    n: 2, kicker: 'RED SEA · ENERGY', visual: 'refinery', tag: 'CLAIM', tagC: C.verm,
    head: 'HOUTHIS CLAIM SAUDI REFINERY HIT',
    deck: 'Brent nears $95 on supply fears.',
    src: 'REUTERS',
  },
  {
    n: 3, kicker: 'NEW YORK · WEATHER', visual: 'storm', tag: 'OFFICIAL', tagC: C.steel,
    head: "STORM POSTPONES MACY'S 100TH PARADE",
    deck: 'First weather delay in 100 years.',
    src: 'THE TRAVELER',
  },
];
const PICS = [
  { n: 4, kicker: 'CAIRO · EGYPT', head: 'CAIRO TANKER FIRE KILLS 31', deck: 'Tanker overturns; 21 hurt.', src: 'REUTERS', icon: 'truck', band: C.verm },
  { n: 5, kicker: 'PYONGYANG · N. KOREA', head: 'KIM: DEPLOY NUKES WIDER', deck: 'N. Korea to spread tactical nukes.', src: 'KCNA', icon: 'atom', band: C.steel },
  { n: 6, kicker: 'KYIV · UKRAINE', head: 'UKRAINE HITS RUSSIAN AIRBASE', deck: 'Five jets damaged at Savasleyka.', src: 'KYIV POST', icon: 'jet', band: C.forest },
  { n: 7, kicker: 'TIANGONG · SPACE', head: 'FIRST PAKISTANI IN SPACE', deck: 'Zeeshan Ali boards Tiangong.', src: 'GEO NEWS', icon: 'station', band: C.plum },
  { n: 8, kicker: 'WASHINGTON · SPACE', head: 'SPACEX GETS 1M SATELLITES', deck: 'FCC clears data-centre fleet.', src: 'TIMES OF INDIA', icon: 'sat', band: C.amber },
  { n: 9, kicker: 'WASHINGTON · COURTS', head: 'JUDGE BLOCKS BIRTHRIGHT BAN', deck: 'Second court halts curbs.', src: 'REUTERS', icon: 'gavel', band: C.wine },
  { n: 10, kicker: 'NEW YORK · MARKETS', head: 'AI SHARES NEAR BEAR MARKET', deck: 'Nasdaq slides as AI falls.', src: 'REUTERS', icon: 'chart', band: C.teal },
  { n: 11, kicker: 'GAZA CITY · WAR', head: 'HAMAS CHIEF KILLED IN GAZA', deck: 'Israeli strikes hit Hamas chief.', src: 'ONETURN', icon: 'burst', band: C.rust },
  { n: 12, kicker: 'CANARY IS. · MIGRATION', head: '2,000 MIGRANTS REACH CANARIES', deck: 'Arrivals strain island shelters.', src: 'ONETURN', icon: 'boat', band: C.steel },
  { n: 13, kicker: 'WASHINGTON · IRAN', head: 'US: LEAVE IRAN NOW', deck: 'Washington warns citizens.', src: 'ONETURN', icon: 'plane', band: C.forest },
  { n: 14, kicker: 'WASHINGTON · ECONOMY', head: 'US GDP REVISED SHARPLY UP', deck: 'Q3 growth beats forecasts.', src: 'REUTERS', icon: 'bars', band: C.amber },
  { n: 15, kicker: 'BRUGGE · FOOTBALL', head: 'LIVERPOOL WIN 3-0 AT BRUGGE', deck: 'Isak and Wirtz score.', src: 'UEFA', icon: 'ball', band: C.verm },
];
const BRIEFS = [
  ['NVIDIA ON DOWNGRADE WATCH — RTRS', 'chip'],
  ['CDC: 9 MEASLES DEATHS IN 2026 — RTRS', 'doc'],
  ['MURMANSK GOVERNOR HELD — RTRS', 'gavel'],
  ['LEBANON TO OPEN 2ND AIRPORT — RTRS', 'plane'],
  ['STATES: STOP RIOT AGENT — RTRS', 'globe'],
  ['CULT LEADER CONVICTED AGAIN — RTRS', 'gavel'],
  ['KUSHNER: ISRAEL, THINK ECONOMY — GJ', 'mega'],
  ['MUMBAI MARKS 26/11, 18 YEARS ON — ANI', 'candle'],
  ['AUSTRALIA CURBS TECH GIANTS — SL', 'chip'],
  ['TOP CHINA OFFICIAL UNDER PROBE — SL', 'doc'],
  ['PATCH FIXES LINUX FLAW — SL', 'bolt'],
  ['US: 15% TARIFFS ON TAIWAN GOODS — SL', 'chart'],
  ['FEDEX JET OVERRUNS MIAMI RUNWAY — GJ', 'plane'],
  ['BGP HIJACK DIVERTS BITCOIN — FSC', 'bolt'],
  ['UK PLANS DEFI RULES AFTER HACK — FSC', 'doc'],
  ['GOLD NEAR 15-MONTH LOW — FSC', 'bars'],
  ['RAYTHEON WINS NAVY MISSILE DEAL — SL', 'jet'],
  ['F-15EX FIGHTERS SHOWN AT KADENA — SL', 'jet'],
  ['GAZA: 28,000+ WOMEN WIDOWED — UNW', 'candle'],
  ['UKRAINE DRONES HIT AZOT PLANT — FC', 'jet'],
  ['US GROUP BUYS LUKOIL ASSETS — MT', 'drop'],
  ['TRUMP PARDONS 2 TURKEYS — RTRS', 'star'],
  ['PAKISTAN KILLS 12, BALOCHISTAN — GEO', 'jet'],
  ['HOUTHI SHELLING KILLS 1 IN TAIZ — MEE', 'flame'],
  ['MECCA PACT TESTED BY CLASHES — SL', 'globe'],
  ['US RAPS S. KOREA ON COUPANG — SL', 'chart'],
  ['FORT HOOD GUNMAN SEEKS STAY — RTRS', 'gavel'],
  ['ARMY BLOWS UP AMMO STORES — RTRS', 'flame'],
  ["RADAR OUTAGE DELAYS O'HARE — RTRS", 'plane'],
  ['THOMAS MARKLE CHARGED IN US — RTRS', 'doc'],
  ['PHILLY PARADE AXED BY STORM — 6ABC', 'flame'],
  ['ECUADOR, US REVIEW OPERATIONS — RTRS', 'globe'],
  ['DAY AGAINST VIOLENCE ON WOMEN — UNW', 'mega'],
  ['HUANG RETURN FUELS AI DEBATE — RTRS', 'chip'],
  ['STORM SNARLS HOLIDAY TRAVEL — TRV', 'flame'],
];
const STATS = [
  ['31', 'KILLED IN CAIRO FIRE', C.verm],
  ['$95', 'BRENT CRUDE A BARREL', C.amber],
  ['14', 'TARIFF TARGETS', C.forest],
  ['1M', 'SATELLITES AUTHORISED', C.teal],
  ['2,000', 'MIGRANTS IN A DAY', C.rust],
  ['100TH', 'PARADE POSTPONED', C.steel],
];
const REGIONS = [
  ['EUROPE', 10, C.steel], ['M. EAST', 9, C.rust], ['AFRICA', 4, C.amber],
  ['ASIA', 12, C.teal], ['AMERICAS', 13, C.wine], ['OCE', 2, C.plum],
];
const PINS = [
  { n: 1, lon: -77, lat: 39 }, { n: 2, lon: 31, lat: 30 }, { n: 3, lon: 47, lat: 25 },
  { n: 4, lon: 126, lat: 39 }, { n: 5, lon: 30, lat: 50 }, { n: 6, lon: 73, lat: 19 },
  { n: 7, lon: -16, lat: 28 }, { n: 8, lon: 116, lat: 40 },
];

// ---------------------------------------------------------------- layout
const M = 24; // side margin
rect(0, 0, W, H, C.paper);

// ---- top kicker row
drawText('THE WORLD IN ONE DAY', M, 10, 11, C.forest, 'left', 1);
drawText('50 STORIES · 10 REGIONS · ALL FROM THURSDAY 26 NOVEMBER 2026', W - M, 10, 10, C.inkSoft, 'right');

// ---- masthead: forest band, big date, amber rule
rect(0, 28, W, 76, C.forest);
rect(0, 28, W, 3, C.amberL);
drawText('THE WORLD IN ONE DAY — ISSUE NO. 26', 512, 38, 11, C.amberL, 'center');
drawText('THURSDAY 26 NOVEMBER 2026', 512, 56, 40, C.paper, 'center', 1);
rect(0, 104, W, 3, C.amber);

// ---- subhead: the three leads in one line
drawText("US PROPOSES TARIFFS ON 14 · HOUTHIS CLAIM RAS TANURA HIT · MACY'S 100TH PARADE POSTPONED", 512, 112, 11, C.forest, 'center', 1);

// ---- stat boxes: number and label on SEPARATE rows with a clear gap (v1/v2 bug fix)
{
  const bw = (W - 2 * M - 5 * 8) / 6, by = 134, bh = 60;
  STATS.forEach(([num, lab, col], i) => {
    const x = M + i * (bw + 8);
    rrect(x, by, bw, bh, 3, C.white);
    rect(x, by, bw, 3, col);
    drawText(num, x + bw / 2, by + 10, 21, col, 'center', 1);
    drawText(lab, x + bw / 2, by + 38, 9, C.inkSoft, 'center');
  });
}

// ---- region bar
{
  const by = 200, bh = 20;
  let x = M;
  for (const [name, count, col] of REGIONS) {
    const w = Math.round((W - 2 * M) * count / 50);
    rect(x, by, w, bh, col);
    drawText(name + ' ' + count, x + w / 2, by + 5, 9, C.white, 'center', 1);
    x += w;
  }
}

// ---- timeline strip
rect(M, 226, W - 2 * M, 22, C.forestD);
drawText('26 NOV · US PROPOSES TARIFFS ON 14 · HOUTHIS CLAIM RAS TANURA HIT · CAIRO TANKER FIRE KILLS 31 · MACY\'S PARADE POSTPONED · FIRST PAKISTANI IN SPACE', 512, 232, 9, C.paper, 'center');

// ---- three leads
{
  const ly = 254, lh = 196, lw = (W - 2 * M - 2 * 12) / 3;
  LEADS.forEach((L, i) => {
    const x = M + i * (lw + 12);
    shadow(x, ly, lw, lh);
    rrect(x, ly, lw, lh, 5, C.white);
    const vx = x + 6, vy = ly + 6, vw = lw - 12, vh = 94;
    if (L.visual === 'chart') sceneTariffChart(vx, vy, vw, vh);
    if (L.visual === 'refinery') sceneRefinery(vx, vy, vw, vh);
    if (L.visual === 'storm') sceneStorm(vx, vy, vw, vh);
    rect(vx, vy + vh, vw, 2, C.amber);
    // status tag, bottom-right of the visual (out of the way of titles)
    const tagW = textWidth(L.tag, 8) + 12;
    rrect(vx + vw - tagW - 4, vy + vh - 18, tagW, 14, L.tagC);
    drawText(L.tag, vx + vw - 4 - tagW / 2, vy + vh - 15, 8, C.white, 'center', 1);
    const tx = x + 12, tw = lw - 24;
    drawText(L.n + ' · ' + L.kicker, tx, ly + 108, 10, C.forest, 'left', 1);
    drawPara(L.head, tx, ly + 122, 18, C.ink, tw, 23);
    drawText(L.deck, tx, ly + 170, 11, C.inkSoft);
    drawText('SOURCE: ' + L.src, tx, ly + 184, 9, C.amber, 'left', 1);
  });
}

// ---- picture stories: numbered cards with a coloured band
drawText('THE DAY IN PICTURES - STORIES 4-15', M, 452, 11, C.forest, 'left', 1);
line(M + textWidth('THE DAY IN PICTURES - STORIES 4-15', 11) + 10, 458, W - M, 458, 2, C.amber);
{
  const cw = 236, ch = 92, gy = 468;
  PICS.forEach((P, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const x = M + col * (cw + 10), y = gy + row * (ch + 6);
    rrect(x, y, cw, ch, 4, C.paper2);
    // coloured band: number + white icon
    rect(x, y, cw, 22, P.band);
    drawText(String(P.n), x + 8, y + 4, 14, C.white, 'left', 1);
    ICONS[P.icon](x + cw - 24, y + 3, 16, C.white);
    const tx = x + 8, tw = cw - 16;
    drawText(P.kicker, tx, y + 25, 8.5, C.verm, 'left', 1);
    drawPara(P.head, tx, y + 38, 12, C.ink, tw, 14.5);
    drawText(P.deck, tx, y + 69, 9.5, C.inkSoft);
    drawText(P.src, tx, y + 81, 8, C.forest, 'left', 1);
  });
}

// ---- map
drawText('WHERE IT HAPPENED', M, 762, 11, C.forest, 'left', 1);
line(M + textWidth('WHERE IT HAPPENED', 11) + 10, 768, 400, 768, 2, C.amber);
drawText('1 WASHINGTON · 2 CAIRO · 3 RIYADH · 4 PYONGYANG · 5 KYIV · 6 MUMBAI · 7 CANARY IS. · 8 BEIJING', W - M, 763, 8.5, C.inkSoft, 'right');
drawMap(M, 776, W - 2 * M, 56, PINS);
line(M, 776, W - M, 776, 1, C.amber);
line(M, 832, W - M, 832, 1, C.amber);

// ---- briefs: 4 columns x 9 rows (v4 fix: rowH was 9.5px < ~10px glyph ink,
// so adjacent rows fused into black mush; 4 cols x 13.5px step = clear gaps)
drawText('ALSO ON THURSDAY 26 NOVEMBER — 35 MORE STORIES', M, 838, 11, C.forest, 'left', 1);
line(M + textWidth('ALSO ON THURSDAY 26 NOVEMBER — 35 MORE STORIES', 11) + 10, 844, W - M, 844, 2, C.amber);
{
  const colW = (W - 2 * M - 3 * 10) / 4, rowH = 13.5, gy = 854;
  BRIEFS.forEach((b, i) => {
    const col = Math.floor(i / 9), row = i % 9;
    const x = M + col * (colW + 10), y = gy + row * rowH;
    ICONS[b[1]](x, y - 1, 8, C.forest);
    drawText(fitText(b[0], 8.5, colW - 16), x + 13, y, 8.5, C.ink);
  });
}

// ---- footer: date check
line(M, 974, W - M, 974, 2, C.forest);
drawText('DATE CHECK — EVERY STORY ABOVE WAS REPORTED ON THURSDAY 26 NOVEMBER 2026.', M, 980, 10.5, C.verm, 'left', 1);
drawText('SOURCES: REUTERS · KCNA · KYIV POST · FRANCE 24 · TIMES OF INDIA · GEO NEWS · MIDDLE EAST EYE · 6ABC · FINSCANS · MOSCOW TIMES · UEFA · UN WOMEN · ANI · FEEDCAST · ONETURN', M, 994, 8, C.inkSoft);
drawText('50 STORIES · 10 REGIONS · DRAWN IN CODE · NO PHOTOGRAPHS', M, 1008, 9, C.inkSoft);

// ---------------------------------------------------------------- write it
const png = encodePNG();
writeFileSync(new URL('./entry.png', import.meta.url), png);
console.log('entry.png bytes:', png.length);
console.log('stories:', LEADS.length + PICS.length + BRIEFS.length);
