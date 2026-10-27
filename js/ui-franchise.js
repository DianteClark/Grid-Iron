/* Grid Iron — franchise screens: hub, draft room, roster, front office (staff, free agency), trades, tables,
   awards night, the owner's box, records & Hall of Fame, the highlight reel */
(function () {
  const GI = window.GI;
  const U = GI.UI;
  const { $, $$, esc, show, toast, modal, closeModal, closeBtn, confirmBox, helmet, sfx, ord, T } = U;
  const SN = GI.season, L = GI.league;
  const money = (x) => SN.money(x);
  let S = null;
  const sync = () => (S = U.getS() || SN.load());
  const traitChips = (s) => (s.traits || []).map((k) => GI.TRAITS[k] ? `<span class="trait" title="${GI.TRAITS[k].desc}">${GI.TRAITS[k].icon} ${GI.TRAITS[k].name}</span>` : '').join('');

  // ================= HUB =================
  function lastMeeting(opp) {
    let last = null;
    (S.schedule || []).forEach((wk) => wk.forEach((g) => { if (g.done && ((g.h === S.user && g.a === opp) || (g.a === S.user && g.h === opp))) last = g; }));
    if (!last) return '';
    const us = last.h === S.user ? last.hs : last.as, them = last.h === S.user ? last.as : last.hs;
    return `<div class="lastmeet">Last meeting: <b class="${us > them ? 'w' : us < them ? 'l' : ''}">${us > them ? 'W' : us < them ? 'L' : 'T'} ${us}-${them}</b></div>`;
  }
  function venueLine() {
    const f = SN.forecast(S); if (!f) return '';
    const v = f.v;
    const fc = f.list.slice(0, 3).map((x) => `${GI.WEATHER[x.k].icon} ${x.p}%`).join(' · ');
    return `<div class="venueline"><span>📍 <b>${esc(v.name)}</b></span><span>${GI.ROOFS[v.roof].icon} ${v.roof === 'open' ? GI.SURFACES[v.surface].name : GI.ROOFS[v.roof].name + ' · ' + GI.SURFACES[v.surface].name}</span><span>${f.storm ? 'Forecast: ' : ''}${fc}</span></div>`;
  }
  function renderHub() {
    sync(); U.setS(S);
    if (!S) return;
    const ut = T(S.user), r = S.rec[S.user];
    const place = SN.place(S, S.user);
    const gp = r.w + r.l + r.t;
    const streak = r.streak > 0 ? `W${r.streak}` : r.streak < 0 ? `L${-r.streak}` : '';
    const ovr = SN.teamOvr(S, S.user);
    let next = '';
    if (S.phase === 'draft') {
      const cur = SN.draftCur(S);
      next = `<div class="sticker nextgame phase">
        <div class="row between"><span class="pill gold">Year ${S.year} · ${S.draft.opening ? 'Opening Draft' : 'Draft'}</span><span class="label">${S.draft.rounds} rounds</span></div>
        <h3>${S.draft.opening ? 'Build your franchise from scratch' : 'Restock the roster'}</h3>
        <p class="muted">${S.draft.opening ? 'Every team starts empty. Rounds 1–3 must land your K/P, QB and LB, in any order. Round 4 is wide open.' : 'Worst records pick first (the bottom six draw a lottery for the top 3). Fill open star slots or grab a backup.'}</p>
        ${cur ? `<p class="muted" style="margin:4px 0 0">On the clock: <b>Round ${cur.round}, pick ${cur.inRound}</b> — ${T(cur.team).city}</p>` : ''}
        <button class="btn green block" id="hubDraft" style="margin-top:12px">Enter the Draft Room ▶</button></div>`;
    } else if (S.phase === 'camp') {
      next = `<div class="sticker nextgame phase">
        <div class="row between"><span class="pill gold">Year ${S.year} · Spring Training</span><span class="label">Gym Lv ${S.up.gym}</span></div>
        <h3>Pick a camp focus</h3>
        <p class="muted">Every star grows (or ages). Young stars can hit a ⚡ <b>breakthrough</b> and jump +8 to +15. 🎓 Mentors and 🏋️ gym rats grow faster.</p>
        <div class="focusgrid">${Object.keys(SN.FOCUS).map((k) => `<button class="focus ${campFocus === k ? 'on' : ''}" data-focus="${k}"><b>${SN.FOCUS[k].name}</b><small>${SN.FOCUS[k].desc}</small></button>`).join('')}</div>
        <label class="intense"><input type="checkbox" id="campIntense" ${campIntense ? 'checked' : ''}> <span><b>Intense camp</b> (${money(3)}) — double gains, better breakthrough odds, small injury risk</span></label>
        ${identityHTML()}
        <button class="btn green block" id="hubCamp" style="margin-top:12px">Run Spring Training ▶</button></div>`;
    } else if (S.phase === 'offseason') {
      const champ = S.champion != null ? T(S.champion) : null;
      const exp = (S.expiring || []).length;
      const awardsNew = S.awards[S.year] && S.awardsSeen !== S.year;
      next = `${champ ? `<div class="sticker champ ${S.champion === S.user ? 'mine' : ''}"><div class="trophy">🏆</div>${helmet(champ, 'lg')}
        <h2>${S.champion === S.user ? 'IRON-BOWL CHAMPIONS!' : champ.city + ' ' + champ.name}</h2><p class="muted">${S.champion === S.user ? `Year ${S.year} belongs to ${ut.city}. The ${money(15)} purse is in the bank.` : `won the Year ${S.year} Iron-Bowl.`}</p>
        ${S.champion === S.user && S.reel && S.reel.length ? '<button class="btn gold small" id="hubReel" style="margin-top:8px">▶ Season highlight reel</button>' : ''}</div>` : ''}
        ${awardsNew ? `<button class="sticker awardsbtn" id="hubAwards"><span>🏆</span><b>Awards Night</b><small>MVP, Rookie of the Year, the All-Iron team…</small><span class="go">▶</span></button>` : ''}
        <div class="sticker nextgame phase"><div class="row between"><span class="pill gold">Offseason</span><span class="label">Cap room ${money(L.capRoom(S, S.user))}</span></div>
        <h3>Front office time</h3>
        <p class="muted">${exp ? `<b>${exp} contract${exp > 1 ? 's' : ''} expiring.</b> Re-sign or they walk. ` : ''}${S.faDone ? '' : `<b>Free agency is open</b> — ${(S.freeAgents || []).length} players looking for a team. `}Hire coaches, make trades, upgrade facilities, then head to the Year ${S.year + 1} draft (${Math.min(8, 4 + S.year)} rounds).</p>
        <div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn gold small" style="flex:1" id="hubOffice">Front Office</button><button class="btn ghost small" style="flex:1" id="hubFA">${S.faDone ? 'FA results' : 'Free Agency'}</button><button class="btn ghost small" style="flex:1" id="hubTrade">Trades</button></div>
        ${identityHTML()}
        <button class="btn green block" id="hubAdvance" style="margin-top:12px">To the Draft ▶</button></div>`;
    } else {
      const c = SN.current(S);
      if (c.game) {
        const op = T(c.opp), orc = SN.recStr(S.rec[c.opp]);
        const seedTxt = S.bracket ? ` · #${S.bracket.seedOf[S.user]} vs #${S.bracket.seedOf[c.opp]}` : '';
        const hot = L.heat(S, S.user, c.opp) + L.heat(S, c.opp, S.user) >= (L.isDiv(S.user, c.opp) ? 28 : 50);
        next = `<div class="sticker nextgame">
          <div class="row between"><span class="pill ${c.playoff ? 'red' : 'gold'}">${c.label}${seedTxt}</span><span class="label">${hot ? '🔥 Rivalry · ' : ''}${c.ironBowl ? 'Neutral site' : c.home ? 'Home' : 'Away'}</span></div>
          <div class="ng-mid">${helmet(ut, 'md')}<span class="ng-vs">${c.home || c.ironBowl ? 'VS' : 'AT'}</span>${helmet(op, 'md')}</div>
          <div class="ng-opp"><b>${op.city} ${op.name}</b><span class="muted">${orc} · ${SN.teamOvr(S, c.opp)} OVR · ${S.rosters[c.opp].stars.length} stars</span></div>
          ${lastMeeting(c.opp)}${venueLine()}
          ${modsHTML()}
          <div class="row" style="gap:10px;margin-top:12px"><button class="btn green" style="flex:2" id="hubPlay">Play ▶</button><button class="btn ghost" style="flex:1" id="hubSim">Sim</button></div>
        </div>`;
      } else {
        const bye = S.bracket && S.bracket.round === 0 && S.bracket.seedOf[S.user] <= 2;
        next = `<div class="sticker nextgame"><span class="pill red">${c.label}</span>
          <h3 style="margin:10px 0 4px">${bye ? 'First-round bye! 😎' : S.bracket && S.bracket.seedOf[S.user] ? 'Eliminated' : 'Missed the playoffs'}</h3>
          <p class="muted" style="margin:0 0 12px">${bye ? 'Rest up while the Wild Card games play out.' : 'Watch the rest of the bracket unfold.'}</p>
          <button class="btn gold block" id="hubSimRound">Sim ${c.label} ▶</button></div>`;
      }
    }
    const div = SN.sorted(S, SN.division(S.user));
    const hype = Math.round(S.hype || 40);
    $('#hubBody').innerHTML = `
      <div class="topbar" style="margin-bottom:0"><button class="iconbtn" id="hubBack" aria-label="Main menu">←</button><h2>Year ${S.year}</h2><span class="cashpill">💰 ${money(S.cash)}</span><button class="iconbtn" id="hubSet" aria-label="Settings">⚙</button></div>
      <div class="sticker hubteam" style="--tc:${ut.c1}">
        ${helmet(ut, 'lg')}
        <div class="ht-info"><span class="label">${ut.city}</span><h2>${ut.name}</h2>
          <div class="row" style="gap:6px;flex-wrap:wrap"><span class="pill">${SN.divName(S.user)}${gp ? ' · ' + ord(place) : ''}</span><span class="pill">${ovr} OVR</span>${streak ? `<span class="pill">${streak}</span>` : ''}${S.morale[S.user] ? `<span class="pill ${S.morale[S.user] > 0 ? 'green' : 'red'}">Morale ${S.morale[S.user] > 0 ? '+' : ''}${S.morale[S.user]}</span>` : ''}${S.rosters[S.user].identity ? `<span class="pill">${GI.IDENTITIES[S.rosters[S.user].identity].icon} ${GI.IDENTITIES[S.rosters[S.user].identity].name}</span>` : ''}</div>
          ${gp ? (() => { const sp = SN.splits(S, S.user); return `<div class="splits">🏠 ${sp.home.w}-${sp.home.l} · ✈️ ${sp.away.w}-${sp.away.l}</div>`; })() : ''}
          <div class="hype"><span>📣 Fan hype</span><div><i style="width:${hype}%"></i></div><b>${hype}</b></div></div>
        <div class="ht-rec">${SN.recStr(r)}</div>
      </div>
      ${next}
      ${goalsHTML()}
      <div class="hubgrid">
        <button class="sticker hbtn" data-go="roster"><span>⭐</span>Roster</button>
        <button class="sticker hbtn" data-go="office"><span>🏢</span>Front Office</button>
        <button class="sticker hbtn" data-go="gazette"><span>📰</span>Gazette</button>
        <button class="sticker hbtn" data-go="standings"><span>📊</span>Standings</button>
        <button class="sticker hbtn" data-go="playoffs"><span>🏟️</span>Playoffs</button>
        <button class="sticker hbtn" data-go="schedule"><span>🗓️</span>Schedule</button>
        <button class="sticker hbtn ${L.tradeOpen(S) ? '' : 'dim'}" data-go="trade"><span>🔁</span>Trades</button>
        <button class="sticker hbtn" data-go="records"><span>🏛️</span>Records</button>
        <button class="sticker hbtn" data-go="reel"><span>🎬</span>Highlights</button>
      </div>
      <div class="sticker panel"><div class="row between"><h3>${SN.divName(S.user)}</h3><span class="label">W-L · PF-PA</span></div>
        ${div.map((i) => rowTeam(i)).join('')}</div>`;
    $('#hubBack').onclick = () => { U.refreshTitle(); show('title'); };
    $('#hubSet').onclick = () => U.showSettings();
    const on = (id, fn) => { const b = $('#' + id); if (b) b.onclick = fn; };
    on('hubPlay', () => startSeasonGame());
    on('hubSim', () => simWeek(true));
    on('hubSimRound', () => simWeek(false));
    on('hubDraft', () => { renderDraft(); show('draft'); });
    on('hubOffice', () => { officeTab = (S.expiring || []).length ? 'contracts' : 'staff'; renderOffice(); show('office'); });
    on('hubFA', () => { officeTab = 'fa'; renderOffice(); show('office'); });
    on('hubTrade', () => openTrade());
    on('hubReel', () => openReel());
    on('hubAwards', () => awardsNight());
    on('hubAdvance', () => {
      const exp = (S.expiring || []).length;
      const go = () => { SN.advanceToDraft(S); sfx('horn'); renderHub(); show('hub'); };
      if (exp) modal(`<h2>Let ${exp} star${exp > 1 ? 's' : ''} walk?</h2><p class="muted">Unsigned expiring contracts hit free agency. Other teams can sign or draft them — and they'll remember.</p><div style="display:grid;gap:10px"><button class="btn red block" id="ad1">Let them walk</button><button class="btn ghost block" id="ad2">Back to contracts</button></div>`, (s) => {
        s.querySelector('#ad1').onclick = () => { closeModal(); go(); };
        s.querySelector('#ad2').onclick = () => { closeModal(); officeTab = 'contracts'; renderOffice(); show('office'); };
      });
      else if (!S.faDone && Object.keys(S.faOffers || {}).length) confirmBox('Sign your free agents first?', 'You have offers out. Free agency runs automatically when you head to the draft — your offers will still count.', 'Head to the draft', 'Back', go);
      else go();
    });
    on('hubCamp', () => {
      const intense = $('#campIntense').checked;
      if (intense && S.cash < 3) { toast('Not enough cash for an intense camp'); return; }
      const paper = SN.runCamp(S, campFocus, intense);
      sfx('horn');
      U.showPaper(paper, true);
    });
    $$('#hubBody [data-focus]').forEach((b) => (b.onclick = () => { campFocus = b.dataset.focus; campIntense = $('#campIntense').checked; renderHub(); }));
    $$('#hubBody [data-ident]').forEach((b) => (b.onclick = () => {
      const k = b.dataset.ident;
      S.rosters[S.user].identity = S.rosters[S.user].identity === k ? null : k;
      SN.save(S); sfx('select'); renderHub();
    }));
    $$('#hubBody [data-go]').forEach((b) => (b.onclick = () => {
      const g = b.dataset.go;
      if (g === 'gazette') return U.showArchive();
      if (g === 'roster') { renderRoster(); show('roster'); return; }
      if (g === 'office') { renderOffice(); show('office'); return; }
      if (g === 'trade') return openTrade();
      if (g === 'records') return openRecords();
      if (g === 'reel') return openReel();
      renderTables(g); show('tables');
    }));
    // offseason: awards night, then the owner's box (and maybe the pink slip)
    if (S.phase === 'offseason' && S.awardsSeen === S.year && S.review && S.reviewSeen !== S.year) setTimeout(ownersBox, 250);
    else if (S.fired) setTimeout(firedFlow, 250);
  }
  let campFocus = 'offense', campIntense = false;
  function identityHTML() {
    const cur = S.rosters[S.user].identity;
    const stars = S.rosters[S.user].stars;
    return `<div class="identity"><div class="row between" style="margin-top:14px"><span class="label">Playbook identity</span><span class="label">${cur ? 'Locked in for the season' : 'Optional'}</span></div>
      <div class="identgrid">${Object.keys(GI.IDENTITIES).map((k) => { const id = GI.IDENTITIES[k]; const fit = stars.filter((s) => id.fit.includes(s.pos)).length; const grumpy = stars.filter((s) => s.ego > 65 && !id.fit.includes(s.pos) && s.pos !== 'KP').length;
        return `<button class="ident ${cur === k ? 'on' : ''}" data-ident="${k}"><b>${id.icon} ${id.name}</b><small>${id.desc}</small><em>${fit} star${fit === 1 ? '' : 's'} fit${grumpy ? ` · 😒 ${grumpy} unhappy` : ''}</em></button>`; }).join('')}</div></div>`;
  }
  function goalsHTML() {
    if (!(S.goals || []).length || !['regular', 'playoffs'].includes(S.phase)) return '';
    const p = S.owner.patience;
    return `<div class="sticker panel goals"><div class="row between"><h3>🎯 Owner's goals</h3><span class="label">${esc(S.owner.name)}</span></div>
      <div class="patience"><span>Owner patience</span><div><i style="width:${p}%;background:${p >= 60 ? 'var(--green)' : p >= 35 ? 'var(--gold)' : 'var(--red)'}"></i></div><b>${p}</b></div>
      ${S.goals.map((g) => { const pr = L.goalProgress(S, g); const pct = Math.min(100, Math.round((pr.v / Math.max(1, pr.target)) * 100)); return `<div class="goal ${pr.done ? 'done' : ''}"><span>${pr.done ? '✅' : '🎯'}</span><div><b>${g.text}</b><div class="gbar"><i style="width:${pct}%"></i></div></div><small>${g.id === 'star' || g.id === 'wins' || g.id === 'hype' ? `${Math.round(pr.v).toLocaleString()}/${pr.target.toLocaleString()}` : pr.done ? 'Done' : ''}<br>+${money(g.reward)}</small></div>`; }).join('')}</div>`;
  }
  function rowTeam(i, extra) {
    const t = T(i), r = S.rec[i];
    return `<div class="trow ${i === S.user ? 'me' : ''}">${helmet(t, 'xs')}<span class="tn2">${t.city} <b>${t.name}</b></span><span class="tr-rec">${SN.recStr(r)}</span><span class="tr-pf">${extra != null ? extra : `${r.pf}-${r.pa}`}</span></div>`;
  }
  function modsHTML() {
    sync();
    const m = S.mods || {}, chips = [];
    if (m.morale) chips.push(`<span class="pill ${m.morale > 0 ? 'green' : 'red'}">Morale ${m.morale > 0 ? '+' : ''}${m.morale}</span>`);
    if (m.intel) chips.push('<span class="pill green">📂 Their POTW leaked</span>');
    if (m.film) chips.push('<span class="pill red">🎞️ They studied your POTW</span>');
    if (m.weather) chips.push(`<span class="pill blue">${GI.WEATHER[m.weather].icon} ${GI.WEATHER[m.weather].name}</span>`);
    if (m.crowdLevel) chips.push('<span class="pill gold">📣 Sold out</span>');
    if (S.guarantee) chips.push('<span class="pill gold">🗣️ You guaranteed a win</span>');
    if (m.starMeter) Object.keys(m.starMeter).forEach((id) => { const s = SN.allStars(S, S.user).find((x) => x.id === id); if (s) chips.push(`<span class="pill">${GI.shortName(s.name)} starts ${m.starMeter[id]}%</span>`); });
    SN.injuredFor(S, S.user).forEach(({ s, weeks, holdout }) => chips.push(`<span class="pill red">${holdout ? '💸 Holdout' : '🚑'} ${GI.POS[s.pos].label} ${GI.shortName(s.name)} (${weeks}w)</span>`));
    const b = S.rosters[S.user].bench;
    if (b) chips.push(`<span class="pill">🪑 Backup: ${GI.POS[b.pos].label} ${GI.shortName(b.name)}</span>`);
    return chips.length ? `<div class="modchips">${chips.join('')}</div>` : '';
  }
  function startSeasonGame() {
    const o = SN.gameOptions(S);
    const p = GI.prefs.get();
    o.potw = { off: p.potwOff || 'short', def: p.potwDef || 'zone' };
    U.startPregame(o, true);
  }
  function simWeek(mine) {
    $$('#hubBody .btn').forEach((b) => (b.disabled = true));
    toast(mine ? 'Simulating your game…' : 'Simulating the round…', 900);
    setTimeout(() => { const paper = SN.finishWeek(S, null); U.showPaper(paper, true); }, 60);
  }

  // ================= AWARDS NIGHT & THE OWNER'S BOX =================
  function awardsNight() {
    const A = S.awards[S.year];
    if (!A) return;
    const cards = [['mvp', '🏆', 'Most Valuable Player'], ['opoy', '⚡', 'Offensive Player of the Year'], ['dpoy', '🛡️', 'Defensive Player of the Year'], ['roy', '🌟', 'Rookie of the Year'], ['coy', '📋', 'Coach of the Year']].filter(([k]) => A[k]);
    let i = 0;
    $('#modal').dataset.lock = '1';
    const draw = (s) => {
      if (i >= cards.length) {
        s.innerHTML = `<h2>🏆 The All-Iron Team</h2><div class="allIron">${A.allIron.map((x) => `<div class="ai ${x.team === S.user ? 'mine' : ''}"><span class="pp-pos">${GI.POS[x.pos].label}</span>${helmet(T(x.team), 'xs')}<b>${esc(x.name)}</b><small>${x.line}</small></div>`).join('')}</div><button class="btn gold block" id="awDone" style="margin-top:12px">Close the show ▶</button>`;
        s.querySelector('#awDone').onclick = () => { S.awardsSeen = S.year; SN.save(S); closeModal(); renderHub(); };
        return;
      }
      const [k, ic, title] = cards[i], x = A[k];
      const mine = x.team === S.user;
      s.innerHTML = `<div class="award ${mine ? 'mine' : ''}"><div class="aw-ic">${ic}</div><span class="label">Year ${S.year} · ${title}</span>
        <div class="aw-env" id="awEnv"><span>Tap to open the envelope</span></div>
        <div class="aw-win" hidden>${helmet(T(x.team), 'lg')}<h2>${esc(x.name)}</h2><p class="muted">${k === 'coy' ? `${T(x.team).city} ${T(x.team).name} · ${x.line}` : `${GI.POS[x.pos].full} · ${T(x.team).city} ${T(x.team).name}`}</p>${k !== 'coy' ? `<p class="aw-line">${x.line}</p>` : ''}${mine ? '<p class="pill gold">YOUR GUY! +hype, +Legacy</p>' : ''}</div>
        <button class="btn gold block" id="awNext" hidden>${i + 1 < cards.length ? 'Next award ▶' : 'The All-Iron team ▶'}</button></div>`;
      s.querySelector('#awEnv').onclick = () => {
        s.querySelector('#awEnv').hidden = true; s.querySelector('.aw-win').hidden = false; s.querySelector('#awNext').hidden = false;
        sfx(mine ? 'td' : 'star'); if (mine) GI.audio.buzz([40, 30, 60]);
      };
      s.querySelector('#awNext').onclick = () => { i++; draw(s); };
    };
    modal('', draw);
  }
  function ownersBox() {
    const rv = S.review;
    if (!rv) return;
    $('#modal').dataset.lock = '1';
    const p = S.owner.patience;
    modal(`<h2>🎩 The Owner's Box</h2><p class="muted" style="margin-top:-4px">${esc(S.owner.name)} ${rv.verdict}.</p>
      <div class="patience big"><span>Patience</span><div><i style="width:${p}%;background:${p >= 60 ? 'var(--green)' : p >= 35 ? 'var(--gold)' : 'var(--red)'}"></i></div><b>${p} <small>(${rv.delta >= 0 ? '+' : ''}${rv.delta})</small></b></div>
      ${rv.res.map((x) => `<div class="goal ${x.done ? 'done' : ''}"><span>${x.done ? '✅' : '❌'}</span><div><b>${x.g.text}</b></div><small>${x.done ? '+' + money(x.g.reward) : ''}</small></div>`).join('')}
      ${rv.bonus ? `<p class="pill green" style="margin-top:10px">+${money(rv.bonus)} in bonuses</p>` : ''}
      <button class="btn gold block" id="obOk" style="margin-top:14px">${rv.fired ? '…uh oh ▶' : 'Back to work ▶'}</button>`, (s) => {
      s.querySelector('#obOk').onclick = () => { S.reviewSeen = S.year; SN.save(S); closeModal(); if (S.fired) firedFlow(); else renderHub(); };
    });
  }
  function firedFlow() {
    if (!S.fired) return;
    $('#modal').dataset.lock = '1';
    sfx('bad');
    modal(`<div class="fired"><div class="pink">PINK SLIP</div><h2>You're fired.</h2><p class="muted">${esc(S.owner.name)} has seen enough. But three struggling franchises want you to rebuild them:</p>
      <div class="offers">${S.fired.offers.map((i) => `<button class="offer" data-job="${i}">${helmet(T(i), 'md')}<span><b>${T(i).city} ${T(i).name}</b><small>${SN.recStr(S.rec[i])} last year · ${SN.teamOvr(S, i)} OVR · ${S.rosters[i].stars.length} stars</small></span></button>`).join('')}</div>
      <p class="muted" style="font-size:12.5px">Your Legacy, trophies and album come with you.</p></div>`, (s) => {
      s.querySelectorAll('[data-job]').forEach((b) => (b.onclick = () => { L.takeJob(S, +b.dataset.job); closeModal(); sfx('horn'); toast(`New job: ${T(S.user).city} ${T(S.user).name}`, 2400); renderHub(); }));
    });
  }

  // ================= DRAFT ROOM =================
  let draftPos = 'ALL', draftTicker = [], draftView = 'avail', liveTimer = null;
  function renderDraft(instant) {
    sync();
    if (!S.draft) { renderHub(); show('hub'); return; }
    clearTimeout(liveTimer);
    const d = S.draft;
    let cur = SN.draftCur(S);
    // CPU teams pick live, one at a time, so you can watch the board shrink
    if (cur && cur.team !== S.user) {
      const made = SN.draftAdvance(S, instant ? 999 : 1);
      if (made.length) draftTicker = made.slice().reverse().concat(draftTicker).slice(0, 60);
      cur = SN.draftCur(S);
      if (cur && cur.team !== S.user && !instant) liveTimer = setTimeout(() => { if ($('#draft').classList.contains('on')) renderDraft(); }, 110);
    }
    const r = S.rosters[S.user];
    const must = SN.mustTake(S);
    const done = SN.draftDone(S);
    const slotsHTML = [...Array(8)].map((_, k) => { const s = r.stars[k]; return s ? `<span class="slot full" title="${s.name}">${GI.POS[s.pos].label}</span>` : '<span class="slot"></span>'; }).join('') + `<span class="slot bench ${r.bench ? 'full' : ''}">${r.bench ? GI.POS[r.bench.pos].label : '🪑'}</span>`;
    const tabs = ['ALL', 'KP', 'QB', 'RB', 'WR', 'TE', 'OL', 'LB', 'DL', 'S', 'CB'];
    let list = d.pool.slice();
    if (draftPos !== 'ALL') list = list.filter((p) => p.pos === draftPos);
    list.sort((a, b) => (b.careerPlayer ? 1 : 0) - (a.careerPlayer ? 1 : 0) || (b.claimed ? 1 : 0) - (a.claimed ? 1 : 0) || (b.est[0] + b.est[1]) - (a.est[0] + a.est[1]));
    list = list.slice(0, 60);
    const taken = d.log.slice().reverse().filter((x) => draftPos === 'ALL' || x.p.pos === draftPos).slice(0, 80);
    const yourTurn = cur && cur.team === S.user;
    const home = GI.homeCollege(S.user);
    const myPicks = d.picks.filter((p, k) => p.team === S.user && k >= d.cur).length;
    $('#draftBody').innerHTML = `
      <div class="topbar" style="margin-bottom:0"><button class="iconbtn" id="drBack" aria-label="Back">←</button><h2>${d.opening ? 'Opening Draft' : 'Year ' + S.year + ' Draft'}</h2><span class="cashpill">💰 ${money(S.cash)}</span></div>
      <div class="sticker clock ${yourTurn ? 'mine' : ''}">
        ${done ? '<h3>The draft is complete!</h3>' : `${helmet(T(cur.team), 'sm')}<div style="flex:1;min-width:0"><span class="label">Round ${cur.round} · Pick ${cur.inRound} · #${(cur.round - 1) * 32 + cur.inRound} overall${cur.orig !== cur.team ? ` · via ${T(cur.orig).abbr}` : ''}</span><h3>${yourTurn ? "You're on the clock!" : T(cur.team).city + ' picking…'}</h3></div>${!yourTurn ? '<button class="btn ghost small" id="drSkip">⏩</button>' : ''}`}
      </div>
      <div class="sticker panel"><div class="row between"><span class="label">Your star slots</span><span class="label">${r.stars.length}/8 + backup · ${myPicks} pick${myPicks === 1 ? '' : 's'} left · cap room ${money(L.capRoom(S, S.user))}</span></div><div class="slots">${slotsHTML}</div>
        ${must ? `<p class="mustnote">Rounds 1–3: you still need a <b>${must.map((x) => GI.POS[x].full).join(', ')}</b>.</p>` : ''}</div>
      ${done ? `<button class="btn green block" id="drFinish">Read the Draft Gazette ▶</button>` : `
      <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn gold small" id="drAuto1" ${yourTurn ? '' : 'disabled'}>🎯 Auto-pick</button><button class="btn ghost small" id="drAutoAll">⏩ Auto-draft the rest</button><button class="btn ghost small" id="drPass" ${yourTurn && !must ? '' : 'disabled'}>Pass</button></div>
      <div class="seg" id="drView"><button data-v="avail" class="${draftView === 'avail' ? 'on' : ''}">Available (${d.pool.length})</button><button data-v="taken" class="${draftView === 'taken' ? 'on' : ''}">Taken (${d.log.length})</button></div>
      <div class="postabs">${tabs.map((t) => `<button class="${draftPos === t ? 'on' : ''}" data-pos="${t}">${t === 'ALL' ? 'All' : GI.POS[t].label}</button>`).join('')}</div>
      ${draftView === 'avail' ? `<div class="plist">${list.map((p) => {
        const chk = SN.canDraft(S, S.user, p);
        return `<button class="prow ${chk.ok ? '' : 'no'} ${p.careerPlayer ? 'career' : ''}" data-pid="${p.id}">
          <span class="pp-pos">${GI.POS[p.pos].label}</span>
          <span class="pr-main"><b>${esc(p.name)}${p.careerPlayer ? ' <i class="tag career">🎮 Your career player</i>' : ''}${p.claimed ? ' <i class="tag">★ Scouted</i>' : ''}${p.sparkShown ? ' <i class="tag spark">⚡</i>' : ''}${p.college === home && p.rookie ? ' <i class="tag home">🏠 Hometown</i>' : ''}</b><small>${p.rookie ? 'Rookie' : 'Veteran'} · age ${p.age} · ${p.rookie ? p.college : (p.yrsPro || 0) + ' yrs pro'}${(p.traits || []).length ? ' · ' + p.traits.map((k) => GI.TRAITS[k].icon).join('') : ''}</small></span>
          <span class="pr-est"><b>${p.est[0]}–${p.est[1]}</b><small>Pot ${p.gradeShown} · ${money(p.salary)}</small></span>
        </button>`;
      }).join('') || '<p class="muted">Nobody left at this position.</p>'}</div>`
      : `<ul class="takenlist">${taken.map((x) => `<li class="${x.team === S.user ? 'mine' : ''}">${helmet(T(x.team), 'xs')}<span class="tk-n">R${x.round}.${x.inRound}</span><span class="tk-p"><b>${GI.POS[x.p.pos].label} ${esc(x.p.name)}</b><small>${T(x.team).abbr}${x.team === S.user ? ` · true ${x.p.rating}` : ` · est ${x.p.est[0]}–${x.p.est[1]}`}${x.slot === 'bench' ? ' · backup' : ''}</small></span></li>`).join('') || '<li class="muted">Nobody yet.</li>'}</ul>`}`}
      ${draftTicker.length && draftView === 'avail' ? `<div class="sticker panel"><div class="label">Recent picks</div><ul class="ticklist">${draftTicker.slice(0, 8).map((x) => `<li>${helmet(T(x.team), 'xs')}<span>R${x.round}.${x.inRound} ${T(x.team).abbr} — ${GI.POS[x.p.pos].label} ${esc(x.p.name)} <i class="muted">(${x.p.est[0]}–${x.p.est[1]})</i></span></li>`).join('')}</ul></div>` : ''}`;
    $('#drBack').onclick = () => { clearTimeout(liveTimer); renderHub(); show('hub'); };
    const sk = $('#drSkip'); if (sk) sk.onclick = () => renderDraft(true);
    const fin = $('#drFinish'); if (fin) fin.onclick = () => { const p = SN.finishDraft(S); U.showPaper(p, true); };
    $$('#draftBody [data-pos]').forEach((b) => (b.onclick = () => { draftPos = b.dataset.pos; renderDraft(true); }));
    $$('#drView button').forEach((b) => (b.onclick = () => { draftView = b.dataset.v; renderDraft(true); }));
    $$('#draftBody [data-pid]').forEach((b) => (b.onclick = () => showProspect(b.dataset.pid)));
    const a1 = $('#drAuto1'); if (a1) a1.onclick = () => { const p = SN.autoChoice(S); if (p) doDraft(p.id); };
    const aa = $('#drAutoAll'); if (aa) aa.onclick = () => { clearTimeout(liveTimer); const made = SN.draftAuto(S); draftTicker = made.reverse().concat(draftTicker).slice(0, 60); sfx('select'); renderDraft(true); };
    const ps = $('#drPass'); if (ps) ps.onclick = () => { if (SN.draftPass(S)) renderDraft(); };
  }
  function showProspect(pid) {
    const p = S.draft.pool.find((x) => x.id === pid);
    if (!p) { toast('Already drafted'); renderDraft(true); return; }
    const chk = SN.canDraft(S, S.user, p);
    const cur = SN.draftCur(S);
    const yourTurn = cur && cur.team === S.user;
    const slot = SN.slotFor(S, S.user, p.pos);
    const bar = (lbl, v, txt) => `<div class="sbar"><span>${lbl}</span><div><i style="width:${v}%"></i></div><b>${txt}</b></div>`;
    const fuzz = (v) => (S.up.scouts >= 3 ? Math.round(v / 10) * 10 + '±5' : v >= 75 ? 'High' : v >= 55 ? 'Mid' : 'Low');
    modal(`<div class="row between"><h2>${esc(p.name)}</h2>${closeBtn}</div>
      <p class="muted" style="margin-top:-4px">${GI.POS[p.pos].full} · ${p.rookie ? 'Rookie from ' + p.college : 'Veteran'} · age ${p.age}${p.college === GI.homeCollege(S.user) && p.rookie ? ' · 🏠 hometown kid (+5 hype)' : ''}</p>
      <div class="pcard"><div class="pc-big"><span class="label">Scouted rating</span><b>${p.est[0]}–${p.est[1]}</b><small>Your scouts' range (Scouting Lv ${S.up.scouts}). The true number shows once he's yours.</small></div>
        <div class="pc-big"><span class="label">Potential</span><b>${p.gradeShown}</b><small>${p.sparkShown ? '⚡ Breakthrough spark spotted' : 'Ceiling estimate'}</small></div></div>
      ${bar('Clutch', p.clutch, fuzz(p.clutch))}${bar('Durability', p.dur, fuzz(p.dur))}${bar('Ego', p.ego, fuzz(p.ego))}
      ${(p.traits || []).length ? `<div class="traits">${traitChips(p)}</div>` : ''}
      <p class="muted" style="font-size:13px">${p.rookie ? `Rookie contract: 3 years at ${money(p.salary)}/yr.` : `Contract: ${money(p.salary)}/yr.`} ${slot === 'bench' ? 'He would join as your <b>backup star</b> — his contract only starts when he plays.' : ''} Show-Me move: <b>${GI.SHOWME[p.pos].name}</b>.</p>
      ${yourTurn ? (chk.ok ? `<button class="btn green block" id="pdPick">Draft ${esc(p.name.split(' ').pop())} ▶</button>` : `<p class="pill red" style="text-transform:none">${chk.why}</p>`) : '<p class="muted">Wait for your pick.</p>'}`, (s) => {
      s.querySelector('#mx').onclick = closeModal;
      const b = s.querySelector('#pdPick'); if (b) b.onclick = () => { closeModal(); doDraft(p.id); };
    });
  }
  function doDraft(pid) {
    const res = SN.draftPick(S, pid);
    if (!res.ok) { toast(res.why); return; }
    sfx('star'); GI.audio.buzz(40);
    const verdict = res.reveal >= res.p.est[1] ? 'STEAL! 🔥' : res.reveal <= res.p.est[0] ? 'Bit of a reach…' : 'Right on target.';
    toast(`${GI.POS[res.p.pos].label} ${res.p.name}: true rating ${res.reveal} — ${verdict}${res.slot === 'bench' ? ' (backup)' : ''}`, 3200);
    draftTicker.unshift(S.draft.log[S.draft.log.length - 1]);
    renderDraft();
  }

  // ================= ROSTER =================
  // ---------- v1: the roster as cards ----------
  function renderCardRoster() {
    const r = S.rosters[S.user], ut = T(S.user), team = SN.teamObj(S, S.user);
    const tc = Object.assign({}, ut, GI.legacy.jersey(ut));
    const inj = {};
    SN.injuredFor(S, S.user).forEach(({ s, weeks, holdout }) => (inj[s.id] = holdout ? 'Holdout' : weeks >= 6 ? 'Out for season' : `Out ${weeks}w`));
    const u = GI.ratings(team);
    const order = { QB: 0, RB: 1, WR: 2, TE: 3, OL: 4, DL: 5, LB: 6, CB: 7, S: 8, KP: 9 };
    const sorted = (l) => l.slice().sort((a, b) => order[a.pos] - order[b.pos] || b.rating - a.rating);
    const grp = (title, list, bench) => list.length ? `<div class="cgroup"><h3>${title}</h3><div class="cgrid">${sorted(list).map((c) => U.cardHTML(c, tc, { id: true, hurt: inj[c.id], bench })).join('')}</div></div>` : '';
    const off = r.stars.filter((c) => GI.POS[c.pos].side === 'O'), def = r.stars.filter((c) => GI.POS[c.pos].side === 'D'), st = r.stars.filter((c) => GI.POS[c.pos].side === 'ST');
    const bench = (r.benchList || []).concat(r.bench ? [r.bench] : []);
    const UN = [['Passing', 'pass'], ['Running', 'run'], ['O-line', 'ol'], ['Pass D', 'passD'], ['Run D', 'runD'], ['Pass rush', 'rush'], ['Kicking', 'st']];
    $('#rosterBody').innerHTML = `<div class="topbar" style="margin-bottom:0"><button class="iconbtn" id="roBack">←</button><h2>${esc(ut.name)} Roster</h2><span class="cashpill">${u.ovr} OVR</span></div>
      <div class="sticker panel"><div class="row between"><span class="label">${r.stars.length}/16 starters · ${bench.length} bench</span><span class="label">Payroll ${money(SN.salaryTotal(S, S.user))} of ${money(S.cap)}</span></div>
        <div class="units">${UN.map(([n, k]) => `<div class="un"><span>${n}</span><i><b style="width:${Math.max(4, (u[k] - 40) / 59 * 100)}%"></b></i><em>${u[k]}</em></div>`).join('')}</div>
        <p class="muted" style="font-size:12.5px;margin:8px 0 0">Tap a card for its stats, contract and story. Stars rated 95+ become Star Players with a Show-Me meter.</p></div>
      ${grp('Offense', off)}${grp('Defense', def)}${grp('Special teams', st)}${grp('Bench', bench, true)}
      <div class="sticker panel"><h3>Staff</h3><div class="coach">${['hc', 'oc', 'dc', 'stc'].map((k) => { const c = r.coaches[k]; return `<div><span class="muted" style="font-size:11px">${c.role}</span><b>${esc(c.name)}</b>${c.rating} rtg${c.style ? ' · ' + (GI.OC_STYLES[c.style] || GI.DC_STYLES[c.style]) : ''}</div>`; }).join('')}</div></div>`;
    $('#roBack').onclick = () => { renderHub(); show('hub'); };
    $$('#rosterBody [data-card]').forEach((b) => (b.onclick = () => cardDetail(b.dataset.card)));
  }
  function cardDetail(id) {
    const s = SN.allStars(S, S.user).find((x) => x.id === id); if (!s) return;
    const ut = T(S.user), tc = Object.assign({}, ut, GI.legacy.jersey(ut));
    const ss = S.sstats[s.id], c = s.career || {};
    modal(`<div class="row between"><h2>${esc(s.name)}</h2>${closeBtn}</div>
      <div class="cdetail">${U.cardHTML(s, tc)}<div class="cd-info">
        <p><b>${GI.POS[s.pos].full}</b>${s.unit ? ' · a unit of ' + (s.pos === 'OL' ? 5 : 4) + ' linemen' : s.num != null ? ' · #' + s.num : ''}</p>
        <p class="muted">Age ${s.age} · potential ${SN.grade(s.pot)} (${s.pot}) · ${s.yrsPro ? s.yrsPro + (s.yrsPro === 1 ? ' yr pro' : ' yrs pro') : 'rookie'}</p>
        <p class="muted">${money(s.contract.salary)}/yr · ${s.contract.years} yr${s.contract.years === 1 ? '' : 's'} left</p>
        ${(s.traits || []).length ? `<div class="traits">${traitChips(s)}</div>` : ''}
        <p><span class="label">This season</span><br>${ss ? L.statLine(ss) : 'No stats yet'}</p>
        <p><span class="label">Career</span><br>${c.seasons ? L.statLine(c) : 'First season'}</p>
        ${s.star ? `<p class="kicktip ok">★ Star Player: ${GI.SHOWME[s.pos].name} — ${GI.SHOWME[s.pos].desc}</p>` : `<p class="muted" style="font-size:12.5px">${95 - s.rating} more overall to become a Star Player.</p>`}
      </div></div>
      <button class="btn ghost small block" id="cdRel" style="margin-top:12px">Release</button>`, (m) => {
      m.querySelector('#mx').onclick = closeModal;
      m.querySelector('#cdRel').onclick = () => confirmBox(`Release ${esc(s.name)}?`, `He becomes a free agent. You stop paying his ${money(s.contract.salary)}/yr — and he'll remember who cut him.`, 'Release', 'Keep him', () => { SN.release(S, s.id); renderRoster(); }, true);
    });
  }
  function renderRoster() {
    if (S.rosters[S.user].v === 1) { renderCardRoster(); return; }
    const r = S.rosters[S.user], ut = T(S.user);
    const inj = {};
    SN.injuredFor(S, S.user).forEach(({ s, weeks, holdout }) => (inj[s.id] = holdout ? 'H' + weeks : weeks));
    const qb = r.stars.find((s) => s.pos === 'QB');
    const card = (s, bench) => {
      const c = s.career || {};
      const ss = S.sstats[s.id];
      const chem = qb && qb.chem && qb.chem[s.id] ? qb.chem[s.id] : 0;
      return `<div class="rcard ${inj[s.id] ? 'hurt' : ''}">
        <div class="rc-top"><span class="pp-pos">${GI.POS[s.pos].label}</span><span class="rc-nm"><b>${esc(s.name)}${s.hometown ? ' 🏠' : ''}</b><small>#${s.num} · age ${s.age} · ${s.yrsPro ? s.yrsPro + (s.yrsPro === 1 ? ' yr pro' : ' yrs pro') : 'rookie'}${bench ? ' · BACKUP' : ''}</small></span><span class="rc-ovr">${s.rating}<small>OVR</small></span></div>
        <div class="rc-stats"><span>POT <b>${SN.grade(s.pot)}</b></span><span>CLU <b>${s.clutch}</b></span><span>DUR <b>${s.dur}</b></span><span>EGO <b>${s.ego}</b></span></div>
        ${(s.traits || []).length || chem >= 2 || (s.awards || []).length || s.rings ? `<div class="traits">${traitChips(s)}${chem >= 2 ? `<span class="trait duo">🤝 Duo ×${chem}</span>` : ''}${s.rings ? `<span class="trait">💍 ×${s.rings}</span>` : ''}${(s.awards || []).length ? `<span class="trait">🏆 ×${s.awards.length}</span>` : ''}</div>` : ''}
        <div class="rc-line muted">${ss ? 'This year: ' + L.statLine(ss) : c.seasons ? 'Career: ' + L.statLine(c) : 'No stats yet'}</div>
        <div class="rc-foot"><span class="muted">${GI.SHOWME[s.pos].name} · ${money(s.contract.salary)}/yr · ${s.contract.active ? s.contract.years + ' yr' + (s.contract.years === 1 ? '' : 's') + ' left' : 'contract starts when he plays'}</span>
          ${inj[s.id] ? `<span class="pill red">${String(inj[s.id]).startsWith('H') ? 'Holdout' : 'Out ' + (inj[s.id] >= 6 ? 'season' : inj[s.id] + 'w')}</span>` : ''}</div>
        <div class="rc-act">${!bench && r.bench && (r.bench.pos === s.pos) ? `<button class="btn ghost small" data-swap="${s.id}">⇄ Swap with backup</button>` : ''}<button class="btn ghost small" data-rel="${s.id}">Release</button></div>
      </div>`;
    };
    $('#rosterBody').innerHTML = `<div class="topbar" style="margin-bottom:0"><button class="iconbtn" id="roBack">←</button><h2>${ut.name} Roster</h2></div>
      <div class="sticker panel"><div class="row between"><span class="label">Stars ${r.stars.length}/8 · Payroll ${money(SN.salaryTotal(S, S.user))} of ${money(S.cap)} cap</span><span class="label">${SN.teamOvr(S, S.user)} OVR</span></div>
      <p class="muted" style="font-size:13px;margin:6px 0 0">Positions without a star are played by generic players. Your one backup star sits until a starter at his position gets hurt — his contract clock only starts once he plays.</p></div>
      <div class="rgrid">${r.stars.map((s) => card(s)).join('')}${r.bench ? card(r.bench, true) : '<div class="rcard empty">🪑 No backup star. Draft or sign one once your 8 slots are full.</div>'}</div>
      <div class="sticker panel"><h3>Staff</h3><div class="coach">${['hc', 'oc', 'dc', 'stc'].map((k) => { const c = r.coaches[k]; return `<div><span class="muted" style="font-size:11px">${c.role}</span><b>${esc(c.name)}</b>${c.rating} rtg${c.style ? ' · ' + (GI.OC_STYLES[c.style] || GI.DC_STYLES[c.style]) : ''}${c.former ? '<br><small>🎓 former star ' + GI.POS[c.former.pos].label + '</small>' : ''}</div>`; }).join('')}</div></div>`;
    $('#roBack').onclick = () => { renderHub(); show('hub'); };
    $$('#rosterBody [data-swap]').forEach((b) => (b.onclick = () => { if (SN.swapBench(S, b.dataset.swap)) { toast('Swapped. The backup is now a starter and his contract is active.'); renderRoster(); } }));
    $$('#rosterBody [data-rel]').forEach((b) => (b.onclick = () => {
      const s = SN.allStars(S, S.user).find((x) => x.id === b.dataset.rel);
      confirmBox(`Release ${esc(s.name)}?`, `He becomes a free agent. You stop paying his ${money(s.contract.salary)}/yr — and he'll remember who cut him.`, 'Release', 'Keep him', () => { SN.release(S, s.id); renderRoster(); }, true);
    }));
  }

  // ================= FRONT OFFICE =================
  let officeTab = 'upgrades';
  function renderOffice() {
    sync();
    const tabs = [['upgrades', 'Upgrades'], ['stadium', 'Stadium'], ['staff', 'Staff'], ['contracts', 'Contracts'], ['fa', 'Free Agency'], ['finances', 'Finances']];
    let body = '';
    if (officeTab === 'upgrades') {
      body = Object.keys(SN.UPGRADES).map((k) => {
        const u = SN.UPGRADES[k], lv = S.up[k], cost = SN.upgradeCost(S, k);
        return `<div class="sticker upcard"><div class="up-ic">${u.icon}</div><div class="up-main"><b>${u.name}</b><div class="lvl">${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= lv ? 'on' : ''}"></i>`).join('')}</div><small>${u.desc.filter(Boolean).join(' · ')}</small></div>
          ${cost ? `<button class="btn ${S.cash >= cost ? 'gold' : 'ghost'} small" data-up="${k}" ${S.cash >= cost ? '' : 'disabled'}>Lv ${lv + 1} · ${money(cost)}</button>` : '<span class="pill green">MAX</span>'}</div>`;
      }).join('') + `<p class="muted" style="font-size:12.5px">Each upgrade level adds ${money(1.1)}/yr in upkeep. Stadium levels also lift ticket revenue, fan hype and base morale.</p>`;
    } else if (officeTab === 'stadium') {
      const v = GI.venueOf(S.user, S), open = SN.canRenovate(S);
      const sp = SN.splits(S, S.user);
      body = `<div class="sticker panel stadcard"><div class="row between"><h3>🏟️ ${esc(v.name)}</h3><button class="btn ghost small" id="stRename">Rename</button></div>
          <div class="stadchips"><span class="pill">${GI.ROOFS[v.roof].icon} ${GI.ROOFS[v.roof].name}</span><span class="pill">${GI.SURFACES[v.surface].icon} ${GI.SURFACES[v.surface].name}</span><span class="pill">🌡️ ${GI.CLIMATES[v.climate].name}</span><span class="pill">👥 ${v.cap + (S.up.stadium - 1) * 4}k seats</span></div>
          <p class="muted" style="font-size:13px;margin:8px 0 0">${GI.SURFACES[v.surface].desc}${v.roof === 'dome' ? ' The roof keeps the weather out and the noise in.' : v.roof === 'retract' ? ' The roof closes whenever the weather turns.' : ''} Home ${sp.home.w}-${sp.home.l} · Road ${sp.away.w}-${sp.away.l} this year.</p></div>
        <div class="label" style="margin:4px 2px 8px">Renovations${open ? '' : ' · construction happens in the offseason, draft or spring training'}</div>
        ${Object.keys(SN.PROJECTS).filter((k) => SN.PROJECTS[k].ok(v)).map((k) => { const p = SN.PROJECTS[k]; const can = open && S.cash >= p.cost; return `<div class="sticker upcard"><div class="up-ic">${p.icon}</div><div class="up-main"><b>${p.name}</b><small>${p.desc}</small></div><button class="btn ${can ? 'gold' : 'ghost'} small" data-proj="${k}" ${can ? '' : 'disabled'}>${money(p.cost)}</button></div>`; }).join('')}
        <p class="muted" style="font-size:12.5px">Your field skin from the Legacy store shows up at home games in your building. Road games are played on the other team's field.</p>`;
    } else if (officeTab === 'staff') {
      const r = S.rosters[S.user];
      const pool = S.coachPool.slice(0, 14);
      body = `<div class="sticker panel"><h3>Your staff</h3>${['hc', 'oc', 'dc', 'stc'].map((k) => { const c = r.coaches[k]; return `<div class="staffrow"><span class="pp-pos">${L.ROLE_SHORT[k]}</span><span class="sr-main"><b>${esc(c.name)}</b><small>${c.rating} rtg${c.style ? ' · ' + (GI.OC_STYLES[c.style] || GI.DC_STYLES[c.style]) : ''} · ${money(L.coachSalary(c))}/yr${c.former ? ' · 🎓 ex-' + GI.POS[c.former.pos].label : ''}</small></span></div>`; }).join('')}
        <p class="muted" style="font-size:12.5px;margin:8px 0 0">Coaches you fire land elsewhere — and get revenge games against you. Coaches who worked together know each other's playbooks.</p></div>
        <div class="sticker panel"><h3>Coaching market</h3>${pool.length ? pool.map((c, i) => {
          const fee = L.coachSalary(c);
          const seats = (c.former ? [c.former.pos === 'KP' ? 'stc' : ['QB', 'RB', 'WR', 'TE', 'OL'].includes(c.former.pos) ? 'oc' : 'dc'] : ['oc', 'dc']).concat(c.rating >= 64 ? ['hc'] : []);
          const was = (c.hist || []).filter((h) => h.key !== 'player').slice(-1)[0];
          return `<div class="staffrow"><span class="pp-pos">${c.rating}</span><span class="sr-main"><b>${esc(c.name)}</b><small>${c.former ? `🎓 retired ${GI.POS[c.former.pos].label}${c.former.hof ? ' · 🏛️ Hall of Famer' : ''}` : was ? `last: ${L.ROLE_SHORT[was.key] || 'coach'}, ${T(was.team).abbr}${was.how ? ' (' + was.how + ')' : ''}` : 'up-and-comer'}${c.style ? ' · ' + (GI.OC_STYLES[c.style] || GI.DC_STYLES[c.style]) : ''}</small></span>
            <span class="ctr">${seats.map((k) => `<button class="btn ghost small" data-hire="${i}" data-seat="${k}" ${S.cash >= fee ? '' : 'disabled'}>${L.ROLE_SHORT[k]} · ${money(fee)}</button>`).join('')}</span></div>`;
        }).join('') : '<p class="muted">Nobody available right now. Fired coaches and retiring stars land here.</p>'}</div>`;
    } else if (officeTab === 'finances') {
      const rep = S.fin.reports[0];
      body = `<div class="sticker panel"><h3>This year so far</h3>
        <div class="fin"><span>Cash on hand</span><b>${money(S.cash)}</b></div>
        <div class="fin"><span>Ticket sales</span><b>${money(S.fin.tickets)}</b></div>
        <div class="fin"><span>Playoff gates</span><b>${money(S.fin.playoffs)}</b></div>
        <div class="fin"><span>Bonuses</span><b>${money(S.fin.bonus)}</b></div>
        <div class="fin"><span>Payroll (due at season end)</span><b>${money(SN.salaryTotal(S, S.user))}</b></div>
        <div class="fin"><span>Coaching staff</span><b>${money(L.staffCost(S, S.user))}</b></div>
        <div class="fin"><span>TV deal (paid at season end)</span><b>${money(25)}</b></div>
        <div class="fin"><span>Salary cap</span><b>${money(S.cap)} (${money(L.capRoom(S, S.user))} room)</b></div>
        <p class="muted" style="font-size:12.5px">Fan hype (${Math.round(S.hype)}) boosts every gate. Win the Iron-Bowl for a ${money(15)} purse; reaching it pays ${money(4)}. Owner goals pay bonuses.</p></div>
        ${rep ? `<div class="sticker panel"><h3>Year ${rep.year} books</h3>
        <div class="fin"><span>Revenue</span><b>${money(rep.rev)}</b></div><div class="fin"><span>Expenses</span><b>${money(rep.exp)}</b></div><div class="fin"><span>Ended with</span><b>${money(rep.cash)}</b></div></div>` : ''}`;
    } else if (officeTab === 'contracts') {
      const exp = (S.expiring || []).map((id) => SN.allStars(S, S.user).find((x) => x.id === id)).filter(Boolean);
      body = exp.length ? `<p class="muted" style="font-size:13px">Cap room: <b>${money(L.capRoom(S, S.user))}</b> (expiring deals already off the books). Award winners ask for 20% more.</p>` + exp.map((s) => `<div class="sticker upcard"><span class="pp-pos">${GI.POS[s.pos].label}</span><div class="up-main"><b>${esc(s.name)}</b><small>${s.rating} OVR · age ${s.age} · ego ${s.ego} · asks ${money(s.ask)}/yr</small></div>
          <div class="ctr"><button class="btn green small" data-rs="${s.id}" data-y="1">1 yr</button><button class="btn green small" data-rs="${s.id}" data-y="2">2 yrs</button><button class="btn green small" data-rs="${s.id}" data-y="3">3 yrs</button><button class="btn ghost small" data-let="${s.id}">Let go</button></div></div>`).join('')
        : `<div class="sticker panel"><p class="muted" style="margin:0">${S.phase === 'offseason' ? 'All contracts are settled.' : 'Contract decisions happen in the offseason. Rookie deals last 3 years. Underpaid stars may demand a new deal mid-season.'}</p></div>`;
    } else if (officeTab === 'fa') body = faHTML();
    $('#officeBody').innerHTML = `<div class="topbar" style="margin-bottom:0"><button class="iconbtn" id="ofBack">←</button><h2>Front Office</h2><span class="cashpill">💰 ${money(S.cash)}</span></div>
      <div class="postabs" id="ofTabs">${tabs.map(([k, n]) => `<button data-v="${k}" class="${k === officeTab ? 'on' : ''}">${n}${k === 'contracts' && (S.expiring || []).length ? ' •' : ''}${k === 'fa' && S.phase === 'offseason' && !S.faDone ? ' •' : ''}</button>`).join('')}</div>${body}`;
    $('#ofBack').onclick = () => { renderHub(); show('hub'); };
    $$('#ofTabs button').forEach((b) => (b.onclick = () => { officeTab = b.dataset.v; renderOffice(); }));
    $$('#officeBody [data-proj]').forEach((b) => (b.onclick = () => {
      const p = SN.PROJECTS[b.dataset.proj];
      confirmBox(`${p.icon} ${p.name}?`, `${p.desc} Cost: ${money(p.cost)}.`, 'Break ground', 'Not now', () => { if (SN.renovate(S, b.dataset.proj)) { sfx('horn'); toast(`🏗️ ${p.name} — done!`); } renderOffice(); });
    }));
    const rn = $('#stRename'); if (rn) rn.onclick = () => {
      const v = GI.venueOf(S.user, S);
      modal(`<div class="row between"><h2>Rename the stadium</h2>${closeBtn}</div><input class="txt" id="stName" maxlength="28" value="${esc(v.name)}"><button class="btn green block" id="stSave" style="margin-top:12px">Save</button>`, (m) => {
        m.querySelector('#mx').onclick = closeModal;
        m.querySelector('#stSave').onclick = () => { if (SN.renameStadium(S, m.querySelector('#stName').value)) { closeModal(); toast('🏟️ New name on the marquee'); renderOffice(); } };
      });
    };
    $$('#officeBody [data-up]').forEach((b) => (b.onclick = () => { if (SN.upgrade(S, b.dataset.up)) { sfx('star'); toast(`${SN.UPGRADES[b.dataset.up].name} upgraded!`); renderOffice(); } }));
    $$('#officeBody [data-rs]').forEach((b) => (b.onclick = () => { const res = SN.resign(S, b.dataset.rs, +b.dataset.y); if (res && res.ok === false) toast(res.why, 2600); else sfx('select'); renderOffice(); }));
    $$('#officeBody [data-let]').forEach((b) => (b.onclick = () => { SN.release(S, b.dataset.let, 'walked'); renderOffice(); }));
    $$('#officeBody [data-hire]').forEach((b) => (b.onclick = () => {
      const c = S.coachPool[+b.dataset.hire], k = b.dataset.seat;
      const old = S.rosters[S.user].coaches[k];
      confirmBox(`Hire ${esc(c.name)} as ${L.ROLE[k]}?`, `${esc(old.name)} (${old.rating}) is out — he'll land somewhere and remember. Signing fee: ${money(L.coachSalary(c))}.`, 'Hire him', 'Not now', () => {
        S.cash -= L.coachSalary(c); S.fin.events += L.coachSalary(c);
        L.hire(S, S.user, k, c, 'fired');
        SN.save(S); sfx('horn'); toast(`${c.name} is your new ${L.ROLE[k].toLowerCase()}!`); renderOffice();
      });
    }));
    bindFA();
  }
  // ---------- free agency ----------
  function faHTML() {
    if (S.phase !== 'offseason') return `<div class="sticker panel"><h3>Free agency</h3><p class="muted" style="margin:0">Opens in the offseason. Stars whose deals run out — yours and everyone else's — hit the market, and teams bid against each other.</p></div>`;
    if (S.faDone) return `<div class="sticker panel"><h3>Free agency results</h3>${(S.faResults || []).length ? `<ul class="faresults">${S.faResults.slice(0, 30).map((x) => `<li class="${x.won ? 'won' : x.user ? 'lost' : ''}">${helmet(T(x.team), 'xs')}<span><b>${GI.POS[x.pos].label} ${esc(x.name)}</b> (${x.rating}) → ${T(x.team).abbr}<small>${money(x.salary)}/yr × ${x.years}${x.bids > 1 ? ` · ${x.bids} teams bid` : ''}${x.user && !x.won ? ' · you lost the bidding war' : ''}</small></span></li>`).join('')}</ul>` : '<p class="muted">Quiet market.</p>'}</div>`;
    const board = L.faBoard(S);
    const offers = S.faOffers || {};
    const committed = Object.values(offers).reduce((t, o) => t + o.salary, 0);
    const bonuses = Object.values(offers).reduce((t, o) => t + L.faBonus(o.salary, o.years), 0);
    return `<div class="sticker panel"><div class="row between"><h3>The market</h3><span class="label">Cap room ${money(L.capRoom(S, S.user) - committed)} · bonuses ${money(bonuses)}</span></div>
      <p class="muted" style="font-size:12.5px;margin:0">Make offers, then sign. Rival teams bid too. Players weigh money, years (vets want security), your fan hype and whether you win. Signing bonus: 25% of salary per year, paid now.</p></div>
      <div class="plist">${board.map(({ f, ask, interest }) => { const o = offers[f.id]; return `<button class="prow ${o ? 'offered' : ''}" data-fa="${f.id}"><span class="pp-pos">${GI.POS[f.pos].label}</span>
        <span class="pr-main"><b>${esc(f.name)}${(f.traits || []).map((k) => ' ' + GI.TRAITS[k].icon).join('')}</b><small>age ${f.age} · ${f.lastTeam != null ? 'ex-' + T(f.lastTeam).abbr : 'unsigned'} · ${'🔥'.repeat(interest) || 'no other interest'}</small></span>
        <span class="pr-est"><b>${f.rating}</b><small>${o ? `offer ${money(o.salary)}×${o.years}` : `asks ${money(ask)}`}</small></span></button>`; }).join('') || '<p class="muted">Nobody worth signing.</p>'}</div>
      <button class="btn green block" id="faRun" style="margin-top:12px">Sign free agents ▶</button>`;
  }
  function bindFA() {
    $$('#officeBody [data-fa]').forEach((b) => (b.onclick = () => faOffer(b.dataset.fa)));
    const run = $('#faRun');
    if (run) run.onclick = () => {
      const res = L.runFA(S);
      S.faResults = res; SN.save(S);
      const won = res.filter((x) => x.won), lost = res.filter((x) => x.user && !x.won);
      sfx(won.length ? 'td' : 'paper');
      modal(`<h2>✍️ Signing day</h2>${won.length ? `<p><b>You signed:</b></p><ul class="faresults">${won.map((x) => `<li class="won"><span><b>${GI.POS[x.pos].label} ${esc(x.name)}</b> (${x.rating})<small>${money(x.salary)}/yr × ${x.years}</small></span></li>`).join('')}</ul>` : '<p class="muted">You didn\'t land anyone.</p>'}
        ${lost.length ? `<p><b>Lost bidding wars:</b></p><ul class="faresults">${lost.map((x) => `<li class="lost"><span><b>${esc(x.name)}</b> → ${T(x.team).city}<small>${money(x.salary)}/yr × ${x.years}</small></span></li>`).join('')}</ul>` : ''}
        <p class="muted" style="font-size:13px">${res.length} players signed around the league. Unsigned players enter the draft pool.</p><button class="btn gold block" id="faOk">Nice ▶</button>`, (s) => (s.querySelector('#faOk').onclick = () => { closeModal(); renderOffice(); }));
    };
  }
  function faOffer(id) {
    const f = S.freeAgents.find((x) => x.id === id);
    if (!f) return;
    const ask = f.ask || SN.askSalary(f);
    let o = Object.assign({ salary: ask, years: f.age >= 30 ? 2 : 3 }, S.faOffers[id] || {});
    const draw = (s) => {
      const bonus = L.faBonus(o.salary, o.years);
      s.innerHTML = `<div class="row between"><h2>${esc(f.name)}</h2>${closeBtn}</div>
        <p class="muted" style="margin-top:-4px">${GI.POS[f.pos].full} · ${f.rating} OVR · age ${f.age} · ego ${f.ego}${f.lastTeam != null ? ` · last with ${T(f.lastTeam).city}` : ''}</p>
        ${(f.traits || []).length ? `<div class="traits">${traitChips(f)}</div>` : ''}
        <div class="stepper"><span>Salary</span><button class="iconbtn sm" data-d="-0.5">−</button><b>${money(o.salary)}/yr</b><button class="iconbtn sm" data-d="0.5">+</button></div>
        <p class="muted" style="font-size:12.5px;margin:2px 0 8px">He's asking ${money(ask)}. Rivals usually bid 85–120% of the ask.</p>
        <div class="seg" id="yrs">${[1, 2, 3].map((y) => `<button data-y="${y}" class="${o.years === y ? 'on' : ''}">${y} yr${y > 1 ? 's' : ''}</button>`).join('')}</div>
        <p class="muted" style="font-size:13px">Signing bonus if he picks you: <b>${money(bonus)}</b> · cap room ${money(L.capRoom(S, S.user))}</p>
        <div style="display:grid;gap:10px"><button class="btn green block" id="ofSave">Make the offer</button>${S.faOffers[id] ? '<button class="btn ghost block" id="ofDel">Withdraw offer</button>' : ''}</div>`;
      s.querySelector('#mx').onclick = closeModal;
      s.querySelectorAll('[data-d]').forEach((b) => (b.onclick = () => { o.salary = Math.max(0.5, Math.round((o.salary + +b.dataset.d) * 2) / 2); draw(s); }));
      s.querySelectorAll('#yrs button').forEach((b) => (b.onclick = () => { o.years = +b.dataset.y; draw(s); }));
      s.querySelector('#ofSave').onclick = () => { const r = L.offer(S, id, o.salary, o.years); if (!r.ok) { toast(r.why, 2600); return; } closeModal(); sfx('select'); renderOffice(); };
      const del = s.querySelector('#ofDel'); if (del) del.onclick = () => { L.offer(S, id, null); closeModal(); renderOffice(); };
    };
    modal('', draw);
  }

  // ================= TRADES =================
  let tradeP = null, give = { stars: [], picks: [] }, get = { stars: [], picks: [] };
  function openTrade() {
    sync();
    if (!L.tradeOpen(S)) { toast(S.phase === 'regular' ? 'The trade deadline has passed (mid-season)' : 'Trades open in the offseason, camp and the first half of the season', 2600); return; }
    tradeP = null; give = { stars: [], picks: [] }; get = { stars: [], picks: [] };
    renderTrade(); show('trade');
  }
  function renderTrade() {
    if (tradeP == null) {
      const teams = [...Array(32).keys()].filter((i) => i !== S.user).sort((a, b) => SN.teamOvr(S, b) - SN.teamOvr(S, a));
      $('#tradeBody').innerHTML = `<div class="topbar" style="margin-bottom:0"><button class="iconbtn" id="trBack">←</button><h2>Trade Center</h2><span class="cashpill">Cap ${money(L.capRoom(S, S.user))}</span></div>
        <p class="muted" style="margin:0;font-size:13.5px">Swap stars and draft picks. Teams value youth, potential, cheap contracts and picks. Traded stars remember — expect revenge games.${S.phase === 'regular' ? ` Deadline: week ${Math.ceil(S.weeks / 2)}.` : ''}</p>
        <div class="tradeteams">${teams.map((i) => { const r = S.rosters[i]; const need = SN.REQUIRED.concat(['RB', 'WR', 'CB', 'DL']).filter((p) => !r.stars.some((s) => s.pos === p)).slice(0, 3); return `<button class="tteam" data-tp="${i}">${helmet(T(i), 'sm')}<span><b>${T(i).city} ${T(i).name}</b><small>${SN.teamOvr(S, i)} OVR · ${r.stars.length} stars · cap ${money(L.capRoom(S, i))}${need.length ? ' · needs ' + need.map((p) => GI.POS[p].label).join('/') : ''}</small></span></button>`; }).join('')}</div>`;
      $('#trBack').onclick = () => { renderHub(); show('hub'); };
      $$('#tradeBody [data-tp]').forEach((b) => (b.onclick = () => { tradeP = +b.dataset.tp; renderTrade(); }));
      return;
    }
    const mine = SN.allStars(S, S.user), theirs = SN.allStars(S, tradeP);
    const myPicks = L.ownedPicks(S, S.user), thPicks = L.ownedPicks(S, tradeP);
    const ev = L.evalTrade(S, tradeP, give, get);
    const pct = Math.max(4, Math.min(100, Math.round((ev.ratio || 0) * 70)));
    const starBtn = (s, side) => { const on = (side === 'give' ? give : get).stars.includes(s.id); return `<button class="tchip ${on ? 'on' : ''}" data-ts="${s.id}" data-side="${side}"><span class="pp-pos">${GI.POS[s.pos].label}</span><span><b>${esc(GI.shortName(s.name))}</b><small>${s.rating} · age ${s.age} · ${money(s.contract.salary)}</small></span></button>`; };
    const pickBtn = (p, side) => { const on = (side === 'give' ? give : get).picks.some((x) => x.round === p.round && x.orig === p.orig); return `<button class="tchip pk ${on ? 'on' : ''}" data-pr="${p.round}" data-po="${p.orig}" data-side="${side}"><span class="pp-pos">R${p.round}</span><span><b>Round ${p.round}</b><small>${p.orig === (side === 'give' ? S.user : tradeP) ? 'own' : 'via ' + T(p.orig).abbr}</small></span></button>`; };
    $('#tradeBody').innerHTML = `<div class="topbar" style="margin-bottom:0"><button class="iconbtn" id="trBack">←</button><h2>Trade with ${T(tradeP).abbr}</h2>${helmet(T(tradeP), 'sm')}</div>
      <div class="sticker panel tverdict ${ev.ok ? 'ok' : ''}"><div class="row between"><b>${ev.verdict || ev.why || 'Pick players or picks'}</b><span class="label">${T(tradeP).city}'s view</span></div><div class="tmeter"><i style="width:${pct}%"></i><span class="line"></span></div></div>
      <div class="tcols"><div><div class="label">You give</div>${mine.map((s) => starBtn(s, 'give')).join('')}${myPicks.filter((p) => p.round <= 3).map((p) => pickBtn(p, 'give')).join('')}</div>
        <div><div class="label">You get</div>${theirs.map((s) => starBtn(s, 'get')).join('') || '<p class="muted">No stars.</p>'}${thPicks.filter((p) => p.round <= 3).map((p) => pickBtn(p, 'get')).join('')}</div></div>
      <div class="row" style="gap:10px"><button class="btn ghost" style="flex:1" id="trOther">Other team</button><button class="btn green" style="flex:2" id="trGo" ${ev.ok ? '' : 'disabled'}>Make the trade</button></div>`;
    $('#trBack').onclick = () => { tradeP = null; renderTrade(); };
    $('#trOther').onclick = () => { tradeP = null; give = { stars: [], picks: [] }; get = { stars: [], picks: [] }; renderTrade(); };
    $$('#tradeBody [data-ts]').forEach((b) => (b.onclick = () => { const o = b.dataset.side === 'give' ? give : get; const id = b.dataset.ts; o.stars = o.stars.includes(id) ? o.stars.filter((x) => x !== id) : o.stars.concat([id]); sfx('tap'); renderTrade(); }));
    $$('#tradeBody [data-pr]').forEach((b) => (b.onclick = () => { const o = b.dataset.side === 'give' ? give : get; const p = { round: +b.dataset.pr, orig: +b.dataset.po }; const has = o.picks.some((x) => x.round === p.round && x.orig === p.orig); o.picks = has ? o.picks.filter((x) => !(x.round === p.round && x.orig === p.orig)) : o.picks.concat([p]); renderTrade(); }));
    $('#trGo').onclick = () => {
      const res = L.doTrade(S, tradeP, give, get);
      if (!res.ok) { toast(res.why || 'They said no'); return; }
      sfx('horn'); GI.audio.buzz([30, 30, 60]);
      modal(`<h2>🔁 Trade done!</h2><p>${res.desc}</p>${res.notes.map((n) => `<p class="muted">${n}</p>`).join('')}<button class="btn gold block" id="tdOk">Done</button>`, (s) => (s.querySelector('#tdOk').onclick = () => { closeModal(); tradeP = null; give = { stars: [], picks: [] }; get = { stars: [], picks: [] }; renderTrade(); }));
    };
  }

  // ================= TABLES: standings / playoffs / schedule =================
  let confTab = null;
  function renderTables(tab) {
    if (confTab == null) confTab = SN.confOf(S.user);
    const tabs = [['standings', 'Standings'], ['playoffs', 'Playoffs'], ['schedule', 'Schedule']];
    let body = '';
    if (tab === 'standings') {
      body = `<div class="seg" id="confSeg"><button data-v="0" class="${confTab === 0 ? 'on' : ''}">Iron Conf.</button><button data-v="1" class="${confTab === 1 ? 'on' : ''}">Steel Conf.</button></div>`;
      for (let d = 0; d < 4; d++) {
        const ids = SN.sorted(S, [...Array(32).keys()].filter((i) => SN.confOf(i) === confTab && SN.divOf(i) === d));
        body += `<div class="sticker panel"><div class="row between"><h3>${SN.CONFS[confTab]} ${SN.DIVS[d]}</h3><span class="label">W-L · PF-PA</span></div>${ids.map((i) => rowTeam(i)).join('')}</div>`;
      }
      const seeds = SN.sorted(S, [...Array(32).keys()].filter((i) => SN.confOf(i) === confTab)).slice(0, 7);
      body += `<div class="sticker panel"><h3>Playoff picture</h3><p class="muted" style="margin:0 0 6px;font-size:13px">Top 6 make it. Seeds 1–2 get a bye.</p>${seeds.map((i, k) => rowTeam(i, k < 6 ? '#' + (k + 1) : 'out')).join('')}</div>`;
    } else if (tab === 'playoffs') {
      if (!S.bracket) {
        body = `<div class="sticker panel"><h3>Road to the Iron-Bowl</h3><p class="muted">The bracket is set after week ${S.weeks}. Twelve teams make it: the top six in each conference.</p></div>`;
      } else {
        S.bracket.rounds.forEach((rd, k) => { body += `<div class="sticker panel"><h3>${SN.ROUND_NAMES[k]}</h3>${rd.map((g) => gameRow(g, true)).join('')}</div>`; });
        if (S.champion != null) body += `<div class="sticker panel champ mine"><div class="trophy">🏆</div><h3>${T(S.champion).city} ${T(S.champion).name}</h3><p class="muted">Iron-Bowl Champions</p></div>`;
      }
    } else {
      body = `<div class="sticker panel">${S.schedule.map((wk, k) => {
        const g = wk.find((x) => x.h === S.user || x.a === S.user);
        return `<div class="srow ${k === S.week && S.phase === 'regular' ? 'cur' : ''}"><span class="wk">W${k + 1}</span>${gameRow(g, false)}</div>`;
      }).join('')}</div>`;
    }
    $('#tablesBody').innerHTML = `<div class="topbar" style="margin-bottom:0"><button class="iconbtn" id="tbBack">←</button><h2>${tabs.find((t) => t[0] === tab)[1]}</h2></div>
      <div class="seg" id="tabSeg">${tabs.map(([k, n]) => `<button data-v="${k}" class="${k === tab ? 'on' : ''}">${n}</button>`).join('')}</div>${body}`;
    $('#tbBack').onclick = () => { renderHub(); show('hub'); };
    $$('#tabSeg button').forEach((b) => (b.onclick = () => renderTables(b.dataset.v)));
    $$('#confSeg button').forEach((b) => (b.onclick = () => { confTab = +b.dataset.v; renderTables('standings'); }));
  }
  function gameRow(g, seeds) {
    const sd = (i) => (seeds && S.bracket ? `<small>#${S.bracket.seedOf[i]}</small>` : '');
    const side = (i, sc, won) => `<span class="gr-team ${i === S.user ? 'me' : ''} ${won ? 'won' : ''}">${helmet(T(i), 'xs')}${sd(i)}${T(i).abbr}${g.done ? `<b>${sc}</b>` : ''}</span>`;
    const hw = g.done && g.hs > g.as, aw = g.done && g.as > g.hs;
    let res = '';
    if (g.done && (g.h === S.user || g.a === S.user)) {
      const us = g.h === S.user ? g.hs : g.as, them = g.h === S.user ? g.as : g.hs;
      res = `<span class="pill ${us > them ? 'green' : us < them ? 'red' : ''}">${us > them ? 'W' : us < them ? 'L' : 'T'}</span>`;
    }
    const hot = L.heat(S, g.h, g.a) + L.heat(S, g.a, g.h) >= 50 ? '<span title="Rivalry">🔥</span>' : '';
    const V = g.neutral ? GI.NEUTRAL_VENUE : GI.venueOf(g.h, S);
    const vi = !seeds && (g.h === S.user || g.a === S.user) ? `<span class="vi" title="${esc(V.name)}">${V.roof === 'dome' ? '🏟️' : V.roof === 'retract' ? '🪟' : V.surface === 'grass' ? '🌱' : '⚡'}</span>` : '';
    return `<div class="grow">${side(g.a, g.as, aw)}<span class="at">@</span>${side(g.h, g.hs, hw)}${vi}${res}${hot}${g.ot ? '<small class="muted">OT</small>' : ''}</div>`;
  }

  // ================= RECORDS, HALL OF FAME, AWARDS, RIVALRIES =================
  let recTab = 'records', recScope = 'season';
  function openRecords(tab) { sync(); if (tab) recTab = tab; renderRecords(); show('records'); }
  function renderRecords() {
    const tabs = [['records', 'Records'], ['hof', 'Hall of Fame'], ['awards', 'Awards'], ['rivals', 'Rivalries']];
    let body = '';
    if (recTab === 'records') {
      const bk = S.book[recScope] || {};
      body = `<div class="seg" id="scopeSeg">${[['game', 'Single game'], ['season', 'Season'], ['career', 'Career']].map(([k, n]) => `<button data-v="${k}" class="${recScope === k ? 'on' : ''}">${n}</button>`).join('')}</div>
        <div class="sticker panel">${L.RECKEYS.map((k) => { const r = bk[k]; return `<div class="recrow ${r && r.team === S.user ? 'mine' : ''}"><span class="rk">${GI.STAT_NAME[k]}</span>${r ? `<b>${r.v.toLocaleString()}</b><span class="rh">${helmet(T(r.team), 'xs')}${esc(r.name)} <small>Y${r.year}</small></span>` : '<b>—</b><span class="rh muted">open</span>'}</div>`; }).join('')}</div>`;
      const wx = S.wxRec || {};
      if (Object.keys(wx).length) body += `<div class="sticker panel"><h3>🌦️ In the elements</h3><p class="muted" style="margin:0 0 6px;font-size:12.5px">Your franchise's all-time record by weather.</p>${Object.keys(GI.WEATHER).filter((k) => wx[k]).map((k) => `<div class="recrow"><span class="rk">${GI.WEATHER[k].icon} ${GI.WEATHER[k].name}</span><b>${wx[k].w}-${wx[k].l}${wx[k].t ? '-' + wx[k].t : ''}</b></div>`).join('')}</div>`;
    } else if (recTab === 'hof') {
      const all = GI.legacy.get().hof.filter((h) => h.fid !== S.fid);
      const card = (h) => `<div class="hofcard">${helmet(T(h.team), 'sm')}<div><b>${esc(h.name)}</b><small>${GI.POS[h.pos].label} · ${h.tname || T(h.team).name} · inducted Y${h.year}${h.career ? ' · 🎮 career' : ''}</small><p>${h.line}${h.rings ? ` · 💍×${h.rings}` : ''}${(h.awards || []).length ? ` · 🏆×${h.awards.length}` : ''}</p></div></div>`;
      body = `<div class="sticker panel"><h3>🏛️ This franchise's Hall</h3>${S.hof.length ? S.hof.map(card).join('') : '<p class="muted">No inductees yet. Legends get in when they retire.</p>'}</div>
        ${all.length ? `<div class="sticker panel"><h3>All-time Hall (every franchise & career)</h3>${all.slice(0, 30).map(card).join('')}</div>` : ''}`;
    } else if (recTab === 'awards') {
      const years = Object.keys(S.awards).sort((a, b) => b - a);
      body = years.length ? years.map((y) => { const A = S.awards[y]; const row = (lbl, x) => x ? `<div class="recrow ${x.team === S.user ? 'mine' : ''}"><span class="rk">${lbl}</span><span class="rh">${helmet(T(x.team), 'xs')}${esc(x.name)}${x.pos ? ' · ' + GI.POS[x.pos].label : ''}</span></div>` : '';
        return `<div class="sticker panel"><h3>Year ${y}</h3>${row('MVP', A.mvp)}${row('Off. POY', A.opoy)}${row('Def. POY', A.dpoy)}${row('Rookie', A.roy)}${row('Coach', A.coy)}<p class="muted" style="font-size:12px;margin:6px 0 0">All-Iron: ${A.allIron.map((x) => `${T(x.team).abbr} ${GI.shortName(x.name)}`).join(', ')}</p></div>`; }).join('')
        : '<div class="sticker panel"><p class="muted" style="margin:0">Awards are handed out after each Iron-Bowl.</p></div>';
    } else {
      const grudges = [...Array(32).keys()].filter((i) => i !== S.user).map((i) => ({ i, h: L.heat(S, S.user, i), t: L.heat(S, i, S.user) })).filter((x) => x.h + x.t > 0).sort((a, b) => b.h + b.t - (a.h + a.t)).slice(0, 8);
      const stars = Object.values(S.starRiv).filter((r) => r.n >= 2).sort((a, b) => b.n - a.n).slice(0, 10);
      body = `<div class="sticker panel"><h3>🔥 Teams with bad blood</h3>${grudges.length ? grudges.map((x) => `<div class="recrow"><span class="rh">${helmet(T(x.i), 'xs')}${T(x.i).city} ${T(x.i).name}</span><span class="heat"><i style="width:${Math.min(100, x.h)}%" title="Your grudge"></i><i class="t" style="width:${Math.min(100, x.t)}%" title="Theirs"></i></span></div>`).join('') + '<p class="muted" style="font-size:12px;margin:6px 0 0">Gold = your grudge, red = theirs. Lose to a team and the heat rises; rivalry games get louder crowds and hotter meters.</p>' : '<p class="muted">No grudges yet.</p>'}</div>
        <div class="sticker panel"><h3>⚔️ Star rivalries</h3>${stars.length ? stars.map((r) => `<div class="recrow"><span class="rh">${esc(r.an.name)} <small>${r.an.pos}</small> vs ${esc(r.bn.name)} <small>${r.bn.pos}</small></span><b>${r.w[r.a] || 0}-${r.w[r.b] || 0}</b></div>`).join('') : '<p class="muted">Star clashes build rivalries. Two clashes and it\'s personal.</p>'}</div>`;
    }
    $('#recordsBody').innerHTML = `<div class="topbar" style="margin-bottom:0"><button class="iconbtn" id="rcBack">←</button><h2>Record Book</h2></div>
      <div class="postabs" id="recTabs">${tabs.map(([k, n]) => `<button data-v="${k}" class="${recTab === k ? 'on' : ''}">${n}</button>`).join('')}</div>${body}`;
    $('#rcBack').onclick = () => { renderHub(); show('hub'); };
    $$('#recTabs button').forEach((b) => (b.onclick = () => { recTab = b.dataset.v; renderRecords(); }));
    $$('#scopeSeg button').forEach((b) => (b.onclick = () => { recScope = b.dataset.v; renderRecords(); }));
  }

  // ================= HIGHLIGHT REEL =================
  let reelField = null, reelIdx = 0, reelOn = false;
  function openReel() {
    sync();
    const list = (S.reel || []).slice().sort((a, b) => (a.year - b.year) || 0);
    if (!list.length) { toast('No highlights yet — big plays from your games land here'); return; }
    show('reel');
    if (!reelField) { reelField = new GI.Field($('#rfield')); reelField.onSfx = (n) => sfx(n); $('#reel').addEventListener('click', (e) => { if (e.target.closest('button')) return; if (reelField.anim) reelField.finish(); }); }
    reelIdx = 0; reelOn = true;
    $('#reelDone').onclick = () => { reelOn = false; renderHub(); show('hub'); };
    $('#reelNext').onclick = () => { if (reelField.anim) reelField.finish(); };
    playReel(list);
  }
  async function playReel(list) {
    while (reelOn && reelIdx < list.length) {
      const c = list[reelIdx];
      const teams = { home: SN.teamObj(S, c.home), away: SN.teamObj(S, c.away) };
      const G = { user: c.user, teams, phase: 'play', poss: c.res.side, ballOn: c.res.start, toGo: c.res.toGo || 10, down: c.res.down || 1, twoPt: false, kickTeam: c.res.side };
      reelField.resize();
      reelField.setTeams(teams[c.user], teams[c.user === 'home' ? 'away' : 'home']);
      reelField.setVenue(c.venue || GI.venueOf(c.home, S), 'classic', 85, c.venue && c.venue.neutral ? null : teams.home);
      reelField.setWeather(c.weather || 'clear');
      reelField.speed = 0.85;
      $('#reelCap').innerHTML = `<span class="label">${reelIdx + 1} / ${list.length} · Year ${c.year} ${esc(c.label || '')} · vs ${T(c.opp).abbr}</span><b>${esc(c.text.replace(/^[A-Z]{2,4}: /, ''))}</b>`;
      try { reelField.showFormation(G); await U.sleep(500); await reelField.runPlay(c.res, G); } catch (e) { console.error(e); }
      await U.sleep(900);
      reelIdx++;
    }
    if (reelOn) { $('#reelCap').innerHTML = '<b>That\'s the season! 🏆</b>'; }
  }

  Object.assign(U, { renderHub, renderDraft, renderRoster, renderOffice, modsHTML, openRecords, openReel, openTrade, awardsNight });
})();
