/* Grid Iron v1 — effective rating: talent first, then the things that nudge it.
   Every game works out, for each side, a list of modifiers in rating points. The gap between the two
   effective ratings is what the play engine feeds on (see GI.BAL in sim.js). */
(function () {
  const GI = window.GI;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const other = (s) => (s === 'home' ? 'away' : 'home');

  // what weather a team is used to, from its home building
  GI.climateGroup = function (idx) {
    const v = GI.STADIUMS && GI.STADIUMS[idx];
    if (!v) return 'mild';
    if (v.roof === 'dome') return 'dome';
    if (v.climate === 'hot' || v.climate === 'desert' || v.climate === 'tropical') return 'warm';
    if (v.climate === 'cold' || v.climate === 'alpine' || v.climate === 'windy') return 'cold';
    return 'mild';
  };
  // rating points lost by a team of `group` playing in `weather`
  const CLIMATE = {
    snow: { warm: -3, dome: -2, mild: -1, cold: 0 },
    wind: { warm: -1, dome: -1, mild: 0, cold: 0 },
    rain: { warm: 0, dome: -1, mild: 0, cold: 0 },
    heat: { warm: 0, dome: -1, mild: -1, cold: -2 },
  };
  const WX_WORD = { snow: 'in the snow', wind: 'in the wind', rain: 'in the rain', heat: 'in the heat' };
  const GROUP_WORD = { warm: 'Warm-weather team', dome: 'Dome team', mild: 'Mild-climate team', cold: 'Cold-weather team' };

  // the modifiers that are fixed for the whole game (coaches, climate, venue, home field)
  GI.effMods = function (G, side) {
    const t = G.teams[side], o = G.teams[other(side)];
    const mods = [];
    const add = (label, v, scope) => { v = Math.round(v * 2) / 2; if (v) mods.push({ label, v, scope: scope || 'all' }); };
    const c = t.coaches, oc = o.coaches;
    const cd = (a, b) => clamp((a - b) / 10, -2, 2);
    add(`Head coach ${c.hc.name.split(' ').pop()}`, cd(c.hc.rating, oc.hc.rating), 'all');
    add(`OC vs their DC`, cd(c.oc.rating, oc.dc.rating), 'off');
    add(`DC vs their OC`, cd(c.dc.rating, oc.oc.rating), 'def');
    add(`Special teams coach`, cd(c.stc.rating, oc.stc.rating), 'st');
    // climate fit: home teams are used to their own weather
    const V = G.venue || {};
    const atHome = !G.neutral && V.idx === t.idx;
    const grp = GI.climateGroup(t.idx);
    const cl = CLIMATE[G.weather];
    if (cl && !atHome && cl[grp]) add(`${GROUP_WORD[grp]} ${WX_WORD[G.weather]}`, cl[grp], 'all');
    // thin air wears visitors down
    if (V.climate === 'alpine' && V.roof === 'open' && !atHome && !G.neutral) add('Thin air', -1, 'all');
    // home field: the building, the crowd, a rivalry
    if (atHome) {
      let h = 1;
      if (G.crowd && G.crowd.level >= 75) h += 1;
      if (G.rivalry && G.rivalry.hot) h += 1;
      add(V.roof === 'dome' ? 'Home field (dome noise)' : 'Home field', h, 'all');
    }
    // fast teams like fast tracks
    const fast = t.identity === 'air' || t.identity === 'west';
    if (fast && V.surface && V.surface !== 'grass') add('Speed team on turf', 1, 'off');
    return mods;
  };
  // the full picture for one side, right now (morale moves during the game)
  GI.effRating = function (G, side) {
    const t = G.teams[side];
    const base = GI.ratings(t);
    if (!G.effMods) G.effMods = { home: GI.effMods(G, 'home'), away: GI.effMods(G, 'away') };
    const mods = G.effMods[side].slice();
    const md = G.morale ? clamp((G.morale[side] - G.morale[other(side)]) / 15, -2, 2) : 0;
    if (Math.abs(md) >= 0.5) mods.push({ label: md > 0 ? 'Locker room fired up' : 'Locker room rattled', v: Math.round(md * 2) / 2, scope: 'all' });
    const sum = (scope) => mods.filter((m) => m.scope === 'all' || m.scope === scope).reduce((s, m) => s + m.v, 0);
    const d = { off: sum('off'), def: sum('def'), st: sum('st') };
    const all = mods.filter((m) => m.scope === 'all').reduce((s, m) => s + m.v, 0) + mods.filter((m) => m.scope !== 'all').reduce((s, m) => s + m.v / 2, 0);
    return { base: base.ovr, units: base, mods, d, eff: Math.round(base.ovr + all) };
  };
  // the measured win curve (GI.BAL), for showing odds before kickoff
  const CURVE = [[0, 50], [5, 72], [10, 79], [15, 84], [20, 88], [25, 91], [40, 96]];
  GI.winOdds = function (gap) {
    const g = Math.abs(gap);
    let p = 96;
    for (let i = 1; i < CURVE.length; i++) if (g <= CURVE[i][0]) { const [x0, y0] = CURVE[i - 1], [x1, y1] = CURVE[i]; p = y0 + (y1 - y0) * (g - x0) / (x1 - x0); break; }
    return Math.round(gap >= 0 ? p : 100 - p);
  };
})();
