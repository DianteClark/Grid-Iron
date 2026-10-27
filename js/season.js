/* Grid Iron — season mode: schedule, standings, playoffs, Iron-Bowl, injuries, the weekly Gazette */
(function () {
  const GI = window.GI;
  const { ri, clamp, wpick } = GI.util;
  const R = Math.random;
  const pick = (a) => a[Math.floor(R() * a.length)];
  const KEY = 'gridiron_season_v1';
  const CONFS = ['Iron', 'Steel'];
  const DIVS = ['North', 'South', 'East', 'West'];
  const ROUND_NAMES = ['Wild Card Round', 'Divisional Round', 'Conference Championships', 'THE IRON-BOWL'];

  const confOf = (i) => (i < 16 ? 0 : 1);
  const divOf = (i) => Math.floor((i % 16) / 4);
  const T = (i) => GI.TEAMS[i];
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  const S_ = {
    CONFS, DIVS, ROUND_NAMES, confOf, divOf,
    load() { try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } },
    save(S) { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} },
    clear() { try { localStorage.removeItem(KEY); } catch (e) {} },
  };
  GI.season = S_;

  // ---------- new season ----------
  S_.create = function (o) {
    const S = {
      v: 1, user: o.user, year: o.year || 1, weeks: o.weeks || 12, week: 0, qMin: o.qMin || 5, diff: o.diff || 'pro',
      schedule: makeSchedule(o.weeks || 12), rec: Array.from({ length: 32 }, () => ({ w: 0, l: 0, t: 0, pf: 0, pa: 0, streak: 0 })),
      inj: {}, morale: Array(32).fill(0), mods: {}, news: [], paper: null, phase: 'regular', bracket: null,
      champion: null, history: o.history || [], seasonStats: { gp: 0, pf: 0, pa: 0, stars: {} },
    };
    S_.save(S);
    return S;
  };
  function makeSchedule(weeks) {
    // circle-method round robin over a shuffled order: no team repeats an opponent
    const order = shuffle([...Array(32).keys()]);
    const fixed = order[0], rot = order.slice(1);
    const rounds = [];
    for (let r = 0; r < 31; r++) {
      const ring = [fixed].concat(rot);
      const games = [];
      for (let i = 0; i < 16; i++) {
        const a = ring[i], b = ring[31 - i];
        const flip = (r + i) % 2 === 0;
        games.push({ h: flip ? a : b, a: flip ? b : a, hs: null, as: null, done: false });
      }
      rounds.push(games);
      rot.unshift(rot.pop());
    }
    // favour division rivals early-ish: just shuffle round order
    return shuffle(rounds).slice(0, weeks);
  }

  // ---------- helpers ----------
  S_.pct = (r) => { const g = r.w + r.l + r.t; return g ? (r.w + r.t * 0.5) / g : 0; };
  S_.recStr = (r) => `${r.w}-${r.l}${r.t ? '-' + r.t : ''}`;
  S_.sorted = function (S, ids) {
    return ids.slice().sort((x, y) => {
      const a = S.rec[x], b = S.rec[y];
      return S_.pct(b) - S_.pct(a) || (b.pf - b.pa) - (a.pf - a.pa) || b.pf - a.pf || x - y;
    });
  };
  S_.division = (i) => [...Array(32).keys()].filter((j) => confOf(j) === confOf(i) && divOf(j) === divOf(i));
  S_.divName = (i) => `${CONFS[confOf(i)]} ${DIVS[divOf(i)]}`;
  S_.place = function (S, i) {
    const d = S_.sorted(S, S_.division(i));
    return d.indexOf(i) + 1;
  };

  // the user's game this week (regular or playoff), or null
  S_.current = function (S) {
    if (S.phase === 'regular') {
      const games = S.schedule[S.week];
      const g = games.find((x) => x.h === S.user || x.a === S.user);
      return { label: `Week ${S.week + 1}`, game: g, home: g.h === S.user, opp: g.h === S.user ? g.a : g.h, playoff: false };
    }
    if (S.phase === 'playoffs') {
      const rd = S.bracket.rounds[S.bracket.round] || [];
      const g = rd.find((x) => x.h === S.user || x.a === S.user);
      if (!g) return { label: ROUND_NAMES[S.bracket.round], game: null, playoff: true };
      return { label: ROUND_NAMES[S.bracket.round], game: g, home: g.h === S.user, opp: g.h === S.user ? g.a : g.h, playoff: true, ironBowl: S.bracket.round === 3 };
    }
    return null;
  };
  S_.injuredIds = (S) => Object.keys(S.inj).filter((k) => S.inj[k] > 0);
  S_.injuredFor = function (S, teamIdx) {
    const t = T(teamIdx);
    return t.stars.filter((s) => S.inj[s.id] > 0).map((s) => ({ s, weeks: S.inj[s.id] }));
  };

  // options for GI.newGame for the user's current matchup
  S_.gameOptions = function (S) {
    const c = S_.current(S);
    const m = S.mods || {};
    const homeIdx = c.home ? S.user : c.opp;
    const userSide = c.home ? 'home' : 'away';
    const morale = { home: S.morale[homeIdx] || 0, away: S.morale[c.home ? c.opp : S.user] || 0 };
    if (m.morale) morale[userSide] += m.morale;
    let crowdLevel = null;
    if (c.playoff) crowdLevel = c.ironBowl ? 95 : 90;
    if (m.crowdLevel && c.home) crowdLevel = m.crowdLevel;
    return {
      user: S.user, opp: c.opp, userHome: c.home, qMin: S.qMin, diff: S.diff,
      injured: S_.injuredIds(S), morale, weather: m.weather || null, crowdLevel,
      playoff: c.playoff, intel: m.intel ? true : null, film: !!m.film, starMeter: m.starMeter || null, label: c.label,
    };
  };

  // ---------- record results ----------
  function applyResult(S, g, G) {
    g.hs = G.score.home; g.as = G.score.away; g.done = true; g.ot = !!G.ot;
    const H = S.rec[g.h], A = S.rec[g.a];
    H.pf += g.hs; H.pa += g.as; A.pf += g.as; A.pa += g.hs;
    if (g.hs > g.as) { H.w++; A.l++; H.streak = Math.max(1, H.streak + 1); A.streak = Math.min(-1, A.streak - 1); }
    else if (g.hs < g.as) { A.w++; H.l++; A.streak = Math.max(1, A.streak + 1); H.streak = Math.min(-1, H.streak - 1); }
    else { H.t++; A.t++; H.streak = 0; A.streak = 0; }
    const win = g.hs > g.as ? g.h : g.hs < g.as ? g.a : null, lose = win == null ? null : win === g.h ? g.a : g.h;
    if (win != null) { S.morale[win] = clamp(S.morale[win] + 2, -10, 10); S.morale[lose] = clamp(S.morale[lose] - 2, -10, 10); }
    // new injuries carry into the coming weeks
    GI.gameInjuries(G).forEach((i) => {
      if (S.inj[i.id] > 0) return;
      const r = R();
      S.inj[i.id] = r < 0.55 ? 1 : r < 0.85 ? 2 : r < 0.96 ? 3 : 6;
      (S._newInj = S._newInj || []).push({ team: i.team, name: i.name, pos: i.pos, weeks: S.inj[i.id] });
    });
  }
  function playoffApply(S, g, G) {
    g.hs = G.score.home; g.as = G.score.away; g.done = true; g.ot = !!G.ot;
    g.win = g.hs > g.as ? g.h : g.a;
    GI.gameInjuries(G).forEach((i) => {
      if (S.inj[i.id] > 0) return;
      S.inj[i.id] = R() < 0.6 ? 1 : 2;
      (S._newInj = S._newInj || []).push({ team: i.team, name: i.name, pos: i.pos, weeks: S.inj[i.id] });
    });
  }

  // finish the current week/round. userG = the finished game the user played (or null to sim it)
  S_.finishWeek = function (S, userG) {
    const c = S_.current(S);
    S._newInj = [];
    // injuries heal a week
    Object.keys(S.inj).forEach((k) => { S.inj[k] = Math.max(0, S.inj[k] - 1); if (!S.inj[k]) delete S.inj[k]; });
    const highlights = [];
    const results = [];
    const games = S.phase === 'regular' ? S.schedule[S.week] : S.bracket.rounds[S.bracket.round];
    let mine = null;
    games.forEach((g) => {
      if (g.done) return;
      const isMine = g.h === S.user || g.a === S.user;
      let G;
      if (isMine && userG) G = userG;
      else if (isMine) G = simWith(S, g, S_.gameOptions(S));
      else G = simWith(S, g, { playoff: S.phase === 'playoffs', crowdLevel: S.phase === 'playoffs' ? 88 : null });
      if (S.phase === 'regular') applyResult(S, g, G); else playoffApply(S, g, G);
      (G.highlights || []).forEach((h) => highlights.push({ text: h, game: g }));
      if (isMine) {
        mine = { g, G };
        G.log.filter((l) => l.type === 'star').forEach((l) => highlights.unshift({ text: l.text, game: g, mine: true }));
        const us = g.h === S.user ? g.hs : g.as, them = g.h === S.user ? g.as : g.hs;
        S.seasonStats.gp++; S.seasonStats.pf += us; S.seasonStats.pa += them;
      }
      results.push(g);
    });
    S.mods = {};
    const paper = buildPaper(S, c, mine, results, highlights);
    // advance
    if (S.phase === 'regular') {
      S.week++;
      if (S.week >= S.weeks) startPlayoffs(S, paper);
    } else {
      advanceBracket(S, paper);
    }
    S.paper = paper;
    S.news.unshift(paper);
    if (S.news.length > 24) S.news.pop();
    S_.save(S);
    return paper;
  };
  function simWith(S, g, extra) {
    if (extra && extra.user != null) { // the user's game, simmed with the same matchup options
      const G = GI.newGame(Object.assign({}, extra, { qMin: 8, user: g.h, opp: g.a, userHome: true, potw: { off: 'short', def: 'zone' } }));
      G.diff = 'pro';
      return GI.finishAuto(G);
    }
    const o = Object.assign({ qMin: 8, injured: S_.injuredIds(S) }, extra || {});
    o.morale = { home: S.morale[g.h] || 0, away: S.morale[g.a] || 0 };
    return GI.simGame(g.h, g.a, o);
  }

  // ---------- playoffs ----------
  function seeds(S, conf) {
    const ids = [...Array(32).keys()].filter((i) => confOf(i) === conf);
    return S_.sorted(S, ids).slice(0, 6);
  }
  function startPlayoffs(S, paper) {
    S.phase = 'playoffs';
    const sd = [seeds(S, 0), seeds(S, 1)];
    const seedOf = {};
    sd.forEach((list) => list.forEach((t, k) => (seedOf[t] = k + 1)));
    const wc = [];
    sd.forEach((list, ci) => { wc.push(mk(list[2], list[5], ci)); wc.push(mk(list[3], list[4], ci)); });
    S.bracket = { seeds: sd, seedOf, round: 0, rounds: [wc], alive: sd.map((l) => l.slice()) };
    function mk(h, a, conf) { return { h, a, conf, hs: null, as: null, done: false }; }
    paper.playoffNote = sd;
    const userIn = seedOf[S.user];
    paper.userPlayoff = userIn ? `${T(S.user).name} clinch the #${userIn} seed in the ${CONFS[confOf(S.user)]} Conference!` : `${T(S.user).name} miss the playoffs.`;
  }
  function advanceBracket(S, paper) {
    const B = S.bracket, rd = B.rounds[B.round];
    const winners = rd.map((g) => g.win);
    const seedOf = B.seedOf;
    if (B.round === 0) {
      const next = [];
      [0, 1].forEach((ci) => {
        const w = winners.filter((t) => confOf(t) === ci).sort((a, b) => seedOf[a] - seedOf[b]);
        const top = B.seeds[ci];
        next.push({ h: top[0], a: w[w.length - 1], conf: ci, hs: null, as: null, done: false });
        next.push({ h: top[1], a: w[0], conf: ci, hs: null, as: null, done: false });
      });
      B.rounds.push(next); B.round = 1;
    } else if (B.round === 1) {
      const next = [0, 1].map((ci) => {
        const w = winners.filter((t) => confOf(t) === ci).sort((a, b) => seedOf[a] - seedOf[b]);
        return { h: w[0], a: w[1], conf: ci, hs: null, as: null, done: false };
      });
      B.rounds.push(next); B.round = 2;
    } else if (B.round === 2) {
      const [x, y] = winners;
      const better = S_.sorted(S, [x, y]);
      B.rounds.push([{ h: better[0], a: better[1], conf: -1, hs: null, as: null, done: false, neutral: true }]);
      B.round = 3;
    } else {
      S.champion = winners[0];
      S.phase = 'done';
      paper.champion = winners[0];
      S.history.unshift({ year: S.year, champ: winners[0], user: S.user, rec: S_.recStr(S.rec[S.user]) });
      if (winners[0] === S.user) {
        try {
          const t = JSON.parse(localStorage.getItem('gridiron_trophies') || '[]');
          t.unshift({ year: S.year, team: S.user, kind: 'Iron-Bowl Champions', rec: S_.recStr(S.rec[S.user]) });
          localStorage.setItem('gridiron_trophies', JSON.stringify(t));
        } catch (e) {}
      }
    }
  }
  S_.userAlive = function (S) {
    if (S.phase !== 'playoffs') return false;
    return !!S_.current(S).game;
  };

  S_.nextSeason = function (S) {
    return S_.create({ user: S.user, year: S.year + 1, weeks: S.weeks, qMin: S.qMin, diff: S.diff, history: S.history });
  };

  // ---------- the Grid-Iron Gazette ----------
  const HEAD = {
    rout: ['{US} BULLDOZE {THEM}', '{US} BURY {THEM} IN A LANDSLIDE', 'NO CONTEST: {US} FLATTEN {THEM}'],
    solid: ['{US} HANDLE {THEM}', '{US} TAKE CARE OF BUSINESS', '{US} GRIND PAST {THEM}'],
    close: ['{US} EDGE {THEM} IN A THRILLER', 'NAIL-BITER! {US} SURVIVE {THEM}', '{US} ESCAPE WITH A WIN'],
    tie: ['DEADLOCK! {US} AND {THEM} SETTLE FOR A TIE', 'NOBODY BLINKS: {US}, {THEM} TIE'],
    heart: ['HEARTBREAK: {THEM} SNEAK PAST {US}', '{US} COME UP JUST SHORT', 'SO CLOSE: {THEM} HOLD OFF {US}'],
    loss: ['{THEM} TOPPLE {US}', '{US} STUMBLE AGAINST {THEM}', 'ROUGH DAY FOR THE {US}'],
    blown: ['{THEM} ROUT {US}', 'DISASTER: {THEM} EMBARRASS {US}', '{US} GET BLOWN OUT'],
  };
  const VENUES = ['the Rusty Anchor', 'Club Neon', 'the riverboat casino', 'a karaoke bar downtown', 'the Midnight Diner', 'a rooftop lounge'];
  const PUBS = ['the Brass Tap', "O'Malley's Pub", 'the Corner Keg', 'Rosie\'s Tavern', 'the Iron Horse Saloon'];

  function buildPaper(S, c, mine, results, highlights) {
    const ut = T(S.user);
    const p = { year: S.year, label: c.label, week: S.week, phase: S.phase, scores: [], injuries: [], event: null, id: Date.now() };
    if (mine) {
      const g = mine.g, us = g.h === S.user ? g.hs : g.as, them = g.h === S.user ? g.as : g.hs;
      const opp = T(g.h === S.user ? g.a : g.h);
      const m = us - them;
      const key = m >= 21 ? 'rout' : m >= 8 ? 'solid' : m > 0 ? 'close' : m === 0 ? 'tie' : m > -8 ? 'heart' : m > -21 ? 'loss' : 'blown';
      p.headline = pick(HEAD[key]).replace('{US}', ut.name.toUpperCase()).replace('{THEM}', opp.name.toUpperCase());
      p.score = `${ut.abbr} ${us}, ${opp.abbr} ${them}${g.ot ? ' (OT)' : ''}`;
      p.win = m > 0; p.tie = m === 0;
      p.left = S.user; p.right = opp.idx;
      const rec = S_.recStr(S.rec[S.user]);
      const loc = g.h === S.user ? `at home` : `in ${opp.city}`;
      p.sub = m > 0 ? `${ut.city} improves to ${rec} with the win ${loc}.` : m < 0 ? `${ut.city} falls to ${rec} after the loss ${loc}.` : `${ut.city} sits at ${rec} after a stalemate ${loc}.`;
      if (c.playoff) p.sub = m > 0 ? (c.ironBowl ? `Champions! ${ut.city} finishes ${rec}.` : `${ut.city} marches on in the playoffs.`) : `A ${rec} season comes to an end.`;
      p.record = S_.recStr(S.rec[S.user]);
      if (c.playoff) {
        p.playoffResult = m > 0 ? (c.ironBowl ? 'champs' : 'advance') : 'out';
        if (c.ironBowl && m > 0) p.headline = `${ut.name.toUpperCase()} WIN THE IRON-BOWL!`;
        else if (c.ironBowl) p.headline = `${opp.name.toUpperCase()} TAKE THE IRON-BOWL`;
        else if (m < 0) p.headline = `SEASON OVER: ${opp.name.toUpperCase()} END ${ut.name.toUpperCase()}' RUN`;
      }
    } else {
      // user idle (eliminated / bye) — lead with the biggest game
      const g = results.find((x) => x.h != null) || results[0];
      if (g) {
        const w = g.hs > g.as ? g.h : g.a, l = w === g.h ? g.a : g.h;
        p.headline = c.label === ROUND_NAMES[3] ? `${T(w).name.toUpperCase()} WIN THE IRON-BOWL!` : `${T(w).name.toUpperCase()} ADVANCE PAST ${T(l).name.toUpperCase()}`;
        p.score = `${T(g.h).abbr} ${g.hs}, ${T(g.a).abbr} ${g.as}`;
        p.left = w; p.right = l;
        const bye = c.label === ROUND_NAMES[0] && S.bracket && S.bracket.seedOf[S.user] <= 2;
        p.sub = bye ? `The ${ut.name} rest up on a first-round bye.` : `The ${ut.name} watch from home.`;
        p.bye = bye;
      }
    }
    // play of the week
    const potw = highlights.find((h) => h.mine) || (highlights.length ? pick(highlights) : null);
    if (potw) p.potw = { text: potw.text, teams: [potw.game.h, potw.game.a] };
    p.scores = results.map((g) => ({ h: g.h, a: g.a, hs: g.hs, as: g.as, ot: g.ot }));
    p.injuries = (S._newInj || []).sort((a, b) => (b.team === S.user) - (a.team === S.user)).slice(0, 6)
      .map((i) => ({ team: i.team, text: `${T(i.team).abbr} ${GI.POS[i.pos].label} ${GI.shortName(i.name)} — out ${i.weeks >= 6 ? 'for the season' : i.weeks + ' wk' + (i.weeks > 1 ? 's' : '')}`, mine: i.team === S.user }));
    p.division = S_.sorted(S, S_.division(S.user)).map((i) => ({ i, rec: S_.recStr(S.rec[i]) }));
    // next opponent preview + one "EXTRA!" story that can swing the next game
    const willPlay = nextUserGame(S, c);
    p.next = willPlay;
    if (willPlay) p.event = makeEvent(S, willPlay);
    else if (Math.random() < 0.5) p.event = flavorEvent(S);
    return p;
  }
  function nextUserGame(S, c) {
    // work out the user's next game after this week finishes
    if (S.phase === 'regular' && S.week + 1 < S.weeks) {
      const g = S.schedule[S.week + 1].find((x) => x.h === S.user || x.a === S.user);
      return { opp: g.h === S.user ? g.a : g.h, home: g.h === S.user, label: `Week ${S.week + 2}` };
    }
    return null; // playoff matchups get decided after the round
  }
  function makeEvent(S, nx) {
    const ut = T(S.user), op = T(nx.opp);
    const healthy = ut.stars.filter((s) => !(S.inj[s.id] > 0) && s.pos !== 'KP');
    const star = healthy.length ? pick(healthy) : ut.stars[1];
    const types = { leak: 14, film: 12, dinner: 12, night: 12, ego: 12, storm: 9, sellout: nx.home ? 9 : 0, walkon: 4, none: 16 };
    const t = wpick(types);
    const sn = GI.shortName(star.name);
    switch (t) {
      case 'leak': S.mods.intel = true; return { kind: 'good', tag: 'LEAKED', title: `${op.abbr} Game Plan Leaks!`, body: `A ${op.city} equipment manager left a playbook at a gas station. You'll know their Play of the Week heading into ${nx.label}.`, effect: 'Intel: their Play of the Week is revealed' };
      case 'film': S.mods.film = true; return { kind: 'bad', tag: 'FILM ROOM', title: `${op.name} Pull an All-Nighter on Your Tape`, body: `${op.city}'s staff has been breaking down your Play of the Week. Expect them to sit on it — consider switching it up.`, effect: 'They counter your offensive Play of the Week more often' };
      case 'dinner': S.mods.morale = (S.mods.morale || 0) + 8; return { kind: 'good', tag: 'LOCKER ROOM', title: `Team Dinner Brings ${ut.name} Together`, body: `${GI.shortName(ut.coaches.hc.name)} rented out a steakhouse for the whole roster. Spirits are high.`, effect: '+8 team morale next game' };
      case 'storm': { const w = pick(['rain', 'snow', 'wind']); S.mods.weather = w; return { kind: 'info', tag: 'FORECAST', title: `${GI.WEATHER[w].icon} ${GI.WEATHER[w].name} Expected for ${nx.label}`, body: `Forecasters say ${GI.WEATHER[w].desc.toLowerCase()}. Plan accordingly.`, effect: `Next game: ${GI.WEATHER[w].name}` }; }
      case 'sellout': S.mods.crowdLevel = 95; return { kind: 'good', tag: 'BOX OFFICE', title: 'SOLD OUT! Fans Pack the Stadium', body: `Every seat is gone for the ${op.name} game. It's going to be deafening.`, effect: 'Deafening home crowd next game' };
      case 'night': return { kind: 'choice', tag: 'SCANDAL', star: star.id, title: `${sn} Spotted Out Late at ${pick(VENUES)}`, body: `Photos of the ${GI.POS[star.pos].full.toLowerCase()} hit the internet at 3 a.m. The locker room wants to see how you handle it.`,
        choices: [{ id: 'fine', label: 'Fine him', desc: '+4 team morale, his meter starts at 0' }, { id: 'slide', label: 'Let it slide', desc: 'He starts at 60%, −5 team morale' }] };
      case 'ego': return { kind: 'choice', tag: 'EGO WATCH', star: star.id, title: `${sn} Wants the Spotlight`, body: `"Get me the ball and get out of the way," ${sn} told reporters. Teammates were not amused.`,
        choices: [{ id: 'feature', label: 'Feature him', desc: 'Starts ON FIRE (100%), −6 team morale' }, { id: 'team', label: 'Team first', desc: '+4 team morale' }] };
      case 'walkon': return { kind: 'info', tag: 'LOCAL LEGEND', title: `Bartender Boots 58-Yarder at Open Tryouts`, body: `${pick(GI.FIRST)} ${pick(GI.LAST)}, who pours drinks at ${pick(PUBS)} in ${ut.city}, stunned scouts at a public tryout. "I just kick the kegs," he said.`, effect: 'Walk-on signings arrive with the Franchise update' };
      default: return null;
    }
  }
  function flavorEvent(S) {
    const t = pick(GI.TEAMS);
    return { kind: 'info', tag: 'AROUND THE LEAGUE', title: `${t.name} Coach ${t.coaches.hc.name.split(' ').pop()} Under Fire`, body: `Rumors swirl in ${t.city} after a rough stretch. Front-office drama is coming soon to the Gazette.`, effect: null };
  }
  S_.resolveChoice = function (S, paper, choiceId) {
    const ev = paper.event;
    if (!ev || ev.chosen) return;
    ev.chosen = choiceId;
    S.mods.starMeter = S.mods.starMeter || {};
    if (choiceId === 'fine') { S.mods.morale = (S.mods.morale || 0) + 4; S.mods.starMeter[ev.star] = 0; }
    if (choiceId === 'slide') { S.mods.morale = (S.mods.morale || 0) - 5; S.mods.starMeter[ev.star] = 60; }
    if (choiceId === 'feature') { S.mods.morale = (S.mods.morale || 0) - 6; S.mods.starMeter[ev.star] = 100; }
    if (choiceId === 'team') { S.mods.morale = (S.mods.morale || 0) + 4; }
    const c = ev.choices.find((x) => x.id === choiceId);
    ev.effect = c ? `You chose: ${c.label} — ${c.desc}` : null;
    S_.save(S);
  };
})();
