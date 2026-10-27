/* Grid Iron — simulation engine */
(function () {
  const GI = window.GI;
  const R = Math.random;
  const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const gauss = (m, s) => {
    let u = 0, v = 0;
    while (u === 0) u = R();
    while (v === 0) v = R();
    return m + s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const wpick = (w) => {
    const keys = Object.keys(w);
    let t = keys.reduce((s, k) => s + Math.max(0, w[k]), 0), r = R() * t;
    for (const k of keys) { r -= Math.max(0, w[k]); if (r <= 0) return k; }
    return keys[keys.length - 1];
  };
  const other = (s) => (s === 'home' ? 'away' : 'home');
  GI.util = { ri, clamp, gauss, wpick, other };

  // ---------- teams ----------
  const ROLE_MAP = {
    QB: ['QB'], RB: ['RB'], WR: ['WR1', 'WR2', 'WR3'], TE: ['TE'], OL: ['C', 'LT', 'RT'],
    LB: ['MLB', 'WLB', 'SLB'], S: ['FS', 'SS'], DL: ['DE1', 'DE2', 'DT1'], CB: ['CB1', 'CB2'], KP: ['K'],
  };
  const NUMS = { QB: [1, 19], RB: [20, 39], WR: [80, 89], TE: [80, 89], OL: [60, 79], LB: [40, 59], S: [20, 49], DL: [90, 99], CB: [20, 39], KP: [1, 19] };
  const BOOST = {
    QB: { pass: 9 }, RB: { run: 9 }, WR: { pass: 5 }, TE: { pass: 3, run: 3 }, OL: { run: 4, ol: 6 },
    LB: { runD: 5, passD: 2 }, S: { passD: 4, runD: 2 }, CB: { passD: 6 }, DL: { rush: 6, runD: 3 }, KP: { st: 14 },
  };

  GI.buildTeam = function (i) {
    const [city, name, abbr, c1, c2] = GI.TEAMS_BASE[i];
    const r = GI.mulberry32(9001 + i * 7919);
    const rr = (a, b) => a + Math.floor(r() * (b - a + 1));
    const pick = (arr) => arr[Math.floor(r() * arr.length)];
    let flex;
    do {
      flex = [];
      const c = {};
      while (flex.length < 5) {
        const p = pick(['RB', 'WR', 'OL', 'LB', 'S', 'DL', 'WR', 'DL', 'LB', 'S', 'CB', 'CB', 'TE', 'TE']);
        if ((c[p] || 0) < GI.FLEX_MAX[p]) { c[p] = (c[p] || 0) + 1; flex.push(p); }
      }
    } while (!flex.some((p) => ['RB', 'WR', 'OL', 'TE'].includes(p)) || !flex.some((p) => ['LB', 'S', 'DL', 'CB'].includes(p)));
    const slots = ['KP', 'QB', 'LB'].concat(flex);
    const used = new Set(), usedNum = new Set();
    const roleUse = {};
    const stars = slots.map((pos, k) => {
      let nm;
      do { nm = pick(GI.FIRST) + ' ' + pick(GI.LAST); } while (used.has(nm));
      used.add(nm);
      let num;
      do { num = rr(NUMS[pos][0], NUMS[pos][1]); } while (usedNum.has(num));
      usedNum.add(num);
      roleUse[pos] = roleUse[pos] || 0;
      const role = ROLE_MAP[pos][roleUse[pos]++];
      return { id: abbr + k, pos, name: nm, num, role, rating: rr(74, 94), meter: rr(15, 45), armed: false, injured: false };
    });
    const base = { run: rr(56, 72), pass: rr(56, 72), ol: rr(56, 72), runD: rr(56, 72), passD: rr(56, 72), rush: rr(56, 72), st: rr(56, 70) };
    const cname = () => pick(GI.FIRST) + ' ' + pick(GI.COACH_LAST);
    const offW = { run: 1, pass: 1, balanced: 1.2, gadget: 0.35 };
    const defW = { blitz: 1, cover: 1, press: 0.8, balanced: 1.2 };
    stars.forEach((s) => {
      if (s.pos === 'RB' || s.pos === 'OL') offW.run += 0.6;
      if (s.pos === 'WR') offW.pass += 0.6;
      if (s.pos === 'TE') { offW.run += 0.3; offW.pass += 0.3; }
      if (s.pos === 'DL' || s.pos === 'LB') defW.blitz += 0.4;
      if (s.pos === 'S') defW.cover += 0.6;
      if (s.pos === 'CB') defW.press += 0.6;
    });
    const wp = (w) => { let t = 0; for (const k in w) t += w[k]; let x = r() * t; for (const k in w) { x -= w[k]; if (x <= 0) return k; } return 'balanced'; };
    const coaches = {
      hc: { role: 'Head Coach', name: cname(), rating: rr(55, 92) },
      oc: { role: 'Offensive Coord.', name: cname(), rating: rr(52, 90), style: wp(offW) },
      dc: { role: 'Defensive Coord.', name: cname(), rating: rr(52, 90), style: wp(defW) },
      stc: { role: 'Special Teams', name: cname(), rating: rr(50, 88) },
    };
    const team = { idx: i, city, name, abbr, c1, c2, slots, stars, base, coaches };
    team.ovr = GI.ratings(team).ovr;
    return team;
  };

  GI.ratings = function (team) {
    const r = Object.assign({}, team.base);
    team.stars.forEach((s) => {
      if (s.injured) return;
      const b = BOOST[s.pos], m = s.rating / 85;
      for (const k in b) r[k] += b[k] * m;
    });
    r.st += (team.coaches.stc.rating - 70) / 5;
    for (const k in r) r[k] = Math.round(clamp(r[k], 35, 99));
    r.ovr = Math.round((r.run + r.pass + r.ol + r.runD + r.passD + r.rush + r.st) / 7);
    return r;
  };
  GI.TEAMS = GI.TEAMS_BASE.map((_, i) => GI.buildTeam(i));

  GI.shortName = (n) => { const p = n.split(' '); return p[0][0] + '. ' + p.slice(1).join(' '); };
  GI.starAt = (team, role) => team.stars.find((s) => s.role === role && !s.injured);
  const GENERIC = { QB: 'the QB', RB: 'the RB', WR1: 'the X receiver', WR2: 'the Z receiver', WR3: 'the slot', TE: 'the tight end', MLB: 'the Mike', WLB: 'the Will', SLB: 'the Sam', FS: 'the free safety', SS: 'the strong safety', CB1: 'the corner', CB2: 'the corner', DE1: 'the end', DE2: 'the end', DT1: 'the tackle', DT2: 'the tackle', K: 'the kicker', KR: 'the returner' };
  GI.who = function (team, role) {
    const s = GI.starAt(team, role);
    return s ? GI.shortName(s.name) : GENERIC[role] || role;
  };

  // ---------- new game ----------
  const mkStats = () => ({ yds: 0, pass: 0, rush: 0, to: 0, plays: 0, first: 0, sacks: 0, top: 0 });
  GI.newGame = function (o) {
    const homeIdx = o.userHome ? o.user : o.opp;
    const awayIdx = o.userHome ? o.opp : o.user;
    const weather = o.weather || wpick({ clear: 44, rain: 18, snow: 10, wind: 16, heat: 12 });
    let crowd = GI.CROWD[ri(0, GI.CROWD.length - 1)];
    if (o.crowdLevel != null) crowd = GI.CROWD.reduce((b, c) => (Math.abs(c.level - o.crowdLevel) < Math.abs(b.level - o.crowdLevel) ? c : b));
    const teams = { home: GI.buildTeam(homeIdx), away: GI.buildTeam(awayIdx) };
    const inj = new Set(o.injured || []);
    ['home', 'away'].forEach((s) => teams[s].stars.forEach((st) => { if (inj.has(st.id)) st.injured = true; }));
    if (o.starMeter) ['home', 'away'].forEach((s) => teams[s].stars.forEach((st) => { if (o.starMeter[st.id] != null) st.meter = o.starMeter[st.id]; }));
    const morale = {};
    ['home', 'away'].forEach((s) => (morale[s] = clamp(55 + (teams[s].coaches.hc.rating - 70) / 2 + ri(-5, 5) + ((o.morale && o.morale[s]) || 0), 20, 95)));
    const potwPick = () => ({ off: GI.OFF_PLAYS[ri(0, 4)].id, def: GI.DEF_PLAYS[ri(0, 5)].id });
    const firstRecv = R() < 0.5 ? 'home' : 'away';
    const G = {
      v: 1, user: o.userHome ? 'home' : 'away', teams, score: { home: 0, away: 0 },
      q: 1, qLen: o.qMin * 60, clock: o.qMin * 60, poss: firstRecv, ballOn: 25, down: 1, toGo: 10,
      phase: 'kickoff', kickTeam: other(firstRecv), freeKick: false, firstRecv,
      weather, crowd, diff: o.diff || 'pro', potw: o.potw || { off: 'short', def: 'zone' },
      morale, stats: { home: mkStats(), away: mkStats() }, log: [], hist: { off: [], def: [] },
      pending: null, flash: null, over: false, ot: false, playNo: 0,
      potwLeft: { off: 3, def: 3 }, cpuPotw: o.cpuPotw || potwPick(), cpuPotwLeft: { off: 3, def: 3 },
      playoff: !!o.playoff, intel: o.intel || null, film: !!o.film, label: o.label || null,
    };
    if (o.potwLeft) G.potwLeft = Object.assign({}, o.potwLeft);
    addLog(G, `Coin toss: ${teams[firstRecv].name} receive. ${GI.WEATHER[weather].icon} ${GI.WEATHER[weather].name}, ${crowd.name} crowd.`, 'info');
    return G;
  };

  function addLog(G, text, type) {
    G.log.unshift({ q: G.q, clock: G.clock, text, type: type || 'play' });
    if (G.log.length > 120) G.log.pop();
  }
  GI.clockStr = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`;
  GI.qLabel = (q) => (q <= 4 ? 'Q' + q : 'OT');
  GI.spotLabel = function (G, side) {
    const on = G.ballOn;
    if (on === 50) return '50';
    const t = on < 50 ? G.teams[side || G.poss] : G.teams[other(side || G.poss)];
    return `${t.abbr} ${on < 50 ? on : 100 - on}`;
  };
  GI.fgChance = function (G, side, dist) {
    const t = G.teams[side], r = GI.ratings(t), W = GI.WEATHER[G.weather];
    const kp = t.stars.find((s) => s.pos === 'KP' && !s.injured);
    let range = 52 + (r.st - 65) / 3 + W.kick * 0.6 + (kp && kp.armed ? 8 : 0);
    if (side === 'away') range -= (G.crowd.level / 100) * 1.5;
    return 1 / (1 + Math.exp((dist - range) / 4.2));
  };

  // ---------- what does the game need next? ----------
  GI.need = function (G) {
    if (G.over) return { kind: 'over' };
    if (G.phase !== 'pat' && G.clock <= 0) periodEnd(G);
    if (G.over) return { kind: 'over' };
    if (G.phase === 'kickoff') {
      const userKicks = G.kickTeam === G.user;
      const late = G.q >= 4 && G.clock < 300;
      const diff = G.score[G.kickTeam] - G.score[other(G.kickTeam)];
      return { kind: 'kickoff', userKicks, onsideOk: !G.freeKick && late && diff < 0 && diff >= -16 };
    }
    if (G.phase === 'pat') return { kind: 'pat', userScored: G.poss === G.user, twoPt: G.twoPt };
    const userOff = G.poss === G.user;
    if (!G.pending) {
      G.pending = {};
      if (!userOff) {
        const spec = cpuFourth(G);
        G.pending.cpuSpecial = spec;
        if (!spec) G.pending.cpuOff = cpuOffCall(G);
        armCpu(G, G.poss, 'o', G.pending.cpuOff);
      } else {
        G.pending.cpuDef = cpuDefCall(G);
        armCpu(G, other(G.poss), 'd');
      }
    }
    const fgDist = 117 - G.ballOn;
    return {
      kind: 'call', userOff, cpuSpecial: G.pending.cpuSpecial || null, fourth: G.down === 4 && !G.twoPt,
      fgDist, fgPct: fgDist <= 70 ? Math.round(GI.fgChance(G, G.poss, fgDist) * 100) : 0, twoPt: !!G.twoPt,
    };
  };

  function periodEnd(G) {
    if (G.q === 1 || G.q === 3) {
      G.q++; G.clock = G.qLen; G.flash = 'q' + G.q;
      addLog(G, `End of quarter ${G.q - 1}.`, 'info');
    } else if (G.q === 2) {
      G.q = 3; G.clock = G.qLen; G.phase = 'kickoff'; G.kickTeam = G.firstRecv; G.poss = other(G.firstRecv); G.freeKick = false; G.pending = null;
      G.flash = 'half';
      addLog(G, 'Halftime.', 'info');
    } else if (G.q === 4) {
      if (G.score.home === G.score.away) {
        G.q = 5; G.ot = true; G.clock = Math.min(G.qLen, 600);
        const recv = R() < 0.5 ? 'home' : 'away';
        G.phase = 'kickoff'; G.kickTeam = other(recv); G.poss = recv; G.freeKick = false; G.pending = null; G.flash = 'ot';
        addLog(G, `Overtime! Sudden death. ${G.teams[recv].name} receive.`, 'info');
      } else endGame(G);
    } else if (G.playoff && G.score.home === G.score.away) {
      G.clock = Math.min(G.qLen, 600);
      const recv = R() < 0.5 ? 'home' : 'away';
      G.phase = 'kickoff'; G.kickTeam = other(recv); G.poss = recv; G.freeKick = false; G.pending = null; G.flash = 'ot';
      addLog(G, `Still tied — another overtime period. Playoffs can't end in a tie.`, 'info');
    } else endGame(G);
  }
  function endGame(G) { G.over = true; G.phase = 'over'; addLog(G, 'Final.', 'info'); }

  // ---------- CPU brains ----------
  const ADAPT = { rookie: 0, pro: 8, legend: 14 };
  const DIFF_ADV = { rookie: -0.35, pro: 0, legend: 0.35 };
  function cpuFourth(G) {
    if (G.down !== 4 || G.twoPt) return null;
    const diff = G.score[G.poss] - G.score[other(G.poss)];
    const late = G.q >= 4 && G.clock < 360;
    const fgDist = 117 - G.ballOn;
    const fgP = GI.fgChance(G, G.poss, fgDist);
    if (late && diff < 0 && (diff < -3 || fgP < 0.5)) return null; // must go
    if (late && diff < 0 && diff >= -3 && fgP >= 0.5) return 'fg';
    if (G.toGo <= 1 && G.ballOn >= 45 && R() < 0.55) return null;
    if (G.toGo <= 3 && G.ballOn >= 62 && fgP < 0.45) return null;
    if (fgP >= 0.45) return 'fg';
    return 'punt';
  }
  function cpuOffCall(G) {
    const t = G.teams[G.poss];
    const w = { in_run: 22, out_run: 18, short: 28, long: 16, trick: 4 };
    const st = t.coaches.oc.style;
    if (st === 'run') { w.in_run *= 1.45; w.out_run *= 1.45; }
    if (st === 'pass') { w.short *= 1.35; w.long *= 1.45; }
    if (st === 'gadget') w.trick *= 3.2;
    if (G.toGo >= 8) { w.short *= 2; w.long *= 2.2; w.in_run *= 0.4; w.out_run *= 0.5; }
    if (G.toGo <= 2) { w.in_run *= 2; w.out_run *= 1.4; w.long *= 0.5; }
    const diff = G.score[G.poss] - G.score[other(G.poss)];
    if (G.q >= 4 && G.clock < 300 && diff < 0) { w.short *= 1.8; w.long *= 1.8; }
    if (G.q >= 4 && G.clock < 300 && diff > 0) { w.in_run *= 2.2; w.out_run *= 1.6; w.trick = 0; }
    if (G.ballOn >= 92) { w.long *= 0.2; }
    const k = ADAPT[G.diff];
    G.hist.def.slice(0, 6).forEach((d) => {
      for (const o in GI.MATRIX) if (GI.MATRIX[o][d] === 2) w[o] += k;
    });
    return wpick(w);
  }
  function cpuDefCall(G) {
    const t = G.teams[other(G.poss)];
    const w = { man: 18, zone: 22, deep: 14, press: 14, blitz_in: 14, blitz_out: 14 };
    const st = t.coaches.dc.style;
    if (st === 'blitz') { w.blitz_in *= 1.8; w.blitz_out *= 1.8; }
    if (st === 'cover') { w.zone *= 1.6; w.deep *= 1.6; }
    if (st === 'press') { w.press *= 1.7; w.man *= 1.5; }
    if (G.toGo >= 8) { w.deep *= 1.8; w.zone *= 1.4; }
    if (G.toGo <= 2) { w.blitz_in *= 1.8; w.blitz_out *= 1.4; w.deep *= 0.4; }
    const k = ADAPT[G.diff];
    G.hist.off.slice(0, 6).forEach((o) => { w[GI.counterOf(o)] += k; });
    if (G.film && G.diff !== 'rookie') w[GI.counterOf(G.potw.off)] += 18; // they studied your Play of the Week
    return wpick(w);
  }
  function armCpu(G, side, kind, call) {
    G.teams[side].stars.forEach((s) => {
      if (s.injured || s.armed || s.meter < 100) return;
      const sm = GI.SHOWME[s.pos];
      if (kind === 'o' && sm.o && call && sm.o.includes(call)) s.armed = true;
      else if (kind === 'o' && !call && s.pos === 'KP') s.armed = true;
      else if (kind === 'd' && sm.d && R() < 0.55) s.armed = true;
    });
  }

  // ---------- user arming ----------
  GI.toggleArm = function (G, starId) {
    const s = G.teams[G.user].stars.find((x) => x.id === starId);
    if (!s || s.injured) return false;
    if (s.armed) { s.armed = false; return true; }
    if (s.meter >= 100) { s.armed = true; return true; }
    return false;
  };

  // ---------- the main step ----------
  GI.step = function (G, act) {
    G.playNo++;
    let res;
    if (act.type === 'kickoff') res = doKickoff(G, act.onside);
    else if (act.type === 'pat') res = doPAT(G, act.choice);
    else {
      const userOff = G.poss === G.user;
      const spec = act.special || (!userOff && G.pending && G.pending.cpuSpecial);
      if (spec === 'punt') res = doPunt(G);
      else if (spec === 'fg') res = doFG(G);
      else {
        const off = userOff ? act.call : G.pending.cpuOff;
        const def = userOff ? G.pending.cpuDef : act.call;
        if (userOff) G.hist.off.unshift(off); else G.hist.def.unshift(def);
        G.hist.off.length = Math.min(G.hist.off.length, 20); G.hist.def.length = Math.min(G.hist.def.length, 20);
        res = doScrimmage(G, off, def);
      }
    }
    G.pending = null;
    if (G.ot && res.scored && G.score.home !== G.score.away) endGame(G);
    return res;
  };

  function frame(G, side) { // user-frame absolute line & direction for team `side` moving
    const up = side === G.user;
    return { los: up ? G.ballOn : 100 - G.ballOn, dir: up ? 1 : -1 };
  }

  // ---------- scrimmage ----------
  function doScrimmage(G, off, def) {
    const P = G.poss, D = other(P);
    const ot = G.teams[P], dt = G.teams[D];
    const ro = GI.ratings(ot), rd = GI.ratings(dt);
    const W = GI.WEATHER[G.weather];
    const isRun = off === 'in_run' || off === 'out_run';
    const isPass = off === 'short' || off === 'long';
    const res = { off, def, side: P, ...frame(G, P), start: G.ballOn, down: G.down, toGo: G.toGo };
    const matrix = GI.MATRIX[off][def];
    res.matrix = matrix;

    // crowd false start
    if (P === 'away' && G.crowd.level >= 70 && R() < 0.035) {
      const back = Math.min(5, Math.floor(G.ballOn / 2));
      G.ballOn -= back; G.toGo += back;
      res.kind = 'penalty'; res.yards = -back;
      res.text = `False start! The ${G.crowd.name.toLowerCase()} crowd rattles ${ot.abbr}. -${back}`;
      res.banner = { title: 'FALSE START', sub: 'Crowd noise', tone: 'warn' };
      addLog(G, res.text, 'pen');
      G.clock = Math.max(0, G.clock - 3);
      return res;
    }

    let a = matrix;
    const unit = isRun ? ro.run * 0.6 + ro.ol * 0.4 - (rd.runD * 0.7 + rd.rush * 0.3)
      : isPass ? ro.pass * 0.65 + ro.ol * 0.35 - (rd.passD * 0.65 + rd.rush * 0.35)
        : (ro.pass + ro.run) / 2 - (rd.passD + rd.runD) / 2;
    a += unit / 16;
    a += (ot.coaches.oc.rating - dt.coaches.dc.rating) / 45;
    res.potw = false;
    // Play of the Week: only a few reps per game
    if (P === G.user && off === G.potw.off && G.potwLeft.off > 0) { a += 0.7; G.potwLeft.off--; res.potw = 'off'; }
    if (D === G.user && def === G.potw.def && G.potwLeft.def > 0) { a -= 0.7; G.potwLeft.def--; res.potw = 'def'; }
    if (P !== G.user && off === G.cpuPotw.off && G.cpuPotwLeft.off > 0) { a += 0.7; G.cpuPotwLeft.off--; res.cpuPotw = 'off'; }
    if (D !== G.user && def === G.cpuPotw.def && G.cpuPotwLeft.def > 0) { a -= 0.7; G.cpuPotwLeft.def--; res.cpuPotw = 'def'; }
    // predictable: same call 3+ snaps in a row gets read by the defense / offense
    const runOf = (h, c) => { let n = 0; for (const x of h) { if (x === c) n++; else break; } return n; };
    if (P === G.user) { const n = runOf(G.hist.off, off); if (n >= 3) { a -= n >= 4 ? 0.9 : 0.5; res.predictable = true; } }
    if (D === G.user) { const n = runOf(G.hist.def, def); if (n >= 3) { a += n >= 4 ? 0.9 : 0.5; res.predictable = true; } }
    a += (G.morale[P] - G.morale[D]) / 150;
    if (isPass) a += W.pass;
    if (off === 'long') a += W.long;
    if (isRun) a += W.run;
    if (off === 'trick') a += W.pass * 0.5;
    if (P === 'away') a -= (G.crowd.level / 100) * 0.25;
    if (G.weather === 'heat' && G.q >= 4) a += (ro.ovr - rd.ovr) / 40;
    a += (P === G.user ? -1 : 1) * DIFF_ADV[G.diff];
    a += gauss(0, 0.35);
    a = clamp(a, -4, 4);
    res.adv = a;

    // star show-me triggers
    const armedUsed = [];
    const trig = (team, sideKey) => {
      let best = null;
      team.stars.forEach((s) => {
        if (s.injured) return;
        const list = GI.SHOWME[s.pos][sideKey];
        if (!list || !list.includes(off)) return;
        if (s.armed) armedUsed.push(s);
        const ch = s.armed ? 0.62 : Math.pow(s.meter / 100, 2) * 0.006 * (s.rating / 85);
        if (R() < ch) {
          const score = (s.armed ? 100 : 0) + s.rating + R() * 20;
          if (!best || score > best.score) best = { s, score };
        }
      });
      return best;
    };
    const oS = trig(ot, 'o'), dS = trig(dt, 'd');
    let crazy = null, clash = null;
    if (oS && dS) {
      // STAR CLASH: both stars go off on the same snap
      const cs = (s, side, team) => s.rating + (G.morale[side] - 50) * 0.35 + (s.armed ? 10 : 0) + R() * 25;
      const oScore = cs(oS.s, P, ot) + a * 6, dScore = cs(dS.s, D, dt) - a * 6;
      const oWin = oScore >= dScore;
      crazy = oWin ? { s: oS.s, side: 'o' } : { s: dS.s, side: 'd' };
      const win = oWin ? oS.s : dS.s, lose = oWin ? dS.s : oS.s;
      clash = { o: GI.shortName(oS.s.name), oPos: oS.s.pos, d: GI.shortName(dS.s.name), dPos: dS.s.pos, winner: GI.shortName(win.name), winSide: oWin ? P : D, loseSide: oWin ? D : P };
      G.morale[clash.winSide] = clamp(G.morale[clash.winSide] + 4, 15, 99);
      G.morale[clash.loseSide] = clamp(G.morale[clash.loseSide] - 4, 15, 99);
      G.rivals = G.rivals || [];
      G.rivals.unshift({ a: win.name, b: lose.name, q: G.q });
      clash.refund = win;
    }
    else if (oS) crazy = { s: oS.s, side: 'o' };
    else if (dS) crazy = { s: dS.s, side: 'd' };
    armedUsed.forEach((s) => { s.armed = false; s.meter = 0; });
    if (crazy && crazy.s.meter > 0) crazy.s.meter = Math.max(0, crazy.s.meter - 45);
    if (clash) { clash.refund.meter = 40; delete clash.refund; res.clash = clash; }

    // receiver / defender selection helpers
    const pickTarget = () => {
      const w = { WR1: 3, WR2: 3, WR3: 2, TE: 1.5, RB: 1 };
      ['WR1', 'WR2', 'WR3', 'TE'].forEach((r) => { if (GI.starAt(ot, r)) w[r] *= 2.5; });
      return wpick(w);
    };
    const pickDef = (roles) => {
      const w = {};
      roles.forEach((r) => (w[r] = GI.starAt(dt, r) ? 3 : 1));
      return wpick(w);
    };
    const blitz = def === 'blitz_in' || def === 'blitz_out';

    // ---------- outcome ----------
    let o = {};
    const fumbleCheck = (p) => R() < p * W.fum;
    if (crazy) {
      const s = crazy.s, pos = s.pos;
      o.crazy = { name: GI.shortName(s.name), pos, title: GI.SHOWME[pos].name, team: crazy.side === 'o' ? P : D };
      if (pos === 'QB') {
        o.kind = 'pass'; o.target = pickTarget(); o.air = off === 'short' ? ri(9, 18) : ri(26, 48); o.yac = ri(2, 16);
      } else if (pos === 'WR') {
        o.kind = 'pass'; o.target = s.role; o.air = off === 'short' ? ri(7, 15) : ri(22, 42); o.yac = ri(4, 22);
      } else if (pos === 'RB') {
        o.kind = 'run'; o.yards = ri(22, 65); o.carrier = 'RB';
      } else if (pos === 'TE') {
        if (isRun) { o.kind = 'run'; o.carrier = 'RB'; o.yards = Math.max(1, Math.round(gauss(4, 2))) + 12; o.pancake = 'TE'; }
        else { o.kind = 'pass'; o.target = 'TE'; o.air = ri(6, 14); o.yac = ri(8, 28); }
      } else if (pos === 'OL') {
        o.kind = 'run'; o.carrier = 'RB'; o.yards = Math.max(1, Math.round(gauss(4, 2))) + 15; o.pancake = s.role;
      } else if (pos === 'DL') {
        if (isRun) { o.kind = 'run'; o.carrier = 'RB'; o.yards = -ri(2, 6); o.by = s.role; if (R() < 0.3) { o.fumble = true; o.recD = true; o.ret = ri(0, 10); } }
        else { o.kind = 'sack'; o.yards = -ri(6, 11); o.by = s.role; if (R() < 0.42) { o.fumble = true; o.recD = true; o.ret = ri(0, 22); } }
      } else if (pos === 'LB') {
        if (isRun) { o.kind = 'run'; o.carrier = 'RB'; o.yards = ri(-1, 3); o.by = s.role; o.fumble = true; o.recD = true; o.ret = R() < 0.3 ? ri(25, 70) : ri(0, 15); }
        else { o.kind = 'int'; o.target = pickTarget(); o.air = ri(3, 10); o.by = s.role; o.ret = ri(10, 55); }
      } else if (pos === 'CB') {
        if (R() < 0.55) { o.kind = 'int'; o.target = s.role === 'CB1' ? 'WR1' : 'WR2'; o.air = off === 'short' ? ri(5, 11) : ri(18, 36); o.by = s.role; o.ret = ri(5, 50); }
        else { o.kind = 'incomplete'; o.target = s.role === 'CB1' ? 'WR1' : 'WR2'; o.air = off === 'short' ? ri(5, 11) : ri(18, 36); o.by = s.role; o.breakup = true; o.crazy.title = 'Pass Breakup'; }
      } else if (pos === 'S') {
        o.kind = 'int'; o.target = pickTarget(); o.air = off === 'short' ? ri(5, 13) : ri(20, 38); o.by = s.role; o.ret = ri(15, 80);
      }
    } else if (isRun) {
      o.kind = 'run'; o.carrier = 'RB';
      let y;
      if (off === 'in_run') {
        y = gauss(3.1 + a * 1.1, 2.3);
        if (R() < 0.02 + Math.max(0, a) * 0.015) y += ri(8, 28);
      } else {
        y = gauss(3.2 + a * 1.4, 4.0);
        if (R() < 0.045 + Math.max(0, a) * 0.025) y += ri(10, 40);
        if (a < -1 && R() < 0.35) y = -ri(1, 5);
      }
      o.yards = Math.round(y);
      if (o.yards <= 0) o.by = pickDef(['DE1', 'DT1', 'DT2', 'DE2', 'MLB']);
      if (fumbleCheck(0.011 * (1 - a * 0.12))) { o.fumble = true; o.recD = R() < 0.55; o.ret = ri(0, 8); o.by = pickDef(['MLB', 'WLB', 'SLB', 'SS']); }
    } else if (isPass) {
      const long = off === 'long';
      let sackP = (long ? 0.065 : 0.035) * (blitz ? 1.7 : 1) * (1 - (ro.ol - 60) / 120) - a * 0.008;
      if (GI.starAt(ot, 'C') || GI.starAt(ot, 'LT') || GI.starAt(ot, 'RT')) sackP *= 0.75;
      const compP = clamp((long ? 0.32 : 0.63) + a * (long ? 0.08 : 0.07), 0.1, 0.9);
      const intP = Math.max(long ? 0.012 : 0.006, (long ? 0.05 : 0.022) - a * (long ? 0.01 : 0.006));
      o.target = pickTarget();
      const r = R();
      if (R() < sackP) {
        o.kind = 'sack'; o.yards = -ri(4, 9); o.by = pickDef(blitz ? ['MLB', 'WLB', 'SLB', 'DE1', 'DE2'] : ['DE1', 'DE2', 'DT1', 'DT2']);
        if (R() < 0.1) { o.fumble = true; o.recD = R() < 0.6; o.ret = ri(0, 12); }
      } else if (r < intP) {
        o.kind = 'int'; o.air = long ? ri(18, 40) : ri(4, 10); o.by = pickDef(['CB1', 'CB2', 'FS', 'SS', 'MLB']); o.ret = Math.max(0, Math.round(gauss(10, 10)));
      } else if (r < intP + compP) {
        o.kind = 'pass'; o.air = long ? ri(14, 32) : ri(2, 8);
        o.yac = Math.max(0, Math.round(gauss(long ? 2 : 2.4 + a * 0.8, long ? 3.5 : 2.5)));
        if (R() < 0.025 + Math.max(0, a) * 0.02) o.yac += ri(10, 30);
        if (fumbleCheck(0.007)) { o.fumble = true; o.recD = R() < 0.55; o.ret = ri(0, 10); o.by = pickDef(['CB1', 'CB2', 'FS', 'SS']); }
      } else {
        o.kind = 'incomplete'; o.air = long ? ri(18, 40) : ri(3, 10); o.by = pickDef(['CB1', 'CB2', 'FS', 'SS', 'WLB']);
      }
    } else { // trick
      const sp = clamp(0.33 + a * 0.1, 0.1, 0.8);
      o.target = pickTarget(); o.trick = true;
      if (R() < sp) { o.kind = 'pass'; o.air = ri(14, 34); o.yac = ri(0, 12); }
      else {
        const r = R();
        if (r < 0.18) {
          if (R() < 0.5) { o.kind = 'int'; o.air = ri(15, 32); o.by = pickDef(['FS', 'SS', 'CB1']); o.ret = ri(0, 30); }
          else { o.kind = 'run'; o.carrier = 'RB'; o.yards = -ri(2, 6); o.fumble = true; o.recD = true; o.ret = ri(0, 15); o.by = pickDef(['DE1', 'DE2', 'WLB']); }
        } else if (r < 0.45) { o.kind = 'incomplete'; o.air = ri(15, 35); o.by = pickDef(['FS', 'SS']); }
        else { o.kind = 'sack'; o.yards = -ri(3, 9); o.by = pickDef(['DE1', 'DE2', 'MLB', 'WLB']); }
      }
    }
    Object.assign(res, o);
    if (res.kind === 'pass' && res.target === 'RB' && res.air > 12) res.air = ri(2, 8);

    // ---------- apply ----------
    const S = G.stats[P];
    S.plays++;
    const start = G.ballOn;
    let gain = 0, clockUse = ri(30, 40);
    const hurry = (G.q === 2 || G.q >= 4) && G.clock < 150 && (G.score[P] <= G.score[D] || G.q === 2);
    if (hurry) clockUse = ri(12, 18);
    const offName = ot.abbr;
    let txt = '';
    const nm = (role, team) => GI.who(team || ot, role);
    if (res.kind === 'run') { gain = res.yards; txt = `${nm('RB')} ${off === 'in_run' ? 'up the middle' : 'to the edge'}`; }
    else if (res.kind === 'pass') { gain = res.air + res.yac; txt = `${res.trick ? 'Flea flicker! ' : ''}${nm('QB')} to ${nm(res.target)}`; }
    else if (res.kind === 'sack') { gain = res.yards; txt = `${nm('QB')} sacked by ${GI.who(dt, res.by)}`; S.sacks++; }
    else if (res.kind === 'incomplete') { gain = 0; clockUse = 5; txt = `${nm('QB')} incomplete for ${nm(res.target)}`; }
    else if (res.kind === 'int') { txt = `${nm('QB')} picked off by ${GI.who(dt, res.by)}!`; }
    if (res.pancake) txt += ` behind a ${nm(res.pancake)} pancake`;
    if (res.kind !== 'incomplete' && R() < 0.15 && (off === 'out_run' || res.kind === 'pass')) { clockUse = Math.min(clockUse, 7); res.oob = true; }

    if (res.kind === 'int' || res.fumble) {
      // turnover handling
      const spot = res.kind === 'int' ? start + res.air : clamp(start + gain, 1, 99);
      if (res.kind === 'int' || res.recD) {
        let dOn = 100 - Math.min(spot, 100);
        let ret = res.ret || 0;
        let newOn = dOn + ret;
        if (res.kind === 'int' && dOn <= 0 && ret < 8) { newOn = 20; res.touchback = true; ret = 0; }
        res.retYds = ret; res.toSpot = spot;
        S.to++; clockUse = 8;
        G.morale[D] = clamp(G.morale[D] + 3, 15, 99); G.morale[P] = clamp(G.morale[P] - 4, 15, 99);
        if (res.fumble) txt += ` — FUMBLE! ${dt.abbr} recover${ret > 5 ? ` and return it ${ret}` : ''}`;
        else if (ret > 0) txt += ` Returned ${ret} yards.`;
        if (G.twoPt) {
          G.twoPt = false; G.phase = 'kickoff'; G.kickTeam = P; G.freeKick = false; G.poss = P;
          res.twoPtResult = false;
          res.banner = { title: 'NO GOOD', sub: '2-pt try fails', tone: P === G.user ? 'bad' : 'good' };
        } else if (newOn >= 100) {
          res.td = true; res.defTD = true; res.scored = D;
          G.score[D] += 6; G.poss = D; G.ballOn = 98; G.phase = 'pat';
          txt += ' TOUCHDOWN!';
          res.banner = { title: res.kind === 'int' ? 'PICK SIX!' : 'SCOOP & SCORE!', sub: `${dt.name} defense scores`, tone: D === G.user ? 'good' : 'bad' };
        } else {
          G.poss = D; G.ballOn = clamp(newOn, 1, 99); G.down = 1; G.toGo = Math.min(10, 100 - G.ballOn);
          res.banner = { title: res.kind === 'int' ? 'INTERCEPTED!' : 'FUMBLE!', sub: `${dt.name} ball`, tone: D === G.user ? 'good' : 'bad' };
        }
        res.turnover = true;
      } else {
        txt += ' — fumble, but they recover it.';
        res.fumble = 'kept';
      }
    }
    if (!res.turnover) {
      if (res.kind === 'pass') { S.pass += gain; } else if (res.kind === 'run') S.rush += gain;
      S.yds += gain;
      let newOn = start + gain;
      res.gain = gain;
      if (G.twoPt) {
        G.twoPt = false;
        const ok = newOn >= 100;
        res.twoPtResult = ok;
        if (ok) { G.score[P] += 2; res.scored = P; }
        txt += ok ? ' — TWO-POINT GOOD!' : ' — two-point try fails.';
        res.banner = ok ? { title: '2-PT GOOD!', sub: offName, tone: P === G.user ? 'good' : 'bad' } : { title: 'NO GOOD', sub: '2-pt try fails', tone: P === G.user ? 'bad' : 'good' };
        G.phase = 'kickoff'; G.kickTeam = P; G.freeKick = false;
        clockUse = 0;
      } else if (newOn >= 100) {
        res.gain = gain = 100 - start; res.td = true; res.scored = P;
        G.score[P] += 6; G.phase = 'pat'; G.ballOn = 98;
        txt += ` for ${gain} — TOUCHDOWN!`;
        G.morale[P] = clamp(G.morale[P] + 4, 15, 99); G.morale[D] = clamp(G.morale[D] - 3, 15, 99);
        res.banner = { title: 'TOUCHDOWN!', sub: ot.name, tone: P === G.user ? 'good' : 'bad' };
        clockUse = Math.min(clockUse, 8);
      } else if (newOn <= 0) {
        res.safety = true; res.scored = D;
        G.score[D] += 2; txt += ' — SAFETY!';
        G.phase = 'kickoff'; G.kickTeam = P; G.freeKick = true;
        res.banner = { title: 'SAFETY!', sub: `+2 ${dt.name}`, tone: D === G.user ? 'good' : 'bad' };
      } else {
        if (res.kind !== 'incomplete') txt += gain === 0 ? ' for no gain' : gain > 0 ? ` for ${gain}` : ` for a loss of ${-gain}`;
        G.ballOn = newOn;
        if (gain >= G.toGo) {
          G.down = 1; G.toGo = Math.min(10, 100 - newOn); S.first++; res.firstDown = true; txt += '. First down!';
        } else {
          G.down++; G.toGo -= gain;
          if (G.down > 4) {
            txt += '. Turnover on downs!';
            G.poss = D; G.ballOn = 100 - newOn; G.down = 1; G.toGo = Math.min(10, 100 - G.ballOn);
            res.downs = true;
            res.banner = { title: 'TURNOVER ON DOWNS', sub: `${dt.name} ball`, tone: D === G.user ? 'good' : 'bad' };
          }
        }
      }
      if (gain >= 20 && !res.td) { G.morale[P] = clamp(G.morale[P] + 2, 15, 99); if (!res.banner) res.banner = { title: 'BIG PLAY!', sub: `+${gain} yards`, tone: P === G.user ? 'good' : 'bad' }; }
      if (res.kind === 'sack') G.morale[D] = clamp(G.morale[D] + 2, 15, 99);
    }
    if (res.crazy) {
      res.banner = { title: res.crazy.title.toUpperCase() + '!', sub: `★ ${res.crazy.name} (${GI.POS[res.crazy.pos].label}) showed out`, tone: res.crazy.team === G.user ? 'good' : 'bad', star: true };
      if (res.td) res.banner.title = res.crazy.title.toUpperCase() + ' — TD!';
      txt = `★ ${res.crazy.title}! ` + txt;
    }
    if (res.clash) {
      const c = res.clash;
      res.banner = { title: 'STAR CLASH!', sub: `${c.o} vs ${c.d} — ${c.winner} wins it`, tone: c.winSide === G.user ? 'good' : 'bad', star: true, clash: true, after: res.crazy ? res.crazy.title.toUpperCase() + (res.td ? ' — TD!' : '!') : null };
      txt = `⚔️ STAR CLASH: ${c.o} vs ${c.d}, ${c.winner} wins! ` + txt.replace(/^★ [^!]*! /, '');
    }
    res.text = `${offName}: ${GI.playName(off)} vs ${GI.playName(def)} — ${txt}`;
    G.stats[P].top += clockUse;
    G.clock = Math.max(0, G.clock - clockUse);
    addLog(G, res.text, res.td ? 'td' : res.turnover ? 'to' : res.crazy ? 'star' : 'play');

    bumpMeters(G, res, P, D, isRun, isPass);
    injuries(G, res);
    return res;
  }

  function bumpMeters(G, res, P, D, isRun, isPass) {
    const gain = res.gain || 0;
    const offGood = !res.turnover && (gain >= 5 || res.firstDown || res.td);
    const big = gain >= 18 || res.td;
    const defGood = res.turnover || res.kind === 'sack' || res.kind === 'incomplete' || (!res.turnover && gain <= 2);
    const invO = isRun ? ['RB', 'OL', 'TE'] : isPass ? ['QB', 'WR', 'OL', 'TE'] : ['QB', 'RB', 'WR', 'TE'];
    const invD = isRun ? ['LB', 'DL'] : ['S', 'DL', 'LB', 'CB'];
    const offBad = res.turnover || res.kind === 'incomplete' || res.kind === 'sack' || gain <= 0;
    const defBad = !res.turnover && (gain >= 8 || res.td);
    [P, D].forEach((side) => {
      const t = G.teams[side];
      let mult = 0.6 + G.morale[side] / 125;
      if (G.weather === 'heat') mult *= 1.2;
      t.stars.forEach((s) => {
        if (s.injured) return;
        // on-fire stars cool off after two bad plays in a row
        if (s.meter >= 100) {
          const bad = side === P ? offBad : defBad;
          if (bad) {
            s.bad = (s.bad || 0) + 1;
            if (s.bad >= 2) {
              s.meter = 70; s.armed = false; s.bad = 0;
              res.cooled = (res.cooled || []).concat([{ side, name: GI.shortName(s.name), pos: s.pos }]);
            }
          } else s.bad = 0;
          return;
        }
        if (s.armed) return;
        let add = R() < 0.5 ? 1 : 0;
        if (side === 'home' && R() < G.crowd.level / 200) add += 1;
        if (side === P && invO.includes(s.pos)) { if (offGood) add += 3; if (big) add += 4; }
        if (side === D && invD.includes(s.pos)) { if (defGood) add += 3; if (res.turnover) add += 5; }
        if (res.crazy && res.crazy.name === GI.shortName(s.name)) add = 0;
        s.meter = clamp(s.meter + Math.round(add * mult), 0, 100);
      });
    });
  }

  function injuries(G, res) {
    ['home', 'away'].forEach((side) => {
      if (R() > 0.0045) return;
      const t = G.teams[side];
      const pool = t.stars.filter((s) => !s.injured && s.pos !== 'KP' && s.pos !== 'QB');
      if (R() < 0.15) { const qb = t.stars.find((s) => s.pos === 'QB' && !s.injured); if (qb) pool.push(qb); }
      if (!pool.length) return;
      const s = pool[ri(0, pool.length - 1)];
      s.injured = true; s.armed = false;
      const msg = `INJURY: ${t.abbr} ${GI.POS[s.pos].label} ${GI.shortName(s.name)} is out for the game.`;
      addLog(G, msg, 'inj');
      res.injury = (res.injury || []).concat([{ side, name: GI.shortName(s.name), pos: s.pos }]);
      G.morale[side] = clamp(G.morale[side] - 4, 15, 99);
    });
  }

  // ---------- special teams ----------
  function kpStar(team) { return team.stars.find((s) => s.pos === 'KP' && !s.injured); }
  function useKP(team) {
    const k = kpStar(team);
    if (!k) return false;
    if (k.armed) { k.armed = false; k.meter = 0; return true; }
    k.meter = clamp(k.meter + 6, 0, 100);
    return false;
  }

  function doPunt(G) {
    const P = G.poss, D = other(P), t = G.teams[P], r = GI.ratings(t), rd = GI.ratings(G.teams[D]);
    const W = GI.WEATHER[G.weather];
    const big = useKP(t);
    const start = G.ballOn;
    const res = { kind: 'punt', side: P, ...frame(G, P), start, off: 'punt', def: '-' };
    let gross = Math.round(gauss(44 + (r.st - 65) / 4, 5) + W.kick * 0.7 + (big ? 9 : 0));
    let landing = start + gross;
    let txt;
    if (R() < 0.008) {
      res.blocked = true; G.poss = D; G.ballOn = clamp(100 - (start - 7), 1, 99);
      txt = `${t.abbr} punt BLOCKED!`;
      res.banner = { title: 'BLOCKED PUNT!', sub: `${G.teams[D].name} ball`, tone: D === G.user ? 'good' : 'bad' };
      res.land = start - 7; res.ret = 0;
    } else if (landing >= 100) {
      res.land = 105; res.touchback = true; res.ret = 0;
      G.poss = D; G.ballOn = 20; txt = `${t.abbr} punts ${gross} yards into the end zone. Touchback.`;
    } else {
      let ret = Math.max(0, Math.round(gauss(8 + (rd.st - 65) / 8, 5)));
      if (big && landing >= 88) { ret = 0; res.coffin = true; }
      if (R() < 0.007) { ret = 100 - (100 - landing); }
      res.land = landing;
      if (R() < 0.01 && !res.coffin) {
        res.muff = true; res.ret = 0; G.ballOn = clamp(landing, 1, 99); G.down = 1; G.toGo = Math.min(10, 100 - G.ballOn);
        txt = `MUFFED PUNT! ${t.abbr} recover at the ${GI.spotLabel(G, P)}.`;
        res.banner = { title: 'MUFFED PUNT!', sub: `${t.name} recover`, tone: P === G.user ? 'good' : 'bad' };
        G.stats[P].top += 8; G.clock = Math.max(0, G.clock - 8);
        addLog(G, txt, 'to');
        return res;
      }
      res.ret = ret;
      const dOn = 100 - landing + ret;
      if (dOn >= 100) {
        G.poss = D; G.score[D] += 6; G.phase = 'pat'; G.ballOn = 98; res.td = true; res.scored = D;
        txt = `${G.teams[D].abbr} takes the punt ALL THE WAY BACK! Touchdown!`;
        res.banner = { title: 'PUNT RETURN TD!', sub: G.teams[D].name, tone: D === G.user ? 'good' : 'bad' };
      } else {
        G.poss = D; G.ballOn = clamp(dOn, 1, 99);
        txt = `${t.abbr} punts ${gross}${ret ? `, returned ${ret}` : ', downed'}.${res.coffin ? ' Coffin corner!' : ''}`;
      }
    }
    if (big && !res.banner) res.banner = { title: 'BIG LEG!', sub: `★ ${GI.shortName(kpStar(t).name)} booms it ${gross}`, tone: P === G.user ? 'good' : 'bad', star: true };
    if (G.phase !== 'pat') { G.down = 1; G.toGo = Math.min(10, 100 - G.ballOn); }
    res.gross = gross;
    G.clock = Math.max(0, G.clock - 9); G.stats[P].top += 9;
    res.text = txt;
    addLog(G, txt, res.td ? 'td' : 'play');
    return res;
  }

  function doFG(G) {
    const P = G.poss, D = other(P), t = G.teams[P];
    const start = G.ballOn, dist = 117 - start;
    const p = GI.fgChance(G, P, dist);
    const big = useKP(t);
    const pp = big ? GI.fgChance(G, P, dist - 8) : p;
    const res = { kind: 'fg', side: P, ...frame(G, P), start, dist, off: 'fg', def: '-' };
    const blocked = R() < 0.015;
    res.good = !blocked && R() < pp;
    res.blocked = blocked;
    let txt;
    if (res.good) {
      G.score[P] += 3; res.scored = P; G.phase = 'kickoff'; G.kickTeam = P; G.freeKick = false;
      txt = `${t.abbr} ${dist}-yard field goal is GOOD.`;
      res.banner = { title: 'IT\'S GOOD!', sub: `${dist}-yard field goal`, tone: P === G.user ? 'good' : 'bad', star: big };
      if (big) res.banner.sub = `★ Big Leg — ${dist} yards`;
    } else {
      G.poss = D; G.ballOn = clamp(100 - (start - 7), 20, 99); G.down = 1; G.toGo = 10;
      txt = `${t.abbr} ${dist}-yard field goal ${blocked ? 'is BLOCKED!' : 'is no good.'}`;
      res.banner = { title: blocked ? 'BLOCKED!' : 'NO GOOD', sub: `${dist}-yard try`, tone: P === G.user ? 'bad' : 'good' };
    }
    G.clock = Math.max(0, G.clock - 5); G.stats[P].top += 5;
    res.text = txt;
    addLog(G, txt, 'play');
    return res;
  }

  function doPAT(G, choice) {
    const P = G.poss, t = G.teams[P];
    if (choice === 'two') {
      G.twoPt = true; G.phase = 'play'; G.ballOn = 98; G.down = 1; G.toGo = 2;
      return { kind: 'setup2', text: `${t.abbr} going for two!` };
    }
    const p = GI.fgChance(G, P, 33);
    const big = useKP(t);
    const good = R() < (big ? 0.995 : p);
    const res = { kind: 'xp', side: P, ...frame({ user: G.user, ballOn: 85 }, P), start: 85, dist: 33, good, off: 'xp', def: '-' };
    if (good) { G.score[P] += 1; res.scored = P; }
    G.phase = 'kickoff'; G.kickTeam = P; G.freeKick = false;
    res.text = `${t.abbr} extra point ${good ? 'is good' : 'is NO GOOD'}.`;
    if (!good) res.banner = { title: 'PAT MISSED', sub: '', tone: P === G.user ? 'bad' : 'good' };
    addLog(G, res.text, 'play');
    return res;
  }
  GI.cpuPAT = function (G) {
    const diff = G.score[G.poss] - G.score[other(G.poss)];
    const late = G.q >= 4 && G.clock < 420;
    if (late && [-1, -5, -10, 1, 5, -2].includes(diff)) return 'two';
    return 'xp';
  };

  function doKickoff(G, onside) {
    const K = G.kickTeam, Rv = other(K), kt = G.teams[K], rt = G.teams[Rv];
    const rk = GI.ratings(kt), rr = GI.ratings(rt);
    const W = GI.WEATHER[G.weather];
    const kickFrom = G.freeKick ? 20 : 35;
    const fr = frame({ user: G.user, ballOn: kickFrom }, K);
    const res = { kind: 'kickoff', side: K, ...fr, start: kickFrom, off: 'kick', def: '-' };
    G.ballOn = kickFrom; // for frame in anim
    let txt;
    G.poss = Rv; G.down = 1; G.toGo = 10; G.phase = 'play';
    if (onside) {
      res.onside = true;
      const ok = R() < 0.13 + (rk.st - rr.st) / 400;
      res.recovered = ok;
      if (ok) {
        G.poss = K; G.ballOn = kickFrom + 11;
        txt = `${kt.abbr} ONSIDE KICK — RECOVERED!`;
        res.banner = { title: 'ONSIDE RECOVERED!', sub: kt.name, tone: K === G.user ? 'good' : 'bad' };
      } else {
        G.ballOn = 100 - (kickFrom + 11);
        txt = `${kt.abbr} onside kick recovered by ${rt.abbr}.`;
      }
      res.land = kickFrom + 11;
    } else {
      const big = useKP(kt);
      const tbP = G.freeKick ? 0.05 : clamp(0.55 + (rk.st - 65) / 200 + W.kick * 0.03 + (big ? 0.35 : 0), 0.1, 0.97);
      if (R() < tbP) {
        res.touchback = true; res.land = 106; G.ballOn = 30;
        txt = `${kt.abbr} kicks off. Touchback, ${rt.abbr} ball at the 30.`;
      } else {
        const catchOn = G.freeKick ? ri(15, 30) : ri(-3, 6);
        res.land = 100 - catchOn;
        let ret = Math.round(clamp(gauss(26 + (rr.st - 65) / 5, 7), 8, 48));
        if (R() < 0.03) ret += ri(15, 45);
        if (R() < 0.006) ret = 100;
        const on = catchOn + ret;
        res.ret = ret; res.catchOn = catchOn;
        if (on >= 100) {
          G.score[Rv] += 6; G.phase = 'pat'; G.ballOn = 98; res.td = true; res.scored = Rv;
          txt = `${rt.abbr} RETURNS THE KICKOFF FOR A TOUCHDOWN!`;
          res.banner = { title: 'KICK RETURN TD!', sub: rt.name, tone: Rv === G.user ? 'good' : 'bad' };
        } else {
          G.ballOn = clamp(on, 1, 99);
          txt = `${kt.abbr} kicks off, returned ${ret} yards to the ${GI.spotLabel(G, Rv)}.`;
          if (ret >= 40) res.banner = { title: 'BIG RETURN!', sub: `${ret} yards`, tone: Rv === G.user ? 'good' : 'bad' };
        }
      }
    }
    G.freeKick = false;
    G.toGo = Math.min(10, 100 - G.ballOn);
    if (!res.touchback) G.clock = Math.max(0, G.clock - 6);
    res.text = txt;
    addLog(G, txt, res.td ? 'td' : 'play');
    return res;
  }

  // ---------- CPU vs CPU: simulate a whole game instantly ----------
  GI.cpu = { fourth: cpuFourth, off: cpuOffCall, def: cpuDefCall, arm: armCpu };
  GI.autoCall = function (G) { // what a CPU coach would do for the "user" side
    const n = GI.need(G);
    if (n.kind === 'kickoff') return { type: 'kickoff', onside: n.onsideOk && R() < 0.7 };
    if (n.kind === 'pat') return { type: 'pat', choice: GI.cpuPAT(G) };
    if (n.kind !== 'call') return null;
    if (n.userOff) {
      const sp = cpuFourth(G);
      if (sp) { armCpu(G, G.poss, 'o', null); return { type: 'play', special: sp }; }
      const c = cpuOffCall(G);
      armCpu(G, G.poss, 'o', c);
      return { type: 'play', call: c };
    }
    if (n.cpuSpecial) return { type: 'play', call: null };
    armCpu(G, other(G.poss), 'd');
    return { type: 'play', call: cpuDefCall(G) };
  };
  GI.finishAuto = function (G) { // let the CPU play out the rest of a game
    let guard = 0;
    while (!G.over && guard++ < 2000) {
      const act = GI.autoCall(G);
      if (!act) break;
      const res = GI.step(G, act);
      if (res.crazy || res.clash) (G.highlights = G.highlights || []).push(res.text);
      if (res.injury) (G.injLog = G.injLog || []).push(...res.injury.map((i) => ({ team: G.teams[i.side].idx, name: i.name, pos: i.pos })));
    }
    return G;
  };
  GI.simGame = function (homeIdx, awayIdx, opts) {
    const o = Object.assign({ qMin: 8, diff: 'pro' }, opts || {});
    const G = GI.newGame(Object.assign({}, o, { user: homeIdx, opp: awayIdx, userHome: true, potw: { off: GI.OFF_PLAYS[ri(0, 4)].id, def: GI.DEF_PLAYS[ri(0, 5)].id } }));
    G.diff = 'pro';
    GI.finishAuto(G);
    return G;
  };
  GI.gameInjuries = function (G) { // star ids hurt during this game
    const out = [];
    ['home', 'away'].forEach((s) => G.teams[s].stars.forEach((st) => { if (st.injured) out.push({ id: st.id, team: G.teams[s].idx, name: st.name, pos: st.pos }); }));
    return out;
  };

  // ---------- save / load ----------
  const KEY = 'gridiron_save_v1';
  GI.save = (G) => { try { localStorage.setItem(KEY, JSON.stringify(G)); } catch (e) {} };
  GI.load = () => { try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } };
  GI.clearSave = () => { try { localStorage.removeItem(KEY); } catch (e) {} };
  GI.prefs = {
    get() { try { return JSON.parse(localStorage.getItem('gridiron_prefs') || '{}'); } catch (e) { return {}; } },
    set(p) { try { localStorage.setItem('gridiron_prefs', JSON.stringify(Object.assign(GI.prefs.get(), p))); } catch (e) {} },
  };
})();
