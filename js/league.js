/* Grid Iron — league life: coaching trees, rivalries, stat lines, awards, records, Hall of Fame,
   the owner & season goals, fan hype, storylines, free agency, trades and team identity */
(function () {
  const GI = window.GI;
  const { ri, clamp, wpick } = GI.util;
  const R = Math.random;
  const pick = (a) => a[Math.floor(R() * a.length)];
  const SN = GI.season;
  const L = {};
  GI.league = L;
  const T = (i) => GI.TEAMS[i];
  const r1 = (x) => Math.round(x * 10) / 10;
  const OFFP = ['QB', 'RB', 'WR', 'TE', 'OL'], DEFP = ['LB', 'DL', 'S', 'CB'];
  const COACH_KEYS = ['hc', 'oc', 'dc', 'stc'];
  const ROLE = { hc: 'Head Coach', oc: 'Offensive Coord.', dc: 'Defensive Coord.', stc: 'Special Teams' };
  const ROLE_SHORT = { hc: 'Coach', oc: 'OC', dc: 'DC', stc: 'ST coach' };
  const last = (n) => (n || '').split(' ').slice(1).join(' ') || n;
  const lp = (n, why) => GI.legacy && GI.legacy.addLP(n, why);
  L.RECKEYS = ['pyd', 'ptd', 'ryd', 'rtd', 'recyd', 'rectd', 'sk', 'dint', 'tkl', 'fgm', 'sm', 'retd'];
  // a record only makes news once the old mark was worth something
  L.REC_MIN = { game: { pyd: 260, ptd: 4, ryd: 140, rtd: 3, recyd: 150, rectd: 3, sk: 4, dint: 3, tkl: 12, fgm: 4, sm: 3, retd: 2 }, season: { pyd: 2000, ptd: 18, ryd: 700, rtd: 10, recyd: 800, rectd: 9, sk: 12, dint: 9, tkl: 60, fgm: 15, sm: 9, retd: 3 }, career: { pyd: 6000, ptd: 50, ryd: 2500, rtd: 25, recyd: 3000, rectd: 25, sk: 30, dint: 25, tkl: 200, fgm: 50, sm: 30, retd: 6 } };
  L.ROLE = ROLE; L.ROLE_SHORT = ROLE_SHORT;

  // ================= setup & migration =================
  L.init = function (S) {
    S.v = 3;
    S.fid = S.fid || 'f' + Date.now().toString(36);
    S.hype = S.hype != null ? S.hype : 40;
    S.owner = S.owner || { name: pick(['Mr.', 'Ms.']) + ' ' + pick(GI.LAST), patience: 60 };
    S.goals = S.goals || [];
    S.heat = S.heat || {};
    S.starRiv = S.starRiv || {};
    S.book = S.book || { game: {}, season: {}, career: {} };
    S.hof = S.hof || [];
    S.sstats = S.sstats || {};
    S.awards = S.awards || {};
    S.story = S.story || [];
    S.holdout = S.holdout || {};
    S.coachPool = S.coachPool || [];
    S.pickTrades = S.pickTrades || [];
    S.reel = S.reel || [];
    S.faOffers = S.faOffers || {};
    S.dynasty = S.dynasty || 0;
    S.cap = S.cap || 38;
    S.leagueNews = S.leagueNews || [];
    S.playHurt = S.playHurt || {};
    // coaches get ids and a résumé; some arrive with history elsewhere (seeds the coaching trees)
    S.rosters.forEach((r, i) => {
      COACH_KEYS.forEach((k) => {
        const c = r.coaches[k];
        if (!c || c.id) return;
        c.id = 'c' + (S.nextCoach = (S.nextCoach || 0) + 1);
        c.hist = [{ team: i, key: k, from: 1 }];
        if (k !== 'stc' && R() < 0.3) {
          const prev = pick([...Array(32).keys()].filter((x) => x !== i));
          c.hist.unshift({ team: prev, key: k === 'hc' ? pick(['oc', 'dc']) : k, from: -3, to: 0, how: pick(['fired', 'letgo', 'poached']) });
        }
      });
      if (r.identity === undefined) r.identity = null;
      SN.allStars(S, i).forEach((s) => { s.traits = s.traits || rollTraits(); s.career = s.career || { seasons: 0, gp: 0 }; s.formerTeams = s.formerTeams || []; s.awards = s.awards || []; });
    });
    return S;
  };
  L.migrate = function (S) { if (!S) return S; if ((S.v || 0) < 3) L.init(S); return S; };
  function rollTraits() {
    const t = [], x = R();
    if (x < 0.36) t.push(pick(GI.TRAIT_KEYS));
    if (x < 0.06) { const b = pick(GI.TRAIT_KEYS); if (!t.includes(b)) t.push(b); }
    return t;
  }
  L.rollTraits = rollTraits;
  L.coachSalary = (c) => r1(0.6 + Math.max(0, (c.rating || 60) - 50) * 0.06);
  L.staffCost = (S, i) => COACH_KEYS.reduce((t, k) => t + L.coachSalary(S.rosters[i].coaches[k]), 0);

  // ================= coaching trees =================
  L.newCoach = function (S, key, o) {
    o = o || {};
    const c = { id: 'c' + (S.nextCoach = (S.nextCoach || 0) + 1), role: ROLE[key], name: o.name || pick(GI.FIRST) + ' ' + pick(GI.COACH_LAST), rating: o.rating || ri(56, 84), hist: o.hist || [] };
    if (o.former) c.former = o.former;
    styleFor(c, key);
    return c;
  };
  function styleFor(c, key) {
    if (key === 'oc' && !GI.OC_STYLES[c.style]) c.style = pick(Object.keys(GI.OC_STYLES));
    if (key === 'dc' && !GI.DC_STYLES[c.style]) c.style = pick(Object.keys(GI.DC_STYLES));
    if (key === 'hc' || key === 'stc') delete c.style;
  }
  // put coach c in team's seat `key`; the old coach leaves with `how` (fired / letgo / poached / promoted)
  L.hire = function (S, team, key, c, how) {
    const r = S.rosters[team];
    const old = r.coaches[key];
    S.coachPool = S.coachPool.filter((x) => x.id !== c.id);
    if (old) {
      const h = (old.hist || []).filter((x) => x.team === team && x.to == null).pop();
      if (h) { h.to = S.year; h.how = how || 'fired'; h.by = c.id; }
      if (how !== 'promoted' && how !== 'retired') S.coachPool.push(old);
    }
    c.role = ROLE[key];
    styleFor(c, key);
    c.hist = c.hist || [];
    c.hist.push({ team, key, from: S.year, replaced: old ? old.id : null });
    r.coaches[key] = c;
    S.coachPool.sort((a, b) => b.rating - a.rating);
    if (S.coachPool.length > 36) S.coachPool.length = 36;
    return old;
  };
  function poolBest(S, key) {
    const cands = S.coachPool.filter((c) => key === 'hc' ? c.rating >= 64 : true);
    if (!cands.length || R() < 0.25) return L.newCoach(S, key);
    return cands.slice(0, 5)[ri(0, Math.min(4, cands.length - 1))];
  }
  const overlap = (a, b) => a.team === b.team && a.from <= (b.to == null ? 1e9 : b.to) && b.from <= (a.to == null ? 1e9 : a.to);
  function workedWith(c1, c2) {
    if (!c1 || !c2 || c1.id === c2.id) return null;
    for (const a of c1.hist || []) for (const b of c2.hist || []) if ((a.to != null || b.to != null) && overlap(a, b)) return a.team;
    return null;
  }
  L.workedWith = workedWith;

  // ================= matchup edges =================
  const OC_COUNTER = { pass: { deep: 0.12, press: 0.1 }, run: { blitz_in: 0.12, blitz_out: 0.12 }, gadget: { man: 0.18 }, balanced: { zone: 0.08 } };
  const DC_COUNTER = { blitz: { trick: 0.15, out_run: 0.1 }, cover: { in_run: 0.1, short: 0.1 }, press: { long: 0.14 }, balanced: { short: 0.06 } };
  const blank = () => ({ off: 0, def: 0, calls: {}, meter: 1, starMeter: {}, starStart: {}, rz: 0, morale: 0, notes: [] });
  const addCalls = (e, c) => { for (const k in c) e.calls[k] = (e.calls[k] || 0) + c[k]; };
  L.heat = (S, x, y) => (S.heat[x] && S.heat[x][y]) || 0;
  function addHeat(S, x, y, n) { S.heat[x] = S.heat[x] || {}; S.heat[x][y] = clamp((S.heat[x][y] || 0) + n, 0, 100); }
  L.addHeat = addHeat;
  L.isDiv = (a, b) => SN.confOf(a) === SN.confOf(b) && SN.divOf(a) === SN.divOf(b);
  L.edgesFor = function (S, hi, ai) {
    const E = { home: blank(), away: blank() };
    [['home', hi, ai], ['away', ai, hi]].forEach(([side, x, y]) => {
      const e = E[side], X = S.rosters[x], Y = S.rosters[y], ty = T(y);
      const stars = X.stars;
      // 1) revenge: a coach facing the team that let him go (or the man who took his job)
      ['hc', 'oc', 'dc'].forEach((k) => {
        const c = X.coaches[k];
        if (!c || !c.hist) return;
        const past = c.hist.filter((h) => h.team === y && h.to != null && h.key !== 'player' && ['fired', 'letgo', 'poached'].includes(h.how)).pop();
        if (!past) return;
        const repl = Y.coaches[past.key];
        const took = repl && repl.id === past.by;
        if (k === 'hc') { e.morale += took ? 5 : 3; e.notes.push({ icon: '🔥', text: `Revenge game: Coach ${last(c.name)} faces the ${ty.name}${took ? ` and ${repl.name}, who took his job` : ', who let him go'}` }); return; }
        const boost = took ? 1.08 : 1.05;
        stars.filter((s) => (k === 'oc' ? OFFP : DEFP).includes(s.pos)).forEach((s) => (e.starMeter[s.id] = (e.starMeter[s.id] || 1) * boost));
        if (k === 'oc') e.off += took ? 0.08 : 0.05; else e.def += took ? 0.08 : 0.05;
        e.notes.push({ icon: '🔥', text: took ? `${ROLE_SHORT[k]} ${last(c.name)} faces ${repl.name}, the man who took his job in ${ty.city}: +${Math.round((boost - 1) * 100)}% ${k === 'oc' ? 'offensive' : 'defensive'} meters` : `${ROLE_SHORT[k]} ${last(c.name)} faces the ${ty.name}, who ${past.how === 'poached' ? 'lost him to a rival' : 'let him go'}: +5% ${k === 'oc' ? 'offensive' : 'defensive'} meters` });
      });
      // 2) he knows their playbook: worked under/with their staff
      const yoc = Y.coaches.oc, ydc = Y.coaches.dc;
      let where = workedWith(X.coaches.dc, Y.coaches.hc); if (where == null) where = workedWith(X.coaches.dc, yoc);
      if (where != null && yoc && yoc.style && OC_COUNTER[yoc.style]) { addCalls(e, OC_COUNTER[yoc.style]); e.notes.push({ icon: '🧠', text: `DC ${last(X.coaches.dc.name)} knows the ${ty.name} playbook (they worked together in ${T(where).city})` }); }
      where = workedWith(X.coaches.oc, Y.coaches.hc); if (where == null) where = workedWith(X.coaches.oc, ydc);
      if (where != null && ydc && ydc.style && DC_COUNTER[ydc.style]) { addCalls(e, DC_COUNTER[ydc.style]); e.notes.push({ icon: '🧠', text: `OC ${last(X.coaches.oc.name)} knows how ${ty.city} defends (they worked together in ${T(where).city})` }); }
      // 3) old teammates: stars facing their former team
      stars.forEach((s) => {
        const f = (s.formerTeams || []).filter((ft) => ft.team === y).pop();
        if (!f) return;
        const mad = ['cut', 'traded', 'walked'].includes(f.how);
        e.starStart[s.id] = (e.starStart[s.id] || 0) + (mad ? 35 : 20);
        e.starMeter[s.id] = (e.starMeter[s.id] || 1) * (mad ? 1.12 : 1.06);
        e.notes.push({ icon: '😤', text: `${GI.POS[s.pos].label} ${GI.shortName(s.name)} faces his old team${mad ? `: ${f.how === 'traded' ? 'they traded him' : f.how === 'cut' ? 'they cut him' : 'they let him walk'}` : ''}` });
      });
      COACH_KEYS.forEach((k) => {
        const c = X.coaches[k];
        if (c && c.former && (c.former.teams || []).includes(y)) { e.morale += 2; e.notes.push({ icon: '🎓', text: `${ROLE_SHORT[k]} ${last(c.name)} starred for ${ty.city} as a player` }); }
      });
      // 4) star rivalries built from past clashes
      Object.values(S.starRiv).forEach((rv) => {
        if (rv.n < 2) return;
        const mine = stars.find((s) => s.id === rv.a || s.id === rv.b), theirs = Y.stars.find((s) => s.id === rv.a || s.id === rv.b);
        if (mine && theirs) { e.starStart[mine.id] = (e.starStart[mine.id] || 0) + 15; e.notes.push({ icon: '⚔️', text: `${GI.shortName(mine.name)} vs ${GI.shortName(theirs.name)}: rivalry round ${rv.n + 1}` }); }
      });
      // 5) playbook identity: stars who don't fit grumble
      const id = X.identity && GI.IDENTITIES[X.identity];
      if (id) {
        const grumpy = stars.filter((s) => s.ego > 65 && !id.fit.includes(s.pos) && s.pos !== 'KP');
        if (grumpy.length) { e.morale -= Math.min(4, grumpy.length); e.notes.push({ icon: '😒', text: `${grumpy.slice(0, 2).map((s) => GI.shortName(s.name)).join(' & ')} ${grumpy.length > 1 ? "aren't" : "isn't"} sold on ${id.name}` }); }
      }
      // 6) old colleagues on the other sideline (flavor + small chess-match edge to the better coach)
      COACH_KEYS.slice(0, 3).forEach((k) => COACH_KEYS.slice(0, 3).forEach((k2) => {
        const a = X.coaches[k], b = Y.coaches[k2];
        if (side !== 'home' || !a || !b) return;
        const w = workedWith(a, b);
        if (w != null && !(e.notes.some((n) => n.text.includes(last(a.name))))) e.notes.push({ icon: '🤝', text: `Old colleagues: ${ROLE_SHORT[k]} ${last(a.name)} and ${ROLE_SHORT[k2]} ${last(b.name)} (${T(w).city})` });
      }));
    });
    const hh = L.heat(S, hi, ai), ha = L.heat(S, ai, hi);
    const div = L.isDiv(hi, ai);
    const hot = hh + ha >= 50 || (div && hh + ha >= 28);
    if (hot) ['home', 'away'].forEach((s) => E[s].notes.unshift({ icon: '🔥', text: `RIVALRY GAME${div ? ' (division)' : ''}: louder crowd, hotter meters` }));
    return { edges: E, rivalry: { hot, div, heat: { home: hh, away: ha } } };
  };

  // ================= after every game =================
  function statScore(r) {
    return (r.pyd || 0) / 22 + (r.ptd || 0) * 5 - (r.int || 0) * 3 + (r.ryd || 0) / 9 + (r.rtd || 0) * 6 + (r.recyd || 0) / 9 + (r.rectd || 0) * 6
      + (r.sk || 0) * 6 + (r.dint || 0) * 8 + (r.ff || 0) * 5 + (r.tkl || 0) * 0.7 + (r.pd || 0) * 2 + (r.fgm || 0) * 1.6 + (r.fg50 || 0) * 2 + (r.sm || 0) * 4 + (r.retd || 0) * 8;
  }
  L.statScore = statScore;
  L.reelScore = (res) => (res.clash ? 6 : 0) + (res.crazy ? 5 : 0) + (res.td ? 4 : 0) + (res.turnover ? 3 : 0) + ((res.gain || 0) >= 30 ? 2 : 0) + (res.record ? 4 : 0);
  L.afterGame = function (S, g, G, playoff) {
    const st = S.sstats;
    ['home', 'away'].forEach((side) => G.teams[side].stars.forEach((s) => {
      const r = st[s.id] || (st[s.id] = { id: s.id, team: G.teams[side].idx, name: s.name, pos: s.pos, gp: 0, rookie: (s.yrsPro || 0) === 0 });
      r.team = G.teams[side].idx; r.rating = s.rating;
      if (!s.injured || G.ps[s.id]) r.gp++;
    }));
    Object.values(G.ps).forEach((p) => {
      const r = st[p.id] || (st[p.id] = { id: p.id, team: p.team, name: p.name, pos: p.pos, gp: 1 });
      GI.PSK.forEach((k) => { if (p[k]) r[k] = (r[k] || 0) + p[k]; });
      // single-game records
      L.RECKEYS.forEach((k) => {
        const v = p[k] || 0, cur = S.book.game[k];
        if (v && (!cur || v > cur.v)) {
          S.book.game[k] = { v, name: p.name, team: p.team, year: S.year, id: p.id, pos: p.pos };
          if (cur && cur.v >= L.REC_MIN.game[k]) { const rc = { scope: 'game', key: k, v, name: p.name, team: p.team, prev: cur.v }; (S._recs = S._recs || []).push(rc); if (GI.share) GI.share.fromRecord(S, rc); }
        }
      });
    });
    // rivalry heat: losing builds a grudge, blowouts and playoff knockouts burn hottest
    const h = g.h, a = g.a;
    const win = g.hs > g.as ? h : g.hs < g.as ? a : null;
    if (win != null) {
      const lose = win === h ? a : h, m = Math.abs(g.hs - g.as);
      addHeat(S, lose, win, 12 + (m >= 21 ? 8 : 0) + (playoff ? 20 : 0));
      addHeat(S, win, lose, -4);
    }
    if (L.isDiv(h, a)) { addHeat(S, h, a, 3); addHeat(S, a, h, 3); }
    // star-vs-star rivalries from clashes
    (G.clashes || []).forEach((c) => {
      const key = [c.win, c.lose].sort().join('|');
      const nm = (id) => { for (const s of ['home', 'away']) { const x = G.teams[s].stars.find((q) => q.id === id); if (x) return { name: x.name, pos: x.pos }; } return { name: '?', pos: '' }; };
      const rv = S.starRiv[key] || (S.starRiv[key] = { a: c.win, b: c.lose, an: nm(c.win), bn: nm(c.lose), n: 0, w: {} });
      rv.n++; rv.w[c.win] = (rv.w[c.win] || 0) + 1;
      if (rv.n === 2 || rv.n === 4) (S._rivNews = S._rivNews || []).push(rv);
    });
    // your team: hype, the highlight reel, guarantees
    if (h === S.user || a === S.user) {
      const us = h === S.user ? g.hs : g.as, them = h === S.user ? g.as : g.hs, m = us - them;
      let dh = m > 0 ? (m >= 17 ? 5 : 3) : m < 0 ? (m <= -17 ? -5 : -3) : 0;
      if (playoff && m > 0) dh += 4;
      dh += Math.min(2, Object.keys(G.crazyLog || {}).length);
      if (S.guarantee) { dh += m > 0 ? 8 : -8; S._guar = m > 0 ? 'kept' : 'broken'; S.guarantee = null; }
      S.hype = clamp((S.hype || 40) + dh, 0, 100);
      S.hypePeak = Math.max(S.hypePeak || 0, S.hype);
      const opp = h === S.user ? a : h;
      const goal = (S.goals || []).find((x) => x.id === 'rival' && x.opp === opp);
      if (goal && m > 0) goal.done = true;
      (G.reelCands || []).forEach((c) => S.reel.push(Object.assign({}, c, { year: S.year, label: G.label || '', opp, userHome: h === S.user, venue: G.venue || null, weather: G.weather })));
      S.reel.sort((x, y) => y.score - x.score);
      if (S.reel.length > 14) S.reel.length = 14;
      (G.milestones || []).forEach((ms) => (S._miles = S._miles || []).push(ms));
      // stickers: everyone you shared a field with
      if (GI.legacy) ['home', 'away'].forEach((side) => GI.legacy.collect(G.teams[side].stars.map((s) => L.sticker(S, s, G.teams[side].idx))));
    }
  };
  L.sticker = function (S, s, team) {
    const t = T(team) || {};
    return { key: (S ? S.fid : 'c') + ':' + s.id, name: s.name, pos: s.pos, num: s.num, rating: s.rating, team: t.abbr, tname: t.name, c1: t.c1, c2: t.c2, glyph: t.glyph || (GI.TEAM_GLYPH && GI.TEAM_GLYPH[team]), ti: team, year: S ? S.year : null };
  };

  // ================= weekly: power rankings, storylines, the rest of the league =================
  L.powerRankings = function (S) {
    const sc = [...Array(32).keys()].map((i) => {
      const r = S.rec[i], gp = r.w + r.l + r.t;
      return { i, v: (gp ? SN.pct(r) * 100 + ((r.pf - r.pa) / gp) * 1.2 : 50) + SN.teamOvr(S, i) * 0.6 };
    }).sort((a, b) => b.v - a.v);
    const prev = S.lastPR || {};
    const out = sc.map((x, k) => ({ i: x.i, rank: k + 1, prev: prev[x.i] || null }));
    S.lastPR = {}; out.forEach((x) => (S.lastPR[x.i] = x.rank));
    return out;
  };
  L.weekly = function (S, paper) {
    const around = [], locker = [];
    // power rankings
    const pr = L.powerRankings(S);
    paper.power = pr.slice(0, 10);
    paper.myRank = pr.find((x) => x.i === S.user);
    // storylines that carry over week to week
    S.story = (S.story || []).filter((st) => {
      st.weeks = (st.weeks || 0) + 1;
      if (st.kind === 'hotseat' && st.weeks >= 4) {
        const r = S.rec[S.user], since = r.w - st.w0, lost = r.l - st.l0;
        const hc = S.rosters[S.user].coaches.hc;
        if (since > lost) { locker.push(`📈 HOT SEAT UPDATE: Coach ${last(hc.name)} is ${since}-${lost} since you backed him. The owner is impressed.`); S.owner.patience = clamp(S.owner.patience + 6, 0, 100); hc.rating = Math.min(95, hc.rating + 2); }
        else { locker.push(`📉 HOT SEAT UPDATE: ${since}-${lost} since you backed Coach ${last(hc.name)}. The owner is losing patience with both of you.`); S.owner.patience = clamp(S.owner.patience - 8, 0, 100); }
        return false;
      }
      if (st.kind === 'feud' && st.weeks >= 3) {
        const s = SN.allStars(S, S.user).find((x) => x.id === st.id);
        if (s && S.rec[S.user].streak < 0) { s.ego = Math.min(99, s.ego + 6); locker.push(`🗯️ ${GI.shortName(s.name)} is still steaming about that trade request. Ego +6.`); }
        return false;
      }
      return st.weeks < 8;
    });
    // holdouts
    Object.keys(S.holdout).forEach((id) => {
      const s = SN.allStars(S, S.user).find((x) => x.id === id);
      if (!s) { delete S.holdout[id]; return; }
      S.holdout[id]--;
      if (S.holdout[id] <= 0) { delete S.holdout[id]; locker.push(`🤝 HOLDOUT OVER: ${GI.POS[s.pos].label} ${s.name} reports back. He's rusty and a little bitter (meter starts at 0).`); S.pressMods = S.pressMods || {}; (S.pressMods.starMeter = S.pressMods.starMeter || {})[s.id] = 0; }
      else locker.push(`⏳ HOLDOUT, WEEK ${s._hoW = (s._hoW || 0) + 1}: ${s.name} is still at home. ${S.holdout[id]} more week${S.holdout[id] > 1 ? 's' : ''} expected.`);
    });
    // records & milestones
    (S._recs || []).forEach((r) => (r.team === S.user ? locker : around).push(`📜 LEAGUE RECORD: ${T(r.team).abbr} ${r.name} — ${r.v} ${GI.STAT_NAME[r.key]} in one game`));
    (S._recs || []).filter((r) => r.team === S.user).forEach(() => lp(5, 'League record'));
    S._recs = [];
    (S._miles || []).forEach((m) => locker.push(`🏅 MILESTONE: ${m.name} reached ${m.th.toLocaleString()} career ${GI.STAT_NAME[m.key]}!`));
    (S._miles || []).forEach(() => lp(3, 'Career milestone'));
    S._miles = [];
    (S._rivNews || []).forEach((rv) => {
      const lead = (rv.w[rv.a] || 0) >= (rv.w[rv.b] || 0) ? rv.an : rv.bn;
      around.push(`⚔️ A RIVALRY IS BORN: ${rv.an.name} and ${rv.bn.name} have clashed ${rv.n} times. ${GI.shortName(lead.name)} leads the series.`);
    });
    S._rivNews = [];
    if (S._guar) { locker.push(S._guar === 'kept' ? '🗣️ GUARANTEE DELIVERED! The coach called it and the fans are buzzing. Hype +8.' : '🙊 BROKEN GUARANTEE: so much for that promise. Hype −8.'); S._guar = null; }
    // the rest of the league has its own drama
    around.push(...L.leagueDrama(S));
    S.hype = clamp(S.hype + ((40 + (S.up.stadium - 1) * 4) - S.hype) * 0.04, 0, 100);
    const sec = (title, items) => { if (!items.length) return; const ex = paper.sections.find((x) => x.title === title); if (ex) ex.items.push(...items); else paper.sections.push({ title, items }); };
    sec('Locker Room', locker);
    sec('League Wire', around.concat((S.leagueNews || []).splice(0)));
  };
  L.leagueDrama = function (S) {
    const out = [];
    const cpu = [...Array(32).keys()].filter((i) => i !== S.user);
    // a coach on a long skid gets the axe mid-season
    const skid = cpu.filter((i) => S.rec[i].streak <= -4);
    if (skid.length && R() < 0.35) {
      const i = pick(skid), r = S.rosters[i];
      const old = r.coaches.hc;
      const promote = R() < 0.5;
      const nu = promote ? r.coaches[pick(['oc', 'dc'])] : poolBest(S, 'hc');
      if (promote) { const k = r.coaches.oc === nu ? 'oc' : 'dc'; const repl = poolBest(S, k); L.hire(S, i, k, repl, 'promoted'); }
      L.hire(S, i, 'hc', nu, 'fired');
      out.push(`🪓 ${T(i).city} fire Coach ${last(old.name)} after ${-S.rec[i].streak} straight losses. ${nu.name} takes over${promote ? ' (promoted from coordinator)' : ''}.`);
    }
    // a diva sits out a week
    if (R() < 0.18) {
      const divas = [];
      cpu.forEach((i) => S.rosters[i].stars.forEach((s) => { if (s.ego > 82 && !(S.inj[s.id] > 0)) divas.push({ i, s }); }));
      if (divas.length) { const d = pick(divas); S.inj[d.s.id] = 1; out.push(`💸 ${T(d.i).abbr} ${GI.POS[d.s.pos].label} ${d.s.name} skips practice in a contract dispute and will sit this week.`); }
    }
    // CPU teams swap stars before the deadline
    if (S.phase === 'regular' && S.week < S.weeks / 2 && R() < 0.12) {
      const a = pick(cpu), b = pick(cpu.filter((x) => x !== a));
      const pa = S.rosters[a].stars.filter((s) => !['KP', 'QB'].includes(s.pos));
      const sa = pa.length ? pick(pa) : null;
      const sb = sa ? S.rosters[b].stars.find((s) => s.pos === sa.pos && Math.abs(s.rating - sa.rating) <= 6) : null;
      if (sa && sb) {
        swapStars(S, a, sa, b, sb);
        out.push(`🔁 TRADE: ${T(a).abbr} send ${GI.POS[sa.pos].label} ${sa.name} to ${T(b).city} for ${sb.name}.`);
      }
    }
    // streaks
    cpu.filter((i) => S.rec[i].streak >= 4).slice(0, 1).forEach((i) => out.push(`🔥 The ${T(i).name} have won ${S.rec[i].streak} straight.`));
    return out;
  };
  function swapStars(S, a, sa, b, sb) {
    const ra = S.rosters[a], rb = S.rosters[b];
    ra.stars = ra.stars.filter((x) => x.id !== sa.id).concat([sb]);
    rb.stars = rb.stars.filter((x) => x.id !== sb.id).concat([sa]);
    (sa.formerTeams = sa.formerTeams || []).push({ team: a, how: 'traded', year: S.year });
    (sb.formerTeams = sb.formerTeams || []).push({ team: b, how: 'traded', year: S.year });
    sa.chem = {}; sb.chem = {};
  }

  // ================= season start: goals & the owner =================
  const PER_GAME = { pyd: 120, ryd: 45, recyd: 42, rectd: 0.35, sk: 0.45, dint: 0.3, tkl: 2.6, fgm: 1, ptd: 0.9 };
  const GOAL_STAT = { QB: 'pyd', RB: 'ryd', WR: 'recyd', TE: 'recyd', DL: 'sk', LB: 'tkl', S: 'dint', CB: 'dint', KP: 'fgm' };
  L.seasonStart = function (S) {
    S.sstats = {};
    S.reel = [];
    S.hypePeak = S.hype;
    // CPU teams settle on a playbook identity that fits their stars
    for (let i = 0; i < 32; i++) if (i !== S.user) S.rosters[i].identity = L.bestIdentity(S, i);
    const ovrs = [...Array(32).keys()].map((i) => ({ i, o: SN.teamOvr(S, i) })).sort((a, b) => b.o - a.o);
    const rank = ovrs.findIndex((x) => x.i === S.user) + 1;
    const wk = S.weeks;
    const goals = [];
    const exp = Math.max(2, Math.round(wk * clamp(0.72 - ((rank - 1) / 31) * 0.42, 0.3, 0.72)));
    goals.push({ id: 'wins', text: `Win ${exp}+ games`, target: exp, reward: 3, lp: 5 });
    if (S.lastChamp === S.user) goals.push({ id: 'title', text: 'Iron-Bowl or bust: repeat as champions', reward: 8, lp: 15 });
    else if (rank <= 14 || S.year >= 3) goals.push({ id: 'playoffs', text: 'Make the playoffs', reward: 5, lp: 8 });
    else goals.push({ id: 'hype', text: 'Get fan hype to 60', target: 60, reward: 2, lp: 5 });
    // beat the team you hate most (that's on the schedule)
    const opps = S.schedule.map((wkG) => { const g = wkG.find((x) => x.h === S.user || x.a === S.user); return g.h === S.user ? g.a : g.h; });
    const riv = opps.slice().sort((a, b) => L.heat(S, S.user, b) + L.heat(S, b, S.user) - (L.heat(S, S.user, a) + L.heat(S, a, S.user)) || (L.isDiv(S.user, b) - L.isDiv(S.user, a)))[0];
    if (riv != null) goals.push({ id: 'rival', opp: riv, text: `Beat the ${T(riv).city} ${T(riv).name}`, reward: 2, lp: 4 });
    // a star stat goal (rookies first)
    const stars = S.rosters[S.user].stars.filter((s) => GOAL_STAT[s.pos]).sort((a, b) => ((a.yrsPro || 0) === 0 ? -10 : 0) - ((b.yrsPro || 0) === 0 ? -10 : 0) || b.rating - a.rating);
    const s = stars[0];
    if (s) {
      const k = GOAL_STAT[s.pos];
      const scale = S.qMin / 5;
      let target = PER_GAME[k] * wk * scale * (0.8 + (s.rating - 70) / 60);
      target = target >= 100 ? Math.round(target / 50) * 50 : Math.max(1, Math.round(target));
      goals.push({ id: 'star', star: s.id, key: k, target, text: `${(s.yrsPro || 0) === 0 ? 'Rookie ' : ''}${GI.POS[s.pos].label} ${GI.shortName(s.name)}: ${target.toLocaleString()} ${GI.STAT_NAME[k]}`, reward: 2, lp: 4 });
    }
    S.goals = goals;
  };
  L.goalProgress = function (S, g) {
    if (g.id === 'wins') return { v: S.rec[S.user].w, target: g.target, done: S.rec[S.user].w >= g.target };
    if (g.id === 'playoffs') return { v: S.bracket && S.bracket.seedOf[S.user] ? 1 : 0, target: 1, done: !!(S.bracket && S.bracket.seedOf[S.user]) };
    if (g.id === 'title') return { v: S.champion === S.user ? 1 : 0, target: 1, done: S.champion === S.user };
    if (g.id === 'hype') return { v: Math.round(S.hypePeak || S.hype), target: g.target, done: (S.hypePeak || S.hype) >= g.target };
    if (g.id === 'rival') return { v: g.done ? 1 : 0, target: 1, done: !!g.done };
    if (g.id === 'star') { const r = S.sstats[g.star] || {}; const v = r[g.key] || 0; return { v, target: g.target, done: v >= g.target }; }
    return { v: 0, target: 1, done: false };
  };
  L.ownerReview = function (S) {
    const res = (S.goals || []).map((g) => Object.assign({ g }, L.goalProgress(S, g)));
    const met = res.filter((x) => x.done);
    let delta = met.length * 10 - (res.length - met.length) * 12;
    if (S.champion === S.user) delta += 25;
    else if (S.bracket && S.bracket.seedOf[S.user]) delta += 5;
    const before = S.owner.patience;
    S.owner.patience = clamp(before + delta, 0, 100);
    const bonus = met.reduce((t, x) => t + x.g.reward, 0);
    S.cash += bonus; S.fin.bonus += bonus;
    met.forEach((x) => lp(x.g.lp, 'Season goal'));
    let extra = 0;
    if (S.owner.patience >= 85) { extra = 4; S.cash += extra; S.fin.bonus += extra; }
    const p = S.owner.patience;
    const verdict = p >= 85 ? 'is thrilled and opens the checkbook' : p >= 60 ? 'is happy with the direction' : p >= 35 ? 'expects more next year' : p > 0 ? 'has you on the hot seat' : 'has seen enough';
    const fired = p <= 0 && S.year >= 2;
    return { res, met: met.length, total: res.length, delta: S.owner.patience - before, bonus: bonus + extra, verdict, fired };
  };
  // fired: take over one of the league's worst teams
  L.jobOffers = function (S) {
    return [...Array(32).keys()].filter((i) => i !== S.user).sort((a, b) => SN.pct(S.rec[a]) - SN.pct(S.rec[b]) || SN.teamOvr(S, a) - SN.teamOvr(S, b)).slice(0, 3);
  };
  L.takeJob = function (S, idx) {
    const from = S.user;
    S.history.unshift({ year: S.year, fired: true, from, to: idx, champ: S.champion != null ? S.champion : from, user: from, rec: SN.recStr(S.rec[from]) });
    S.user = idx;
    S.cash = 18; S.hype = 35;
    S.owner = { name: pick(['Mr.', 'Ms.']) + ' ' + pick(GI.LAST), patience: 55 };
    S.expiring = [];
    S.faOffers = {};
    S.fired = null;
    SN.save(S);
  };

  // ================= offseason: awards, careers, records, Hall of Fame, coaching carousel =================
  function starIndex(S) {
    const m = {};
    S.rosters.forEach((r, i) => SN.allStars(S, i).forEach((s) => (m[s.id] = { s, team: i })));
    (S.freeAgents || []).forEach((s) => { if (!m[s.id]) m[s.id] = { s, team: null }; });
    return m;
  }
  const SLOTS = { QB: 1, RB: 1, WR: 2, TE: 1, OL: 2, LB: 2, DL: 2, S: 2, CB: 2, KP: 1 };
  L.computeAwards = function (S) {
    const idx = starIndex(S);
    const minGp = Math.max(2, Math.ceil(S.weeks * 0.4));
    const list = Object.values(S.sstats).filter((r) => r.gp >= minGp && idx[r.id]);
    const teamF = (r) => 0.6 + SN.pct(S.rec[r.team] || { w: 0, l: 0, t: 0 }) * 0.8;
    const val = (r) => statScore(r) * (r.pos === 'QB' ? 0.85 : 1) * teamF(r);
    const by = (f) => list.filter(f).sort((a, b) => val(b) - val(a))[0];
    const line = (r) => statLine(r);
    const mk = (r, award) => r ? { id: r.id, name: r.name, pos: r.pos, team: r.team, line: line(r), award } : null;
    const A = { year: S.year };
    A.mvp = mk(by(() => true), 'MVP');
    A.opoy = mk(by((r) => OFFP.includes(r.pos) && (!A.mvp || r.id !== A.mvp.id)), 'Offensive Player of the Year');
    A.dpoy = mk(by((r) => DEFP.includes(r.pos) && (!A.mvp || r.id !== A.mvp.id)), 'Defensive Player of the Year');
    A.roy = mk(by((r) => r.rookie), 'Rookie of the Year');
    // coach of the year: biggest jump (or best record in year 1)
    const prev = S.lastRec;
    const coy = [...Array(32).keys()].map((i) => ({ i, v: SN.pct(S.rec[i]) * 10 + (prev ? (SN.pct(S.rec[i]) - SN.pct(prev[i])) * 14 : 0) })).sort((a, b) => b.v - a.v)[0];
    A.coy = { team: coy.i, name: S.rosters[coy.i].coaches.hc.name, line: SN.recStr(S.rec[coy.i]) + (prev ? ` (was ${SN.recStr(prev[coy.i])})` : ''), award: 'Coach of the Year' };
    // the All-Iron team
    A.allIron = [];
    Object.keys(SLOTS).forEach((pos) => {
      const c = list.filter((r) => r.pos === pos).sort((a, b) => (pos === 'OL' ? (b.rating || 0) - (a.rating || 0) : val(b) - val(a))).slice(0, SLOTS[pos]);
      c.forEach((r) => A.allIron.push(mk(r, 'All-Iron')));
    });
    // stamp the trophies on the players
    const stamp = (x, tag) => {
      if (!x || !idx[x.id]) return;
      const s = idx[x.id].s;
      (s.awards = s.awards || []).push(`${S.year} ${tag}`);
      s.ego = Math.min(99, (s.ego || 50) + (tag === 'All-Iron' ? 2 : 5));
      s.raise = true;
      if (x.team === S.user) { S.hype = clamp(S.hype + (tag === 'All-Iron' ? 1 : 4), 0, 100); lp(tag === 'MVP' ? 20 : tag === 'All-Iron' ? 3 : 10, tag); }
      if (GI.legacy && x.team === S.user || (GI.legacy && tag !== 'All-Iron')) GI.legacy.collect([L.sticker(S, s, idx[x.id].team != null ? idx[x.id].team : x.team)], tag);
    };
    stamp(A.mvp, 'MVP'); stamp(A.opoy, 'OPOY'); stamp(A.dpoy, 'DPOY'); stamp(A.roy, 'ROY');
    A.allIron.forEach((x) => stamp(x, 'All-Iron'));
    if (A.coy.team === S.user) lp(8, 'Coach of the Year');
    S.awards[S.year] = A;
    return A;
  };
  function statLine(r) {
    const p = [];
    if (r.pyd) p.push(`${r.pyd.toLocaleString()} pass yds, ${r.ptd || 0} TD`);
    if (r.ryd) p.push(`${r.ryd.toLocaleString()} rush yds, ${r.rtd || 0} TD`);
    if (r.recyd) p.push(`${r.rec || 0} rec, ${r.recyd.toLocaleString()} yds, ${r.rectd || 0} TD`);
    if (r.sk) p.push(`${r.sk} sack${r.sk === 1 ? "" : "s"}`);
    if (r.dint) p.push(`${r.dint} INT`);
    if (r.tkl && !p.length) p.push(`${r.tkl} tackle${r.tkl === 1 ? "" : "s"}`);
    if (r.fgm) p.push(`${r.fgm}/${r.fga || r.fgm} FG`);
    if (r.sm) p.push(`${r.sm} Show-Me`);
    return p.slice(0, 3).join(" · ") || `${r.gp} game${r.gp === 1 ? "" : "s"}`;
  }
  L.statLine = statLine;
  // roll this season's numbers into careers and the record book
  L.rollSeason = function (S) {
    const idx = starIndex(S);
    const out = [];
    Object.values(S.sstats).forEach((r) => {
      L.RECKEYS.forEach((k) => {
        const v = r[k] || 0, cur = S.book.season[k];
        if (v && (!cur || v > cur.v)) { S.book.season[k] = { v, name: r.name, team: r.team, year: S.year, id: r.id, pos: r.pos }; if (cur && cur.v >= L.REC_MIN.season[k]) { const rc = { scope: 'season', key: k, v, name: r.name, team: r.team, prev: cur.v }; out.push(rc); if (GI.share) GI.share.fromRecord(S, rc); } }
      });
      const hit = idx[r.id];
      if (!hit) return;
      const c = hit.s.career || (hit.s.career = { seasons: 0, gp: 0 });
      c.seasons++; c.gp += r.gp;
      GI.PSK.forEach((k) => { if (r[k]) c[k] = (c[k] || 0) + r[k]; });
    });
    Object.values(idx).forEach(({ s, team }) => {
      const c = s.career; if (!c) return;
      L.RECKEYS.forEach((k) => {
        const v = c[k] || 0, cur = S.book.career[k];
        if (v && (!cur || v > cur.v)) { S.book.career[k] = { v, name: s.name, team, year: S.year, id: s.id, pos: s.pos }; if (cur && cur.v >= L.REC_MIN.career[k] && cur.id !== s.id) { const rc = { scope: 'career', key: k, v, name: s.name, team, prev: cur.v }; out.push(rc); if (GI.share) GI.share.fromRecord(S, rc); } }
      });
    });
    out.filter((x) => x.team === S.user).forEach(() => lp(6, 'Record book'));
    return out;
  };
  L.hofScore = function (s) {
    const c = s.career || {};
    const aw = s.awards || [];
    const n = (t) => aw.filter((x) => x.endsWith(t)).length;
    return statScore(c) * 0.55 + n('MVP') * 60 + (n('OPOY') + n('DPOY')) * 30 + n('ROY') * 12 + n('All-Iron') * 14 + (s.rings || 0) * 18 + (c.seasons || 0) * 4;
  };
  L.HOF_LINE = 330;
  // a star hangs up the cleats: Hall of Fame? a future coach?
  L.onRetire = function (S, s, team) {
    const out = {};
    const score = L.hofScore(s);
    const teams = Array.from(new Set((s.formerTeams || []).map((f) => f.team).concat([team])));
    if (score >= L.HOF_LINE) {
      const e = { year: S.year, name: s.name, pos: s.pos, team, teams, score: Math.round(score), career: s.career, awards: s.awards || [], rings: s.rings || 0, line: statLine(s.career || {}) };
      S.hof.unshift(e);
      out.hof = e;
      if (GI.legacy) { GI.legacy.addHof(Object.assign({ fid: S.fid, tname: T(team).name }, e)); GI.legacy.collect([L.sticker(S, s, team)], 'Hall of Fame'); }
      if (team === S.user) lp(10, 'Hall of Famer');
    }
    const coachy = (s.traits || []).some((t) => t === 'leader' || t === 'mentor');
    if ((s.rating >= 78 || coachy) && R() < (coachy ? 0.7 : 0.35)) {
      const key = s.pos === 'KP' ? 'stc' : OFFP.includes(s.pos) ? 'oc' : 'dc';
      const c = L.newCoach(S, key, { name: s.name, rating: clamp(Math.round(54 + (s.rating - 70) * 0.7 + ri(-3, 6) + (coachy ? 5 : 0)), 52, 92), former: { pos: s.pos, teams, hof: !!out.hof } });
      c.hist.push({ team, key: 'player', from: S.year - (s.yrsPro || 5), to: S.year, how: 'retired' });
      S.coachPool.unshift(c);
      out.coach = c;
    }
    return out;
  };
  // coaching carousel + chemistry + heat cooling + dynasty
  L.offseasonLeague = function (S) {
    const news = [];
    for (let i = 0; i < 32; i++) {
      if (i === S.user) continue;
      const p = SN.pct(S.rec[i]), r = S.rosters[i];
      if (p < 0.34 && R() < 0.6) {
        const old = r.coaches.hc;
        let nu;
        const ocUp = r.coaches.oc.rating >= 76 && R() < 0.4;
        if (ocUp) { nu = r.coaches.oc; L.hire(S, i, 'oc', poolBest(S, 'oc'), 'promoted'); }
        else nu = poolBest(S, 'hc');
        L.hire(S, i, 'hc', nu, 'fired');
        news.push(`🪓 ${T(i).city} fire ${old.name}; ${nu.name} is the new head coach${ocUp ? ' (promoted from OC)' : ''}.`);
      } else if (p < 0.45 && R() < 0.35) {
        const k = S.rec[i].pf < S.rec[i].pa * 0.9 ? 'oc' : 'dc';
        const old = r.coaches[k], nu = poolBest(S, k);
        L.hire(S, i, k, nu, 'fired');
        news.push(`🔄 ${T(i).abbr} replace ${ROLE_SHORT[k]} ${old.name} with ${nu.name}.`);
      }
    }
    // hot coordinators get poached by other CPU teams
    for (let n = 0; n < 2; n++) {
      if (R() > 0.45) continue;
      const cands = [];
      for (let i = 0; i < 32; i++) if (i !== S.user) ['oc', 'dc'].forEach((k) => { const c = S.rosters[i].coaches[k]; if (c.rating >= 80) cands.push({ i, k, c }); });
      if (!cands.length) break;
      const x = pick(cands);
      const dest = pick([...Array(32).keys()].filter((j) => j !== S.user && j !== x.i));
      L.hire(S, x.i, x.k, poolBest(S, x.k), 'poached');
      const was = S.rosters[dest].coaches.hc;
      L.hire(S, dest, 'hc', x.c, 'fired');
      news.push(`🎩 ${T(dest).city} hire ${T(x.i).abbr} ${ROLE_SHORT[x.k]} ${x.c.name} as head coach (${was.name} out).`);
    }
    // QB-receiver chemistry builds every season they stay together
    for (let i = 0; i < 32; i++) {
      const r = S.rosters[i], qb = r.stars.find((s) => s.pos === 'QB');
      if (!qb) continue;
      const mates = r.stars.filter((s) => s.pos === 'WR' || s.pos === 'TE');
      const chem = {};
      mates.forEach((m) => (chem[m.id] = ((qb.chem || {})[m.id] || 0) + 1));
      qb.chem = chem;
      if (i === S.user) mates.forEach((m) => { if (chem[m.id] === 2) news.unshift(`🤝 DUO: ${GI.shortName(qb.name)} and ${GI.shortName(m.name)} have two seasons together. Their show-me plays hit more often now.`); });
    }
    // grudges cool off over the summer
    Object.keys(S.heat).forEach((a) => Object.keys(S.heat[a]).forEach((b) => (S.heat[a][b] = Math.round(S.heat[a][b] * 0.6))));
    // dynasty: winning titles makes the whole league come for you
    const recent = (S.history || []).slice(0, 3).filter((h) => h.champ === S.user && !h.fired).length;
    S.dynasty = recent;
    if (recent >= 2) news.unshift(`👑 DYNASTY WATCH: ${T(S.user).city} has ${recent} titles in three years. Rival front offices are spending big to catch up.`);
    S.cap = Math.round((S.cap || 38) + 2);
    return news;
  };
  L.bestIdentity = function (S, i) {
    const r = S.rosters[i];
    let best = null, bv = -1;
    Object.keys(GI.IDENTITIES).forEach((k) => {
      const id = GI.IDENTITIES[k];
      const v = r.stars.filter((s) => id.fit.includes(s.pos)).reduce((t, s) => t + s.rating, 0) + R() * 20;
      if (v > bv) { bv = v; best = k; }
    });
    return best;
  };

  // ================= press conference =================
  L.pressFor = function (S, G) {
    const u = G.user, us = G.score[u], them = G.score[GI.util.other(u)], m = us - them;
    const opp = G.teams[GI.util.other(u)];
    let trig = null;
    if (G.playoff) trig = m > 0 ? 'Playoff win' : 'Season over';
    else if (m >= 17) trig = 'Blowout win';
    else if (m <= -17) trig = 'Ugly loss';
    else if (G.rivalry && G.rivalry.hot) trig = 'Rivalry game';
    else if (m !== 0 && Math.abs(m) <= 3) trig = m > 0 ? 'Nail-biter' : 'Heartbreaker';
    else if ((S.rec[S.user].streak >= 2 && m > 0) || (S.rec[S.user].streak <= -2 && m < 0)) trig = m > 0 ? 'Winning streak' : 'Losing streak';
    if (!trig) return null;
    const win = m > 0;
    const hc = S.rosters[S.user].coaches.hc;
    const q = win
      ? { humble: `Credit to ${opp.city}. We just made a few more plays than they did.`, fiery: `We're coming for everybody. Put the whole league on notice.`, deflect: `Enjoy it tonight. Next week starts tomorrow morning.` }
      : { humble: `That's on me. I have to put these guys in better spots.`, fiery: G.playoff ? `We'll be back. Mark it down.` : `Write this down: we win next week. I guarantee it.`, deflect: `No excuses. We'll go to the tape and fix it.` };
    return {
      trig, coach: hc.name, win, opp: opp.idx, prompt: win ? `Reporters want your take on beating the ${opp.name}.` : `Tough questions after the loss to the ${opp.name}.`,
      choices: [
        { id: 'humble', label: 'Stay humble', quote: q.humble, desc: win ? '+2 morale, cools the rivalry' : '+3 morale: the coach takes the heat' },
        { id: 'fiery', label: 'Bring the fire', quote: q.fiery, desc: win ? `+4 hype, but ${opp.city} will be gunning for you` : G.playoff ? '+3 hype for next year' : 'Guarantee: win next week for +8 hype (lose and it’s −8)' },
        { id: 'deflect', label: 'Deflect', quote: q.deflect, desc: 'Keep it boring. +1 morale' },
      ],
    };
  };
  L.pressChoose = function (S, pc, id) {
    const c = pc.choices.find((x) => x.id === id);
    const pm = S.pressMods = S.pressMods || {};
    const add = (n) => (pm.morale = (pm.morale || 0) + n);
    if (id === 'humble') { add(pc.win ? 2 : 3); if (pc.win) addHeat(S, pc.opp, S.user, -8); }
    if (id === 'fiery') {
      if (pc.win) { S.hype = clamp(S.hype + 4, 0, 100); addHeat(S, pc.opp, S.user, 15); const egos = S.rosters[S.user].stars.filter((s) => s.ego > 70); egos.forEach((s) => ((pm.starMeter = pm.starMeter || {})[s.id] = 50)); }
      else if (pc.trig === 'Season over') S.hype = clamp(S.hype + 3, 0, 100);
      else { S.guarantee = true; add(3); }
    }
    if (id === 'deflect') add(1);
    S._quote = { coach: pc.coach, text: c.quote, tone: id, trig: pc.trig };
    SN.save(S);
  };

  // ================= free agency =================
  L.capRoom = (S, i) => r1((S.cap || 38) - SN.salaryTotal(S, i));
  L.faBoard = function (S) {
    return (S.freeAgents || []).filter((f) => f.age < 36).sort((a, b) => b.rating - a.rating).slice(0, 40).map((f) => {
      const ask = f.ask || (f.ask = SN.askSalary(f));
      let n = 0;
      for (let i = 0; i < 32; i++) if (i !== S.user && SN.slotFor(S, i, f.pos) === 'starter' && L.capRoom(S, i) >= ask * 0.9) n++;
      return { f, ask, interest: n >= 8 ? 3 : n >= 3 ? 2 : n ? 1 : 0 };
    });
  };
  L.faBonus = (salary, years) => r1(salary * 0.25 * years);
  L.offer = function (S, id, salary, years) {
    if (salary == null) { delete S.faOffers[id]; SN.save(S); return { ok: true }; }
    const f = S.freeAgents.find((x) => x.id === id);
    if (!f) return { ok: false, why: 'He already signed elsewhere' };
    if (!SN.slotFor(S, S.user, f.pos)) return { ok: false, why: `No roster room at ${GI.POS[f.pos].label}` };
    const committed = Object.keys(S.faOffers).filter((k) => k !== id).reduce((t, k) => t + S.faOffers[k].salary, 0);
    if (salary + committed > L.capRoom(S, S.user)) return { ok: false, why: `Over the cap (${SN.money(L.capRoom(S, S.user) - committed)} room left)` };
    const bonus = L.faBonus(salary, years);
    const bonuses = Object.keys(S.faOffers).filter((k) => k !== id).reduce((t, k) => t + L.faBonus(S.faOffers[k].salary, S.faOffers[k].years), 0);
    if (bonus + bonuses > S.cash) return { ok: false, why: `Signing bonuses would cost ${SN.money(bonus + bonuses)} — you have ${SN.money(S.cash)}` };
    S.faOffers[id] = { salary: r1(salary), years };
    SN.save(S);
    return { ok: true };
  };
  L.runFA = function (S) {
    const results = [];
    const fas = (S.freeAgents || []).filter((f) => f.age < 36).sort((a, b) => b.rating - a.rating);
    const lastPct = (i) => SN.pct((S.lastRec || S.rec)[i] || { w: 0, l: 0, t: 0 });
    fas.forEach((f) => {
      const ask = f.ask || SN.askSalary(f);
      const bids = [];
      const mine = S.faOffers[f.id];
      if (mine && SN.slotFor(S, S.user, f.pos) && L.capRoom(S, S.user) >= mine.salary && S.cash >= L.faBonus(mine.salary, mine.years)) bids.push({ team: S.user, salary: mine.salary, years: mine.years });
      const order = [...Array(32).keys()].filter((i) => i !== S.user).sort(() => R() - 0.5);
      order.forEach((i) => {
        if (bids.length >= 5) return;
        const slot = SN.slotFor(S, i, f.pos);
        if (!slot || L.capRoom(S, i) < ask * 0.85) return;
        const weakest = S.rosters[i].stars.filter((s) => s.pos === f.pos).reduce((m, s) => Math.min(m, s.rating), 99);
        const want = slot === 'starter' && (weakest === 99 || f.rating > weakest + 2);
        if (!want || R() > 0.3 + S.dynasty * 0.08 + (f.rating - 70) / 60) return;
        bids.push({ team: i, salary: r1(Math.min(L.capRoom(S, i), ask * (0.85 + R() * 0.35) * (1 + S.dynasty * 0.06))), years: ri(1, 3) });
      });
      if (!bids.length) return;
      const score = (b) => b.salary * (1 + (f.ego || 50) / 150) + (f.age >= 30 ? b.years * 0.8 : b.years * 0.2) + (b.team === S.user ? S.hype / 20 : 2) + lastPct(b.team) * 4 + (f.lastTeam === b.team && f.leftHow === 'cut' ? -4 : 0) + R() * 1.5;
      bids.sort((a, b) => score(b) - score(a));
      const w = bids[0];
      const p = Object.assign({}, f, { salary: w.salary });
      delete p.ask;
      if (f.lastTeam != null) p.formerTeams = (p.formerTeams || []).concat([{ team: f.lastTeam, how: f.leftHow || 'walked', year: S.year }]);
      const slot = SN._addToRoster(S, w.team, p, w.years);
      if (!slot) return;
      S.freeAgents = S.freeAgents.filter((x) => x.id !== f.id);
      if (w.team === S.user) { const b = L.faBonus(w.salary, w.years); S.cash -= b; S.fin.events += b; }
      results.push({ name: f.name, pos: f.pos, rating: f.rating, age: f.age, team: w.team, salary: w.salary, years: w.years, bids: bids.length, user: !!mine, won: w.team === S.user, top: mine ? bids.filter((b) => b.team !== S.user).sort((a, b) => b.salary - a.salary)[0] : null });
    });
    S.faOffers = {};
    S.faDone = true;
    SN.save(S);
    return results;
  };

  // ================= trades =================
  L.starValue = function (S, s) {
    const age = s.age || 27;
    let v = s.rating + Math.max(0, (s.pot || s.rating) - s.rating) * (age <= 24 ? 0.5 : age <= 27 ? 0.25 : 0.05) - Math.max(0, age - 29) * 2 - (s.contract ? s.contract.salary : 0) * 0.3;
    if ((s.traits || []).some((t) => t === 'leader' || t === 'biggame')) v += 1.5;
    if (s.pos === 'QB') v += 3;
    if (s.pos === 'KP') v -= 4;
    return v;
  };
  L.nextRounds = (S) => Math.min(8, 3 + S.year + (S.phase === 'offseason' || S.phase === 'draft' ? 0 : 1));
  L.ownedPicks = function (S, team) {
    const n = Math.min(8, 4 + S.year - (S.phase === 'draft' ? 1 : 0));
    const out = [];
    for (let i = 0; i < 32; i++) for (let r = 1; r <= n; r++) {
      const t = S.pickTrades.find((p) => p.round === r && p.orig === i);
      const owner = t ? t.owner : i;
      if (owner === team) out.push({ round: r, orig: i });
    }
    return out;
  };
  L.pickValue = function (S, p) {
    const base = [0, 76, 70, 66, 63, 61, 59, 58, 57][p.round] || 56;
    const pct = SN.pct(S.rec[p.orig]);
    return base + (p.round <= 2 ? (0.5 - pct) * 8 : 0);
  };
  function rosterAfter(S, team, outIds, inStars) {
    const r = S.rosters[team];
    const keep = SN.allStars(S, team).filter((s) => !outIds.includes(s.id)).concat(inStars);
    const starters = [], cnt = {};
    let bench = null, overflow = false;
    keep.sort((a, b) => b.rating - a.rating).forEach((s) => {
      if (starters.length < 8 && (cnt[s.pos] || 0) < SN.CAP[s.pos]) { starters.push(s); cnt[s.pos] = (cnt[s.pos] || 0) + 1; }
      else if (!bench) bench = s; else overflow = true;
    });
    return { starters, bench, overflow, missing: SN.REQUIRED.filter((p) => !starters.some((s) => s.pos === p)), salary: keep.reduce((t, s) => t + (s.contract && s.contract.active ? s.contract.salary : 0), 0), r };
  }
  L.tradeOpen = (S) => S.phase === 'offseason' || S.phase === 'camp' || (S.phase === 'regular' && S.week < Math.ceil(S.weeks / 2));
  L.evalTrade = function (S, partner, give, get) {
    const mine = SN.allStars(S, S.user), theirs = SN.allStars(S, partner);
    const gS = give.stars.map((id) => mine.find((s) => s.id === id)).filter(Boolean);
    const tS = get.stars.map((id) => theirs.find((s) => s.id === id)).filter(Boolean);
    if (!gS.length && !tS.length && !give.picks.length && !get.picks.length) return { ok: false, why: 'Pick players or picks to swap', ratio: 0 };
    const ua = rosterAfter(S, S.user, give.stars, tS), pa = rosterAfter(S, partner, get.stars, gS);
    if (S.rosters[S.user].v === 1) { ua.overflow = pa.overflow = false; ua.missing = pa.missing = []; }
    if (ua.overflow) return { ok: false, why: 'Not enough roster room on your side' };
    if (pa.overflow) return { ok: false, why: `${T(partner).city} doesn't have the roster room` };
    if (ua.missing.length) return { ok: false, why: `You'd have no ${ua.missing.map((p) => GI.POS[p].label).join('/')} star` };
    if (pa.missing.length) return { ok: false, why: `They won't give up their only ${pa.missing.map((p) => GI.POS[p].label).join('/')}` };
    if (ua.salary > (S.cap || 38)) return { ok: false, why: `You'd be over the ${SN.money(S.cap)} cap` };
    if (pa.salary > (S.cap || 38)) return { ok: false, why: "That puts them over the cap" };
    const vin = gS.reduce((t, s) => t + L.starValue(S, s) + (S.rosters[partner].stars.some((x) => x.pos === s.pos) ? 0 : 4), 0) + give.picks.reduce((t, p) => t + L.pickValue(S, p) * 0.9, 0);
    const best = theirs.slice().sort((a, b) => b.rating - a.rating)[0];
    const vout = tS.reduce((t, s) => t + L.starValue(S, s) * (best && s.id === best.id ? 1.12 : 1), 0) + get.picks.reduce((t, p) => t + L.pickValue(S, p), 0);
    const need = vout * (1.05 + S.dynasty * 0.04) + (vout ? 0 : 0);
    const ratio = need ? vin / need : 2;
    const verdict = ratio >= 1.25 ? "They'd jump at it" : ratio >= 1 ? 'Deal!' : ratio >= 0.9 ? 'Close — sweeten it a little' : ratio >= 0.7 ? 'Not enough' : 'Not interested';
    return { ok: ratio >= 1, why: ratio >= 1 ? null : verdict, ratio, verdict, vin, vout };
  };
  L.doTrade = function (S, partner, give, get) {
    const ev = L.evalTrade(S, partner, give, get);
    if (!ev.ok) return ev;
    const mine = SN.allStars(S, S.user), theirs = SN.allStars(S, partner);
    const gS = give.stars.map((id) => mine.find((s) => s.id === id)), tS = get.stars.map((id) => theirs.find((s) => s.id === id));
    const place = (team, outIds, inStars) => {
      if (S.rosters[team].v === 1) { outIds.forEach((id) => SN.removeFromRoster(S, team, id)); inStars.forEach((c) => GI.dev.addCard(S, team, c)); GI.dev.fillLineup(S, team); return; }
      const a = rosterAfter(S, team, outIds, inStars);
      a.r.stars = a.starters; a.r.bench = a.bench;
      if (a.bench && a.bench.contract && !inStars.includes(a.bench)) { /* stays as it was */ }
    };
    gS.forEach((s) => { (s.formerTeams = s.formerTeams || []).push({ team: S.user, how: 'traded', year: S.year }); s.chem = {}; });
    tS.forEach((s) => { (s.formerTeams = s.formerTeams || []).push({ team: partner, how: 'traded', year: S.year }); s.chem = {}; });
    place(S.user, give.stars, tS); place(partner, get.stars, gS);
    // a starter's contract is always active
    S.rosters[S.user].stars.concat(S.rosters[partner].stars).forEach((s) => { if (s.contract) s.contract.active = true; });
    const movePick = (p, to) => {
      const t = S.pickTrades.find((x) => x.round === p.round && x.orig === p.orig);
      if (t) t.owner = to; else S.pickTrades.push({ round: p.round, orig: p.orig, owner: to });
    };
    give.picks.forEach((p) => movePick(p, partner));
    get.picks.forEach((p) => movePick(p, S.user));
    // locker-room fallout
    const notes = [];
    tS.filter((s) => s.ego > 75).forEach((s) => { S.pressMods = S.pressMods || {}; S.pressMods.morale = (S.pressMods.morale || 0) - 3; notes.push(`The locker room is wary of ${GI.shortName(s.name)}'s ego (−3 morale next game).`); });
    const qb = S.rosters[S.user].stars.find((s) => s.pos === 'QB');
    if (gS.some((s) => s.pos === 'QB' || (qb && (qb.chem || {})[s.id] >= 2))) notes.push('That broke up a QB duo. Chemistry starts over.');
    const desc = `${T(S.user).abbr} send ${gS.map((s) => GI.POS[s.pos].label + ' ' + s.name).concat(give.picks.map((p) => `a round ${p.round} pick`)).join(', ') || 'nothing'} to ${T(partner).city} for ${tS.map((s) => GI.POS[s.pos].label + ' ' + s.name).concat(get.picks.map((p) => `a round ${p.round} pick`)).join(', ') || 'nothing'}.`;
    (S.leagueNews = S.leagueNews || []).unshift(`🔁 TRADE: ${desc}`);
    if (GI.legacy) GI.legacy.collect(tS.map((s) => L.sticker(S, s, S.user)));
    SN.save(S);
    return { ok: true, desc, notes };
  };
})();
