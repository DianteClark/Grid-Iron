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
      const traits = [];
      const tr = r();
      if (tr < 0.42) traits.push(GI.TRAIT_KEYS[Math.floor(r() * GI.TRAIT_KEYS.length)]);
      if (tr < 0.08) { const t2 = GI.TRAIT_KEYS[Math.floor(r() * GI.TRAIT_KEYS.length)]; if (!traits.includes(t2)) traits.push(t2); }
      return { id: abbr + k, pos, name: nm, num, role, rating: rr(74, 94), meter: rr(15, 45), armed: false, injured: false, age: rr(23, 31), clutch: rr(45, 95), dur: rr(45, 95), ego: rr(10, 90), traits };
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

  // ---------- dynamic (franchise) rosters ----------
  GI.ROLE_MAP = ROLE_MAP; GI.NUMS = NUMS;
  GI.assignRoles = function (stars) {
    const use = {};
    const order = ['KP', 'QB', 'RB', 'WR', 'TE', 'OL', 'LB', 'DL', 'S', 'CB'];
    stars.slice().sort((a, b) => order.indexOf(a.pos) - order.indexOf(b.pos) || b.rating - a.rating).forEach((s) => {
      use[s.pos] = use[s.pos] || 0;
      s.role = (ROLE_MAP[s.pos] || [])[use[s.pos]++] || null;
    });
    return stars;
  };
  // build a playable team object from franchise data
  GI.makeTeam = function (i, data) {
    const id = data.ident || {};
    const tb = GI.TEAMS_BASE[i] || [];
    const city = id.city || tb[0], name = id.name || tb[1], abbr = id.abbr || tb[2], c1 = id.c1 || tb[3], c2 = id.c2 || tb[4];
    const stars = (data.stars || []).map((s) => {
      const c = Object.assign({}, s, { meter: s.meter != null ? s.meter : ri(15, 40), armed: false, injured: false });
      if (s.hurt) { c.rating = Math.max(50, s.rating - 6); c.dur = Math.max(10, (s.dur || 70) - 35); } // playing through an injury
      return c;
    });
    GI.assignRoles(stars);
    const team = { idx: i, city, name, abbr, c1, c2, glyph: id.glyph || (GI.TEAM_GLYPH ? GI.TEAM_GLYPH[i] : null), slots: stars.map((s) => s.pos), stars: stars.filter((s) => s.role), base: Object.assign({}, data.base), coaches: JSON.parse(JSON.stringify(data.coaches)), identity: data.identity || null, college: !!id.college };
    if (data.bench) team.bench = Object.assign({}, data.bench, { meter: ri(10, 30), armed: false, injured: false });
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
    const mk = (idx) => (o.teamData && o.teamData[idx] ? GI.makeTeam(idx, o.teamData[idx]) : GI.buildTeam(idx));
    const teams = { home: mk(homeIdx), away: mk(awayIdx) };
    const inj = new Set(o.injured || []);
    const benchUsed = [];
    ['home', 'away'].forEach((s) => {
      const t = teams[s];
      t.stars.forEach((st) => { if (inj.has(st.id)) st.injured = true; });
      // one backup star per team: steps in for an injured starter at his position
      if (t.bench && !inj.has(t.bench.id)) {
        const out = t.stars.find((st) => st.injured && st.pos === t.bench.pos);
        if (out) {
          const b = Object.assign({}, t.bench, { role: out.role, injured: false });
          out.role = null;
          t.stars.push(b);
          benchUsed.push({ team: t.idx, id: b.id, name: b.name, pos: b.pos, for: out.name });
        }
      }
      t.stars = t.stars.filter((st) => st.role);
    });
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
      playoff: !!o.playoff, intel: o.intel || null, film: !!o.film, label: o.label || null, benchUsed,
      // v0.5: clock management, momentum, adjustments, per-star stats, scouting the CPU
      to: { home: 3, away: 3 }, runoff: 0, twoMin: {}, hurry: { home: false, away: false }, mom: 0, adj: { home: null, away: null },
      ps: {}, cpuLog: [], drive: { plays: 0, side: firstRecv }, rivalry: o.rivalry || null, book: o.book || null, brokeRec: {},
      career: o.career || null, keyMode: !!o.keyMode, quick: !!o.quick, hurtIds: o.hurt || [], careerBase: o.careerBase || null,
    };
    if (o.potwLeft) G.potwLeft = Object.assign({}, o.potwLeft);
    G.edge = buildEdges(G, o.edges || {});
    // leaders lift the room
    ['home', 'away'].forEach((s) => {
      const lead = teams[s].stars.filter((st) => !st.injured && hasTrait(st, 'leader')).length;
      if (lead) G.morale[s] = clamp(G.morale[s] + Math.min(6, lead * 3), 20, 97);
      G.morale[s] = clamp(G.morale[s] + (G.edge[s].morale || 0), 20, 97);
    });
    if (G.rivalry && G.rivalry.hot) {
      const lv = Math.min(99, G.crowd.level + 12);
      G.crowd = Object.assign({}, G.crowd, { level: lv, name: lv >= 90 ? 'Deafening' : G.crowd.name });
    }
    // starting meter boosts (grudges, old teams, revenge)
    ['home', 'away'].forEach((s) => teams[s].stars.forEach((st) => { const b = G.edge[s].starStart[st.id]; if (b) st.meter = clamp(st.meter + b, 0, 99); }));
    addLog(G, `Coin toss: ${teams[firstRecv].name} receive. ${GI.WEATHER[weather].icon} ${GI.WEATHER[weather].name}, ${crowd.name} crowd.`, 'info');
    return G;
  };
  const hasTrait = (s, t) => !!(s && s.traits && s.traits.includes(t));
  GI.hasTrait = hasTrait;

  // ---------- edges: everything that tilts a matchup before kickoff ----------
  // edge[side] = { off, def, calls:{play:+adv}, meter, starMeter:{id:x}, starStart:{id:n}, rz, morale, notes:[] }
  const STYLE_CLASH = [
    { dc: 'blitz', oc: 'pass', side: 'd', calls: { blitz_in: 0.22, blitz_out: 0.22 }, text: 'Blitz-happy DC feasts on a pass-first OC' },
    { dc: 'cover', oc: 'run', side: 'o', calls: { in_run: 0.2, out_run: 0.2 }, text: 'A soft shell can\'t stop Ground & Pound' },
    { dc: 'press', oc: 'gadget', side: 'o', calls: { trick: 0.3 }, text: 'Gadget plays eat up press-man DBs' },
    { dc: 'cover', oc: 'pass', side: 'd', calls: { deep: 0.18, zone: 0.18 }, text: 'Bend-don\'t-break shell is built for Air Raid' },
    { dc: 'press', oc: 'pass', side: 'o', calls: { long: 0.2 }, text: 'Air Raid goes over the top of press corners' },
    { dc: 'blitz', oc: 'run', side: 'd', calls: { blitz_in: 0.15, blitz_out: 0.15 }, text: 'Blitz packages are made for stopping the run' },
  ];
  function blankEdge() { return { off: 0, def: 0, calls: {}, meter: 1, starMeter: {}, starStart: {}, rz: 0, morale: 0, notes: [] }; }
  function buildEdges(G, given) {
    const E = { home: blankEdge(), away: blankEdge() };
    ['home', 'away'].forEach((s) => {
      const g = given[s];
      if (!g) return;
      const e = E[s];
      e.off += g.off || 0; e.def += g.def || 0; e.meter *= g.meter || 1; e.rz += g.rz || 0; e.morale += g.morale || 0;
      for (const k in g.calls || {}) e.calls[k] = (e.calls[k] || 0) + g.calls[k];
      Object.assign(e.starMeter, g.starMeter || {}); Object.assign(e.starStart, g.starStart || {});
      (g.notes || []).forEach((n) => e.notes.push(n));
    });
    ['home', 'away'].forEach((s) => {
      const t = G.teams[s], o = G.teams[other(s)];
      // coordinator styles collide
      STYLE_CLASH.forEach((c) => {
        if (c.side === 'd' && t.coaches.dc.style === c.dc && o.coaches.oc.style === c.oc) { addCalls(E[s], c.calls); E[s].notes.push({ icon: '🧠', text: c.text }); }
        if (c.side === 'o' && t.coaches.oc.style === c.oc && o.coaches.dc.style === c.dc) { addCalls(E[s], c.calls); E[s].notes.push({ icon: '🧠', text: c.text }); }
      });
      // team identity (franchise playbook)
      const id = t.identity && GI.IDENTITIES[t.identity];
      if (id) {
        addCalls(E[s], id.calls);
        if (id.rz) E[s].rz += id.rz;
        t.stars.forEach((st) => { if (id.fit.includes(st.pos)) E[s].starMeter[st.id] = (E[s].starMeter[st.id] || 1) * 1.1; });
      }
      // traits
      t.stars.forEach((st) => {
        if (hasTrait(st, 'diva')) E[s].starMeter[st.id] = (E[s].starMeter[st.id] || 1) * 1.2;
        if (hasTrait(st, 'biggame') && (G.playoff || (G.rivalry && G.rivalry.hot))) E[s].starMeter[st.id] = (E[s].starMeter[st.id] || 1) * 1.2;
      });
      // QB-receiver chemistry: two+ seasons together
      const qb = t.stars.find((x) => x.pos === 'QB' && !x.injured);
      if (qb && qb.chem) {
        const mate = t.stars.filter((x) => (x.pos === 'WR' || x.pos === 'TE') && !x.injured && (qb.chem[x.id] || 0) >= 2).sort((a, b) => qb.chem[b.id] - qb.chem[a.id])[0];
        if (mate) {
          G.duo = G.duo || {};
          G.duo[s] = { qb: qb.id, mate: mate.id, role: mate.role, yrs: qb.chem[mate.id], text: `${GI.shortName(qb.name)} → ${GI.shortName(mate.name)}` };
          E[s].notes.push({ icon: '🤝', text: `Duo: ${GI.shortName(qb.name)} & ${GI.shortName(mate.name)} (${qb.chem[mate.id]} seasons) — show-me plays hit more` });
        }
      }
    });
    if (G.rivalry) ['home', 'away'].forEach((s) => { const h = (G.rivalry.heat && G.rivalry.heat[s]) || 0; if (h > 0) E[s].meter *= 1 + Math.min(0.1, h / 1000); });
    return E;
  }
  function addCalls(e, calls) { for (const k in calls) e.calls[k] = (e.calls[k] || 0) + calls[k]; }

  // ---------- per-star stats ----------
  const PSK = ['pyd', 'ptd', 'int', 'cmp', 'att', 'ryd', 'rtd', 'car', 'rec', 'recyd', 'rectd', 'sk', 'dint', 'ff', 'tkl', 'fgm', 'fga', 'fg50', 'sm', 'retd', 'pd'];
  GI.PSK = PSK;
  function credit(G, side, role, key, n) {
    const t = G.teams[side];
    const s = t.stars.find((x) => x.role === role && !x.injured);
    if (!s) return null;
    return creditStar(G, side, s, key, n);
  }
  const MILESTONES = {
    ptd: [25, 50, 75, 100, 150, 200], pyd: [5000, 10000, 20000, 30000, 40000, 50000], rtd: [25, 50, 75, 100], ryd: [2500, 5000, 7500, 10000, 15000],
    rectd: [25, 50, 75, 100], recyd: [2500, 5000, 7500, 10000, 15000], sk: [25, 50, 75, 100], dint: [10, 20, 30, 40, 50], fgm: [50, 100, 150, 200, 300], sm: [25, 50, 100, 150],
  };
  GI.MILESTONES = MILESTONES;
  GI.STAT_NAME = { pyd: 'passing yards', ptd: 'TD passes', int: 'interceptions thrown', ryd: 'rushing yards', rtd: 'rushing TDs', rec: 'catches', recyd: 'receiving yards', rectd: 'receiving TDs', sk: 'sacks', dint: 'interceptions', ff: 'forced fumbles', tkl: 'tackles', fgm: 'field goals', fg50: '50+ yard field goals', sm: 'Show-Me plays', retd: 'return TDs', pd: 'pass breakups' };
  function creditStar(G, side, s, key, n) {
    const p = G.ps[s.id] || (G.ps[s.id] = { id: s.id, team: G.teams[side].idx, side, name: s.name, pos: s.pos });
    const before = p[key] || 0;
    p[key] = before + (n == null ? 1 : n);
    if (side === G.user) {
      const bk = G.book && G.book[key];
      if (bk && GI.league && bk.v >= GI.league.REC_MIN.game[key] && p[key] > bk.v && !G.brokeRec[key]) {
        G.brokeRec[key] = true;
        G.newRecord = { key, v: p[key], name: s.name, pos: s.pos, prev: bk };
        (G.records = G.records || []).push(G.newRecord);
      }
      const base = G.careerBase && G.careerBase[s.id];
      if (base && MILESTONES[key]) {
        const b0 = (base[key] || 0) + before, b1 = (base[key] || 0) + p[key];
        const th = MILESTONES[key].find((t) => b0 < t && b1 >= t);
        if (th) { G.milestone = { key, th, name: s.name, pos: s.pos, id: s.id }; (G.milestones = G.milestones || []).push(G.milestone); }
      }
    }
    return s;
  }
  GI.creditStar = creditStar;

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
      if (!G.pending) { G.pending = { ko: true }; armKick(G, other(G.user), G.kickTeam !== G.user ? 'cov' : 'ret'); }
      const userKicks = G.kickTeam === G.user;
      const late = G.q >= 4 && G.clock < 300;
      const diff = G.score[G.kickTeam] - G.score[other(G.kickTeam)];
      return { kind: 'kickoff', userKicks, onsideOk: !G.freeKick && late && diff < 0 && diff >= -16 };
    }
    if (G.phase === 'pat') return { kind: 'pat', userScored: G.poss === G.user, twoPt: G.twoPt };
    const userOff = G.poss === G.user;
    // the clock is about to hit zero before the next snap
    if (G.runoff > 0 && G.clock - G.runoff <= 0 && !G.twoPt) {
      const cpuSide = other(G.user);
      if (!cpuClock(G, cpuSide, true)) {
        const half = G.q === 2 || G.q >= 4;
        return { kind: 'expiring', canTO: half && G.to[G.user] > 0, half, left: G.clock };
      }
      G.pending = Object.assign(G.pending || {}, { cpuTO: cpuSide });
    }
    if (!G.pending || G.pending.cpuOff == null && G.pending.cpuDef == null && G.pending.cpuSpecial == null) {
      const keepTO = G.pending && G.pending.cpuTO;
      G.pending = {};
      // the CPU manages its own clock (timeouts when it needs time)
      const cpuSide = other(G.user);
      if (keepTO) G.pending.cpuTO = keepTO;
      else if (cpuClock(G, cpuSide)) G.pending.cpuTO = cpuSide;
      if (!userOff) {
        const spec = cpuShouldKneel(G, G.poss) ? 'kneel' : cpuFourth(G);
        G.pending.cpuSpecial = spec;
        if (!spec) G.pending.cpuOff = cpuOffCall(G);
        armCpu(G, G.poss, 'o', G.pending.cpuOff);
      } else {
        G.pending.cpuDef = cpuDefCall(G);
        armCpu(G, other(G.poss), 'd');
      }
    }
    const fgDist = 117 - G.ballOn;
    const lateHalf = (G.q === 2 || G.q >= 4) && G.clock <= 150;
    const lead = G.score[G.user] - G.score[other(G.user)];
    return {
      kind: 'call', userOff, cpuSpecial: G.pending.cpuSpecial || null, fourth: G.down === 4 && !G.twoPt,
      fgDist, fgPct: fgDist <= 70 ? Math.round(GI.fgChance(G, G.poss, fgDist) * 100) : 0, twoPt: !!G.twoPt,
      cpuTO: G.pending.cpuTO || null,
      canTO: G.runoff > 0 && G.to[G.user] > 0,
      canSpike: userOff && !G.twoPt && G.down < 4 && lateHalf && G.runoff > 0,
      canKneel: userOff && !G.twoPt && G.q >= 4 && lead > 0 && G.clock <= 150,
      lateHalf, to: G.to[G.user], hurry: !!G.hurry[G.user],
    };
  };

  // ---------- clock: play time runs now, the runoff to the next snap is "pending" ----------
  // The runoff only comes off the clock when the next snap happens — unless someone calls timeout.
  GI.clockLeft = (G) => Math.max(0, G.clock - (G.runoff || 0));
  function tick(G, sec, side) { // play-time; the two-minute warning stops the clock after the play
    const before = G.clock;
    G.clock = Math.max(0, G.clock - sec);
    const s = side || G.poss;
    if (s && G.stats[s]) G.stats[s].top += before - G.clock;
    G.twoMinStop = false;
    if ((G.q === 2 || G.q === 4) && before > 120 && G.clock <= 120 && !G.twoMin[G.q] && G.clock > 0) { G.twoMin[G.q] = true; G.runoff = 0; G.twoMinStop = true; G.flash = G.flash || 'twomin'; return true; }
    return false;
  }
  function applyRunoff(G) {
    if (!G.runoff) return;
    const before = G.clock;
    G.clock = Math.max(0, G.clock - G.runoff);
    if ((G.q === 2 || G.q === 4) && before > 120 && G.clock < 120 && !G.twoMin[G.q]) { G.clock = 120; G.twoMin[G.q] = true; G.flash = G.flash || 'twomin'; }
    G.stats[G.poss].top += before - G.clock;
    G.runoff = 0;
  }
  function setRunoff(G, P, kind) {
    const hurry = G.hurry[P] || ((G.q === 2 || G.q >= 4) && G.clock < 150 && (G.score[P] <= G.score[other(P)] || G.q === 2) && P !== G.user);
    const tempo = G.adj[P] === 'tempo';
    G.runoff = kind === 'kneel' ? 40 : kind === 'oob' ? ri(10, 14) : hurry ? ri(6, 10) : tempo ? ri(18, 23) : ri(28, 34);
  }
  GI.setHurry = function (G, on) { G.hurry[G.user] = !!on; };
  GI.callTimeout = function (G, side) {
    if (!(G.to[side] > 0) || !(G.runoff > 0)) return false;
    G.to[side]--;
    const saved = G.runoff;
    G.runoff = 0;
    addLog(G, `⏱ Timeout ${G.teams[side].abbr} (${G.to[side]} left) — saves ${saved}s.`, 'info');
    return saved;
  };
  function cpuClock(G, side, force) { // does this CPU side want a timeout now?
    if (!(G.runoff > 0) || !(G.to[side] > 0) || G.phase !== 'play') return false;
    const diff = G.score[side] - G.score[other(side)];
    let want = false;
    if (G.q === 2 && G.poss === side && G.clock <= 100 && G.ballOn >= 35) want = true;
    if (G.q >= 4 && diff < 0 && diff >= -16 && G.clock <= 210) want = G.poss === side || G.clock <= 170;
    if (G.q >= 4 && diff === 0 && G.clock <= 90 && G.poss === side && G.ballOn >= 45) want = true;
    if (force && G.q === 2 && G.poss === side && G.ballOn >= 45) want = true;
    if (want) return GI.callTimeout(G, side) !== false;
    return false;
  }
  GI.cpuClock = cpuClock;

  function periodEnd(G) {
    G.runoff = 0;
    if (G.q === 2) G.to = { home: 3, away: 3 };
    if (G.q >= 4) G.to = { home: 2, away: 2 };
    if (G.q === 1 || G.q === 3) {
      G.q++; G.clock = G.qLen; G.flash = 'q' + G.q;
      addLog(G, `End of quarter ${G.q - 1}.`, 'info');
    } else if (G.q === 2) {
      G.q = 3; G.clock = G.qLen; G.phase = 'kickoff'; G.kickTeam = G.firstRecv; G.poss = other(G.firstRecv); G.freeKick = false; G.pending = null; G.twoPt = false;
      G.flash = 'half';
      G.mom = Math.round(G.mom / 2);
      const cpu = other(G.user);
      G.adj[cpu] = GI.cpuAdjust(G, cpu);
      if (G.diff === 'sim' || G.auto) G.adj[G.user] = GI.cpuAdjust(G, G.user);
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
  // how hard the CPU leans on your tendencies (softened in v0.5 — it was out-reading players and winning
  // the snaps that fill meters). You get the same read on it via the tendency strip.
  const ADAPT = { rookie: 0, pro: 4, legend: 8, sim: 4 };
  const DIFF_ADV = { rookie: -0.5, pro: -0.12, legend: 0.25, sim: 0 };
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
    const w = cpuOffWeights(G, true);
    // a CPU star sitting on fire nudges it toward a play where he can go off
    const hot = G.teams[G.poss].stars.filter((s) => !s.injured && s.meter >= 100 && GI.SHOWME[s.pos].o);
    hot.forEach((s) => GI.SHOWME[s.pos].o.forEach((c) => { if (w[c] != null) w[c] *= 1.35; }));
    return wpick(w);
  }
  function cpuShouldKneel(G, side) {
    const lead = G.score[side] - G.score[other(side)];
    if (G.q < 4 || lead <= 0 || G.twoPt) return false;
    const oppTO = G.to[other(side)] || 0;
    const snapsLeft = 4 - G.down + 1;
    return G.clock <= 38 * snapsLeft - oppTO * 34 + 4 && G.clock <= 160;
  }
  GI.cpuShouldKneel = cpuShouldKneel;
  function cpuOffWeights(G, adapt) {
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
    if (G.ballOn >= 85) { w.long *= 0.5; w.short *= 1.2; }
    const idn = t.identity && GI.IDENTITIES[t.identity];
    if (idn) for (const c in idn.calls) if (w[c] != null) w[c] *= 1.25;
    if (adapt) {
      const k = ADAPT[G.diff];
      G.hist.def.slice(0, 6).forEach((d) => {
        for (const o in GI.MATRIX) if (GI.MATRIX[o][d] === 2) w[o] += k;
      });
    }
    return w;
  }
  function cpuDefCall(G) { return wpick(cpuDefWeights(G, true)); }
  // tendencies the user can scout: base situational weights (no adaptation, no randomness)
  GI.tendency = function (G) {
    const userOff = G.poss === G.user;
    const w = userOff ? cpuDefWeights(G, false) : cpuOffWeights(G, false);
    let tot = 0; for (const k in w) tot += w[k];
    return Object.keys(w).map((k) => ({ id: k, p: Math.round((w[k] / tot) * 100) })).sort((a, b) => b.p - a.p);
  };
  function cpuDefWeights(G, adapt) {
    const t = G.teams[other(G.poss)];
    const w = { man: 18, zone: 22, deep: 14, press: 14, blitz_in: 14, blitz_out: 14 };
    if (G.ballOn >= 85) { w.deep *= 0.5; w.press *= 1.3; w.blitz_in *= 1.2; }
    const idn = t.identity && GI.IDENTITIES[t.identity];
    if (idn) for (const c in idn.calls) if (w[c] != null) w[c] *= 1.25;
    const st = t.coaches.dc.style;
    if (st === 'blitz') { w.blitz_in *= 1.8; w.blitz_out *= 1.8; }
    if (st === 'cover') { w.zone *= 1.6; w.deep *= 1.6; }
    if (st === 'press') { w.press *= 1.7; w.man *= 1.5; }
    if (G.toGo >= 8) { w.deep *= 1.8; w.zone *= 1.4; }
    if (G.toGo <= 2) { w.blitz_in *= 1.8; w.blitz_out *= 1.4; w.deep *= 0.4; }
    if (adapt) {
      const k = ADAPT[G.diff];
      G.hist.off.slice(0, 6).forEach((o) => { w[GI.counterOf(o)] += k; });
      if (G.film && G.diff !== 'rookie') w[GI.counterOf(G.potw.off)] += 12; // they studied your Play of the Week
    }
    return w;
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

  function armKick(G, side, kind) { // CPU arms return or coverage stars before a kick
    G.teams[side].stars.forEach((s) => {
      if (s.injured || s.armed || s.meter < 100) return;
      if (kind === 'ret' && GI.RETURN_POS.includes(s.pos) && R() < 0.5) s.armed = true;
      if (kind === 'cov' && GI.COVER_POS.includes(s.pos) && R() < 0.5) s.armed = true;
      if (s.pos === 'KP' && kind === 'cov') s.armed = true;
    });
  }
  GI.armKick = armKick;
  // special teams star duel on a return: returns { ret, fumble, crazy } adjustments
  function kickStars(G, kickSide, recvSide) {
    const take = (side, list) => {
      const s = G.teams[side].stars.find((x) => x.armed && !x.injured && list.includes(x.pos));
      if (s) { s.armed = false; s.meter = 0; }
      return s;
    };
    const rs = take(recvSide, GI.RETURN_POS), cs = take(kickSide, GI.COVER_POS);
    const ok = (s) => s && R() < 0.6 * (0.8 + (s.clutch || 70) / 250);
    const rHit = ok(rs), cHit = ok(cs);
    if (rHit && cHit) {
      const rw = rs.rating + R() * 25 >= cs.rating + R() * 25;
      return rw ? { kind: 'ret', s: rs, clash: true, vs: cs } : { kind: 'cov', s: cs, clash: true, vs: rs };
    }
    if (rHit) return { kind: 'ret', s: rs };
    if (cHit) return { kind: 'cov', s: cs };
    return { armedRet: !!rs };
  }

  function kickMeters(G, K, Rv, ret) { // returners fill on long returns, coverage on short ones
    G.teams[Rv].stars.forEach((s) => { if (!s.injured && !s.armed && GI.RETURN_POS.includes(s.pos) && ret >= 25) s.meter = clamp(s.meter + (ret >= 35 ? 8 : 4), 0, 100); });
    G.teams[K].stars.forEach((s) => { if (!s.injured && !s.armed && GI.COVER_POS.includes(s.pos) && ret <= 18) s.meter = clamp(s.meter + 5, 0, 100); });
  }

  // ---------- user arming ----------
  GI.toggleArm = function (G, starId) {
    const s = G.teams[G.user].stars.find((x) => x.id === starId);
    if (!s || s.injured) return false;
    if (s.armed) { s.armed = false; return true; }
    if (s.meter >= 100) { s.armed = true; return true; }
    return false;
  };

  // auto-arm (setting): fire up on-fire stars on the snaps where they matter
  GI.autoArm = function (G, act) {
    const armed = [];
    if (!act) return armed;
    const userOff = G.poss === G.user;
    G.teams[G.user].stars.forEach((s) => {
      if (s.injured || s.armed || s.meter < 100) return;
      const sm = GI.SHOWME[s.pos];
      let go = false;
      if (act.type === 'play' && act.call && userOff && sm.o && sm.o.includes(act.call)) go = true;
      if (act.type === 'play' && act.call && !userOff && sm.d) go = true;
      if ((act.special === 'fg' || act.special === 'punt' || act.type === 'pat') && s.pos === 'KP') go = true;
      let kick = false;
      if (act.type === 'kickoff' && (G.kickTeam === G.user ? GI.COVER_POS.includes(s.pos) || s.pos === 'KP' : GI.RETURN_POS.includes(s.pos))) kick = true;
      if (act.type === 'play' && !act.call && !act.special && !userOff && GI.RETURN_POS.includes(s.pos)) kick = true; // punt return
      if (kick && !armed.some((x) => x.pos !== 'KP') ) go = true;
      if (go) { s.armed = true; armed.push(s); }
    });
    return armed;
  };

  // ---------- the main step ----------
  GI.step = function (G, act) {
    G.playNo++;
    let res;
    const fromPoss = G.poss;
    G.newRecord = null; G.milestone = null;
    if (act.type === 'kickoff') res = doKickoff(G, act.onside);
    else if (act.type === 'pat') res = doPAT(G, act.choice);
    else if (act.type === 'runout') { applyRunoff(G); G.pending = null; return { kind: 'runout', text: `The clock runs out on the ${G.q <= 4 ? ord(G.q) + ' quarter' : 'period'}.` }; }
    else {
      if (act.type === 'spike') G.runoff = Math.min(G.runoff || 0, ri(2, 4));
      applyRunoff(G);
      const userOff = G.poss === G.user;
      const spec = act.special || (!userOff && G.pending && G.pending.cpuSpecial);
      if (act.type === 'spike') res = doSpike(G);
      else if (act.type === 'kneel' || spec === 'kneel') res = doKneel(G);
      else if (spec === 'punt') res = doPunt(G);
      else if (spec === 'fg') res = doFG(G);
      else {
        const off = userOff ? act.call : G.pending.cpuOff;
        const def = userOff ? G.pending.cpuDef : act.call;
        if (userOff) G.hist.off.unshift(off); else G.hist.def.unshift(def);
        G.hist.off.length = Math.min(G.hist.off.length, 20); G.hist.def.length = Math.min(G.hist.def.length, 20);
        G.cpuLog.unshift({ down: G.down, toGo: G.toGo, side: userOff ? 'd' : 'o', call: userOff ? def : off });
        if (G.cpuLog.length > 40) G.cpuLog.pop();
        res = doScrimmage(G, off, def);
      }
    }
    G.pending = null;
    // drives: a short possession that ends in a punt is a three-and-out
    if (G.poss !== fromPoss || res.scored != null) {
      if (res.kind === 'punt' && G.drive.plays <= 3 && G.drive.side === fromPoss) swing(G, other(fromPoss), 9);
      G.drive = { plays: 0, side: G.poss };
    } else if (res.kind !== 'kickoff') G.drive.plays++;
    G.mom = Math.round(G.mom * 0.9);
    res.mom = G.mom;
    if (G.newRecord) res.record = G.newRecord;
    if (G.milestone) res.milestone = G.milestone;
    if (G.ot && res.scored && G.score.home !== G.score.away) endGame(G);
    return res;
  };
  const ord = (n) => ['', '1st', '2nd', '3rd', '4th'][n] || n + 'th';

  // ---------- momentum: + favors home, − favors away ----------
  function swing(G, side, amt) { G.mom = clamp(G.mom + (side === 'home' ? amt : -amt), -100, 100); }
  const momFor = (G, side) => (side === 'home' ? G.mom : -G.mom);
  GI.momFor = momFor;
  function crowdEff(G) { return clamp(G.crowd.level + Math.max(0, momFor(G, 'home')) / 5, 0, 99); }

  // ---------- spike & kneel ----------
  function doSpike(G) {
    const P = G.poss;
    const res = { kind: 'spike', side: P, ...frame(G, P), start: G.ballOn, off: 'spike', def: '-' };
    tick(G, 1);
    G.down++;
    G.runoff = 0;
    res.text = `${G.teams[P].abbr} spikes it to stop the clock. ${ord(G.down)} down.`;
    addLog(G, res.text, 'info');
    return res;
  }
  function doKneel(G) {
    const P = G.poss, D = other(P);
    const res = { kind: 'kneel', side: P, ...frame(G, P), start: G.ballOn, off: 'kneel', def: '-' };
    G.ballOn = Math.max(1, G.ballOn - 1);
    tick(G, 2);
    G.down++; G.toGo += 1;
    res.text = `${G.teams[P].abbr} takes a knee.`;
    if (G.down > 4) {
      G.poss = D; G.ballOn = 100 - G.ballOn; G.down = 1; G.toGo = Math.min(10, 100 - G.ballOn); G.runoff = 0;
      res.text += ' Turnover on downs.';
      res.downs = true;
    } else setRunoff(G, P, 'kneel');
    addLog(G, res.text, 'info');
    return res;
  }

  // ---------- halftime adjustments ----------
  GI.setAdjust = function (G, side, key) { G.adj[side] = key; addLog(G, `${G.teams[side].abbr} halftime adjustment: ${GI.ADJUST[key].name}.`, 'info'); };
  GI.cpuAdjust = function (G, side) {
    const opp = other(side), so = G.stats[opp], diff = G.score[side] - G.score[opp];
    const w = { double: so.pass > so.rush * 1.2 ? 6 : 2, stack: so.rush >= so.pass ? 6 : 2, ground: diff > 7 ? 5 : 2, protect: G.stats[side].sacks >= 2 ? 5 : 1, airout: diff < -7 ? 6 : 1, secure: G.stats[side].to >= 2 ? 6 : 1, tempo: diff < 0 ? 3 : 1 };
    return wpick(w);
  };
  // suggestions for the user: why each adjustment fits what happened in the first half
  GI.adjustHints = function (G) {
    const u = G.user, o = other(u), so = G.stats[o], su = G.stats[u];
    const h = {};
    if (so.pass > so.rush * 1.2) h.double = `They threw for ${so.pass} yards`;
    if (so.rush >= so.pass && so.rush > 40) h.stack = `They ran for ${so.rush} yards`;
    if (su.sacks >= 2) h.protect = `You took ${su.sacks} sacks`;
    if (su.to >= 2) h.secure = `You turned it over ${su.to} times`;
    const diff = G.score[u] - G.score[o];
    if (diff < -7) { h.airout = 'You need points fast'; h.tempo = 'Squeeze in more snaps'; }
    if (diff > 7) h.ground = 'Grind the clock with the lead';
    return h;
  };

  // ---------- key moments: when should a user who skips the routine snaps take over? ----------
  GI.keyMoment = function (G) {
    if (G.over) return null;
    const u = G.user, diff = G.score[u] - G.score[other(u)];
    const late = (G.q === 2 && G.clock <= 120) || (G.q === 4 && G.clock <= 180) || G.q >= 5;
    if (G.phase === 'pat') return G.poss === u && G.q >= 4 && Math.abs(diff - 6) <= 8 ? 'Extra point decision' : null;
    if (G.phase === 'kickoff') return G.kickTeam === u && G.q >= 4 && diff < 0 && diff >= -16 && G.clock < 300 ? 'Onside kick?' : null;
    if (late && (G.q !== 4 || Math.abs(diff) <= 16)) return G.q === 2 ? 'Two-minute drill' : G.q >= 5 ? 'Overtime' : 'Crunch time';
    if (G.ballOn >= 80) return G.poss === u ? 'Red zone' : 'Goal-line stand';
    if (G.down === 4 && G.poss === u && G.ballOn >= 40) return '4th down decision';
    if (G.down === 3 && G.q >= 4 && Math.abs(diff) <= 8) return 'Big 3rd down';
    const hot = G.teams[u].stars.some((s) => !s.injured && s.meter >= 100 && !s.armed && (G.poss === u ? GI.SHOWME[s.pos].o : GI.SHOWME[s.pos].d));
    if (hot) return 'A star is on fire 🔥';
    return null;
  };

  // situational hint for the user's side (what the down & distance favors)
  GI.situationTip = function (G) {
    if (G.phase !== 'play' || G.twoPt) return null;
    const off = G.poss === G.user;
    if (G.ballOn >= 85) return off ? 'Red zone: the field shrinks — deep shots are tough, trick plays sneak in' : 'Red zone: they can\'t go deep — sit on the short stuff';
    if (G.down >= 3 && G.toGo >= 7) return off ? `${ord(G.down)} & long: they expect a pass — a run can catch them napping` : `${ord(G.down)} & long: expect a pass (but watch the draw)`;
    if (G.toGo <= 2) return off ? 'Short yardage: power runs and play-action deep both play up' : 'Short yardage: expect the run — but they might take a shot';
    return null;
  };
  // the CPU's recent habits in this exact situation
  GI.cpuHabit = function (G) {
    const side = G.poss === G.user ? 'd' : 'o';
    const third = G.down >= 3;
    const pool = G.cpuLog.filter((l) => l.side === side && (third ? l.down >= 3 : l.down < 3)).slice(0, 8);
    if (pool.length < 3) return null;
    const c = {};
    pool.forEach((l) => (c[l.call] = (c[l.call] || 0) + 1));
    const top = Object.keys(c).sort((a, b) => c[b] - c[a])[0];
    if (c[top] < 2) return null;
    return { call: top, n: c[top], of: pool.length, third };
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
    res.reason = GI.REASON[off + '|' + def] || null;
    const adjP = G.adj[P], adjD = G.adj[D];
    const lateHalf = (G.q === 2 && G.clock <= 120) || (G.q >= 4 && G.clock <= 300);

    // crowd false start
    if (P === 'away' && crowdEff(G) >= 70 && R() < 0.035) {
      const back = Math.min(5, Math.floor(G.ballOn / 2));
      G.ballOn -= back; G.toGo += back;
      res.kind = 'penalty'; res.yards = -back;
      res.text = `False start! The ${G.crowd.name.toLowerCase()} crowd rattles ${ot.abbr}. -${back}`;
      res.banner = { title: 'FALSE START', sub: 'Crowd noise', tone: 'warn' };
      addLog(G, res.text, 'pen');
      swing(G, D, 4);
      G.runoff = 0;
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
    // momentum: whoever has it plays a little faster
    a += (momFor(G, P) / 100) * 0.18;
    // situational football: down, distance and field position
    if (!G.twoPt) {
      if (G.down >= 3 && G.toGo >= 7) { if (isRun) { a += 0.35; res.situ = 'draw'; } if (off === 'short') a -= 0.12; }
      if (G.toGo <= 2) { if (off === 'in_run') a += 0.2; if (off === 'long') { a += 0.25; res.situ = 'pa'; } }
      if (G.ballOn >= 85) { if (off === 'long') a -= 0.35; if (off === 'trick') a += 0.15; }
    }
    // matchup edges: rivalries, coaching trees, style clashes, identity
    const eP = G.edge && G.edge[P], eD = G.edge && G.edge[D];
    if (eP) a += eP.off + (eP.calls[off] || 0);
    if (eD) { a -= eD.def + (eD.calls[def] || 0); if (G.ballOn >= 80) a -= eD.rz; }
    // halftime adjustments
    if (adjD === 'double' && isPass) a -= 0.35;
    if (adjD === 'double' && isRun) a += 0.15;
    if (adjD === 'stack' && isRun) a -= 0.35;
    if (adjD === 'stack' && off === 'long') a += 0.25;
    if (adjP === 'ground') a += isRun ? 0.3 : isPass ? -0.12 : 0;
    if (adjP === 'protect' && off === 'long') a -= 0.12;
    if (adjP === 'airout' && off === 'long') a += 0.35;
    if (adjP === 'secure') a -= 0.1;
    if (G.hurry[P] && P === G.user) a -= 0.08;
    if (isPass) a += W.pass;
    if (off === 'long') a += W.long;
    if (isRun) a += W.run;
    if (off === 'trick') a += W.pass * 0.5;
    if (P === 'away') a -= (crowdEff(G) / 100) * 0.25;
    if (G.weather === 'heat' && G.q >= 4) a += (ro.ovr - rd.ovr) / 40;
    a += (P === G.user ? -1 : 1) * DIFF_ADV[G.diff];
    a += gauss(0, 0.35);
    a = clamp(a, -4, 4);
    res.adv = a;

    // star show-me triggers
    const armedUsed = [];
    const big = G.playoff || (G.rivalry && G.rivalry.hot);
    const trig = (team, sideKey, side) => {
      let best = null;
      const duo = G.duo && G.duo[side];
      team.stars.forEach((s) => {
        if (s.injured) return;
        const list = GI.SHOWME[s.pos][sideKey];
        if (!list || !list.includes(off)) return;
        if (s.armed) armedUsed.push(s);
        let cl = 0.8 + (s.clutch || 70) / 250;
        if (hasTrait(s, 'diva')) cl *= 1.06;
        if (big && hasTrait(s, 'biggame')) cl *= 1.12;
        if (duo && isPass && (s.id === duo.qb || s.id === duo.mate)) cl *= 1.15;
        const ch = (s.armed ? 0.62 : Math.pow(s.meter / 100, 2) * 0.006 * (s.rating / 85)) * cl;
        if (R() < ch) {
          const score = (s.armed ? 100 : 0) + s.rating + R() * 20;
          if (!best || score > best.score) best = { s, score };
        }
      });
      return best;
    };
    const oS = trig(ot, 'o', P), dS = trig(dt, 'd', D);
    let crazy = null, clash = null;
    if (oS && dS) {
      // STAR CLASH: both stars go off on the same snap
      const cs = (s, side) => s.rating + (G.morale[side] - 50) * 0.35 + (s.armed ? 10 : 0) + R() * 25;
      const oScore = cs(oS.s, P) + a * 6, dScore = cs(dS.s, D) - a * 6;
      const oWin = oScore >= dScore;
      crazy = oWin ? { s: oS.s, side: 'o' } : { s: dS.s, side: 'd' };
      const win = oWin ? oS.s : dS.s, lose = oWin ? dS.s : oS.s;
      clash = { o: GI.shortName(oS.s.name), oPos: oS.s.pos, d: GI.shortName(dS.s.name), dPos: dS.s.pos, winner: GI.shortName(win.name), winSide: oWin ? P : D, loseSide: oWin ? D : P };
      G.morale[clash.winSide] = clamp(G.morale[clash.winSide] + 4, 15, 99);
      G.morale[clash.loseSide] = clamp(G.morale[clash.loseSide] - 4, 15, 99);
      G.rivals = G.rivals || [];
      G.rivals.unshift({ a: win.name, b: lose.name, q: G.q });
      (G.clashes = G.clashes || []).push({ win: win.id, lose: lose.id, winTeam: G.teams[clash.winSide].idx, loseTeam: G.teams[clash.loseSide].idx });
      clash.refund = win;
      swing(G, clash.winSide, 12);
    }
    else if (oS) crazy = { s: oS.s, side: 'o' };
    else if (dS) crazy = { s: dS.s, side: 'd' };
    armedUsed.forEach((s) => { s.armed = false; s.meter = 0; });
    if (crazy && crazy.s.meter > 0) crazy.s.meter = Math.max(0, crazy.s.meter - 45);
    if (clash) { clash.refund.meter = 40; delete clash.refund; res.clash = clash; }
    if (crazy) { creditStar(G, crazy.side === 'o' ? P : D, crazy.s, 'sm'); swing(G, crazy.side === 'o' ? P : D, 16); res.crazyId = crazy.s.id; }

    // receiver / defender selection helpers
    const duoP = G.duo && G.duo[P];
    const pickTarget = () => {
      const w = { WR1: 3, WR2: 3, WR3: 2, TE: 1.5, RB: 1 };
      ['WR1', 'WR2', 'WR3', 'TE'].forEach((r) => { if (GI.starAt(ot, r)) w[r] *= 2.5; });
      if (duoP && w[duoP.role]) w[duoP.role] *= 1.5;
      if (adjD === 'double') { const top = ['WR1', 'WR2', 'TE'].filter((r) => GI.starAt(ot, r))[0]; if (top) w[top] *= 0.4; }
      return wpick(w);
    };
    const pickDef = (roles) => {
      const w = {};
      roles.forEach((r) => (w[r] = GI.starAt(dt, r) ? 3 : 1));
      return wpick(w);
    };
    const blitz = def === 'blitz_in' || def === 'blitz_out';
    const secure = adjP === 'secure' ? 0.5 : 1;

    // ---------- outcome ----------
    let o = {};
    const fumbleCheck = (p) => R() < p * W.fum * secure;
    if (crazy) {
      const s = crazy.s, pos = s.pos;
      o.crazy = { name: GI.shortName(s.name), pos, title: GI.SHOWME[pos].name, team: crazy.side === 'o' ? P : D, id: s.id, num: s.num, full: s.name };
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
      if (adjP === 'protect') sackP *= 0.5;
      const compP = clamp((long ? 0.32 : 0.63) + a * (long ? 0.08 : 0.07), 0.1, 0.9);
      let intP = Math.max(long ? 0.012 : 0.006, (long ? 0.05 : 0.022) - a * (long ? 0.01 : 0.006));
      if (adjP === 'airout' && long) intP *= 1.4;
      intP *= secure;
      o.target = pickTarget();
      const r = R();
      if (R() < sackP) {
        o.kind = 'sack'; o.yards = -ri(4, 9); o.by = pickDef(blitz ? ['MLB', 'WLB', 'SLB', 'DE1', 'DE2'] : ['DE1', 'DE2', 'DT1', 'DT2']);
        if (R() < 0.1 * secure) { o.fumble = true; o.recD = R() < 0.6; o.ret = ri(0, 12); }
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
    let gain = 0, playTime = ri(4, 7), stop = false;
    const offName = ot.abbr;
    let txt = '';
    const nm = (role, team) => GI.who(team || ot, role);
    if (res.kind === 'run') { gain = res.yards; txt = `${nm('RB')} ${off === 'in_run' ? 'up the middle' : 'to the edge'}`; }
    else if (res.kind === 'pass') { gain = res.air + res.yac; playTime = ri(4, 8); txt = `${res.trick ? 'Flea flicker! ' : ''}${nm('QB')} to ${nm(res.target)}`; }
    else if (res.kind === 'sack') { gain = res.yards; playTime = ri(4, 6); txt = `${nm('QB')} sacked by ${GI.who(dt, res.by)}`; S.sacks++; swing(G, D, 7); }
    else if (res.kind === 'incomplete') { gain = 0; playTime = ri(3, 5); stop = true; txt = `${nm('QB')} incomplete for ${nm(res.target)}`; }
    else if (res.kind === 'int') { playTime = ri(5, 9); txt = `${nm('QB')} picked off by ${GI.who(dt, res.by)}!`; }
    if (res.pancake) txt += ` behind a ${nm(res.pancake)} pancake`;
    if (res.kind !== 'incomplete' && R() < 0.15 && (off === 'out_run' || res.kind === 'pass')) res.oob = true;

    // per-star stat lines
    const qbS = isPass || res.trick ? credit(G, P, 'QB', 'att') : null;
    if (res.kind === 'int' || res.fumble) {
      // turnover handling
      const spot = res.kind === 'int' ? start + res.air : clamp(start + gain, 1, 99);
      if (res.kind === 'int' || res.recD) {
        let dOn = 100 - Math.min(spot, 100);
        let ret = res.ret || 0;
        let newOn = dOn + ret;
        if (res.kind === 'int' && dOn <= 0 && ret < 8) { newOn = 20; res.touchback = true; ret = 0; }
        res.retYds = ret; res.toSpot = spot;
        S.to++;
        G.morale[D] = clamp(G.morale[D] + 3, 15, 99); G.morale[P] = clamp(G.morale[P] - 4, 15, 99);
        swing(G, D, 24);
        if (res.kind === 'int') { if (qbS) credit(G, P, 'QB', 'int'); if (res.by) credit(G, D, res.by, 'dint'); }
        else { if (res.by) credit(G, D, res.by, 'ff'); if (res.kind === 'run') credit(G, P, 'RB', 'car'); if (res.kind === 'run') credit(G, P, 'RB', 'ryd', Math.max(0, gain)); }
        if (res.kind === 'sack' && res.by) credit(G, D, res.by, 'sk');
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
          if (res.by) credit(G, D, res.by, 'retd');
          swing(G, D, 14);
          res.banner = { title: res.kind === 'int' ? 'PICK SIX!' : 'SCOOP & SCORE!', sub: `${dt.name} defense scores`, tone: D === G.user ? 'good' : 'bad' };
        } else {
          G.poss = D; G.ballOn = clamp(newOn, 1, 99); G.down = 1; G.toGo = Math.min(10, 100 - G.ballOn);
          res.banner = { title: res.kind === 'int' ? 'INTERCEPTED!' : 'FUMBLE!', sub: `${dt.name} ball`, tone: D === G.user ? 'good' : 'bad' };
        }
        res.turnover = true;
        stop = true;
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
        if (ok) { G.score[P] += 2; res.scored = P; swing(G, P, 8); }
        txt += ok ? ' — TWO-POINT GOOD!' : ' — two-point try fails.';
        res.banner = ok ? { title: '2-PT GOOD!', sub: offName, tone: P === G.user ? 'good' : 'bad' } : { title: 'NO GOOD', sub: '2-pt try fails', tone: P === G.user ? 'bad' : 'good' };
        G.phase = 'kickoff'; G.kickTeam = P; G.freeKick = false;
        stop = true; playTime = 0;
      } else if (newOn >= 100) {
        res.gain = gain = 100 - start; res.td = true; res.scored = P;
        G.score[P] += 6; G.phase = 'pat'; G.ballOn = 98;
        txt += ` for ${gain} — TOUCHDOWN!`;
        G.morale[P] = clamp(G.morale[P] + 4, 15, 99); G.morale[D] = clamp(G.morale[D] - 3, 15, 99);
        swing(G, P, 20);
        res.banner = { title: 'TOUCHDOWN!', sub: ot.name, tone: P === G.user ? 'good' : 'bad' };
        stop = true;
      } else if (newOn <= 0) {
        res.safety = true; res.scored = D;
        G.score[D] += 2; txt += ' — SAFETY!';
        G.phase = 'kickoff'; G.kickTeam = P; G.freeKick = true;
        swing(G, D, 16);
        res.banner = { title: 'SAFETY!', sub: `+2 ${dt.name}`, tone: D === G.user ? 'good' : 'bad' };
        stop = true;
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
            res.downs = true; stop = true;
            swing(G, D, 18);
            res.banner = { title: 'TURNOVER ON DOWNS', sub: `${dt.name} ball`, tone: D === G.user ? 'good' : 'bad' };
          }
        }
      }
      if (gain >= 20 && !res.td) { G.morale[P] = clamp(G.morale[P] + 2, 15, 99); swing(G, P, 10); if (!res.banner) res.banner = { title: 'BIG PLAY!', sub: `+${gain} yards`, tone: P === G.user ? 'good' : 'bad' }; }
      if (res.kind === 'sack') G.morale[D] = clamp(G.morale[D] + 2, 15, 99);
      // stat lines
      if (res.kind === 'pass') {
        if (qbS) { credit(G, P, 'QB', 'cmp'); credit(G, P, 'QB', 'pyd', gain); if (res.td) credit(G, P, 'QB', 'ptd'); }
        const rc = res.target === 'RB' ? 'RB' : res.target;
        if (credit(G, P, rc, 'rec')) { credit(G, P, rc, 'recyd', gain); if (res.td) credit(G, P, rc, 'rectd'); }
      } else if (res.kind === 'run') {
        if (credit(G, P, 'RB', 'car')) { credit(G, P, 'RB', 'ryd', gain); if (res.td) credit(G, P, 'RB', 'rtd'); }
      } else if (res.kind === 'sack' && res.by) credit(G, D, res.by, 'sk');
      if (res.kind === 'incomplete' && res.breakup && res.by) credit(G, D, res.by, 'pd');
      if ((res.kind === 'run' || res.kind === 'pass') && !res.td) {
        const tk = res.by && gain <= 2 ? res.by : pickDef(gain > 12 ? ['FS', 'SS', 'CB1', 'CB2'] : ['MLB', 'WLB', 'SLB', 'SS', 'DT1', 'DE1', 'CB1']);
        credit(G, D, tk, 'tkl');
      }
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
    // clock: the play runs now; the time until the next snap is held as "runoff"
    tick(G, playTime, P);
    if (stop || G.twoMinStop) G.runoff = 0;
    else if (res.oob) { if (lateHalf) G.runoff = 0; else setRunoff(G, P, 'oob'); }
    else setRunoff(G, P);
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
    const OFFP = ['QB', 'RB', 'WR', 'TE', 'OL'], DEFP = ['LB', 'S', 'DL', 'CB'];
    [P, D].forEach((side) => {
      const t = G.teams[side];
      let mult = 0.6 + G.morale[side] / 125;
      if (G.weather === 'heat') mult *= 1.2;
      const e = G.edge && G.edge[side];
      if (e) mult *= e.meter;
      mult *= 1 + Math.max(0, momFor(G, side)) / 500;
      if (G.adj[side] === 'tempo') mult *= 1.15;
      t.stars.forEach((s) => {
        if (s.injured) return;
        // only stars who were actually on the field this snap
        if (side === P && !OFFP.includes(s.pos)) return;
        if (side === D && !DEFP.includes(s.pos)) return;
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
        if ((s.ego || 0) > 75) add *= 1.2; // big egos crave the spotlight
        const sm = e && e.starMeter[s.id] ? e.starMeter[s.id] : 1;
        s.meter = clamp(s.meter + Math.round(add * mult * sm), 0, 100);
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
      const w = {}; pool.forEach((x, k) => (w[k] = 120 - (x.dur || 70)));
      const s = pool[+wpick(w)];
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
    armKick(G, other(G.user), P === G.user ? 'ret' : 'cov');
    const ks = kickStars(G, P, D);
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
        tick(G, 8, P); G.runoff = 0; swing(G, P, 20);
        res.text = txt; addLog(G, txt, 'to');
        return res;
      }
      if (ks.kind === 'ret' && !res.coffin) ret = R() < 0.3 ? landing : Math.max(ret, ri(20, 45));
      if (ks.kind === 'cov') ret = 0;
      if (ks.kind) res.crazy = { name: GI.shortName(ks.s.name), pos: ks.s.pos, title: GI.KICK_MOVES[ks.kind].name, team: ks.kind === 'ret' ? D : P };
      if (ks.kind === 'cov' && R() < 0.35) {
        res.muff = true; res.ret = 0; G.ballOn = clamp(landing, 1, 99); G.down = 1; G.toGo = Math.min(10, 100 - G.ballOn);
        txt = `★ BIG HIT! ${GI.shortName(ks.s.name)} forces a fumble on the punt — ${t.abbr} recover!`;
        res.banner = { title: 'BIG HIT — FUMBLE!', sub: `★ ${GI.shortName(ks.s.name)} (${GI.POS[ks.s.pos].label})`, tone: P === G.user ? 'good' : 'bad', star: true };
        tick(G, 8, P); G.runoff = 0; swing(G, P, 22); creditStar(G, P, ks.s, 'ff');
        res.text = txt; addLog(G, txt, 'to');
        return res;
      }
      kickMeters(G, P, D, ret);
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
      if (ks.kind === 'ret') { txt = `★ House Call! ${GI.shortName(ks.s.name)} ` + (res.td ? 'takes the punt back for a TOUCHDOWN!' : `returns it ${ret} yards.`); res.banner = { title: res.td ? 'HOUSE CALL — TD!' : 'HOUSE CALL!', sub: `★ ${GI.shortName(ks.s.name)} (${GI.POS[ks.s.pos].label})`, tone: D === G.user ? 'good' : 'bad', star: true }; }
      if (ks.kind === 'cov') { txt = `★ Big Hit! ${GI.shortName(ks.s.name)} levels the returner. No return.`; res.banner = { title: 'BIG HIT!', sub: `★ ${GI.shortName(ks.s.name)} stuffs the return`, tone: P === G.user ? 'good' : 'bad', star: true }; }
    }
    if (big && !res.banner) res.banner = { title: 'BIG LEG!', sub: `★ ${GI.shortName(kpStar(t).name)} booms it ${gross}`, tone: P === G.user ? 'good' : 'bad', star: true };
    if (G.phase !== 'pat') { G.down = 1; G.toGo = Math.min(10, 100 - G.ballOn); }
    res.gross = gross;
    tick(G, ri(6, 9), P); G.runoff = 0;
    if (res.td) { swing(G, D, 24); if (ks.kind === 'ret') creditStar(G, D, ks.s, 'retd'); }
    else if (ks.kind) swing(G, ks.kind === 'ret' ? D : P, 14);
    if (res.blocked) swing(G, D, 20);
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
    tick(G, 4, P); G.runoff = 0;
    const kp = kpStar(t);
    if (kp) { creditStar(G, P, kp, 'fga'); if (res.good) creditStar(G, P, kp, 'fgm'); if (res.good && dist >= 50) creditStar(G, P, kp, 'fg50'); }
    if (res.good) swing(G, P, dist >= 50 ? 12 : 6); else swing(G, D, blocked ? 20 : 10);
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
      const ks = kickStars(G, K, Rv);
      const tbP = (ks.kind === 'ret' || ks.armedRet) ? 0 : G.freeKick ? 0.05 : clamp(0.55 + (rk.st - 65) / 200 + W.kick * 0.03 + (big ? 0.35 : 0), 0.1, 0.97);
      if (R() < tbP) {
        res.touchback = true; res.land = 106; G.ballOn = 30;
        txt = `${kt.abbr} kicks off. Touchback, ${rt.abbr} ball at the 30.`;
      } else {
        const catchOn = G.freeKick ? ri(15, 30) : ri(-3, 6);
        res.land = 100 - catchOn;
        let ret = Math.round(clamp(gauss(26 + (rr.st - 65) / 5, 7), 8, 48));
        if (R() < 0.03) ret += ri(15, 45);
        if (R() < 0.006) ret = 100;
        if (ks.kind === 'ret') ret = R() < 0.38 ? 100 : Math.max(ret, ri(35, 70));
        if (ks.kind === 'cov') ret = ri(4, 14);
        const on = catchOn + ret;
        res.ret = ret; res.catchOn = catchOn;
        if (ks.kind) res.crazy = { name: GI.shortName(ks.s.name), pos: ks.s.pos, title: GI.KICK_MOVES[ks.kind].name, team: ks.kind === 'ret' ? Rv : K };
        if (ks.kind === 'cov' && R() < 0.4) {
          G.poss = K; G.ballOn = clamp(100 - on, 1, 99);
          res.koFumble = true;
          txt = `★ BIG HIT! ${GI.shortName(ks.s.name)} jars it loose — ${kt.abbr} recover at the ${GI.spotLabel(G, K)}!`;
          res.banner = { title: 'BIG HIT — FUMBLE!', sub: `★ ${GI.shortName(ks.s.name)} (${GI.POS[ks.s.pos].label})`, tone: K === G.user ? 'good' : 'bad', star: true };
        } else if (on >= 100) {
          G.score[Rv] += 6; G.phase = 'pat'; G.ballOn = 98; res.td = true; res.scored = Rv;
          txt = `${rt.abbr} RETURNS THE KICKOFF FOR A TOUCHDOWN!`;
          res.banner = { title: 'KICK RETURN TD!', sub: rt.name, tone: Rv === G.user ? 'good' : 'bad' };
          if (ks.kind === 'ret') { txt = `★ HOUSE CALL! ${GI.shortName(ks.s.name)} takes it ${ret - catchOn > 99 ? 'all the way' : 'the distance'} — TOUCHDOWN!`; res.banner = { title: 'HOUSE CALL — TD!', sub: `★ ${GI.shortName(ks.s.name)} (${GI.POS[ks.s.pos].label})`, tone: Rv === G.user ? 'good' : 'bad', star: true }; }
        } else {
          G.ballOn = clamp(on, 1, 99);
          txt = `${kt.abbr} kicks off, returned ${ret} yards to the ${GI.spotLabel(G, Rv)}.`;
          if (ret >= 40) res.banner = { title: 'BIG RETURN!', sub: `${ret} yards`, tone: Rv === G.user ? 'good' : 'bad' };
          if (ks.kind === 'ret') { txt = `★ House Call! ${GI.shortName(ks.s.name)} breaks it for ${ret} to the ${GI.spotLabel(G, Rv)}.`; res.banner = { title: 'HOUSE CALL!', sub: `★ ${GI.shortName(ks.s.name)} — ${ret} yard return`, tone: Rv === G.user ? 'good' : 'bad', star: true }; }
          if (ks.kind === 'cov') { txt = `★ Big Hit! ${GI.shortName(ks.s.name)} drops the returner at the ${GI.spotLabel(G, Rv)}.`; res.banner = { title: 'BIG HIT!', sub: `★ ${GI.shortName(ks.s.name)} stuffs the return`, tone: K === G.user ? 'good' : 'bad', star: true }; }
        }
        kickMeters(G, K, Rv, ret);
      }
    }
    G.freeKick = false;
    G.toGo = Math.min(10, 100 - G.ballOn);
    if (!res.touchback) tick(G, 6, Rv);
    G.runoff = 0;
    if (res.td) { swing(G, Rv, 24); if (res.crazy && res.crazy.team === Rv) { const st = G.teams[Rv].stars.find((x) => GI.shortName(x.name) === res.crazy.name); if (st) creditStar(G, Rv, st, 'retd'); } }
    else if (res.koFumble) swing(G, K, 24);
    else if (res.onside && res.recovered) swing(G, K, 25);
    else if (res.crazy) swing(G, res.crazy.team, 12);
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
    if (n.kind === 'expiring') {
      if (n.canTO && cpuClock(G, G.user, true)) return GI.autoCall(G);
      return { type: 'runout' };
    }
    if (n.kind !== 'call') return null;
    if (n.canTO && !n.cpuTO) cpuClock(G, G.user);
    if (n.userOff) {
      if (cpuShouldKneel(G, G.poss)) return { type: 'kneel' };
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
  GI.finishAuto = function (G, until) { // let the CPU play out the rest of a game (or until a condition)
    let guard = 0;
    const was = G.auto;
    G.auto = true;
    const plays = [];
    while (!G.over && guard++ < 2000) {
      if (until && guard > 1 && until(G)) break;
      const act = GI.autoCall(G);
      if (!act) break;
      if (until && G.flash === 'half') break; // let the user make halftime adjustments
      const res = GI.step(G, act);
      plays.push(res);
      if (res.crazy || res.clash) (G.highlights = G.highlights || []).push(res.text);
      if (res.injury) (G.injLog = G.injLog || []).push(...res.injury.map((i) => ({ team: G.teams[i.side].idx, name: i.name, pos: i.pos })));
    }
    G.auto = was;
    G.lastAuto = plays;
    return G;
  };
  GI.simGame = function (homeIdx, awayIdx, opts) {
    const o = Object.assign({ qMin: 8, diff: 'pro' }, opts || {});
    const G = GI.newGame(Object.assign({}, o, { user: homeIdx, opp: awayIdx, userHome: true, potw: { off: GI.OFF_PLAYS[ri(0, 4)].id, def: GI.DEF_PLAYS[ri(0, 5)].id } }));
    G.diff = 'sim';
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
