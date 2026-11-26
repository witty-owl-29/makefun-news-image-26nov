// draw.mjs — "THE 26TH" v2: one-day world news front page, Thursday 26 November 2026.
// Ink & Gold identity: charcoal-black masthead, gold rules, vermilion accents on warm ivory.
// Draws the whole 1024x1024 image in pure Node (stdlib only): a tiny RGBA canvas,
// shaded vector illustrations with gradients and highlights (no flat clip-art),
// a hand-drawn stroke font, and a hand-rolled PNG encoder.
// Run: node draw.mjs -> writes entry.png beside this file.

import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

// ---------------------------------------------------------------- palette
// "Ink & Gold": black masthead + gold + vermilion on warm ivory. Deliberately
// different from 24 Nov (deep teal + amber + clock dial), 25 Nov (midnight navy
// + flame orange + wire rail) and v1 (crimson broadsheet).
const C = {
  paper:  [247, 242, 231], // warm ivory
  paper2: [236, 228, 210], // deeper ivory for panels
  ink:    [22, 24, 28],    // near-black ink
  inkSoft:[80, 84, 94],
  black:  [18, 20, 24],    // masthead charcoal
  black2: [34, 38, 46],
  gold:   [176, 132, 44],
  goldL:  [216, 178, 96],
  goldD:  [140, 102, 30],
  verm:   [176, 36, 32],   // vermilion accents
  vermD:  [138, 24, 26],
  cream:  [255, 251, 240],
  sky:    [198, 221, 237],
  skyD:   [150, 186, 214],
  skyPale:[226, 238, 246],
  sea:    [44, 96, 130],
  seaD:   [28, 66, 96],
  seaL:   [110, 164, 196],
  sand:   [236, 222, 196],
  land:   [216, 202, 168],
  forest: [34, 90, 72],
  sage:   [120, 152, 124],
  flame:  [226, 88, 28],
  flameY: [244, 176, 44],
  ember:  [240, 120, 40],
  white:  [255, 255, 255],
  smoke:  [120, 128, 140],
  steel:  [96, 108, 124],
  steelD: [58, 66, 80],
};

// ---------------------------------------------------------------- canvas
const W = 1024, H = 1024;
const buf = Buffer.alloc(W * H * 4);

function px(x, y, c, a = 1) {
  x |= 0; y |= 0;
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
function mix(cA, cB, t) {
  return [0, 1, 2].map(k => Math.round(cA[k] + (cB[k] - cA[k]) * t));
}
// vertical gradient
function vgrad(x, y, w, h, cTop, cBot) {
  for (let j = 0; j < h; j++) {
    const t = h <= 1 ? 0 : j / (h - 1);
    rect(x, y + j, w, 1, mix(cTop, cBot, t));
  }
}
// horizontal gradient
function hgrad(x, y, w, h, cL, cR) {
  for (let i = 0; i < w; i++) {
    const t = w <= 1 ? 0 : i / (w - 1);
    rect(x + i, y, 1, h, mix(cL, cR, t));
  }
}
// soft glow: concentric translucent discs, brightest at centre
function glow(cx, cy, r, c, aMax = 0.5) {
  const steps = 8;
  for (let s = steps; s >= 1; s--) {
    const rr = r * s / steps;
    disc(cx, cy, rr, c, aMax * (1 - s / steps) * 0.9 + 0.06);
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
function line(x0, y0, x1, y1, w, c, a = 1) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(len * 2));
  const r = Math.max(0.6, w / 2);
  for (let s = 0; s <= steps; s++) disc(x0 + dx * s / steps, y0 + dy * s / steps, r, c, a);
}
function polyline(pts, w, c, a = 1) {
  for (let i = 0; i < pts.length - 1; i++) line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w, c, a);
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
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) xs.push(x0 + (y - y0) * (x1 - x0) / (y1 - y0));
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
// deterministic pseudo-random (fixed seed, so two runs are byte-identical)
let _seed = 20261126;
function rnd() {
  _seed = (_seed * 1103515245 + 12345) & 0x7fffffff;
  return _seed / 0x7fffffff;
}
function stipple(x, y, w, h, n, c, a = 0.25) {
  for (let i = 0; i < n; i++) px(x + rnd() * w, y + rnd() * h, c, a * (0.5 + rnd() * 0.5));
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
// A clean sans-style stroke font on a 5-wide x 7-tall grid (y down), drawn by
// hand for this image. Every glyph is a list of strokes; each stroke is a list
// of [x, y] points. Single-point strokes render as round dots. All type is caps.
const FONT = {
  A: [[[0, 7], [2.5, 0], [5, 7]], [[1.2, 4.8], [3.8, 4.8]]],
  B: [[[0, 0], [0, 7]], [[0, 0], [3.2, 0], [5, 1.6], [4.4, 3.5], [0, 3.5]], [[0, 3.5], [3.6, 3.5], [5, 4.8], [4.6, 7], [0, 7]]],
  C: [[[5, 1.6], [3.6, 0], [1.4, 0], [0, 1.6], [0, 5.4], [1.4, 7], [3.6, 7], [5, 5.4]]],
  D: [[[0, 0], [0, 7], [3, 7], [5, 5.2], [5, 1.8], [3, 0], [0, 0]]],
  E: [[[5, 0], [0, 0], [0, 7], [5, 7]], [[0, 3.5], [3.4, 3.5]]],
  F: [[[0, 0], [0, 7]], [[0, 0], [5, 0]], [[0, 3.5], [3.4, 3.5]]],
  G: [[[5, 1.6], [3.6, 0], [1.4, 0], [0, 1.6], [0, 5.4], [1.4, 7], [3.6, 7], [5, 5.4], [5, 3.2], [2.8, 3.2]]],
  H: [[[0, 0], [0, 7]], [[5, 0], [5, 7]], [[0, 3.5], [5, 3.5]]],
  I: [[[2.5, 0], [2.5, 7]], [[0.4, 0], [4.6, 0]], [[0.4, 7], [4.6, 7]]],
  J: [[[1.6, 0], [5, 0], [5, 5.2], [3.4, 7], [1.4, 7], [0.4, 6]]],
  K: [[[0, 0], [0, 7]], [[4.8, 0], [0.8, 3.6], [4.8, 7]]],
  L: [[[0, 0], [0, 7], [5, 7]]],
  M: [[[0, 7], [0, 0], [2.5, 3.6], [5, 0], [5, 7]]],
  N: [[[0, 7], [0, 0], [5, 7], [5, 0]]],
  O: [[[1.6, 0], [3.4, 0], [5, 1.6], [5, 5.4], [3.4, 7], [1.6, 7], [0, 5.4], [0, 1.6], [1.6, 0]]],
  P: [[[0, 7], [0, 0], [3.2, 0], [5, 1.6], [4.6, 3.5], [0, 3.5]]],
  Q: [[[1.6, 0], [3.4, 0], [5, 1.6], [5, 5.4], [3.4, 7], [1.6, 7], [0, 5.4], [0, 1.6], [1.6, 0]], [[3.2, 4.8], [5, 7]]],
  R: [[[0, 7], [0, 0], [3.2, 0], [5, 1.6], [4.6, 3.5], [0, 3.5]], [[2.6, 3.5], [5, 7]]],
  S: [[[4.6, 1.2], [3, 0], [1.6, 0], [0.4, 1.2], [0.4, 2.6], [1.6, 3.5], [3.4, 3.5], [4.6, 4.4], [4.6, 5.8], [3, 7], [1.6, 7], [0.4, 5.8]]],
  T: [[[0, 0], [5, 0]], [[2.5, 0], [2.5, 7]]],
  U: [[[0, 0], [0, 5.4], [1.6, 7], [3.4, 7], [5, 5.4], [5, 0]]],
  V: [[[0, 0], [2.5, 7], [5, 0]]],
  W: [[[0, 0], [1.2, 7], [2.5, 3.2], [3.8, 7], [5, 0]]],
  X: [[[0, 0], [5, 7]], [[5, 0], [0, 7]]],
  Y: [[[0, 0], [2.5, 3.6], [5, 0]], [[2.5, 3.6], [2.5, 7]]],
  Z: [[[0, 0], [5, 0], [0, 7], [5, 7]]],
  '0': [[[1.6, 0], [3.4, 0], [5, 1.6], [5, 5.4], [3.4, 7], [1.6, 7], [0, 5.4], [0, 1.6], [1.6, 0]], [[1.6, 5.2], [3.4, 1.8]]],
  '1': [[[1, 1.6], [2.5, 0], [2.5, 7]], [[0.4, 7], [4.6, 7]]],
  '2': [[[0.4, 1.6], [1.6, 0], [3.4, 0], [4.6, 1.6], [4.6, 2.6], [0.4, 7], [4.6, 7]]],
  '3': [[[0.4, 0], [3.4, 0], [4.6, 1.2], [4.6, 2.6], [2.8, 3.5], [4.6, 4.4], [4.6, 5.8], [3.4, 7], [0.4, 7]]],
  '4': [[[3.6, 0], [3.6, 7]], [[0, 5], [5, 5]], [[0.4, 4.6], [3.6, 0]]],
  '5': [[[5, 0], [0, 0], [0, 3.5], [3.2, 3.5], [5, 5], [4.8, 6.2], [3.4, 7], [1, 7], [0, 6]]],
  '6': [[[5, 1], [3.6, 0], [1.4, 0], [0, 1.6], [0, 5.4], [1.4, 7], [3.6, 7], [5, 5.2], [5, 3.8], [2.8, 3.8], [1, 3.8]]],
  '7': [[[0, 0], [5, 0], [2, 7]]],
  '8': [[[1.6, 0], [3.4, 0], [5, 1.6], [5, 2.6], [3.4, 3.5], [1.6, 3.5], [0, 2.6], [0, 1.6], [1.6, 0]], [[1.6, 3.5], [3.4, 3.5], [5, 4.4], [5, 5.4], [3.4, 7], [1.6, 7], [0, 5.4], [0, 4.4], [1.6, 3.5]]],
  '9': [[[0, 5.4], [0, 1.6], [1.6, 0], [3.4, 0], [5, 1.6], [5, 5.4], [3.4, 7], [1.6, 7], [0, 6]], [[0, 3.5], [5, 3.5]]],
  '.': [[[2.5, 6.6]]],
  ',': [[[2.5, 6.2], [1.8, 8]]],
  ':': [[[2.5, 2]], [[2.5, 5.4]]],
  ';': [[[2.5, 2]], [[2.5, 5.4], [1.8, 7.4]]],
  '!': [[[2.5, 0], [2.5, 4.6]], [[2.5, 6.4]]],
  '?': [[[1, 1.6], [2, 0], [3.6, 0], [4.6, 1.2], [4.6, 2.6], [3, 3.5], [2.5, 4.6]], [[2.5, 6.4]]],
  "'": [[[2.6, 0], [2, 2]]],
  '"': [[[1.6, 0], [1, 1.8]], [[3.6, 0], [3, 1.8]]],
  '-': [[[0, 3.5], [5, 3.5]]],
  '(': [[[4, 0], [2.4, 1], [1.8, 3.5], [2.4, 6], [4, 7]]],
  ')': [[[1, 0], [2.6, 1], [3.2, 3.5], [2.6, 6], [1, 7]]],
  '/': [[[5, 0], [0, 7]]],
  '%': [[[5, 0], [0, 7]], [[1.2, 1.2]], [[3.8, 5.8]]],
  '+': [[[2.5, 1], [2.5, 6]], [[0, 3.5], [5, 3.5]]],
  '=': [[[0, 2], [5, 2]], [[0, 5], [5, 5]]],
  '$': [[[4, 1], [3, 0], [1.6, 0], [0.4, 1.2], [0.4, 2.6], [2, 3.5], [4, 3.5], [4.6, 4.4], [4.6, 5.8], [3, 7], [1.6, 7], [0.4, 5.8]], [[2.5, -0.6], [2.5, 7.6]]],
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
  const step = lh ?? Math.round(size * 1.38);
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
// Every picture is drawn from shapes with shading: gradients, highlights,
// shadows and layered detail. Nothing flat, nothing copied.
function flameShape(x, y, w, h, c1, c2) {
  // layered teardrop flame: outer, mid, bright core
  poly([[x + w * 0.5, y], [x + w * 0.84, y + h * 0.44], [x + w * 0.96, y + h * 0.64],
        [x + w * 0.78, y + h], [x + w * 0.22, y + h], [x + w * 0.04, y + h * 0.64],
        [x + w * 0.16, y + h * 0.44]], c1);
  poly([[x + w * 0.5, y + h * 0.3], [x + w * 0.7, y + h * 0.58], [x + w * 0.64, y + h * 0.86],
        [x + w * 0.36, y + h * 0.86], [x + w * 0.3, y + h * 0.58]], c2);
  ellipse(x + w * 0.5, y + h * 0.72, w * 0.1, h * 0.12, C.white, 0.9);
}
function burst(x, y, r, c) {
  // explosion star: 8 spikes + shaded core
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.42;
    pts.push([x + rr * Math.cos(a), y + rr * Math.sin(a)]);
  }
  poly(pts, c);
  disc(x, y, r * 0.34, C.flameY);
  disc(x - r * 0.08, y - r * 0.08, r * 0.16, C.white);
}
// Icon tile: a small shaded scene (sky gradient + ground) that the glyph sits on,
// so every picture story reads as a little picture, not a flat symbol.
function iconTile(x, y, s, top, bot, ground) {
  vgrad(x, y, s, s, top, bot);
  if (ground) rect(x, y + s * 0.74, s, s * 0.26, ground);
  rect(x, y, s, 2, C.white, 0.5);
}
function iconTruck(x, y, s) {
  iconTile(x, y, s, C.sky, C.skyPale, [150, 158, 168]);
  rect(x + s * 0.06, y + s * 0.44, s * 0.58, s * 0.34, C.verm);
  rect(x + s * 0.06, y + s * 0.44, s * 0.58, s * 0.06, [210, 80, 70]);
  rect(x + s * 0.64, y + s * 0.52, s * 0.26, s * 0.26, C.ink);
  rect(x + s * 0.68, y + s * 0.56, s * 0.13, s * 0.11, C.sky);
  disc(x + s * 0.22, y + s * 0.82, s * 0.1, C.ink);
  disc(x + s * 0.22, y + s * 0.82, s * 0.045, C.steel);
  disc(x + s * 0.5, y + s * 0.82, s * 0.1, C.ink);
  disc(x + s * 0.5, y + s * 0.82, s * 0.045, C.steel);
  disc(x + s * 0.78, y + s * 0.82, s * 0.1, C.ink);
  disc(x + s * 0.78, y + s * 0.82, s * 0.045, C.steel);
  flameShape(x + s * 0.2, y + s * 0.02, s * 0.28, s * 0.36, C.flame, C.flameY);
}
function iconAtom(x, y, s) {
  iconTile(x, y, s, [240, 238, 250], [210, 214, 230], null);
  glow(x + s / 2, y + s / 2, s * 0.3, C.goldL, 0.35);
  disc(x + s / 2, y + s / 2, s * 0.11, C.verm);
  disc(x + s * 0.46, y + s * 0.46, s * 0.04, C.white);
  const mk = a => ellipsePts(x + s / 2, y + s / 2, s * 0.42, s * 0.16, 24).map(p => {
    const dx = p[0] - (x + s / 2), dy = p[1] - (y + s / 2);
    return [x + s / 2 + dx * Math.cos(a) - dy * Math.sin(a), y + s / 2 + dx * Math.sin(a) + dy * Math.cos(a)];
  });
  polyline(mk(0), Math.max(1.5, s * 0.045), C.ink);
  polyline(mk(Math.PI / 3), Math.max(1.5, s * 0.045), C.ink);
  polyline(mk(-Math.PI / 3), Math.max(1.5, s * 0.045), C.ink);
}
function iconJet(x, y, s) {
  iconTile(x, y, s, C.sky, C.skyPale, null);
  ellipse(x + s * 0.24, y + s * 0.2, s * 0.16, s * 0.05, C.white, 0.8);
  ellipse(x + s * 0.7, y + s * 0.78, s * 0.18, s * 0.05, C.white, 0.7);
  poly([[x + s * 0.96, y + s * 0.5], [x + s * 0.7, y + s * 0.42], [x + s * 0.56, y + s * 0.16],
        [x + s * 0.42, y + s * 0.42], [x + s * 0.12, y + s * 0.36], [x + s * 0.02, y + s * 0.5],
        [x + s * 0.12, y + s * 0.64], [x + s * 0.42, y + s * 0.58], [x + s * 0.56, y + s * 0.84],
        [x + s * 0.7, y + s * 0.58]], C.ink);
  line(x + s * 0.02, y + s * 0.5, x + s * 0.7, y + s * 0.46, 1.5, C.steel);
  burst(x + s * 0.84, y + s * 0.2, s * 0.15, C.flame);
}
function iconStation(x, y, s) {
  iconTile(x, y, s, [20, 26, 40], [60, 74, 100], null);
  disc(x + s * 0.18, y + s * 0.16, s * 0.03, C.white);
  disc(x + s * 0.84, y + s * 0.28, s * 0.025, C.white);
  disc(x + s * 0.6, y + s * 0.08, s * 0.02, C.flameY);
  hgrad(x + s * 0.08, y + s * 0.42, s * 0.3, s * 0.16, C.goldL, C.goldD);
  hgrad(x + s * 0.62, y + s * 0.42, s * 0.3, s * 0.16, C.goldL, C.goldD);
  rect(x + s * 0.4, y + s * 0.34, s * 0.2, s * 0.32, C.ink);
  rect(x + s * 0.42, y + s * 0.36, s * 0.05, s * 0.28, C.steel);
  rect(x + s * 0.44, y + s * 0.28, s * 0.12, s * 0.08, C.verm);
  disc(x + s * 0.5, y + s * 0.18, s * 0.045, C.flameY);
}
function iconSatellite(x, y, s) {
  iconTile(x, y, s, [16, 22, 38], [52, 68, 96], null);
  disc(x + s * 0.16, y + s * 0.14, s * 0.025, C.white);
  disc(x + s * 0.86, y + s * 0.22, s * 0.02, C.white);
  rect(x + s * 0.38, y + s * 0.4, s * 0.24, s * 0.2, C.ink);
  rect(x + s * 0.38, y + s * 0.4, s * 0.24, s * 0.05, C.steel);
  hgrad(x + s * 0.06, y + s * 0.42, s * 0.28, s * 0.16, C.goldL, C.gold);
  hgrad(x + s * 0.66, y + s * 0.42, s * 0.28, s * 0.16, C.goldL, C.gold);
  line(x + s * 0.08, y + s * 0.5, x + s * 0.32, y + s * 0.5, 1, C.goldD);
  line(x + s * 0.68, y + s * 0.5, x + s * 0.92, y + s * 0.5, 1, C.goldD);
  line(x + s * 0.5, y + s * 0.4, x + s * 0.64, y + s * 0.14, Math.max(1.5, s * 0.04), C.ink);
  disc(x + s * 0.66, y + s * 0.12, s * 0.05, C.verm);
  disc(x + s * 0.64, y + s * 0.1, s * 0.02, C.white);
}
function iconGavel(x, y, s) {
  iconTile(x, y, s, [238, 232, 214], [216, 204, 176], null);
  poly([[x + s * 0.15, y + s * 0.18], [x + s * 0.55, y + s * 0.05], [x + s * 0.62, y + s * 0.18], [x + s * 0.22, y + s * 0.31]], C.ink);
  line(x + s * 0.16, y + s * 0.2, x + s * 0.52, y + s * 0.08, 1.5, C.steel);
  line(x + s * 0.45, y + s * 0.3, x + s * 0.78, y + s * 0.72, Math.max(2, s * 0.07), C.goldD);
  line(x + s * 0.47, y + s * 0.32, x + s * 0.76, y + s * 0.7, 1.5, C.goldL);
  rect(x + s * 0.1, y + s * 0.78, s * 0.8, s * 0.1, C.verm);
  rect(x + s * 0.1, y + s * 0.78, s * 0.8, s * 0.03, [210, 80, 70]);
}
function iconChartDown(x, y, s) {
  iconTile(x, y, s, C.cream, [232, 224, 200], null);
  line(x + s * 0.1, y + s * 0.9, x + s * 0.1, y + s * 0.1, Math.max(1.5, s * 0.04), C.inkSoft);
  line(x + s * 0.1, y + s * 0.9, x + s * 0.92, y + s * 0.9, Math.max(1.5, s * 0.04), C.inkSoft);
  polyline([[x + s * 0.14, y + s * 0.2], [x + s * 0.4, y + s * 0.42], [x + s * 0.58, y + s * 0.34], [x + s * 0.86, y + s * 0.72]], Math.max(2, s * 0.06), C.verm);
  poly([[x + s * 0.86, y + s * 0.72], [x + s * 0.66, y + s * 0.66], [x + s * 0.8, y + s * 0.86]], C.verm);
  disc(x + s * 0.4, y + s * 0.42, s * 0.04, C.vermD);
  disc(x + s * 0.58, y + s * 0.34, s * 0.04, C.vermD);
}
function iconBoat(x, y, s) {
  iconTile(x, y, s, C.sky, C.skyPale, C.sea);
  poly([[x + s * 0.08, y + s * 0.5], [x + s * 0.92, y + s * 0.5], [x + s * 0.78, y + s * 0.72], [x + s * 0.22, y + s * 0.72]], C.verm);
  rect(x + s * 0.08, y + s * 0.5, s * 0.84, s * 0.05, [210, 80, 70]);
  line(x + s * 0.5, y + s * 0.5, x + s * 0.5, y + s * 0.14, Math.max(1.5, s * 0.04), C.ink);
  poly([[x + s * 0.52, y + s * 0.16], [x + s * 0.52, y + s * 0.44], [x + s * 0.82, y + s * 0.44]], C.cream);
  poly([[x + s * 0.52, y + s * 0.16], [x + s * 0.52, y + s * 0.44], [x + s * 0.62, y + s * 0.44]], C.goldL);
  for (let i = 0; i < 2; i++) {
    const yy = y + s * (0.8 + i * 0.07);
    polyline([[x + s * 0.06, yy], [x + s * 0.3, yy - s * 0.03], [x + s * 0.55, yy], [x + s * 0.78, yy - s * 0.03], [x + s * 0.94, yy]], Math.max(1.5, s * 0.035), C.seaL);
  }
}
function iconPlane(x, y, s) {
  iconTile(x, y, s, C.sky, C.skyPale, null);
  ellipse(x + s * 0.22, y + s * 0.18, s * 0.14, s * 0.045, C.white, 0.85);
  ellipse(x + s * 0.74, y + s * 0.76, s * 0.16, s * 0.045, C.white, 0.7);
  poly([[x + s * 0.92, y + s * 0.42], [x + s * 0.68, y + s * 0.36], [x + s * 0.52, y + s * 0.14],
        [x + s * 0.4, y + s * 0.36], [x + s * 0.12, y + s * 0.32], [x + s * 0.04, y + s * 0.44],
        [x + s * 0.12, y + s * 0.56], [x + s * 0.4, y + s * 0.52], [x + s * 0.52, y + s * 0.76],
        [x + s * 0.68, y + s * 0.48]], C.ink);
  line(x + s * 0.06, y + s * 0.44, x + s * 0.66, y + s * 0.4, 1.5, C.steel);
  line(x + s * 0.1, y + s * 0.84, x + s * 0.9, y + s * 0.84, Math.max(1.5, s * 0.04), C.verm);
}
function iconBars(x, y, s) {
  iconTile(x, y, s, C.cream, [232, 224, 200], null);
  const hs = [0.35, 0.55, 0.42, 0.75];
  hs.forEach((h, i) => {
    const bx = x + s * (0.1 + i * 0.22);
    hgrad(bx, y + s * (0.9 - h), s * 0.14, s * h, i === 3 ? C.forest : C.goldL, i === 3 ? [20, 60, 46] : C.goldD);
    rect(bx, y + s * (0.9 - h), s * 0.14, s * 0.04, C.white, 0.45);
  });
  line(x + s * 0.08, y + s * 0.9, x + s * 0.92, y + s * 0.9, Math.max(1.5, s * 0.04), C.ink);
}
function iconBall(x, y, s) {
  iconTile(x, y, s, C.forest, [20, 60, 46], null);
  disc(x + s / 2, y + s / 2, s * 0.44, C.white);
  ellipse(x + s * 0.62, y + s * 0.58, s * 0.3, s * 0.26, [210, 214, 220], 0.55);
  ring(x + s / 2, y + s / 2, s * 0.44, Math.max(1.5, s * 0.04), C.ink);
  poly([[x + s * 0.5, y + s * 0.36], [x + s * 0.62, y + s * 0.46], [x + s * 0.57, y + s * 0.6], [x + s * 0.43, y + s * 0.6], [x + s * 0.38, y + s * 0.46]], C.ink);
  line(x + s * 0.5, y + s * 0.36, x + s * 0.5, y + s * 0.1, Math.max(1.5, s * 0.04), C.ink);
  line(x + s * 0.62, y + s * 0.46, x + s * 0.86, y + s * 0.4, Math.max(1.5, s * 0.04), C.ink);
  line(x + s * 0.38, y + s * 0.46, x + s * 0.14, y + s * 0.4, Math.max(1.5, s * 0.04), C.ink);
}
function iconGlobe(x, y, s) {
  iconTile(x, y, s, C.sky, C.skyPale, null);
  disc(x + s / 2, y + s / 2, s * 0.44, C.sea);
  ellipse(x + s * 0.42, y + s * 0.4, s * 0.16, s * 0.3, C.seaL, 0.6);
  ring(x + s / 2, y + s / 2, s * 0.44, Math.max(1.5, s * 0.04), C.ink);
  ellipse(x + s / 2, y + s / 2, s * 0.2, s * 0.44, C.land);
  ellipse(x + s * 0.68, y + s * 0.66, s * 0.12, s * 0.14, C.land);
  line(x + s * 0.06, y + s / 2, x + s * 0.94, y + s / 2, Math.max(1.2, s * 0.03), C.inkSoft);
}
function iconChip(x, y, s) {
  iconTile(x, y, s, [238, 232, 214], [216, 204, 176], null);
  rect(x + s * 0.28, y + s * 0.28, s * 0.44, s * 0.44, C.ink);
  rect(x + s * 0.28, y + s * 0.28, s * 0.44, s * 0.06, C.steel);
  rect(x + s * 0.4, y + s * 0.4, s * 0.2, s * 0.2, C.gold);
  rect(x + s * 0.4, y + s * 0.4, s * 0.2, s * 0.05, C.goldL);
  for (let i = 0; i < 3; i++) {
    const o = s * (0.34 + i * 0.16);
    line(x + o, y + s * 0.12, x + o, y + s * 0.28, Math.max(1.5, s * 0.04), C.ink);
    line(x + o, y + s * 0.72, x + o, y + s * 0.88, Math.max(1.5, s * 0.04), C.ink);
    line(x + s * 0.12, y + o, x + s * 0.28, y + o, Math.max(1.5, s * 0.04), C.ink);
    line(x + s * 0.72, y + o, x + s * 0.88, y + o, Math.max(1.5, s * 0.04), C.ink);
  }
}
function iconBolt(x, y, s) {
  iconTile(x, y, s, [52, 58, 76], [28, 32, 46], null);
  poly([[x + s * 0.55, y + s * 0.05], [x + s * 0.2, y + s * 0.55], [x + s * 0.45, y + s * 0.55],
        [x + s * 0.4, y + s * 0.95], [x + s * 0.8, y + s * 0.42], [x + s * 0.55, y + s * 0.42]], C.flameY);
  poly([[x + s * 0.55, y + s * 0.05], [x + s * 0.2, y + s * 0.55], [x + s * 0.45, y + s * 0.55],
        [x + s * 0.52, y + s * 0.38], [x + s * 0.6, y + s * 0.2]], C.goldL);
}
function iconDrop(x, y, s) {
  iconTile(x, y, s, C.sky, C.skyPale, null);
  poly([[x + s * 0.5, y + s * 0.06], [x + s * 0.86, y + s * 0.55], [x + s * 0.78, y + s * 0.78],
        [x + s * 0.5, y + s * 0.94], [x + s * 0.22, y + s * 0.78], [x + s * 0.14, y + s * 0.55]], C.ink);
  ellipse(x + s * 0.38, y + s * 0.42, s * 0.07, s * 0.16, C.skyD, 0.8);
  disc(x + s * 0.5, y + s * 0.8, s * 0.05, C.steel);
}
function iconCandle(x, y, s) {
  iconTile(x, y, s, [52, 44, 58], [28, 24, 34], null);
  glow(x + s * 0.5, y + s * 0.2, s * 0.22, C.flameY, 0.5);
  rect(x + s * 0.42, y + s * 0.34, s * 0.16, s * 0.5, C.cream);
  rect(x + s * 0.42, y + s * 0.34, s * 0.05, s * 0.5, C.white);
  rect(x + s * 0.3, y + s * 0.84, s * 0.4, s * 0.08, C.gold);
  flameShape(x + s * 0.4, y + s * 0.04, s * 0.2, s * 0.28, C.flame, C.flameY);
}
function iconDoc(x, y, s) {
  iconTile(x, y, s, [238, 232, 214], [216, 204, 176], null);
  poly([[x + s * 0.2, y + s * 0.06], [x + s * 0.68, y + s * 0.06], [x + s * 0.82, y + s * 0.2],
        [x + s * 0.82, y + s * 0.94], [x + s * 0.2, y + s * 0.94]], C.white);
  poly([[x + s * 0.68, y + s * 0.06], [x + s * 0.82, y + s * 0.2], [x + s * 0.68, y + s * 0.2]], C.paper2);
  polyline([[x + s * 0.2, y + s * 0.06], [x + s * 0.68, y + s * 0.06], [x + s * 0.82, y + s * 0.2], [x + s * 0.82, y + s * 0.94], [x + s * 0.2, y + s * 0.94], [x + s * 0.2, y + s * 0.06]], Math.max(1.5, s * 0.045), C.ink);
  for (let i = 0; i < 3; i++) line(x + s * 0.32, y + s * (0.32 + i * 0.18), x + s * 0.7, y + s * (0.32 + i * 0.18), Math.max(1.2, s * 0.035), C.inkSoft);
}
function iconMega(x, y, s) {
  iconTile(x, y, s, C.sky, C.skyPale, null);
  poly([[x + s * 0.1, y + s * 0.42], [x + s * 0.42, y + s * 0.28], [x + s * 0.42, y + s * 0.68], [x + s * 0.1, y + s * 0.58]], C.verm);
  poly([[x + s * 0.42, y + s * 0.28], [x + s * 0.88, y + s * 0.12], [x + s * 0.88, y + s * 0.84], [x + s * 0.42, y + s * 0.68]], C.gold);
  poly([[x + s * 0.42, y + s * 0.28], [x + s * 0.66, y + s * 0.2], [x + s * 0.66, y + s * 0.76], [x + s * 0.42, y + s * 0.68]], C.goldL);
  line(x + s * 0.3, y + s * 0.68, x + s * 0.3, y + s * 0.88, Math.max(1.5, s * 0.05), C.ink);
  disc(x + s * 0.72, y + s * 0.48, s * 0.05, C.ink);
}
function iconStar(x, y, s) {
  iconTile(x, y, s, [52, 58, 76], [28, 32, 46], null);
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? s * 0.46 : s * 0.2;
    pts.push([x + s / 2 + rr * Math.cos(a), y + s / 2 + rr * Math.sin(a)]);
  }
  poly(pts, C.gold);
  disc(x + s * 0.42, y + s * 0.42, s * 0.06, C.goldL);
}
function iconBuilding(x, y, s) {
  iconTile(x, y, s, [240, 214, 170], [220, 180, 120], null);
  hgrad(x + s * 0.14, y + s * 0.2, s * 0.32, s * 0.68, C.steel, C.steelD);
  hgrad(x + s * 0.54, y + s * 0.38, s * 0.32, s * 0.5, C.steel, C.steelD);
  for (let r = 0; r < 3; r++) for (let cI = 0; cI < 2; cI++)
    rect(x + s * (0.2 + cI * 0.14), y + s * (0.3 + r * 0.18), s * 0.06, s * 0.08, C.flameY);
  for (let r = 0; r < 2; r++) for (let cI = 0; cI < 2; cI++)
    rect(x + s * (0.6 + cI * 0.14), y + s * (0.48 + r * 0.18), s * 0.06, s * 0.08, C.flameY);
}
// tiny brief icons (12px): bold glyph on a coloured chip so they read at small size
const BRIEF_ICONS = {
  flame: (x, y, s) => { rect(x, y, s, s, C.verm); flameShape(x + s * 0.2, y + s * 0.08, s * 0.6, s * 0.84, C.flameY, C.white); },
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
// Each lead is a small shaded painting: layered gradients, highlights, shadows,
// reflections and texture — drawn, not photographed.
function sceneTariffs(x, y, w, h) {
  // Dawn over a container port: pale gold sky, sun glow, deep sea, shaded ship.
  vgrad(x, y, w, h * 0.62, [244, 214, 160], C.skyPale);
  vgrad(x, y + h * 0.62, w, h * 0.38, C.sea, C.seaD);
  glow(x + w * 0.8, y + h * 0.18, h * 0.22, C.flameY, 0.55);
  disc(x + w * 0.8, y + h * 0.18, h * 0.11, C.flameY);
  disc(x + w * 0.78, y + h * 0.16, h * 0.05, C.white, 0.9);
  // sun path on the water
  for (let i = 0; i < 6; i++) rect(x + w * (0.74 + (i % 2) * 0.05), y + h * (0.66 + i * 0.045), w * 0.12, 2, C.flameY, 0.35 - i * 0.04);
  // distant cranes
  line(x + w * 0.06, y + h * 0.6, x + w * 0.06, y + h * 0.3, 3, C.steelD);
  line(x + w * 0.06, y + h * 0.3, x + w * 0.2, y + h * 0.38, 3, C.steelD);
  line(x + w * 0.94, y + h * 0.6, x + w * 0.94, y + h * 0.36, 3, C.steelD);
  line(x + w * 0.82, y + h * 0.36, x + w * 0.94, y + h * 0.42, 3, C.steelD);
  // sea waves
  polyline([[x, y + h * 0.66], [x + w * 0.2, y + h * 0.63], [x + w * 0.45, y + h * 0.67], [x + w * 0.7, y + h * 0.63], [x + w, y + h * 0.66]], 2, C.seaL, 0.8);
  polyline([[x, y + h * 0.82], [x + w * 0.25, y + h * 0.79], [x + w * 0.5, y + h * 0.83], [x + w * 0.75, y + h * 0.79], [x + w, y + h * 0.82]], 2, C.seaL, 0.6);
  // hull: dark with red waterline, white sheer stripe, portholes
  poly([[x + w * 0.05, y + h * 0.56], [x + w * 0.95, y + h * 0.56], [x + w * 0.86, y + h * 0.78], [x + w * 0.14, y + h * 0.78]], C.ink);
  rect(x + w * 0.07, y + h * 0.56, w * 0.86, h * 0.035, C.cream);
  rect(x + w * 0.1, y + h * 0.72, w * 0.8, h * 0.03, C.verm);
  for (let i = 0; i < 7; i++) disc(x + w * (0.16 + i * 0.11), y + h * 0.63, 2.2, C.skyD);
  // bridge tower with lit windows
  rect(x + w * 0.78, y + h * 0.3, w * 0.1, h * 0.26, C.cream);
  rect(x + w * 0.78, y + h * 0.3, w * 0.1, h * 0.05, C.ink);
  for (let r = 0; r < 2; r++) for (let cI = 0; cI < 2; cI++)
    rect(x + w * (0.795 + cI * 0.04), y + h * (0.38 + r * 0.07), w * 0.025, h * 0.035, C.skyD);
  // funnel
  rect(x + w * 0.7, y + h * 0.34, w * 0.06, h * 0.22, C.ink);
  rect(x + w * 0.7, y + h * 0.34, w * 0.06, h * 0.05, C.gold);
  // containers: two tiers, each box shaded (light top, dark right edge, ribs)
  const box = (bx, by, bw, bh, col, dark) => {
    rect(bx, by, bw, bh, col);
    rect(bx, by, bw, bh * 0.12, C.white, 0.28);
    rect(bx + bw * 0.86, by, bw * 0.14, bh, dark, 0.35);
    for (let i = 1; i < 4; i++) line(bx + bw * i / 4, by + bh * 0.1, bx + bw * i / 4, by + bh * 0.92, 1, dark, 0.3);
  };
  box(x + w * 0.12, y + h * 0.36, w * 0.19, h * 0.2, C.verm, C.vermD);
  box(x + w * 0.33, y + h * 0.36, w * 0.19, h * 0.2, C.gold, C.goldD);
  box(x + w * 0.54, y + h * 0.36, w * 0.14, h * 0.2, C.forest, [16, 56, 42]);
  box(x + w * 0.22, y + h * 0.16, w * 0.19, h * 0.2, C.cream, C.inkSoft);
  box(x + w * 0.43, y + h * 0.16, w * 0.19, h * 0.2, C.verm, C.vermD);
  // bow wave + wake foam
  ellipse(x + w * 0.08, y + h * 0.79, w * 0.07, h * 0.025, C.white, 0.7);
  ellipse(x + w * 0.5, y + h * 0.8, w * 0.2, h * 0.02, C.white, 0.35);
  // hull reflection
  for (let i = 0; i < 5; i++) rect(x + w * (0.2 + i * 0.13), y + h * (0.8 + i * 0.012), w * 0.06, 2, C.ink, 0.25 - i * 0.04);
  // big % badge with shadow ring
  disc(x + w * 0.88, y + h * 0.2, h * 0.19, C.black, 0.25);
  disc(x + w * 0.87, y + h * 0.19, h * 0.18, C.verm);
  ring(x + w * 0.87, y + h * 0.19, h * 0.18, 3, C.cream);
  drawText('%', x + w * 0.87, y + h * 0.19 - h * 0.1, h * 0.2, C.white, 'center');
}
function sceneRefinery(x, y, w, h) {
  // Dusk at the refinery: orange-to-mauve sky, low sun, shaded towers, flare glow.
  vgrad(x, y, w, h * 0.55, [252, 196, 130], [214, 140, 110]);
  vgrad(x, y + h * 0.55, w, h * 0.45, [120, 84, 70], [58, 48, 44]);
  glow(x + w * 0.2, y + h * 0.5, h * 0.2, C.flameY, 0.5);
  disc(x + w * 0.2, y + h * 0.5, h * 0.09, C.flameY);
  // ground with amber light pools
  rect(x, y + h * 0.78, w, h * 0.22, [52, 44, 40]);
  ellipse(x + w * 0.3, y + h * 0.82, w * 0.14, h * 0.03, C.flameY, 0.3);
  ellipse(x + w * 0.7, y + h * 0.86, w * 0.16, h * 0.03, C.flameY, 0.25);
  stipple(x, y + h * 0.78, w, h * 0.2, 40, C.black, 0.3);
  // distillation towers with side shading + platform rings + lit windows
  const tower = (tx, ty, tw, th) => {
    hgrad(tx, ty, tw, th, C.steel, C.steelD);
    rect(tx, ty, tw * 0.14, th, C.white, 0.22);
    rect(tx + tw * 0.86, ty, tw * 0.14, th, C.black, 0.3);
    rect(tx - tw * 0.08, ty + th * 0.3, tw * 1.16, th * 0.03, C.steelD);
    rect(tx - tw * 0.08, ty + th * 0.62, tw * 1.16, th * 0.03, C.steelD);
    for (let r = 0; r < 3; r++) disc(tx + tw * 0.5, ty + th * (0.16 + r * 0.26), 1.8, C.flameY);
  };
  tower(x + w * 0.08, y + h * 0.3, w * 0.13, h * 0.5);
  tower(x + w * 0.26, y + h * 0.16, w * 0.13, h * 0.64);
  tower(x + w * 0.44, y + h * 0.38, w * 0.15, h * 0.42);
  // flare stack with layered flame + glow
  rect(x + w * 0.64, y + h * 0.08, w * 0.045, h * 0.72, C.ink);
  rect(x + w * 0.64, y + h * 0.08, w * 0.012, h * 0.72, C.steel);
  glow(x + w * 0.66, y + h * 0.06, h * 0.14, C.flameY, 0.6);
  flameShape(x + w * 0.61, y - h * 0.02, w * 0.1, h * 0.16, C.flame, C.flameY);
  // storage tanks: white drums with curved tops and shadows
  const tank = (tx, ty, tw, th) => {
    rect(tx, ty + th * 0.18, tw, th * 0.82, C.cream);
    ellipse(tx + tw / 2, ty + th * 0.18, tw / 2, th * 0.18, C.white);
    rect(tx + tw * 0.82, ty + th * 0.18, tw * 0.18, th * 0.82, C.inkSoft, 0.25);
    line(tx, ty + th * 0.45, tx + tw, ty + th * 0.45, 1.5, C.inkSoft, 0.5);
    ellipse(tx + tw / 2, ty + th, tw / 2, th * 0.08, C.black, 0.25);
  };
  tank(x + w * 0.74, y + h * 0.6, w * 0.2, h * 0.18);
  // pipes with highlight
  line(x + w * 0.08, y + h * 0.56, x + w * 0.64, y + h * 0.56, 3, C.gold);
  line(x + w * 0.08, y + h * 0.56, x + w * 0.64, y + h * 0.56, 1, C.goldL);
  line(x + w * 0.26, y + h * 0.44, x + w * 0.64, y + h * 0.44, 3, C.gold);
  line(x + w * 0.26, y + h * 0.44, x + w * 0.64, y + h * 0.44, 1, C.goldL);
  // drifting smoke: layered translucent puffs
  disc(x + w * 0.18, y + h * 0.14, h * 0.05, C.smoke, 0.55);
  disc(x + w * 0.3, y + h * 0.08, h * 0.065, C.smoke, 0.45);
  disc(x + w * 0.12, y + h * 0.06, h * 0.04, C.smoke, 0.4);
  disc(x + w * 0.5, y + h * 0.12, h * 0.045, C.smoke, 0.5);
  // small flame at the base
  flameShape(x + w * 0.68, y + h * 0.62, w * 0.09, h * 0.16, C.flame, C.flameY);
}
function sceneStorm(x, y, w, h) {
  // Nor'easter over Manhattan: layered storm clouds, slanted rain, a big
  // panelled parade balloon with shading, rooftops and wet street below.
  vgrad(x, y, w, h, [58, 72, 96], [140, 156, 178]);
  // storm clouds: overlapping ellipses in three grey-blue shades
  ellipse(x + w * 0.26, y + h * 0.14, w * 0.22, h * 0.08, [44, 54, 74]);
  ellipse(x + w * 0.6, y + h * 0.1, w * 0.24, h * 0.09, [44, 54, 74]);
  ellipse(x + w * 0.42, y + h * 0.2, w * 0.26, h * 0.08, [66, 80, 104]);
  ellipse(x + w * 0.84, y + h * 0.2, w * 0.16, h * 0.06, [66, 80, 104]);
  ellipse(x + w * 0.1, y + h * 0.24, w * 0.14, h * 0.05, [80, 94, 118]);
  // rain: two layers of slanted streaks
  for (let i = 0; i < 12; i++) {
    const rx = x + w * (0.03 + i * 0.08);
    const ry = y + h * (0.3 + (i % 4) * 0.12);
    line(rx, ry, rx - w * 0.018, ry + h * 0.09, 2, [205, 222, 236], 0.85);
  }
  for (let i = 0; i < 8; i++) {
    const rx = x + w * (0.08 + i * 0.11);
    const ry = y + h * (0.36 + (i % 3) * 0.14);
    line(rx, ry, rx - w * 0.014, ry + h * 0.06, 1.5, [225, 236, 244], 0.6);
  }
  // balloon: big panelled envelope — gold panels, vermilion centre stripe,
  // shaded right side, bright highlight top-left, basket and ropes
  const bx = x + w * 0.5, by = y + h * 0.5, brx = w * 0.21, bry = h * 0.19;
  ellipse(bx, by, brx, bry, C.flameY);
  ellipse(bx, by, brx * 0.36, bry, C.verm);
  ellipse(bx + brx * 0.62, by, brx * 0.34, bry * 0.94, C.goldD, 0.45);
  ellipse(bx - brx * 0.55, by - bry * 0.4, brx * 0.34, bry * 0.4, C.white, 0.5);
  line(bx - brx * 0.36, by - bry * 0.92, bx - brx * 0.36, by + bry * 0.92, 1.5, C.goldD, 0.7);
  line(bx + brx * 0.36, by - bry * 0.92, bx + brx * 0.36, by + bry * 0.92, 1.5, C.goldD, 0.7);
  line(bx, by + bry, bx - w * 0.06, y + h * 0.84, 2, C.cream);
  line(bx, by + bry, bx + w * 0.06, y + h * 0.84, 2, C.cream);
  rect(x + w * 0.44, y + h * 0.84, w * 0.12, h * 0.06, [122, 84, 44]);
  line(x + w * 0.44, y + h * 0.86, x + w * 0.56, y + h * 0.86, 1, [90, 60, 30]);
  line(x + w * 0.44, y + h * 0.88, x + w * 0.56, y + h * 0.88, 1, [90, 60, 30]);
  // rooftops with lit windows
  rect(x, y + h * 0.9, w, h * 0.1, [30, 38, 54]);
  rect(x + w * 0.04, y + h * 0.82, w * 0.16, h * 0.08, [36, 44, 62]);
  rect(x + w * 0.8, y + h * 0.84, w * 0.14, h * 0.06, [36, 44, 62]);
  for (let i = 0; i < 4; i++) rect(x + w * (0.07 + i * 0.04), y + h * 0.845, 3, 4, C.flameY);
  for (let i = 0; i < 3; i++) rect(x + w * (0.83 + i * 0.04), y + h * 0.855, 3, 4, C.flameY);
  // wet-street reflections
  for (let i = 0; i < 4; i++) rect(x + w * (0.4 + i * 0.06), y + h * 0.93, w * 0.03, 2, C.flameY, 0.35);
  // wind swirls
  polyline([[x + w * 0.05, y + h * 0.3], [x + w * 0.18, y + h * 0.28], [x + w * 0.28, y + h * 0.32]], 2, C.white, 0.9);
  polyline([[x + w * 0.74, y + h * 0.36], [x + w * 0.86, y + h * 0.34], [x + w * 0.94, y + h * 0.38]], 2, C.white, 0.9);
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
  rect(x, y, w, h, C.sky);
  vgrad(x, y, w, h, [206, 226, 240], [188, 212, 230]);
  for (const cont of CONTINENTS) {
    const pts = cont.map(([lo, la]) => {
      const [mx, my] = mapXY(lo, la);
      return [x + mx * (w / 1024), y + my * (h / 112)];
    });
    poly(pts, C.land);
    polyline(pts, 1, [190, 172, 134]);
  }
  for (const p of pins) {
    const [mx, my] = mapXY(p.lon, p.lat);
    const px0 = x + mx * (w / 1024), py0 = y + my * (h / 112);
    disc(px0, py0, 9, C.black, 0.3);
    disc(px0, py0, 8, C.verm);
    ring(px0, py0, 8, 2, C.cream);
    drawText(String(p.n), px0, py0 - 5, 10, C.white, 'center');
  }
}

// ---------------------------------------------------------------- the day's news
// Every story below was reported on Thursday 26 November 2026 (any time zone),
// verified against the morning news cycle: Reuters, KCNA, Kyiv Post, France 24,
// Times of India, Geo News, Middle East Eye, 6abc, FinScans, Moscow Times, UEFA,
// UN Women, ANI and the day's digests. Nothing invented. Where the reporting is
// a proposal or a claim, the wording says so.
const LEADS = [
  {
    kicker: 'TRADE WAR · WASHINGTON', icon: 'tariffs',
    head: 'US PROPOSES TARIFFS ON 14 NATIONS',
    deck: 'China, EU, Japan face new duties.',
    src: 'REUTERS',
  },
  {
    kicker: 'ENERGY · RED SEA', icon: 'refinery',
    head: 'HOUTHIS CLAIM SAUDI REFINERY HIT',
    deck: 'Brent nears $95 on supply fears.',
    src: 'REUTERS',
  },
  {
    kicker: 'WEATHER · NEW YORK', icon: 'storm',
    head: "STORM POSTPONES MACY'S 100TH PARADE",
    deck: 'First weather delay in 100 years.',
    src: 'THE TRAVELER',
  },
];
const PICS = [
  { head: 'CAIRO TANKER FIRE KILLS 31', deck: 'Fuel tanker overturns on the ring road; 21 hurt.', src: 'REUTERS', icon: 'truck' },
  { head: 'KIM: DEPLOY NUKES WIDER', deck: 'North Korea to spread tactical nuclear arms, KCNA says.', src: 'KCNA', icon: 'atom' },
  { head: 'UKRAINE HITS RUSSIAN AIRBASE', deck: 'Five jets damaged at Savasleyka; Kyiv mall struck.', src: 'KYIV POST', icon: 'jet' },
  { head: 'FIRST PAKISTANI IN SPACE', deck: "Zeeshan Ali boards China's Tiangong station.", src: 'GEO NEWS', icon: 'station' },
  { head: 'SPACEX GETS 1M SATELLITES', deck: 'FCC authorises orbital data-centre fleet.', src: 'TIMES OF INDIA', icon: 'sat' },
  { head: 'JUDGE BLOCKS BIRTHRIGHT BAN', deck: "Second court halts Trump's citizenship curbs.", src: 'REUTERS', icon: 'gavel' },
  { head: 'AI SHARES NEAR BEAR MARKET', deck: 'Nasdaq slides as AI shares keep falling.', src: 'REUTERS', icon: 'chart' },
  { head: 'HAMAS CHIEF KILLED IN GAZA', deck: 'Israeli strikes hit Hamas security head.', src: 'ONETURN', icon: 'burst' },
  { head: '2,000 MIGRANTS REACH CANARIES', deck: "One day's arrivals strain island shelters.", src: 'ONETURN', icon: 'boat' },
  { head: 'US: LEAVE IRAN NOW', deck: 'Washington warns citizens as war fears grow.', src: 'ONETURN', icon: 'plane' },
  { head: 'US GDP REVISED SHARPLY UP', deck: 'Third-quarter growth beats forecasts.', src: 'REUTERS', icon: 'bars' },
  { head: 'LIVERPOOL WIN 3-0 AT BRUGGE', deck: 'Isak and Wirtz score in Champions League.', src: 'UEFA', icon: 'ball' },
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
  ['BGP HIJACK DIVERTS BITCOIN POWER — FSC', 'bolt'],
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
  ['ARMY BLOWS UP EXPLOSIVE STORES — RTRS', 'flame'],
  ["RADAR OUTAGE DELAYS O'HARE — RTRS", 'plane'],
  ['THOMAS MARKLE CHARGED IN US — RTRS', 'doc'],
  ['PHILLY PARADE AXED BY STORM — 6ABC', 'flame'],
  ['ECUADOR, US REVIEW OPERATIONS — RTRS', 'globe'],
  ['DAY AGAINST VIOLENCE ON WOMEN — UNW', 'mega'],
  ['HUANG RETURN FUELS AI DEBATE — RTRS', 'chip'],
  ['STORM SNARLS HOLIDAY TRAVEL — TRV', 'flame'],
];
const NUMBERS = [
  ['31', 'KILLED IN CAIRO FIRE'],
  ['$95', 'BRENT CRUDE A BARREL'],
  ['14', 'TARIFF TARGETS'],
  ['1M', 'SATELLITES AUTHORISED'],
  ['2,000', 'MIGRANTS IN A DAY'],
];
const PINS = [
  { n: 1, lon: -77, lat: 39 }, { n: 2, lon: 31, lat: 30 }, { n: 3, lon: 47, lat: 25 },
  { n: 4, lon: 126, lat: 39 }, { n: 5, lon: 30, lat: 50 }, { n: 6, lon: 73, lat: 19 },
  { n: 7, lon: -16, lat: 28 }, { n: 8, lon: 116, lat: 40 },
];
const PIC_ICONS = {
  truck: iconTruck, atom: iconAtom, jet: iconJet, station: iconStation, sat: iconSatellite,
  gavel: iconGavel, chart: iconChartDown, burst: (x, y, s) => burst(x + s / 2, y + s / 2, s * 0.36, C.flame),
  boat: iconBoat, plane: iconPlane, bars: iconBars, ball: iconBall,
};

// ---------------------------------------------------------------- helpers
function sectionLabel(x, y, label) {
  drawText(label, x, y, 12, C.verm);
  const w = textWidth(label, 12);
  line(x + w + 10, y + 6, 1024 - 26, y + 6, 2, C.gold);
}

// ---------------------------------------------------------------- layout
const M = 26; // side margin
rect(0, 0, W, H, C.paper);

// ---- masthead: black band, gold title, date line
rect(0, 0, W, 92, C.black);
rect(0, 92, W, 3, C.gold);
drawText('THE 26TH', 512, 10, 56, C.goldL, 'center');
drawText('THURSDAY 26 NOVEMBER 2026 · THE WORLD IN ONE PICTURE', 512, 70, 13, C.cream, 'center');

// ---- numbers ticker: two clear rows, numbers never touch their labels
const tickY = 94, tickH = 46;
{
  const cw = (W - 2 * M) / 5;
  NUMBERS.forEach(([num, lab], i) => {
    const cx = M + i * cw;
    drawText(num, cx + cw / 2, tickY + 2, 20, C.verm, 'center');
    drawText(lab, cx + cw / 2, tickY + 31, 9, C.inkSoft, 'center');
    if (i > 0) line(cx, tickY + 6, cx, tickY + tickH - 2, 1, C.gold);
  });
  line(M, tickY + tickH + 2, W - M, tickY + tickH + 2, 2, C.gold);
}

// ---- three leads
const leadY = 152, leadW = (W - 2 * M - 2 * 14) / 3, leadH = 250;
LEADS.forEach((L, i) => {
  const x = M + i * (leadW + 14);
  shadow(x, leadY, leadW, leadH);
  rrect(x, leadY, leadW, leadH, 5, C.white);
  // illustration
  const ih = 124;
  if (L.icon === 'tariffs') sceneTariffs(x + 6, leadY + 6, leadW - 12, ih);
  if (L.icon === 'refinery') sceneRefinery(x + 6, leadY + 6, leadW - 12, ih);
  if (L.icon === 'storm') sceneStorm(x + 6, leadY + 6, leadW - 12, ih);
  rect(x + 6, leadY + 6 + ih, leadW - 12, 2, C.gold);
  // kicker, headline, deck, source — decks are short enough for 2 lines,
  // so nothing reaches the source line
  const tx = x + 12, tw = leadW - 24;
  drawText(L.kicker, tx, leadY + 138, 11, C.verm);
  drawPara(L.head, tx, leadY + 150, 20, C.ink, tw, 26);
  drawPara(L.deck, tx, leadY + 206, 11, C.inkSoft, tw, 15);
  drawText('SOURCE: ' + L.src, tx, leadY + leadH - 12, 9, C.goldD);
});

// ---- picture stories: 4 x 3 grid, bigger type, no deck (deck lines collided
// with the source line in v2.1, so the headline breathes and the source sits clear)
sectionLabel(M, 410, 'THE DAY IN PICTURES');
{
  const cw = (W - 2 * M - 3 * 12) / 4, ch = 80, gapY = 6, gy = 426;
  PICS.forEach((P, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const x = M + col * (cw + 12), y = gy + row * (ch + gapY);
    rrect(x, y, cw, ch, 4, C.paper2);
    // icon tile
    rrect(x + 6, y + 10, 60, 60, 4, C.white);
    PIC_ICONS[P.icon](x + 6 + 4, y + 10 + 4, 52);
    const tx = x + 74, tw = cw - 82;
    drawPara(P.head, tx, y + 10, 13.5, C.ink, tw, 18);
    drawText(P.src, tx, y + ch - 14, 9, C.verm);
  });
}

// ---- map
drawText('WHERE IT HAPPENED', M, 686, 12, C.verm);
line(M + textWidth('WHERE IT HAPPENED', 12) + 10, 692, 400, 692, 2, C.gold);
drawText('1 WASHINGTON · 2 CAIRO · 3 RIYADH · 4 PYONGYANG · 5 KYIV · 6 MUMBAI · 7 CANARY IS. · 8 BEIJING', W - M - 4, 688, 9, C.inkSoft, 'right');
drawMap(M, 702, W - 2 * M, 62, PINS);
line(M, 702, W - M, 702, 1, C.gold);
line(M, 764, W - M, 764, 1, C.gold);

// ---- briefs: 3 columns x 12 rows, bigger type than v1
sectionLabel(M, 772, 'ALSO ON THIS DAY');
{
  const colW = (W - 2 * M - 2 * 10) / 3, rowH = 14.3, gy = 788;
  BRIEFS.forEach((b, i) => {
    const col = Math.floor(i / 12), row = i % 12;
    const x = M + col * (colW + 10), y = gy + row * rowH;
    BRIEF_ICONS[b[1]](x, y - 1, 12);
    drawText(fitText(b[0], 10, colW - 18), x + 18, y, 10, C.ink);
  });
}

// ---- footer: date check
line(M, 968, W - M, 968, 2, C.verm);
drawText('DATE CHECK — EVERY STORY ABOVE WAS REPORTED ON THURSDAY 26 NOVEMBER 2026.', M, 976, 11, C.verm);
drawText('SOURCES: REUTERS · KCNA · KYIV POST · FRANCE 24 · TIMES OF INDIA · GEO NEWS · MIDDLE EAST EYE · 6ABC · FINSCANS · MOSCOW TIMES · UEFA · UN WOMEN · ANI · FEEDCAST · ONETURN', M, 990, 8, C.inkSoft);
drawText('50 STORIES · 10 REGIONS · DRAWN IN CODE · NO PHOTOGRAPHS', M, 1004, 9, C.inkSoft);

// ---------------------------------------------------------------- write it
const png = encodePNG();
writeFileSync(new URL('./entry.png', import.meta.url), png);
console.log('entry.png bytes:', png.length);
console.log('stories:', LEADS.length + PICS.length + BRIEFS.length);
