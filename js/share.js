/* Grid Iron v1 — sharing: team codes, result codes, the Friends table (rivalries) and share cards.
   No server: a code is the data itself, compressed and checksummed. The checksum catches typos and
   casual edits; it is not security. */
(function () {
  const GI = window.GI;
  const R = Math.random;
  const FKEY = 'gridiron_friends', CKEY = 'gridiron_cards';
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  // ---------- encoding ----------
  function fnv(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); }
  const SALT = 'gridiron-v1';
  function b64u(bytes) { let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function unb64u(str) { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4)); const out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; }
  async function pipe(bytes, Stream, fmt) { const cs = new Stream(fmt); const w = cs.writable.getWriter(); w.write(bytes).catch(() => {}); w.close().catch(() => {}); return new Uint8Array(await new Response(cs.readable).arrayBuffer()); }
  const canZip = typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
  async function encode(kind, obj) {
    const body = JSON.stringify(obj);
    const json = JSON.stringify([fnv(SALT + body), obj]);
    const raw = new TextEncoder().encode(json);
    if (canZip) { try { return `GI1${kind}.` + b64u(await pipe(raw, CompressionStream, 'deflate-raw')); } catch (e) {} }
    return `GI0${kind}.` + b64u(raw);
  }
  async function decode(code) {
    code = String(code || '').trim();
    const url = code.match(/[#?&](?:t|r)=([A-Za-z0-9_.\-]+)/);
    if (url) code = decodeURIComponent(url[1]);
    code = code.replace(/\s+/g, '');
    const m = code.match(/^GI([01])([TR])\.([A-Za-z0-9_\-]+)$/);
    if (!m) return { ok: false, why: "That doesn't look like a Grid Iron code." };
    let bytes;
    try { bytes = unb64u(m[3]); } catch (e) { return { ok: false, why: 'The code is incomplete. Copy the whole thing.' }; }
    try {
      if (m[1] === '1') { if (!canZip) return { ok: false, why: 'This browser is too old to read compressed codes.' }; bytes = await pipe(bytes, DecompressionStream, 'deflate-raw'); }
      const [sum, obj] = JSON.parse(new TextDecoder().decode(bytes));
      if (sum !== fnv(SALT + JSON.stringify(obj))) return { ok: false, why: "The code didn't pass its check. Was it edited?" };
      return { ok: true, kind: m[2] === 'T' ? 'team' : 'result', data: obj };
    } catch (e) { return { ok: false, why: 'The code is damaged. Copy the whole thing.' }; }
  }

  // ---------- your identity ----------
  function me() {
    const p = GI.prefs.get();
    let id = p.friendId;
    if (!id) { id = 'u' + Date.now().toString(36) + Math.floor(R() * 1e6).toString(36); GI.prefs.set({ friendId: id }); }
    return { id, coach: p.coachName || 'Coach' };
  }

  // ---------- team codes ----------
  // the franchise team as it stands today: 16 cards, staff, captains and Impact Cards
  function teamPayload(S) {
    const r = S.rosters[S.user], t = GI.TEAMS[S.user];
    const v = GI.venueOf(S.user, S);
    const cards = r.stars.slice(0, 16);
    const ci = (id) => cards.findIndex((c) => c.id === id);
    const u = GI.cards.units(r);
    return {
      f: me().id, c: me().coach, y: S.year, at: Date.now(), ovr: u.ovr, rec: [S.rec[S.user].w, S.rec[S.user].l],
      t: [S.user, t.city, t.name, t.abbr, t.c1, t.c2, t.glyph || (GI.TEAM_GLYPH ? GI.TEAM_GLYPH[S.user] : null)],
      co: ['hc', 'oc', 'dc', 'stc'].map((k) => [r.coaches[k].name, r.coaches[k].rating, r.coaches[k].style || 0]),
      id: r.identity || 0,
      ca: [ci((r.captains || {}).o), ci((r.captains || {}).d)],
      sl: (r.impSlots || []).map(ci).filter((x) => x >= 0),
      v: [v.name, v.roof, v.surface, v.climate],
      s: cards.map((c) => [c.pos, c.name, c.num == null ? -1 : c.num, c.age, GI.cards.STATS[c.pos].map(([k]) => c.stats[k]), c.imp || 0, c.traits || [], c.clutch || 70]),
    };
  }
  const teamCode = (S) => encode('T', teamPayload(S));
  const ROLE_NAMES = { hc: 'Head Coach', oc: 'Offensive Coord.', dc: 'Defensive Coord.', stc: 'Special Teams' };
  // a decoded team code → franchise-style team data the game engine can play
  function teamData(d) {
    const [idx, city, name, abbr, c1, c2, glyph] = d.t;
    const stars = d.s.map((x, i) => {
      const [pos, nm, num, age, st, imp, traits, clutch] = x;
      const stats = {};
      GI.cards.STATS[pos].forEach(([k], j) => (stats[k] = Math.max(35, Math.min(99, +st[j] || 50))));
      const c = { id: 'fr' + i, pos, name: nm, num: num < 0 ? null : num, age, stats, imp, traits: traits || [], clutch: clutch || 70, dur: 80, ego: 30, unit: pos === 'OL' || pos === 'DL' };
      GI.cards.refresh(c);
      return c;
    });
    const coaches = {};
    ['hc', 'oc', 'dc', 'stc'].forEach((k, i) => { const [n, rt, sty] = d.co[i]; coaches[k] = { role: ROLE_NAMES[k], name: n, rating: rt }; if (sty) coaches[k].style = sty; });
    return {
      v: 1, idx, stars, benchList: [], base: {}, coaches, identity: d.id || null,
      ident: { city, name, abbr, c1, c2, glyph },
      captains: { o: d.ca[0] >= 0 ? 'fr' + d.ca[0] : null, d: d.ca[1] >= 0 ? 'fr' + d.ca[1] : null },
      impSlots: (d.sl || []).map((i) => 'fr' + i),
      venue: { name: d.v[0], roof: d.v[1], surface: d.v[2], climate: d.v[3], idx },
    };
  }

  // ---------- the Friends table ----------
  function friends() { return load(FKEY, { list: [], seen: [], news: [] }); }
  function saveFriends(F) { store(FKEY, F); }
  function friendOf(F, id) { return F.list.find((x) => x.id === id); }
  // add or refresh a friend from their team code
  function addTeam(d) {
    if (d.f === me().id) return { ok: false, why: "That's your own team code. Send it to a friend instead." };
    const F = friends();
    let fr = friendOf(F, d.f);
    const fresh = !fr;
    if (!fr) { fr = { id: d.f, w: 0, l: 0, t: 0, games: [], heat: 0, added: Date.now() }; F.list.push(fr); }
    Object.assign(fr, { coach: d.c, team: d, updated: Date.now() });
    saveFriends(F);
    return { ok: true, friend: fr, fresh };
  }
  // heat: every game warms it up; close games, losses and streaks warm it more
  function heatLabel(h) { return h >= 60 ? 'Bitter rivals' : h >= 30 ? 'Rivals' : h >= 10 ? 'Grudge match' : 'Friendly'; }
  function recordGame(g) {
    const F = friends();
    if (F.seen.includes(g.rid)) return { ok: false, dup: true, why: 'That result is already in your Friends table.' };
    const fr = friendOf(F, g.opp);
    if (!fr) return { ok: false, why: 'Add their team code first.' };
    F.seen.push(g.rid); if (F.seen.length > 400) F.seen.shift();
    const won = g.us > g.them, lost = g.us < g.them;
    if (won) fr.w++; else if (lost) fr.l++; else fr.t++;
    const margin = Math.abs(g.us - g.them);
    const prevStreak = fr.streak || 0;
    fr.streak = won ? Math.max(1, prevStreak + 1) : lost ? Math.min(-1, prevStreak - 1) : 0;
    fr.heat = Math.min(100, (fr.heat || 0) + 6 + (margin <= 3 ? 8 : margin <= 8 ? 4 : 0) + (lost ? 4 : 0) + (g.ot ? 6 : 0) + (Math.abs(fr.streak) >= 3 ? 5 : 0));
    fr.games.unshift(g); fr.games.length = Math.min(fr.games.length, 30);
    const story = drama(fr, g, prevStreak);
    g.story = story;
    F.news.unshift({ at: Date.now(), friend: fr.id, text: story, rid: g.rid }); F.news.length = Math.min(F.news.length, 30);
    saveFriends(F);
    return { ok: true, friend: fr, story };
  }
  // the Gazette writes it up
  function drama(fr, g, prevStreak) {
    const T = fr.team ? fr.team.t : [0, '', fr.stub ? fr.stub.name : 'team', ''];
    const them = `${fr.coach || 'Your friend'}'s ${T[2]}`;
    const sc = `${Math.max(g.us, g.them)}-${Math.min(g.us, g.them)}`;
    const series = fr.w === fr.l ? `The series is tied ${fr.w}-${fr.l}` : fr.w > fr.l ? `You lead the series ${fr.w}-${fr.l}` : `They lead the series ${fr.l}-${fr.w}`;
    const pick = (a) => a[Math.floor(R() * a.length)];
    let line;
    if (g.us > g.them) {
      if (prevStreak <= -3) line = `STREAK SNAPPED! You finally beat ${them}, ${sc}, ending ${-prevStreak} straight losses.`;
      else if (Math.abs(g.us - g.them) <= 3) line = pick([`Heart attack! You edged ${them} ${sc}${g.ot ? ' in overtime' : ''}.`, `By a whisker: you outlasted ${them} ${sc}${g.ot ? ' in OT' : ''}.`]);
      else if (g.us - g.them >= 21) line = pick([`BLOWOUT. You ran ${them} out of the building, ${sc}.`, `No mercy: you hung ${g.us} on ${them} in a ${sc} rout.`]);
      else line = pick([`You took care of business against ${them}, ${sc}.`, `Bragging rights are yours: a ${sc} win over ${them}.`]);
    } else if (g.us < g.them) {
      if (Math.abs(g.us - g.them) <= 3) line = pick([`Gut punch. ${them} stole one ${sc}${g.ot ? ' in overtime' : ''}.`, `So close: ${them} held on ${sc}.`]);
      else if (g.them - g.us >= 21) line = pick([`Embarrassing. ${them} rolled you ${sc}. Expect the group chat to light up.`, `${them} pulled the starters early in a ${sc} beatdown.`]);
      else line = pick([`${them} got the better of you, ${sc}. Time for a rematch.`, `${them} take this round, ${sc}.`]);
    } else line = `A ${g.us}-${g.them} tie with ${them}. Nobody gets bragging rights.`;
    if (g.star) line += ` ${g.star} was the difference.`;
    return `${line} ${series}.${fr.heat >= 30 && (fr.heat - 20) < 30 ? ' This is officially a rivalry.' : ''}`;
  }
  // the code you send back after playing a friend's team
  async function resultCode(G, friendId) {
    const u = G.user, o = u === 'home' ? 'away' : 'home';
    const ut = G.teams[u], ot = G.teams[o];
    const top = topLine(G, u);
    const r = { rid: 'g' + Date.now().toString(36) + Math.floor(R() * 1e8).toString(36), by: me().id, c: me().coach, to: friendId,
      s: [G.score[u], G.score[o]], ot: !!G.ot, at: Date.now(), tm: [ut.abbr, ut.name, ut.c1, ut.c2], op: [ot.abbr, ot.name], star: top };
    return encode('R', r);
  }
  function topLine(G, side) {
    let best = null, bv = 0;
    Object.values(G.ps || {}).forEach((p) => {
      if (p.side !== side) return;
      const v = (p.pyd || 0) / 25 + (p.ptd || 0) * 4 + (p.ryd || 0) / 10 + (p.rtd || 0) * 6 + (p.recyd || 0) / 10 + (p.rectd || 0) * 6 + (p.sk || 0) * 4 + (p.dint || 0) * 5;
      if (v > bv) { bv = v; best = p; }
    });
    return best ? `${GI.POS[best.pos].label} ${GI.shortName(best.name)}` : null;
  }
  // a result code from a friend: their game against YOUR team, recorded from your side
  function importResult(d) {
    if (d.by === me().id) return { ok: false, why: "That's your own result. Send it to your friend." };
    if (d.to !== me().id) return { ok: false, why: 'That game was against someone else\'s team.' };
    const F = friends();
    if (!friendOf(F, d.by)) {
      F.list.push({ id: d.by, coach: d.c, w: 0, l: 0, t: 0, games: [], heat: 0, added: Date.now(), team: null, stub: { abbr: d.tm[0], name: d.tm[1], c1: d.tm[2], c2: d.tm[3] } });
      saveFriends(F);
    }
    return recordGame({ rid: d.rid, opp: d.by, us: d.s[1], them: d.s[0], ot: d.ot, at: d.at, theyPlayed: true, star: d.star && d.s[0] > d.s[1] ? `Their ${d.star}` : null });
  }
  function takeNews() { const F = friends(); const n = F.news.filter((x) => !x.read); F.news.forEach((x) => (x.read = true)); saveFriends(F); return n; }
  function removeFriend(id) { const F = friends(); F.list = F.list.filter((x) => x.id !== id); saveFriends(F); }

  // ---------- share cards: records and achievements ----------
  function cards() { return load(CKEY, []); }
  function addCard(c) {
    const all = cards();
    c.key = c.key || c.kind + ':' + c.title + ':' + (c.player || '') + ':' + (c.year || '');
    if (all.some((x) => x.key === c.key)) return null;
    c.id = 'sc' + Date.now().toString(36) + Math.floor(R() * 1e5).toString(36);
    c.at = Date.now();
    all.unshift(c);
    if (all.length > 120) all.length = 120;
    store(CKEY, all);
    (GI.share._fresh = GI.share._fresh || []).push(c);
    return c;
  }
  function takeFresh() { const f = GI.share._fresh || []; GI.share._fresh = []; return f; }

  // draw a share card as a 1080×1350 image
  function drawCard(c, canvas) {
    const W = 1080, H = 1350;
    canvas.width = W; canvas.height = H;
    const g = canvas.getContext('2d');
    const c1 = c.c1 || '#1d3557', c2 = c.c2 || '#ffffff';
    const tierCol = { record: '#ffc53d', achievement: '#2ee27a', title: '#ffc53d', star: '#b78cff', rivalry: '#ff4d5e' }[c.kind] || '#ffc53d';
    // background: team color into night, with diagonal stripes
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, c1); bg.addColorStop(0.55, '#0b1120'); bg.addColorStop(1, '#05080f');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.save(); g.globalAlpha = 0.07; g.strokeStyle = '#fff'; g.lineWidth = 26;
    for (let x = -H; x < W + H; x += 90) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + H, H); g.stroke(); }
    g.restore();
    // frame
    g.strokeStyle = tierCol; g.lineWidth = 14; roundRect(g, 34, 34, W - 68, H - 68, 46); g.stroke();
    g.globalAlpha = 0.35; g.lineWidth = 3; roundRect(g, 58, 58, W - 116, H - 116, 34); g.stroke(); g.globalAlpha = 1;
    // header
    g.fillStyle = tierCol; g.font = '900 italic 44px system-ui, -apple-system, Segoe UI, sans-serif'; g.textAlign = 'left';
    g.fillText((c.tag || (c.kind === 'record' ? 'NEW RECORD' : 'ACHIEVEMENT')).toUpperCase(), 100, 150);
    g.fillStyle = 'rgba(255,255,255,.7)'; g.font = '800 34px system-ui, -apple-system, sans-serif'; g.textAlign = 'right';
    g.fillText(((c.team || '') + (c.year ? ' · YEAR ' + c.year : '')).toUpperCase(), W - 100, 150);
    // the big number in a jersey
    jersey(g, W / 2, 470, 300, c1, c2, c.num != null ? String(c.num) : c.pos || '★');
    // value, title, player, line: stacked so long titles push the rest down
    g.textAlign = 'center';
    let y = 800;
    if (c.value != null) { g.fillStyle = '#fff'; g.font = '900 italic 170px system-ui, -apple-system, sans-serif'; g.fillText(String(c.value), W / 2, 860); y = 950; }
    g.fillStyle = tierCol; g.font = '900 50px system-ui, -apple-system, sans-serif';
    y = wrap(g, (c.title || '').toUpperCase(), W / 2, y, W - 200, 58) + 92;
    g.fillStyle = '#fff'; g.font = '900 italic 70px system-ui, -apple-system, sans-serif';
    y = wrap(g, (c.player || '').toUpperCase(), W / 2, y, W - 160, 76) + 64;
    g.fillStyle = 'rgba(255,255,255,.72)'; g.font = '700 34px system-ui, -apple-system, sans-serif';
    wrap(g, c.sub || '', W / 2, Math.min(y, H - 190), W - 220, 44);
    // footer wordmark
    g.fillStyle = 'rgba(255,255,255,.9)'; g.font = '900 italic 46px system-ui, -apple-system, sans-serif';
    g.fillText('GRID IRON', W / 2, H - 100);
    return canvas;
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function wrap(g, text, x, y, maxW, lh) {
    const words = String(text).split(' '); let line = '', yy = y;
    words.forEach((w) => { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, yy); line = w; yy += lh; } else line = t; });
    if (line) g.fillText(line, x, yy);
    return yy;
  }
  function jersey(g, cx, cy, s, c1, c2, label) {
    g.save(); g.translate(cx - s / 2, cy - s / 2); g.scale(s / 100, s / 100);
    g.beginPath(); g.moveTo(31, 9); g.lineTo(43, 4); g.bezierCurveTo(46, 9, 54, 9, 57, 4); g.lineTo(69, 9); g.lineTo(92, 21); g.lineTo(84, 43); g.lineTo(74, 39); g.lineTo(74, 88); g.lineTo(26, 88); g.lineTo(26, 39); g.lineTo(16, 43); g.lineTo(8, 21); g.closePath();
    g.fillStyle = c1; g.fill(); g.lineWidth = 2.5; g.strokeStyle = 'rgba(0,0,0,.45)'; g.stroke();
    g.beginPath(); g.moveTo(16, 31); g.lineTo(24, 35); g.moveTo(84, 31); g.lineTo(76, 35); g.strokeStyle = c2; g.lineWidth = 5; g.stroke();
    g.fillStyle = c2; g.font = `900 ${label.length > 2 ? 26 : 38}px system-ui, -apple-system, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(label, 50, 56);
    g.restore(); g.textBaseline = 'alphabetic';
  }
  async function cardBlob(c) {
    const cv = drawCard(c, document.createElement('canvas'));
    return new Promise((res) => cv.toBlob((b) => res(b), 'image/png'));
  }

  // ---------- franchise moments that become share cards ----------
  const SCOPE = { game: 'Single-game', season: 'Single-season', career: 'Career' };
  function who(S, name, teamIdx) {
    const list = GI.season.allStars(S, teamIdx != null ? teamIdx : S.user);
    return list.find((x) => x.name === name) || null;
  }
  function teamBits(S) { const t = GI.TEAMS[S.user]; return { team: t.abbr, c1: t.c1, c2: t.c2, year: S.year }; }
  function fromRecord(S, rec) {
    if (!S || rec.team !== S.user) return null;
    const c = who(S, rec.name);
    return addCard(Object.assign({ kind: 'record', tag: `${SCOPE[rec.scope]} record`, title: `${SCOPE[rec.scope]} ${GI.STAT_NAME[rec.key]}`, value: rec.v.toLocaleString(), player: rec.name, pos: c ? GI.POS[c.pos].label : null, num: c ? c.num : null, sub: `The new league record. ${rec.prev ? 'Old mark: ' + rec.prev.toLocaleString() + '.' : ''}` }, teamBits(S)));
  }
  // the longest pass and run in franchise history, game by game
  function afterUserGame(S, G) {
    if (!S || !G || !G.long) return [];
    const side = G.teams.home.idx === S.user ? 'home' : 'away';
    const opp = G.teams[side === 'home' ? 'away' : 'home'];
    S.longest = S.longest || {};
    const out = [];
    ['pass', 'run'].forEach((k) => {
      const l = G.long[side] && G.long[side][k];
      if (!l || !l.name) return;
      const cur = S.longest[k];
      if (!cur || l.yds > cur.yds) {
        S.longest[k] = { yds: l.yds, name: l.name, year: S.year, qb: l.qb };
        if (l.yds >= 45) {
          const c = addCard(Object.assign({ kind: 'record', tag: 'Franchise record', title: k === 'pass' ? 'Longest pass in franchise history' : 'Longest run in franchise history', value: l.yds + ' yds', player: l.name, pos: GI.POS[l.pos] ? GI.POS[l.pos].label : null, num: l.num,
            sub: `${k === 'pass' && l.qb ? 'From ' + l.qb + ' · ' : ''}${l.td ? 'Touchdown · ' : ''}vs ${opp.name}${cur ? ' · old mark ' + cur.yds : ''}` }, teamBits(S)));
          if (c) out.push(c);
        }
      }
    });
    return out;
  }
  const SEASON_FEATS = [['ryd', 1000, '1,000-yard rusher', 'rushing yards'], ['recyd', 1000, '1,000-yard receiver', 'receiving yards'], ['pyd', 3500, '3,500-yard passer', 'passing yards'], ['ptd', 30, '30 TD passes', 'TD passes'], ['rtd', 15, '15 rushing TDs', 'rushing TDs'], ['sk', 12, 'Double-digit sacks', 'sacks'], ['dint', 7, 'Ballhawk season', 'interceptions']];
  function seasonEnd(S) {
    if (!S || !S.sstats) return;
    const mine = GI.season.allStars(S, S.user);
    mine.forEach((c) => {
      const st = S.sstats[c.id]; if (!st) return;
      SEASON_FEATS.forEach(([k, n, title, word]) => { if ((st[k] || 0) >= n) addCard(Object.assign({ kind: 'achievement', tag: 'Season milestone', title, value: (st[k]).toLocaleString(), player: c.name, pos: GI.POS[c.pos].label, num: c.num, sub: `${(st[k]).toLocaleString()} ${word} in Year ${S.year}` }, teamBits(S))); });
    });
    const r = S.rec[S.user];
    if (r.l === 0 && r.t === 0 && r.w >= 8) addCard(Object.assign({ kind: 'achievement', tag: 'Perfect season', title: 'Undefeated regular season', value: `${r.w}-0`, player: GI.TEAMS[S.user].city + ' ' + GI.TEAMS[S.user].name, sub: 'Nobody beat them all year.' }, teamBits(S)));
  }
  function champions(S) {
    const t = GI.TEAMS[S.user];
    addCard(Object.assign({ kind: 'title', tag: 'Iron-Bowl champions', title: `Year ${S.year} champions`, value: GI.season.recStr(S.rec[S.user]), player: t.city + ' ' + t.name, pos: 'CUP', sub: 'Champions of the Grid Iron.' }, teamBits(S)));
  }
  function starBorn(S, c) {
    addCard(Object.assign({ kind: 'star', tag: 'Star Player', title: 'A Star Player is born', value: c.rating, player: c.name, pos: GI.POS[c.pos].label, num: c.num, sub: `${GI.POS[c.pos].full} · age ${c.age}${c.invest ? ' · ' + c.invest + ' weeks of extra reps' : ''}` }, teamBits(S)));
  }
  function eliteImpact(S, c) {
    addCard(Object.assign({ kind: 'star', tag: 'Elite Impact Card', title: GI.impact.MOVE[c.pos], value: '+20%', player: c.name, pos: GI.POS[c.pos].label, num: c.num, sub: 'Maxed-out Impact Card.' }, teamBits(S)));
  }

  GI.share = { fromRecord, afterUserGame, seasonEnd, champions, starBorn, eliteImpact, encode, decode, me, teamPayload, teamCode, teamData, friends, saveFriends, addTeam, recordGame, resultCode, importResult, takeNews, removeFriend, heatLabel, cards, addCard, takeFresh, drawCard, cardBlob, canZip };
})();
