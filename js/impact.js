/* Grid Iron v1 — Impact Cards and team captains.
   An Impact Card belongs to a player (it leaves with him). Players rated 80+ earn one; so do the two team
   captains, whatever their rating. Bring up to 5 into a game. Each card fires 3 times a game, on a snap where
   that player is involved, and raises the chance the play succeeds: Bronze +5%, Silver +10%, Gold +15%, Elite +20%.
   How high a card can go is capped by the player's rating; a captain's cap is one tier higher. */
(function () {
  const GI = window.GI;
  const R = Math.random;
  const TIERS = [null,
    { key: 'bronze', name: 'Bronze', pct: 5 },
    { key: 'silver', name: 'Silver', pct: 10 },
    { key: 'gold', name: 'Gold', pct: 15 },
    { key: 'elite', name: 'Elite', pct: 20 },
  ];
  // play-engine advantage per tier, measured so the success rate on those snaps rises by about that % (48% → 53% at Silver)
  const A = [0, 0.25, 0.5, 0.72, 0.95];
  const COST = [0, 0, 4, 8, 14]; // Impact Points to reach each tier (Bronze is earned, not bought)
  const USES = 3, SLOTS = 5, MIN_RATING = 80;
  const OFF = ['QB', 'RB', 'WR', 'TE', 'OL'], DEF = ['DL', 'LB', 'CB', 'S'];
  const sideOf = (pos) => (OFF.includes(pos) ? 'o' : DEF.includes(pos) ? 'd' : null);
  // what each position's card does, in words
  const MOVE = {
    QB: 'Field General', RB: 'Second Effort', WR: 'High Point', TE: 'Safety Valve', OL: 'Moving Wall',
    DL: 'Pocket Crusher', LB: 'Run and Hit', CB: 'Blanket', S: 'Ball Hawk',
  };
  const FITS = {
    QB: ['short', 'long', 'trick'], RB: ['in_run', 'out_run', 'trick'], WR: ['short', 'long', 'trick'], TE: ['short', 'in_run', 'out_run'], OL: ['in_run', 'out_run', 'long'],
    DL: ['in_run', 'out_run', 'long'], LB: ['in_run', 'out_run', 'short'], CB: ['short', 'long', 'trick'], S: ['long', 'trick', 'out_run'],
  };
  const FIT_WORD = { QB: 'pass plays', RB: 'runs and gadgets', WR: 'pass plays', TE: 'short passes and runs', OL: 'runs and deep drops', DL: 'runs and deep drops', LB: 'runs and short passes', CB: 'pass plays', S: 'deep shots, gadgets and outside runs' };

  const band = (r) => (r >= 90 ? 4 : r >= 80 ? 3 : r >= 70 ? 2 : 1);
  const isCaptain = (team, c) => !!(team && team.captains && c && (team.captains.o === c.id || team.captains.d === c.id));
  const cap = (team, c) => Math.min(4, band(c.rating) + (isCaptain(team, c) ? 1 : 0));
  const eligible = (team, c) => !!sideOf(c.pos) && (c.rating >= MIN_RATING || isCaptain(team, c));
  const tierOf = (team, c) => (eligible(team, c) ? Math.min(c.imp || 0, cap(team, c)) : 0);
  const pool = (team) => (team.stars || []).concat(team.benchList || []);

  // captains: leaders first, then the best veteran on each side
  function captainScore(c) { return c.rating + ((c.traits || []).includes('leader') ? 15 : 0) + Math.min(6, (c.yrsPro || Math.max(0, (c.age || 24) - 22))) - (c.ego || 30) / 20; }
  function autoCaptains(team, keep) {
    team.captains = team.captains || {};
    ['o', 'd'].forEach((sd) => {
      const list = (team.stars || []).filter((c) => sideOf(c.pos) === sd && !c.unit);
      if (keep && list.some((c) => c.id === team.captains[sd])) return;
      const best = list.sort((a, b) => captainScore(b) - captainScore(a))[0];
      team.captains[sd] = best ? best.id : null;
    });
    return team.captains;
  }
  // every eligible player holds at least a Bronze card; returns the ones that just earned it
  function grant(team) {
    const fresh = [];
    pool(team).forEach((c) => { if (eligible(team, c) && !c.imp) { c.imp = 1; fresh.push(c); } });
    return fresh;
  }
  // the five cards that travel: kept from the user's picks, filled with the best of the rest
  function slots(team) {
    const all = (team.stars || []).filter((c) => tierOf(team, c) > 0); // only starters travel
    const keep = (team.impSlots || []).filter((id) => all.some((c) => c.id === id));
    const rest = all.filter((c) => !keep.includes(c.id)).sort((a, b) => tierOf(team, b) - tierOf(team, a) || b.rating - a.rating);
    team.impSlots = keep.concat(rest.map((c) => c.id)).slice(0, SLOTS);
    return team.impSlots.map((id) => all.find((c) => c.id === id));
  }
  // CPU teams: captains plus upgrades that track the team's quality and a little luck
  // steps: how many upgrade rolls each card gets (a new team gets a full build; a season adds one)
  function autoTeam(team, rnd, steps) {
    const r = rnd || R;
    autoCaptains(team, true);
    grant(team);
    const q = Math.max(0, Math.min(1, ((team.coaches ? team.coaches.hc.rating : 70) - 55) / 35));
    const n = steps == null ? 3 : steps;
    pool(team).forEach((c) => {
      if (!eligible(team, c)) return;
      const cp = cap(team, c);
      for (let k = 0; k < n; k++) if ((c.imp || 1) < cp && r() < 0.3 + q * 0.25) c.imp = (c.imp || 1) + 1;
    });
    slots(team);
    return team;
  }
  function upgradeCost(team, c) { const t = c.imp || 0; return t >= cap(team, c) || t >= 4 ? null : COST[t + 1]; }

  // ---------- in the game ----------
  function forGame(team) {
    if (!team || team.v !== 1) return [];
    return slots(team).filter((c) => c && !c.injured && team.stars.some((s) => s.id === c.id)).map((c) => ({
      id: c.id, name: c.name, pos: c.pos, num: c.num, side: sideOf(c.pos), tier: tierOf(team, c), left: USES, captain: isCaptain(team, c),
    }));
  }
  const fits = (card, off) => (FITS[card.pos] || []).includes(off);
  // the CPU saves its cards for downs that matter
  function cpuWants(G, side) {
    const diff = G.score[side] - G.score[side === 'home' ? 'away' : 'home'];
    const big = (G.down >= 3 && G.toGo >= 3) || G.ballOn >= 80 || (G.q >= 4 && Math.abs(diff) <= 8) || G.playoff;
    return big ? R() < 0.7 : R() < 0.08;
  }
  // called once per scrimmage snap; returns the advantage shift and what fired
  function onSnap(G, P, D, off) {
    if (!G.imp) return { a: 0, fired: [] };
    let a = 0;
    const fired = [];
    [[P, 'o', 1], [D, 'd', -1]].forEach(([side, sd, sign]) => {
      const list = (G.imp[side] || []).filter((c) => c.side === sd && c.left > 0 && c.tier > 0 && fits(c, off));
      if (!list.length) return;
      let card = null;
      if (side === G.user && !G.auto) card = list.find((c) => c.id === (G.impArm && G.impArm[side]));
      else if (cpuWants(G, side)) card = list.sort((x, y) => y.tier - x.tier)[0];
      if (!card) return;
      card.left--;
      if (G.impArm && G.impArm[side] === card.id) G.impArm[side] = null;
      a += sign * A[card.tier];
      fired.push({ side, id: card.id, name: card.name, pos: card.pos, num: card.num, tier: card.tier, captain: card.captain, left: card.left });
    });
    return { a, fired };
  }

  GI.impact = {
    TIERS, A, COST, USES, SLOTS, MIN_RATING, MOVE, FITS, FIT_WORD,
    sideOf, band, cap, eligible, tierOf, isCaptain, autoCaptains, grant, slots, autoTeam, upgradeCost, forGame, fits, onSnap,
    pctOf: (t) => (TIERS[t] ? TIERS[t].pct : 0),
    nameOf: (t) => (TIERS[t] ? TIERS[t].name : ''),
    keyOf: (t) => (TIERS[t] ? TIERS[t].key : 'none'),
  };
})();
