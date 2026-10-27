/* Grid Iron — sticker field renderer and play animations */
(function () {
  const GI = window.GI;
  const W_YD = 53.3, CX = 26.65, MARGIN = 2.2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  // offense-relative formations: [x offset from center, y relative to LOS (+ = downfield)]
  const FO = { LT: [-4.4, -1], LG: [-2.2, -1], C: [0, -1], RG: [2.2, -1], RT: [4.4, -1], TE: [6.8, -1.3], QB: [0, -5], RB: [2.4, -5.2], WR1: [-19, -1.2], WR2: [19, -1.2], WR3: [-12, -1.8] };
  const FD0 = { DE1: [-5.5, 1], DT1: [-1.6, 1], DT2: [1.6, 1], DE2: [5.5, 1], MLB: [0, 5], WLB: [-6, 4.5], SLB: [6, 4.5], CB1: [-19, 6], CB2: [19, 6], FS: [-9, 13], SS: [9, 12] };
  function FD(call) {
    const f = JSON.parse(JSON.stringify(FD0));
    if (call === 'deep') { f.CB1[1] = 9; f.CB2[1] = 9; f.FS = [-11, 18]; f.SS = [11, 18]; f.MLB[1] = 6; }
    if (call === 'press') { f.CB1 = [-19, 1.6]; f.CB2 = [19, 1.6]; f.WLB = [-11.5, 3]; }
    if (call === 'man') { f.CB1[1] = 4; f.CB2[1] = 4; f.WLB = [-11, 4]; f.SS = [6, 9]; }
    if (call === 'blitz_in') { f.MLB = [0, 2.2]; f.WLB = [-2.2, 2.4]; f.SLB = [2.2, 2.4]; }
    if (call === 'blitz_out') { f.WLB = [-8, 1.8]; f.SLB = [8, 1.8]; f.DE1 = [-4.5, 1]; f.DE2 = [4.5, 1]; }
    return f;
  }
  const KO_O = ['LT', 'LG', 'C', 'RG', 'RT', 'TE', 'QB', 'WR1', 'WR2', 'WR3', 'RB'];

  function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function cdist(a, b) { const x = hexToRgb(a), y = hexToRgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); }
  function lum(h) { const [r, g, b] = hexToRgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
  GI.lum = lum;

  class Field {
    constructor(canvas) {
      this.cv = canvas; this.ctx = canvas.getContext('2d');
      this.cam = 50; this.camTarget = 50; this.anim = null; this.pops = []; this.confetti = []; this.wx = [];
      this.players = []; this.ball = null; this.lines = null; this.weather = 'clear';
      this.speed = 1; this.paused = false;
      this.resize();
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(canvas.parentElement);
      this.last = performance.now();
      const loop = (t) => { this.frame(t); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
    resize() {
      const p = this.cv.parentElement, r = p.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      this.w = Math.max(100, r.width); this.h = Math.max(100, r.height); this.dpr = dpr;
      this.cv.width = Math.round(this.w * dpr); this.cv.height = Math.round(this.h * dpr);
      this.cv.style.width = this.w + 'px'; this.cv.style.height = this.h + 'px';
      // pixels per yard: fit width, but keep at least ~32 yards visible vertically
      this.ppy = Math.min(this.w / (W_YD + MARGIN * 2), this.h / 44);
      this.ox = (this.w - W_YD * this.ppy) / 2;
      this.fieldCache = null;
    }
    setTeams(user, opp) {
      this.user = user; this.opp = opp;
      this.colors = { user: user.c1, opp: cdist(user.c1, opp.c1) < 110 ? opp.c2 : opp.c1 };
      if (cdist(this.colors.user, this.colors.opp) < 90) this.colors.opp = '#f4f1ea';
      this.fieldCache = null;
    }
    setWeather(w) { this.weather = w; this.wx = []; }
    sx(x) { return this.ox + x * this.ppy; }
    sy(y) { return this.h / 2 - (y - this.cam) * this.ppy; }

    // ---------- static field (cached) ----------
    buildField() {
      const ppy = this.ppy, dpr = this.dpr;
      const c = document.createElement('canvas');
      const pad = 3;
      c.width = Math.ceil((W_YD + pad * 2) * ppy * dpr); c.height = Math.ceil((120 + pad * 2) * ppy * dpr);
      const g = c.getContext('2d');
      g.scale(dpr, dpr);
      const X = (x) => (x + pad) * ppy, Y = (y) => (110 - y + pad) * ppy; // y in -10..110
      // sticker border + shadow
      g.fillStyle = 'rgba(0,0,0,.16)';
      rr(g, X(-1.0) + 4, Y(111) + 5, (W_YD + 2) * ppy, 122 * ppy, 18); g.fill();
      g.fillStyle = '#fff';
      rr(g, X(-1.0), Y(111), (W_YD + 2) * ppy, 122 * ppy, 18); g.fill();
      // turf stripes
      for (let y = -10; y < 110; y += 5) {
        g.fillStyle = (Math.floor((y + 10) / 5) % 2) ? '#4fae5a' : '#47a352';
        g.fillRect(X(0), Y(y + 5), W_YD * ppy, 5 * ppy);
      }
      // end zones
      const ez = (y0, team, flip) => {
        g.fillStyle = team.c1; g.fillRect(X(0), Y(y0 + 10), W_YD * ppy, 10 * ppy);
        g.save();
        g.translate(X(CX), Y(y0 + 5)); if (flip) g.rotate(Math.PI);
        g.font = `${Math.round(ppy * 5.2)}px "Lilita One", system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = ppy * 0.9; g.strokeStyle = '#fff'; g.lineJoin = 'round';
        const txt = team.name.toUpperCase();
        g.strokeText(txt, 0, ppy * 0.3); g.fillStyle = lum(team.c1) > 0.6 ? '#1d1d1f' : team.c2; g.fillText(txt, 0, ppy * 0.3);
        g.restore();
      };
      if (this.user) { ez(-10, this.user, false); ez(100, this.opp, false); }
      // lines
      g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineCap = 'round';
      for (let y = 0; y <= 100; y += 5) {
        g.lineWidth = y === 0 || y === 100 ? 3 : y % 10 === 0 ? 2 : 1.4;
        g.beginPath(); g.moveTo(X(0.4), Y(y)); g.lineTo(X(W_YD - 0.4), Y(y)); g.stroke();
      }
      g.lineWidth = 1;
      for (let y = 1; y < 100; y++) {
        if (y % 5 === 0) continue;
        [[0.6, 1.4], [W_YD - 1.4, W_YD - 0.6], [22.9, 23.9], [29.4, 30.4]].forEach(([a, b]) => { g.beginPath(); g.moveTo(X(a), Y(y)); g.lineTo(X(b), Y(y)); g.stroke(); });
      }
      // numbers
      g.fillStyle = 'rgba(255,255,255,.9)'; g.font = `${Math.round(ppy * 2.2)}px "Lilita One", system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let y = 10; y <= 90; y += 10) {
        const n = String(y <= 50 ? y : 100 - y);
        [[7, Math.PI / 2], [W_YD - 7, -Math.PI / 2]].forEach(([x, rot]) => { g.save(); g.translate(X(x), Y(y)); g.rotate(rot); g.fillText(n, 0, 0); g.restore(); });
      }
      // midfield sticker logo
      if (this.user) {
        const r = ppy * 4.2;
        g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.arc(X(CX) + 3, Y(50) + 4, r, 0, 7); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(X(CX), Y(50), r, 0, 7); g.fill();
        g.fillStyle = this.user.c1; g.beginPath(); g.arc(X(CX), Y(50), r - ppy * 0.55, 0, 7); g.fill();
        g.fillStyle = lum(this.user.c1) > 0.6 ? '#1d1d1f' : '#fff'; g.font = `${Math.round(ppy * 2.6)}px "Lilita One", system-ui, sans-serif`;
        g.fillText(this.user.abbr, X(CX), Y(50) + ppy * 0.15);
      }
      // goal posts (top-down)
      [-10, 110].forEach((y) => {
        g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(X(CX - 3.1) + 2, Y(y) + 3); g.lineTo(X(CX + 3.1) + 2, Y(y) + 3); g.stroke();
        g.strokeStyle = '#ffd23f'; g.lineWidth = 3.5;
        g.beginPath(); g.moveTo(X(CX - 3.1), Y(y)); g.lineTo(X(CX + 3.1), Y(y)); g.stroke();
        g.fillStyle = '#ffd23f'; [CX - 3.1, CX + 3.1].forEach((x) => { g.beginPath(); g.arc(X(x), Y(y), 3.2, 0, 7); g.fill(); });
      });
      this.fieldCache = { c, pad };
    }

    // ---------- idle formation ----------
    showFormation(G) {
      this.anim = null;
      const offSide = G.phase === 'kickoff' ? G.kickTeam : G.poss;
      const up = offSide === G.user;
      const dir = up ? 1 : -1;
      const ballOn = G.phase === 'kickoff' ? (G.freeKick ? 20 : 35) : G.phase === 'pat' ? 85 : G.ballOn;
      const los = up ? ballOn : 100 - ballOn;
      this.ctxPlay = { los, dir, offSide, G };
      const oc = up ? this.colors.user : this.colors.opp, dc = up ? this.colors.opp : this.colors.user;
      const ot = G.teams[offSide], dt = G.teams[GI.util.other(offSide)];
      const pts = {};
      if (G.phase === 'kickoff') {
        KO_O.forEach((r, i) => (pts['o:' + r] = [(i - 5) * 4.4, -1]));
        pts['o:QB'] = [0, -6];
        Object.keys(FD0).forEach((r, i) => (pts['d:' + r] = [((i % 6) - 2.5) * 8, 22 + Math.floor(i / 6) * 12]));
        pts['d:FS'] = [0, 62];
      } else {
        for (const r in FO) pts['o:' + r] = FO[r].slice();
        const fd = FD('zone');
        for (const r in fd) pts['d:' + r] = fd[r].slice();
        if (G.phase === 'pat') { pts['o:QB'] = [0, -7]; pts['o:RB'] = [-1.5, -9.5]; }
      }
      this.players = Object.keys(pts).map((id) => this.mkPlayer(id, pts[id], id[0] === 'o' ? ot : dt, id[0] === 'o' ? oc : dc));
      this.lines = G.phase === 'play' ? { los, fd: G.twoPt ? null : los + dir * G.toGo, dir } : null;
      if (this.lines && this.lines.fd != null && (this.lines.fd >= 100 || this.lines.fd <= 0)) this.lines.fd = null;
      const holder = G.phase === 'kickoff' ? 'o:QB' : 'o:C';
      this.ball = { hold: holder };
      this.camTarget = clamp(los + dir * 6, -2, 102);
    }
    mkPlayer(id, p, team, color) {
      const role = id.slice(2);
      const star = team.stars.find((s) => s.role === role && !s.injured);
      return { id, role, side: id[0], rx: p[0], ry: p[1], color, star: !!star, num: star ? star.num : null, armed: star && star.armed };
    }
    toAbs(rx, ry) {
      const { los, dir } = this.ctxPlay;
      return [dir === 1 ? CX + rx : CX - rx, los + dir * ry];
    }

    // ---------- animation ----------
    runPlay(res, G) {
      return new Promise((resolve) => {
        if (!res || ['penalty', 'setup2'].includes(res.kind)) {
          if (res && res.kind === 'penalty') this.pop('FLAG!', null, 'warn');
          setTimeout(resolve, res && res.kind === 'penalty' ? 700 / this.speed : 50);
          return;
        }
        const offSide = res.side;
        const up = offSide === G.user;
        this.ctxPlay = { los: res.los, dir: res.dir, offSide, G };
        const ot = G.teams[offSide], dt = G.teams[GI.util.other(offSide)];
        const oc = up ? this.colors.user : this.colors.opp, dc = up ? this.colors.opp : this.colors.user;
        const S = build(res);
        const ids = Object.keys(S.tracks);
        this.players = ids.map((id) => this.mkPlayer(id, S.tracks[id][0].slice(1), id[0] === 'o' ? ot : dt, id[0] === 'o' ? oc : dc));
        this.lines = (res.kind === 'kickoff') ? null : { los: res.los, fd: res.toGo && !(res.kind === 'fg' || res.kind === 'xp' || res.kind === 'punt') ? res.los + res.dir * res.toGo : null, dir: res.dir };
        if (this.lines && this.lines.fd != null && (this.lines.fd >= 100 || this.lines.fd <= 0)) this.lines.fd = null;
        this.pops = [];
        this.anim = { S, t: 0, dur: S.dur, resolve, firedPops: new Set(), res };
        if (this.speed >= 99) this.finish();
      });
    }
    finish() {
      if (!this.anim) return;
      const a = this.anim;
      if (a.t < a.dur - 0.01) { // skipped: only show the final pop
        const lastI = a.S.pops.length - 1;
        a.S.pops.forEach((_, i) => { if (i !== lastI) a.firedPops.add(i); });
        this.pops = [];
      }
      a.t = a.dur; this.applyAnim(a.dur);
      this.anim = null;
      a.resolve();
    }
    applyAnim(t) {
      const S = this.anim.S;
      this.players.forEach((p) => { const pos = sample(S.tracks[p.id], t); p.rx = pos[0]; p.ry = pos[1]; });
      // ball
      let seg = S.ball[S.ball.length - 1];
      for (const s of S.ball) if (t >= s.t0 && t <= s.t1) { seg = s; break; }
      if (t > seg.t1) seg = S.ball[S.ball.length - 1];
      if (seg.type === 'hold') this.ball = { hold: seg.who };
      else if (seg.type === 'air') {
        const u = clamp((t - seg.t0) / (seg.t1 - seg.t0), 0, 1);
        this.ball = { rx: lerp(seg.from[0], seg.to[0], u), ry: lerp(seg.from[1], seg.to[1], u), h: 4 * seg.h * u * (1 - u), spin: u };
      } else if (seg.type === 'ground') this.ball = { rx: seg.at[0], ry: seg.at[1], h: 0, loose: true };
      // pops
      S.pops.forEach((p, i) => {
        if (t >= p.t && !this.anim.firedPops.has(i)) {
          this.anim.firedPops.add(i);
          const at = p.at ? this.toAbs(p.at[0], p.at[1]) : this.ballAbs();
          this.pop(p.text, at, p.tone);
          if (p.confetti) this.burst(at, p.confetti);
        }
      });
    }
    ballAbs() {
      const b = this.ball;
      if (!b) return [CX, this.cam];
      if (b.hold) { const p = this.players.find((q) => q.id === b.hold); if (p) return this.toAbs(p.rx, p.ry); return [CX, this.cam]; }
      return this.toAbs(b.rx, b.ry);
    }
    pop(text, at, tone) {
      const p = at || [CX, this.cam];
      this.pops.push({ text, x: p[0], y: p[1], t: 0, tone: tone || 'plain', rot: rnd(-0.12, 0.12) });
    }
    burst(at, colors) {
      for (let i = 0; i < 70; i++) this.confetti.push({ x: at[0], y: at[1], vx: rnd(-14, 14), vy: rnd(4, 22), r: rnd(0.25, 0.55), c: colors[i % colors.length], t: 0, rot: rnd(0, 6), vr: rnd(-8, 8) });
    }

    // ---------- frame ----------
    frame(now) {
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
      if (this.anim && !this.paused) {
        this.anim.t += dt * this.speed;
        if (this.anim.t >= this.anim.dur) { this.finish(); }
        else this.applyAnim(this.anim.t);
      }
      if (this.ctxPlay) {
        const b = this.ballAbs(), half = this.h / this.ppy / 2;
        this.camTarget = half > 62 ? 50 : clamp(b[1] + (this.ctxPlay.dir || 1) * 2, half - 14, 114 - half);
      }
      this.cam += (this.camTarget - this.cam) * Math.min(1, dt * 4);
      this.draw(dt);
    }
    draw(dt) {
      const g = this.ctx, ppy = this.ppy;
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      g.clearRect(0, 0, this.w, this.h);
      if (!this.fieldCache) this.buildField();
      const fc = this.fieldCache;
      const top = (110 - (this.cam + this.h / 2 / ppy) + fc.pad) * ppy;
      g.drawImage(fc.c, this.ox - fc.pad * ppy, -top, fc.c.width / this.dpr, fc.c.height / this.dpr);
      if (!this.ctxPlay) return;
      // lines
      if (this.lines) {
        const L = (y, col) => { g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.moveTo(this.sx(0.3), this.sy(y)); g.lineTo(this.sx(W_YD - 0.3), this.sy(y)); g.stroke(); };
        L(this.lines.los, 'rgba(61,124,255,.9)');
        if (this.lines.fd != null) L(this.lines.fd, 'rgba(255,210,63,.95)');
      }
      const r = Math.max(4.5, ppy * 0.82);
      // players sorted by screen y
      const list = this.players.map((p) => { const a = this.toAbs(p.rx, p.ry); return { p, x: this.sx(a[0]), y: this.sy(a[1]) }; }).sort((a, b) => a.y - b.y);
      list.forEach(({ x, y }) => { g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.arc(x + r * 0.28, y + r * 0.38, r + 1.5, 0, 7); g.fill(); });
      list.forEach(({ p, x, y }) => {
        if (p.star) { g.fillStyle = '#ffc93c'; g.beginPath(); g.arc(x, y, r + 3.6, 0, 7); g.fill(); }
        g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, r + 2, 0, 7); g.fill();
        g.fillStyle = p.color; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.35, r * 0.38, 0, 7); g.fill();
        if (p.star && r > 6) {
          g.fillStyle = lum(p.color) > 0.62 ? '#1d1d1f' : '#fff';
          g.font = `${Math.round(r * 1.05)}px "Lilita One", system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(p.num, x, y + 0.5);
        }
      });
      // ball
      if (this.ball) {
        const a = this.ballAbs();
        const bx = this.sx(a[0]), by = this.sy(a[1]);
        const h = this.ball.h || 0;
        const s = Math.max(3.2, ppy * 0.42) * (1 + h / 14);
        if (h > 0.2) { g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(bx, by, s, s * 0.6, 0, 0, 7); g.fill(); }
        const yy = by - h * ppy * 0.55 + (this.ball.hold ? -r * 0.1 : 0), xx = bx + (this.ball.hold ? r * 0.55 : 0);
        g.save(); g.translate(xx, yy); g.rotate(this.ball.spin ? this.ball.spin * 12 : -0.6);
        g.fillStyle = '#fff'; g.beginPath(); g.ellipse(0, 0, s * 1.25 + 1.6, s * 0.8 + 1.6, 0, 0, 7); g.fill();
        g.fillStyle = '#8b4a24'; g.beginPath(); g.ellipse(0, 0, s * 1.25, s * 0.8, 0, 0, 7); g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 1; g.beginPath(); g.moveTo(-s * 0.45, 0); g.lineTo(s * 0.45, 0); g.stroke();
        g.restore();
      }
      // confetti
      this.confetti = this.confetti.filter((c) => (c.t += dt) < 2.4);
      this.confetti.forEach((c) => {
        c.x += c.vx * dt; c.y += c.vy * dt; c.vy -= 16 * dt; c.vx *= 0.985; c.rot += c.vr * dt;
        g.save(); g.translate(this.sx(c.x), this.sy(c.y)); g.rotate(c.rot); g.fillStyle = c.c;
        g.fillRect(-c.r * ppy, -c.r * ppy * 0.5, c.r * ppy * 2, c.r * ppy); g.restore();
      });
      this.drawWeather(g, dt);
      // pops
      this.pops = this.pops.filter((p) => (p.t += dt) < 1.6);
      this.pops.forEach((p) => {
        const k = Math.min(1, p.t / 0.18), fade = p.t > 1.25 ? 1 - (p.t - 1.25) / 0.35 : 1;
        const sc = 0.6 + 0.4 * (1 - Math.pow(1 - k, 3)) + (k < 1 ? 0.12 * Math.sin(k * Math.PI) : 0);
        const x = clamp(this.sx(p.x), 70, this.w - 70), y = this.sy(p.y) - 26 - p.t * 14;
        g.save(); g.globalAlpha = Math.max(0, fade); g.translate(x, y); g.rotate(p.rot); g.scale(sc, sc);
        g.font = `${Math.max(15, Math.round(ppy * 2))}px "Lilita One", system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        const tw = g.measureText(p.text).width + 18, th = Math.max(26, ppy * 2.9);
        const bg = { good: '#2fb36b', bad: '#ff5a4e', warn: '#ffc93c', star: '#ffc93c', plain: '#1d1d1f' }[p.tone] || '#1d1d1f';
        g.fillStyle = 'rgba(0,0,0,.22)'; rr(g, -tw / 2 + 3, -th / 2 + 4, tw, th, th / 2.4); g.fill();
        g.fillStyle = '#fff'; rr(g, -tw / 2 - 3, -th / 2 - 3, tw + 6, th + 6, th / 2.2); g.fill();
        g.fillStyle = bg; rr(g, -tw / 2, -th / 2, tw, th, th / 2.4); g.fill();
        g.fillStyle = p.tone === 'warn' || p.tone === 'star' ? '#1d1d1f' : '#fff'; g.fillText(p.text, 0, 1);
        g.restore();
      });
    }
    drawWeather(g, dt) {
      const w = this.weather;
      if (w === 'clear') return;
      const target = w === 'rain' ? 90 : w === 'snow' ? 70 : w === 'wind' ? 26 : 0;
      while (this.wx.length < target) this.wx.push({ x: Math.random() * this.w, y: Math.random() * this.h, s: rnd(0.6, 1.4) });
      if (w === 'heat') {
        const gr = g.createRadialGradient(this.w / 2, this.h / 2, this.h * 0.3, this.w / 2, this.h / 2, this.h * 0.8);
        gr.addColorStop(0, 'rgba(255,150,40,0)'); gr.addColorStop(1, 'rgba(255,120,30,.16)');
        g.fillStyle = gr; g.fillRect(0, 0, this.w, this.h); return;
      }
      g.save();
      this.wx.forEach((p) => {
        if (w === 'rain') {
          p.y += 520 * p.s * dt; p.x -= 90 * dt; if (p.y > this.h) { p.y = -10; p.x = Math.random() * (this.w + 60); }
          g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - 3, p.y + 12 * p.s); g.stroke();
        } else if (w === 'snow') {
          p.y += 50 * p.s * dt; p.x += Math.sin((p.y + p.s * 100) / 30) * 18 * dt; if (p.y > this.h) { p.y = -6; p.x = Math.random() * this.w; }
          g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(p.x, p.y, 1.6 * p.s + 0.6, 0, 7); g.fill();
        } else if (w === 'wind') {
          p.x += 420 * p.s * dt; if (p.x > this.w + 40) { p.x = -60; p.y = Math.random() * this.h; }
          g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(p.x, p.y); g.quadraticCurveTo(p.x + 20, p.y - 4, p.x + 44 * p.s, p.y); g.stroke();
        }
      });
      g.restore();
    }
  }
  GI.Field = Field;

  function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function sample(tr, t) {
    if (!tr || !tr.length) return [0, 0];
    if (t <= tr[0][0]) return [tr[0][1], tr[0][2]];
    for (let i = 1; i < tr.length; i++) {
      if (t <= tr[i][0]) {
        const a = tr[i - 1], b = tr[i];
        let u = (t - a[0]) / Math.max(1e-6, b[0] - a[0]);
        if (i === tr.length - 1) u = 1 - (1 - u) * (1 - u);
        return [lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
      }
    }
    const l = tr[tr.length - 1];
    return [l[1], l[2]];
  }

  // ================= play builders =================
  // All coordinates are offense-relative: x offset from center, y yards past the line of scrimmage.
  function build(res) {
    const T = {}, ball = [], pops = [];
    const at = (id) => { const tr = T[id]; const l = tr[tr.length - 1]; return [l[1], l[2]]; };
    const go = (id, t, x, y) => { T[id].push([t, x, y]); };
    const stay = (id, t) => { const p = at(id); go(id, t, p[0], p[1]); };
    const ctx = { T, ball, pops, at, go, stay };
    const k = res.kind;
    if (k === 'kickoff') buildKickoff(res, ctx);
    else if (k === 'punt') buildPunt(res, ctx);
    else if (k === 'fg' || k === 'xp') buildKick(res, ctx);
    else buildScrimmage(res, ctx);
    let dur = 0;
    for (const id in T) dur = Math.max(dur, T[id][T[id].length - 1][0]);
    ball.forEach((b) => (dur = Math.max(dur, b.t1)));
    dur += 0.55;
    for (const id in T) stay(id, dur);
    return { tracks: T, ball, pops, dur };
  }

  function initScrim(ctx, def) {
    for (const r in FO) ctx.T['o:' + r] = [[0, FO[r][0], FO[r][1]]];
    const z = FD('zone'), f = FD(def);
    for (const r in z) ctx.T['d:' + r] = [[0, z[r][0], z[r][1]], [0.35, f[r][0], f[r][1]], [0.45, f[r][0], f[r][1]]];
    for (const r in FO) ctx.go('o:' + r, 0.45, FO[r][0], FO[r][1]);
  }
  const DROLES = Object.keys(FD0);
  const OROLES = Object.keys(FO);

  function pursue(ctx, roles, t, target, tackler, prefix, tight) {
    roles.forEach((r) => {
      const id = prefix + r;
      const p = ctx.at(id);
      if (r === tackler) { ctx.go(id, t, target[0] + 0.4, target[1] + (prefix === 'd:' ? 0.9 : -0.9)); return; }
      const d = Math.hypot(p[0] - target[0], p[1] - target[1]);
      const kk = clamp((tight || 1) * (1 - d / 45), 0.3, 0.88);
      ctx.go(id, t, lerp(p[0], target[0], kk) + rnd(-1.5, 1.5), lerp(p[1], target[1], kk) + rnd(-1, 1));
    });
  }

  function buildScrimmage(res, ctx) {
    const { go, stay, at, ball, pops } = ctx;
    initScrim(ctx, res.def);
    const S = 0.5; // snap
    const blitz = res.def === 'blitz_in' || res.def === 'blitz_out';
    ball.push({ type: 'hold', who: 'o:C', t0: 0, t1: S });
    ball.push({ type: 'air', from: [0, -1], to: [0, -5], h: 0.4, t0: S, t1: S + 0.14 });
    const isRunPlay = res.kind === 'run' && !res.trick;
    // default OL / DL engagement
    ['LT', 'LG', 'C', 'RG', 'RT'].forEach((r) => { const p = at('o:' + r); go('o:' + r, S + 0.35, p[0] * 1.05, isRunPlay ? 0 : -2.2); });
    ['DE1', 'DT1', 'DT2', 'DE2'].forEach((r) => { const p = at('d:' + r); go('d:' + r, S + 0.35, p[0] * 0.95, isRunPlay ? 0.3 : -0.8); });
    if (res.pancake) { const p = at('o:' + res.pancake); go('o:' + res.pancake, S + 0.8, p[0], 4); pops.push({ t: S + 0.6, text: 'PANCAKE!', tone: 'star', at: [p[0], 3] }); const dl = 'd:' + (res.pancake === 'C' ? 'DT1' : res.pancake === 'LT' ? 'DE1' : 'DE2'); const q = at(dl); go(dl, S + 0.8, q[0], 5.2); }
    const endTone = res.side === res.G_user ? 'good' : 'bad';

    if (res.kind === 'run') {
      const Y = res.yards;
      const side = res.off === 'out_run' ? (Math.random() < 0.5 ? -1 : 1) : 0;
      ball.push({ type: 'hold', who: 'o:QB', t0: S + 0.14, t1: S + 0.4 });
      go('o:RB', S + 0.4, 0.8, -4.8);
      ball.push({ type: 'hold', who: 'o:RB', t0: S + 0.4, t1: 99 });
      go('o:QB', S + 0.4, 0.4, -5.2); go('o:QB', S + 1.1, -3, -6.5);
      const tc = S + 1.05 + Math.min(2.6, Math.abs(Y) * 0.05);
      let end;
      if (side === 0) {
        go('o:RB', S + 0.75, 0.4, -0.6);
        end = [clamp(rnd(-3, 3) + (Y > 15 ? rnd(-8, 8) : 0), -24, 24), Y];
      } else {
        go('o:RB', S + 0.8, side * 8, -3.2);
        if (Y > 2) go('o:RB', S + 1.1, side * 12, 1);
        end = [side * (Y > 2 ? clamp(13 + Y * 0.08, 10, 22) : 9), Y];
      }
      go('o:RB', tc, end[0], end[1]);
      ['WR1', 'WR2', 'WR3', 'TE'].forEach((r) => { const p = at('o:' + r); go('o:' + r, S + 0.9, p[0] * 0.92, p[1] + 6); go('o:' + r, tc, lerp(p[0], end[0], 0.3), Math.min(end[1], p[1] + 9)); });
      ['LT', 'LG', 'C', 'RG', 'RT'].forEach((r) => { if (r === res.pancake) return; const p = at('o:' + r); go('o:' + r, tc, p[0] + side * 1.5, Math.max(0.2, Math.min(2, Y / 4))); });
      const tackler = res.by || nearest(ctx, DROLES, end, 'd:');
      pursue(ctx, DROLES, tc, end, tackler, 'd:');
      if (blitz) pops.push({ t: S + 0.3, text: 'BLITZ!', tone: 'warn', at: [0, 2] });
      if (res.fumble && res.fumble !== 'kept') {
        const loose = [end[0] + rnd(-2, 2), end[1] + rnd(-1.5, 1.5)];
        ball[ball.length - 1].t1 = tc;
        ball.push({ type: 'air', from: end, to: loose, h: 0.8, t0: tc, t1: tc + 0.25 });
        pops.push({ t: tc, text: 'FUMBLE!', tone: 'warn' });
        const rec = res.recD ? (res.by || tackler) : 'RB';
        const rid = (res.recD ? 'd:' : 'o:') + rec;
        go(rid, tc + 0.25, loose[0], loose[1]);
        ball.push({ type: 'hold', who: rid, t0: tc + 0.25, t1: 99 });
        if (res.recD) returnRun(ctx, rid, loose, res, tc + 0.25);
      } else {
        pops.push({ t: tc, text: res.td ? 'TOUCHDOWN!' : (Y > 0 ? '+' : '') + Y + (Math.abs(Y) === 1 ? ' YD' : ' YDS'), tone: res.td ? 'good' : Y >= 4 ? 'good' : Y <= 0 ? 'bad' : 'plain', confetti: res.td ? [res.color1 || '#ffc93c', '#fff', '#ffc93c'] : null });
      }
      return;
    }

    // passing family
    const drop = res.trick ? 0.9 : 0.62;
    ball.push({ type: 'hold', who: 'o:QB', t0: S + 0.14, t1: S + drop + 0.45 });
    go('o:QB', S + drop, 0, -7.5);
    if (res.trick) { // flea flicker: hand to RB, RB pitches back
      ball[ball.length - 1].t1 = S + 0.32;
      go('o:RB', S + 0.32, 0.6, -5.3); go('o:RB', S + 0.65, 0.5, -2.5);
      ball.push({ type: 'hold', who: 'o:RB', t0: S + 0.32, t1: S + 0.65 });
      ball.push({ type: 'air', from: [0.5, -2.5], to: [0, -7.5], h: 0.8, t0: S + 0.65, t1: S + 0.9 });
      ball.push({ type: 'hold', who: 'o:QB', t0: S + 0.9, t1: S + 1.4 });
      pops.push({ t: S + 0.6, text: 'FLEA FLICKER!', tone: 'warn', at: [0, -3] });
    } else {
      go('o:RB', S + 0.7, 3.5, -4.5);
    }
    const tT = S + (res.trick ? 1.4 : res.off === 'long' ? 1.3 : 1.0);
    // DL / blitzers rush
    ['DE1', 'DT1', 'DT2', 'DE2'].forEach((r) => { const p = at('d:' + r); go('d:' + r, tT, p[0] * 0.4, -5.6); });
    if (res.def === 'blitz_in') ['MLB', 'WLB', 'SLB'].forEach((r) => { const p = at('d:' + r); go('d:' + r, tT, p[0] * 0.5, -5.2); });
    if (res.def === 'blitz_out') ['WLB', 'SLB'].forEach((r) => { const p = at('d:' + r); go('d:' + r, tT, p[0] * 0.5, -5.5); });
    if (blitz) pops.push({ t: S + 0.3, text: 'BLITZ!', tone: 'warn', at: [0, 2] });

    if (res.kind === 'sack') {
      const by = res.by || 'DE1';
      const qbEnd = [rnd(-1, 1), res.yards];
      ball[ball.length - 1].t1 = 99;
      go('o:QB', tT + 0.1, qbEnd[0], Math.max(qbEnd[1], -8));
      go('d:' + by, tT + 0.1, qbEnd[0] + 0.8, qbEnd[1] + 0.6);
      go('o:QB', tT + 0.45, qbEnd[0], qbEnd[1]);
      go('d:' + by, tT + 0.45, qbEnd[0] + 0.6, qbEnd[1] + 0.5);
      receiversRoutes(ctx, S, tT + 0.4, null, res);
      coverDrop(ctx, S, tT + 0.4, res.def);
      if (res.fumble && res.fumble !== 'kept') {
        const loose = [qbEnd[0] + rnd(-3, 3), qbEnd[1] + rnd(-2, 1)];
        ball.length = ball.length; ball[ball.length - 1].t1 = tT + 0.45;
        ball.push({ type: 'air', from: qbEnd, to: loose, h: 1, t0: tT + 0.45, t1: tT + 0.75 });
        const rid = res.recD ? 'd:' + by : 'o:QB';
        go(rid, tT + 0.75, loose[0], loose[1]);
        ball.push({ type: 'hold', who: rid, t0: tT + 0.75, t1: 99 });
        pops.push({ t: tT + 0.45, text: 'STRIP SACK!', tone: 'warn' });
        if (res.recD) returnRun(ctx, rid, loose, res, tT + 0.75);
      } else pops.push({ t: tT + 0.4, text: 'SACK! ' + res.yards, tone: 'bad' });
      return;
    }

    // target & catch point
    const tgt = res.target || 'WR1';
    const tp = at('o:' + tgt);
    const air = res.air || 8;
    let cx;
    if (tgt === 'RB') cx = 10 * (Math.random() < 0.5 ? -1 : 1);
    else if (tgt === 'TE') cx = rnd(3, 10);
    else cx = clamp(tp[0] * (air > 14 ? 0.72 : 0.85) + rnd(-3, 3), -22, 22);
    const catchPt = [cx, Math.min(air, (res.start != null ? 100 - res.start : 99) + 6)];
    const airT = 0.3 + Math.hypot(catchPt[0], catchPt[1] + 7.5) * 0.024;
    const tc = tT + airT;
    ball[ball.length - 1].t1 = tT;
    receiversRoutes(ctx, S, tc + 0.4, tgt, res);
    coverDrop(ctx, S, tc + 0.2, res.def);
    // route of target
    go('o:' + tgt, S + (tc - S) * 0.55, lerp(tp[0], catchPt[0], 0.25), catchPt[1] * 0.6);
    go('o:' + tgt, tc, catchPt[0], catchPt[1]);
    // nearest coverage defender shadows
    const cov = res.by || nearest(ctx, ['CB1', 'CB2', 'FS', 'SS', 'WLB', 'SLB'], catchPt, 'd:');
    go('d:' + cov, tc, catchPt[0] + (res.kind === 'int' ? 0 : 1.2), catchPt[1] + (res.kind === 'int' ? 0.2 : 1.4));

    if (res.kind === 'pass') {
      ball.push({ type: 'air', from: [0, -7.5], to: catchPt, h: air > 14 ? 9 : 3, t0: tT, t1: tc });
      ball.push({ type: 'hold', who: 'o:' + tgt, t0: tc, t1: 99 });
      const yac = res.yac || 0;
      const end = [clamp(catchPt[0] * 0.85 + rnd(-2, 2), -24, 24), catchPt[1] + yac];
      const te = tc + 0.25 + Math.min(2.4, yac * 0.055);
      go('o:' + tgt, te, end[0], end[1]);
      pops.push({ t: tc, text: res.crazy && (res.crazy.pos === 'WR' || res.crazy.pos === 'QB') ? '★ ' + res.crazy.title.toUpperCase() : 'CATCH!', tone: res.crazy ? 'star' : 'plain', at: catchPt });
      const tackler = nearest(ctx, DROLES, end, 'd:');
      pursue(ctx, DROLES.filter((r) => r !== cov), te, end, tackler, 'd:');
      go('d:' + cov, te, end[0] + rnd(-1.5, 1.5), end[1] + 1.2);
      if (res.fumble && res.fumble !== 'kept') {
        const loose = [end[0] + rnd(-2, 2), end[1] + rnd(-1, 2)];
        ball[ball.length - 1].t1 = te;
        ball.push({ type: 'air', from: end, to: loose, h: 0.8, t0: te, t1: te + 0.25 });
        pops.push({ t: te, text: 'FUMBLE!', tone: 'warn' });
        const rid = res.recD ? 'd:' + (res.by || tackler) : 'o:' + tgt;
        go(rid, te + 0.25, loose[0], loose[1]);
        ball.push({ type: 'hold', who: rid, t0: te + 0.25, t1: 99 });
        if (res.recD) returnRun(ctx, rid, loose, res, te + 0.25);
      } else {
        const g = res.gain != null ? res.gain : air + yac;
        pops.push({ t: te, text: res.td ? 'TOUCHDOWN!' : '+' + g + ' YDS', tone: res.td ? 'good' : 'good', confetti: res.td ? ['#ffc93c', '#fff', '#ff5a4e', '#3d7cff'] : null });
      }
    } else if (res.kind === 'incomplete') {
      const miss = [catchPt[0] + rnd(-2.5, 2.5), catchPt[1] + rnd(1, 3)];
      ball.push({ type: 'air', from: [0, -7.5], to: miss, h: air > 14 ? 9 : 3, t0: tT, t1: tc });
      ball.push({ type: 'air', from: miss, to: [miss[0] + rnd(-2, 2), miss[1] + 2], h: 0.6, t0: tc, t1: tc + 0.3 });
      ball.push({ type: 'ground', at: [miss[0], miss[1] + 2], t0: tc + 0.3, t1: tc + 1 });
      pops.push({ t: tc, text: Math.random() < 0.5 ? 'INCOMPLETE' : 'BROKEN UP!', tone: 'plain', at: catchPt });
    } else if (res.kind === 'int') {
      const ip = [catchPt[0], catchPt[1] + 0.3];
      ball.push({ type: 'air', from: [0, -7.5], to: ip, h: air > 14 ? 9 : 3, t0: tT, t1: tc });
      ball.push({ type: 'hold', who: 'd:' + cov, t0: tc, t1: 99 });
      pops.push({ t: tc, text: res.crazy ? '★ PICKED!' : 'PICKED OFF!', tone: res.crazy ? 'star' : 'warn', at: ip });
      returnRun(ctx, 'd:' + cov, ip, res, tc);
    }
  }

  function returnRun(ctx, id, from, res, t0) {
    const ret = res.retYds || 0;
    const endY = from[1] - ret;
    const tEnd = t0 + 0.3 + Math.min(3, ret * 0.045);
    const end = [clamp(from[0] * 0.6 + rnd(-6, 6), -24, 24), endY];
    ctx.go(id, tEnd, end[0], end[1]);
    // offense chases
    pursue(ctx, OROLES, tEnd, end, null, 'o:', 0.8);
    if (res.defTD) ctx.pops.push({ t: tEnd, text: 'TOUCHDOWN!', tone: 'good', confetti: ['#ffc93c', '#fff', '#2fb36b'] });
    else if (ret > 8) ctx.pops.push({ t: tEnd, text: 'RETURN ' + ret, tone: 'plain' });
  }
  function receiversRoutes(ctx, S, tEnd, target, res) {
    ['WR1', 'WR2', 'WR3', 'TE'].forEach((r) => {
      if (r === target) return;
      const p = ctx.at('o:' + r);
      const depth = rnd(6, 16);
      ctx.go('o:' + r, S + 0.8, p[0], p[1] + depth * 0.6);
      ctx.go('o:' + r, tEnd, p[0] + (p[0] > 0 ? -1 : 1) * rnd(2, 8), p[1] + depth);
    });
    if (target !== 'RB') ctx.go('o:RB', tEnd, rnd(-4, 4), -4.5);
  }
  function coverDrop(ctx, S, tEnd, def) {
    const deep = def === 'deep';
    [['CB1', 'WR1'], ['CB2', 'WR2']].forEach(([d, o]) => {
      const p = ctx.at('o:' + o), q = ctx.at('d:' + d);
      ctx.go('d:' + d, tEnd, p[0] + (q[0] > 0 ? -0.8 : 0.8), Math.max(q[1], p[1] + (deep ? 6 : 10)));
    });
    ['FS', 'SS'].forEach((r) => { const q = ctx.at('d:' + r); ctx.go('d:' + r, tEnd, q[0] * 0.8, q[1] + (deep ? 6 : 3)); });
    if (!def.startsWith('blitz')) ['MLB', 'WLB', 'SLB'].forEach((r) => { const q = ctx.at('d:' + r); ctx.go('d:' + r, tEnd, q[0], q[1] + 4); });
  }
  function nearest(ctx, roles, pt, prefix) {
    let best = roles[0], bd = 1e9;
    roles.forEach((r) => { const p = ctx.at(prefix + r); const d = Math.hypot(p[0] - pt[0], p[1] - pt[1]); if (d < bd) { bd = d; best = r; } });
    return best;
  }

  // ---------- special teams ----------
  function buildPunt(res, ctx) {
    const { T, go, at, ball, pops } = ctx;
    for (const r in FO) T['o:' + r] = [[0, FO[r][0] * (r.startsWith('WR') ? 1 : 1), FO[r][1]]];
    T['o:RB'] = [[0, 0, -14]]; T['o:QB'] = [[0, 2, -5]];
    const room = 100 - res.start;
    const retY = Math.min(room + 4, (res.land != null ? res.land - res.start : 40));
    for (const r in FD0) T['d:' + r] = [[0, FD0[r][0], Math.min(FD0[r][1], 8)]];
    T['d:FS'] = [[0, 0, Math.min(retY, room + 2)]];
    const S = 0.4;
    ball.push({ type: 'hold', who: 'o:C', t0: 0, t1: S });
    ball.push({ type: 'air', from: [0, -1], to: [0, -14], h: 1, t0: S, t1: S + 0.35 });
    ball.push({ type: 'hold', who: 'o:RB', t0: S + 0.35, t1: S + 0.75 });
    go('o:RB', S + 0.75, 0, -12.5);
    if (res.blocked) {
      const by = 'd:DT1';
      go(by, S + 0.75, 0.5, -12);
      ball.push({ type: 'air', from: [0, -12.5], to: [rnd(-4, 4), -20], h: 2, t0: S + 0.75, t1: S + 1.3 });
      ball.push({ type: 'ground', at: [0, -20], t0: S + 1.3, t1: S + 1.6 });
      pops.push({ t: S + 0.75, text: 'BLOCKED!', tone: 'warn' });
      return;
    }
    const gross = res.touchback ? room + 8 : (res.land - res.start);
    const land = [rnd(-6, 6), gross];
    const tl = S + 0.75 + 0.9 + gross * 0.022;
    ball.push({ type: 'air', from: [0, -12.5], to: land, h: 16, t0: S + 0.75, t1: tl });
    pops.push({ t: S + 0.75, text: 'PUNT', tone: 'plain', at: [0, -12] });
    go('d:FS', tl, land[0], land[1]);
    // coverage team sprints
    OROLES.forEach((r) => { if (r === 'RB') return; const p = at('o:' + r); go('o:' + r, tl, lerp(p[0], land[0], 0.4), land[1] - rnd(4, 14)); });
    DROLES.forEach((r) => { if (r === 'FS') return; const p = at('d:' + r); go('d:' + r, tl, p[0] * 0.8, Math.min(p[1] + gross * 0.6, gross - 6)); });
    if (res.touchback) {
      ball.push({ type: 'ground', at: land, t0: tl, t1: tl + 0.4 });
      pops.push({ t: tl, text: 'TOUCHBACK', tone: 'plain' });
      return;
    }
    if (res.muff) {
      ball.push({ type: 'air', from: land, to: [land[0] + 2, land[1] - 2], h: 1, t0: tl, t1: tl + 0.3 });
      go('o:WR1', tl + 0.3, land[0] + 2, land[1] - 2);
      ball.push({ type: 'hold', who: 'o:WR1', t0: tl + 0.3, t1: 99 });
      pops.push({ t: tl, text: 'MUFFED!', tone: 'warn' });
      return;
    }
    ball.push({ type: 'hold', who: 'd:FS', t0: tl, t1: 99 });
    if (res.coffin) pops.push({ t: tl, text: '★ COFFIN CORNER', tone: 'star' });
    const ret = res.ret || 0;
    const end = [clamp(land[0] + rnd(-8, 8), -24, 24), land[1] - ret];
    const te = tl + 0.2 + Math.min(3.2, ret * 0.045);
    go('d:FS', te, end[0], end[1]);
    pursue(ctx, OROLES.filter((r) => r !== 'RB'), te, end, null, 'o:', 0.9);
    if (res.td) pops.push({ t: te, text: 'TOUCHDOWN!', tone: 'good', confetti: ['#ffc93c', '#fff', '#2fb36b'] });
    else pops.push({ t: te, text: ret ? 'RETURN ' + ret : 'DOWNED', tone: 'plain' });
  }

  function buildKick(res, ctx) {
    const { T, go, at, ball, pops } = ctx;
    for (const r in FO) T['o:' + r] = [[0, r.startsWith('WR') ? FO[r][0] * 0.25 : FO[r][0], FO[r][1]]];
    T['o:QB'] = [[0, 0, -7]]; T['o:RB'] = [[0, -1.6, -9.6]];
    for (const r in FD0) T['d:' + r] = [[0, clamp(FD0[r][0] * 0.4, -9, 9), Math.min(FD0[r][1], 2.5)]];
    const S = 0.45;
    ball.push({ type: 'hold', who: 'o:C', t0: 0, t1: S });
    ball.push({ type: 'air', from: [0, -1], to: [0, -7], h: 0.4, t0: S, t1: S + 0.25 });
    ball.push({ type: 'ground', at: [0, -7], t0: S + 0.25, t1: S + 0.55 });
    go('o:RB', S + 0.55, -0.4, -7.6);
    const postY = 110 - res.start;
    const gx = res.good ? rnd(-1.4, 1.4) : (Math.random() < 0.5 ? -1 : 1) * rnd(3.8, 5.5);
    const tl = S + 0.55 + 0.6 + postY * 0.012;
    if (res.blocked) {
      ball.push({ type: 'air', from: [0, -7], to: [rnd(-6, 6), -2], h: 1.5, t0: S + 0.55, t1: S + 0.95 });
      ball.push({ type: 'ground', at: [0, -2], t0: S + 0.95, t1: S + 1.4 });
      pops.push({ t: S + 0.6, text: 'BLOCKED!', tone: 'warn', at: [0, -5] });
    } else {
      ball.push({ type: 'air', from: [0, -7], to: [gx, postY + 2], h: 14, t0: S + 0.55, t1: tl });
      ball.push({ type: 'ground', at: [gx, postY + 2], t0: tl, t1: tl + 0.2 });
      pops.push({ t: tl - 0.15, text: res.good ? 'IT\'S GOOD!' : 'NO GOOD', tone: res.good ? 'good' : 'bad', at: [0, postY - 3], confetti: res.good && res.kind === 'fg' ? ['#ffd23f', '#fff'] : null });
    }
    DROLES.forEach((r) => { const p = at('d:' + r); go('d:' + r, S + 0.7, p[0] * 0.7, p[1] - 1.2); });
  }

  function buildKickoff(res, ctx) {
    const { T, go, at, ball, pops } = ctx;
    KO_O.forEach((r, i) => (T['o:' + r] = [[0, (i - 5) * 4.4, -1]]));
    T['o:QB'] = [[0, 0, -6]];
    const relLand = (res.land != null ? res.land : 100) - res.start;
    Object.keys(FD0).forEach((r, i) => (T['d:' + r] = [[0, ((i % 6) - 2.5) * 8, 22 + Math.floor(i / 6) * 12]]));
    const catchY = Math.min(relLand, 100 - res.start + 4);
    T['d:FS'] = [[0, 0, Math.max(catchY, 40)]];
    go('o:QB', 0.55, 0, -0.6);
    ball.push({ type: 'ground', at: [0, 0], t0: 0, t1: 0.55 });
    if (res.onside) {
      const land = [rnd(-6, 6), 11];
      ball.push({ type: 'air', from: [0, 0], to: land, h: 1.2, t0: 0.55, t1: 1.3 });
      KO_O.forEach((r) => { const p = at('o:' + r); go('o:' + r, 1.3, lerp(p[0], land[0], 0.6), 9 + rnd(-1, 2)); });
      Object.keys(FD0).forEach((r) => { const p = at('d:' + r); go('d:' + r, 1.3, lerp(p[0], land[0], 0.5), Math.max(11, p[1] - 10)); });
      const rid = res.recovered ? 'o:WR1' : 'd:MLB';
      go(rid, 1.35, land[0], land[1]);
      ball.push({ type: 'hold', who: rid, t0: 1.35, t1: 99 });
      pops.push({ t: 1.4, text: res.recovered ? 'RECOVERED!' : 'ONSIDE FAILS', tone: res.recovered ? 'good' : 'bad', at: land });
      return;
    }
    const land = [rnd(-4, 4), catchY];
    const tl = 0.55 + 1.5;
    ball.push({ type: 'air', from: [0, 0], to: land, h: 22, t0: 0.55, t1: tl });
    go('d:FS', tl, land[0], land[1]);
    KO_O.forEach((r) => { const p = at('o:' + r); go('o:' + r, tl, p[0] * 0.8, Math.min(land[1] - 18, 40)); });
    Object.keys(FD0).forEach((r) => { if (r === 'FS') return; const p = at('d:' + r); go('d:' + r, tl, p[0] * 0.6, p[1] + 6); });
    if (res.touchback) {
      ball.push({ type: 'hold', who: 'd:FS', t0: tl, t1: 99 });
      pops.push({ t: tl + 0.1, text: 'TOUCHBACK', tone: 'plain' });
      return;
    }
    ball.push({ type: 'hold', who: 'd:FS', t0: tl, t1: 99 });
    const endK = 100 - ((res.catchOn || 0) + (res.ret || 0)) - res.start;
    const end = [clamp(land[0] + rnd(-10, 10), -24, 24), Math.max(endK, -12)];
    const te = tl + 0.3 + Math.min(3, (res.ret || 20) * 0.04);
    go('d:FS', te, end[0], end[1]);
    pursue(ctx, KO_O, te, end, null, 'o:', 0.9);
    pops.push({ t: te, text: res.td ? 'TOUCHDOWN!' : 'RETURN ' + (res.ret || 0), tone: res.td ? 'good' : 'plain', confetti: res.td ? ['#ffc93c', '#fff'] : null });
  }
})();
