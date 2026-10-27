// one harness: CPU-vs-CPU win curve + how far play-calling skill can carry the worse team
global.window = {}; global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const root = __dirname + '/../js/';
['data', 'stadium', 'sim', 'rating'].forEach((f) => require(root + f + '.js'));
const GI = window.GI;
if (process.env.BAL) Object.assign(GI.BAL, JSON.parse(process.env.BAL));
const N = +(process.env.N || 200), STARS = process.env.STARS !== '0';
function team(idx, ovr) {
  const t = GI.buildTeam(idx);
  const j = () => Math.round((Math.random() - 0.5) * 6);
  t.base = { run: ovr + j(), pass: ovr + j(), ol: ovr + j(), runD: ovr + j(), passD: ovr + j(), rush: ovr + j(), st: ovr + j() };
  if (STARS) t.stars.forEach((s) => (s.rating = Math.min(99, ovr + 10 + j())));
  else t.stars = [];
  ['hc', 'oc', 'dc', 'stc'].forEach((k) => (t.coaches[k].rating = 70));
  return t;
}
const offs = GI.OFF_PLAYS.map((p) => p.id), defs = GI.DEF_PLAYS.map((p) => p.id);
const bestOff = (d) => offs.slice().sort((a, b) => GI.MATRIX[b][d] - GI.MATRIX[a][d])[0];
const bestDef = (o) => defs.slice().sort((a, b) => GI.MATRIX[o][a] - GI.MATRIX[o][b])[0];
function play(G, policy) {
  let guard = 0; G.auto = true;
  while (!G.over && guard++ < 3000) {
    let act = GI.autoCall(G); if (!act) break;
    if (act.type === 'play' && act.call && policy !== 'cpu' && G.pending) {
      const userOff = G.poss === G.user;
      const smart = policy === 'oracle' ? 1 : policy === 'reader' ? 0.45 : 0; // reader: guesses right ~45% of snaps
      if (Math.random() < smart) act = { type: 'play', call: userOff ? bestOff(G.pending.cpuDef) : bestDef(G.pending.cpuOff) };
    }
    GI.step(G, act);
  }
}
function rate(gap, policy) {
  let w = 0, pts = 0;
  for (let i = 0; i < N; i++) {
    const worse = team(i % 32, 70 - gap / 2), better = team((i + 9) % 32, 70 + gap / 2);
    const home = i % 2 === 0;
    const G = GI.newGame({ user: worse.idx, opp: better.idx, userHome: home, qMin: 5, neutral: true, weather: 'clear' });
    G.teams[home ? 'home' : 'away'] = worse; G.teams[home ? 'away' : 'home'] = better; G.diff = 'sim'; G.effMods = null;
    play(G, policy);
    const us = G.score[G.user], them = G.score[home ? 'away' : 'home'];
    if (us < them) w++; else if (us === them) w += 0.5;
    pts += us + them;
  }
  return { better: Math.round(w / N * 100), pts: (pts / N).toFixed(1) };
}
const res = {};
const target = { 0: 50, 5: 70, 10: 78, 15: 85, 20: 90, 25: 93 };
let err = 0, line = [];
for (const g of (process.env.GAPS || '5,10,20').split(',').map(Number)) { const r = rate(g, 'cpu'); line.push(`+${g}: ${r.better}% (t${target[g]}) ${r.pts}pts`); err += Math.abs(r.better - target[g]); }
const rd = rate(20, 'reader'), or = rate(20, 'oracle'), r10 = rate(10, 'oracle');
console.log(JSON.stringify(GI.BAL), '|', line.join(' · '), `| -20 reader beats better ${100 - rd.better}% · oracle ${100 - or.better}% | -10 oracle ${100 - r10.better}% | err ${err}`);
