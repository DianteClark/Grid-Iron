/* Grid Iron — team crests: 32 mascot glyphs, shield crest SVG, field coins */
(function () {
  const GI = window.GI;
  const R = (x, y, w, h, r) => {
    r = r || 0;
    if (!r) return `M${x} ${y}h${w}v${h}h${-w}z`;
    return `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;
  };
  const C = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
  const STARP = (cx, cy, s) => { // 5-point star centred at cx,cy, radius s
    let d = '';
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? s * 0.45 : s;
      d += (i ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy + r * Math.sin(a)).toFixed(1);
    }
    return d + 'z';
  };
  // k: f = ink fill, c = cut-out (shield colour), s = ink stroke (w), cs = cut-out stroke, o = faded ink
  const f = (d) => ({ k: 'f', d }), c = (d) => ({ k: 'c', d }), s = (d, w) => ({ k: 's', d, w }), cs = (d, w) => ({ k: 'cs', d, w }), o = (d, w) => ({ k: 'o', d, w });

  GI.GLYPHS = {
    hat: [f('M8 62c14 10 70 10 84 0-2 9-18 15-42 15S10 71 8 62z'), f('M28 61c-3-22 3-35 12-36 4 0 6 6 10 6s6-6 10-6c9 1 15 14 12 36-14 5-30 5-44 0z'), c('M29 52c13 4 29 4 42 0v6c-13 4-29 4-42 0z')],
    anvil: [f('M12 32h66c6 0 10 4 10 8-7 6-17 8-26 9l-4 11h10v12H32V60h10l-4-11c-10-1-20-4-26-10z'), f(R(26, 74, 48, 8, 3))],
    peaks: [f('M6 78L36 28l14 22 12-16 32 44z'), c('M36 28l9 15-5-2-4 5-5-4-4 2z'), c('M62 34l7 10-4-1-3 3-3-3-3 1z')],
    bridge: [f(R(22, 22, 9, 58, 2)), f(R(69, 22, 9, 58, 2)), f(R(6, 56, 88, 8, 3)), s('M26 26c8 18 40 18 48 0M26 26C20 40 12 50 6 54M74 26c6 14 14 24 20 28', 4.5)],
    wave: [f('M6 70c10-22 26-34 46-30 12 2 18 12 14 20-3 6-12 6-14 0-2-5 2-9 6-8-6-6-20-4-28 6 10-4 18 2 18 10H6z'), f('M6 72c18 6 30-4 44 0s26 6 44-2v12H6z')],
    comet: [f(C(66, 34, 17)), f('M53 45L12 86l30-36-24 6 34-20z'), cs('M58 26a8 8 0 0 1 8-2', 4)],
    twister: [f(R(14, 18, 72, 11, 5.5)), f(R(22, 33, 56, 10, 5)), f(R(30, 47, 42, 9, 4.5)), f(R(38, 60, 28, 8, 4)), f(R(44, 72, 16, 7, 3.5)), f(C(54, 86, 4))],
    scorpion: [f(C(50, 58, 12)), s('M50 48C50 30 62 20 72 24c8 4 6 16-2 16', 7), f('M70 40l-9 3 3-10z'), s('M40 64C30 70 24 78 26 86M60 64c10 6 16 14 14 22', 6), f(C(26, 86, 6)), f(C(74, 86, 6)), s('M38 54H25M38 60H24M62 54h13M62 60h14', 3.5)],
    snake: [s('M28 82C8 72 18 50 40 54c22 4 32-14 18-24-10-7-22 0-18 10', 10), f('M30 31c6-9 21-6 18 5-2 6-13 7-18-5z'), c(C(41, 30, 2.4)), f(C(24, 84, 5.5)), f(C(16, 88, 4.5)), f(C(10, 91, 3.5))],
    fox: [f('M18 18l20 22h24l20-22-4 34-28 32-28-32z'), c('M28 50l22 12 22-12-8 14-14 14-14-14z'), f(C(50, 78, 4)), c(C(40, 52, 3.5)), c(C(60, 52, 3.5))],
    sun: [f('M22 58a28 28 0 0 1 56 0z'), s('M50 14v10M24 24l7 7M76 24l-7 7M12 46h10M78 46h10', 5), f('M6 66c10-6 20-6 30 0s20 6 30 0 18-6 28 0v8c-10 6-18 6-28 0s-20-6-30 0-20 6-30 0z'), f('M6 82c10-6 20-6 30 0s20 6 30 0 18-6 28 0v8c-10 6-18 6-28 0s-20-6-30 0-20 6-30 0z')],
    cactus: [f(R(42, 14, 16, 72, 8)), f('M42 52H30c-6 0-10-4-10-10V30a5 5 0 0 1 10 0v12h12z'), f('M58 60h12c6 0 10-4 10-10V36a5 5 0 0 0-10 0v14H58z'), f(R(24, 84, 52, 6, 3)), cs('M50 22v58', 2.5)],
    horseshoe: [f('M22 22h16v34c0 8 5 14 12 14s12-6 12-14V22h16v34c0 18-12 30-28 30S22 74 22 56z'), f(R(17, 16, 26, 9, 3)), f(R(57, 16, 26, 9, 3)), c(C(30, 36, 2.8)), c(C(30, 50, 2.8)), c(C(70, 36, 2.8)), c(C(70, 50, 2.8)), c(C(37, 68, 2.8)), c(C(63, 68, 2.8))],
    notes: [f(C(30, 76, 11)), f(C(70, 68, 11)), f(R(37, 24, 7, 52)), f(R(77, 16, 7, 52)), f('M37 24L84 14v14L37 38z')],
    fish: [f('M12 50C28 24 66 24 78 50 66 76 28 76 12 50z'), f('M74 50l18-18v36z'), c(C(28, 46, 4.5)), cs('M42 36c5 9 5 19 0 28', 3.5), cs('M54 34c5 10 5 22 0 32', 3)],
    bull: [f('M30 36h40l-4 32c-2 10-8 16-16 16s-14-6-16-16z'), f('M32 40C18 38 8 28 10 14c6 9 14 14 24 16z'), f('M68 40c14-2 24-12 22-26-6 9-14 14-24 16z'), c(C(44, 74, 3)), c(C(56, 74, 3)), c(C(40, 52, 3.4)), c(C(60, 52, 3.4))],
    moon: [f('M62 14a36 36 0 1 0 22 56 30 30 0 1 1-22-56z'), f(STARP(74, 38, 9))],
    axes: [f('M28 88l40-64 8 5-40 64z'), f('M60 18c10-8 26-6 32 6-6 10-16 14-26 12z'), f('M72 88L32 24l-8 5 40 64z'), f('M40 18c-10-8-26-6-32 6 6 10 16 14 26 12z')],
    lighthouse: [f('M38 84l6-48h12l6 48z'), f(R(36, 28, 28, 8, 2)), f(R(42, 16, 16, 12)), f('M40 16l10-9 10 9z'), c(R(41, 48, 18, 6)), c(R(39, 66, 22, 6)), s('M62 22l26-8M62 22l26 8M38 22l-26-8M38 22l-26 8', 3.5), f(R(24, 84, 52, 6, 3))],
    paw: [f('M50 50c14 0 26 14 24 26-2 8-12 8-24 8s-22 0-24-8c-2-12 10-26 24-26z'), f(C(24, 44, 8.5)), f(C(39, 27, 8.5)), f(C(61, 27, 8.5)), f(C(76, 44, 8.5))],
    dice: [f(R(46, 14, 42, 42, 9)), c(C(58, 26, 3.6)), c(C(76, 44, 3.6)), cs(R(12, 34, 48, 48, 10), 5), f(R(12, 34, 48, 48, 10)), c(C(24, 46, 4.2)), c(C(36, 58, 4.2)), c(C(48, 70, 4.2))],
    chevrons: [f(STARP(50, 24, 17)), f('M16 52l34 17 34-17v11L50 80 16 63z'), f('M16 70l34 17 34-17v9L50 96 16 79z')],
    pickaxe: [f('M30 88l38-58 7 5-38 58z'), f('M22 32C38 10 72 8 88 20c-16-2-32 1-44 10-8-2-16 0-22 2z'), f('M14 74l12-8 12 6 2 12-10 8-14-4z')],
    summit: [f('M6 86L42 38l12 14 10-10 30 44z'), c('M42 38l8 10-6-2-4 4-4-4-4 2z'), f(R(41, 8, 4, 32)), f('M45 8h24l-7 7 7 7H45z')],
    lasso: [s('M50 28c22 0 38 8 38 19s-16 19-38 19-38-8-38-19 16-19 38-19z', 7), f(C(50, 66, 7)), s('M50 70c-6 10 6 14 0 24', 6)],
    foot: [f('M34 42c0-12 10-18 20-16s16 12 14 26c-2 12-4 20-2 30 1 8-6 12-14 12s-14-6-14-14c0-12 2-20-4-38z'), f(C(31, 24, 6.5)), f(C(43, 15, 6.5)), f(C(56, 12, 6.2)), f(C(68, 16, 5.6)), f(C(77, 25, 5))],
    arch: [s('M20 88C24 38 38 14 50 14s26 24 30 74', 11), f(R(10, 86, 80, 7, 3))],
    derrick: [s('M30 86L50 14l20 72M37 62h26M41 44h18M45 28h10M37 62l22-18M63 62L41 44', 5), f(R(18, 84, 64, 7, 3)), f('M50 14c-7-6-5-13 0-13s7 7 0 13z')],
    aurora: [s('M8 38c14-10 28 10 42 0s28 10 42 0', 7), o('M8 54c14-10 28 10 42 0s28 10 42 0', 6), f('M4 92l26-26 12 10 18-20 36 36z'), f(STARP(80, 16, 7))],
    crystal: [f('M28 32l22-20 22 20-22 60z'), cs('M28 32h44M50 12l-9 20 9 60 9-60z', 3)],
    ghost: [f('M22 88V44c0-18 12-30 28-30s28 12 28 30v44l-9-8-9 8-10-8-10 8-9-8z'), c(C(40, 42, 5.5)), c(C(60, 42, 5.5)), c(C(50, 62, 6))],
    wings: [f(C(50, 50, 11)), f('M39 46C29 39 15 39 4 43c10 2 18 6 22 10-8-2-16 0-20 5 10 0 18 2 24 8z'), f('M61 46c10-7 24-7 35-3-10 2-18 6-22 10 8-2 16 0 20 5-10 0-18 2-24 8z'), c(STARP(50, 50, 6))],
  };
  GI.TEAM_GLYPH = ['hat', 'anvil', 'peaks', 'bridge', 'wave', 'comet', 'twister', 'scorpion', 'snake', 'fox', 'sun', 'cactus', 'horseshoe', 'notes', 'fish', 'bull', 'moon', 'axes', 'lighthouse', 'paw', 'dice', 'chevrons', 'pickaxe', 'summit', 'lasso', 'foot', 'arch', 'derrick', 'aurora', 'crystal', 'ghost', 'wings'];

  const lum = (h) => { const n = parseInt(h.slice(1), 16); return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
  GI.inkOn = (bg) => (lum(bg) > 0.62 ? '#1d1d1f' : '#ffffff');

  // glyph as SVG elements (100x100 box)
  GI.glyphSVG = function (name, ink, cut) {
    return (GI.GLYPHS[name] || []).map((p) => {
      if (p.k === 'f') return `<path d="${p.d}" fill="${ink}"></path>`;
      if (p.k === 'c') return `<path d="${p.d}" fill="${cut}"></path>`;
      if (p.k === 's') return `<path d="${p.d}" fill="none" stroke="${ink}" stroke-width="${p.w}" stroke-linecap="round" stroke-linejoin="round"></path>`;
      if (p.k === 'o') return `<path d="${p.d}" fill="none" stroke="${ink}" stroke-opacity=".55" stroke-width="${p.w}" stroke-linecap="round"></path>`;
      return `<path d="${p.d}" fill="none" stroke="${cut}" stroke-width="${p.w}" stroke-linecap="round" stroke-linejoin="round"></path>`;
    }).join('');
  };
  // canvas: draw a glyph into a box centred at (x,y) of size `size`
  const P2D = {};
  GI.drawGlyph = function (g, name, x, y, size, ink, cut) {
    const parts = GI.GLYPHS[name];
    if (!parts || typeof Path2D === 'undefined') return;
    g.save(); g.translate(x - size / 2, y - size / 2); g.scale(size / 100, size / 100);
    g.lineCap = 'round'; g.lineJoin = 'round';
    parts.forEach((p, i) => {
      const key = name + i;
      const path = P2D[key] || (P2D[key] = new Path2D(p.d));
      if (p.k === 'f') { g.fillStyle = ink; g.fill(path); }
      else if (p.k === 'c') { g.fillStyle = cut; g.fill(path); }
      else if (p.k === 's' || p.k === 'o') { g.strokeStyle = ink; g.globalAlpha = p.k === 'o' ? 0.55 : 1; g.lineWidth = p.w; g.stroke(path); g.globalAlpha = 1; }
      else { g.strokeStyle = cut; g.lineWidth = p.w; g.stroke(path); }
    });
    g.restore();
  };

  // ---------- shield crest (UI) ----------
  const SHIELD = 'M60 8 104 22v34c0 32-20 54-44 66C36 110 16 88 16 56V22z';
  let uid = 0;
  GI.crestSVG = function (t, cls, opts) {
    opts = opts || {};
    const id = 'cr' + (++uid);
    const c1 = t.c1, c2 = t.c2;
    const ink = GI.inkOn(c1);
    const glyph = t.glyph || GI.TEAM_GLYPH[t.idx] || 'hat';
    const ribbon = opts.ribbon !== false;
    const label = (t.abbr || '').slice(0, 4);
    return `<svg class="crest ${cls || ''}" viewBox="0 0 120 ${ribbon ? 126 : 128}" role="img" aria-label="${t.city || ''} ${t.name || ''} crest">
      <defs><clipPath id="${id}"><path d="${SHIELD}"></path></clipPath></defs>
      <path d="${SHIELD}" transform="translate(4 5)" fill="#000" opacity=".2"></path>
      <path d="${SHIELD}" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"></path>
      <path d="${SHIELD}" fill="${c1}"></path>
      <g clip-path="url(#${id})"><path d="M0 0h60v134H0z" fill="#fff" opacity=".08"></path><path d="${SHIELD}" fill="none" stroke="${c2}" stroke-width="7"></path></g>
      <g transform="translate(25 ${ribbon ? 20 : 26}) scale(.7)">${GI.glyphSVG(glyph, ink, c1)}</g>
      ${ribbon ? `<path d="M8 96h104l-8 9 8 9H8l8-9z" fill="#fff"></path><path d="M12 99h96l-6 6 6 6H12l6-6z" fill="${c2}"></path>
      <text x="60" y="105.5" text-anchor="middle" dominant-baseline="central" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="800" font-style="italic" font-size="14" letter-spacing="1" fill="${GI.inkOn(c2)}">${label}</text>` : ''}
    </svg>`;
  };

})();
