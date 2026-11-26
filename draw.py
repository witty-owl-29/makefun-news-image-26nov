# draw.py — "THE 26TH" v5: a one-day world news front page for Thursday 26 November 2026.
# Identity "Forest Broadsheet": deep forest-green masthead, cream paper, amber rules,
# vermilion accents. Layout keeps the readability principles of the reference
# front page Jecha sent (big date masthead, separate stat boxes, a coloured region
# bar, a timeline strip, numbered picture cards) — but with our own palette.
# v5 renders with REAL fonts (DejaVu Serif/Sans) via PIL, because Jecha asked for
# normal writing: the hand-drawn stroke font of v1-v4 piled up and was unreadable.
# The 50 stories are the same verified 26 Nov facts as v3/v4.
# Run: python3 draw.py  -> writes entry.png beside this file.

from PIL import Image, ImageDraw, ImageFont

# ---------------------------------------------------------------- palette
C = {
    'paper':  (251, 246, 231),
    'paper2': (243, 236, 214),
    'ink':    (26, 36, 51),
    'inkSoft': (88, 96, 110),
    'forest': (27, 77, 62),
    'forestD': (18, 54, 43),
    'forestL': (46, 110, 88),
    'teal':   (27, 122, 107),
    'amber':  (192, 138, 44),
    'amberL': (224, 178, 92),
    'verm':   (178, 52, 40),
    'rust':   (194, 94, 46),
    'steel':  (46, 107, 138),
    'wine':   (138, 47, 61),
    'plum':   (91, 74, 138),
    'land':   (214, 200, 166),
    'sea':    (206, 226, 232),
    'sky':    (186, 214, 235),
    'skyD':   (140, 180, 214),
    'sand':   (242, 227, 198),
    'rose':   (243, 217, 217),
    'flame':  (232, 96, 32),
    'flameY': (245, 178, 44),
    'white':  (255, 255, 255),
    'black':  (0, 0, 0),
}

W, H = 1024, 1024
img = Image.new('RGB', (W, H), C['paper'])
d = ImageDraw.Draw(img)
ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
od = ImageDraw.Draw(ov)

# ---------------------------------------------------------------- fonts (real type, not stroke glyphs)
_SERIF = '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'
_SERIFB = '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'
_SANS = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
_SANSB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
_cache = {}
def font(path, size):
    key = (path, size)
    if key not in _cache:
        _cache[key] = ImageFont.truetype(path, size)
    return _cache[key]
def serif(size):  return font(_SERIF, size)
def serifb(size): return font(_SERIFB, size)
def sans(size):   return font(_SANS, size)
def sansb(size):  return font(_SANSB, size)

# ---------------------------------------------------------------- shape helpers
def rect(x, y, w, h, c):
    x0, y0 = round(x), round(y)
    x1, y1 = max(x0, round(x + w) - 1), max(y0, round(y + h) - 1)
    d.rectangle([x0, y0, x1, y1], fill=c)
def rrect(x, y, w, h, r, c):
    x0, y0 = round(x), round(y)
    x1, y1 = max(x0, round(x + w) - 1), max(y0, round(y + h) - 1)
    d.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=c)
def vgrad(x, y, w, h, cTop, cBot):
    for j in range(int(h)):
        t = 0 if h <= 1 else j / (h - 1)
        c = tuple(round(cTop[k] + (cBot[k] - cTop[k]) * t) for k in range(3))
        d.line([(x, y + j), (x + w - 1, y + j)], fill=c)
def disc(cx, cy, r, c):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c)
def ring(cx, cy, r, w, c):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=c, width=max(1, round(w)))
def line(x0, y0, x1, y1, w, c):
    d.line([(x0, y0), (x1, y1)], fill=c, width=max(1, round(w)))
def polyline(pts, w, c):
    d.line([(p[0], p[1]) for p in pts], fill=c, width=max(1, round(w)), joint='curve')
def poly(pts, c):
    d.polygon([(p[0], p[1]) for p in pts], fill=c)
def ellipse(cx, cy, rx, ry, c):
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=c)
def ellipse_pts(cx, cy, rx, ry, n=28):
    import math
    return [(cx + rx * math.cos(i / n * 2 * math.pi),
             cy + ry * math.sin(i / n * 2 * math.pi)) for i in range(n)]
def shadow(x, y, w, h, r=4):
    od.rounded_rectangle([x + 3, y + 4, x + w + 2, y + h + 3], radius=r,
                         fill=(0, 0, 0, 26))
def alpha_rect(x, y, w, h, c, a):
    x0, y0 = round(x), round(y)
    x1, y1 = max(x0, round(x + w) - 1), max(y0, round(y + h) - 1)
    od.rectangle([x0, y0, x1, y1], fill=(c[0], c[1], c[2], a))
def alpha_disc(cx, cy, r, c, a):
    od.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(c[0], c[1], c[2], a))

# ---------------------------------------------------------------- text helpers (real font metrics)
def tw(s, f):
    return d.textlength(s, font=f)
def text(s, x, y, f, c, align='left'):
    anchor = {'left': 'la', 'center': 'ma', 'right': 'ra'}[align]
    d.text((x, y), s, font=f, fill=c, anchor=anchor)
def wrap(s, f, maxw):
    words = s.split()
    lines, cur = [], ''
    for w in words:
        t = (cur + ' ' + w) if cur else w
        if d.textlength(t, font=f) <= maxw or not cur:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines
def para(s, x, y, f, c, maxw, lh):
    lines = wrap(s, f, maxw)
    for i, ln in enumerate(lines):
        text(ln, x, y + i * lh, f, c)
    return len(lines) * lh
def fit(s, f, maxw):
    if d.textlength(s, font=f) <= maxw:
        return s
    t = s
    while len(t) > 4 and d.textlength(t + '...', font=f) > maxw:
        t = t[:-1]
    return t + '...'
def fit_size(s, fpath, maxw, start):
    size = start
    while size > 8 and d.textlength(s, font=font(fpath, size)) > maxw:
        size -= 1
    return size

# ---------------------------------------------------------------- small shapes
def flame_shape(x, y, w, h, c1, c2):
    poly([[x + w * 0.5, y], [x + w * 0.82, y + h * 0.42], [x + w * 0.95, y + h * 0.62],
          [x + w * 0.78, y + h], [x + w * 0.22, y + h], [x + w * 0.05, y + h * 0.62],
          [x + w * 0.18, y + h * 0.42]], c1)
    poly([[x + w * 0.5, y + h * 0.35], [x + w * 0.68, y + h * 0.6], [x + w * 0.62, y + h * 0.85],
          [x + w * 0.38, y + h * 0.85], [x + w * 0.32, y + h * 0.6]], c2)
def burst(x, y, r, c):
    import math
    pts = []
    for i in range(16):
        a = i / 16 * 2 * math.pi - math.pi / 2
        rr = r if i % 2 == 0 else r * 0.45
        pts.append((x + rr * math.cos(a), y + rr * math.sin(a)))
    poly(pts, c)
    disc(x, y, r * 0.32, C['white'])

# ---------------------------------------------------------------- icons
def icon_truck(x, y, s, c=C['ink'], c2=C['verm']):
    rect(x, y + s * 0.42, s * 0.62, s * 0.4, c)
    rect(x + s * 0.62, y + s * 0.52, s * 0.26, s * 0.3, c)
    rect(x + s * 0.66, y + s * 0.56, s * 0.14, s * 0.12, C['sky'])
    disc(x + s * 0.2, y + s * 0.86, s * 0.09, c)
    disc(x + s * 0.48, y + s * 0.86, s * 0.09, c)
    disc(x + s * 0.76, y + s * 0.86, s * 0.09, c)
    flame_shape(x + s * 0.18, y - s * 0.02, s * 0.3, s * 0.4, C['flame'], C['flameY'])
    line(x, y + s * 0.98, x + s, y + s * 0.98, max(1.2, s * 0.03), c2)
def icon_atom(x, y, s, c=C['ink']):
    import math
    disc(x + s / 2, y + s / 2, s * 0.1, C['verm'])
    for ang in (0, math.pi / 3, -math.pi / 3):
        e = ellipse_pts(x + s / 2, y + s / 2, s * 0.42, s * 0.16, 24)
        rot = []
        for (px, py) in e:
            dx, dy = px - (x + s / 2), py - (y + s / 2)
            rot.append((x + s / 2 + dx * math.cos(ang) - dy * math.sin(ang),
                        y + s / 2 + dx * math.sin(ang) + dy * math.cos(ang)))
        polyline(rot, max(1.5, s * 0.045), c)
def icon_jet(x, y, s, c=C['ink']):
    poly([[x + s * 0.95, y + s * 0.5], [x + s * 0.7, y + s * 0.42], [x + s * 0.55, y + s * 0.18],
          [x + s * 0.42, y + s * 0.42], [x + s * 0.12, y + s * 0.38], [x + s * 0.02, y + s * 0.5],
          [x + s * 0.12, y + s * 0.62], [x + s * 0.42, y + s * 0.58], [x + s * 0.55, y + s * 0.82],
          [x + s * 0.7, y + s * 0.58]], c)
    burst(x + s * 0.82, y + s * 0.22, s * 0.16, C['flame'])
def icon_station(x, y, s, c=C['ink']):
    rect(x + s * 0.08, y + s * 0.42, s * 0.3, s * 0.16, C['amber'])
    rect(x + s * 0.62, y + s * 0.42, s * 0.3, s * 0.16, C['amber'])
    rect(x + s * 0.4, y + s * 0.34, s * 0.2, s * 0.32, c)
    rect(x + s * 0.44, y + s * 0.3, s * 0.12, s * 0.08, C['verm'])
    disc(x + s * 0.5, y + s * 0.2, s * 0.04, C['flameY'])
    disc(x + s * 0.2, y + s * 0.16, s * 0.03, C['white'])
    disc(x + s * 0.82, y + s * 0.26, s * 0.03, C['white'])
def icon_sat(x, y, s, c=C['ink']):
    rect(x + s * 0.38, y + s * 0.4, s * 0.24, s * 0.2, c)
    rect(x + s * 0.06, y + s * 0.42, s * 0.28, s * 0.16, C['amber'])
    rect(x + s * 0.66, y + s * 0.42, s * 0.28, s * 0.16, C['amber'])
    line(x + s * 0.5, y + s * 0.4, x + s * 0.62, y + s * 0.14, max(1.5, s * 0.04), c)
    disc(x + s * 0.64, y + s * 0.12, s * 0.05, C['verm'])
    line(x + s * 0.2, y + s * 0.75, x + s * 0.38, y + s * 0.62, max(1.5, s * 0.04), C['inkSoft'])
    line(x + s * 0.34, y + s * 0.82, x + s * 0.44, y + s * 0.66, max(1.5, s * 0.04), C['inkSoft'])
def icon_gavel(x, y, s, c=C['ink']):
    poly([[x + s * 0.15, y + s * 0.18], [x + s * 0.55, y + s * 0.05], [x + s * 0.62, y + s * 0.18], [x + s * 0.22, y + s * 0.31]], c)
    line(x + s * 0.45, y + s * 0.3, x + s * 0.78, y + s * 0.72, max(2, s * 0.07), C['amber'])
    rect(x + s * 0.1, y + s * 0.78, s * 0.8, s * 0.1, C['verm'])
def icon_chart(x, y, s, c=C['ink']):
    line(x + s * 0.1, y + s * 0.9, x + s * 0.1, y + s * 0.1, max(1.5, s * 0.04), C['inkSoft'])
    line(x + s * 0.1, y + s * 0.9, x + s * 0.92, y + s * 0.9, max(1.5, s * 0.04), C['inkSoft'])
    polyline([[x + s * 0.14, y + s * 0.2], [x + s * 0.4, y + s * 0.42], [x + s * 0.58, y + s * 0.34], [x + s * 0.86, y + s * 0.72]], max(2, s * 0.06), C['verm'])
    poly([[x + s * 0.86, y + s * 0.72], [x + s * 0.68, y + s * 0.66], [x + s * 0.8, y + s * 0.84]], C['verm'])
def icon_boat(x, y, s, c=C['ink']):
    poly([[x + s * 0.08, y + s * 0.5], [x + s * 0.92, y + s * 0.5], [x + s * 0.78, y + s * 0.74], [x + s * 0.22, y + s * 0.74]], c)
    line(x + s * 0.5, y + s * 0.5, x + s * 0.5, y + s * 0.14, max(1.5, s * 0.04), c)
    poly([[x + s * 0.52, y + s * 0.16], [x + s * 0.52, y + s * 0.44], [x + s * 0.8, y + s * 0.44]], C['amber'])
    for i in range(3):
        yy = y + s * (0.84 + i * 0.05)
        polyline([[x + s * 0.08, yy], [x + s * 0.3, yy - s * 0.03], [x + s * 0.55, yy], [x + s * 0.78, yy - s * 0.03], [x + s * 0.94, yy]], max(1.5, s * 0.035), C['skyD'])
def icon_plane(x, y, s, c=C['ink']):
    poly([[x + s * 0.92, y + s * 0.42], [x + s * 0.68, y + s * 0.36], [x + s * 0.52, y + s * 0.14],
          [x + s * 0.4, y + s * 0.36], [x + s * 0.12, y + s * 0.32], [x + s * 0.04, y + s * 0.44],
          [x + s * 0.12, y + s * 0.56], [x + s * 0.4, y + s * 0.52], [x + s * 0.52, y + s * 0.76],
          [x + s * 0.68, y + s * 0.48]], c)
    line(x + s * 0.1, y + s * 0.82, x + s * 0.9, y + s * 0.82, max(1.5, s * 0.04), C['verm'])
def icon_bars(x, y, s, c=C['ink']):
    hs = [0.35, 0.55, 0.42, 0.75]
    for i, h in enumerate(hs):
        rect(x + s * (0.1 + i * 0.22), y + s * (0.9 - h), s * 0.14, s * h,
             C['forest'] if i == 3 else C['amber'])
    line(x + s * 0.08, y + s * 0.9, x + s * 0.92, y + s * 0.9, max(1.5, s * 0.04), c)
def icon_ball(x, y, s, c=C['ink']):
    disc(x + s / 2, y + s / 2, s * 0.44, C['white'])
    ring(x + s / 2, y + s / 2, s * 0.44, max(1.5, s * 0.04), c)
    poly([[x + s * 0.5, y + s * 0.36], [x + s * 0.62, y + s * 0.46], [x + s * 0.57, y + s * 0.6], [x + s * 0.43, y + s * 0.6], [x + s * 0.38, y + s * 0.46]], c)
    line(x + s * 0.5, y + s * 0.36, x + s * 0.5, y + s * 0.1, max(1.5, s * 0.04), c)
    line(x + s * 0.62, y + s * 0.46, x + s * 0.86, y + s * 0.4, max(1.5, s * 0.04), c)
    line(x + s * 0.38, y + s * 0.46, x + s * 0.14, y + s * 0.4, max(1.5, s * 0.04), c)
def icon_globe(x, y, s, c=C['ink']):
    disc(x + s / 2, y + s / 2, s * 0.44, C['sea'])
    ring(x + s / 2, y + s / 2, s * 0.44, max(1.5, s * 0.04), c)
    ellipse(x + s / 2, y + s / 2, s * 0.2, s * 0.44, C['land'])
    line(x + s * 0.06, y + s / 2, x + s * 0.94, y + s / 2, max(1.2, s * 0.03), C['inkSoft'])
def icon_chip(x, y, s, c=C['ink']):
    rect(x + s * 0.28, y + s * 0.28, s * 0.44, s * 0.44, c)
    rect(x + s * 0.4, y + s * 0.4, s * 0.2, s * 0.2, C['amber'])
    for i in range(3):
        o = s * (0.34 + i * 0.16)
        line(x + o, y + s * 0.12, x + o, y + s * 0.28, max(1.5, s * 0.04), c)
        line(x + o, y + s * 0.72, x + o, y + s * 0.88, max(1.5, s * 0.04), c)
        line(x + s * 0.12, y + o, x + s * 0.28, y + o, max(1.5, s * 0.04), c)
        line(x + s * 0.72, y + o, x + s * 0.88, y + o, max(1.5, s * 0.04), c)
def icon_bolt(x, y, s, c=C['ink']):
    poly([[x + s * 0.55, y + s * 0.05], [x + s * 0.2, y + s * 0.55], [x + s * 0.45, y + s * 0.55],
          [x + s * 0.4, y + s * 0.95], [x + s * 0.8, y + s * 0.42], [x + s * 0.55, y + s * 0.42]], C['flameY'])
def icon_drop(x, y, s, c=C['ink']):
    poly([[x + s * 0.5, y + s * 0.06], [x + s * 0.86, y + s * 0.55], [x + s * 0.78, y + s * 0.78],
          [x + s * 0.5, y + s * 0.94], [x + s * 0.22, y + s * 0.78], [x + s * 0.14, y + s * 0.55]], c)
def icon_candle(x, y, s, c=C['ink']):
    rect(x + s * 0.42, y + s * 0.34, s * 0.16, s * 0.5, C['white'])
    rect(x + s * 0.3, y + s * 0.84, s * 0.4, s * 0.08, C['amber'])
    flame_shape(x + s * 0.4, y + s * 0.04, s * 0.2, s * 0.28, C['flame'], C['flameY'])
def icon_doc(x, y, s, c=C['ink']):
    poly([[x + s * 0.2, y + s * 0.06], [x + s * 0.68, y + s * 0.06], [x + s * 0.82, y + s * 0.2],
          [x + s * 0.82, y + s * 0.94], [x + s * 0.2, y + s * 0.94]], C['white'])
    polyline([[x + s * 0.2, y + s * 0.06], [x + s * 0.68, y + s * 0.06], [x + s * 0.82, y + s * 0.2], [x + s * 0.82, y + s * 0.94], [x + s * 0.2, y + s * 0.94], [x + s * 0.2, y + s * 0.06]], max(1.5, s * 0.045), c)
    for i in range(3):
        line(x + s * 0.32, y + s * (0.32 + i * 0.18), x + s * 0.7, y + s * (0.32 + i * 0.18), max(1.2, s * 0.035), C['inkSoft'])
def icon_mega(x, y, s, c=C['ink']):
    poly([[x + s * 0.1, y + s * 0.42], [x + s * 0.42, y + s * 0.28], [x + s * 0.42, y + s * 0.68], [x + s * 0.1, y + s * 0.58]], C['verm'])
    poly([[x + s * 0.42, y + s * 0.28], [x + s * 0.88, y + s * 0.12], [x + s * 0.88, y + s * 0.84], [x + s * 0.42, y + s * 0.68]], C['amber'])
    line(x + s * 0.3, y + s * 0.68, x + s * 0.3, y + s * 0.88, max(1.5, s * 0.05), c)
def icon_star(x, y, s, c=C['ink']):
    import math
    pts = []
    for i in range(10):
        a = i / 10 * 2 * math.pi - math.pi / 2
        rr = s * 0.46 if i % 2 == 0 else s * 0.2
        pts.append((x + s / 2 + rr * math.cos(a), y + s / 2 + rr * math.sin(a)))
    poly(pts, C['amber'])
def icon_building(x, y, s, c=C['ink']):
    rect(x + s * 0.14, y + s * 0.2, s * 0.32, s * 0.68, c)
    rect(x + s * 0.54, y + s * 0.38, s * 0.32, s * 0.5, C['inkSoft'])
    for r in range(3):
        for ci in range(2):
            rect(x + s * (0.2 + ci * 0.14), y + s * (0.3 + r * 0.18), s * 0.06, s * 0.08, C['flameY'])
ICONS = {
    'truck': icon_truck, 'atom': icon_atom, 'jet': icon_jet, 'station': icon_station,
    'sat': icon_sat, 'gavel': icon_gavel, 'chart': icon_chart,
    'burst': lambda x, y, s, c=C['ink']: burst(x + s / 2, y + s / 2, s * 0.36, C['flame']),
    'boat': icon_boat, 'plane': icon_plane, 'bars': icon_bars, 'ball': icon_ball,
    'globe': icon_globe, 'chip': icon_chip, 'bolt': icon_bolt, 'drop': icon_drop,
    'candle': icon_candle, 'doc': icon_doc, 'mega': icon_mega, 'star': icon_star,
    'building': icon_building,
    'flame': lambda x, y, s, c=C['ink']: flame_shape(x, y, s, s, C['flame'], C['flameY']),
}

# ---------------------------------------------------------------- lead scenes
# Lead 1: an informative bar chart of the proposed tariff ceilings (USTR, 25 Nov).
def scene_tariff(x, y, w, h):
    rect(x, y, w, h, C['paper2'])
    text('PROPOSED TARIFF CEILINGS, %', x + 10, y + 8, sans(10), C['inkSoft'])
    rows = [('VIETNAM', 35, C['verm']), ('INDIA', 25, C['rust']), ('CHINA', 20, C['amber']),
            ('EU', 15, C['teal']), ('JAPAN', 15, C['teal'])]
    top, row_h = y + 26, 13
    bar_x, bar_max = x + 76, w - 76 - 8
    for g in range(5):
        gx = bar_x + (bar_max * g) / 4
        line(gx, top, gx, top + row_h * len(rows), 1, (210, 200, 175))
    for i, (lab, v, col) in enumerate(rows):
        ry = top + i * row_h
        text(lab, x + 10, ry + 1, sansb(10), C['ink'])
        bw = round(bar_max * v / 40)
        rect(bar_x, ry + 2, bw, 9, col)
        alpha_rect(bar_x, ry + 2, bw, 3, C['white'], 90)
        text(str(v) + '%', bar_x + bw + 5, ry + 1, sansb(10), C['ink'])
# Lead 2: Ras Tanura refinery at dusk — graded towers, lit windows, flare, smoke.
def scene_refinery(x, y, w, h):
    vgrad(x, y, w, h, (250, 196, 138), (214, 120, 74))
    disc(x + w * 0.78, y + h * 0.22, h * 0.11, C['flameY'])
    alpha_disc(x + w * 0.78, y + h * 0.22, h * 0.11, (255, 220, 150), 128)
    rect(x, y + h * 0.78, w, h * 0.22, (58, 48, 40))
    towers = [(0.08, 0.34, 0.11, 0.46), (0.24, 0.22, 0.12, 0.58), (0.4, 0.4, 0.15, 0.4)]
    for (tx, ty, twd, th) in towers:
        vgrad(x + w * tx, y + h * ty, w * twd, h * th, (52, 66, 84), (30, 40, 56))
        alpha_rect(x + w * tx, y + h * ty, 3, h * th, (120, 140, 165), 153)
        for r in range(4):
            for ci in range(2):
                rect(x + w * (tx + 0.02 + ci * 0.045), y + h * (ty + 0.06 + r * 0.1), 4, 4, C['flameY'])
    rect(x + w * 0.6, y + h * 0.12, w * 0.045, h * 0.68, C['ink'])
    alpha_disc(x + w * 0.622, y + h * 0.1, h * 0.07, C['flame'], 90)
    flame_shape(x + w * 0.585, y + h * 0.0, w * 0.075, h * 0.14, C['flame'], C['flameY'])
    ellipse(x + w * 0.8, y + h * 0.68, w * 0.085, h * 0.045, (240, 236, 224))
    rect(x + w * 0.715, y + h * 0.68, w * 0.17, h * 0.12, (240, 236, 224))
    alpha_rect(x + w * 0.715, y + h * 0.68, w * 0.17, 3, C['white'], 179)
    line(x + w * 0.08, y + h * 0.56, x + w * 0.6, y + h * 0.56, 3, C['amber'])
    line(x + w * 0.24, y + h * 0.44, x + w * 0.6, y + h * 0.44, 3, C['amber'])
    alpha_disc(x + w * 0.18, y + h * 0.18, h * 0.05, C['white'], 179)
    alpha_disc(x + w * 0.3, y + h * 0.12, h * 0.06, C['white'], 140)
    alpha_disc(x + w * 0.12, y + h * 0.1, h * 0.04, C['white'], 115)
    flame_shape(x + w * 0.64, y + h * 0.62, w * 0.09, h * 0.16, C['flame'], C['flameY'])
# Lead 3: the nor'easter over New York — layered storm clouds, rain, balloon, skyline.
def scene_storm(x, y, w, h):
    vgrad(x, y, w, h, (48, 64, 88), (116, 136, 162))
    ellipse(x + w * 0.26, y + h * 0.14, w * 0.2, h * 0.08, (36, 48, 66))
    ellipse(x + w * 0.6, y + h * 0.1, w * 0.22, h * 0.09, (36, 48, 66))
    ellipse(x + w * 0.84, y + h * 0.2, w * 0.14, h * 0.06, (52, 68, 92))
    ellipse(x + w * 0.44, y + h * 0.2, w * 0.16, h * 0.06, (58, 74, 96))
    for i in range(16):
        rx = x + w * (0.03 + i * 0.062)
        ry = y + h * (0.1 + (i % 4) * 0.15)
        line(rx, ry, rx - w * 0.018, ry + h * 0.09, 2, (200, 220, 235))
    ellipse(x + w * 0.5, y + h * 0.5, w * 0.2, h * 0.19, C['flameY'])
    ellipse(x + w * 0.5, y + h * 0.5, w * 0.07, h * 0.19, C['verm'])
    alpha_disc(x + w * 0.43, y + h * 0.42, w * 0.045, C['white'], 217)
    line(x + w * 0.36, y + h * 0.36, x + w * 0.36, y + h * 0.64, 1.5, (200, 140, 30))
    line(x + w * 0.64, y + h * 0.36, x + w * 0.64, y + h * 0.64, 1.5, (200, 140, 30))
    line(x + w * 0.5, y + h * 0.69, x + w * 0.42, y + h * 0.88, 2, C['white'])
    line(x + w * 0.5, y + h * 0.69, x + w * 0.58, y + h * 0.88, 2, C['white'])
    rect(x, y + h * 0.82, w, h * 0.18, (28, 36, 52))
    blds = [(0.02, 0.66, 0.14), (0.2, 0.58, 0.12), (0.36, 0.7, 0.1), (0.68, 0.6, 0.13), (0.85, 0.68, 0.12)]
    for (bx, by, bw) in blds:
        rect(x + w * bx, y + h * by, w * bw, y + h * 0.82 - (y + h * by), (40, 50, 70))
        for r in range(3):
            for ci in range(3):
                if (r + ci) % 2 == 0:
                    rect(x + w * (bx + 0.015 + ci * 0.035), y + h * (by + 0.03 + r * 0.05), 3, 3, C['flameY'])
    polyline([[x + w * 0.06, y + h * 0.3], [x + w * 0.2, y + h * 0.28], [x + w * 0.3, y + h * 0.32]], 2, C['white'])
    polyline([[x + w * 0.72, y + h * 0.36], [x + w * 0.86, y + h * 0.34], [x + w * 0.94, y + h * 0.38]], 2, C['white'])

# ---------------------------------------------------------------- world map
def map_xy(lon, lat):
    return ((lon + 180) / 360 * 1024, (75 - lat) / 130 * 112)
CONTINENTS = [
    [[-168, 66], [-140, 70], [-110, 68], [-90, 66], [-75, 58], [-60, 48], [-70, 42], [-80, 32], [-90, 22], [-100, 18], [-115, 28], [-125, 40], [-150, 58], [-165, 60]],
    [[-80, 10], [-60, 8], [-40, -5], [-35, -15], [-45, -30], [-60, -40], [-70, -35], [-75, -20], [-80, -5]],
    [[-10, 36], [0, 44], [10, 45], [20, 42], [30, 44], [35, 40], [28, 36], [15, 38], [5, 36], [-5, 36]],
    [[-10, 35], [10, 37], [30, 32], [35, 28], [42, 15], [48, 10], [52, 12], [45, 0], [40, -15], [35, -28], [25, -32], [18, -30], [12, -18], [8, 0], [-5, 10], [-15, 20]],
    [[40, 55], [60, 60], [80, 70], [110, 72], [140, 70], [160, 65], [155, 55], [140, 40], [130, 35], [120, 25], [105, 10], [95, 8], [85, 20], [75, 8], [65, 25], [55, 30], [45, 40]],
    [[114, -22], [130, -12], [142, -12], [150, -25], [150, -37], [140, -38], [130, -32], [115, -32]],
]
def draw_map(x, y, w, h, pins):
    rect(x, y, w, h, C['sea'])
    for cont in CONTINENTS:
        pts = []
        for (lo, la) in cont:
            mx, my = map_xy(lo, la)
            pts.append((x + mx * (w / 1024), y + my * (h / 112)))
        poly(pts, C['land'])
    for p in pins:
        mx, my = map_xy(p['lon'], p['lat'])
        px0, py0 = x + mx * (w / 1024), y + my * (h / 112)
        disc(px0, py0, 7, C['verm'])
        ring(px0, py0, 7, 2, C['white'])
        text(str(p['n']), px0, py0 - 5, sansb(9), C['white'], 'center')

# ---------------------------------------------------------------- the day's news
# Every story below was reported on Thursday 26 November 2026 (any time zone),
# verified against the morning news cycle. Nothing invented.
LEADS = [
    {'n': 1, 'kicker': 'WASHINGTON · TRADE', 'visual': 'chart', 'tag': 'REPORTED', 'tagC': C['forest'],
     'head': 'US PROPOSES TARIFFS ON 14 NATIONS', 'deck': 'China, EU, Japan face duties.', 'src': 'REUTERS'},
    {'n': 2, 'kicker': 'RED SEA · ENERGY', 'visual': 'refinery', 'tag': 'CLAIM', 'tagC': C['verm'],
     'head': 'HOUTHIS CLAIM SAUDI REFINERY HIT', 'deck': 'Brent nears $95 on supply fears.', 'src': 'REUTERS'},
    {'n': 3, 'kicker': 'NEW YORK · WEATHER', 'visual': 'storm', 'tag': 'OFFICIAL', 'tagC': C['steel'],
     'head': "STORM POSTPONES MACY'S 100TH PARADE", 'deck': 'First weather delay in 100 years.', 'src': 'THE TRAVELER'},
]
PICS = [
    {'n': 4, 'kicker': 'CAIRO · EGYPT', 'head': 'CAIRO TANKER FIRE KILLS 31', 'deck': 'Tanker overturns; 21 hurt.', 'src': 'REUTERS', 'icon': 'truck', 'band': C['verm']},
    {'n': 5, 'kicker': 'PYONGYANG · N. KOREA', 'head': 'KIM: DEPLOY NUKES WIDER', 'deck': 'N. Korea to spread tactical nukes.', 'src': 'KCNA', 'icon': 'atom', 'band': C['steel']},
    {'n': 6, 'kicker': 'KYIV · UKRAINE', 'head': 'UKRAINE HITS RUSSIAN AIRBASE', 'deck': 'Five jets damaged at Savasleyka.', 'src': 'KYIV POST', 'icon': 'jet', 'band': C['forest']},
    {'n': 7, 'kicker': 'TIANGONG · SPACE', 'head': 'FIRST PAKISTANI IN SPACE', 'deck': 'Zeeshan Ali boards Tiangong.', 'src': 'GEO NEWS', 'icon': 'station', 'band': C['plum']},
    {'n': 8, 'kicker': 'WASHINGTON · SPACE', 'head': 'SPACEX GETS 1M SATELLITES', 'deck': 'FCC clears data-centre fleet.', 'src': 'TIMES OF INDIA', 'icon': 'sat', 'band': C['amber']},
    {'n': 9, 'kicker': 'WASHINGTON · COURTS', 'head': 'JUDGE BLOCKS BIRTHRIGHT BAN', 'deck': 'Second court halts curbs.', 'src': 'REUTERS', 'icon': 'gavel', 'band': C['wine']},
    {'n': 10, 'kicker': 'NEW YORK · MARKETS', 'head': 'AI SHARES NEAR BEAR MARKET', 'deck': 'Nasdaq slides as AI falls.', 'src': 'REUTERS', 'icon': 'chart', 'band': C['teal']},
    {'n': 11, 'kicker': 'GAZA CITY · WAR', 'head': 'HAMAS CHIEF KILLED IN GAZA', 'deck': 'Israeli strikes hit Hamas chief.', 'src': 'ONETURN', 'icon': 'burst', 'band': C['rust']},
    {'n': 12, 'kicker': 'CANARY IS. · MIGRATION', 'head': '2,000 MIGRANTS REACH CANARIES', 'deck': 'Arrivals strain island shelters.', 'src': 'ONETURN', 'icon': 'boat', 'band': C['steel']},
    {'n': 13, 'kicker': 'WASHINGTON · IRAN', 'head': 'US: LEAVE IRAN NOW', 'deck': 'Washington warns citizens.', 'src': 'ONETURN', 'icon': 'plane', 'band': C['forest']},
    {'n': 14, 'kicker': 'WASHINGTON · ECONOMY', 'head': 'US GDP REVISED SHARPLY UP', 'deck': 'Q3 growth beats forecasts.', 'src': 'REUTERS', 'icon': 'bars', 'band': C['amber']},
    {'n': 15, 'kicker': 'BRUGGE · FOOTBALL', 'head': 'LIVERPOOL WIN 3-0 AT BRUGGE', 'deck': 'Isak and Wirtz score.', 'src': 'UEFA', 'icon': 'ball', 'band': C['verm']},
]
BRIEFS = [
    ('NVIDIA ON DOWNGRADE WATCH — RTRS', 'chip'),
    ('CDC: 9 MEASLES DEATHS IN 2026 — RTRS', 'doc'),
    ('MURMANSK GOVERNOR HELD — RTRS', 'gavel'),
    ('LEBANON TO OPEN 2ND AIRPORT — RTRS', 'plane'),
    ('STATES: STOP RIOT AGENT — RTRS', 'globe'),
    ('CULT LEADER CONVICTED AGAIN — RTRS', 'gavel'),
    ('KUSHNER: ISRAEL, THINK ECONOMY — GJ', 'mega'),
    ('MUMBAI MARKS 26/11, 18 YEARS ON — ANI', 'candle'),
    ('AUSTRALIA CURBS TECH GIANTS — SL', 'chip'),
    ('TOP CHINA OFFICIAL UNDER PROBE — SL', 'doc'),
    ('PATCH FIXES LINUX FLAW — SL', 'bolt'),
    ('US: 15% TARIFFS ON TAIWAN GOODS — SL', 'chart'),
    ('FEDEX JET OVERRUNS MIAMI RUNWAY — GJ', 'plane'),
    ('BGP HIJACK DIVERTS BITCOIN — FSC', 'bolt'),
    ('UK PLANS DEFI RULES AFTER HACK — FSC', 'doc'),
    ('GOLD NEAR 15-MONTH LOW — FSC', 'bars'),
    ('RAYTHEON WINS NAVY MISSILE DEAL — SL', 'jet'),
    ('F-15EX FIGHTERS SHOWN AT KADENA — SL', 'jet'),
    ('GAZA: 28,000+ WOMEN WIDOWED — UNW', 'candle'),
    ('UKRAINE DRONES HIT AZOT PLANT — FC', 'jet'),
    ('US GROUP BUYS LUKOIL ASSETS — MT', 'drop'),
    ('TRUMP PARDONS 2 TURKEYS — RTRS', 'star'),
    ('PAKISTAN KILLS 12, BALOCHISTAN — GEO', 'jet'),
    ('HOUTHI SHELLING KILLS 1 IN TAIZ — MEE', 'flame'),
    ('MECCA PACT TESTED BY CLASHES — SL', 'globe'),
    ('US RAPS S. KOREA ON COUPANG — SL', 'chart'),
    ('FORT HOOD GUNMAN SEEKS STAY — RTRS', 'gavel'),
    ('ARMY BLOWS UP AMMO STORES — RTRS', 'flame'),
    ("RADAR OUTAGE DELAYS O'HARE — RTRS", 'plane'),
    ('THOMAS MARKLE CHARGED IN US — RTRS', 'doc'),
    ('PHILLY PARADE AXED BY STORM — 6ABC', 'flame'),
    ('ECUADOR, US REVIEW OPERATIONS — RTRS', 'globe'),
    ('DAY AGAINST VIOLENCE ON WOMEN — UNW', 'mega'),
    ('HUANG RETURN FUELS AI DEBATE — RTRS', 'chip'),
    ('STORM SNARLS HOLIDAY TRAVEL — TRV', 'flame'),
]
STATS = [
    ('31', 'KILLED IN CAIRO FIRE', C['verm']),
    ('$95', 'BRENT CRUDE A BARREL', C['amber']),
    ('14', 'TARIFF TARGETS', C['forest']),
    ('1M', 'SATELLITES AUTHORISED', C['teal']),
    ('2,000', 'MIGRANTS IN A DAY', C['rust']),
    ('100TH', 'PARADE POSTPONED', C['steel']),
]
REGIONS = [
    ('EUROPE', 10, C['steel']), ('M. EAST', 9, C['rust']), ('AFRICA', 4, C['amber']),
    ('ASIA', 12, C['teal']), ('AMERICAS', 13, C['wine']), ('OCE', 2, C['plum']),
]
PINS = [
    {'n': 1, 'lon': -77, 'lat': 39}, {'n': 2, 'lon': 31, 'lat': 30}, {'n': 3, 'lon': 47, 'lat': 25},
    {'n': 4, 'lon': 126, 'lat': 39}, {'n': 5, 'lon': 30, 'lat': 50}, {'n': 6, 'lon': 73, 'lat': 19},
    {'n': 7, 'lon': -16, 'lat': 28}, {'n': 8, 'lon': 116, 'lat': 40},
]

# ---------------------------------------------------------------- layout
M = 24  # side margin

# ---- top kicker row
text('THE WORLD IN ONE DAY', M, 10, serifb(15), C['forest'])
text('50 STORIES · 10 REGIONS · ALL FROM THURSDAY 26 NOVEMBER 2026',
     W - M, 11, sans(12), C['inkSoft'], 'right')

# ---- masthead: forest band, big date, amber rule
rect(0, 28, W, 76, C['forest'])
rect(0, 28, W, 3, C['amberL'])
text('THE WORLD IN ONE DAY — ISSUE NO. 26', 512, 36, serifb(13), C['amberL'], 'center')
date_size = fit_size('THURSDAY 26 NOVEMBER 2026', _SERIFB, 950, 52)
text('THURSDAY 26 NOVEMBER 2026', 512, 50, serifb(date_size), C['paper'], 'center')
rect(0, 104, W, 3, C['amber'])

# ---- subhead: the three leads in one line
text("US PROPOSES TARIFFS ON 14 · HOUTHIS CLAIM RAS TANURA HIT · MACY'S 100TH PARADE POSTPONED",
     512, 112, sansb(13), C['forest'], 'center')

# ---- stat boxes: number and label on SEPARATE rows with a clear gap
bw = (W - 2 * M - 5 * 8) / 6
by, bh = 134, 60
for i, (num, lab, col) in enumerate(STATS):
    x = M + i * (bw + 8)
    rrect(x, by, bw, bh, 3, C['white'])
    rect(x, by, bw, 3, col)
    text(num, x + bw / 2, by + 8, serifb(28), col, 'center')
    text(lab, x + bw / 2, by + 40, sans(10), C['inkSoft'], 'center')

# ---- region bar
by, bh = 200, 20
x = M
for (name, count, col) in REGIONS:
    w = round((W - 2 * M) * count / 50)
    rect(x, by, w, bh, col)
    text(name + ' ' + str(count), x + w / 2, by + 4, sansb(11), C['white'], 'center')
    x += w

# ---- timeline strip (auto-fit: shrink, then drop the last item if still too wide)
_tl_items = ['26 NOV', 'US PROPOSES TARIFFS ON 14', 'HOUTHIS CLAIM RAS TANURA HIT',
             'CAIRO TANKER FIRE KILLS 31', "MACY'S PARADE POSTPONED", 'FIRST PAKISTANI IN SPACE']
_tl_size = 11
_tl_text = ' · '.join(_tl_items)
while _tl_size > 8 and tw(_tl_text, sansb(_tl_size)) > 960:
    _tl_size -= 1
while tw(_tl_text, sansb(_tl_size)) > 960 and len(_tl_items) > 4:
    _tl_items = _tl_items[:-1]
    _tl_text = ' · '.join(_tl_items)
rect(M, 226, W - 2 * M, 22, C['forestD'])
text(_tl_text, 512, 231, sansb(_tl_size), C['paper'], 'center')

# ---- three leads
ly, lh = 254, 196
lw = (W - 2 * M - 2 * 12) / 3
for i, L in enumerate(LEADS):
    x = M + i * (lw + 12)
    shadow(x, ly, lw, lh)
    rrect(x, ly, lw, lh, 5, C['white'])
    vx, vy, vw, vh = x + 6, ly + 6, lw - 12, 94
    if L['visual'] == 'chart':
        scene_tariff(vx, vy, vw, vh)
    elif L['visual'] == 'refinery':
        scene_refinery(vx, vy, vw, vh)
    else:
        scene_storm(vx, vy, vw, vh)
    rect(vx, vy + vh, vw, 2, C['amber'])
    tag_w = tw(L['tag'], sansb(9)) + 14
    rrect(vx + vw - tag_w - 4, vy + vh - 18, tag_w, 14, 3, L['tagC'])
    text(L['tag'], vx + vw - 4 - tag_w / 2, vy + vh - 15, sansb(9), C['white'], 'center')
    tx, twd = x + 12, lw - 24
    text(str(L['n']) + ' · ' + L['kicker'], tx, ly + 108, sansb(11), C['forest'])
    para(L['head'], tx, ly + 122, serifb(19), C['ink'], twd, 23)
    text(L['deck'], tx, ly + 170, sans(12), C['inkSoft'])
    text('SOURCE: ' + L['src'], tx, ly + 184, sansb(10), C['amber'])

# ---- picture stories: numbered cards with a coloured band
hdr = 'THE DAY IN PICTURES - STORIES 4-15'
text(hdr, M, 452, serifb(14), C['forest'])
line(M + tw(hdr, serifb(14)) + 10, 458, W - M, 458, 2, C['amber'])
cw, ch, gy = 236, 92, 468
for i, P in enumerate(PICS):
    col, row = i % 4, i // 4
    x = M + col * (cw + 10)
    y = gy + row * (ch + 6)
    rrect(x, y, cw, ch, 4, C['paper2'])
    rect(x, y, cw, 22, P['band'])
    text(str(P['n']), x + 8, y + 3, serifb(16), C['white'])
    ICONS[P['icon']](x + cw - 24, y + 3, 16, C['white'])
    tx, twd = x + 8, cw - 16
    text(P['kicker'], tx, y + 25, sansb(9), C['verm'])
    para(P['head'], tx, y + 38, serifb(13), C['ink'], twd, 15)
    text(P['deck'], tx, y + 69, sans(10), C['inkSoft'])
    text(P['src'], tx, y + 81, sansb(9), C['forest'])

# ---- map
hdr = 'WHERE IT HAPPENED'
text(hdr, M, 762, serifb(13), C['forest'])
line(M + tw(hdr, serifb(13)) + 10, 768, 400, 768, 2, C['amber'])
text('1 WASHINGTON · 2 CAIRO · 3 RIYADH · 4 PYONGYANG · 5 KYIV · 6 MUMBAI · 7 CANARY IS. · 8 BEIJING',
     W - M, 763, sans(9), C['inkSoft'], 'right')
draw_map(M, 776, W - 2 * M, 56, PINS)
line(M, 776, W - M, 776, 1, C['amber'])
line(M, 832, W - M, 832, 1, C['amber'])

# ---- briefs: 4 columns x 9 rows, real font with true line height
hdr = 'ALSO ON THURSDAY 26 NOVEMBER — 35 MORE STORIES'
text(hdr, M, 838, serifb(13), C['forest'])
line(M + tw(hdr, serifb(13)) + 10, 844, W - M, 844, 2, C['amber'])
col_w = (W - 2 * M - 3 * 10) / 4
row_h, gy = 13.5, 854
for i, (b, ic) in enumerate(BRIEFS):
    col, row = i // 9, i % 9
    x = M + col * (col_w + 10)
    y = gy + row * row_h
    ICONS[ic](x, y - 1, 8, C['forest'])
    text(fit(b, sans(9), col_w - 16), x + 13, y, sans(9), C['ink'])

# ---- footer: date check
line(M, 974, W - M, 974, 2, C['forest'])
text('DATE CHECK — EVERY STORY ABOVE WAS REPORTED ON THURSDAY 26 NOVEMBER 2026.',
     M, 980, sansb(11), C['verm'])
text('SOURCES: REUTERS · KCNA · KYIV POST · FRANCE 24 · TIMES OF INDIA · GEO NEWS · MIDDLE EAST EYE · 6ABC · FINSCANS · MOSCOW TIMES · UEFA · UN WOMEN · ANI · FEEDCAST · ONETURN',
     M, 994, sans(9), C['inkSoft'])
text('50 STORIES · 10 REGIONS · DRAWN IN CODE · NO PHOTOGRAPHS', M, 1008, sans(10), C['inkSoft'])

# ---------------------------------------------------------------- write it
img = Image.alpha_composite(img.convert('RGBA'), ov).convert('RGB')
img.save('entry.png', optimize=True)
import os
print('entry.png bytes:', os.path.getsize('entry.png'))
print('stories:', len(LEADS) + len(PICS) + len(BRIEFS))
