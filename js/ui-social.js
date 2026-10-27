/* Grid Iron v1 — the social screens: Friends (team codes, challenges, result codes, rivalries)
   and Share Cards (records and achievements as images). */
(function () {
  const GI = window.GI;
  const U = GI.UI;
  const { $, $$, esc, show, toast, modal, closeModal, closeBtn, confirmBox, helmet, sfx } = U;
  const SH = GI.share, SN = GI.season;

  const v1Franchise = () => { const S = SN.load(); return S && S.rosters && S.rosters[S.user] && S.rosters[S.user].v === 1 ? S : null; };
  const teamOf = (d) => (d && d.t ? { idx: d.t[0], city: d.t[1], name: d.t[2], abbr: d.t[3], c1: d.t[4], c2: d.t[5], glyph: d.t[6] } : null);
  const linkFor = (code) => `${location.origin}${location.pathname}#${code.startsWith('GI1R') || code.startsWith('GI0R') ? 'r' : 't'}=${code}`;
  async function sendCode(code, text, title) {
    const url = linkFor(code);
    try {
      if (navigator.share) { await navigator.share({ title: title || 'Grid Iron', text, url }); return; }
      await navigator.clipboard.writeText(`${text}\n${url}`); toast('Copied. Paste it to your friend.', 1800);
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      modal(`<div class="row between"><h2>Copy this</h2>${closeBtn}</div><p class="muted" style="font-size:13px">Send this link (or just the code) to your friend.</p><textarea class="codebox" readonly>${esc(url)}</textarea>`, (m) => { m.querySelector('#mx').onclick = closeModal; const t = m.querySelector('textarea'); t.focus(); t.select(); });
    }
  }

  // ================= FRIENDS =================
  let myCode = null, myCodeKey = null;
  async function openFriends() { show('friends'); await renderFriends(); }
  async function renderFriends() {
    const S = v1Franchise();
    const me = SH.me();
    const F = SH.friends();
    let codeHTML;
    if (S) {
      const key = S.fid + ':' + S.year + ':' + S.week + ':' + JSON.stringify(S.rosters[S.user].stars.map((c) => c.rating + (c.imp || 0)));
      if (key !== myCodeKey) { myCode = await SH.teamCode(S); myCodeKey = key; }
      const t = GI.TEAMS[S.user];
      codeHTML = `<div class="sticker panel mycode"><div class="row" style="gap:12px">${helmet(t, 'md')}<div style="flex:1;min-width:0"><span class="label">Your team code</span><h3 style="margin:2px 0">${esc(t.city)} ${esc(t.name)}</h3><p class="muted" style="margin:0;font-size:13px">Year ${S.year} · ${SN.teamOvr(S, S.user)} OVR · ${SN.recStr(S.rec[S.user])}. Send it to a friend; they play your team on their phone.</p></div></div>
        <div class="row" style="gap:8px;margin-top:12px"><button class="btn gold" style="flex:2" id="frShare">Send my team</button><button class="btn ghost" style="flex:1" id="frCopy">Copy code</button></div>
        <p class="muted tiny" style="margin:8px 0 0">The code is a snapshot: send a fresh one after your team changes.</p></div>`;
    } else codeHTML = `<div class="sticker panel"><h3>Your team code</h3><p class="muted" style="margin:0">Start a franchise first. Your franchise team is the one your friends will face, and the one you'll take into their challenges.</p><button class="btn block" id="frNewFr" style="margin-top:10px">New Franchise</button></div>`;
    const list = F.list.slice().sort((a, b) => (b.games[0] ? b.games[0].at : b.added) - (a.games[0] ? a.games[0].at : a.added));
    const row = (fr) => {
      const t = teamOf(fr.team) || (fr.stub ? { idx: 0, abbr: fr.stub.abbr, name: fr.stub.name, c1: fr.stub.c1, c2: fr.stub.c2 } : { idx: 0, abbr: '?', c1: '#334', c2: '#fff' });
      const heat = fr.heat || 0, last = fr.games[0];
      return `<div class="sticker panel friend"><div class="row" style="gap:10px">${helmet(t, 'sm')}<div style="flex:1;min-width:0"><b>${esc(fr.coach || 'Friend')}</b><small class="muted"> · ${esc((t.city ? t.city + ' ' : '') + (t.name || ''))}${fr.team ? ' · ' + fr.team.ovr + ' OVR' : ''}</small>
          <div class="series"><span class="${fr.w > fr.l ? 'up' : fr.w < fr.l ? 'dn' : ''}">${fr.w}-${fr.l}${fr.t ? '-' + fr.t : ''}</span><span class="heat"><i style="width:${heat}%"></i></span><em>${SH.heatLabel(heat)}</em></div></div></div>
        ${last ? `<p class="fstory">${esc(last.story || '')}</p>` : '<p class="fstory muted">No games yet. Play their team, then send them the result code.</p>'}
        <div class="row" style="gap:8px;margin-top:8px">${fr.team ? `<button class="btn green small" style="flex:2" data-play="${esc(fr.id)}">Play their team</button>` : '<span class="muted tiny" style="flex:2">Ask for their team code to play them.</span>'}<button class="btn ghost small" data-hist="${esc(fr.id)}">History</button><button class="btn ghost small" data-rm="${esc(fr.id)}" aria-label="Remove">✕</button></div></div>`;
    };
    $('#friendsBody').innerHTML = `<div class="topbar" style="margin-bottom:0"><button class="iconbtn" id="frBack">←</button><h2>Friends</h2></div>
      <div class="sticker panel"><span class="label">Coach name</span><input class="txt" id="frName" maxlength="18" value="${esc(me.coach)}" placeholder="What your friends call you"></div>
      ${codeHTML}
      <div class="sticker panel"><h3>Add a code</h3><p class="muted" style="margin:0 0 8px;font-size:13px">Paste a friend's <b>team code</b> to add them, or a <b>result code</b> after they played your team.</p>
        <textarea class="codebox" id="frIn" placeholder="GI1T.… or GI1R.…" style="min-height:70px"></textarea>
        <div class="row" style="gap:8px;margin-top:8px"><button class="btn gold" style="flex:1" id="frAdd">Add</button>${navigator.clipboard && navigator.clipboard.readText ? '<button class="btn ghost" style="flex:1" id="frPaste">Paste</button>' : ''}</div></div>
      ${list.length ? `<h3 style="margin:6px 2px 0">Your friends</h3>${list.map(row).join('')}` : '<p class="muted" style="text-align:center">No friends yet. Trade team codes to start a rivalry.</p>'}`;
    $('#frBack').onclick = () => { U.refreshTitle(); show('title'); };
    $('#frName').onchange = (e) => { GI.prefs.set({ coachName: e.target.value.trim().slice(0, 18) || 'Coach' }); myCodeKey = null; };
    const on = (id, fn) => { const b = $('#' + id); if (b) b.onclick = fn; };
    on('frShare', () => GI.prefs.set({ sentCode: true }) || sendCode(myCode, `${SH.me().coach}'s ${GI.TEAMS[S.user].name} want a piece of you on Grid Iron.`, 'Grid Iron team code'));
    on('frCopy', async () => { GI.prefs.set({ sentCode: true }); try { await navigator.clipboard.writeText(myCode); toast('Team code copied', 1400); } catch (e) { sendCode(myCode, 'My Grid Iron team code'); } });
    on('frNewFr', () => $('#btnSeason').click());
    on('frPaste', async () => { try { $('#frIn').value = await navigator.clipboard.readText(); } catch (e) { toast('Long-press the box and paste instead.'); } });
    on('frAdd', () => addCode($('#frIn').value));
    $$('#friendsBody [data-play]').forEach((b) => (b.onclick = () => challenge(b.dataset.play)));
    $$('#friendsBody [data-hist]').forEach((b) => (b.onclick = () => showHistory(b.dataset.hist)));
    $$('#friendsBody [data-rm]').forEach((b) => (b.onclick = () => confirmBox('Remove this friend?', 'Their record and rivalry go with them.', 'Remove', 'Keep', () => { SH.removeFriend(b.dataset.rm); renderFriends(); }, true)));
  }
  async function addCode(code) {
    const r = await SH.decode(code);
    if (!r.ok) { toast(r.why, 2200); return false; }
    if (r.kind === 'team') {
      const a = SH.addTeam(r.data);
      if (!a.ok) { toast(a.why, 2200); return false; }
      sfx('select');
      const t = teamOf(r.data);
      toast(a.fresh ? `${r.data.c}'s ${t.name} added. Play them when you're ready.` : `${r.data.c}'s team updated (Year ${r.data.y}).`, 2200);
    } else {
      const a = SH.importResult(r.data);
      if (!a.ok) { toast(a.why, 2200); return false; }
      sfx('paper');
      modal(`<div class="row between"><h2>Result in</h2>${closeBtn}</div><p class="fstory big">${esc(a.story)}</p><p class="muted tiny">It'll make the Gazette in your franchise next week.</p>`, (m) => (m.querySelector('#mx').onclick = closeModal));
    }
    const box = $('#frIn'); if (box) box.value = '';
    renderFriends();
    return true;
  }
  function showHistory(id) {
    const fr = SH.friends().list.find((x) => x.id === id); if (!fr) return;
    modal(`<div class="row between"><h2>vs ${esc(fr.coach || 'Friend')}</h2>${closeBtn}</div><p class="muted">Series ${fr.w}-${fr.l}${fr.t ? '-' + fr.t : ''} · ${SH.heatLabel(fr.heat || 0)}</p>
      ${fr.games.length ? `<ul class="fhist">${fr.games.map((g) => `<li><b class="${g.us > g.them ? 'up' : g.us < g.them ? 'dn' : ''}">${g.us > g.them ? 'W' : g.us < g.them ? 'L' : 'T'} ${g.us}-${g.them}${g.ot ? ' OT' : ''}</b><span>${esc(g.story || '')}</span><small>${new Date(g.at).toLocaleDateString()} · ${g.theyPlayed ? 'they played your team' : 'you played their team'}</small></li>`).join('')}</ul>` : '<p class="muted">No games yet.</p>'}`, (m) => (m.querySelector('#mx').onclick = closeModal));
  }
  // play a friend's team with your franchise team
  function challenge(id) {
    const S = v1Franchise();
    if (!S) { toast('Start a franchise first: your franchise team plays their team.', 2200); return; }
    const fr = SH.friends().list.find((x) => x.id === id); if (!fr || !fr.team) return;
    const t = teamOf(fr.team), ut = GI.TEAMS[S.user];
    modal(`<div class="row between"><h2>Challenge</h2>${closeBtn}</div>
      <div class="ng-mid">${helmet(ut, 'md')}<span class="ng-vs">VS</span>${helmet(t, 'md')}</div>
      <p class="muted" style="text-align:center;margin:6px 0 12px">${esc(ut.name)} (${SN.teamOvr(S, S.user)}) vs ${esc(fr.coach)}'s ${esc(t.name)} (${fr.team.ovr}) · series ${fr.w}-${fr.l}</p>
      <span class="label">Where</span><div class="seg" id="chVen"><button data-v="home" class="on">Your place</button><button data-v="away">Their place</button><button data-v="neutral">Neutral</button></div>
      <p class="muted tiny" style="margin:10px 0">Your franchise team as it is today: injuries and results don't carry over. When it's done you'll get a result code to send them.</p>
      <button class="btn green block" id="chGo">To the pregame ▶</button>`, (m) => {
      let ven = 'home';
      m.querySelector('#mx').onclick = closeModal;
      m.querySelectorAll('#chVen button').forEach((b) => (b.onclick = () => { ven = b.dataset.v; m.querySelectorAll('#chVen button').forEach((x) => x.classList.toggle('on', x === b)); }));
      m.querySelector('#chGo').onclick = () => { closeModal(); startChallenge(S, fr, ven); };
    });
  }
  function startChallenge(S, fr, ven) {
    const p = GI.prefs.get();
    const data = SH.teamData(fr.team);
    const oppIdx = data.idx === S.user ? (data.idx + 16) % 32 : data.idx;
    const userData = Object.assign({}, S.rosters[S.user], { stars: S.rosters[S.user].stars.map((c) => Object.assign({}, c)) });
    const myVenue = Object.assign({}, GI.venueOf(S.user, S), { idx: S.user });
    const theirVenue = Object.assign({}, GI.NEUTRAL_VENUE, data.venue, { idx: oppIdx, neutral: false });
    const o = {
      user: S.user, opp: oppIdx, oppIdx, userHome: ven !== 'away', userData, oppData: data,
      venue: ven === 'neutral' ? Object.assign({}, GI.NEUTRAL_VENUE) : ven === 'away' ? theirVenue : myVenue, neutral: ven === 'neutral',
      qMin: p.qMin || 5, diff: p.diff || 'pro', weather: 'auto', when: 0.5,
      label: `Friend Challenge vs ${fr.coach || 'a friend'}`, friend: fr.id,
      rivalry: (fr.heat || 0) >= 30 ? { hot: true, heat: {} } : null,
      potw: { off: p.potwOff || 'slants', def: p.potwDef || 'cover3' },
    };
    U.startPregame(o, false);
  }
  // after the final whistle: record it, then hand over the result code
  async function friendFinal(G) {
    const host = $('#friendFinal'); if (!host) return;
    const u = G.user, o = u === 'home' ? 'away' : 'home';
    if (!G.friendRec) {
      const top = (() => { let best = null, bv = 0; Object.values(G.ps || {}).forEach((p) => { if (p.side !== u) return; const v = (p.pyd || 0) / 25 + (p.ptd || 0) * 4 + (p.ryd || 0) / 10 + (p.rtd || 0) * 6 + (p.recyd || 0) / 10 + (p.rectd || 0) * 6 + (p.sk || 0) * 4 + (p.dint || 0) * 5; if (v > bv) { bv = v; best = p; } }); return best ? `${GI.POS[best.pos].label} ${GI.shortName(best.name)}` : null; })();
      const rec = SH.recordGame({ rid: 'm' + Date.now().toString(36), opp: G.friend, us: G.score[u], them: G.score[o], ot: !!G.ot, at: Date.now(), star: top && G.score[u] > G.score[o] ? `Your ${top}` : null });
      G.friendRec = { story: rec.story || '', code: await SH.resultCode(G, G.friend) };
      const fr = SH.friends().list.find((x) => x.id === G.friend);
      if (fr && G.score[u] > G.score[o] && fr.w === 1) GI.share.addCard({ kind: 'rivalry', tag: 'Friends League', title: `First win over ${fr.coach || 'a friend'}`, value: `${G.score[u]}-${G.score[o]}`, player: `${G.teams[u].city} ${G.teams[u].name}`, team: G.teams[u].abbr, c1: G.teams[u].c1, c2: G.teams[u].c2, sub: `Beat ${fr.coach}'s ${G.teams[o].name}. Bragging rights secured.` });
    }
    host.innerHTML = `<div class="sticker panel"><span class="label">Friends League</span><p class="fstory big">${esc(G.friendRec.story)}</p>
      <button class="btn gold block" id="fResult" style="margin-top:12px">Send them the result code</button><p class="muted tiny" style="margin:8px 0 0">They paste it in Friends and it lands in their record and their Gazette.</p></div>`;
    $('#fResult').onclick = () => sendCode(G.friendRec.code, `Final: ${G.teams[u].name} ${G.score[u]}, your ${G.teams[o].name} ${G.score[o]}${G.ot ? ' (OT)' : ''}. Paste this in Grid Iron → Friends.`, 'Grid Iron result');
    shareToasts();
  }

  // ================= SHARE CARDS =================
  function cardThumb(c) {
    const col = { record: 'var(--gold)', achievement: 'var(--green)', title: 'var(--gold)', star: '#b78cff', rivalry: 'var(--red)' }[c.kind] || 'var(--gold)';
    return `<button class="scard2" data-sc="${esc(c.id)}" style="--c1:${c.c1 || '#1d3557'};--k:${col}"><span class="sc-tag">${esc(c.tag || '')}</span>${c.value != null ? `<b class="sc-val">${esc(String(c.value))}</b>` : ''}<span class="sc-title">${esc(c.title || '')}</span><span class="sc-who">${esc(c.player || '')}</span><small>${esc(c.team || '')}${c.year ? ' · Year ' + c.year : ''}</small></button>`;
  }
  function cardsHTML() {
    const all = SH.cards();
    return `<div class="sticker panel"><h3>Share Cards</h3><p class="muted" style="margin:0;font-size:13px">Records, milestones, Star Players, titles and rivalry wins become cards you can post. Longest pass, longest run, 1,000-yard seasons and every league record your players break land here.</p></div>
      ${all.length ? `<div class="scgrid">${all.map(cardThumb).join('')}</div>` : '<p class="muted" style="text-align:center">Nothing yet. Break a record or win something.</p>'}`;
  }
  function bindCards(root) { (root || document).querySelectorAll('[data-sc]').forEach((b) => (b.onclick = () => openCard(b.dataset.sc))); }
  async function openCard(id) {
    const c = SH.cards().find((x) => x.id === id); if (!c) return;
    modal(`<div class="row between"><h2>Share Card</h2>${closeBtn}</div><canvas id="scCanvas" class="sccanvas"></canvas>
      <div class="row" style="gap:8px;margin-top:10px"><button class="btn gold" style="flex:1" id="scShare">Share</button><button class="btn ghost" style="flex:1" id="scSave">Save image</button></div>`, (m) => {
      m.querySelector('#mx').onclick = closeModal;
      SH.drawCard(c, m.querySelector('#scCanvas'));
      const file = async () => new File([await SH.cardBlob(c)], `grid-iron-${(c.title || 'card').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`, { type: 'image/png' });
      m.querySelector('#scSave').onclick = async () => { const f = await file(); const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
      m.querySelector('#scShare').onclick = async () => {
        const f = await file();
        try {
          if (navigator.canShare && navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: c.title, text: `${c.player}: ${c.title}${c.value != null ? ' (' + c.value + ')' : ''} #GridIron` });
          else m.querySelector('#scSave').click();
        } catch (e) { if (e && e.name !== 'AbortError') m.querySelector('#scSave').click(); }
      };
    });
  }
  // new cards earned since the last check get a toast you can tap
  function shareToasts() {
    const fresh = SH.takeFresh();
    if (!fresh.length) return;
    const host = document.body;
    const el = document.createElement('button');
    el.className = 'scnew';
    el.innerHTML = `<span>${GI.ico('star')} New share card${fresh.length > 1 ? 's' : ''}</span><b>${esc(fresh[0].title)}${fresh.length > 1 ? ` +${fresh.length - 1}` : ''}</b>`;
    el.onclick = () => { el.remove(); openCard(fresh[0].id); };
    host.appendChild(el);
    sfx('card');
    setTimeout(() => el.remove(), 7000);
  }

  // codes that arrive in a link (#t=… or #r=…)
  async function fromLink() {
    const h = location.hash;
    if (!/^#(t|r)=/.test(h)) return;
    history.replaceState(null, '', location.pathname + location.search);
    show('friends');
    await renderFriends();
    await addCode(h);
  }
  setTimeout(fromLink, 300);

  Object.assign(U, { openFriends, renderFriends, friendFinal, cardsHTML, bindCards, openCard, shareToasts });
})();
