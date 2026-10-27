/* Grid Iron v1 — player cards: the 16-card starting lineup, three stats per position, tiers, Star Players.
   A card keeps the old "star" field names (rating, pos, age, pot, ego, clutch, dur, traits, contract…) so the
   franchise systems keep working; team.stars is simply every card in the lineup. */
(function () {
  const GI = window.GI;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // the lineup: 16 starting cards. The lines are one card each; one player kicks and punts.
  const SLOTS = ['QB', 'RB', 'WR', 'WR', 'WR', 'TE', 'OL', 'DL', 'LB', 'LB', 'LB', 'CB', 'CB', 'S', 'S', 'KP'];
  const STATS = {
    QB: [['arm', 'Arm'], ['acc', 'Accuracy'], ['poise', 'Poise']],
    RB: [['spd', 'Speed'], ['pow', 'Power'], ['hands', 'Hands']],
    WR: [['spd', 'Speed'], ['hands', 'Hands'], ['route', 'Route running']],
    TE: [['block', 'Blocking'], ['hands', 'Hands'], ['str', 'Strength']],
    OL: [['pass', 'Pass block'], ['run', 'Run block'], ['disc', 'Discipline']],
    DL: [['rush', 'Pass rush'], ['stop', 'Run stop'], ['power', 'Power']],
    LB: [['tackle', 'Tackling'], ['cover', 'Coverage'], ['blitz', 'Blitz']],
    CB: [['spd', 'Speed'], ['cover', 'Coverage'], ['ball', 'Ball skills']],
    S: [['range', 'Range'], ['tackle', 'Tackling'], ['ball', 'Ball skills']],
    KP: [['leg', 'Leg'], ['acc', 'Accuracy'], ['hang', 'Hang time']],
  };
  const TIERS = [
    { key: 'bronze', name: 'Bronze', min: 0 },
    { key: 'silver', name: 'Silver', min: 70 },
    { key: 'gold', name: 'Gold', min: 80 },
    { key: 'elite', name: 'Elite', min: 90 },
    { key: 'star', name: 'Star Player', min: 95 },
  ];
  const LINE_NAMES = {
    OL: ['The Hog Pen', 'Big Uglies', 'The Wall', 'Pancake House', 'Iron Five', 'The Moving Company', 'Trench Kings', 'Brick House', 'The Fortress', 'Steel Front'],
    DL: ['Steel Curtain', 'The Wrecking Crew', 'Sack Pack', 'Purple People Movers', 'The Hit Squad', 'Fearsome Four', 'Gridlock', 'The Avalanche', 'Night Train', 'Thunder Front'],
  };
  const ROLE_OF = { QB: ['QB'], RB: ['RB'], WR: ['WR1', 'WR2', 'WR3'], TE: ['TE'], OL: ['OL'], DL: ['DL'], LB: ['MLB', 'WLB', 'SLB'], CB: ['CB1', 'CB2'], S: ['FS', 'SS'], KP: ['K'] };
  // field roles that belong to a line unit
  const OL_ROLES = ['LT', 'LG', 'C', 'RG', 'RT'], DL_ROLES = ['DE1', 'DT1', 'DT2', 'DE2'];
  GI.unitRole = (role) => (OL_ROLES.includes(role) ? 'OL' : DL_ROLES.includes(role) ? 'DL' : role);

  const C = {
    SLOTS, STATS, TIERS, LINE_NAMES, ROLE_OF, OL_ROLES, DL_ROLES,
    // overall from the three stats: the first counts a little more
    ovrOf(stats, pos) {
      const k = STATS[pos].map((x) => x[0]);
      return Math.round(stats[k[0]] * 0.4 + stats[k[1]] * 0.35 + stats[k[2]] * 0.25);
    },
    tierOf(ovr) { let t = TIERS[0]; TIERS.forEach((x) => { if (ovr >= x.min) t = x; }); return t; },
    isStar: (c) => (c.rating || 0) >= 95,
    // recompute everything derived from the stats
    refresh(card) {
      card.rating = C.ovrOf(card.stats, card.pos);
      card.tier = C.tierOf(card.rating).key;
      card.star = card.rating >= 95;
      return card;
    },
    // stats spread around a target overall; shape varies so two 75s aren't identical
    rollStats(pos, ovr, rnd) {
      const R = rnd || Math.random;
      const out = {};
      const keys = STATS[pos].map((x) => x[0]);
      const tilt = keys.map(() => (R() - 0.5) * 12);
      const mean = tilt.reduce((s, x) => s + x, 0) / 3;
      keys.forEach((k, i) => (out[k] = clamp(Math.round(ovr + tilt[i] - mean), 35, 99)));
      // nudge back onto the target overall after rounding and clamping
      for (let n = 0; n < 6; n++) {
        const d = ovr - C.ovrOf(out, pos);
        if (!d) break;
        keys.forEach((k) => (out[k] = clamp(out[k] + Math.sign(d), 35, 99)));
      }
      return out;
    },
    make(pos, ovr, o) {
      o = o || {};
      const R = o.rnd || Math.random;
      const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
      const pick = (a) => a[Math.floor(R() * a.length)];
      const line = pos === 'OL' || pos === 'DL';
      const age = o.age != null ? o.age : ri(22, 31);
      const card = {
        id: o.id || 'c' + Math.floor(R() * 1e9).toString(36),
        pos, unit: line,
        name: o.name || (line ? pick(LINE_NAMES[pos]) : pick(GI.FIRST) + ' ' + pick(GI.LAST)),
        num: line ? null : o.num != null ? o.num : ri(GI.NUMS[pos][0], GI.NUMS[pos][1]),
        age, stats: C.rollStats(pos, ovr, R),
        pot: 0, xp: 0, meter: ri(15, 45), armed: false, injured: false,
        clutch: ri(45, 95), dur: ri(45, 95), ego: line ? ri(5, 30) : ri(10, 90), traits: [],
      };
      C.refresh(card);
      // potential: young players have room to grow, veterans are close to their peak
      const room = age <= 23 ? ri(8, 20) : age <= 26 ? ri(4, 12) : age <= 29 ? ri(0, 5) : 0;
      card.pot = clamp(card.rating + room, card.rating, 99);
      if (!line) {
        const tr = R();
        if (tr < 0.35) card.traits.push(pick(GI.TRAIT_KEYS));
      }
      return card;
    },
    // team units from the cards in the lineup (injured cards → their backup, or a replacement-level fill-in)
    units(team) {
      const by = {};
      const cards = team.stars || [];
      const val = (c, k) => (c.stats && c.stats[k] != null ? c.stats[k] : c.rating);
      const sub = (pos) => {
        const b = (team.benchList || []).filter((x) => x.pos === pos && !x.injured).sort((a, z) => z.rating - a.rating)[0];
        return b || null;
      };
      SLOTS.forEach((p) => (by[p] = by[p] || []));
      cards.forEach((c) => {
        if (!by[c.pos]) return;
        if (c.injured) {
          const b = sub(c.pos);
          by[c.pos].push(b ? Object.assign({}, b, { hurt: true }) : { pos: c.pos, rating: Math.max(45, c.rating - 12), stats: null });
        } else by[c.pos].push(c);
      });
      // a missing slot plays a replacement-level body
      const need = {}; SLOTS.forEach((p) => (need[p] = (need[p] || 0) + 1));
      Object.keys(need).forEach((p) => { while (by[p].length < need[p]) by[p].push({ pos: p, rating: 55, stats: null }); });
      const avg = (p, k) => { const l = by[p]; return l.reduce((s, c) => s + (k ? val(c, k) : c.rating), 0) / l.length; };
      const QB = by.QB[0], RB = by.RB[0], TE = by.TE[0], OL = by.OL[0], DL = by.DL[0], KP = by.KP[0];
      const u = {
        pass: val(QB, 'arm') * 0.2 + val(QB, 'acc') * 0.22 + val(QB, 'poise') * 0.08 + avg('WR', 'hands') * 0.15 + avg('WR', 'route') * 0.1 + avg('WR', 'spd') * 0.05 + val(TE, 'hands') * 0.05 + val(OL, 'pass') * 0.15,
        run: val(RB, 'spd') * 0.2 + val(RB, 'pow') * 0.2 + val(OL, 'run') * 0.35 + val(TE, 'block') * 0.15 + val(QB, 'poise') * 0.1,
        ol: val(OL, 'pass') * 0.45 + val(OL, 'run') * 0.35 + val(OL, 'disc') * 0.2,
        passD: avg('CB', 'cover') * 0.25 + avg('CB', 'spd') * 0.1 + avg('S', 'range') * 0.15 + avg('S', 'ball') * 0.1 + avg('LB', 'cover') * 0.15 + val(DL, 'rush') * 0.15 + avg('CB', 'ball') * 0.1,
        runD: val(DL, 'stop') * 0.35 + val(DL, 'power') * 0.1 + avg('LB', 'tackle') * 0.35 + avg('S', 'tackle') * 0.2,
        rush: val(DL, 'rush') * 0.55 + val(DL, 'power') * 0.15 + avg('LB', 'blitz') * 0.3,
        st: val(KP, 'leg') * 0.4 + val(KP, 'acc') * 0.4 + val(KP, 'hang') * 0.2,
      };
      const c = team.coaches && team.coaches.stc;
      if (c) u.st += (c.rating - 70) / 6;
      for (const k in u) u[k] = Math.round(clamp(u[k], 35, 99));
      // team overall: the QB and both lines count most
      const W = { QB: 2, OL: 2, DL: 2, RB: 1, WR: 1.5, TE: 0.75, LB: 1.5, CB: 1.25, S: 1, KP: 0.5 };
      let s = 0, w = 0;
      for (const p in W) { s += avg(p) * W[p]; w += W[p]; }
      u.ovr = Math.round(s / w);
      return u;
    },
    // a full team of cards around a target overall (±6 per card, a standout or two)
    lineup(target, rnd, used) {
      const R = rnd || Math.random;
      const names = used || new Set(), nums = new Set();
      return SLOTS.map((pos, k) => {
        let ovr = target + Math.round((R() - 0.5) * 12);
        if (R() < 0.12) ovr += 6 + Math.floor(R() * 7); // the team's standout
        let nm;
        do { nm = GI.FIRST[Math.floor(R() * GI.FIRST.length)] + ' ' + GI.LAST[Math.floor(R() * GI.LAST.length)]; } while (names.has(nm));
        names.add(nm);
        let num = null;
        if (pos !== 'OL' && pos !== 'DL') { do { num = GI.NUMS[pos][0] + Math.floor(R() * (GI.NUMS[pos][1] - GI.NUMS[pos][0] + 1)); } while (nums.has(num)); nums.add(num); }
        return C.make(pos, clamp(ovr, 50, 94), { rnd: R, name: pos === 'OL' || pos === 'DL' ? null : nm, num, id: 't' + k + '_' + Math.floor(R() * 1e8).toString(36) });
      });
    },
    assignRoles(cards) {
      const use = {};
      cards.forEach((c) => {
        use[c.pos] = use[c.pos] || 0;
        c.role = (ROLE_OF[c.pos] || [])[use[c.pos]++] || null;
      });
      return cards;
    },
    // keep stats and overall in step: anything that changes a card's rating (camp, aging, drafts) is
    // reflected in its stats, and players added without stats get them
    syncAll(S) {
      S.rosters.forEach((r) => (r.stars || []).concat(r.benchList || [], r.bench ? [r.bench] : []).forEach((c) => {
        if (!c || !c.pos || !STATS[c.pos]) return;
        if (!c.stats) c.stats = C.rollStats(c.pos, c.rating);
        for (let n = 0; n < 12; n++) {
          const d = (c.rating || 0) - C.ovrOf(c.stats, c.pos);
          if (!d) break;
          for (const k in c.stats) c.stats[k] = clamp(c.stats[k] + Math.sign(d), 35, 99);
        }
        c.tier = C.tierOf(c.rating).key; c.star = c.rating >= 95; c.unit = c.pos === 'OL' || c.pos === 'DL';
      }));
    },
    label(c) { return c.unit ? `${GI.POS[c.pos].label} · ${c.name}` : c.name; },
    STAT_LABEL(pos, k) { const s = STATS[pos].find((x) => x[0] === k); return s ? s[1] : k; },
  };
  GI.cards = C;
})();
