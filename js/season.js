/* Grid Iron — franchise mode: drafts, contracts, budget, spring training, upgrades, seasons, playoffs, Iron-Bowl, the Gazette */
(function () {
  const GI = window.GI;
  const { ri, clamp, wpick, gauss } = GI.util;
  const R = Math.random;
  const pick = (a) => a[Math.floor(R() * a.length)];
  const KEY = 'gridiron_franchise_v2'; // v1.0 card franchises start fresh
  const CONFS = ['Iron', 'Steel'];
  const DIVS = ['North', 'South', 'East', 'West'];
  const ROUND_NAMES = ['Wild Card Round', 'Divisional Round', 'Conference Championships', 'THE IRON-BOWL'];
  const REQUIRED = ['KP', 'QB', 'LB'];
  const CAP = { KP: 1, QB: 1, RB: 1, WR: 3, TE: 1, OL: 1, LB: 3, DL: 1, S: 2, CB: 2 }; // v1: the 16-card lineup
  const ALLPOS = Object.keys(CAP);
  const OFFENSE = ['QB', 'RB', 'WR', 'TE', 'OL'];
  const UPGRADES = {
    stadium: { name: 'Stadium', icon: '🏟️', cost: [0, 0, 10, 16, 24, 34], desc: ['Louder home crowds', 'More ticket revenue', '+1.5 base team morale per level'] },
    gym: { name: 'Training Gym', icon: '🏋️', cost: [0, 0, 6, 10, 15, 22], desc: ['Bigger spring training gains', 'Higher breakthrough chance', 'Stars hold their meter better'] },
    scouts: { name: 'Scouting Dept.', icon: '🔭', cost: [0, 0, 4, 7, 11, 16], desc: ['Tighter draft rating ranges', 'More mid-season scout reports', 'Spots breakthrough "Spark" in prospects'] },
    medical: { name: 'Medical Staff', icon: '🩺', cost: [0, 0, 4, 7, 11, 16], desc: ['Shorter injuries', 'Fewer season-ending injuries', ''] },
  };
  const ROOKIE_YEARS = 3;

  const confOf = (i) => (i < 16 ? 0 : 1);
  const divOf = (i) => Math.floor((i % 16) / 4);
  const T = (i) => GI.TEAMS[i];
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const r1 = (x) => Math.round(x * 10) / 10;

  const S_ = {
    CONFS, DIVS, ROUND_NAMES, REQUIRED, CAP, UPGRADES, confOf, divOf,
    load() { try { const s = localStorage.getItem(KEY); return s ? GI.league.migrate(JSON.parse(s)) : null; } catch (e) { console.error(e); return null; } },
    save(S) { if (GI.cards && S && S.rosters) GI.cards.syncAll(S); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} },
    clear() { try { localStorage.removeItem(KEY); } catch (e) {} },
  };
  GI.season = S_;
  S_.money = (x) => (x < 0 ? '−$' : '$') + Math.abs(r1(x)).toFixed(1) + 'M';

  // ================= players =================
  function newName(S) {
    let nm, guard = 0;
    do { nm = pick(GI.FIRST) + ' ' + pick(GI.LAST); } while (S.names[nm] && guard++ < 50);
    S.names[nm] = 1;
    return nm;
  }
  function mkPlayer(S, pos, kind) {
    const vet = kind === 'vet';
    let rating = vet ? Math.round(clamp(gauss(77, 6), 66, 93)) : Math.round(clamp(gauss(69, 6), 56, 86));
    if (S.rosters && isV1(S)) rating = vet ? Math.round(clamp(gauss(70, 5), 60, 86)) : Math.round(clamp(gauss(62, 5.5), 50, 78)); // v1: rookies are projects
    if (!vet && R() < 0.05) rating = Math.min(90, rating + ri(5, 9)); // blue-chip prospect
    const age = vet ? ri(24, 31) : ri(21, 23);
    const pot = vet ? Math.min(97, rating + Math.max(0, Math.round(gauss(30 - age, 3)))) : Math.round(clamp(rating + gauss(10, 6), rating + 1, 97));
    const p = {
      id: 'p' + (S.nextId++), pos, name: newName(S), num: 0, rating, pot, age,
      clutch: ri(40, 95), dur: ri(45, 95), ego: ri(5, 95), spark: vet ? 0.02 : Math.round((R() * 0.18 + 0.04) * 100) / 100,
      college: pick(GI.COLLEGES), yrsPro: vet ? age - 22 : 0, rookie: !vet,
      traits: GI.league.rollTraits(), career: { seasons: 0, gp: 0 }, formerTeams: [], awards: [],
    };
    if (S.rosters && isV1(S)) { // v1: every player is a card with three stats
      p.stats = GI.cards.rollStats(pos, rating);
      GI.cards.refresh(p);
      p.unit = pos === 'OL' || pos === 'DL';
      if (p.unit) { p.name = pick(GI.cards.LINE_NAMES[pos]); p.num = null; }
      if (!vet && R() < 0.06) { p.gem = true; p.pot = Math.min(99, p.pot + ri(6, 12)); p.spark = 0.3; } // a hidden gem
    }
    p.salary = vet ? askSalary(p) : rookieSalary(p);
    return p;
  }
  S_._mkPlayer = mkPlayer;
  function askSalary(p) {
    let a = (p.unit ? 1.5 : 1) * (0.7 + Math.max(0, p.rating - 60) * 0.17) + (p.rating >= 85 ? (p.rating - 84) * 0.35 : 0);
    if (!p.unit) a += (p.ego > 75 ? 0.6 : 0) + (p.age < 27 ? 0.3 : 0);
    if (p.raise) a *= 1.2; // award winners want to get paid
    if ((p.traits || []).includes('diva')) a += 0.5;
    return r1(clamp(a, 0.8, 16));
  }
  function rookieSalary(p) { return r1(clamp(0.6 + (p.rating - 60) * 0.09, 0.6, 3.5)); }
  S_.askSalary = askSalary;
  function assignNum(team, p) {
    const used = new Set(team.stars.concat(team.benchList || [], team.bench ? [team.bench] : []).map((s) => s.num));
    const [a, b] = GI.NUMS[p.pos];
    let n, guard = 0;
    do { n = ri(a, b); } while (used.has(n) && guard++ < 40);
    p.num = n;
  }
  S_.grade = function (pot) { return pot >= 90 ? 'A' : pot >= 84 ? 'B' : pot >= 78 ? 'C' : 'D'; };

  // ================= rosters =================
  S_.roster = (S, i) => S.rosters[i];
  S_.allStars = (S, i) => { const r = S.rosters[i]; return r.stars.concat(r.benchList || [], r.bench ? [r.bench] : []); };
  const isV1 = (S) => !!(S && S.rosters && S.rosters[0] && S.rosters[0].v === 1);
  S_.isV1 = isV1;
  // take a player off a roster wherever he is (lineup, bench list, old single bench)
  function removeFromRoster(S, i, id) {
    const r = S.rosters[i];
    r.stars = r.stars.filter((x) => x.id !== id);
    if (r.benchList) r.benchList = r.benchList.filter((x) => x.id !== id);
    if (r.bench && r.bench.id === id) r.bench = null;
  }
  S_.removeFromRoster = removeFromRoster;
  // tier promotions (Bronze → Silver → Gold …) are a moment: remember them for the hub to show
  const TIER_ORDER = ['bronze', 'silver', 'gold', 'elite', 'star'];
  function tierSnap(S) { const m = {}; S_.allStars(S, S.user).forEach((c) => (m[c.id] = c.tier)); return m; }
  function tierDiff(S, before) {
    S_.allStars(S, S.user).forEach((c) => {
      const was = before[c.id];
      if (was && c.tier && TIER_ORDER.indexOf(c.tier) > TIER_ORDER.indexOf(was)) (S.tierUps = S.tierUps || []).push({ id: c.id, from: was, to: c.tier });
    });
  }
  S_.teamObj = (S, i) => GI.makeTeam(i, S.rosters[i]);
  S_.teamOvr = (S, i) => S_.teamObj(S, i).ovr;
  function posCount(r, pos) { return r.stars.filter((s) => s.pos === pos).length; }
  // can this team add a player at pos? → 'starter' | 'bench' | null
  S_.slotFor = function (S, i, pos) {
    const r = S.rosters[i];
    if (r.v === 1) return posCount(r, pos) < CAP[pos] ? 'starter' : 'bench'; // v1: the bench always has a seat (the worst is cut)
    if (r.stars.length < 16 && posCount(r, pos) < CAP[pos]) return 'starter';
    if (!r.bench) return 'bench';
    return null;
  };
  function addToRoster(S, i, p, contractYears) {
    const r = S.rosters[i];
    const slot = S_.slotFor(S, i, p.pos);
    if (!slot) return null;
    const star = Object.assign({}, p, { contract: { years: contractYears, salary: p.salary, active: slot === 'starter' } });
    delete star.est; delete star.claimed; delete star.gradeShown; delete star.sparkShown; delete star.ask; delete star.lastTeam; delete star.leftHow; delete star.raise;
    star.joined = S.year;
    star.hometown = p.college === GI.homeCollege(i);
    star.traits = star.traits || GI.league.rollTraits();
    star.career = star.career || { seasons: 0, gp: 0 };
    if (r.v === 1) {
      star.contract.active = true;
      if (!star.unit) assignNum(r, star); else star.num = null;
      if (!star.stats) { star.stats = GI.cards.rollStats(star.pos, star.rating); GI.cards.refresh(star); }
      return GI.dev.addCard(S, i, star);
    }
    assignNum(r, star);
    if (slot === 'starter') r.stars.push(star); else r.bench = star;
    return slot;
  }
  S_._addToRoster = addToRoster;
  S_.release = function (S, starId, how) {
    const r = S.rosters[S.user];
    const s = S_.allStars(S, S.user).find((x) => x.id === starId);
    if (!s) return false;
    removeFromRoster(S, S.user, starId);
    if (r.v === 1) GI.dev.fillLineup(S, S.user);
    S.expiring = (S.expiring || []).filter((x) => x !== starId);
    S.freeAgents.push(Object.assign({}, s, { contract: null, lastTeam: S.user, leftHow: how || 'cut', ask: askSalary(s) }));
    delete S.holdout[starId];
    S_.save(S);
    return s;
  };
  // swap a starter with the backup star (bench must fit the slot)
  S_.swapBench = function (S, starId) {
    const r = S.rosters[S.user];
    if (!r.bench) return false;
    const s = r.stars.find((x) => x.id === starId);
    if (!s) return false;
    const b = r.bench;
    if (b.pos !== s.pos && posCount(r, b.pos) >= CAP[b.pos]) return false;
    r.stars = r.stars.filter((x) => x.id !== starId).concat([b]);
    b.contract.active = true;
    r.bench = s;
    S_.save(S);
    return true;
  };
  S_.salaryTotal = (S, i) => S_.allStars(S, i).reduce((t, s) => t + (s.contract && s.contract.active ? s.contract.salary : 0), 0);

  // ================= new franchise =================
  S_.create = function (o) {
    const S = {
      v: 2, user: o.user, year: 1, weeks: o.weeks || 12, week: 0, qMin: o.qMin || 5, diff: o.diff || 'pro',
      nextId: 1, names: {}, rosters: [], cash: 30, up: { stadium: 1, gym: 1, scouts: 1, medical: 1 },
      fin: { tickets: 0, playoffs: 0, bonus: 0, events: 0, reports: [] },
      phase: 'draft', draft: null, scouted: [], freeAgents: [], expiring: [],
      schedule: makeSchedule(o.weeks || 12), rec: freshRec(), inj: {}, morale: Array(32).fill(0), mods: {}, news: [], paper: null,
      bracket: null, champion: null, history: [], seasonStats: { gp: 0, pf: 0, pa: 0 }, records: { titles: 0 },
      fid: 'f' + Date.now().toString(36),
    };
    // v1: every franchise opens with a full 16-card lineup (team overall ~63–72)
    for (let i = 0; i < 32; i++) {
      const src = GI.buildTeam(i);
      const stars = src.stars.map((c) => {
        const p = Object.assign({}, c, { id: 'p' + (S.nextId++), college: pick(GI.COLLEGES), yrsPro: Math.max(0, c.age - 22), rookie: false, career: { seasons: 0, gp: 0 }, formerTeams: [], awards: [], spark: 0.03 });
        delete p.role; delete p.meter; delete p.armed; delete p.injured;
        if (!p.unit) S.names[p.name] = true;
        p.contract = { years: ri(1, 4), salary: askSalary(p), active: true };
        return p;
      });
      S.rosters.push({ v: 1, stars, benchList: [], bench: null, base: {}, coaches: JSON.parse(JSON.stringify(src.coaches)) });
    }
    GI.league.init(S);
    S.cap = 62;
    S.phase = 'camp'; S.draft = null;
    // a little depth on every bench: young backups at the positions that get hurt most
    for (let i = 0; i < 32; i++) ['QB', 'RB', 'WR', 'LB', 'CB'].forEach((pos) => {
      if (R() < 0.35 && pos !== 'QB') return;
      const p = mkPlayer(S, pos, 'rookie');
      p.rating = clamp(p.rating - 4, 50, 70); p.stats = GI.cards.rollStats(pos, p.rating); GI.cards.refresh(p);
      addToRoster(S, i, p, 2);
    });
    S_.save(S);
    return S;
  };
  function freshRec() { return Array.from({ length: 32 }, () => ({ w: 0, l: 0, t: 0, pf: 0, pa: 0, streak: 0 })); }
  function makeSchedule(weeks) {
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
    return shuffle(rounds).slice(0, weeks);
  }

  // ================= the draft =================
  function scoutWidth(S) { return [5, 5, 4, 3, 2, 1][S.up.scouts] || 5; }
  function estFor(S, p, width) {
    const w = width != null ? width : scoutWidth(S);
    const mid = p.rating + Math.round(gauss(0, w * 0.45));
    p.est = [clamp(mid - w, 40, 99), clamp(mid + w, 40, 99)];
    const gp = p.pot + Math.round(gauss(0, Math.max(1, 6 - S.up.scouts)));
    p.gradeShown = S_.grade(gp);
    p.sparkShown = S.up.scouts >= 3 && p.spark >= 0.14;
  }
  function makeDraft(S, opening, rounds) {
    let order, lottery = null;
    if (opening) order = shuffle([...Array(32).keys()]);
    else {
      // reverse finish: worst record first, champion last
      const champ = S.champion;
      order = [...Array(32).keys()].sort((a, b) => S_.pct(S.rec[a]) - S_.pct(S.rec[b]) || (S.rec[a].pf - S.rec[a].pa) - (S.rec[b].pf - S.rec[b].pa));
      if (champ != null) { order = order.filter((x) => x !== champ); order.push(champ); }
      // draft lottery: the six worst teams draw for the top three picks
      const pool = order.slice(0, 6), w = [6, 5, 4, 3, 2, 1], drawn = [];
      for (let k = 0; k < 3; k++) {
        const ws = {}; pool.forEach((t, j) => { if (!drawn.includes(t)) ws[j] = w[j]; });
        drawn.push(pool[+wpick(ws)]);
      }
      lottery = drawn.map((t, k) => ({ team: t, pick: k + 1, was: order.indexOf(t) + 1 }));
      order = drawn.concat(order.filter((t) => !drawn.includes(t)));
    }
    const picks = [];
    for (let r = 0; r < rounds; r++) {
      const ord = opening && r % 2 ? order.slice().reverse() : order; // snake for the opening draft
      ord.forEach((t, k) => picks.push({ round: r + 1, inRound: k + 1, team: t, orig: t, pid: null, passed: false }));
    }
    // traded picks change hands
    (S.pickTrades || []).forEach((tr) => { const pk = picks.find((x) => x.round === tr.round && x.orig === tr.orig); if (pk) pk.team = tr.owner; });
    S.pickTrades = [];
    // prospect pool
    const pool = [];
    const n = Math.round(32 * rounds * 1.35);
    if (opening) {
      for (let i = 0; i < 44; i++) pool.push(mkPlayer(S, 'QB', R() < 0.45 ? 'vet' : 'rookie'));
      for (let i = 0; i < 44; i++) pool.push(mkPlayer(S, 'KP', R() < 0.45 ? 'vet' : 'rookie'));
      for (let i = 0; i < 52; i++) pool.push(mkPlayer(S, 'LB', R() < 0.45 ? 'vet' : 'rookie'));
    } else {
      for (let i = 0; i < 6; i++) pool.push(mkPlayer(S, pick(REQUIRED), 'rookie'));
    }
    const W = isV1(S) ? { QB: 6, KP: 4, LB: 10, RB: 7, WR: 12, TE: 5, OL: 5, DL: 5, S: 8, CB: 9 } : { QB: 4, KP: 3, LB: 8, RB: 7, WR: 10, TE: 5, OL: 9, DL: 9, S: 7, CB: 8 };
    while (pool.length < n) pool.push(mkPlayer(S, wpick(W), opening && R() < 0.4 ? 'vet' : 'rookie'));
    // last season's free agents and released players join the pool as veterans
    (S.freeAgents || []).forEach((fa) => { if (fa.age < 35) { const p = Object.assign({}, fa, { salary: askSalary(fa), rookie: false }); delete p.contract; pool.push(p); } });
    S.freeAgents = [];
    // prospects your scouts pursued during the season
    (S.scouted || []).forEach((sc) => {
      const p = Object.assign({}, sc.p);
      if (sc.early) { p.rating = clamp(p.rating + Math.round(gauss(0, 4)), 50, 92); if (R() < 0.1) { p.rating -= 5; p.injuredNote = true; } }
      p.claimed = true;
      p.salary = rookieSalary(p);
      pool.push(p);
    });
    S.scouted = [];
    // a Career Mode prospect enters this draft
    if (S.careerProspect) {
      const cp = Object.assign({}, S.careerProspect, { claimed: false, careerPlayer: true });
      cp.salary = rookieSalary(cp);
      pool.push(cp);
      S.careerProspect = null;
    }
    pool.forEach((p) => { p.ask = p.rookie ? null : p.ask; estFor(S, p, p.claimed ? 2 : p.careerPlayer ? 1 : null); });
    return { year: S.year, opening, rounds, picks, cur: 0, pool, log: [], lottery };
  }
  S_.draftCur = (S) => (S.draft && S.draft.cur < S.draft.picks.length ? S.draft.picks[S.draft.cur] : null);
  // what the user must take right now (opening draft: K/P, QB, LB by round 3)
  S_.mustTake = function (S) {
    const d = S.draft, cur = S_.draftCur(S);
    if (!d || !d.opening || !cur || cur.round > 3) return null;
    const r = S.rosters[S.user];
    const missing = REQUIRED.filter((p) => !r.stars.some((s) => s.pos === p));
    const left = 3 - cur.round + 1;
    return missing.length >= left ? missing : null;
  };
  S_.canDraft = function (S, teamIdx, p) {
    if (isV1(S)) {
      if (teamIdx === S.user && S.cash < p.salary) return { ok: false, why: `Can't afford ${S_.money(p.salary)}/yr` };
      if (S_.salaryTotal(S, teamIdx) + p.salary > (S.cap || 62)) return { ok: false, why: `Over the ${S_.money(S.cap || 62)} salary cap` };
      return { ok: true };
    }
    if (!S_.slotFor(S, teamIdx, p.pos)) return { ok: false, why: 'No roster room at ' + GI.POS[p.pos].label };
    if (teamIdx === S.user) {
      const must = S_.mustTake(S);
      if (must && !must.includes(p.pos)) return { ok: false, why: 'You still need a ' + must.map((x) => GI.POS[x].label).join(' / ') };
      if (S.cash < p.salary) return { ok: false, why: `Can't afford ${S_.money(p.salary)}/yr` };
    }
    if (S_.slotFor(S, teamIdx, p.pos) === 'starter' && S_.salaryTotal(S, teamIdx) + p.salary > (S.cap || 38)) return { ok: false, why: `Over the ${S_.money(S.cap || 38)} salary cap` };
    return { ok: true };
  };
  function takePlayer(S, cur, p) {
    const d = S.draft;
    d.pool = d.pool.filter((x) => x.id !== p.id);
    cur.pid = p.id;
    const years = p.rookie ? ROOKIE_YEARS : ri(1, 3);
    const slot = addToRoster(S, cur.team, p, years);
    d.log.push({ round: cur.round, inRound: cur.inRound, team: cur.team, p: { id: p.id, pos: p.pos, name: p.name, rating: p.rating, est: p.est, rookie: p.rookie, college: p.college, career: !!p.careerPlayer }, slot });
    d.cur++;
    const star = S_.allStars(S, cur.team).find((x) => x.id === p.id);
    if (cur.team === S.user && star) {
      if (star.hometown) { S.hype = clamp((S.hype || 40) + 5, 0, 100); (d.hometown = d.hometown || []).push(star.name); }
      if (GI.legacy) GI.legacy.collect([GI.league.sticker(S, star, S.user)], p.careerPlayer ? 'Career' : null);
    }
    if (p.careerPlayer && GI.career) GI.career.onFranchiseDraft(S, cur.team, cur, star);
    return slot;
  }
  // v1: how much a player would help a team right now (beats a starter?) plus his upside
  S_.needValue = function (S, t, p) {
    const r = S.rosters[t];
    const here = r.stars.filter((x) => x.pos === p.pos).sort((a, b) => a.rating - b.rating);
    const worst = here[0];
    const now = here.length < CAP[p.pos] ? 12 : worst ? Math.max(0, p.rating - worst.rating) * 1.2 : 0;
    const upside = (p.pot - p.rating) * (p.age <= 24 ? 0.5 : 0.15);
    const backup = (r.benchList || []).some((x) => x.pos === p.pos) ? 0 : 2;
    return now + upside + backup + (p.rating - 60) * 0.3;
  };
  function cpuChoose(S, t) {
    const d = S.draft, cur = S_.draftCur(S);
    const r = S.rosters[t];
    if (isV1(S)) {
      let best = null, bv = -1e9;
      d.pool.forEach((p) => {
        if (p.claimed && cur.round <= 2) return;
        if (!S_.canDraft(S, t, p).ok) return;
        const v = S_.needValue(S, t, p) + R() * 4;
        if (v > bv) { bv = v; best = p; }
      });
      return best;
    }
    const missing = REQUIRED.filter((p) => !r.stars.some((s) => s.pos === p));
    // pass sometimes once the core is set (budget), so rosters land at 3–5 stars early on; dynasties face hungrier rivals
    const passP = (d.opening ? 0.3 : 0.35 + r.stars.length * 0.06) - (S.dynasty || 0) * 0.08;
    if (!missing.length && r.stars.length >= (d.opening ? 3 : 5) && R() < passP) return null;
    const offN = r.stars.filter((s) => OFFENSE.includes(s.pos)).length, defN = r.stars.filter((s) => ['LB', 'DL', 'S', 'CB'].includes(s.pos)).length;
    let best = null, bv = -1e9;
    d.pool.forEach((p) => {
      if (p.claimed && cur.round <= 2) return; // the user's scouted prospects are off-limits early
      if (!S_.slotFor(S, t, p.pos)) return;
      if (d.opening && cur.round <= 3 && missing.length >= 3 - cur.round + 1 && !missing.includes(p.pos)) return;
      if (!S_.canDraft(S, t, p).ok) return;
      let v = p.rating + (p.pot - p.rating) * (p.age < 25 ? 0.45 : 0.15) + R() * 6;
      if (missing.includes(p.pos)) v += 14;
      // draft for need: balance the two sides of the ball, fill empty positions
      if (OFFENSE.includes(p.pos) && offN < 2) v += 5;
      if (!OFFENSE.includes(p.pos) && p.pos !== 'KP' && defN < 2) v += 5;
      if (!r.stars.some((s) => s.pos === p.pos)) v += 3;
      if (p.careerPlayer) v += 4;
      if (S_.slotFor(S, t, p.pos) === 'bench') v -= 8;
      if (v > bv) { bv = v; best = p; }
    });
    return best;
  }
  // run CPU picks until it's the user's turn (or the draft ends). Returns picks made.
  S_.draftAdvance = function (S, maxPicks) {
    const made = [];
    let n = 0;
    while (S.draft && S.draft.cur < S.draft.picks.length && n++ < (maxPicks || 999)) {
      const cur = S_.draftCur(S);
      if (cur.team === S.user) break;
      const p = cpuChoose(S, cur.team);
      if (p) { takePlayer(S, cur, p); made.push(S.draft.log[S.draft.log.length - 1]); }
      else { cur.passed = true; S.draft.cur++; }
    }
    S_.save(S);
    return made;
  };
  S_.draftPick = function (S, pid) {
    const cur = S_.draftCur(S);
    if (!cur || cur.team !== S.user) return { ok: false, why: 'Not your pick' };
    const p = S.draft.pool.find((x) => x.id === pid);
    if (!p) return { ok: false, why: 'Gone' };
    const chk = S_.canDraft(S, S.user, p);
    if (!chk.ok) return chk;
    const slot = takePlayer(S, cur, p);
    S_.save(S);
    return { ok: true, p, slot, reveal: p.rating };
  };
  S_.draftPass = function (S) {
    const cur = S_.draftCur(S);
    if (!cur || cur.team !== S.user) return false;
    if (S_.mustTake(S)) return false;
    cur.passed = true; S.draft.cur++;
    S_.save(S);
    return true;
  };
  S_.autoChoice = function (S) {
    const cur = S_.draftCur(S);
    if (!cur) return null;
    if (isV1(S)) {
      let best = null, bv = -1e9;
      S.draft.pool.forEach((p) => {
        if (!S_.canDraft(S, S.user, p).ok) return;
        const mid = (p.est[0] + p.est[1]) / 2;
        const v = S_.needValue(S, S.user, Object.assign({}, p, { rating: mid, pot: mid + ({ A: 14, B: 9, C: 5, D: 2 }[p.gradeShown] || 0) })) - p.salary * 0.3;
        if (v > bv) { bv = v; best = p; }
      });
      return best;
    }
    const must = S_.mustTake(S);
    let best = null, bv = -1e9;
    S.draft.pool.forEach((p) => {
      if (!S_.canDraft(S, S.user, p).ok) return;
      if (must && !must.includes(p.pos)) return;
      const mid = (p.est[0] + p.est[1]) / 2;
      let v = mid + ({ A: 8, B: 5, C: 2, D: 0 }[p.gradeShown] || 0) - p.salary * 0.6;
      if (REQUIRED.includes(p.pos) && !S.rosters[S.user].stars.some((s) => s.pos === p.pos)) v += 12;
      if (S_.slotFor(S, S.user, p.pos) === 'bench') v -= 6;
      if (v > bv) { bv = v; best = p; }
    });
    return best;
  };
  S_.draftAuto = function (S) { // auto-draft the rest for the user
    const made = [];
    let guard = 0;
    while (S.draft && S.draft.cur < S.draft.picks.length && guard++ < 400) {
      made.push(...S_.draftAdvance(S));
      const cur = S_.draftCur(S);
      if (!cur) break;
      const p = S_.autoChoice(S);
      if (p) { S_.draftPick(S, p.id); made.push(S.draft.log[S.draft.log.length - 1]); }
      else { cur.passed = true; S.draft.cur++; }
    }
    S_.save(S);
    return made;
  };
  S_.draftDone = (S) => !S.draft || S.draft.cur >= S.draft.picks.length;
  S_.finishDraft = function (S) {
    const d = S.draft;
    const mine = d.log.filter((x) => x.team === S.user);
    const p = blankPaper(S, d.opening ? 'Opening Draft' : 'Draft Day');
    if (d.lottery) p.lottery = d.lottery;
    const first = mine[0];
    p.headline = first ? `${T(S.user).name.toUpperCase()} TAB ${GI.POS[first.p.pos].label} ${first.p.name.split(' ').pop().toUpperCase()} WITH PICK NO. ${(first.round - 1) * 32 + first.inRound}` : `${T(S.user).name.toUpperCase()} SIT OUT THE DRAFT`;
    p.sub = d.opening ? `Thirty-two franchises built from scratch. ${T(S.user).city} added ${mine.length} star${mine.length === 1 ? '' : 's'}.` : `${T(S.user).city} added ${mine.length} star${mine.length === 1 ? '' : 's'} to the roster.`;
    p.left = S.user; p.right = (d.log.find((x) => x.team !== S.user) || { team: (S.user + 1) % 32 }).team;
    p.caption = 'Draft night: war rooms around the league work the phones.';
    p.sections = [
      { title: 'Your Class', items: mine.map((x) => `R${x.round}: ${GI.POS[x.p.pos].label} ${x.p.name} — ${x.p.rating} OVR${x.slot === 'bench' ? ' (backup)' : ''}`) },
      { title: 'First Round', items: d.log.filter((x) => x.round === 1).slice(0, 12).map((x) => `${(x.inRound)}. ${T(x.team).abbr} — ${GI.POS[x.p.pos].label} ${x.p.name}`) },
    ];
    const steal = d.log.filter((x) => x.round >= 2).sort((a, b) => b.p.rating - a.p.rating)[0];
    if (steal) p.sections.push({ title: 'Steal of the Draft', items: [`${T(steal.team).abbr} grabbed ${GI.POS[steal.p.pos].label} ${steal.p.name} (${steal.p.rating} OVR) in round ${steal.round}.`] });
    if (d.lottery) p.sections.push({ title: 'Draft Lottery', items: d.lottery.map((x) => `Pick ${x.pick}: ${T(x.team).city} ${T(x.team).name}${x.was !== x.pick ? ` (jumped from ${x.was})` : ''}`) });
    if (d.hometown && d.hometown.length) p.sections.push({ title: 'Hometown Heroes', items: d.hometown.map((n) => `🏠 ${n} stays home to play for ${T(S.user).city}. The fans are buzzing (+5 hype).`) });
    const cp = d.log.find((x) => x.p.career);
    if (cp) p.sections.unshift({ title: '🎮 Your Career Player', items: [`${GI.POS[cp.p.pos].label} ${cp.p.name} went in round ${cp.round} (#${(cp.round - 1) * 32 + cp.inRound} overall) to ${cp.team === S.user ? 'YOU' : T(cp.team).city + ' ' + T(cp.team).name}.`] });
    if (isV1(S)) {
      // undrafted rookies: every bench gets at least three bodies, cheap
      const left = d.pool.filter((x) => x.rookie).sort((a, b) => b.rating - a.rating);
      const und = [];
      for (let i = 0; i < 32; i++) {
        const r = S.rosters[i];
        let guard = 0;
        while ((r.benchList || []).length < 3 && left.length && guard++ < 6) {
          const want = ['QB', 'RB', 'WR', 'LB', 'CB', 'S'].find((pos) => !(r.benchList || []).some((x) => x.pos === pos));
          const k = Math.max(0, left.findIndex((x) => x.pos === want));
          const pp = left.splice(k, 1)[0];
          pp.salary = 0.6;
          addToRoster(S, i, pp, 1);
          if (i === S.user) und.push(`${GI.POS[pp.pos].label} ${pp.name} (${pp.rating})`);
        }
      }
      GI.dev.fillAll(S);
      if (und.length) p.sections.push({ title: 'Undrafted Signings', items: und });
    }
    S.draft = null;
    S.phase = 'camp';
    pushPaper(S, p);
    return p;
  };

  // ================= spring training =================
  const FOCUS = {
    offense: { name: 'Offense', base: { run: 2, pass: 2, ol: 1 }, desc: '+Run, +Pass, +Line' },
    defense: { name: 'Defense', base: { runD: 2, passD: 2, rush: 1 }, desc: '+Run D, +Pass D, +Rush' },
    special: { name: 'Special Teams', base: { st: 4 }, desc: '+Special teams, K/P growth' },
    conditioning: { name: 'Conditioning', base: {}, desc: 'Stars +durability, faster meters' },
  };
  S_.FOCUS = FOCUS;
  S_.runCamp = function (S, focus, intense) {
    if (intense) { S.cash -= 3; S.fin.events += 3; }
    const tiers0 = isV1(S) ? tierSnap(S) : null;
    const breaks = [], growth = [], mentors = [];
    if (isV1(S)) GI.dev.fillAll(S);
    for (let i = 0; i < 32; i++) {
      if (isV1(S)) {
        const mine = i === S.user, r = S.rosters[i];
        const f = mine ? focus : (R() < 0.5 ? 'offense' : 'defense');
        const gym = mine ? S.up.gym : 2 + Math.min(2, S.dynasty || 0) * 0.5;
        const all = S_.allStars(S, i);
        const mentorsHere = all.filter((m) => (m.traits || []).includes('mentor') && m.age >= 27);
        all.forEach((c) => {
          const before = c.rating;
          let bonus = (mine && intense ? 1 : 0) + (r.coaches.hc.rating - 70) / 40;
          if ((f === 'offense' && GI.POS[c.pos].side === 'O') || (f === 'defense' && GI.POS[c.pos].side === 'D') || (f === 'special' && c.pos === 'KP')) bonus += 0.8;
          if (c.age <= 25) {
            const m = mentorsHere.find((x) => x.id !== c.id && x.pos === c.pos);
            if (m) { bonus += 1.2; if (mine) mentors.push(`${GI.shortName(m.name)} took ${GI.shortName(c.name)} under his wing`); }
          }
          if (f === 'conditioning') c.dur = clamp(c.dur + 6, 30, 99);
          GI.dev.campGrowth(c, { gym, bonus });
          const jump = GI.dev.breakthrough(c, (c.spark || 0.05) + (gym - 1) * 0.02 + (mine && intense ? 0.03 : 0));
          if (jump) { c.spark = 0.02; breaks.push({ team: i, name: c.name, pos: c.pos, jump, rating: c.rating }); }
          if (mine) growth.push({ name: c.name, pos: c.pos, d: c.rating - before, rating: c.rating });
        });
        continue;
      }
      const mine = i === S.user;
      const r = S.rosters[i];
      // CPU teams work on their weakest unit
      let f = mine ? focus : pick(Object.keys(FOCUS));
      if (!mine) { const b = r.base; f = (b.run + b.pass + b.ol) / 3 < (b.runD + b.passD + b.rush) / 3 ? 'offense' : 'defense'; if (R() < 0.25) f = pick(Object.keys(FOCUS)); }
      const gymLv = mine ? S.up.gym : 2 + Math.min(2, S.dynasty || 0) * 0.5;
      const mult = mine && intense ? 2 : 1;
      for (const k in FOCUS[f].base) r.base[k] = clamp(r.base[k] + FOCUS[f].base[k] * mult, 40, 85);
      const all = S_.allStars(S, i);
      const mentorsHere = all.filter((m) => (m.traits || []).includes('mentor') && m.age >= 27);
      S_.allStars(S, i).forEach((s) => {
        const before = s.rating;
        let g = s.age <= 25 ? gauss(2.5, 2) : s.age <= 29 ? gauss(0.5, 1.5) : s.age <= 32 ? gauss(-1.5, 1.5) : gauss(-3, 2);
        g += (gymLv - 1) * 0.5 + (mine && intense ? 1 : 0);
        if ((s.traits || []).includes('gymrat')) g += 1.5;
        // a veteran mentor at the same position (or side of the ball) speeds up young stars
        if (s.age <= 25) {
          const m = mentorsHere.find((x) => x.id !== s.id && x.pos === s.pos) || mentorsHere.find((x) => x.id !== s.id && OFFENSE.includes(x.pos) === OFFENSE.includes(s.pos));
          if (m) { const b = m.pos === s.pos ? 1.8 : 0.7; g += b; if (mine) mentors.push(`🎓 ${GI.shortName(m.name)} took ${GI.shortName(s.name)} under his wing (+${b})`); }
        }
        if (f === 'special' && s.pos === 'KP') g += 2;
        if (f === 'conditioning') s.dur = clamp(s.dur + 6, 30, 99);
        s.rating = Math.round(clamp(s.rating + g, 45, Math.max(s.pot, s.rating)));
        // the breakthrough: young stars can suddenly explode
        if ((s.age <= 25 || s.yrsPro <= 2) && R() < (s.spark || 0.05) + (gymLv - 1) * 0.02 + (mine && intense ? 0.03 : 0)) {
          const jump = ri(8, 15);
          s.rating = Math.min(99, s.rating + jump);
          s.pot = Math.max(s.pot, s.rating + 2);
          s.spark = 0.02;
          breaks.push({ team: i, name: s.name, pos: s.pos, jump, rating: s.rating });
        }
        if (mine) growth.push({ name: s.name, pos: s.pos, d: s.rating - before, rating: s.rating });
      });
    }
    if (isV1(S)) { growth.sort((a, b) => b.d - a.d); tierDiff(S, tiers0); }
    // intense camp can tweak a hamstring
    if (intense && R() < 0.12) {
      const st = pick(S.rosters[S.user].stars);
      if (st) { S.inj[st.id] = ri(1, 2); growth.push({ name: st.name, pos: st.pos, d: 0, rating: st.rating, hurt: true }); }
    }
    S.campFocus = focus;
    GI.league.seasonStart(S);
    const mineBreaks = breaks.filter((b) => b.team === S.user);
    const p = blankPaper(S, 'Spring Training');
    if (mineBreaks.length) {
      const b = mineBreaks[0];
      p.headline = `BREAKTHROUGH! ${b.name.split(' ').pop().toUpperCase()} EXPLODES AT ${T(S.user).name.toUpperCase()} CAMP`;
      p.sub = `The ${GI.POS[b.pos].full.toLowerCase()} jumped +${b.jump} to a ${b.rating} OVR. Coaches are giddy.`;
    } else if (breaks.length) {
      const b = breaks[0];
      p.headline = `${T(b.team).name.toUpperCase()} ${GI.POS[b.pos].label} ${b.name.split(' ').pop().toUpperCase()} HAS A BREAKTHROUGH CAMP`;
      p.sub = `${T(S.user).city} wraps a ${FOCUS[focus].name.toLowerCase()}-focused camp${intense ? ' that pushed everyone to the limit' : ''}.`;
    } else {
      p.headline = `${T(S.user).name.toUpperCase()} BREAK CAMP READY TO ROLL`;
      p.sub = `A ${FOCUS[focus].name.toLowerCase()}-focused camp${intense ? ', run at full intensity' : ''}.`;
    }
    p.left = S.user; p.right = (breaks.find((b) => b.team !== S.user) || { team: (S.user + 5) % 32 }).team;
    p.caption = 'Two-a-days in the summer heat.';
    p.sections = [
      { title: 'Your Camp Report', items: growth.filter((g) => g.d || g.hurt).slice(0, 12).map((g) => `${GI.POS[g.pos].label} ${g.name}: ${g.hurt ? 'tweaked a hamstring' : (g.d >= 0 ? '+' : '') + g.d + ' → ' + g.rating}`).concat(growth.filter((g) => !g.d && !g.hurt).length ? [`${growth.filter((g) => !g.d && !g.hurt).length} players held steady.`] : []) },
      { title: 'Breakthroughs Around the League', items: breaks.length ? breaks.slice(0, 8).map((b) => `${T(b.team).abbr} ${GI.POS[b.pos].label} ${b.name} +${b.jump} (${b.rating})`) : ['None this spring.'] },
    ];
    if (mentors.length) p.sections.splice(1, 0, { title: 'Mentors', items: mentors });
    p.sections.push({ title: "The Owner's Expectations", items: S.goals.map((g) => `🎯 ${g.text} (+${S_.money(g.reward)})`) });
    S.phase = 'regular';
    pushPaper(S, p);
    return p;
  };

  // ================= helpers =================
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
  S_.place = (S, i) => S_.sorted(S, S_.division(i)).indexOf(i) + 1;
  S_.current = function (S) {
    if (S.phase === 'regular') {
      const g = S.schedule[S.week].find((x) => x.h === S.user || x.a === S.user);
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
  S_.injuredIds = (S) => Object.keys(S.inj).filter((k) => S.inj[k] > 0).concat(Object.keys(S.holdout || {}));
  S_.injuredFor = (S, i) => S_.allStars(S, i).filter((s) => S.inj[s.id] > 0 || (S.holdout || {})[s.id]).map((s) => ({ s, weeks: S.inj[s.id] || S.holdout[s.id], holdout: !!(S.holdout || {})[s.id] }));
  // questionable = a one-week injury: you can push him to play hurt
  S_.questionable = (S, i) => S_.allStars(S, i).filter((s) => S.inj[s.id] === 1 && !(S.holdout || {})[s.id]);
  function homeCrowd(S, i) {
    const r = S.rec[i], wp = S_.pct(r);
    const lv = i === S.user ? S.up.stadium : 2;
    const hype = i === S.user ? ((S.hype || 40) - 50) / 4 : 0;
    return clamp(30 + lv * 9 + wp * 25 + R() * 10 + hype, 20, 97);
  }
  // what the hub shows before kickoff: where, roof, surface and the odds
  S_.forecast = function (S) {
    const c = S_.current(S);
    if (!c || !c.game) return null;
    const homeIdx = c.home ? S.user : c.opp;
    const v = c.ironBowl ? Object.assign({}, GI.NEUTRAL_VENUE) : GI.venueOf(homeIdx, S);
    const when = S.phase === 'playoffs' ? 1 : S.week / Math.max(1, S.weeks - 1);
    if (v.roof === 'dome') return { v, list: [{ k: 'dome', p: 100 }] };
    const w = GI.climateOdds(v.climate, when); let tot = 0; for (const k in w) tot += w[k];
    const list = Object.keys(w).map((k) => ({ k, p: Math.round((w[k] / tot) * 100) })).filter((x) => x.p > 0).sort((a, b) => b.p - a.p);
    if (S.mods && S.mods.weather) return { v, list: [{ k: GI.underRoof(v, S.mods.weather).weather, p: 90 }], storm: true };
    return { v, list };
  };
  S_.gameOptions = function (S) {
    const c = S_.current(S);
    const m = S.mods || {};
    const homeIdx = c.home ? S.user : c.opp, awayIdx = c.home ? c.opp : S.user;
    const userSide = c.home ? 'home' : 'away';
    const morale = { home: S.morale[homeIdx] || 0, away: S.morale[awayIdx] || 0 };
    morale[userSide] += (S.up.stadium - 1) * 1.5 + (m.morale || 0);
    let crowdLevel = homeCrowd(S, homeIdx);
    if (c.playoff) crowdLevel = c.ironBowl ? 95 : 90;
    if (m.crowdLevel && c.home) crowdLevel = m.crowdLevel;
    const teamData = {}; teamData[homeIdx] = S.rosters[homeIdx]; teamData[awayIdx] = S.rosters[awayIdx];
    // playing through a minor injury
    const hurt = Object.keys(S.playHurt || {}).filter((id) => S.inj[id] === 1);
    if (hurt.length) teamData[S.user] = Object.assign({}, S.rosters[S.user], { stars: S.rosters[S.user].stars.map((s) => hurt.includes(s.id) ? Object.assign({}, s, { hurt: true }) : s) });
    let starMeter = m.starMeter ? Object.assign({}, m.starMeter) : {};
    if (S.campFocus === 'conditioning') S.rosters[S.user].stars.forEach((s) => { if (starMeter[s.id] == null) starMeter[s.id] = 40 + ri(0, 15); });
    const ed = GI.league.edgesFor(S, homeIdx, awayIdx);
    // career totals going in, so milestones can pop mid-game
    const careerBase = {};
    S_.allStars(S, S.user).forEach((s) => { const b = Object.assign({}, s.career || {}); const ss = S.sstats[s.id] || {}; GI.PSK.forEach((k) => { if (ss[k]) b[k] = (b[k] || 0) + ss[k]; }); careerBase[s.id] = b; });
    const when = S.phase === 'playoffs' ? 1 : S.week / Math.max(1, S.weeks - 1);
    const venue = c.ironBowl ? Object.assign({}, GI.NEUTRAL_VENUE) : GI.venueOf(homeIdx, S);
    const effExtra = {};
    if (isV1(S) && S.practice && S.practice.focus === 'film') effExtra[userSide] = [{ label: 'Film study', v: 1, scope: 'all' }];
    return {
      effExtra, cpuPotw: isV1(S) && GI.FORMATIONS ? goTo(S, c.opp) : null,
      venue, when, neutral: !!c.ironBowl,
      user: S.user, opp: c.opp, userHome: c.home, qMin: S.qMin, diff: S.diff, teamData,
      injured: S_.injuredIds(S).filter((id) => !hurt.includes(id)), morale, weather: m.weather || null, crowdLevel,
      playoff: c.playoff, intel: m.intel ? true : null, film: !!m.film, starMeter, label: c.label,
      edges: ed.edges, rivalry: ed.rivalry, book: S.book.game, careerBase, hurt,
    };
  };

  // ================= weekly results =================
  function injWeeks(S, teamIdx) {
    const r = R();
    let w = r < 0.55 ? 1 : r < 0.85 ? 2 : r < 0.96 ? 3 : 6;
    if (teamIdx === S.user) {
      const md = S.up.medical;
      if (w === 6 && md >= 3) w = 3;
      if (md >= 2 && R() < 0.25 * (md - 1)) w = Math.max(1, w - 1);
    }
    return w;
  }
  function applyResult(S, g, G, playoff) {
    g.hs = G.score.home; g.as = G.score.away; g.done = true; g.ot = !!G.ot;
    if (isV1(S)) GI.dev.afterGame(S, g, G);
    if (playoff) g.win = g.hs > g.as ? g.h : g.a;
    else {
      const H = S.rec[g.h], A = S.rec[g.a];
      H.pf += g.hs; H.pa += g.as; A.pf += g.as; A.pa += g.hs;
      if (g.hs > g.as) { H.w++; A.l++; H.streak = Math.max(1, H.streak + 1); A.streak = Math.min(-1, A.streak - 1); }
      else if (g.hs < g.as) { A.w++; H.l++; A.streak = Math.max(1, A.streak + 1); H.streak = Math.min(-1, H.streak - 1); }
      else { H.t++; A.t++; H.streak = 0; A.streak = 0; }
      const win = g.hs > g.as ? g.h : g.hs < g.as ? g.a : null, lose = win == null ? null : win === g.h ? g.a : g.h;
      if (win != null) { S.morale[win] = clamp(S.morale[win] + 2, -10, 10); S.morale[lose] = clamp(S.morale[lose] - 2, -10, 10); }
    }
    GI.gameInjuries(G).forEach((i) => {
      const hurtPlay = (G.hurtIds || []).includes(i.id);
      if ((S.holdout || {})[i.id]) return;
      if (S.inj[i.id] > 0 && !hurtPlay) return;
      S.inj[i.id] = injWeeks(S, i.team) + (hurtPlay ? 2 : 0);
      (S._newInj = S._newInj || []).push({ team: i.team, name: i.name, pos: i.pos, weeks: S.inj[i.id], aggravated: hurtPlay });
    });
    GI.league.afterGame(S, g, G, playoff);
    (G.benchUsed || []).forEach((b) => {
      const r = S.rosters[b.team];
      if (r.bench && r.bench.id === b.id && !r.bench.contract.active) {
        r.bench.contract.active = true;
        (S._benchNews = S._benchNews || []).push(b);
      }
    });
  }
  S_.finishWeek = function (S, userG) {
    const c = S_.current(S);
    const tiers0 = isV1(S) ? tierSnap(S) : null;
    S._newInj = []; S._benchNews = []; S._levelUps = [];
    S._practice = isV1(S) ? GI.dev.practiceWeek(S) : [];
    const healing = Object.keys(S.inj).filter((k) => S.inj[k] > 0); // these heal after this week's games
    const highlights = [], results = [];
    const playoff = S.phase === 'playoffs';
    const games = playoff ? S.bracket.rounds[S.bracket.round] : S.schedule[S.week];
    let mine = null;
    games.forEach((g) => {
      if (g.done) return;
      const isMine = g.h === S.user || g.a === S.user;
      let G;
      if (isMine && userG) G = userG;
      else if (isMine) G = simUser(S, g);
      else G = simCPU(S, g, playoff);
      applyResult(S, g, G, playoff);
      (G.highlights || []).forEach((h) => highlights.push({ text: h, game: g }));
      if (isMine) {
        mine = { g, G };
        G.log.filter((l) => l.type === 'star').forEach((l) => highlights.unshift({ text: l.text, game: g, mine: true }));
        const us = g.h === S.user ? g.hs : g.as, them = g.h === S.user ? g.as : g.hs;
        S.seasonStats.gp++; S.seasonStats.pf += us; S.seasonStats.pa += them;
        // how you do in the elements, all-time
        const wk = G.weather || 'clear';
        S.wxRec = S.wxRec || {};
        const wr = S.wxRec[wk] = S.wxRec[wk] || { w: 0, l: 0, t: 0 };
        if (us > them) wr.w++; else if (us < them) wr.l++; else wr.t++;
        // gate receipts
        if (g.h === S.user) {
          const wp = S_.pct(S.rec[S.user]);
          const hypeM = 0.75 + (S.hype || 40) / 200;
          const gate = (playoff ? 3 + S.up.stadium * 0.5 : (1.4 + 0.4 * (S.up.stadium - 1)) * (0.7 + 0.6 * wp) * (S.mods.crowdLevel ? 1.3 : 1)) * hypeM;
          if (playoff) S.fin.playoffs += gate; else S.fin.tickets += gate;
          S.cash += gate;
        }
        // rookies who show out can break through mid-season
        (G.crazyLog && !isV1(S) ? Object.keys(G.crazyLog) : []).forEach((nm) => {
          const st = S_.allStars(S, S.user).find((x) => GI.shortName(x.name) === nm);
          if (st && (st.yrsPro <= 1) && R() < 0.08 + (S.up.gym - 1) * 0.015) {
            const jump = ri(5, 10); st.rating = Math.min(99, st.rating + jump); st.pot = Math.max(st.pot, st.rating + 1);
            (S._breaks = S._breaks || []).push({ name: st.name, pos: st.pos, jump, rating: st.rating });
          }
        });
      }
      results.push(g);
    });
    S.mods = {};
    healing.forEach((k) => { if (S.inj[k] > 0) { S.inj[k]--; if (!S.inj[k]) delete S.inj[k]; } });
    if (isV1(S)) { GI.dev.fillAll(S); tierDiff(S, tiers0); }
    S.playHurt = {};
    // what the coach said at the podium carries into next week
    if (S.pressMods) { S.mods.morale = (S.mods.morale || 0) + (S.pressMods.morale || 0); if (S.pressMods.starMeter) S.mods.starMeter = Object.assign({}, S.pressMods.starMeter); S.pressMods = null; }
    const paper = buildPaper(S, c, mine, results, highlights);
    if (S.phase === 'regular') {
      S.week++;
      if (S.week >= S.weeks) startPlayoffs(S, paper);
    } else advanceBracket(S, paper);
    pushPaper(S, paper);
    return paper;
  };
  function simUser(S, g) {
    const o = S_.gameOptions(S);
    const G = GI.newGame(Object.assign({}, o, { qMin: S.qMin, user: g.h, opp: g.a, userHome: true, potw: { off: 'short', def: 'zone' } }));
    G.diff = 'sim';
    G.hurtIds = o.hurt;
    GI.finishAuto(G);
    // the sim still produces highlights for the season reel
    const me = g.h === S.user ? 'home' : 'away';
    G.reelCands = (G.lastAuto || []).filter((r) => r.crazy || r.td || r.clash).map((r) => ({ res: r, score: GI.league.reelScore(r) + (r.side === me || (r.crazy && r.crazy.team === me) ? 3 : -4), user: me, home: g.h, away: g.a, text: r.text })).filter((x) => x.score > 3).sort((a, b) => b.score - a.score).slice(0, 3);
    G.crazyLog = {};
    (G.lastAuto || []).forEach((r) => { if (r.crazy && r.crazy.team === me) G.crazyLog[r.crazy.name] = (G.crazyLog[r.crazy.name] || 0) + 1; });
    return G;
  }
  function simCPU(S, g, playoff) {
    const teamData = {}; teamData[g.h] = S.rosters[g.h]; teamData[g.a] = S.rosters[g.a];
    const ed = GI.league.edgesFor(S, g.h, g.a);
    // in the playoffs, CPU teams push questionable stars onto the field
    const inj = S_.injuredIds(S).filter((id) => !(playoff && S.inj[id] === 1 && R() < 0.6));
    const when = playoff ? 1 : S.week / Math.max(1, S.weeks - 1);
    const venue = g.neutral ? Object.assign({}, GI.NEUTRAL_VENUE) : GI.venueOf(g.h, S);
    return GI.simGame(g.h, g.a, { venue, when, qMin: S.qMin, injured: inj, teamData, playoff, crowdLevel: playoff ? 88 : homeCrowd(S, g.h), morale: { home: S.morale[g.h] || 0, away: S.morale[g.a] || 0 }, edges: ed.edges, rivalry: ed.rivalry });
  }
  function pushPaper(S, p) {
    S.paper = p;
    S.news.unshift(p);
    if (S.news.length > 30) S.news.pop();
    S_.save(S);
  }

  // ================= playoffs =================
  function startPlayoffs(S, paper) {
    S.phase = 'playoffs';
    const sd = [0, 1].map((ci) => S_.sorted(S, [...Array(32).keys()].filter((i) => confOf(i) === ci)).slice(0, 6));
    const seedOf = {};
    sd.forEach((list) => list.forEach((t, k) => (seedOf[t] = k + 1)));
    const mk = (h, a, conf) => ({ h, a, conf, hs: null, as: null, done: false });
    const wc = [];
    sd.forEach((list, ci) => { wc.push(mk(list[2], list[5], ci)); wc.push(mk(list[3], list[4], ci)); });
    S.bracket = { seeds: sd, seedOf, round: 0, rounds: [wc] };
    const userIn = seedOf[S.user];
    paper.userPlayoff = userIn ? `${T(S.user).name} clinch the #${userIn} seed in the ${CONFS[confOf(S.user)]} Conference!` : `${T(S.user).name} miss the playoffs.`;
  }
  function advanceBracket(S, paper) {
    const B = S.bracket, rd = B.rounds[B.round];
    const winners = rd.map((g) => g.win);
    const seedOf = B.seedOf;
    if (B.round === 0) {
      if (winners.includes(S.user)) GI.legacy && GI.legacy.addLP(3, 'Playoff win');
      const next = [];
      [0, 1].forEach((ci) => {
        const w = winners.filter((t) => confOf(t) === ci).sort((a, b) => seedOf[a] - seedOf[b]);
        next.push({ h: B.seeds[ci][0], a: w[w.length - 1], conf: ci, hs: null, as: null, done: false });
        next.push({ h: B.seeds[ci][1], a: w[0], conf: ci, hs: null, as: null, done: false });
      });
      B.rounds.push(next); B.round = 1;
    } else if (B.round === 1) {
      if (winners.includes(S.user)) GI.legacy && GI.legacy.addLP(3, 'Playoff win');
      B.rounds.push([0, 1].map((ci) => {
        const w = winners.filter((t) => confOf(t) === ci).sort((a, b) => seedOf[a] - seedOf[b]);
        return { h: w[0], a: w[1], conf: ci, hs: null, as: null, done: false };
      }));
      B.round = 2;
    } else if (B.round === 2) {
      const better = S_.sorted(S, winners);
      if (winners.includes(S.user)) { S.fin.bonus += 4; S.cash += 4; GI.legacy && GI.legacy.addLP(6, 'Conference champions'); }
      B.rounds.push([{ h: better[0], a: better[1], conf: -1, hs: null, as: null, done: false, neutral: true }]);
      B.round = 3;
    } else {
      S.champion = winners[0];
      paper.champion = winners[0];
      S.history.unshift({ year: S.year, champ: winners[0], user: S.user, rec: S_.recStr(S.rec[S.user]) });
      // championship rings for everyone on the roster
      S_.allStars(S, winners[0]).forEach((st) => (st.rings = (st.rings || 0) + 1));
      if (winners[0] === S.user) {
        // the Iron-Bowl purse: money for next year's draft
        S.fin.bonus += 15; S.cash += 15; S.records.titles++;
        paper.bonus = 15;
        paper.special = 'champs';
        S.hype = clamp((S.hype || 40) + 15, 0, 100);
        if (GI.legacy) { GI.legacy.addLP(25, 'Iron-Bowl champions'); GI.legacy.collect(S_.allStars(S, S.user).map((st) => GI.league.sticker(S, st, S.user)), 'Champion'); }
        try {
          const t = JSON.parse(localStorage.getItem('gridiron_trophies') || '[]');
          t.unshift({ year: S.year, team: S.user, kind: 'Iron-Bowl Champions', rec: S_.recStr(S.rec[S.user]) });
          localStorage.setItem('gridiron_trophies', JSON.stringify(t));
        } catch (e) {}
      }
      startOffseason(S, paper);
    }
  }

  // ================= offseason =================
  function startOffseason(S, paper) {
    S.phase = 'offseason';
    // awards night & the record book (before anyone ages or retires)
    const awards = GI.league.computeAwards(S);
    const recs = GI.league.rollSeason(S);
    paper.awards = S.year;
    // books for the year
    const salaries = S_.salaryTotal(S, S.user);
    const upkeep = Object.values(S.up).reduce((t, l) => t + (l - 1) * 1.1, 0);
    const staff = r1(GI.league.staffCost(S, S.user));
    const tv = isV1(S) ? Math.round((S.cap || 62) * 0.92) : 25; // v1: the TV deal grows with the cap
    const rev = tv + S.fin.tickets + S.fin.playoffs + S.fin.bonus;
    const exp = salaries + upkeep + staff;
    S.cash += tv - salaries - upkeep - staff; // gates & bonuses were banked as they came in
    S.fin.reports.unshift({ year: S.year, tv, tickets: r1(S.fin.tickets), playoffs: r1(S.fin.playoffs), bonus: r1(S.fin.bonus), events: r1(S.fin.events), salaries: r1(salaries), upkeep: r1(upkeep), staff, rev: r1(rev), exp: r1(exp + S.fin.events), cash: r1(S.cash) });
    S.fin.reports.length = Math.min(S.fin.reports.length, 6);
    S.fin.tickets = 0; S.fin.playoffs = 0; S.fin.bonus = 0; S.fin.events = 0;
    // contracts run down, players age, legends retire
    const retired = [], cpuMoves = [], hofs = [], newCoaches = [];
    S.expiring = [];
    for (let i = 0; i < 32; i++) {
      const r = S.rosters[i];
      S_.allStars(S, i).forEach((s) => {
        s.age++; s.yrsPro++; s.rookie = false;
        if (s.contract.active) s.contract.years--;
        if (r.v === 1) GI.dev.ageDecline(s);
      });
      const keep = (s) => {
        if (s.age >= 37 || (s.age >= 34 && R() < 0.45) || (s.age >= 32 && s.rating < 70 && R() < 0.4) || (s.age >= 33 && R() < 0.2)) {
          retired.push({ team: i, s });
          const out = GI.league.onRetire(S, s, i);
          if (out.hof) hofs.push(out.hof);
          if (out.coach) newCoaches.push({ c: out.coach, team: i });
          return false;
        }
        return true;
      };
      r.stars = r.stars.filter(keep);
      if (r.benchList) r.benchList = r.benchList.filter(keep);
      if (r.bench && !keep(r.bench)) r.bench = null;
      S_.allStars(S, i).forEach((s) => {
        if (s.contract.years > 0) return;
        if (i === S.user) { S.expiring.push(s.id); s.ask = askSalary(s); return; }
        const ask = askSalary(s);
        const room = (S.cap || 38) - (S_.salaryTotal(S, i) - s.contract.salary);
        if (s.rating >= (r.v === 1 ? 64 : 72) && R() < (r.v === 1 ? 0.8 : 0.72) && ask <= room) { s.contract = { years: ri(1, 3), salary: ask, active: true }; delete s.raise; cpuMoves.push(`${T(i).abbr} re-sign ${GI.POS[s.pos].label} ${s.name}`); }
        else {
          removeFromRoster(S, i, s.id);
          S.freeAgents.push(Object.assign({}, s, { contract: null, lastTeam: i, leftHow: 'walked', ask }));
          cpuMoves.push(`${T(i).abbr} let ${GI.POS[s.pos].label} ${s.name} walk${ask > room ? ' (cap crunch)' : ''}`);
        }
      });
    }
    if (isV1(S)) { GI.dev.anchorLeague(S, 70); GI.dev.fillAll(S); }
    paper.offseason = true;
    const carousel = GI.league.offseasonLeague(S);
    const review = GI.league.ownerReview(S);
    S.review = review;
    if (review.fired) S.fired = { offers: GI.league.jobOffers(S) };
    S.faDone = false; S.faOffers = {};
    const A = awards;
    const nm = (x) => x ? `${T(x.team).abbr} ${GI.POS[x.pos] ? GI.POS[x.pos].label + ' ' : ''}${x.name}${x.line ? ' — ' + x.line : ''}` : '—';
    paper.sections = (paper.sections || []).concat([
      { title: '🏆 Awards Night', items: [`MVP: ${nm(A.mvp)}`, `Offensive POY: ${nm(A.opoy)}`, `Defensive POY: ${nm(A.dpoy)}`, `Rookie of the Year: ${nm(A.roy)}`, `Coach of the Year: ${A.coy.name} (${T(A.coy.team).abbr}, ${A.coy.line})`] },
      { title: `The Owner's Box`, items: [`${S.owner.name} ${review.verdict}. ${review.met}/${review.total} goals met${review.bonus ? `, ${S_.money(review.bonus)} in bonuses` : ''}.`].concat(review.res.map((x) => `${x.done ? '✅' : '❌'} ${x.g.text}`)) },
    ]);
    if (hofs.length) paper.sections.push({ title: '🏛️ Hall of Fame Class', items: hofs.map((h) => `${GI.POS[h.pos].label} ${h.name} (${T(h.team).abbr}) — ${h.line}${h.rings ? ` · ${h.rings}× champ` : ''}`) });
    if (recs.length) paper.sections.push({ title: '📜 Record Book', items: recs.slice(0, 6).map((r) => `New ${r.scope} record: ${r.name} (${T(r.team).abbr}) — ${r.v.toLocaleString()} ${GI.STAT_NAME[r.key]}`) });
    if (newCoaches.length) paper.sections.push({ title: 'From the Field to the Sideline', items: newCoaches.slice(0, 4).map((x) => `${x.c.name} retires and wants to coach (${x.c.rating} rtg${x.c.style ? ', ' + (GI.OC_STYLES[x.c.style] || GI.DC_STYLES[x.c.style]) : ''}). He's in the coaching pool${x.team === S.user ? ' — hire him from the Front Office' : ''}.`) });
    if (carousel.length) paper.sections.push({ title: 'Coaching Carousel', items: carousel.slice(0, 7) });
    paper.sections = paper.sections.concat([
      { title: 'Front Office Report', items: [`Revenue ${S_.money(rev)} · Expenses ${S_.money(exp)}`, `Cash on hand: ${S_.money(S.cash)}`].concat(paper.bonus ? [`Iron-Bowl purse: +${S_.money(paper.bonus)} for the draft!`] : []) },
      { title: 'Retirements', items: retired.length ? retired.slice(0, 8).map((x) => `${T(x.team).abbr} ${GI.POS[x.s.pos].label} ${x.s.name} (age ${x.s.age})${x.team === S.user ? ' 👋' : ''}`) : ['Nobody hung up the cleats this year.'] },
      { title: 'Contract Watch', items: S.expiring.length ? S.expiring.map((id) => { const s = S_.allStars(S, S.user).find((x) => x.id === id); return `${GI.POS[s.pos].label} ${s.name} wants ${S_.money(s.ask)}/yr`; }) : ['No expiring deals on your roster.'] },
      { title: 'Around the League', items: cpuMoves.slice(0, 6) },
    ]);
  }
  S_.resign = function (S, starId, years) {
    const s = S_.allStars(S, S.user).find((x) => x.id === starId);
    if (!s) return { ok: false, why: 'Not on the roster' };
    const sal = s.ask || askSalary(s);
    const others = S_.salaryTotal(S, S.user) - (s.contract && s.contract.active ? s.contract.salary : 0);
    if (others + sal > (S.cap || 38)) return { ok: false, why: `That puts you over the ${S_.money(S.cap || 38)} cap. Clear room first.` };
    s.contract = { years, salary: sal, active: true };
    delete s.raise;
    S.expiring = S.expiring.filter((x) => x !== starId);
    S_.save(S);
    return { ok: true };
  };
  // ---------- stadium projects: roof and surface ----------
  S_.PROJECTS = {
    turf: { name: 'Install fast turf', icon: '⚡', cost: 8, ok: (v) => v.surface === 'grass', set: { surface: 'turf' }, desc: 'Outside runs and deep balls get a lift for everyone. A few more injuries.' },
    blue: { name: 'Paint it blue', icon: '💙', cost: 10, ok: (v) => v.surface !== 'blue', set: { surface: 'blue' }, desc: 'Fast turf that throws visitors off. Fans love it (+8 hype).', hype: 8 },
    grass: { name: 'Lay natural grass', icon: '🌱', cost: 6, ok: (v) => v.surface !== 'grass', set: { surface: 'grass' }, desc: 'Back to basics. Sloppy in bad weather — good for ground-and-pound teams.' },
    retract: { name: 'Build a retractable roof', icon: '🪟', cost: 30, ok: (v) => v.roof !== 'retract', set: { roof: 'retract' }, desc: 'Open on nice days, closed when the weather turns (+6 hype).', hype: 6 },
    dome: { name: 'Build a dome', icon: '🏟️', cost: 24, ok: (v) => v.roof !== 'dome', set: { roof: 'dome' }, desc: 'No weather ever, and the noise bounces off the roof (+5 hype).', hype: 5 },
    open: { name: 'Tear off the roof', icon: '🌤️', cost: 5, ok: (v) => v.roof !== 'open', set: { roof: 'open' }, desc: 'Real football weather. Cold-weather teams get their home edge back.' },
  };
  S_.canRenovate = (S) => S.phase === 'offseason' || S.phase === 'draft' || S.phase === 'camp';
  S_.renovate = function (S, key) {
    const p = S_.PROJECTS[key], v = GI.venueOf(S.user, S);
    if (!p || !p.ok(v) || S.cash < p.cost || !S_.canRenovate(S)) return false;
    S.cash -= p.cost; S.fin.events = (S.fin.events || 0) + p.cost;
    S.stadium = Object.assign({}, S.stadium || {}, p.set);
    if (p.hype) S.hype = clamp((S.hype || 40) + p.hype, 0, 100);
    (S.stadiumLog = S.stadiumLog || []).push({ year: S.year, key });
    S_.save(S);
    return true;
  };
  S_.renameStadium = function (S, name) {
    name = String(name || '').replace(/[<>]/g, '').trim().slice(0, 28);
    if (!name) return false;
    S.stadium = Object.assign({}, S.stadium || {}, { name });
    S_.save(S); return true;
  };
  // home and road records for a team this season
  S_.splits = function (S, i) {
    const o = { home: { w: 0, l: 0, t: 0 }, away: { w: 0, l: 0, t: 0 } };
    (S.schedule || []).forEach((wk) => wk.forEach((g) => {
      if (!g.done || (g.h !== i && g.a !== i)) return;
      const k = g.h === i ? 'home' : 'away', us = g.h === i ? g.hs : g.as, them = g.h === i ? g.as : g.hs;
      if (us > them) o[k].w++; else if (us < them) o[k].l++; else o[k].t++;
    }));
    return o;
  };
  S_.upgradeCost = (S, key) => UPGRADES[key].cost[S.up[key] + 1];
  S_.upgrade = function (S, key) {
    const c = S_.upgradeCost(S, key);
    if (!c || S.cash < c) return false;
    S.cash -= c; S.fin.events += c; S.up[key]++;
    S_.save(S);
    return true;
  };
  S_.advanceToDraft = function (S) {
    // unsigned expiring stars leave
    (S.expiring || []).forEach((id) => S_.release(S, id, 'walked'));
    S.expiring = [];
    // the rest of the league fills holes from free agency before the draft
    if (!S.faDone) GI.league.runFA(S);
    S.lastChamp = S.champion;
    S.year++;
    S.week = 0;
    S.schedule = makeSchedule(S.weeks);
    const lastRec = S.rec;
    S.draft = makeDraft(S, false, isV1(S) ? 3 : Math.min(8, 3 + S.year));
    S.rec = freshRec();
    S.lastRec = lastRec;
    S.bracket = null; S.champion = null; S.inj = {}; S.mods = {};
    S.morale = S.morale.map((m) => Math.round(m / 2));
    S.seasonStats = { gp: 0, pf: 0, pa: 0 };
    S.phase = 'draft';
    S.review = null;
    S_.save(S);
  };

  // ================= the Grid-Iron Gazette =================
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
  const PUBS = ['the Brass Tap', "O'Malley's Pub", 'the Corner Keg', "Rosie's Tavern", 'the Iron Horse Saloon'];
  const JOBS = ['pours drinks at', 'drives a forklift near', 'flips burgers at', 'coaches peewee football by', 'works the night shift at'];

  function blankPaper(S, label) {
    return { year: S.year, label, phase: S.phase, scores: [], injuries: [], event: null, id: Date.now() + Math.floor(R() * 1000), sections: [] };
  }
  S_.blankPaper = blankPaper;
  function buildPaper(S, c, mine, results, highlights) {
    const ut = T(S.user);
    const p = blankPaper(S, c.label);
    p.week = S.week;
    if (mine) {
      const g = mine.g, us = g.h === S.user ? g.hs : g.as, them = g.h === S.user ? g.as : g.hs;
      const opp = T(g.h === S.user ? g.a : g.h);
      const m = us - them;
      const key = m >= 21 ? 'rout' : m >= 8 ? 'solid' : m > 0 ? 'close' : m === 0 ? 'tie' : m > -8 ? 'heart' : m > -21 ? 'loss' : 'blown';
      p.headline = pick(HEAD[key]).replace('{US}', ut.name.toUpperCase()).replace('{THEM}', opp.name.toUpperCase());
      p.score = `${ut.abbr} ${us}, ${opp.abbr} ${them}${g.ot ? ' (OT)' : ''}`;
      p.left = S.user; p.right = opp.idx;
      const rec = S_.recStr(S.rec[S.user]);
      const loc = g.h === S.user ? 'at home' : `in ${opp.city}`;
      p.sub = m > 0 ? `${ut.city} improves to ${rec} with the win ${loc}.` : m < 0 ? `${ut.city} falls to ${rec} after the loss ${loc}.` : `${ut.city} sits at ${rec} after a stalemate ${loc}.`;
      const MG = mine.G, wxl = { snow: 'in the snow', rain: 'in a downpour', wind: 'through swirling winds', heat: 'in brutal heat', dome: 'under the roof' }[MG && MG.weather];
      if (wxl && MG.venue) p.sub += ` Played ${wxl} at ${MG.venue.name}.`;
      if (MG && MG.weather === 'snow' && (m > 0) && R() < 0.6) p.headline = `${ut.name.toUpperCase()} WIN A SNOW GLOBE GAME`;
      if (c.playoff) {
        p.sub = m > 0 ? (c.ironBowl ? `Champions! ${ut.city} finishes ${rec}.` : `${ut.city} marches on in the playoffs.`) : `A ${rec} season comes to an end.`;
        if (c.ironBowl && m > 0) p.headline = `${ut.name.toUpperCase()} WIN THE IRON-BOWL!`;
        else if (c.ironBowl) p.headline = `${opp.name.toUpperCase()} TAKE THE IRON-BOWL`;
        else if (m < 0) p.headline = `SEASON OVER: ${opp.name.toUpperCase()} END ${ut.name.toUpperCase()}' RUN`;
      }
    } else {
      const g = results[0];
      if (g) {
        const w = g.hs > g.as ? g.h : g.a, l = w === g.h ? g.a : g.h;
        p.headline = c.label === ROUND_NAMES[3] ? `${T(w).name.toUpperCase()} WIN THE IRON-BOWL!` : `${T(w).name.toUpperCase()} ADVANCE PAST ${T(l).name.toUpperCase()}`;
        p.score = `${T(g.h).abbr} ${g.hs}, ${T(g.a).abbr} ${g.as}`;
        p.left = w; p.right = l;
        const bye = c.label === ROUND_NAMES[0] && S.bracket && S.bracket.seedOf[S.user] <= 2;
        p.sub = bye ? `The ${ut.name} rest up on a first-round bye.` : `The ${ut.name} watch from home.`;
      }
    }
    const potw = highlights.find((h) => h.mine) || (highlights.length ? pick(highlights) : null);
    if (potw) p.potw = { text: potw.text };
    p.scores = results.map((g) => ({ h: g.h, a: g.a, hs: g.hs, as: g.as, ot: g.ot }));
    p.injuries = (S._newInj || []).sort((a, b) => (b.team === S.user) - (a.team === S.user)).slice(0, 6)
      .map((i) => ({ team: i.team, text: `${T(i.team).abbr} ${GI.POS[i.pos].label} ${GI.shortName(i.name)} — out ${i.weeks >= 6 ? 'for the season' : i.weeks + ' wk' + (i.weeks > 1 ? 's' : '')}`, mine: i.team === S.user }));
    p.division = S_.sorted(S, S_.division(S.user)).map((i) => ({ i, rec: S_.recStr(S.rec[i]) }));
    const notes = [];
    (S._benchNews || []).forEach((b) => { if (b.team === S.user) notes.push(`🪑 Backup ${GI.POS[b.pos].label} ${b.name} stepped in for ${GI.shortName(b.for)} — his contract is now active.`); });
    (S._breaks || []).forEach((b) => notes.push(`⚡ BREAKTHROUGH: rookie ${GI.POS[b.pos].label} ${b.name} jumps +${b.jump} to ${b.rating} after his big game!`));
    S._breaks = [];
    (S._newInj || []).filter((i) => i.team === S.user && i.aggravated).forEach((i) => notes.push(`🩹 ${GI.shortName(i.name)} aggravated the injury he played through. Out ${i.weeks} weeks.`));
    if (notes.length) p.sections.push({ title: 'Locker Room', items: notes });
    if (isV1(S)) {
      const dev = (S._practice || []).map((x) => `Extra reps paid off: ${GI.POS[x.pos].label} ${x.name} +${x.d} to ${x.rating}`)
        .concat((S._levelUps || []).sort((x, y) => y.d - x.d).map((x) => `${GI.POS[x.pos].label} ${x.name} leveled up: +${x.d} to ${x.rating}`));
      if (dev.length) p.sections.push({ title: 'Player Development', items: dev.slice(0, 8) });
    }
    if (S._quote) { p.quote = S._quote; S._quote = null; }
    GI.league.weekly(S, p);
    const nx = nextUserGame(S);
    p.next = nx;
    if (nx && isV1(S) && GI.FORMATIONS) p.sections.push(scoutReport(S, nx));
    if (nx) p.event = makeEvent(S, nx);
    else if (R() < 0.5) p.event = flavorEvent(S);
    return p;
  }
  function nextUserGame(S) {
    if (S.phase === 'regular' && S.week + 1 < S.weeks) {
      const g = S.schedule[S.week + 1].find((x) => x.h === S.user || x.a === S.user);
      return { opp: g.h === S.user ? g.a : g.h, home: g.h === S.user, label: `Week ${S.week + 2}`, early: S.week + 1 < S.weeks / 2 };
    }
    return null;
  }
  // every team has a go-to play on each side for the season: what its coordinators trust most
  function goTo(S, idx) {
    S.goTo = S.goTo || {};
    const cur = S.goTo[idx];
    if (cur && cur.year === S.year) return cur;
    const c = S.rosters[idx].coaches;
    const off = wpick(GI.spreadOff({ in_run: 22, out_run: 18, short: 28, long: 16, trick: 6 }, c.oc.style));
    const def = wpick(GI.spreadDef({ man: 18, zone: 22, deep: 14, press: 14, blitz_in: 14, blitz_out: 14 }, c.dc.style));
    S.goTo[idx] = { year: S.year, off, def };
    return S.goTo[idx];
  }
  S_.goTo = goTo;
  // the weekly scouting report on the next opponent; sometimes the go-to plays leak
  function scoutReport(S, nx) {
    const op = T(nx.opp), c = S.rosters[nx.opp].coaches, g = goTo(S, nx.opp);
    const form = GI.FORMATIONS.find((f) => f.id === (GI.playOf(g.off) || {}).form);
    const front = GI.FRONTS.find((f) => f.id === (GI.playOf(g.def) || {}).front);
    const items = [`${op.abbr} OC ${c.oc.name.split(' ').pop()} (${GI.OC_STYLES[c.oc.style] || 'balanced'}) lives in ${form ? form.name : 'every formation'}. DC ${c.dc.name.split(' ').pop()} loves his ${front ? front.name : 'base'} package.`];
    let chance = 0.35 + (S.practice && S.practice.focus === 'film' ? 0.25 : 0) + (S.up ? (S.up.scouts || 0) * 0.04 : 0);
    if (S.mods.intel || R() < chance) {
      S.mods.intel = true;
      items.push(`LEAKED: their go-to play is <b>${GI.playName(g.off)}</b>. It dies against <b>${GI.playName(GI.counterOf(g.off))}</b>.`);
      items.push(`On defense they trust <b>${GI.playName(g.def)}</b>. ${GI.playName(GI.OFF_PLAYS.find((p) => p.counter === g.def).id)} walks right into it — call something else.`);
    } else items.push('Their go-to plays stayed in the building this week. Watch their tendencies in the play sheet.');
    return { title: `Scouting Report: ${op.city} ${op.name}`, items };
  }
  function makeEvent(S, nx) {
    const ut = T(S.user), op = T(nx.opp);
    const roster = S.rosters[S.user];
    const healthy = roster.stars.filter((s) => !(S.inj[s.id] > 0) && s.pos !== 'KP');
    const star = healthy.length ? pick(healthy) : null;
    const egoStar = roster.stars.filter((s) => s.ego > 75 && !(S.inj[s.id] > 0))[0];
    const streak = S.rec[S.user].streak;
    const c = roster.coaches;
    // stars who've outplayed their contract want a new deal now
    const underpaid = roster.stars.filter((s) => s.contract && s.contract.active && s.contract.years <= 2 && askSalary(s) >= s.contract.salary + 2.5 && s.ego >= 50 && !S.holdout[s.id] && !(S.inj[s.id] > 0))[0];
    const types = {
      leak: 11, film: 10, dinner: 10, storm: 8, sellout: nx.home ? 4 + Math.max(0, (S.hype || 40) - 40) / 6 : 0, none: 12,
      holdout: underpaid && !S.story.some((x) => x.kind === 'holdoutAsk') ? 9 : 0,
      night: star ? 9 : 0, ego: star ? 8 : 0,
      trade: egoStar && (streak <= -2 || R() < 0.25) ? 9 : 0,
      poach: c.oc.rating >= 74 || c.dc.rating >= 74 ? 6 : 0,
      hotseat: streak <= -3 ? 14 : 0,
      scout: 6 + S.up.scouts * 3,
      walkon: S_.slotFor(S, S.user, 'KP') || !roster.bench ? 3 : 0,
    };
    const t = wpick(types);
    const sn = star ? GI.shortName(star.name) : '';
    switch (t) {
      case 'leak': S.mods.intel = true; return { kind: 'good', tag: 'LEAKED', title: `${op.abbr} Game Plan Leaks!`, body: `A ${op.city} equipment manager left a playbook at a gas station. You'll know their Play of the Week heading into ${nx.label}.`, effect: 'Intel: their Play of the Week is revealed' };
      case 'film': S.mods.film = true; return { kind: 'bad', tag: 'FILM ROOM', title: `${op.name} Pull an All-Nighter on Your Tape`, body: `${op.city}'s staff has been breaking down your Play of the Week. Expect them to sit on it — consider switching it up.`, effect: 'They counter your offensive Play of the Week more often' };
      case 'dinner': S.mods.morale = (S.mods.morale || 0) + 8; return { kind: 'good', tag: 'LOCKER ROOM', title: `Team Dinner Brings ${ut.name} Together`, body: `${GI.shortName(c.hc.name)} rented out a steakhouse for the whole roster. Spirits are high.`, effect: '+8 team morale next game' };
      case 'storm': { const w = pick(['rain', 'snow', 'wind']); S.mods.weather = w; return { kind: 'info', tag: 'FORECAST', title: `${GI.WEATHER[w].icon} ${GI.WEATHER[w].name} Expected for ${nx.label}`, body: `Forecasters say ${GI.WEATHER[w].desc.toLowerCase()}. Plan accordingly.`, effect: `Next game: ${GI.WEATHER[w].name}` }; }
      case 'sellout': S.mods.crowdLevel = 95; return { kind: 'good', tag: 'BOX OFFICE', title: 'SOLD OUT! Fans Pack the Stadium', body: `Every seat is gone for the ${op.name} game. It's going to be deafening — and the gate will be huge.`, effect: 'Deafening home crowd, +30% ticket revenue' };
      case 'night': return { kind: 'choice', tag: 'SCANDAL', star: star.id, title: `${sn} Spotted Out Late at ${pick(VENUES)}`, body: `Photos of the ${GI.POS[star.pos].full.toLowerCase()} hit the internet at 3 a.m. The locker room wants to see how you handle it.`,
        choices: [{ id: 'fine', label: 'Fine him', desc: '+4 team morale, his meter starts at 0' }, { id: 'slide', label: 'Let it slide', desc: 'He starts at 60%, −5 team morale' }] };
      case 'ego': return { kind: 'choice', tag: 'EGO WATCH', star: star.id, title: `${sn} Wants the Spotlight`, body: `"Get me the ball and get out of the way," ${sn} told reporters. Teammates were not amused.`,
        choices: [{ id: 'feature', label: 'Feature him', desc: 'Starts ON FIRE (100%), −6 team morale' }, { id: 'team', label: 'Team first', desc: '+4 team morale' }] };
      case 'trade': {
        const en = GI.shortName(egoStar.name);
        return { kind: 'choice', tag: 'TRADE DEMAND', star: egoStar.id, title: `${en} Demands a Trade!`, body: `"I'm done losing," the ${GI.POS[egoStar.pos].full.toLowerCase()} told the Gazette. His agent says he wants out of ${ut.city} now.`,
          choices: [{ id: 'trade', label: 'Trade him', desc: `He's gone. You get ${S_.money(egoStar.contract.salary * 2 + 2)} in compensation` }, { id: 'keep', label: 'Refuse', desc: '−5 morale, he sulks (meter 0) and may hold out a week' }] };
      }
      case 'poach': {
        const who = c.oc.rating >= c.dc.rating ? 'oc' : 'dc';
        const co = c[who];
        const rival = T(pick([...Array(32).keys()].filter((x) => x !== S.user)));
        return { kind: 'choice', tag: 'STAFF DRAMA', coach: who, rival: rival.idx, title: `${rival.name} Try to Poach ${co.name.split(' ').pop()}`, body: `${rival.city} offered your ${co.role.toLowerCase()} a promotion behind your back. He's listening.`,
          choices: [{ id: 'match', label: 'Match the offer', desc: `Costs ${S_.money(2)}, he stays and is fired up (+3 rating)` }, { id: 'letgo', label: 'Let him go', desc: 'A new coordinator steps in — could be better or worse' }] };
      }
      case 'hotseat': return { kind: 'choice', tag: 'HOT SEAT', title: `Fans Call for Coach ${c.hc.name.split(' ').pop()}'s Job`, body: `${-streak} straight losses and "FIRE ${c.hc.name.split(' ').pop().toUpperCase()}" banners are flying in ${ut.city}.`,
        choices: [{ id: 'fire', label: 'Fire him', desc: `${S_.money(3)} buyout, new head coach, +6 morale bounce` }, { id: 'back', label: 'Back your coach', desc: '−3 morale now, he coaches like his job depends on it (+3)' }] };
      case 'scout': {
        const pos = pick(['QB', 'RB', 'WR', 'TE', 'OL', 'LB', 'DL', 'S', 'CB', 'KP']);
        const p = mkPlayer(S, pos, 'rookie');
        if (R() < 0.35) { p.rating = Math.min(88, p.rating + ri(4, 9)); p.pot = Math.max(p.pot, p.rating + 4); }
        const w = Math.max(2, 5 - S.up.scouts);
        estFor(S, p, w);
        return { kind: 'choice', tag: 'SCOUT REPORT', prospect: p, early: nx.early, title: `Scouts Rave About ${GI.POS[pos].label} ${p.name}`, body: `Your scouts caught the ${p.college} ${GI.POS[pos].full.toLowerCase()} in person. Estimated ${p.est[0]}–${p.est[1]} OVR, potential grade ${p.gradeShown}${p.sparkShown ? ', with real ⚡ Spark' : ''}. ${nx.early ? 'It\'s early — his stock could still rise or fall before the draft.' : 'Late in the year, what you see is what you get.'}`,
          choices: [{ id: 'pursue', label: `Pursue (${S_.money(1)})`, desc: 'Locks him to you through round 2 of the draft, sharper rating range' }, { id: 'pass', label: 'Pass', desc: 'He goes into the open draft pool' }] };
      }
      case 'holdout': {
        const sn2 = GI.shortName(underpaid.name), ask = askSalary(underpaid);
        return { kind: 'choice', tag: 'CONTRACT STANDOFF', star: underpaid.id, ask, title: `${sn2} Wants a New Deal — Now`, body: `The ${GI.POS[underpaid.pos].full.toLowerCase()} is making ${S_.money(underpaid.contract.salary)} and playing like a ${S_.money(ask)} star. His agent says he won't report until he's paid.`,
          choices: [{ id: 'pay', label: `Pay him (${S_.money(ask)}/yr, 3 yrs)`, desc: (S_.salaryTotal(S, S.user) - underpaid.contract.salary + ask > (S.cap || 38)) ? 'You are too close to the cap for this' : '+3 morale, he plays fired up (meter 60)' }, { id: 'firm', label: 'Hold firm', desc: 'He holds out 1–3 weeks, then returns bitter' }] };
      }
      case 'walkon': {
        const kp = !!S_.slotFor(S, S.user, 'KP') && !S.rosters[S.user].stars.some((s) => s.pos === 'KP');
        const pos = kp ? 'KP' : pick(['KP', 'RB', 'WR', 'S']);
        const p = mkPlayer(S, pos, 'rookie');
        p.age = ri(24, 29); p.rating = ri(70, 82); p.pot = p.rating + ri(2, 8); p.spark = 0.25; p.salary = 0.5; p.walkon = true;
        return { kind: 'choice', tag: 'LOCAL LEGEND', prospect: p, title: pos === 'KP' ? 'Bartender Boots 58-Yarder at Open Tryouts' : `Local ${GI.POS[pos].full} Turns Heads at Open Tryouts`, body: `${p.name}, who ${pick(JOBS)} ${pick(PUBS)} in ${ut.city}, stunned your coaches at a public tryout. "I just showed up with my cleats," he said.`,
          choices: [{ id: 'sign', label: `Sign him (${S_.money(0.5)}/yr)`, desc: `${GI.POS[pos].label}, around ${p.rating} OVR, loaded with ⚡ Spark` }, { id: 'pass', label: 'Thank him for coming', desc: 'Back to the pub he goes' }] };
      }
      default: return null;
    }
  }
  function flavorEvent(S) {
    const i = pick([...Array(32).keys()].filter((x) => x !== S.user));
    const t = T(i), c = S.rosters[i].coaches;
    return pick([
      { kind: 'info', tag: 'AROUND THE LEAGUE', title: `${t.name} Coach ${c.hc.name.split(' ').pop()} Under Fire`, body: `Rumors swirl in ${t.city} after a rough stretch. The front office isn't saying much.`, effect: null },
      { kind: 'info', tag: 'AROUND THE LEAGUE', title: `${t.city} Fans Camp Out for Tickets`, body: `Lines wrapped around the stadium overnight. Somebody brought a grill.`, effect: null },
    ]);
  }
  S_.resolveChoice = function (S, paper, choiceId) {
    const ev = paper.event;
    if (!ev || ev.chosen) return;
    ev.chosen = choiceId;
    S.mods.starMeter = S.mods.starMeter || {};
    const roster = S.rosters[S.user];
    const c = ev.choices.find((x) => x.id === choiceId);
    let extra = '';
    if (choiceId === 'fine') { S.mods.morale = (S.mods.morale || 0) + 4; S.mods.starMeter[ev.star] = 0; }
    if (choiceId === 'slide') { S.mods.morale = (S.mods.morale || 0) - 5; S.mods.starMeter[ev.star] = 60; }
    if (choiceId === 'feature') { S.mods.morale = (S.mods.morale || 0) - 6; S.mods.starMeter[ev.star] = 100; }
    if (choiceId === 'team') S.mods.morale = (S.mods.morale || 0) + 4;
    if (choiceId === 'trade') {
      const s = S_.allStars(S, S.user).find((x) => x.id === ev.star);
      if (s) {
        const comp = r1(s.contract.salary * 2 + 2);
        removeFromRoster(S, S.user, s.id);
        if (roster.v === 1) GI.dev.fillLineup(S, S.user);
        // he lands on a rival
        const dest = pick([...Array(32).keys()].filter((x) => x !== S.user && S_.slotFor(S, x, s.pos)));
        if (dest != null) { addToRoster(S, dest, Object.assign({}, s, { salary: s.contract.salary, formerTeams: (s.formerTeams || []).concat([{ team: S.user, how: 'traded', year: S.year }]), chem: {} }), s.contract.years || 1); extra = ` He's headed to ${T(dest).city}.`; }
        S.cash += comp; S.fin.events -= comp;
      }
    }
    if (choiceId === 'keep') {
      S.mods.morale = (S.mods.morale || 0) - 5; S.mods.starMeter[ev.star] = 0;
      if (R() < 0.3) { S.holdout[ev.star] = 1; extra = ' He is holding out for a week.'; }
      S.story.push({ kind: 'feud', id: ev.star, weeks: 0 });
    }
    if (choiceId === 'pay') {
      const s = S_.allStars(S, S.user).find((x) => x.id === ev.star);
      if (s && S_.salaryTotal(S, S.user) - s.contract.salary + ev.ask <= (S.cap || 38)) { s.contract = { years: 3, salary: ev.ask, active: true }; S.mods.morale = (S.mods.morale || 0) + 3; S.mods.starMeter[ev.star] = 60; extra = ' Deal done.'; }
      else { S.holdout[ev.star] = ri(1, 3); extra = ` You don't have the cap room. He holds out ${S.holdout[ev.star]} week${S.holdout[ev.star] > 1 ? 's' : ''}.`; }
      S.story.push({ kind: 'holdoutAsk', weeks: 0 });
    }
    if (choiceId === 'firm') { const w = ri(1, 3); S.holdout[ev.star] = w; extra = ` He's holding out (${w} week${w > 1 ? 's' : ''}).`; S.story.push({ kind: 'holdoutAsk', weeks: 0 }); }
    if (choiceId === 'match') { S.cash -= 2; S.fin.events += 2; roster.coaches[ev.coach].rating = Math.min(95, roster.coaches[ev.coach].rating + 3); }
    if (choiceId === 'letgo') {
      const co = roster.coaches[ev.coach];
      const nu = GI.league.newCoach(S, ev.coach, { rating: clamp(co.rating + ri(-8, 5), 50, 92) });
      GI.league.hire(S, S.user, ev.coach, nu, 'poached');
      // he lands with the rival who called
      if (ev.rival != null) { const rv = S.rosters[ev.rival]; GI.league.hire(S, ev.rival, ev.coach, co, rv.coaches[ev.coach].rating < co.rating ? 'fired' : 'letgo'); }
      extra = ` New ${co.role.toLowerCase()}: ${nu.name} (${nu.rating}, ${(GI.OC_STYLES[nu.style] || GI.DC_STYLES[nu.style])}). ${co.name.split(' ').pop()} will see you again.`;
    }
    if (choiceId === 'fire') {
      S.cash -= 3; S.fin.events += 3;
      const nu = GI.league.newCoach(S, 'hc', { rating: ri(58, 88) });
      GI.league.hire(S, S.user, 'hc', nu, 'fired');
      S.mods.morale = (S.mods.morale || 0) + 6; S.morale[S.user] = 0;
      extra = ` ${nu.name} (${nu.rating}) takes over.`;
    }
    if (choiceId === 'back') { S.mods.morale = (S.mods.morale || 0) - 3; roster.coaches.hc.rating = Math.min(95, roster.coaches.hc.rating + 3); S.story.push({ kind: 'hotseat', weeks: 0, w0: S.rec[S.user].w, l0: S.rec[S.user].l }); }
    if (choiceId === 'pursue') { S.cash -= 1; S.fin.events += 1; S.scouted.push({ p: ev.prospect, early: ev.early }); }
    if (choiceId === 'sign') {
      const slot = addToRoster(S, S.user, ev.prospect, 1);
      extra = slot ? ` He joins as a ${slot === 'bench' ? 'backup' : 'starter'}.` : ' No roster room — he heads back to the pub.';
    }
    ev.effect = c ? `You chose: ${c.label} — ${c.desc}.${extra}` : null;
    S_.save(S);
  };
})();
