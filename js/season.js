/* Grid Iron — franchise mode: drafts, contracts, budget, spring training, upgrades, seasons, playoffs, Iron-Bowl, the Gazette */
(function () {
  const GI = window.GI;
  const { ri, clamp, wpick, gauss } = GI.util;
  const R = Math.random;
  const pick = (a) => a[Math.floor(R() * a.length)];
  const KEY = 'gridiron_franchise_v1';
  const CONFS = ['Iron', 'Steel'];
  const DIVS = ['North', 'South', 'East', 'West'];
  const ROUND_NAMES = ['Wild Card Round', 'Divisional Round', 'Conference Championships', 'THE IRON-BOWL'];
  const REQUIRED = ['KP', 'QB', 'LB'];
  const CAP = { KP: 1, QB: 1, RB: 1, WR: 3, TE: 1, OL: 3, LB: 3, DL: 3, S: 2, CB: 2 };
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
    load() { try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } },
    save(S) { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} },
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
    if (!vet && R() < 0.05) rating = Math.min(90, rating + ri(5, 9)); // blue-chip prospect
    const age = vet ? ri(24, 31) : ri(21, 23);
    const pot = vet ? Math.min(97, rating + Math.max(0, Math.round(gauss(30 - age, 3)))) : Math.round(clamp(rating + gauss(10, 6), rating + 1, 97));
    const p = {
      id: 'p' + (S.nextId++), pos, name: newName(S), num: 0, rating, pot, age,
      clutch: ri(40, 95), dur: ri(45, 95), ego: ri(5, 95), spark: vet ? 0.02 : Math.round((R() * 0.18 + 0.04) * 100) / 100,
      college: pick(GI.COLLEGES), yrsPro: vet ? age - 22 : 0, rookie: !vet,
    };
    p.salary = vet ? askSalary(p) : rookieSalary(p);
    return p;
  }
  function askSalary(p) { return r1(clamp(1 + (p.rating - 66) * 0.32 + (p.ego > 75 ? 1 : 0) + (p.age < 27 ? 0.5 : 0), 0.8, 14)); }
  function rookieSalary(p) { return r1(clamp(0.6 + (p.rating - 60) * 0.09, 0.6, 3.5)); }
  S_.askSalary = askSalary;
  function assignNum(team, p) {
    const used = new Set(team.stars.concat(team.bench ? [team.bench] : []).map((s) => s.num));
    const [a, b] = GI.NUMS[p.pos];
    let n, guard = 0;
    do { n = ri(a, b); } while (used.has(n) && guard++ < 40);
    p.num = n;
  }
  S_.grade = function (pot) { return pot >= 90 ? 'A' : pot >= 84 ? 'B' : pot >= 78 ? 'C' : 'D'; };

  // ================= rosters =================
  S_.roster = (S, i) => S.rosters[i];
  S_.allStars = (S, i) => { const r = S.rosters[i]; return r.stars.concat(r.bench ? [r.bench] : []); };
  S_.teamObj = (S, i) => GI.makeTeam(i, S.rosters[i]);
  S_.teamOvr = (S, i) => S_.teamObj(S, i).ovr;
  function posCount(r, pos) { return r.stars.filter((s) => s.pos === pos).length; }
  // can this team add a player at pos? → 'starter' | 'bench' | null
  S_.slotFor = function (S, i, pos) {
    const r = S.rosters[i];
    if (r.stars.length < 8 && posCount(r, pos) < CAP[pos]) return 'starter';
    if (!r.bench) return 'bench';
    return null;
  };
  function addToRoster(S, i, p, contractYears) {
    const r = S.rosters[i];
    const slot = S_.slotFor(S, i, p.pos);
    if (!slot) return null;
    const star = Object.assign({}, p, { contract: { years: contractYears, salary: p.salary, active: slot === 'starter' } });
    delete star.est; delete star.claimed; delete star.gradeShown;
    assignNum(r, star);
    if (slot === 'starter') r.stars.push(star); else r.bench = star;
    return slot;
  }
  S_.release = function (S, starId) {
    const r = S.rosters[S.user];
    const s = S_.allStars(S, S.user).find((x) => x.id === starId);
    if (!s) return false;
    if (r.bench && r.bench.id === starId) r.bench = null; else r.stars = r.stars.filter((x) => x.id !== starId);
    S.expiring = (S.expiring || []).filter((x) => x !== starId);
    S.freeAgents.push(Object.assign({}, s, { contract: null }));
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
    };
    for (let i = 0; i < 32; i++) {
      const src = GI.TEAMS[i];
      const rr = GI.mulberry32(4242 + i * 131);
      const b = (lo, hi) => lo + Math.floor(rr() * (hi - lo + 1));
      S.rosters.push({
        stars: [], bench: null,
        // fewer stars than the classic rosters, so the base squad is a little stronger
        base: { run: b(62, 72), pass: b(62, 72), ol: b(62, 72), runD: b(62, 72), passD: b(62, 72), rush: b(62, 72), st: b(60, 70) },
        coaches: JSON.parse(JSON.stringify(src.coaches)),
      });
    }
    // a few CPU franchises open with a veteran already signed (rosters start at 3–5 stars)
    for (let i = 0; i < 32; i++) {
      if (i === o.user || R() > 0.3) continue;
      const pos = pick(['RB', 'WR', 'TE', 'OL', 'DL', 'S', 'CB']);
      addToRoster(S, i, mkPlayer(S, pos, 'vet'), ri(1, 3));
    }
    S.draft = makeDraft(S, true, 4);
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
    let order;
    if (opening) order = shuffle([...Array(32).keys()]);
    else {
      // reverse finish: worst record first, champion last
      const champ = S.champion;
      order = [...Array(32).keys()].sort((a, b) => S_.pct(S.rec[a]) - S_.pct(S.rec[b]) || (S.rec[a].pf - S.rec[a].pa) - (S.rec[b].pf - S.rec[b].pa));
      if (champ != null) { order = order.filter((x) => x !== champ); order.push(champ); }
    }
    const picks = [];
    for (let r = 0; r < rounds; r++) {
      const ord = opening && r % 2 ? order.slice().reverse() : order; // snake for the opening draft
      ord.forEach((t, k) => picks.push({ round: r + 1, inRound: k + 1, team: t, pid: null, passed: false }));
    }
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
    const W = { QB: 4, KP: 3, LB: 8, RB: 7, WR: 10, TE: 5, OL: 9, DL: 9, S: 7, CB: 8 };
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
    pool.forEach((p) => estFor(S, p, p.claimed ? 2 : null));
    return { year: S.year, opening, rounds, picks, cur: 0, pool, log: [] };
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
    if (!S_.slotFor(S, teamIdx, p.pos)) return { ok: false, why: 'No roster room at ' + GI.POS[p.pos].label };
    if (teamIdx === S.user) {
      const must = S_.mustTake(S);
      if (must && !must.includes(p.pos)) return { ok: false, why: 'You still need a ' + must.map((x) => GI.POS[x].label).join(' / ') };
      if (S.cash < p.salary) return { ok: false, why: `Can't afford ${S_.money(p.salary)}/yr` };
    }
    return { ok: true };
  };
  function takePlayer(S, cur, p) {
    const d = S.draft;
    d.pool = d.pool.filter((x) => x.id !== p.id);
    cur.pid = p.id;
    const years = p.rookie ? ROOKIE_YEARS : ri(1, 3);
    const slot = addToRoster(S, cur.team, p, years);
    d.log.push({ round: cur.round, inRound: cur.inRound, team: cur.team, p: { id: p.id, pos: p.pos, name: p.name, rating: p.rating, est: p.est, rookie: p.rookie }, slot });
    d.cur++;
    return slot;
  }
  function cpuChoose(S, t) {
    const d = S.draft, cur = S_.draftCur(S);
    const r = S.rosters[t];
    const missing = REQUIRED.filter((p) => !r.stars.some((s) => s.pos === p));
    // pass sometimes once the core is set (budget), so rosters land at 3–5 stars early on
    if (!missing.length && r.stars.length >= (d.opening ? 3 : 5) && R() < (d.opening ? 0.3 : 0.35 + r.stars.length * 0.06)) return null;
    let best = null, bv = -1e9;
    d.pool.forEach((p) => {
      if (p.claimed && cur.round <= 2) return; // the user's scouted prospects are off-limits early
      if (!S_.slotFor(S, t, p.pos)) return;
      if (d.opening && cur.round <= 3 && missing.length >= 3 - cur.round + 1 && !missing.includes(p.pos)) return;
      let v = p.rating + (p.pot - p.rating) * (p.age < 25 ? 0.45 : 0.15) + R() * 6;
      if (missing.includes(p.pos)) v += 14;
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
    const breaks = [], growth = [];
    for (let i = 0; i < 32; i++) {
      const mine = i === S.user;
      const r = S.rosters[i];
      const f = mine ? focus : pick(Object.keys(FOCUS));
      const gymLv = mine ? S.up.gym : 2;
      const mult = mine && intense ? 2 : 1;
      for (const k in FOCUS[f].base) r.base[k] = clamp(r.base[k] + FOCUS[f].base[k] * mult, 40, 85);
      S_.allStars(S, i).forEach((s) => {
        const before = s.rating;
        let g = s.age <= 25 ? gauss(2.5, 2) : s.age <= 29 ? gauss(0.5, 1.5) : s.age <= 32 ? gauss(-1.5, 1.5) : gauss(-3, 2);
        g += (gymLv - 1) * 0.5 + (mine && intense ? 1 : 0);
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
    // intense camp can tweak a hamstring
    if (intense && R() < 0.12) {
      const st = pick(S.rosters[S.user].stars);
      if (st) { S.inj[st.id] = ri(1, 2); growth.push({ name: st.name, pos: st.pos, d: 0, rating: st.rating, hurt: true }); }
    }
    S.campFocus = focus;
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
      { title: 'Your Camp Report', items: growth.map((g) => `${GI.POS[g.pos].label} ${g.name}: ${g.hurt ? 'tweaked a hamstring 🚑' : (g.d >= 0 ? '+' : '') + g.d + ' → ' + g.rating}`) },
      { title: 'Breakthroughs Around the League', items: breaks.length ? breaks.slice(0, 8).map((b) => `${T(b.team).abbr} ${GI.POS[b.pos].label} ${b.name} +${b.jump} (${b.rating})`) : ['None this spring.'] },
    ];
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
  S_.injuredIds = (S) => Object.keys(S.inj).filter((k) => S.inj[k] > 0);
  S_.injuredFor = (S, i) => S_.allStars(S, i).filter((s) => S.inj[s.id] > 0).map((s) => ({ s, weeks: S.inj[s.id] }));
  function homeCrowd(S, i) {
    const r = S.rec[i], wp = S_.pct(r);
    const lv = i === S.user ? S.up.stadium : 2;
    return clamp(30 + lv * 9 + wp * 25 + R() * 10, 20, 95);
  }
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
    let starMeter = m.starMeter ? Object.assign({}, m.starMeter) : {};
    if (S.campFocus === 'conditioning') S.rosters[S.user].stars.forEach((s) => { if (starMeter[s.id] == null) starMeter[s.id] = 40 + ri(0, 15); });
    return {
      user: S.user, opp: c.opp, userHome: c.home, qMin: S.qMin, diff: S.diff, teamData,
      injured: S_.injuredIds(S), morale, weather: m.weather || null, crowdLevel,
      playoff: c.playoff, intel: m.intel ? true : null, film: !!m.film, starMeter, label: c.label,
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
      if (S.inj[i.id] > 0) return;
      S.inj[i.id] = injWeeks(S, i.team);
      (S._newInj = S._newInj || []).push({ team: i.team, name: i.name, pos: i.pos, weeks: S.inj[i.id] });
    });
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
    S._newInj = []; S._benchNews = [];
    Object.keys(S.inj).forEach((k) => { S.inj[k] = Math.max(0, S.inj[k] - 1); if (!S.inj[k]) delete S.inj[k]; });
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
        // gate receipts
        if (g.h === S.user) {
          const wp = S_.pct(S.rec[S.user]);
          const gate = playoff ? 3 + S.up.stadium * 0.5 : (1.4 + 0.4 * (S.up.stadium - 1)) * (0.7 + 0.6 * wp) * (S.mods.crowdLevel ? 1.3 : 1);
          if (playoff) S.fin.playoffs += gate; else S.fin.tickets += gate;
          S.cash += gate;
        }
        // rookies who show out can break through mid-season
        (G.crazyLog ? Object.keys(G.crazyLog) : []).forEach((nm) => {
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
    const G = GI.newGame(Object.assign({}, o, { qMin: 8, user: g.h, opp: g.a, userHome: true, potw: { off: 'short', def: 'zone' } }));
    G.diff = 'sim';
    return GI.finishAuto(G);
  }
  function simCPU(S, g, playoff) {
    const teamData = {}; teamData[g.h] = S.rosters[g.h]; teamData[g.a] = S.rosters[g.a];
    return GI.simGame(g.h, g.a, { qMin: 8, injured: S_.injuredIds(S), teamData, playoff, crowdLevel: playoff ? 88 : homeCrowd(S, g.h), morale: { home: S.morale[g.h] || 0, away: S.morale[g.a] || 0 } });
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
      const next = [];
      [0, 1].forEach((ci) => {
        const w = winners.filter((t) => confOf(t) === ci).sort((a, b) => seedOf[a] - seedOf[b]);
        next.push({ h: B.seeds[ci][0], a: w[w.length - 1], conf: ci, hs: null, as: null, done: false });
        next.push({ h: B.seeds[ci][1], a: w[0], conf: ci, hs: null, as: null, done: false });
      });
      B.rounds.push(next); B.round = 1;
    } else if (B.round === 1) {
      B.rounds.push([0, 1].map((ci) => {
        const w = winners.filter((t) => confOf(t) === ci).sort((a, b) => seedOf[a] - seedOf[b]);
        return { h: w[0], a: w[1], conf: ci, hs: null, as: null, done: false };
      }));
      B.round = 2;
    } else if (B.round === 2) {
      const better = S_.sorted(S, winners);
      if (winners.includes(S.user)) { S.fin.bonus += 4; S.cash += 4; }
      B.rounds.push([{ h: better[0], a: better[1], conf: -1, hs: null, as: null, done: false, neutral: true }]);
      B.round = 3;
    } else {
      S.champion = winners[0];
      paper.champion = winners[0];
      S.history.unshift({ year: S.year, champ: winners[0], user: S.user, rec: S_.recStr(S.rec[S.user]) });
      if (winners[0] === S.user) {
        // the Iron-Bowl purse: money for next year's draft
        S.fin.bonus += 15; S.cash += 15; S.records.titles++;
        paper.bonus = 15;
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
    // books for the year
    const salaries = S_.salaryTotal(S, S.user);
    const upkeep = Object.values(S.up).reduce((t, l) => t + (l - 1) * 0.5, 0);
    const staff = 4;
    const tv = 30;
    const rev = tv + S.fin.tickets + S.fin.playoffs + S.fin.bonus;
    const exp = salaries + upkeep + staff;
    S.cash += tv - salaries - upkeep - staff; // gates & bonuses were banked as they came in
    S.fin.reports.unshift({ year: S.year, tv, tickets: r1(S.fin.tickets), playoffs: r1(S.fin.playoffs), bonus: r1(S.fin.bonus), events: r1(S.fin.events), salaries: r1(salaries), upkeep: r1(upkeep), staff, rev: r1(rev), exp: r1(exp + S.fin.events), cash: r1(S.cash) });
    S.fin.reports.length = Math.min(S.fin.reports.length, 6);
    S.fin.tickets = 0; S.fin.playoffs = 0; S.fin.bonus = 0; S.fin.events = 0;
    // contracts run down, players age, legends retire
    const retired = [], cpuMoves = [];
    S.expiring = [];
    for (let i = 0; i < 32; i++) {
      const r = S.rosters[i];
      S_.allStars(S, i).forEach((s) => {
        s.age++; s.yrsPro++; s.rookie = false;
        if (s.contract.active) s.contract.years--;
      });
      const keep = (s) => {
        if (s.age >= 37 || (s.age >= 34 && R() < 0.45) || (s.age >= 32 && s.rating < 70 && R() < 0.4)) { retired.push({ team: i, s }); return false; }
        return true;
      };
      r.stars = r.stars.filter(keep);
      if (r.bench && !keep(r.bench)) r.bench = null;
      S_.allStars(S, i).forEach((s) => {
        if (s.contract.years > 0) return;
        if (i === S.user) { S.expiring.push(s.id); s.ask = askSalary(s); return; }
        if (s.rating >= 72 && R() < 0.72) { s.contract = { years: ri(1, 3), salary: askSalary(s), active: true }; cpuMoves.push(`${T(i).abbr} re-sign ${GI.POS[s.pos].label} ${s.name}`); }
        else {
          if (r.bench && r.bench.id === s.id) r.bench = null; else r.stars = r.stars.filter((x) => x.id !== s.id);
          S.freeAgents.push(Object.assign({}, s, { contract: null }));
          cpuMoves.push(`${T(i).abbr} let ${GI.POS[s.pos].label} ${s.name} walk`);
        }
      });
    }
    paper.offseason = true;
    paper.sections = (paper.sections || []).concat([
      { title: 'Front Office Report', items: [`Revenue ${S_.money(rev)} · Expenses ${S_.money(exp)}`, `Cash on hand: ${S_.money(S.cash)}`].concat(paper.bonus ? [`Iron-Bowl purse: +${S_.money(paper.bonus)} for the draft!`] : []) },
      { title: 'Retirements', items: retired.length ? retired.slice(0, 8).map((x) => `${T(x.team).abbr} ${GI.POS[x.s.pos].label} ${x.s.name} (age ${x.s.age})${x.team === S.user ? ' 👋' : ''}`) : ['Nobody hung up the cleats this year.'] },
      { title: 'Contract Watch', items: S.expiring.length ? S.expiring.map((id) => { const s = S_.allStars(S, S.user).find((x) => x.id === id); return `${GI.POS[s.pos].label} ${s.name} wants ${S_.money(s.ask)}/yr`; }) : ['No expiring deals on your roster.'] },
      { title: 'Around the League', items: cpuMoves.slice(0, 6) },
    ]);
  }
  S_.resign = function (S, starId, years) {
    const s = S_.allStars(S, S.user).find((x) => x.id === starId);
    if (!s) return false;
    s.contract = { years, salary: s.ask || askSalary(s), active: true };
    S.expiring = S.expiring.filter((x) => x !== starId);
    S_.save(S);
    return true;
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
    (S.expiring || []).forEach((id) => S_.release(S, id));
    S.expiring = [];
    S.year++;
    S.week = 0;
    S.schedule = makeSchedule(S.weeks);
    const lastRec = S.rec;
    S.draft = makeDraft(S, false, Math.min(8, 3 + S.year));
    S.rec = freshRec();
    S.lastRec = lastRec;
    S.bracket = null; S.champion = null; S.inj = {}; S.mods = {};
    S.morale = S.morale.map((m) => Math.round(m / 2));
    S.seasonStats = { gp: 0, pf: 0, pa: 0 };
    S.phase = 'draft';
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
    if (notes.length) p.sections.push({ title: 'Locker Room', items: notes });
    const nx = nextUserGame(S);
    p.next = nx;
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
  function makeEvent(S, nx) {
    const ut = T(S.user), op = T(nx.opp);
    const roster = S.rosters[S.user];
    const healthy = roster.stars.filter((s) => !(S.inj[s.id] > 0) && s.pos !== 'KP');
    const star = healthy.length ? pick(healthy) : null;
    const egoStar = roster.stars.filter((s) => s.ego > 75 && !(S.inj[s.id] > 0))[0];
    const streak = S.rec[S.user].streak;
    const c = roster.coaches;
    const types = {
      leak: 11, film: 10, dinner: 10, storm: 8, sellout: nx.home ? 8 : 0, none: 12,
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
        return { kind: 'choice', tag: 'STAFF DRAMA', coach: who, title: `${rival.name} Try to Poach ${co.name.split(' ').pop()}`, body: `${rival.city} offered your ${co.role.toLowerCase()} a promotion behind your back. He's listening.`,
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
        if (roster.bench && roster.bench.id === s.id) roster.bench = null; else roster.stars = roster.stars.filter((x) => x.id !== s.id);
        // he lands on a rival
        const dest = pick([...Array(32).keys()].filter((x) => x !== S.user && S_.slotFor(S, x, s.pos)));
        if (dest != null) { addToRoster(S, dest, Object.assign({}, s, { salary: s.contract.salary }), s.contract.years || 1); extra = ` He's headed to ${T(dest).city}.`; }
        S.cash += comp; S.fin.events -= comp;
      }
    }
    if (choiceId === 'keep') { S.mods.morale = (S.mods.morale || 0) - 5; S.mods.starMeter[ev.star] = 0; if (R() < 0.25) { S.inj[ev.star] = 2; extra = ' He is holding out for a week.'; } }
    if (choiceId === 'match') { S.cash -= 2; S.fin.events += 2; roster.coaches[ev.coach].rating = Math.min(95, roster.coaches[ev.coach].rating + 3); }
    if (choiceId === 'letgo') {
      const co = roster.coaches[ev.coach];
      const nu = { role: co.role, name: pick(GI.FIRST) + ' ' + pick(GI.COACH_LAST), rating: clamp(co.rating + ri(-8, 5), 50, 92), style: ev.coach === 'oc' ? pick(Object.keys(GI.OC_STYLES)) : pick(Object.keys(GI.DC_STYLES)) };
      roster.coaches[ev.coach] = nu;
      extra = ` New ${co.role.toLowerCase()}: ${nu.name} (${nu.rating}, ${(GI.OC_STYLES[nu.style] || GI.DC_STYLES[nu.style])}).`;
    }
    if (choiceId === 'fire') {
      S.cash -= 3; S.fin.events += 3;
      const nu = { role: 'Head Coach', name: pick(GI.FIRST) + ' ' + pick(GI.COACH_LAST), rating: ri(58, 88) };
      roster.coaches.hc = nu; S.mods.morale = (S.mods.morale || 0) + 6; S.morale[S.user] = 0;
      extra = ` ${nu.name} (${nu.rating}) takes over.`;
    }
    if (choiceId === 'back') { S.mods.morale = (S.mods.morale || 0) - 3; roster.coaches.hc.rating = Math.min(95, roster.coaches.hc.rating + 3); }
    if (choiceId === 'pursue') { S.cash -= 1; S.fin.events += 1; S.scouted.push({ p: ev.prospect, early: ev.early }); }
    if (choiceId === 'sign') {
      const slot = addToRoster(S, S.user, ev.prospect, 1);
      extra = slot ? ` He joins as a ${slot === 'bench' ? 'backup' : 'starter'}.` : ' No roster room — he heads back to the pub.';
    }
    ev.effect = c ? `You chose: ${c.label} — ${c.desc}.${extra}` : null;
    S_.save(S);
  };
})();
