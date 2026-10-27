/* Grid Iron v1 — player development: XP from games, weekly practice, spring training growth, aging,
   archetypes, and keeping every lineup full (bench promotions, undrafted fill-ins). */
(function () {
  const GI = window.GI;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const R = Math.random;
  const C = () => GI.cards;
  const XP_PER_LEVEL = 100;
  const BENCH_MAX = 5;

  // archetypes: what kind of player the card's stat shape says he is
  const ARCH = {
    QB: { arm: 'Gunslinger', acc: 'Field General', poise: 'Ice Veins' },
    RB: { spd: 'Home-Run Hitter', pow: 'Bruiser', hands: 'Third-Down Back' },
    WR: { spd: 'Deep Threat', hands: 'Possession', route: 'Technician' },
    TE: { block: 'Road Grader', hands: 'Safety Valve', str: 'Seam Bully' },
    OL: { pass: 'Pass Protectors', run: 'Road Graders', disc: 'Clean Technicians' },
    DL: { rush: 'Pass Rushers', stop: 'Run Stuffers', power: 'Bull Rushers' },
    LB: { tackle: 'Thumper', cover: 'Coverage Backer', blitz: 'Edge Hunter' },
    CB: { spd: 'Burner', cover: 'Shutdown', ball: 'Ballhawk' },
    S: { range: 'Center Fielder', tackle: 'Enforcer', ball: 'Ballhawk' },
    KP: { leg: 'Big Leg', acc: 'Mr. Reliable', hang: 'Hang-Time Artist' },
  };
  function archetype(c) {
    if (!c || !c.stats || !ARCH[c.pos]) return '';
    let best = null;
    for (const k in c.stats) if (!best || c.stats[k] > c.stats[best]) best = k;
    const vals = Object.values(c.stats), spread = Math.max(...vals) - Math.min(...vals);
    if (spread <= 3) return 'Balanced';
    return ARCH[c.pos][best] || '';
  }

  // add overall points: one stat at a time, leaning on what the player already does best
  function growOvr(c, n) {
    if (!c.stats) return 0;
    const start = c.rating;
    const keys = Object.keys(c.stats);
    let guard = 0;
    while (c.rating < start + n && guard++ < 40) {
      const w = keys.map((k) => (c.stats[k] >= 99 ? 0 : 1 + (c.stats[k] - 50) / 25));
      let x = R() * w.reduce((a, b) => a + b, 0), pick = keys[0];
      for (let i = 0; i < keys.length; i++) { x -= w[i]; if (x <= 0) { pick = keys[i]; break; } }
      if (c.stats[pick] >= 99) break;
      c.stats[pick]++;
      C().refresh(c);
    }
    return c.rating - start;
  }
  function declineOvr(c, n) {
    if (!c.stats) return 0;
    const start = c.rating;
    const keys = Object.keys(c.stats);
    let guard = 0;
    while (c.rating > start - n && guard++ < 40) {
      const k = keys[Math.floor(R() * keys.length)];
      if (c.stats[k] <= 35) continue;
      c.stats[k]--;
      C().refresh(c);
    }
    return c.rating - start;
  }
  // XP → levels. A level is +1 overall, up to the player's potential; the climb gets steeper past 80
  const levelCost = (r) => Math.round(XP_PER_LEVEL * (1.4 + Math.max(0, r - 72) / 5));
  function gainXP(c, xp) {
    if (!c || !(xp > 0)) return 0;
    c.xp = (c.xp || 0) + Math.round(xp);
    let up = 0;
    while (c.xp >= levelCost(c.rating) && c.rating < (c.pot || 0)) { c.xp -= levelCost(c.rating); up += growOvr(c, 1); }
    if (c.rating >= (c.pot || 0)) c.xp = Math.min(c.xp, levelCost(c.rating) - 1); // maxed out: XP waits for a breakthrough
    return up;
  }
  // XP a card earns from one game (production + snaps), scaled by age, coaching and the gym
  function gameXP(c, r, ctx) {
    let x = 8;
    if (r) {
      x += (r.pyd || 0) / 40 + (r.ptd || 0) * 3 + (r.ryd || 0) / 14 + (r.rtd || 0) * 3 + (r.recyd || 0) / 14 + (r.rectd || 0) * 3;
      x += (r.sk || 0) * 4 + (r.dint || 0) * 5 + (r.tkl || 0) * 0.7 + (r.fgm || 0) * 2 + (r.sm || 0) * 4;
    }
    if (c.pos === 'OL') x += Math.max(0, (ctx.rushYds || 0) / 12 - (ctx.sacks || 0) * 2);
    if (c.pos === 'DL' && !r) x += (ctx.sacksBy || 0) * 4;
    if (ctx.win) x += 5;
    x *= c.age <= 23 ? 1.35 : c.age <= 26 ? 1.15 : c.age <= 29 ? 0.9 : 0.6;
    x *= 1 + ((ctx.hc || 70) - 70) / 120 + ((ctx.gym || 1) - 1) * 0.07;
    return Math.max(0, Math.round(x));
  }

  // after every franchise game: both teams' cards earn XP
  function afterGame(S, g, G) {
    if (!S || !G || !G.teams) return;
    ['home', 'away'].forEach((side) => {
      const ti = G.teams[side].idx, r = S.rosters[ti];
      if (!r || r.v !== 1) return;
      const st = G.stats[side] || {}, opp = G.stats[side === 'home' ? 'away' : 'home'] || {};
      const ctx = { win: G.score[side] > G.score[side === 'home' ? 'away' : 'home'], rushYds: st.rush, sacks: opp.sacks, sacksBy: st.sacks, hc: r.coaches.hc.rating, gym: ti === S.user ? S.up.gym : 2 };
      r.stars.forEach((c) => {
        if ((S.inj[c.id] || 0) > 0) return;
        const before = c.rating;
        gainXP(c, gameXP(c, G.ps && G.ps[c.id], ctx));
        if (ti === S.user && c.rating > before) (S._levelUps = S._levelUps || []).push({ id: c.id, name: c.name, pos: c.pos, d: c.rating - before, rating: c.rating });
      });
    });
  }

  // ---------- weekly practice ----------
  const PRACTICE = {
    fund: { name: 'Fundamentals', desc: '+9 XP for every starter' },
    film: { name: 'Film study', desc: '+1 effective rating in the next game' },
    recovery: { name: 'Recovery', desc: 'Injured players heal a week faster' },
  };
  const REPS = 3, REP_XP = 40;
  function practiceWeek(S) {
    const out = [];
    for (let i = 0; i < 32; i++) {
      const r = S.rosters[i];
      if (!r || r.v !== 1) continue;
      if (i !== S.user) { r.stars.forEach((c) => gainXP(c, 6)); continue; } // CPU teams run a standard week
      const p = S.practice || { focus: 'fund', reps: [] };
      const lineup = r.stars.concat(r.benchList || []);
      if (p.focus === 'fund') r.stars.forEach((c) => { if (!(S.inj[c.id] > 0)) gainXP(c, 9); });
      (p.reps || []).slice(0, REPS).forEach((id) => {
        const c = lineup.find((x) => x.id === id);
        if (!c || S.inj[c.id] > 0) return;
        const before = c.rating;
        gainXP(c, REP_XP * (c.age <= 25 ? 1.2 : 1));
        // investment builds "spark": the odds of a breakthrough that raises his ceiling
        if (canBreak(c)) c.spark = Math.min(SPARK_MAX, (c.spark || 0.04) + SPARK_REP);
        c.invest = (c.invest || 0) + 1;
        // now and then the work shows up all at once
        if (canBreak(c) && R() < (c.spark || 0) * 0.01) {
          const b0 = c.rating, j = breakthrough(c, 1);
          if (j) (S._breaks = S._breaks || []).push({ name: c.name, pos: c.pos, jump: c.rating - b0, rating: c.rating });
        }
        if (c.rating > before) out.push({ name: c.name, pos: c.pos, d: c.rating - before, rating: c.rating });
      });
      if (p.focus === 'recovery') Object.keys(S.inj).forEach((id) => { if (lineup.some((c) => c.id === id) && S.inj[id] > 1) S.inj[id]--; });
    }
    return out;
  }

  // ---------- spring training ----------
  function campGrowth(c, o) {
    const age = c.age;
    let g = age <= 23 ? 1.5 + (R() - 0.5) * 3 : age <= 26 ? 0.5 + (R() - 0.5) * 2.5 : age <= 28 ? -0.5 + (R() - 0.5) * 2 : age <= 30 ? -1.5 + (R() - 0.5) * 2 : -3 + (R() - 0.5) * 3;
    if (c.rating >= 88) g -= (c.rating - 87) * 0.3; // the last few points are the hardest
    g += ((o.gym || 1) - 1) * 0.4 + (o.bonus || 0);
    if ((c.traits || []).includes('gymrat')) g += 1.2;
    const n = Math.round(g);
    if (n > 0) { const room = Math.max(0, (c.pot || c.rating) - c.rating); return growOvr(c, Math.min(n, room)); }
    if (n < 0) return declineOvr(c, -n);
    return 0;
  }
  // the breakthrough: young players can suddenly arrive. The ones you've invested in arrive further.
  const SPARK_REP = 0.005, SPARK_MAX = 0.3;
  const canBreak = (c) => c.age <= 26 || (c.yrsPro || 0) <= 3;
  function breakthrough(c, chance) {
    if (!canBreak(c)) return 0;
    if (R() >= chance) return 0;
    const jump = 4 + Math.floor(R() * 5);
    const lift = 1 + Math.round(Math.min(SPARK_MAX, c.spark || 0) * 6) + Math.min(2, Math.floor((c.invest || 0) / 15)); // reps raise the new ceiling
    c.pot = Math.min(99, Math.max(c.pot || 0, c.rating + jump + lift));
    c.spark = Math.max(0.03, (c.spark || 0) * 0.3);
    c.breaks = (c.breaks || 0) + 1;
    return growOvr(c, jump);
  }
  // offseason aging (called once per player per year, after the age bump)
  function ageDecline(c) {
    if (c.age >= 33) return declineOvr(c, 2 + Math.floor(R() * 3));
    if (c.age >= 30) return declineOvr(c, 1 + Math.floor(R() * 2));
    return 0;
  }

  // keeps the league from inflating year over year: when the average starter climbs above the target,
  // veterans (27+) age a little harder that offseason. Same rule for every team, yours included.
  function anchorLeague(S, target) {
    target = target || 71;
    const all = [];
    S.rosters.forEach((r) => r.stars.forEach((c) => all.push(c)));
    const mean = all.reduce((t, c) => t + c.rating, 0) / Math.max(1, all.length);
    const over = mean - target;
    if (over <= 0) return 0;
    const vets = all.filter((c) => c.age >= 27);
    const per = (over * all.length) / Math.max(1, vets.length);
    vets.forEach((c) => { const n = Math.floor(per) + (R() < per % 1 ? 1 : 0); if (n > 0) declineOvr(c, n); });
    return over;
  }

  // ---------- keeping lineups full ----------
  function slotsNeeded() { const n = {}; C().SLOTS.forEach((p) => (n[p] = (n[p] || 0) + 1)); return n; }
  // add a card to a team: starter if there's a hole or he beats the weakest starter there, else bench
  function addCard(S, i, c) {
    const r = S.rosters[i];
    r.benchList = r.benchList || [];
    const need = slotsNeeded();
    const here = r.stars.filter((x) => x.pos === c.pos);
    let slot = 'bench';
    if (here.length < need[c.pos]) { r.stars.push(c); slot = 'starter'; }
    else {
      const worst = here.slice().sort((a, b) => a.rating - b.rating)[0];
      if (worst && c.rating > worst.rating) { r.stars = r.stars.filter((x) => x.id !== worst.id).concat([c]); r.benchList.push(worst); slot = 'starter'; }
      else r.benchList.push(c);
    }
    trimBench(S, i);
    return slot;
  }
  function trimBench(S, i) {
    const r = S.rosters[i];
    while ((r.benchList || []).length > BENCH_MAX) {
      const cut = r.benchList.slice().sort((a, b) => a.rating - b.rating)[0];
      r.benchList = r.benchList.filter((x) => x.id !== cut.id);
      S.freeAgents.push(Object.assign({}, cut, { contract: null, lastTeam: i, leftHow: 'cut', ask: GI.season.askSalary(cut) }));
    }
  }
  // fill every hole: promote the best healthy bench player, else sign a replacement-level body
  function fillLineup(S, i) {
    const r = S.rosters[i];
    if (!r || r.v !== 1) return [];
    r.benchList = r.benchList || [];
    const need = slotsNeeded(), out = [];
    Object.keys(need).forEach((pos) => {
      while (r.stars.filter((x) => x.pos === pos).length < need[pos]) {
        const b = r.benchList.filter((x) => x.pos === pos).sort((a, z) => z.rating - a.rating)[0];
        if (b) { r.benchList = r.benchList.filter((x) => x.id !== b.id); r.stars.push(b); out.push({ promoted: b }); continue; }
        const c = C().make(pos, 54 + Math.floor(R() * 7), { age: 22 + Math.floor(R() * 4) });
        c.id = 'p' + (S.nextId++);
        Object.assign(c, { college: GI.COLLEGES[Math.floor(R() * GI.COLLEGES.length)], yrsPro: 0, rookie: true, career: { seasons: 0, gp: 0 }, formerTeams: [], awards: [], spark: 0.06, joined: S.year });
        delete c.meter; delete c.armed; delete c.injured;
        c.contract = { years: 1, salary: 0.6, active: true };
        r.stars.push(c); out.push({ signed: c });
      }
    });
    GI.cards.assignRoles(r.stars);
    return out;
  }
  function fillAll(S) { for (let i = 0; i < 32; i++) fillLineup(S, i); }

  GI.dev = { levelCost, anchorLeague, XP_PER_LEVEL, BENCH_MAX, PRACTICE, REPS, REP_XP, ARCH, archetype, growOvr, declineOvr, gainXP, gameXP, afterGame, practiceWeek, campGrowth, breakthrough, canBreak, SPARK_REP, SPARK_MAX, ageDecline, addCard, trimBench, fillLineup, fillAll };
})();
