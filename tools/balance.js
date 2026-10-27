// Balance harness (v1 card teams): CPU-vs-CPU win curve by effective-rating gap, scoring, and how far
// play-calling skill can carry the worse team.   node tools/balance.js   (env: N, GAPS, BAL='{"talent":..}')
global.window = {}; global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const root = __dirname + '/../js/';
['data', 'stadium', 'sim', 'cards', 'rating'].forEach((f) => require(root + f + '.js'));
const GI = window.GI;
if (process.env.BAL) Object.assign(GI.BAL, JSON.parse(process.env.BAL));
const N = +(process.env.N || 200);
// a card team with an exact overall
function team(idx, ovr) {
  const t = GI.buildTeam(idx);
  t.stars = GI.cards.assignRoles(GI.cards.lineup(ovr));
  for (let n = 0; n < 12; n++) {
    const d = ovr - GI.ratings(t).ovr; if (!d) break;
    t.stars.forEach((c) => { for (const k in c.stats) c.stats[k] = Math.max(35, Math.min(99, c.stats[k] + Math.sign(d))); GI.cards.refresh(c); });
  }
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
      const smart = policy === 'oracle' ? 1 : policy === 'reader' ? 0.45 : 0;
      if (Math.random() < smart) act = { type: 'play', call: userOff ? bestOff(G.pending.cpuDef) : bestDef(G.pending.cpuOff) };
    }
    GI.step(G, act);
  }
}
function rate(gap, policy) {
  let w = 0, pts = 0, big = 0;
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
  return { better: Math.round(w / N * 100), pts: (pts / N / 2).toFixed(1) };
}
const target = { 0: 50, 5: 67, 10: 79, 15: 85, 20: 89, 25: 91 };
let err = 0; const line = [];
for (const g of (process.env.GAPS || '5,10,20').split(',').map(Number)) { const r = rate(g, 'cpu'); line.push(`+${g}: ${r.better}% (t${target[g]}) ${r.pts}pts/team`); err += Math.abs(r.better - target[g]); }
let skill = '';
if (!process.env.NOSKILL) { const rd = rate(20, 'reader'), or = rate(20, 'oracle'); skill = `| -20 reader ${100 - rd.better}% oracle ${100 - or.better}%`; }
console.log(JSON.stringify(GI.BAL), '|', line.join(' · '), skill, `| err ${err}`);
