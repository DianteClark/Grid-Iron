/* Grid Iron — sticker field renderer and play animations */
(function () {
  const GI = window.GI;
  const W_YD = 53.3, CX = 26.65, MARGIN = 1.6;
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
  const FONT = '"Lilita One", "Arial Rounded MT Bold", system-ui, sans-serif';

  // top-down helmet, facing +x in local space
  function drawHelmet(g, x, y, R, ang, shell, stripe) {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.fillStyle = '#fff';
    g.beginPath(); g.ellipse(-R * 0.05, 0, R * 1.18 + 2.4, R * 0.98 + 2.4, 0, 0, 7); g.fill();
    g.fillStyle = shell;
    g.beginPath(); g.ellipse(-R * 0.05, 0, R * 1.18, R * 0.98, 0, 0, 7); g.fill();
    g.save(); g.clip();
    g.fillStyle = stripe; g.fillRect(-R * 1.3, -R * 0.17, R * 2.2, R * 0.34);
    g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.ellipse(-R * 0.35, -R * 0.45, R * 0.5, R * 0.24, -0.3, 0, 7); g.fill();
    g.fillStyle = 'rgba(0,0,0,.12)'; g.beginPath(); g.ellipse(-R * 0.1, R * 0.62, R * 1.1, R * 0.4, 0, 0, 7); g.fill();
    g.restore();
    // facemask
    g.strokeStyle = '#e9e9ee'; g.lineWidth = Math.max(1.4, R * 0.22); g.lineCap = 'round';
    g.beginPath(); g.arc(R * 0.45, 0, R * 0.78, -1.05, 1.05); g.stroke();
    g.strokeStyle = '#9aa0a8'; g.lineWidth = Math.max(1, R * 0.12);
    g.beginPath(); g.moveTo(R * 0.9, -R * 0.5); g.lineTo(R * 0.9, R * 0.5); g.stroke();
    g.restore();
  }
  GI.drawHelmet = drawHelmet;

  class Field {
    constructor(canvas) {
      this.cv = canvas; this.ctx = canvas.getContext('2d');
      this.cam = 50; this.camTarget = 50; this.anim = null; this.pops = []; this.confetti = []; this.wx = []; this.flames = [];
      this.players = []; this.ball = null; this.lines = null; this.weather = 'clear';
      this.speed = 1; this.ins = { top: 0, bottom: 0, right: 0 }; this.center = null;
      this.onSfx = null;
      this.resize();
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(canvas.parentElement);
      this.last = performance.now();
      const loop = (t) => {
        try { this.frame(t); } catch (e) { console.error(e); if (this.anim) this.finish(); }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
    resize() {
      const p = this.cv.parentElement, r = p.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      this.w = Math.max(100, r.width); this.h = Math.max(100, r.height); this.dpr = dpr;
      this.cv.width = Math.round(this.w * dpr); this.cv.height = Math.round(this.h * dpr);
      this.cv.style.width = this.w + 'px'; this.cv.style.height = this.h + 'px';
      this.horiz = this.w > this.h * 1.08;
      this.layout();
    }
    layout() {
      const top = this.horiz ? this.ins.top : 0;
      const across = this.horiz ? this.h - top : this.w, along = this.horiz ? this.w : this.h;
      // zoomed in: ~44 yards across fit on screen, camera pans sideways to follow the ball
      const full = across / (W_YD + MARGIN * 2);
      const ppy = Math.min(full >= 9.5 ? full : Math.min(across / 44, full * 1.6), along / 36);
      if (ppy !== this.ppy) this.fieldCache = null;
      this.ppy = ppy;
      this.acrossC = (this.horiz ? top : 0) + across / 2;
      this.visAcross = across / ppy;
      if (this.camX == null) this.camX = CX;
    }
    setInsets(ins) {
      const oldTop = this.ins.top;
      this.ins = Object.assign({ top: 0, bottom: 0, right: 0 }, ins);
      if (this.horiz && Math.abs(oldTop - this.ins.top) > 1) this.layout();
    }
    setTeams(user, opp) {
      this.user = user; this.opp = opp;
      this.colors = { user: user.c1, opp: cdist(user.c1, opp.c1) < 110 ? opp.c2 : opp.c1 };
      if (cdist(this.colors.user, this.colors.opp) < 90) this.colors.opp = '#f4f1ea';
      this.fieldCache = null;
    }
    setWeather(w) { this.weather = w; this.wx = []; }
    alongCenter() {
      const want = this.horiz ? (this.w - this.ins.right) / 2 : this.ins.top + (this.h - this.ins.top - this.ins.bottom) / 2;
      if (this.center == null) this.center = want;
      return this.center;
    }
    visHalf() { return (this.horiz ? this.w - this.ins.right : this.h - this.ins.top - this.ins.bottom) / this.ppy / 2; }
    proj(x, y) {
      const c = this.alongCenter();
      const o = this.acrossC + (x - this.camX) * this.ppy;
      return this.horiz ? [c + (y - this.cam) * this.ppy, o] : [o, c - (y - this.cam) * this.ppy];
    }

    // ---------- static field (cached, drawn vertically and rotated for landscape) ----------
    buildField() {
      const ppy = this.ppy, dpr = this.dpr;
      const c = document.createElement('canvas');
      const pad = 3;
      c.width = Math.ceil((W_YD + pad * 2) * ppy * dpr); c.height = Math.ceil((120 + pad * 2) * ppy * dpr);
      const g = c.getContext('2d');
      g.scale(dpr, dpr);
      const X = (x) => (x + pad) * ppy, Y = (y) => (110 - y + pad) * ppy;
      const rad = Math.max(10, ppy * 2.2);
      g.fillStyle = 'rgba(0,0,0,.18)';
      rr(g, X(-1.0) + 4, Y(111) + 5, (W_YD + 2) * ppy, 122 * ppy, rad); g.fill();
      g.fillStyle = '#fff';
      rr(g, X(-1.0), Y(111), (W_YD + 2) * ppy, 122 * ppy, rad); g.fill();
      g.save(); rr(g, X(-0.35), Y(110.65), (W_YD + 0.7) * ppy, 121.3 * ppy, rad * 0.7); g.clip();
      g.fillStyle = '#3f9a4b'; g.fillRect(X(-1), Y(112), (W_YD + 2) * ppy, 124 * ppy);
      for (let y = -10; y < 110; y += 5) {
        g.fillStyle = (Math.floor((y + 10) / 5) % 2) ? '#52b25d' : '#4aa854';
        g.fillRect(X(0), Y(y + 5), W_YD * ppy, 5 * ppy);
      }
      // subtle mowing texture
      g.fillStyle = 'rgba(255,255,255,.035)';
      for (let x = 0; x < W_YD; x += 2.6) g.fillRect(X(x), Y(110), 1.3 * ppy, 120 * ppy);
      const ez = (y0, team, flip) => {
        g.fillStyle = team.c1; g.fillRect(X(0), Y(y0 + 10), W_YD * ppy, 10 * ppy);
        g.fillStyle = 'rgba(255,255,255,.08)';
        for (let x = -10; x < W_YD + 10; x += 4) { g.beginPath(); g.moveTo(X(x), Y(y0 + 10)); g.lineTo(X(x + 2), Y(y0 + 10)); g.lineTo(X(x - 8), Y(y0)); g.lineTo(X(x - 10), Y(y0)); g.fill(); }
        g.save();
        g.translate(X(CX), Y(y0 + 5)); if (flip) g.rotate(Math.PI);
        const txt = team.name.toUpperCase();
        let fs = Math.round(ppy * 5.4);
        g.font = `${fs}px ${FONT}`;
        while (g.measureText(txt).width > W_YD * ppy * 0.86 && fs > 8) { fs -= 2; g.font = `${fs}px ${FONT}`; }
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = ppy * 0.9; g.strokeStyle = '#fff'; g.lineJoin = 'round';
        g.fillStyle = 'rgba(0,0,0,.2)'; g.fillText(txt, ppy * 0.35, ppy * 0.65);
        g.strokeText(txt, 0, ppy * 0.3); g.fillStyle = lum(team.c1) > 0.6 ? '#1d1d1f' : team.c2; g.fillText(txt, 0, ppy * 0.3);
        g.restore();
      };
      if (this.user) { ez(-10, this.user, false); ez(100, this.opp, false); }
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
      g.fillStyle = 'rgba(255,255,255,.92)'; g.font = `${Math.round(ppy * 2.2)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let y = 10; y <= 90; y += 10) {
        const n = String(y <= 50 ? y : 100 - y);
        [[7, Math.PI / 2], [W_YD - 7, -Math.PI / 2]].forEach(([x, rot]) => { g.save(); g.translate(X(x), Y(y)); g.rotate(rot); g.fillText(n, 0, 0); g.restore(); });
      }
      if (this.user) {
        const r = ppy * 3.4, cx = X(CX), cy = Y(50);
        g.globalAlpha = 0.8;
        g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.arc(cx + 3, cy + 4, r, 0, 7); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
        g.fillStyle = this.user.c1; g.beginPath(); g.arc(cx, cy, r - ppy * 0.5, 0, 7); g.fill();
        g.strokeStyle = this.user.c2; g.lineWidth = ppy * 0.35; g.beginPath(); g.arc(cx, cy, r - ppy * 0.95, 0, 7); g.stroke();
        drawHelmet(g, cx, cy - ppy * 0.5, ppy * 1.4, 0, this.user.c1 === '#ffffff' ? '#ddd' : this.user.c1, this.user.c2);
        g.fillStyle = lum(this.user.c1) > 0.6 ? '#1d1d1f' : '#fff'; g.font = `${Math.round(ppy * 1.3)}px ${FONT}`;
        g.fillText(this.user.abbr, cx, cy + ppy * 1.7);
        g.globalAlpha = 1;
      }
      g.restore();
      [-10, 110].forEach((y) => {
        g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(X(CX - 3.1) + 2, Y(y) + 3); g.lineTo(X(CX + 3.1) + 2, Y(y) + 3); g.stroke();
        g.strokeStyle = '#ffd23f'; g.lineWidth = 3.5;
        g.beginPath(); g.moveTo(X(CX - 3.1), Y(y)); g.lineTo(X(CX + 3.1), Y(y)); g.stroke();
        g.fillStyle = '#ffd23f'; [CX - 3.1, CX + 3.1].forEach((x) => { g.beginPath(); g.arc(X(x), Y(y), 3.2, 0, 7); g.fill(); });
      });
      this.fieldCache = { c, pad, cw: c.width / dpr, ch: c.height / dpr };
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
      this.ball = { hold: G.phase === 'kickoff' ? 'o:QB' : 'o:C' };
    }
    mkPlayer(id, p, team, color) {
      const role = id.slice(2);
      const star = team.stars.find((s) => s.role === role && !s.injured);
      const stripe = color === team.c1 ? team.c2 : team.c1;
      return { id, role, side: id[0], rx: p[0], ry: p[1], color, stripe, star: !!star, num: star ? star.num : null, fire: !!star && (star.meter >= 100 || star.armed), armed: !!star && star.armed, ang: null };
    }
    toAbs(rx, ry) {
      const { los, dir } = this.ctxPlay;
      return [dir === 1 ? CX + rx : CX - rx, los + dir * ry];
    }

    // ---------- animation ----------
    runPlay(res, G) {
      return new Promise((resolve) => {
        this.pops = [];
        if (!res || ['penalty', 'setup2'].includes(res.kind)) {
          if (res && res.kind === 'penalty') { this.pop('FLAG!', null, 'warn'); this.sfx('flag'); }
          setTimeout(resolve, res && res.kind === 'penalty' ? 700 / Math.min(this.speed, 3) : 50);
          return;
        }
        const offSide = res.side;
        const up = offSide === G.user;
        this.ctxPlay = { los: res.los, dir: res.dir, offSide, G };
        const ot = G.teams[offSide], dt = G.teams[GI.util.other(offSide)];
        const oc = up ? this.colors.user : this.colors.opp, dc = up ? this.colors.opp : this.colors.user;
        const S = build(res);
        const ids = Object.keys(S.tracks);
        const prev = {};
        this.players.forEach((p) => (prev[p.id] = p));
        this.players = ids.map((id) => {
          const p = this.mkPlayer(id, S.tracks[id][0].slice(1), id[0] === 'o' ? ot : dt, id[0] === 'o' ? oc : dc);
          if (prev[id]) { p.fire = prev[id].fire; p.armed = prev[id].armed; }
          return p;
        });
        this.lines = (res.kind === 'kickoff') ? null : { los: res.los, fd: res.toGo && !(res.kind === 'fg' || res.kind === 'xp' || res.kind === 'punt') ? res.los + res.dir * res.toGo : null, dir: res.dir };
        if (this.lines && this.lines.fd != null && (this.lines.fd >= 100 || this.lines.fd <= 0)) this.lines.fd = null;
        const sp = Math.min(this.speed, 4);
        const watchdog = setTimeout(() => this.finish(), (S.dur / sp) * 1000 + 2500);
        this.anim = { S, t: 0, dur: S.dur, resolve, firedPops: new Set(), firedSfx: new Set(), res, watchdog };
        if (this.speed >= 99) this.finish();
      });
    }
    finish() {
      if (!this.anim) return;
      const a = this.anim;
      clearTimeout(a.watchdog);
      if (a.t < a.dur - 0.01) { // skipped: only show the final pop and its sound
        const lastI = a.S.pops.length - 1;
        a.S.pops.forEach((_, i) => { if (i !== lastI) a.firedPops.add(i); });
        a.S.sfx.forEach((_, i) => a.firedSfx.add(i));
        const last = a.S.pops[lastI];
        if (last && last.sfx) this.sfx(last.sfx);
        this.pops = [];
      }
      a.t = a.dur;
      try { this.applyAnim(a.dur); } catch (e) { console.error(e); }
      this.anim = null;
      a.resolve();
    }
    sfx(name) { if (this.onSfx) this.onSfx(name); }
    applyAnim(t) {
      const S = this.anim.S;
      this.players.forEach((p) => { const pos = sample(S.tracks[p.id], t); p.rx = pos[0]; p.ry = pos[1]; });
      let seg = S.ball[S.ball.length - 1];
      for (const s of S.ball) if (t >= s.t0 && t <= s.t1) { seg = s; break; }
      if (seg.type === 'hold') this.ball = { hold: seg.who };
      else if (seg.type === 'air') {
        const u = clamp((t - seg.t0) / (seg.t1 - seg.t0), 0, 1);
        this.ball = { rx: lerp(seg.from[0], seg.to[0], u), ry: lerp(seg.from[1], seg.to[1], u), h: 4 * seg.h * u * (1 - u), spin: u };
      } else if (seg.type === 'ground') this.ball = { rx: seg.at[0], ry: seg.at[1], h: 0, loose: true };
      S.pops.forEach((p, i) => {
        if (t >= p.t && !this.anim.firedPops.has(i)) {
          this.anim.firedPops.add(i);
          const at = p.at ? this.toAbs(p.at[0], p.at[1]) : this.ballAbs();
          this.pop(p.text, at, p.tone);
          if (p.sfx) this.sfx(p.sfx);
          if (p.confetti) this.burst(at, p.confetti);
        }
      });
      S.sfx.forEach((e, i) => { if (t >= e.t && !this.anim.firedSfx.has(i)) { this.anim.firedSfx.add(i); this.sfx(e.name); } });
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
      const s = this.proj(at[0], at[1]);
      for (let i = 0; i < 80; i++) this.confetti.push({ x: s[0], y: s[1], vx: rnd(-260, 260), vy: rnd(-520, -160), r: rnd(3, 6), c: colors[i % colors.length], t: 0, rot: rnd(0, 6), vr: rnd(-10, 10) });
    }

    // ---------- frame ----------
    frame(now) {
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
      if (this.anim) {
        this.anim.t += dt * this.speed;
        if (this.anim.t >= this.anim.dur) this.finish();
        else this.applyAnim(this.anim.t);
      }
      const want = this.horiz ? (this.w - this.ins.right) / 2 : this.ins.top + (this.h - this.ins.top - this.ins.bottom) / 2;
      this.center = this.center == null ? want : this.center + (want - this.center) * Math.min(1, dt * 6);
      if (this.ctxPlay) {
        const b = this.ballAbs(), half = this.visHalf();
        const lead = this.anim ? (this.ctxPlay.dir || 1) * 3 : (this.ctxPlay.dir || 1) * 5;
        this.camTarget = half > 61 ? 50 : clamp(b[1] + lead, half - 12.5, 112.5 - half);
      }
      this.cam += (this.camTarget - this.cam) * Math.min(1, dt * 4);
      // sideways pan: follow the ball, keep the field edges in view when close
      const hx = this.visAcross / 2, edge = 1.2;
      let tx = CX;
      if (this.ctxPlay) tx = this.anim ? this.ballAbs()[0] : CX;
      tx = hx * 2 >= W_YD + edge * 2 ? CX : clamp(tx, hx - edge, W_YD + edge - hx);
      this.camX += (tx - this.camX) * Math.min(1, dt * 3);
      this.draw(dt);
    }
    draw(dt) {
      const g = this.ctx, ppy = this.ppy, dpr = this.dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, this.w, this.h);
      if (!this.fieldCache) this.buildField();
      const fc = this.fieldCache, c = this.alongCenter();
      if (this.horiz) {
        const A = c + (110 + fc.pad - this.cam) * ppy, B = this.acrossC - (this.camX + fc.pad) * ppy;
        g.setTransform(0, dpr, -dpr, 0, A * dpr, B * dpr);
        g.drawImage(fc.c, 0, 0, fc.cw, fc.ch);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
      } else {
        g.drawImage(fc.c, this.acrossC - (this.camX + fc.pad) * ppy, c - (110 + fc.pad - this.cam) * ppy, fc.cw, fc.ch);
      }
      if (!this.ctxPlay) return;
      if (this.lines) {
        const L = (y, col) => { const a = this.proj(0.3, y), b = this.proj(W_YD - 0.3, y); g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); };
        L(this.lines.los, 'rgba(61,124,255,.92)');
        if (this.lines.fd != null) L(this.lines.fd, 'rgba(255,210,63,.95)');
      }
      const r = Math.max(4.6, ppy * 0.86);
      const list = this.players.map((p) => { const a = this.toAbs(p.rx, p.ry); const s = this.proj(a[0], a[1]); return { p, x: s[0], y: s[1] }; }).sort((a, b) => a.y - b.y);
      // facing for helmets
      const dirScreen = (side) => {
        const d = (this.ctxPlay.dir || 1) * (side === 'o' ? 1 : -1);
        return this.horiz ? (d > 0 ? 0 : Math.PI) : (d > 0 ? -Math.PI / 2 : Math.PI / 2);
      };
      list.forEach((o) => {
        const p = o.p;
        if (p.lx != null) {
          const dx = o.x - p.lx, dy = o.y - p.ly;
          if (dx * dx + dy * dy > 0.25) { const ta = Math.atan2(dy, dx); p.ang = p.ang == null ? ta : p.ang + angDiff(p.ang, ta) * Math.min(1, dt * 10); }
        }
        if (p.ang == null || (!this.anim && p.lx === o.x && p.ly === o.y && p.idle)) p.ang = dirScreen(p.side);
        if (!this.anim) { p.ang = p.ang + angDiff(p.ang, dirScreen(p.side)) * Math.min(1, dt * 5); }
        p.lx = o.x; p.ly = o.y;
      });
      // shadows
      list.forEach(({ p, x, y }) => {
        const rr2 = p.star ? r * 1.32 : r;
        g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.arc(x + rr2 * 0.28, y + rr2 * 0.38, rr2 + 1.6, 0, 7); g.fill();
      });
      // flames for on-fire stars (screen-space particles)
      list.forEach(({ p, x, y }) => {
        if (!p.fire) return;
        const n = p.armed ? 3 : 1.4;
        for (let i = 0; i < n * dt * 60; i++) this.flames.push({ x: x + rnd(-r, r) * 0.9, y: y + rnd(-r * 0.3, r * 0.5), vx: rnd(-10, 10), vy: rnd(-70, -35) * (p.armed ? 1.3 : 1), t: 0, life: rnd(0.35, 0.7), s: rnd(r * 0.45, r * 0.85) * (p.armed ? 1.25 : 1) });
      });
      this.flames = this.flames.filter((f) => (f.t += dt) < f.life);
      if (this.flames.length > 600) this.flames.splice(0, this.flames.length - 600);
      g.save(); g.globalCompositeOperation = 'lighter';
      this.flames.forEach((f) => {
        f.x += f.vx * dt; f.y += f.vy * dt;
        const k = f.t / f.life;
        g.fillStyle = k < 0.3 ? 'rgba(255,230,120,.55)' : k < 0.6 ? 'rgba(255,140,40,.45)' : 'rgba(230,60,30,.3)';
        g.beginPath(); g.arc(f.x, f.y, f.s * (1 - k * 0.7), 0, 7); g.fill();
      });
      g.restore();
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 160);
      list.forEach(({ p, x, y }) => {
        if (p.star) {
          const R = r * 1.32;
          if (p.armed) { g.strokeStyle = `rgba(255,201,60,${0.5 + pulse * 0.5})`; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, R * 1.25 + 4 + pulse * 2, 0, 7); g.stroke(); }
          drawHelmet(g, x, y, R, p.ang || 0, p.color, p.stripe);
          return;
        }
        g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, r + 2, 0, 7); g.fill();
        g.fillStyle = p.color; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.35, r * 0.38, 0, 7); g.fill();
      });
      if (this.ball) {
        const a = this.ballAbs();
        const s0 = this.proj(a[0], a[1]);
        const bx = s0[0], by = s0[1];
        const h = this.ball.h || 0;
        const s = Math.max(3.3, ppy * 0.44) * (1 + h / 14);
        if (h > 0.2) { g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(bx, by, s, s * 0.6, 0, 0, 7); g.fill(); }
        const yy = by - h * ppy * 0.55 + (this.ball.hold ? -r * 0.1 : 0), xx = bx + (this.ball.hold ? r * 0.6 : 0);
        g.save(); g.translate(xx, yy); g.rotate(this.ball.spin ? this.ball.spin * 12 : -0.6);
        g.fillStyle = '#fff'; g.beginPath(); g.ellipse(0, 0, s * 1.25 + 1.6, s * 0.8 + 1.6, 0, 0, 7); g.fill();
        g.fillStyle = '#8b4a24'; g.beginPath(); g.ellipse(0, 0, s * 1.25, s * 0.8, 0, 0, 7); g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 1; g.beginPath(); g.moveTo(-s * 0.45, 0); g.lineTo(s * 0.45, 0); g.stroke();
        g.restore();
      }
      this.confetti = this.confetti.filter((c2) => (c2.t += dt) < 2.4);
      this.confetti.forEach((q) => {
        q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 700 * dt; q.vx *= 0.985; q.rot += q.vr * dt;
        g.save(); g.translate(q.x, q.y); g.rotate(q.rot); g.fillStyle = q.c; g.fillRect(-q.r, -q.r * 0.5, q.r * 2, q.r); g.restore();
      });
      this.drawWeather(g, dt);
      this.pops = this.pops.filter((p) => (p.t += dt) < 1.7);
      this.pops.forEach((p) => {
        const k = Math.min(1, p.t / 0.18), fade = p.t > 1.35 ? 1 - (p.t - 1.35) / 0.35 : 1;
        const sc = 0.6 + 0.4 * (1 - Math.pow(1 - k, 3)) + (k < 1 ? 0.12 * Math.sin(k * Math.PI) : 0);
        const s = this.proj(p.x, p.y);
        const x = clamp(s[0], 80, this.w - 80 - (this.horiz ? this.ins.right : 0)), y = clamp(s[1] - 28 - p.t * 14, this.ins.top + 24, this.h - this.ins.bottom - 24);
        g.save(); g.globalAlpha = Math.max(0, fade); g.translate(x, y); g.rotate(p.rot); g.scale(sc, sc);
        g.font = `${Math.max(16, Math.round(ppy * 2.1))}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        const tw = g.measureText(p.text).width + 20, th = Math.max(28, ppy * 3);
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
      const target = w === 'rain' ? 110 : w === 'snow' ? 80 : w === 'wind' ? 30 : 0;
      while (this.wx.length < target) this.wx.push({ x: Math.random() * this.w, y: Math.random() * this.h, s: rnd(0.6, 1.4) });
      if (w === 'heat') {
        const gr = g.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.3, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.75);
        gr.addColorStop(0, 'rgba(255,150,40,0)'); gr.addColorStop(1, 'rgba(255,120,30,.18)');
        g.fillStyle = gr; g.fillRect(0, 0, this.w, this.h); return;
      }
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
    }
  }
  GI.Field = Field;

  function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
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
    if (res.clash) pops.unshift({ t: 0.85, text: 'STAR CLASH!', tone: 'star', at: [0, 1] });
    // play length = when the action stops (holds run "forever" so they never count)
    let dur = 0;
    for (const id in T) dur = Math.max(dur, T[id][T[id].length - 1][0]);
    ball.forEach((b) => { if (b.type === 'air') dur = Math.max(dur, b.t1); else if (b.type === 'ground') dur = Math.max(dur, b.t0 + 0.3); });
    pops.forEach((p) => (dur = Math.max(dur, p.t)));
    dur = Math.min(dur, 9) + 0.45;
    for (const id in T) stay(id, dur);
    // sound cues
    const sfx = [];
    const firstAir = ball.find((b) => b.type === 'air');
    if (firstAir && k !== 'kickoff') sfx.push({ t: firstAir.t0, name: 'snap' });
    ball.forEach((b) => { if (b.type === 'air' && b.h >= 12) sfx.push({ t: b.t0, name: 'kick' }); });
    let td = false;
    pops.forEach((p) => {
      const x = p.text;
      p.sfx = /CLASH/.test(x) ? 'clash' : /TOUCHDOWN/.test(x) ? 'td' : /SACK|FUMBLE|BLOCKED|PANCAKE|STRIP/.test(x) ? 'bighit' : /PICK|MUFF/.test(x) ? 'turnover'
        : /^★/.test(x) ? 'star' : /CATCH/.test(x) ? 'catch' : /NO GOOD|FAILS/.test(x) ? 'bad' : /GOOD|RECOVERED/.test(x) ? 'good'
        : /INCOMPLETE|BROKEN|TOUCHBACK|DOWNED/.test(x) ? 'whistle' : /YD|RETURN/.test(x) ? 'hit' : null;
      if (p.sfx === 'td') td = true;
    });
    if (!td) sfx.push({ t: dur - 0.3, name: 'whistle' });
    return { tracks: T, ball, pops, dur, sfx };
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
