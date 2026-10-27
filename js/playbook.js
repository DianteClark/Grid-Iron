/* Grid Iron v1 — the playbook: 4 offensive formations × 3 plays and 4 defensive packages × 3 calls.
   Every offensive play has exactly ONE defensive call that shuts it down (−2) and exactly ONE it gashes (+2);
   every defensive call is the hard counter of exactly one play. Each play also maps to a "base" family
   (in_run, out_run, short, long, trick / man, zone, deep, press, blitz_in, blitz_out) that the physics use. */
(function () {
  const GI = window.GI;
  // keep the classic five-and-six around: the engine's physics are written against them
  GI.OFF_BASE = GI.OFF_PLAYS; GI.DEF_BASE = GI.DEF_PLAYS; GI.MATRIX_BASE = GI.MATRIX; GI.REASON_BASE = GI.REASON;

  const FORMS = [
    { id: 'iform', name: 'I-Form', short: 'I-Form', desc: 'Power football under center' },
    { id: 'gun', name: 'Shotgun', short: 'Gun', desc: 'Spread them out and throw' },
    { id: 'single', name: 'Singleback', short: 'Single', desc: 'Balanced: stretch, draw, crossers' },
    { id: 'trick', name: 'Trick Bag', short: 'Trick', desc: 'Gadgets and screens' },
  ];
  const FRONTS = [
    { id: 'base', name: 'Base 4-3', short: '4-3', desc: 'Sound against the run' },
    { id: 'nickel', name: 'Nickel', short: 'Nickel', desc: 'Man coverage looks' },
    { id: 'dime', name: 'Dime', short: 'Dime', desc: 'Protect the deep ball' },
    { id: 'blitz', name: 'Blitz', short: 'Blitz', desc: 'Send the house' },
  ];
  // offense: id, name, formation, base family, tag, the call that stops it, the call it gashes, one-liners
  const OFF = [
    ['power', 'Power Dive', 'iform', 'in_run', 'RUN', 'run_commit', 'quarters', 'Downhill behind a lead block'],
    ['counter', 'Counter Trey', 'iform', 'in_run', 'RUN', 'agap', 'edge', 'Fake one way, pull guards the other'],
    ['pa_boot', 'PA Boot', 'iform', 'long', 'PASS', 'cover3', 'run_commit', 'Fake the run, roll out, go deep'],
    ['slants', 'Slants', 'gun', 'short', 'PASS', 'robber', 'cover3', 'Quick inside breaks, ball out fast'],
    ['verticals', 'Four Verticals', 'gun', 'long', 'PASS', 'quarters', 'cover2', 'Everybody goes deep'],
    ['bubble', 'Bubble Screen', 'gun', 'short', 'SCREEN', 'press', 'agap', 'Quick flip to the slot, blockers out front'],
    ['stretch', 'Outside Zone', 'single', 'out_run', 'RUN', 'edge', 'prevent', 'Stretch it wide and cut back'],
    ['draw', 'Draw', 'single', 'in_run', 'RUN', 'tampa', 'zero', 'Show pass, hand it off late'],
    ['mesh', 'Mesh', 'single', 'short', 'PASS', 'cover2', 'man1', 'Crossing routes that rub off defenders'],
    ['flea', 'Flea Flicker', 'trick', 'trick', 'TRICK', 'prevent', 'robber', 'Hand off, pitch back, launch it'],
    ['reverse', 'WR Reverse', 'trick', 'out_run', 'TRICK', 'zero', 'press', 'Slot receiver takes it the other way'],
    ['rb_screen', 'RB Screen', 'trick', 'short', 'SCREEN', 'man1', 'tampa', 'Let them in, dump it to the back'],
  ];
  const DEF = [
    ['cover2', 'Cover 2', 'base', 'zone', 'ZONE', 'Two deep safeties, corners squat'],
    ['cover3', 'Cover 3', 'base', 'zone', 'ZONE', 'Three deep, four under'],
    ['run_commit', 'Run Commit', 'base', 'blitz_in', 'RUN D', 'Eight in the box'],
    ['man1', 'Cover 1 Man', 'nickel', 'man', 'MAN', 'Man across, one safety deep'],
    ['press', 'Press Man', 'nickel', 'press', 'MAN', 'Jam them at the line'],
    ['robber', 'Robber', 'nickel', 'man', 'MAN', 'A safety lurks to jump routes'],
    ['quarters', 'Cover 4', 'dime', 'deep', 'DEEP', 'Four deep, nothing over the top'],
    ['prevent', 'Prevent', 'dime', 'deep', 'DEEP', 'Give the short stuff, never the long'],
    ['tampa', 'Tampa 2', 'dime', 'zone', 'ZONE', 'The Mike drops into the middle'],
    ['agap', 'A-Gap Blitz', 'blitz', 'blitz_in', 'BLITZ', 'Linebackers shoot the middle'],
    ['edge', 'Edge Blitz', 'blitz', 'blitz_out', 'BLITZ', 'Pressure off both edges'],
    ['zero', 'Cover 0 Blitz', 'blitz', 'blitz_in', 'BLITZ', 'Everybody comes, nobody deep'],
  ];
  const OFF_PLAYS = OFF.map(([id, name, form, base, tag, counter, gash, desc]) => ({ id, name, form, base, tag, counter, gash, desc }));
  const DEF_PLAYS = DEF.map(([id, name, front, base, tag, desc]) => ({ id, name, front, base, tag, desc }));
  const BASE = {};
  OFF_PLAYS.forEach((p) => (BASE[p.id] = p.base));
  DEF_PLAYS.forEach((p) => (BASE[p.id] = p.base));
  // the 12 × 12 matrix: the base families set the tone (softened to ±1), then the hard counter and the gash
  const MATRIX = {};
  OFF_PLAYS.forEach((o) => {
    MATRIX[o.id] = {};
    DEF_PLAYS.forEach((d) => {
      const b = (GI.MATRIX_BASE[o.base] || {})[d.base] || 0;
      MATRIX[o.id][d.id] = Math.max(-1, Math.min(1, b));
    });
    MATRIX[o.id][o.counter] = -2;
    MATRIX[o.id][o.gash] = 2;
  });
  // why it worked (or didn't): the counter and the gash for every play
  const WHY = {
    'power|run_commit': 'Eight in the box swallowed the lead block', 'power|quarters': 'Light box — the dive hit a wide-open lane',
    'counter|agap': 'The A-gap blitz was already in the backfield', 'counter|edge': 'The edge rushers over-ran the counter',
    'pa_boot|cover3': 'Three deep never bit on the fake', 'pa_boot|run_commit': 'The box bit on the fake — wide open over the top',
    'slants|robber': 'The robber jumped the slant', 'slants|cover3': 'Slants carved up the soft middle of Cover 3',
    'verticals|quarters': 'Four deep matched four verticals', 'verticals|cover2': 'Four verticals split the two safeties',
    'bubble|press': 'Press corners blew up the bubble', 'bubble|agap': 'The blitz left the flat empty',
    'stretch|edge': 'The edge blitz set the edge and turned it in', 'stretch|prevent': 'Prevent left the edge wide open',
    'draw|tampa': 'The Mike sat in the middle and read the draw', 'draw|zero': 'Everybody rushed the passer — the draw went right past them',
    'mesh|cover2': 'Zone defenders passed the crossers off cleanly', 'mesh|man1': 'The rub routes lost the man defenders',
    'flea|prevent': 'Prevent had everybody deep for the flea flicker', 'flea|robber': 'The robber bit on the handoff — nobody deep',
    'reverse|zero': 'The blitz got in before the reverse developed', 'reverse|press': 'Press corners were sealed inside',
    'rb_screen|man1': 'The linebacker stayed on the back the whole way', 'rb_screen|tampa': 'Tampa 2 dropped everyone — the screen had blockers in front',
  };
  // swap the playbook in
  GI.OFF_PLAYS = OFF_PLAYS; GI.DEF_PLAYS = DEF_PLAYS; GI.MATRIX = MATRIX;
  GI.REASON = Object.assign({}, GI.REASON_BASE, WHY);
  GI.FORMATIONS = FORMS; GI.FRONTS = FRONTS;
  GI.baseOf = (id) => BASE[id] || id; // a base id maps to itself (old saves, the physics)
  GI.counterOf = function (off) { const p = OFF_PLAYS.find((x) => x.id === off); if (p) return p.counter; const row = GI.MATRIX_BASE[off]; return row ? Object.keys(row).find((d) => row[d] === -2) : null; };
  GI.gashOf = function (off) { const p = OFF_PLAYS.find((x) => x.id === off); return p ? p.gash : null; };
  GI.matrixOf = (o, d) => (MATRIX[o] && MATRIX[o][d] != null ? MATRIX[o][d] : ((GI.MATRIX_BASE[GI.baseOf(o)] || {})[GI.baseOf(d)] || 0));
  GI.playName = function (id) {
    const p = OFF_PLAYS.concat(DEF_PLAYS, GI.OFF_BASE, GI.DEF_BASE).find((x) => x.id === id);
    return p ? p.name : ({ punt: 'Punt', fg: 'Field Goal', xp: 'Extra Point', kick: 'Kickoff' }[id] || id);
  };
  // an old base id (saved prefs, v0.7 games) maps to the first play of that family
  GI.toPlay = function (id, kind) {
    const list = kind === 'def' ? DEF_PLAYS : OFF_PLAYS;
    if (list.some((p) => p.id === id)) return id;
    const p = list.find((x) => x.base === id);
    return p ? p.id : list[kind === 'def' ? 1 : 3].id;
  };
  GI.playOf = (id) => OFF_PLAYS.find((x) => x.id === id) || DEF_PLAYS.find((x) => x.id === id) || null;
  // spread base-family weights across the plays in that family, with a formation lean (by coordinator style)
  const OFF_LEAN = { run: { iform: 1.4, single: 1.1 }, pass: { gun: 1.4 }, gadget: { trick: 1.7 }, balanced: { single: 1.25 } };
  const DEF_LEAN = { blitz: { blitz: 1.4 }, cover: { dime: 1.35, base: 1.1 }, press: { nickel: 1.4 }, balanced: { base: 1.2 } };
  GI.spreadOff = function (baseW, style) {
    const out = {}, lean = OFF_LEAN[style] || {};
    OFF_PLAYS.forEach((p) => {
      const n = OFF_PLAYS.filter((x) => x.base === p.base).length;
      out[p.id] = ((baseW[p.base] || 0) / n) * (lean[p.form] || 1);
    });
    return out;
  };
  GI.spreadDef = function (baseW, style) {
    const out = {}, lean = DEF_LEAN[style] || {};
    DEF_PLAYS.forEach((p) => {
      const n = DEF_PLAYS.filter((x) => x.base === p.base).length;
      out[p.id] = ((baseW[p.base] || 0) / n) * (lean[p.front] || 1);
    });
    return out;
  };
})();
