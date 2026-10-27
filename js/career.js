/* Grid Iron — Career Mode: build a player, star in college, survive the combine, get drafted, and play out a pro career.
   You control your player's key moments; the rest of each game is simulated. */
(function () {
  const GI = window.GI;
  const { ri, clamp, gauss } = GI.util;
  const R = Math.random;
  const pick = (a) => a[Math.floor(R() * a.length)];
  const KEY = 'gridiron_career_v1';
  const r1 = (x) => Math.round(x * 10) / 10;
  const C_ = {};
  GI.career = C_;
  C_.load = () => { try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } };
  C_.save = (C) => { try { localStorage.setItem(KEY, JSON.stringify(C)); } catch (e) {} };
  C_.clear = () => { try { localStorage.removeItem(KEY); } catch (e) {} };

  C_.POSITIONS = ['QB', 'RB', 'WR', 'TE', 'LB', 'DL', 'CB', 'S', 'KP'];
  const MASCOTS = ['Wolves', 'Hawks', 'Rams', 'Bears', 'Owls', 'Mustangs', 'Pioneers', 'Gators', 'Bison', 'Cougars', 'Falcons', 'Hornets', 'Knights', 'Mavericks', 'Panthers', 'Rebels', 'Spartans', 'Titans', 'Vikings', 'Wildcats', 'Eagles', 'Raiders', 'Rockets', 'Thunder', 'Lancers', 'Bobcats', 'Huskies', 'Jaguars', 'Badgers', 'Cardinals', 'Tigers', 'Herons'];
  const abbrOf = (n) => { const w = n.replace(/&/g, '').split(' ').filter(Boolean); return (w.length > 1 ? w.map((x) => x[0]).join('') : n.slice(0, 3)).toUpperCase().slice(0, 4); };
  // college programs share the 32 franchise cities' schools
  C_.collegeTeam = function (ci, starList) {
    const name = GI.COLLEGES[ci];
    const c1 = GI.COLLEGE_COLORS[ci];
    const glyph = GI.TEAM_GLYPH[(ci * 7 + 5) % 32];
    const t = GI.makeTeam(ci, {
      ident: { city: name, name: MASCOTS[ci], abbr: abbrOf(name), c1, c2: GI.lum && GI.lum(c1) > 0.55 ? '#1d1d1f' : '#ffffff', glyph, college: true },
      stars: starList || [], base: { run: 62, pass: 62, ol: 62, runD: 62, passD: 62, rush: 62, st: 62 },
      coaches: { hc: { role: 'Head Coach', name: 'Coach', rating: 70 }, oc: { role: 'OC', name: 'OC', rating: 70, style: 'balanced' }, dc: { role: 'DC', name: 'DC', rating: 70, style: 'balanced' }, stc: { role: 'ST', name: 'ST', rating: 70 } },
    });
    t.ci = ci;
    t.ovr = 60 + ((ci * 13) % 17);
    return t;
  };

  // ================= create =================
  C_.BASE = { rating: 64, clutch: 50, dur: 55, spark: 0.06 };
  C_.POINTS = 12;
  C_.create = function (o) {
    const pts = o.pts || { skill: 6, clutch: 3, dur: 3, spark: 0 };
    const p = {
      id: 'cp' + Date.now().toString(36), name: o.name, pos: o.pos, num: o.num, college: GI.COLLEGES[o.ci], ci: o.ci,
      rating: C_.BASE.rating + pts.skill, clutch: C_.BASE.clutch + pts.clutch * 4, dur: C_.BASE.dur + pts.dur * 4, spark: r1((C_.BASE.spark + pts.spark * 0.02) * 100) / 100,
      ego: o.ego != null ? o.ego : 50, age: 21, traits: o.trait ? [o.trait] : [], career: { seasons: 0, gp: 0 }, awards: [], rings: 0,
    };
    p.pot = Math.min(99, p.rating + 14 + ri(0, 8));
    const opps = [...Array(32).keys()].filter((x) => x !== o.ci).sort(() => R() - 0.5).slice(0, 4);
    const C = {
      v: 1, phase: 'college', p, created: Date.now(), weeks: 10,
      college: { games: opps.map((op, k) => ({ opp: op, home: k % 2 === 0, done: false })), stock: 40 + (p.rating - 64) * 2, stats: {}, grades: [] },
      combine: null, draft: null, pro: null, log: [],
    };
    C_.save(C);
    return C;
  };

  // ================= moments =================
  // each position: three looks the defense/offense can show, three answers; each answer beats one look and loses to another
  const KITS = {
    QB: { looks: { blitz: 'Linebackers walking up into the A-gaps', deep: 'Both safeties backpedaling before the snap', man: 'Corners pressed right on the receivers' }, opts: [
      { id: 'hot', label: 'Hot route', sub: 'Quick slant before the blitz lands', beats: 'blitz', loses: 'man', play: 'short' },
      { id: 'shot', label: 'Take the shot', sub: 'Let it fly deep, one-on-one', beats: 'man', loses: 'deep', play: 'long' },
      { id: 'under', label: 'Check it down', sub: 'Dump it to the back in the flat', beats: 'deep', loses: 'blitz', play: 'short' }] },
    RB: { looks: { stack: 'Eight men in the box, linebackers downhill', edge: 'Ends setting hard edges, crashing outside', flow: 'The whole defense flows fast to the play side' }, opts: [
      { id: 'hole', label: 'Hit the hole', sub: 'Trust the blocking, go north', beats: 'edge', loses: 'stack', play: 'in_run' },
      { id: 'bounce', label: 'Bounce outside', sub: 'Race for the corner', beats: 'stack', loses: 'flow', play: 'out_run' },
      { id: 'cut', label: 'Cut it back', sub: 'Plant and reverse field', beats: 'flow', loses: 'edge', play: 'in_run' }] },
    WR: { looks: { press: 'The corner is right in your face', zone: 'Corner at 8 yards, eyes on the QB', deep: 'A safety is cheating over to your side' }, opts: [
      { id: 'go', label: 'Go route', sub: 'Win off the line and run', beats: 'press', loses: 'deep', play: 'long' },
      { id: 'slant', label: 'Slant', sub: 'Break inside under the safety', beats: 'deep', loses: 'zone', play: 'short' },
      { id: 'curl', label: 'Sit in the hole', sub: 'Find the soft spot in the zone', beats: 'zone', loses: 'press', play: 'short' }] },
    TE: { looks: { blitz: 'A linebacker walks up right over you', zone: 'Linebackers dropping into hook zones', man: 'The Mike linebacker is locked onto you' }, opts: [
      { id: 'seam', label: 'Split the seam', sub: 'Up the middle between the safeties', beats: 'zone', loses: 'man', play: 'short' },
      { id: 'chip', label: 'Chip & release', sub: 'Pop the blitzer, then leak out', beats: 'blitz', loses: 'zone', play: 'short' },
      { id: 'out', label: 'Out route', sub: "Outrun the linebacker to the sideline", beats: 'man', loses: 'blitz', play: 'short' }] },
    LB: { looks: { run: 'Guards firing out low: run blocking', pa: 'Tight end releasing, QB showing the ball', screen: 'Linemen letting rushers through on purpose' }, opts: [
      { id: 'fill', label: 'Fill the gap', sub: 'Shoot downhill at the ball carrier', beats: 'run', loses: 'pa', call: 'blitz_in' },
      { id: 'drop', label: 'Drop into coverage', sub: 'Get depth, read the QB', beats: 'pa', loses: 'screen', call: 'zone' },
      { id: 'spy', label: 'Read & react', sub: 'Stay home, mirror the back', beats: 'screen', loses: 'run', call: 'man' }] },
    DL: { looks: { run: 'Tackle in a heavy stance, weight forward', pass: 'Tackle leaning back, ready to kick-slide', boot: 'QB keeps peeking at the edge' }, opts: [
      { id: 'speed', label: 'Speed rush', sub: 'Dip and rip around the edge', beats: 'pass', loses: 'run', call: 'blitz_out' },
      { id: 'anchor', label: 'Two-gap & anchor', sub: 'Stack the blocker, shed, tackle', beats: 'run', loses: 'boot', call: 'blitz_in' },
      { id: 'contain', label: 'Contain', sub: 'Stay wide and squeeze the pocket', beats: 'boot', loses: 'pass', call: 'zone' }] },
    CB: { looks: { go: "Receiver in a sprinter's stance", slant: 'Receiver tight to the formation, inside leverage', double: 'Long split and a hitch in his step' }, opts: [
      { id: 'jump', label: 'Jump the route', sub: 'Sit on the slant and break on it', beats: 'slant', loses: 'double', call: 'press' },
      { id: 'bail', label: 'Bail deep', sub: 'Turn and run with him', beats: 'go', loses: 'slant', call: 'deep' },
      { id: 'trail', label: 'Trail technique', sub: 'Hip-to-hip, see the double move', beats: 'double', loses: 'go', call: 'man' }] },
    S: { looks: { deep: 'Two receivers releasing vertical', middle: 'Tight end and slot crossing underneath', run: 'Fullback leading into the hole' }, opts: [
      { id: 'top', label: 'Stay over the top', sub: 'Nothing gets behind you', beats: 'deep', loses: 'run', call: 'deep' },
      { id: 'rob', label: 'Rob the middle', sub: 'Jump the crossing route', beats: 'middle', loses: 'deep', call: 'zone' },
      { id: 'alley', label: 'Fill the alley', sub: 'Come downhill to stop the run', beats: 'run', loses: 'middle', call: 'blitz_in' }] },
  };
  C_.KITS = KITS;
  const DEF = ['LB', 'DL', 'CB', 'S'];
  C_.isDef = (pos) => DEF.includes(pos);
  const ROLE = { QB: 'QB', RB: 'RB', WR: 'WR1', TE: 'TE', LB: 'MLB', DL: 'DE1', CB: 'CB1', S: 'FS', KP: 'K' };
  C_.ROLE = ROLE;

  // build a game's worth of moments
  C_.newGame = function (C, ctx) {
    const p = C.p;
    const n = p.pos === 'KP' ? 4 : 5;
    const slots = [[1, 600], [2, 420], [2, 100], [3, 360], [4, 240], [4, 70]].slice(0, n === 4 ? 4 : 5);
    if (n === 5) slots[4] = [4, ri(45, 110)];
    const moments = slots.map(([q, clock], k) => {
      const m = { q, clock, k };
      if (p.pos === 'KP') { m.dist = ri(28, 54) + (k === n - 1 ? ri(0, 4) : 0); m.wind = pick([0, 0, 0, 1, 2, 3]) * (R() < 0.5 ? -1 : 1); return m; }
      const kit = KITS[p.pos];
      m.look = pick(Object.keys(kit.looks));
      m.ballOn = ri(22, 88);
      m.down = pick([1, 2, 3, 3, 3]);
      m.toGo = m.down === 1 ? 10 : ri(2, 11);
      // the pre-snap read: better players see the truth more often
      const acc = clamp(0.5 + (p.rating - 64) / 70 + (p.traits.includes('biggame') && k >= n - 2 ? 0.1 : 0), 0.45, 0.92);
      const lie = Object.keys(kit.looks).filter((x) => x !== m.look);
      m.hint = R() < acc ? m.look : pick(lie);
      m.big = k === n - 1;
      return m;
    });
    return Object.assign({ moments, cur: 0, us: 0, them: 0, plays: [], stats: {}, grade: null }, ctx);
  };

  // resolve one moment; returns { tier: 'big'|'good'|'meh'|'bad', text, res (for the field), pts:{us,them}, stats }
  C_.resolve = function (C, g, optId, kickQuality) {
    const p = C.p, m = g.moments[g.cur];
    const side = 'home'; // in moments the player's team is always "home" (bottom of the screen)
    const opp = 'away';
    const st = {};
    let tier, text, res, pts = { us: 0, them: 0 };
    const add = (k, v) => (st[k] = (st[k] || 0) + v);
    const clutchB = m.big ? (p.clutch - 60) * 0.004 : (p.clutch - 60) * 0.0015;
    if (p.pos === 'KP') {
      const good = kickQuality >= 0.5;
      tier = kickQuality >= 0.92 ? 'big' : good ? 'good' : kickQuality >= 0.3 ? 'meh' : 'bad';
      res = { kind: 'fg', side, los: 117 - m.dist, dir: 1, start: 117 - m.dist, dist: m.dist, good, off: 'fg', def: '-' };
      add('fga', 1); if (good) { add('fgm', 1); pts.us += 3; if (m.dist >= 50) add('fg50', 1); }
      text = good ? (tier === 'big' ? `Right down the middle from ${m.dist}! ` : `${m.dist}-yard field goal is good.`) : `${m.dist}-yard try is no good.`;
    } else {
      const kit = KITS[p.pos], o = kit.opts.find((x) => x.id === optId);
      const base = o.beats === m.look ? 0.82 : o.loses === m.look ? 0.22 : 0.55;
      const pS = clamp(base + (p.rating - 70) * 0.006 + clutchB, 0.08, 0.95);
      const ok = R() < pS;
      tier = ok ? (R() < (o.beats === m.look ? 0.55 : 0.3) ? 'big' : 'good') : (R() < (o.loses === m.look ? 0.6 : 0.3) ? 'bad' : 'meh');
      const out = DEF.includes(p.pos) ? defOutcome(p, m, o, tier, st) : offOutcome(p, m, o, tier, st);
      res = out.res; text = out.text; pts = out.pts;
      res.side = DEF.includes(p.pos) ? opp : side;
      res.los = DEF.includes(p.pos) ? 100 - m.ballOn : m.ballOn;
      res.dir = DEF.includes(p.pos) ? -1 : 1;
      res.start = m.ballOn; res.down = m.down; res.toGo = m.toGo;
      res.mine = true;
      if (tier === 'big') { res.crazy = { name: GI.shortName(p.name), pos: p.pos, title: o.label, team: side }; }
      res.matchup = { look: m.look, lookText: kit.looks[m.look], beat: o.beats === m.look, lost: o.loses === m.look };
    }
    g.us += pts.us; g.them += pts.them;
    for (const k in st) g.stats[k] = (g.stats[k] || 0) + st[k];
    g.plays.push({ tier, text, k: m.k });
    g.cur++;
    return { tier, text, res, pts, stats: st };
  };
  function finishRes(r, m) {
    const gain = r.kind === 'pass' ? (r.air || 0) + (r.yac || 0) : r.kind === 'run' || r.kind === 'sack' ? r.yards : 0;
    r.gain = gain;
    if ((r.kind === 'pass' || r.kind === 'run') && m.ballOn + gain >= 100) { r.td = true; r.gain = 100 - m.ballOn; if (r.kind === 'pass') r.yac = Math.max(0, r.gain - r.air); else r.yards = r.gain; }
    return r;
  }
  function offOutcome(p, m, o, tier, st) {
    const add = (k, v) => (st[k] = (st[k] || 0) + v);
    let r, text, pts = { us: 0, them: 0 };
    const deep = o.play === 'long';
    const tgt = p.pos === 'WR' ? 'WR1' : p.pos === 'TE' ? 'TE' : o.id === 'under' ? 'RB' : 'WR1';
    if (p.pos === 'RB') {
      const y = tier === 'big' ? ri(18, 60) : tier === 'good' ? ri(5, 10) : tier === 'meh' ? ri(0, 3) : -ri(1, 4);
      r = finishRes({ kind: 'run', off: o.play, def: 'zone', yards: y, carrier: 'RB' }, m);
      if (tier === 'bad' && R() < 0.3) { r.fumble = true; r.recD = true; r.ret = ri(0, 8); r.retYds = r.ret; text = 'Stripped! Fumble, and they recover.'; pts.them += 3; add('fum', 1); }
      add('car', 1); add('ryd', r.gain); if (r.td) add('rtd', 1);
      text = text || (r.td ? `TOUCHDOWN! ${r.gain} yards to the house!` : tier === 'big' ? `Breakaway! ${r.gain} yards.` : `${r.gain >= 0 ? r.gain : 'Loss of ' + -r.gain} yard${Math.abs(r.gain) === 1 ? '' : 's'}${tier === 'good' ? '. Moving the chains.' : '.'}`);
    } else {
      if (tier === 'big' || tier === 'good') {
        const air = deep ? ri(16, 34) : tier === 'big' ? ri(8, 16) : ri(4, 9);
        r = finishRes({ kind: 'pass', off: o.play, def: 'man', target: tgt, air, yac: tier === 'big' ? ri(4, 24) : ri(0, 5) }, m);
        if (p.pos === 'QB') { add('att', 1); add('cmp', 1); add('pyd', r.gain); if (r.td) add('ptd', 1); }
        else { add('rec', 1); add('recyd', r.gain); if (r.td) add('rectd', 1); }
        text = r.td ? `TOUCHDOWN! ${r.gain}-yard strike!` : tier === 'big' ? `Huge play: ${r.gain} yards!` : `Complete for ${r.gain}.`;
      } else if (tier === 'meh') {
        r = { kind: 'incomplete', off: o.play, def: 'man', target: tgt, air: deep ? ri(16, 30) : ri(4, 9), by: 'CB1' };
        if (p.pos === 'QB') add('att', 1);
        text = 'Incomplete. Good coverage.';
      } else {
        const sack = p.pos === 'QB' && o.id === 'under' || p.pos === 'TE' && o.id === 'out';
        if (sack) { r = { kind: 'sack', off: o.play, def: 'blitz_in', yards: -ri(5, 9), by: 'MLB' }; r.gain = r.yards; text = p.pos === 'QB' ? 'Sacked! The blitz got home.' : 'The blitzer blew it up. Sack.'; if (p.pos === 'QB') add('sk_taken', 1); pts.them += 0; }
        else { r = { kind: 'int', off: o.play, def: 'deep', target: tgt, air: deep ? ri(18, 32) : ri(5, 10), by: 'FS', ret: ri(0, 30) }; r.retYds = r.ret; text = 'Intercepted!'; if (p.pos === 'QB') { add('att', 1); add('int', 1); } pts.them += 3; }
      }
    }
    // the drive's payoff
    if (r.td) pts.us += 7;
    else if (tier === 'big') pts.us += m.ballOn + (r.gain || 0) >= 60 ? 7 : 3;
    else if (tier === 'good') pts.us += R() < 0.45 ? 3 : 0;
    if (tier === 'bad' && r.kind === 'int' && R() < 0.3) pts.them += 4;
    return { res: r, text, pts };
  }
  function defOutcome(p, m, o, tier, st) {
    const add = (k, v) => (st[k] = (st[k] || 0) + v);
    const role = ROLE[p.pos];
    // what the offense ran, from the look
    const L = m.look;
    const offPlay = { run: 'in_run', stack: 'in_run', pa: 'long', screen: 'short', pass: 'long', boot: 'short', go: 'long', slant: 'short', double: 'long', deep: 'long', middle: 'short' }[L] || 'short';
    const tgt = p.pos === 'CB' ? 'WR1' : L === 'middle' ? 'TE' : L === 'screen' ? 'RB' : 'WR2';
    let r, text, pts = { us: 0, them: 0 };
    const isRun = offPlay === 'in_run';
    if (tier === 'big') {
      if (p.pos === 'DL' && !isRun) { r = { kind: 'sack', off: offPlay, def: o.call, yards: -ri(6, 11), by: role }; if (R() < 0.45) { r.fumble = true; r.recD = true; r.ret = ri(0, 25); r.retYds = r.ret; add('ff', 1); } add('sk', 1); text = r.fumble ? 'STRIP SACK! Ball is loose and you recover!' : 'SACK! You got home.'; }
      else if (isRun) { r = { kind: 'run', off: offPlay, def: o.call, yards: -ri(1, 4), by: role, carrier: 'RB', fumble: true, recD: true, ret: ri(0, 30) }; r.retYds = r.ret; add('ff', 1); add('tkl', 1); text = 'Big hit! Ball comes loose — takeaway!'; }
      else { r = { kind: 'int', off: offPlay, def: o.call, target: tgt, air: offPlay === 'long' ? ri(18, 32) : ri(5, 11), by: role, ret: ri(10, 70) }; r.retYds = r.ret; add('dint', 1); text = 'INTERCEPTED! You read it all the way.'; }
      r.gain = r.yards || 0;
      const back = r.retYds || 0;
      if (r.kind === 'int' && (100 - m.ballOn) - Math.max(0, r.air) + back >= 100 && R() < 0.5) { r.defTD = true; pts.us += 7; text += ' And he takes it to the house!'; add('dtd', 1); }
      else pts.us += R() < 0.5 ? 3 : 0;
    } else if (tier === 'good') {
      if (isRun) { r = { kind: 'run', off: offPlay, def: o.call, yards: ri(-2, 1), by: role, carrier: 'RB' }; add('tkl', 1); text = r.yards < 0 ? 'Tackle for loss!' : 'Stuffed at the line.'; }
      else if (p.pos === 'DL') { r = { kind: 'sack', off: offPlay, def: o.call, yards: -ri(4, 7), by: role }; add('sk', 1); text = 'Sack! Drive killer.'; }
      else { r = { kind: 'incomplete', off: offPlay, def: o.call, target: tgt, air: offPlay === 'long' ? ri(16, 30) : ri(5, 10), by: role, breakup: true }; add('pd', 1); text = 'Pass broken up!'; }
      r.gain = r.yards || 0;
    } else {
      const big = tier === 'bad';
      if (isRun) { r = finishRes({ kind: 'run', off: offPlay, def: o.call, yards: big ? ri(15, 45) : ri(4, 8), carrier: 'RB' }, { ballOn: 100 - m.ballOn }); }
      else r = finishRes({ kind: 'pass', off: offPlay, def: o.call, target: tgt, air: offPlay === 'long' ? ri(15, 30) : ri(5, 10), yac: big ? ri(5, 25) : ri(0, 4) }, { ballOn: 100 - m.ballOn });
      if (!big) add('tkl', 1);
      text = r.td ? `Touchdown, them. ${r.gain} yards — you were a step late.` : big ? `Big gain for them: ${r.gain} yards.` : `They pick up ${r.gain}.`;
      pts.them += r.td ? 7 : big ? 3 : R() < 0.3 ? 3 : 0;
    }
    return { res: r, text, pts };
  }

  // finish a game: simulate the rest, grade the player, update stock / stats
  const BASE_REL = { QB: 1.16, RB: 1.69, WR: 1.88, TE: 1.61, LB: 2.63, DL: 3.62, CB: 2.96, S: 2.86, KP: 2.85 };
  const PAR = { QB: { pyd: 160, ptd: 1.2 }, RB: { ryd: 62, rtd: 0.5 }, WR: { recyd: 58, rectd: 0.45 }, TE: { recyd: 40, rectd: 0.3 }, LB: { tkl: 6, sk: 0.3 }, DL: { tkl: 3, sk: 0.7 }, CB: { tkl: 3, pd: 1, dint: 0.2 }, S: { tkl: 4.5, dint: 0.25 }, KP: { fgm: 1.2 } };
  C_.finishGame = function (C, g, teamOvr, oppOvr) {
    const p = C.p;
    const tiers = g.plays.map((x) => x.tier);
    const sc = tiers.reduce((t, x) => t + ({ big: 3, good: 2, meh: 1, bad: 0 }[x]), 0) / Math.max(1, tiers.length);
    // the rest of the game, simulated around you
    const q = (sc - 1.2) * 0.35 + (p.rating - 70) / 60;
    const par = PAR[p.pos];
    const fgm0 = g.stats.fgm || 0;
    for (const k in par) g.stats[k] = (g.stats[k] || 0) + Math.max(0, Math.round(par[k] * (0.85 + q) + gauss(0, par[k] * 0.25)));
    if (p.pos === 'QB') { g.stats.att = (g.stats.att || 0) + ri(16, 24); g.stats.cmp = (g.stats.cmp || 0) + ri(10, 16); }
    if (p.pos === 'RB') g.stats.car = (g.stats.car || 0) + ri(10, 16);
    if (p.pos === 'WR' || p.pos === 'TE') g.stats.rec = (g.stats.rec || 0) + ri(2, 5);
    if (p.pos === 'KP') g.stats.fga = (g.stats.fga || 0) + (g.stats.fgm || 0) - fgm0 + (R() < 0.3 ? 1 : 0);
    const base = (o) => Math.max(0, Math.round(gauss(13 + (o - 66) * 0.5, 6)));
    g.us += base(teamOvr); g.them += base(oppOvr);
    g.us = Math.max(0, g.us); g.them = Math.max(0, g.them);
    if (g.us === g.them) { if (R() < 0.5 + (sc - 1.5) * 0.3) g.us += 3; else g.them += 3; }
    g.win = g.us > g.them;
    g.grade = sc >= 2.4 ? 'A' : sc >= 1.9 ? 'B' : sc >= 1.4 ? 'C' : sc >= 0.9 ? 'D' : 'F';
    g.score = sc;
    g.done = true;
    return g;
  };
  C_.addStats = (into, st) => { for (const k in st) into[k] = (into[k] || 0) + st[k]; return into; };

  // ================= college =================
  C_.collegeDone = (C) => C.college.games.every((x) => x.done);
  C_.recordCollege = function (C, idx, g) {
    const cg = C.college.games[idx];
    Object.assign(cg, { done: true, us: g.us, them: g.them, win: g.win, grade: g.grade, stats: g.stats });
    C_.addStats(C.college.stats, g.stats);
    C.college.grades.push(g.score);
    C.college.stock = clamp(C.college.stock + (g.score - 1.5) * 9 + (g.win ? 3 : -2), 5, 99);
    if (g.win && GI.legacy) GI.legacy.addLP(1, 'College win');
    C.log.unshift(`College: ${g.win ? 'W' : 'L'} ${g.us}-${g.them} vs ${GI.COLLEGES[cg.opp]} (grade ${g.grade})`);
    C_.save(C);
  };
  // combine drills: quality 0..1 from the timing taps
  C_.DRILLS = [{ id: 'dash', name: '40-Yard Dash', desc: 'Tap when the needle is in the green' }, { id: 'power', name: 'Strength', desc: 'Time your lift' }, { id: 'skill', name: 'Position Drill', desc: 'Nail the technique' }];
  C_.combineDone = function (C, scores) {
    const avg = scores.reduce((t, x) => t + x, 0) / scores.length;
    C.combine = { scores, avg };
    C.college.stock = clamp(C.college.stock + (avg - 0.55) * 30, 5, 99);
    if (avg >= 0.85) { C.p.rating = Math.min(99, C.p.rating + 2); C.log.unshift('Combine: blew up the drills (+2 OVR)'); }
    C.phase = 'draft';
    C.mock = C_.mockDraft(C);
    C_.save(C);
  };
  C_.projRound = (C) => { const s = C.college.stock + (C.p.rating - 66) * 1.5; return s >= 82 ? 1 : s >= 70 ? 2 : s >= 58 ? 3 : s >= 46 ? 4 : s >= 34 ? 5 : 6; };
  C_.mockDraft = function (C) {
    const rd = C_.projRound(C);
    const teams = [...Array(32).keys()].sort(() => R() - 0.5).slice(0, 3);
    return teams.map((t, k) => ({ outlet: ['The Gazette', 'Draft Daily', 'Scout Sheet'][k], round: clamp(rd + ri(-1, 1), 1, 7), team: t, pick: ri(1, 32) }));
  };
  // standalone draft (no franchise): where does he land?
  C_.runDraft = function (C) {
    const rd = clamp(C_.projRound(C) + (R() < 0.25 ? (R() < 0.5 ? -1 : 1) : 0), 1, 7);
    const team = ri(0, 31), pickN = ri(1, 32);
    C.draft = { round: rd, pick: pickN, overall: (rd - 1) * 32 + pickN, team };
    if (rd === 1 && GI.legacy) GI.legacy.addLP(5, 'First-round pick');
    C.phase = 'pro';
    C.p.age = 22;
    C.pro = { team, year: 1, contract: { years: 3, salary: r1(clamp(0.6 + (C.p.rating - 60) * 0.09 + (rd === 1 ? 1 : 0), 0.6, 4)) }, seasons: [], season: null };
    C.log.unshift(`Drafted: round ${rd}, pick ${pickN} by the ${GI.TEAMS[team].city} ${GI.TEAMS[team].name}`);
    if (GI.legacy) GI.legacy.collect([C_.sticker(C)], 'Career');
    C_.newSeason(C);
    C_.save(C);
    return C.draft;
  };
  // franchise hook: enter your franchise's next draft
  C_.enterFranchise = function (C, S) {
    const p = C.p;
    const prospect = { id: p.id, pos: p.pos, name: p.name, num: p.num, rating: p.rating, pot: p.pot, age: 22, clutch: p.clutch, dur: p.dur, ego: p.ego, spark: p.spark, college: p.college, yrsPro: 0, rookie: true, traits: p.traits.slice(), career: { seasons: 0, gp: 0 }, formerTeams: [], awards: [], careerPlayer: true };
    S.careerProspect = prospect;
    GI.season.save(S);
    C.phase = 'franchise';
    C.franchise = { fid: S.fid, waiting: true };
    C.log.unshift(`Entered the ${GI.TEAMS[S.user].city} franchise's Year ${S.year + (S.phase === 'draft' ? 0 : 1)} draft`);
    C_.save(C);
  };
  C_.onFranchiseDraft = function (S, team, cur) {
    const C = C_.load();
    if (!C || !C.franchise || C.franchise.fid !== S.fid) return;
    C.franchise = { fid: S.fid, team, round: cur.round, pick: cur.inRound, overall: (cur.round - 1) * 32 + cur.inRound, mine: team === S.user, year: S.year };
    C.log.unshift(`Drafted in your franchise: round ${cur.round} by ${team === S.user ? 'YOU' : GI.TEAMS[team].city}`);
    if (GI.legacy) GI.legacy.collect([C_.sticker(C)], 'Career');
    C_.save(C);
  };
  C_.sticker = (C) => ({ key: 'career:' + C.p.id, name: C.p.name, pos: C.p.pos, num: C.p.num, rating: C.p.rating, team: C.pro ? GI.TEAMS[C.pro.team].abbr : 'COL', tname: C.pro ? GI.TEAMS[C.pro.team].name : C.p.college, c1: C.pro ? GI.TEAMS[C.pro.team].c1 : GI.COLLEGE_COLORS[C.p.ci], c2: C.pro ? GI.TEAMS[C.pro.team].c2 : '#ffffff', glyph: C.pro ? GI.TEAMS[C.pro.team].glyph || GI.TEAM_GLYPH[C.pro.team] : GI.TEAM_GLYPH[(C.p.ci * 7 + 5) % 32], ti: C.pro ? C.pro.team : null, year: C.pro ? C.pro.year : 0 });

  // ================= pro career =================
  C_.newSeason = function (C) {
    const pr = C.pro;
    const opps = [...Array(32).keys()].filter((x) => x !== pr.team).sort(() => R() - 0.5).slice(0, C.weeks);
    pr.season = { year: pr.year, games: opps.map((o, k) => ({ opp: o, home: k % 2 === 0, done: false })), w: 0, l: 0, stats: {}, playoff: null, done: false };
    C_.save(C);
  };
  C_.proTeamOvr = (C) => GI.TEAMS[C.pro.team].ovr;
  C_.recordPro = function (C, g, playoffRound) {
    const s = C.pro.season;
    if (playoffRound != null) {
      s.playoff.games.push({ opp: s.playoff.opp, us: g.us, them: g.them, win: g.win, grade: g.grade, round: playoffRound });
      C_.addStats(s.stats, g.stats);
      if (g.win) { s.playoff.round++; if (GI.legacy) GI.legacy.addLP(2, 'Pro playoff win'); }
      else s.playoff.out = true;
      if (s.playoff.round >= 3 && g.win) { s.playoff.champ = true; C.p.rings = (C.p.rings || 0) + 1; if (GI.legacy) { GI.legacy.addLP(15, 'Career: Iron-Bowl ring'); GI.legacy.collect([C_.sticker(C)], 'Champion'); } }
      if (!s.playoff.out && !s.playoff.champ) s.playoff.opp = ri(0, 31) === C.pro.team ? (C.pro.team + 1) % 32 : ri(0, 31);
    } else {
      const cg = s.games.find((x) => !x.done);
      Object.assign(cg, { done: true, us: g.us, them: g.them, win: g.win, grade: g.grade });
      C_.addStats(s.stats, g.stats);
      if (g.win) s.w++; else s.l++;
      if (s.games.every((x) => x.done) && s.w / C.weeks >= 0.6) s.playoff = { round: 0, games: [], opp: (C.pro.team + ri(1, 31)) % 32 };
    }
    C.p.career.gp++;
    C_.save(C);
  };
  C_.seasonOver = (C) => { const s = C.pro.season; return s.games.every((x) => x.done) && (!s.playoff || s.playoff.out || s.playoff.champ); };
  // season ends: awards, growth, contract, maybe retire
  C_.endSeason = function (C) {
    const p = C.p, pr = C.pro, s = pr.season;
    const sc = GI.league.statScore(s.stats);
    const par = GI.league.statScore(Object.fromEntries(Object.entries(PAR[p.pos]).map(([k, v]) => [k, v * C.weeks]))) || 1;
    const rel = sc / par / (BASE_REL[p.pos] || 1.5); // 1.0 = an average season of moments
    const winning = s.w / C.weeks >= 0.6;
    const aw = [];
    if (rel >= 1.42 && winning) aw.push('MVP');
    else if (rel >= 1.3) aw.push(DEF.includes(p.pos) ? 'DPOY' : 'OPOY');
    if (pr.year === 1 && rel >= 1.05) aw.push('ROY');
    if (rel >= 1.17) aw.push('All-Iron');
    aw.forEach((a) => p.awards.push(`${pr.year} ${a}`));
    if (GI.legacy) { aw.forEach((a) => GI.legacy.addLP(a === 'MVP' ? 20 : a === 'All-Iron' ? 4 : 10, `Career: ${a}`)); if (aw.some((a) => a !== 'All-Iron')) GI.legacy.collect([C_.sticker(C)], aw.find((a) => a !== 'All-Iron')); }
    p.career.seasons++;
    C_.addStats(p.career, s.stats);
    // growth: age curve + how well you played
    const before = p.rating;
    let gr = (p.age <= 25 ? gauss(2.2, 1.5) : p.age <= 29 ? gauss(0.6, 1.2) : p.age <= 32 ? gauss(-1.5, 1.2) : gauss(-3.5, 1.5)) + clamp((rel - 1) * 4, -3, 3);
    if (p.traits.includes('gymrat')) gr += 1;
    let breakthrough = false;
    if (p.age <= 26 && R() < p.spark) { gr += ri(7, 12); breakthrough = true; p.spark = 0.02; }
    p.rating = Math.round(clamp(p.rating + gr, 45, 99));
    p.age++;
    pr.seasons.push({ year: pr.year, team: pr.team, w: s.w, l: s.l, stats: s.stats, awards: aw, champ: !!(s.playoff && s.playoff.champ), playoff: s.playoff ? s.playoff.round : null, rating: before });
    pr.contract.years--;
    const summary = { aw, rel, before, after: p.rating, breakthrough, champ: !!(s.playoff && s.playoff.champ) };
    pr.year++;
    C.lastSummary = summary;
    if (pr.contract.years <= 0) C.offers = C_.contractOffers(C);
    C.mustRetire = p.age >= 38 || p.rating < 60;
    pr.season = null;
    C_.save(C);
    return summary;
  };
  C_.contractOffers = function (C) {
    const p = C.p, ask = r1(clamp(1 + (p.rating - 66) * 0.32 + (p.awards.length ? 1 : 0), 0.8, 16));
    const teams = [C.pro.team].concat([...Array(32).keys()].filter((x) => x !== C.pro.team).sort(() => R() - 0.5).slice(0, 2));
    return teams.map((t, k) => ({ team: t, salary: r1(ask * (k === 0 ? 0.95 : 0.95 + R() * 0.3)), years: ri(1, 4), contender: GI.TEAMS[t].ovr }));
  };
  C_.signOffer = function (C, k) {
    const o = C.offers[k];
    if (o.team !== C.pro.team) { C.log.unshift(`Signed with the ${GI.TEAMS[o.team].city} ${GI.TEAMS[o.team].name}: ${o.years} yrs, $${o.salary}M`); }
    C.pro.team = o.team; C.pro.contract = { years: o.years, salary: o.salary };
    C.offers = null;
    C_.newSeason(C);
  };
  C_.retire = function (C) {
    const p = C.p;
    const score = GI.league.hofScore(p);
    C.hof = score >= GI.league.HOF_LINE;
    C.hofScore = Math.round(score);
    C.phase = 'retired';
    if (C.hof && GI.legacy) {
      GI.legacy.addLP(20, 'Career: Hall of Fame');
      GI.legacy.addHof({ fid: 'career', year: C.pro ? C.pro.year : 0, name: p.name, pos: p.pos, team: C.pro ? C.pro.team : 0, tname: C.pro ? GI.TEAMS[C.pro.team].name : '', score: C.hofScore, awards: p.awards, rings: p.rings, line: GI.league.statLine(p.career), career: true });
      GI.legacy.collect([C_.sticker(C)], 'Hall of Fame');
    }
    C.log.unshift(C.hof ? 'Retired — first-ballot Hall of Famer!' : 'Retired after a fine career.');
    C_.save(C);
  };
  C_.PAR = PAR;
})();
