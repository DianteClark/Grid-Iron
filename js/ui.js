/* Grid Iron — screens, controls and game flow */
(function () {
  const GI = window.GI;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const other = GI.util.other;
  const sfx = (n) => GI.audio && GI.audio.play(n);
  const SN = GI.season;

  let G = null, S = null, field = null, busy = false, autoTimer = null;
  const P = GI.prefs.get();
  const setup = { mode: 'quick', home: P.home !== undefined ? P.home : true, qMin: P.qMin || 5, diff: P.diff || 'pro', weeks: P.weeks || 12, user: P.user != null ? P.user : null, opp: null, step: 'user' };
  let speedIdx = P.speedIdx || 0;
  const SPEEDS = [1, 2, 99], SPEED_LABEL = ['1×', '2×', '⏭'];
  const ord = (n) => ['', '1st', '2nd', '3rd', '4th'][n] || n + 'th';
  const tilt = (i) => ((i * 37) % 7 - 3) * 0.6;
  const T = (i) => GI.TEAMS[i];

  // ---------- theme ----------
  function applyTheme() {
    const t = GI.prefs.get().theme || 'auto';
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  }
  applyTheme();

  // ---------- helmets (side view sticker, team logo decal) ----------
  let helmId = 0;
  const STAR = 'M0-120 35-48 115-37 57 19 71 99 0 61-71 99-57 19-115-37-35-48z';
  const H_SHELL = 'M18 74C8 58 8 30 30 16C46 6 74 4 92 14C104 21 110 32 110 42V44C110 46 108 47 106 47H86C82 47 80 50 80 54V60C80 63 82 65 85 66L96 69C99 70 100 73 98 76C96 80 90 82 84 82L40 84C30 84 22 81 18 74Z';
  const H_MASK = 'M96 48C106 48 114 50 117 56C119 64 118 72 113 78C108 78 100 76 92 72M88 58C100 58 110 59 118 62M105 49C106 58 106 68 104 77';
  const H_STRIPE = 'M20 54C17 32 34 14 60 10C80 8 98 14 106 26';
  function helmet(t, cls, opts) { return GI.crestSVG(t, cls, opts); } // team identity = shield crest
  GI.helmetSVG = helmet;
  $('#logoHelmet').innerHTML = GI.chunkyHelmetSVG('#ff5a4e', '#1d3557', 'hero-helm');

  // ---------- play icons ----------
  const A = 'stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"';
  const dot = (x, y) => `<circle cx="${x}" cy="${y}" r="3.2" fill="currentColor"/>`;
  const ICON = {
    in_run: `${dot(16, 19)}<path d="M16 15V4M12 8l4-4 4 4" ${A}/>`,
    out_run: `${dot(8, 19)}<path d="M8 15c0-4 4-5 12-5v-6M16 8l4-4 4 4" ${A}/>`,
    short: `${dot(16, 19)}<path d="M16 15l6-6" ${A} stroke-dasharray="3 3"/><path d="M18 8h5v5" ${A}/>`,
    long: `${dot(10, 19)}<path d="M10 15C10 6 18 3 25 3" ${A} stroke-dasharray="3 3"/><path d="M21 1l4 2-3 4" ${A}/>`,
    trick: `${dot(16, 19)}<path d="M16 15c-6 0-6-7 0-7s6 7 0 7M16 8V2" ${A}/>`,
    man: `${dot(9, 12)}${dot(23, 12)}<path d="M13 12h6" ${A}/>`,
    zone: `<path d="M5 18c3-9 19-9 22 0" ${A} stroke-dasharray="3 3"/>${dot(16, 8)}`,
    deep: `<path d="M3 20C6 4 26 4 29 20" ${A}/>${dot(16, 18)}`,
    press: `${dot(11, 12)}${dot(21, 12)}<path d="M16 5v14" ${A}/>`,
    blitz_in: `<path d="M16 2v15M11 12l5 6 5-6" ${A}/>`,
    blitz_out: `<path d="M4 3l8 13M28 3l-8 13M9 16h4v-4M23 16h-4v-4" ${A}/>`,
    punt: `<path d="M6 20l10-6M16 14C18 5 26 4 28 8" ${A}/>`,
    fg: `<path d="M10 4v8h12V4M16 12v9" ${A}/>`,
    dice: `<rect x="7" y="4" width="18" height="16" rx="4" ${A}/>${dot(12, 9)}${dot(20, 15)}`,
  };
  const icon = (id) => `<svg viewBox="0 0 32 22" aria-hidden="true">${ICON[id] || ''}</svg>`;

  // ---------- screens / overlays ----------
  function show(id) {
    $$('.screen').forEach((s) => s.classList.toggle('on', s.id === id));
    closePop();
    if (id === 'game') {
      if (field) requestAnimationFrame(() => { field.resize(); updateInsets(); });
      GI.audio.scene('game', G ? G.crowd.level : 0);
    } else GI.audio.scene('menu');
    const el = $('#' + id); if (el) el.scrollTop = 0;
  }
  function toast(msg, ms) {
    $$('.toast').forEach((t) => t.remove());
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms || 2200);
  }
  function modal(html, onReady) {
    $('#sheet').innerHTML = html;
    $('#modal').classList.add('on');
    $('#sheet').scrollTop = 0;
    if (onReady) onReady($('#sheet'));
  }
  function closeModal() { $('#modal').classList.remove('on'); }
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' && !$('#modal').dataset.lock) closeModal(); });
  document.addEventListener('click', (e) => { if (e.target.closest('button')) sfx('tap'); }, true);
  const closeBtn = '<button class="iconbtn" id="mx" aria-label="Close">✕</button>';

  // ---------- title ----------
  function refreshTitle() {
    const g = GI.load();
    $('#btnResume').hidden = !(g && !g.over && g.v === 1);
    S = SN.load();
    if (S) {
      const ut = T(S.user);
      const status = { draft: 'Draft day', camp: 'Spring training', offseason: 'Offseason' }[S.phase] || (SN.current(S).label + (S.phase === 'playoffs' ? ' · Playoffs' : ''));
      $('#seasonCard').innerHTML = `<button class="sticker scard" id="btnContinue">${helmet(ut, 'md')}<span><b>Continue Franchise · Year ${S.year}</b><small>${ut.name} · ${SN.recStr(S.rec[S.user])} · ${status}</small></span><span class="go">▶</span></button>`;
      $('#btnContinue').onclick = () => { S = SN.load(); renderHub(); show('hub'); };
    } else $('#seasonCard').innerHTML = '';
  }
  $('#btnQuick').onclick = () => { setup.mode = 'quick'; setup.step = 'user'; setup.opp = null; renderPick(); show('pick'); };
  $('#btnSeason').onclick = () => {
    const go = () => { setup.mode = 'season'; setup.step = 'user'; renderPick(); show('pick'); };
    if (SN.load()) {
      modal(`<h2>Start a new franchise?</h2><p class="muted">Your current franchise will be replaced.</p><div style="display:grid;gap:10px"><button class="btn red block" id="ns1">Start New Franchise</button><button class="btn ghost block" id="ns2">Keep My Franchise</button></div>`, (s) => {
        s.querySelector('#ns1').onclick = () => { closeModal(); go(); };
        s.querySelector('#ns2').onclick = closeModal;
      });
    } else go();
  };
  $('#btnResume').onclick = () => { const g = GI.load(); if (g) { G = g; if (G.seasonGame) S = SN.load(); enterGame(); } };
  $('#btnHelp').onclick = () => showHelp();
  $('#btnSettings').onclick = () => showSettings();
  $('#btnTrophies').onclick = () => showTrophies();

  // ---------- team pick ----------
  $$('#settings .seg').forEach((seg) => {
    const key = seg.dataset.set;
    const cur = key === 'home' ? (setup.home ? '1' : '0') : String(setup[key]);
    seg.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('on', b.dataset.v === cur);
      b.onclick = () => {
        seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
        const v = b.dataset.v;
        setup[key] = key === 'home' ? v === '1' : key === 'qMin' || key === 'weeks' ? +v : v;
        GI.prefs.set({ home: setup.home, qMin: setup.qMin, diff: setup.diff, weeks: setup.weeks });
      };
    });
  });
  $('#pickBack').onclick = () => {
    if (setup.step === 'opp') { setup.step = 'user'; renderPick(); return; }
    refreshTitle(); show('title');
  };
  function renderPick() {
    const opp = setup.step === 'opp';
    $('#pickTitle').textContent = opp ? 'Pick your opponent' : setup.mode === 'season' ? 'Pick your franchise' : 'Pick your team';
    $('#settings').style.display = opp ? 'none' : '';
    $$('#settings [data-only]').forEach((r) => (r.style.display = r.dataset.only === setup.mode ? '' : 'none'));
    const sel = opp ? setup.opp : setup.user;
    let html = '';
    if (opp || setup.mode === 'season') html += `<button class="tcard ${sel === -1 ? 'sel' : ''}" data-i="-1" style="transform:rotate(${tilt(99)}deg)">${helmet({ c1: '#1d1d1f', c2: '#ffc93c', abbr: '?', city: '', name: 'Random', glyph: 'dice' }, 'md')}<div class="nm">Random<br>${opp ? 'Opponent' : 'Team'}</div></button>`;
    GI.TEAMS.forEach((t, i) => {
      const dis = opp && i === setup.user;
      html += `<button class="tcard ${sel === i ? 'sel' : ''} ${dis ? 'dis' : ''}" data-i="${i}" style="transform:rotate(${tilt(i)}deg)">${setup.mode === 'season' ? '' : `<span class="ovr">${t.ovr}</span>`}${helmet(t, 'md')}<div class="nm">${t.city}<br>${t.name}</div></button>`;
    });
    $('#teamGrid').innerHTML = html;
    $$('#teamGrid .tcard').forEach((c) => (c.onclick = () => {
      const i = +c.dataset.i;
      if (opp) setup.opp = i; else setup.user = i;
      sfx('select');
      renderPick();
    }));
    const ready = opp ? setup.opp !== null : setup.user !== null;
    $('#pickDock').hidden = !ready;
    const lbl = setup.mode === 'season' ? 'Start Franchise ▶' : opp ? 'Game Day ▶' : 'Next: Opponent ▶';
    $('#pickNext').textContent = lbl;
    $('#pickNext').className = 'btn ' + (opp || setup.mode === 'season' ? 'green' : 'gold');
  }
  $('#pickNext').onclick = () => {
    if (setup.mode === 'season') {
      let me = setup.user;
      if (me === -1) { me = Math.floor(Math.random() * 32); toast(`🎲 You're the ${T(me).city} ${T(me).name}!`, 2400); }
      GI.prefs.set({ user: me });
      S = SN.create({ user: me, weeks: setup.weeks, qMin: setup.qMin, diff: setup.diff });
      GI.clearSave();
      sfx('horn');
      renderHub(); show('hub');
      return;
    }
    if (setup.step === 'user') {
      GI.prefs.set({ user: setup.user });
      setup.step = 'opp'; setup.opp = null; renderPick();
      $('#pick').scrollTop = 0;
      return;
    }
    let opp = setup.opp;
    if (opp === -1) { do { opp = Math.floor(Math.random() * 32); } while (opp === setup.user); }
    startPregame({ user: setup.user, opp, userHome: setup.home, qMin: setup.qMin, diff: setup.diff });
  };

  // ================= FRANCHISE HUB =================
  const money = (x) => SN.money(x);
  function renderHub() {
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
        <p class="muted">${S.draft.opening ? 'Every team starts empty. Rounds 1–3 must land your K/P, QB and LB, in any order. Round 4 is wide open.' : 'Worst record picks first. Fill open star slots or grab a backup.'}</p>
        ${cur ? `<p class="muted" style="margin:4px 0 0">On the clock: <b>Round ${cur.round}, pick ${cur.inRound}</b> — ${T(cur.team).city}</p>` : ''}
        <button class="btn green block" id="hubDraft" style="margin-top:12px">Enter the Draft Room ▶</button></div>`;
    } else if (S.phase === 'camp') {
      next = `<div class="sticker nextgame phase">
        <div class="row between"><span class="pill gold">Year ${S.year} · Spring Training</span><span class="label">Gym Lv ${S.up.gym}</span></div>
        <h3>Pick a camp focus</h3>
        <p class="muted">Every star grows (or ages). Young stars can hit a ⚡ <b>breakthrough</b> and jump +8 to +15.</p>
        <div class="focusgrid">${Object.keys(SN.FOCUS).map((k) => `<button class="focus ${campFocus === k ? 'on' : ''}" data-focus="${k}"><b>${SN.FOCUS[k].name}</b><small>${SN.FOCUS[k].desc}</small></button>`).join('')}</div>
        <label class="intense"><input type="checkbox" id="campIntense" ${campIntense ? 'checked' : ''}> <span><b>Intense camp</b> (${money(3)}) — double gains, better breakthrough odds, small injury risk</span></label>
        <button class="btn green block" id="hubCamp" style="margin-top:12px">Run Spring Training ▶</button></div>`;
    } else if (S.phase === 'offseason') {
      const champ = S.champion != null ? T(S.champion) : null;
      const exp = (S.expiring || []).length;
      next = `${champ ? `<div class="sticker champ ${S.champion === S.user ? 'mine' : ''}"><div class="trophy">🏆</div>${helmet(champ, 'lg')}
        <h2>${S.champion === S.user ? 'IRON-BOWL CHAMPIONS!' : champ.city + ' ' + champ.name}</h2><p class="muted">${S.champion === S.user ? `Year ${S.year} belongs to ${ut.city}. The ${money(15)} purse is in the bank for the draft.` : `won the Year ${S.year} Iron-Bowl.`}</p></div>` : ''}
        <div class="sticker nextgame phase"><div class="row between"><span class="pill gold">Offseason</span><span class="label">Cash ${money(S.cash)}</span></div>
        <h3>Front office time</h3>
        <p class="muted">${exp ? `<b>${exp} contract${exp > 1 ? 's' : ''} expiring.</b> Re-sign or they walk. ` : ''}Upgrade your facilities, then head to the Year ${S.year + 1} draft (${Math.min(8, 4 + S.year)} rounds).</p>
        <div class="row" style="gap:10px;margin-top:12px"><button class="btn gold" style="flex:1" id="hubOffice">Front Office</button><button class="btn green" style="flex:1" id="hubAdvance">To the Draft ▶</button></div></div>`;
    } else {
      const c = SN.current(S);
      if (c.game) {
        const op = T(c.opp), orc = SN.recStr(S.rec[c.opp]);
        const seedTxt = S.bracket ? ` · #${S.bracket.seedOf[S.user]} vs #${S.bracket.seedOf[c.opp]}` : '';
        next = `<div class="sticker nextgame">
          <div class="row between"><span class="pill ${c.playoff ? 'red' : 'gold'}">${c.label}${seedTxt}</span><span class="label">${c.ironBowl ? 'Neutral site' : c.home ? 'Home' : 'Away'}</span></div>
          <div class="ng-mid">${helmet(ut, 'md')}<span class="ng-vs">${c.home || c.ironBowl ? 'VS' : 'AT'}</span>${helmet(op, 'md')}</div>
          <div class="ng-opp"><b>${op.city} ${op.name}</b><span class="muted">${orc} · ${SN.teamOvr(S, c.opp)} OVR · ${S.rosters[c.opp].stars.length} stars</span></div>
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
    $('#hubBody').innerHTML = `
      <div class="topbar" style="margin-bottom:0"><button class="iconbtn" id="hubBack" aria-label="Main menu">←</button><h2>Year ${S.year}</h2><span class="cashpill">💰 ${money(S.cash)}</span><button class="iconbtn" id="hubSet" aria-label="Settings">⚙</button></div>
      <div class="sticker hubteam" style="--tc:${ut.c1}">
        ${helmet(ut, 'lg')}
        <div class="ht-info"><span class="label">${ut.city}</span><h2>${ut.name}</h2>
          <div class="row" style="gap:6px;flex-wrap:wrap"><span class="pill">${SN.divName(S.user)}${gp ? ' · ' + ord(place) : ''}</span><span class="pill">${ovr} OVR</span>${streak ? `<span class="pill">${streak}</span>` : ''}${S.morale[S.user] ? `<span class="pill ${S.morale[S.user] > 0 ? 'green' : 'red'}">Morale ${S.morale[S.user] > 0 ? '+' : ''}${S.morale[S.user]}</span>` : ''}</div></div>
        <div class="ht-rec">${SN.recStr(r)}</div>
      </div>
      ${next}
      <div class="hubgrid">
        <button class="sticker hbtn" data-go="roster"><span>⭐</span>Roster</button>
        <button class="sticker hbtn" data-go="office"><span>🏢</span>Front Office</button>
        <button class="sticker hbtn" data-go="gazette"><span>📰</span>Gazette</button>
        <button class="sticker hbtn" data-go="standings"><span>📊</span>Standings</button>
        <button class="sticker hbtn" data-go="playoffs"><span>🏟️</span>Playoffs</button>
        <button class="sticker hbtn" data-go="schedule"><span>🗓️</span>Schedule</button>
      </div>
      <div class="sticker panel"><div class="row between"><h3>${SN.divName(S.user)}</h3><span class="label">W-L · PF-PA</span></div>
        ${div.map((i) => rowTeam(i)).join('')}</div>`;
    $('#hubBack').onclick = () => { refreshTitle(); show('title'); };
    $('#hubSet').onclick = () => showSettings();
    const on = (id, fn) => { const b = $('#' + id); if (b) b.onclick = fn; };
    on('hubPlay', () => startSeasonGame());
    on('hubSim', () => simWeek(true));
    on('hubSimRound', () => simWeek(false));
    on('hubDraft', () => { renderDraft(); show('draft'); });
    on('hubOffice', () => { officeTab = (S.expiring || []).length ? 'contracts' : 'upgrades'; renderOffice(); show('office'); });
    on('hubAdvance', () => {
      const exp = (S.expiring || []).length;
      const go = () => { SN.advanceToDraft(S); sfx('horn'); renderHub(); show('hub'); };
      if (exp) modal(`<h2>Let ${exp} star${exp > 1 ? 's' : ''} walk?</h2><p class="muted">Unsigned expiring contracts leave in free agency. Other teams can draft them.</p><div style="display:grid;gap:10px"><button class="btn red block" id="ad1">Let them walk</button><button class="btn ghost block" id="ad2">Back to contracts</button></div>`, (s) => {
        s.querySelector('#ad1').onclick = () => { closeModal(); go(); };
        s.querySelector('#ad2').onclick = () => { closeModal(); officeTab = 'contracts'; renderOffice(); show('office'); };
      });
      else go();
    });
    on('hubCamp', () => {
      const intense = $('#campIntense').checked;
      if (intense && S.cash < 3) { toast("Not enough cash for an intense camp"); return; }
      const paper = SN.runCamp(S, campFocus, intense);
      sfx('horn');
      showPaper(paper, true);
    });
    $$('#hubBody [data-focus]').forEach((b) => (b.onclick = () => { campFocus = b.dataset.focus; campIntense = $('#campIntense').checked; renderHub(); }));
    $$('#hubBody [data-go]').forEach((b) => (b.onclick = () => {
      const g = b.dataset.go;
      if (g === 'gazette') return showArchive();
      if (g === 'roster') { renderRoster(); show('roster'); return; }
      if (g === 'office') { renderOffice(); show('office'); return; }
      renderTables(g); show('tables');
    }));
  }
  let campFocus = 'offense', campIntense = false;
  function rowTeam(i, extra) {
    const t = T(i), r = S.rec[i];
    return `<div class="trow ${i === S.user ? 'me' : ''}">${helmet(t, 'xs')}<span class="tn2">${t.city} <b>${t.name}</b></span><span class="tr-rec">${SN.recStr(r)}</span><span class="tr-pf">${extra != null ? extra : `${r.pf}-${r.pa}`}</span></div>`;
  }
  function modsHTML() {
    const m = S.mods || {}, chips = [];
    if (m.morale) chips.push(`<span class="pill ${m.morale > 0 ? 'green' : 'red'}">Morale ${m.morale > 0 ? '+' : ''}${m.morale}</span>`);
    if (m.intel) chips.push('<span class="pill green">📂 Their POTW leaked</span>');
    if (m.film) chips.push('<span class="pill red">🎞️ They studied your POTW</span>');
    if (m.weather) chips.push(`<span class="pill blue">${GI.WEATHER[m.weather].icon} ${GI.WEATHER[m.weather].name}</span>`);
    if (m.crowdLevel) chips.push('<span class="pill gold">📣 Sold out</span>');
    if (m.starMeter) Object.keys(m.starMeter).forEach((id) => { const s = SN.allStars(S, S.user).find((x) => x.id === id); if (s) chips.push(`<span class="pill">${GI.shortName(s.name)} starts ${m.starMeter[id]}%</span>`); });
    SN.injuredFor(S, S.user).forEach(({ s, weeks }) => chips.push(`<span class="pill red">🚑 ${GI.POS[s.pos].label} ${GI.shortName(s.name)} (${weeks}w)</span>`));
    const b = S.rosters[S.user].bench;
    if (b) chips.push(`<span class="pill">🪑 Backup: ${GI.POS[b.pos].label} ${GI.shortName(b.name)}</span>`);
    return chips.length ? `<div class="modchips">${chips.join('')}</div>` : '';
  }
  function startSeasonGame() {
    const o = SN.gameOptions(S);
    const p = GI.prefs.get();
    o.potw = { off: p.potwOff || 'short', def: p.potwDef || 'zone' };
    startPregame(o, true);
  }
  function simWeek(mine) {
    $$('#hubBody .btn').forEach((b) => (b.disabled = true));
    toast(mine ? 'Simulating your game…' : 'Simulating the round…', 900);
    setTimeout(() => { const paper = SN.finishWeek(S, null); showPaper(paper, true); }, 60);
  }

  // ================= DRAFT ROOM =================
  let draftPos = 'ALL', draftSel = null, draftTicker = [];
  function renderDraft() {
    if (!S.draft) { renderHub(); show('hub'); return; }
    // CPU teams pick until it's your turn
    const made = SN.draftAdvance(S);
    if (made.length) draftTicker = made.concat(draftTicker).slice(0, 40);
    const d = S.draft, cur = SN.draftCur(S);
    const r = S.rosters[S.user];
    const must = SN.mustTake(S);
    const done = SN.draftDone(S);
    const slotsHTML = [...Array(8)].map((_, k) => { const s = r.stars[k]; return s ? `<span class="slot full" title="${s.name}">${GI.POS[s.pos].label}</span>` : '<span class="slot"></span>'; }).join('') + `<span class="slot bench ${r.bench ? 'full' : ''}">${r.bench ? GI.POS[r.bench.pos].label : '🪑'}</span>`;
    const tabs = ['ALL', 'KP', 'QB', 'RB', 'WR', 'TE', 'OL', 'LB', 'DL', 'S', 'CB'];
    let list = d.pool.slice();
    if (draftPos !== 'ALL') list = list.filter((p) => p.pos === draftPos);
    list.sort((a, b) => (b.claimed ? 1 : 0) - (a.claimed ? 1 : 0) || (b.est[0] + b.est[1]) - (a.est[0] + a.est[1]));
    list = list.slice(0, 60);
    const yourTurn = cur && cur.team === S.user;
    $('#draftBody').innerHTML = `
      <div class="topbar" style="margin-bottom:0"><button class="iconbtn" id="drBack" aria-label="Back">←</button><h2>${d.opening ? 'Opening Draft' : 'Year ' + S.year + ' Draft'}</h2><span class="cashpill">💰 ${money(S.cash)}</span></div>
      <div class="sticker clock ${yourTurn ? 'mine' : ''}">
        ${done ? '<h3>The draft is complete!</h3>' : `${helmet(T(cur.team), 'sm')}<div><span class="label">Round ${cur.round} · Pick ${cur.inRound} · #${(cur.round - 1) * 32 + cur.inRound} overall</span><h3>${yourTurn ? "You're on the clock!" : T(cur.team).city + ' picking…'}</h3></div>`}
      </div>
      <div class="sticker panel"><div class="row between"><span class="label">Your star slots</span><span class="label">${r.stars.length}/8 + backup</span></div><div class="slots">${slotsHTML}</div>
        ${must ? `<p class="mustnote">Rounds 1–3: you still need a <b>${must.map((x) => GI.POS[x].full).join(', ')}</b>.</p>` : ''}</div>
      ${done ? `<button class="btn green block" id="drFinish">Read the Draft Gazette ▶</button>` : `
      <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn gold small" id="drAuto1" ${yourTurn ? '' : 'disabled'}>🎯 Auto-pick</button><button class="btn ghost small" id="drAutoAll">⏩ Auto-draft the rest</button><button class="btn ghost small" id="drPass" ${yourTurn && !must ? '' : 'disabled'}>Pass</button></div>
      <div class="postabs">${tabs.map((t) => `<button class="${draftPos === t ? 'on' : ''}" data-pos="${t}">${t === 'ALL' ? 'All' : GI.POS[t].label}</button>`).join('')}</div>
      <div class="plist">${list.map((p) => {
        const chk = SN.canDraft(S, S.user, p);
        return `<button class="prow ${chk.ok ? '' : 'no'} ${draftSel === p.id ? 'sel' : ''}" data-pid="${p.id}">
          <span class="pp-pos">${GI.POS[p.pos].label}</span>
          <span class="pr-main"><b>${p.name}${p.claimed ? ' <i class="tag">★ Scouted</i>' : ''}${p.sparkShown ? ' <i class="tag spark">⚡</i>' : ''}</b><small>${p.rookie ? 'Rookie' : 'Veteran'} · age ${p.age} · ${p.rookie ? p.college : (p.yrsPro || 0) + ' yrs pro'}</small></span>
          <span class="pr-est"><b>${p.est[0]}–${p.est[1]}</b><small>Pot ${p.gradeShown} · ${money(p.salary)}</small></span>
        </button>`;
      }).join('')}</div>`}
      ${draftTicker.length ? `<div class="sticker panel"><div class="label">Recent picks</div><ul class="ticklist">${draftTicker.slice(0, 12).map((x) => `<li>${helmet(T(x.team), 'xs')}<span>R${x.round}.${x.inRound} ${T(x.team).abbr} — ${GI.POS[x.p.pos].label} ${x.p.name} <i class="muted">(${x.p.est[0]}–${x.p.est[1]})</i></span></li>`).join('')}</ul></div>` : ''}`;
    $('#drBack').onclick = () => { renderHub(); show('hub'); };
    const fin = $('#drFinish'); if (fin) fin.onclick = () => { const p = SN.finishDraft(S); showPaper(p, true); };
    $$('#draftBody [data-pos]').forEach((b) => (b.onclick = () => { draftPos = b.dataset.pos; renderDraft(); }));
    $$('#draftBody [data-pid]').forEach((b) => (b.onclick = () => showProspect(b.dataset.pid)));
    const a1 = $('#drAuto1'); if (a1) a1.onclick = () => { const p = SN.autoChoice(S); if (p) doDraft(p.id); };
    const aa = $('#drAutoAll'); if (aa) aa.onclick = () => { const made = SN.draftAuto(S); draftTicker = made.reverse().concat(draftTicker).slice(0, 40); sfx('select'); renderDraft(); };
    const ps = $('#drPass'); if (ps) ps.onclick = () => { if (SN.draftPass(S)) renderDraft(); };
  }
  function showProspect(pid) {
    const p = S.draft.pool.find((x) => x.id === pid);
    if (!p) return;
    const chk = SN.canDraft(S, S.user, p);
    const cur = SN.draftCur(S);
    const yourTurn = cur && cur.team === S.user;
    const slot = SN.slotFor(S, S.user, p.pos);
    const bar = (lbl, v, txt) => `<div class="sbar"><span>${lbl}</span><div><i style="width:${v}%"></i></div><b>${txt}</b></div>`;
    const fuzz = (v) => (S.up.scouts >= 3 ? Math.round(v / 10) * 10 + '±5' : v >= 75 ? 'High' : v >= 55 ? 'Mid' : 'Low');
    modal(`<div class="row between"><h2>${p.name}</h2>${closeBtn}</div>
      <p class="muted" style="margin-top:-4px">${GI.POS[p.pos].full} · ${p.rookie ? 'Rookie from ' + p.college : 'Veteran'} · age ${p.age}</p>
      <div class="pcard"><div class="pc-big"><span class="label">Scouted rating</span><b>${p.est[0]}–${p.est[1]}</b><small>Your scouts' range (Scouting Lv ${S.up.scouts}). The true number shows once he's yours.</small></div>
        <div class="pc-big"><span class="label">Potential</span><b>${p.gradeShown}</b><small>${p.sparkShown ? '⚡ Breakthrough spark spotted' : 'Ceiling estimate'}</small></div></div>
      ${bar('Clutch', p.clutch, fuzz(p.clutch))}${bar('Durability', p.dur, fuzz(p.dur))}${bar('Ego', p.ego, fuzz(p.ego))}
      <p class="muted" style="font-size:13px">${p.rookie ? `Rookie contract: ${3} years at ${money(p.salary)}/yr.` : `Contract: ${money(p.salary)}/yr.`} ${slot === 'bench' ? 'He would join as your <b>backup star</b> — his contract only starts when he plays.' : ''} Show-Me move: <b>${GI.SHOWME[p.pos].name}</b>.</p>
      ${yourTurn ? (chk.ok ? `<button class="btn green block" id="pdPick">Draft ${p.name.split(' ').pop()} ▶</button>` : `<p class="pill red" style="text-transform:none">${chk.why}</p>`) : '<p class="muted">Wait for your pick.</p>'}`, (s) => {
      s.querySelector('#mx').onclick = closeModal;
      const b = s.querySelector('#pdPick'); if (b) b.onclick = () => { closeModal(); doDraft(p.id); };
    });
  }
  function doDraft(pid) {
    const res = SN.draftPick(S, pid);
    if (!res.ok) { toast(res.why); return; }
    sfx('star'); GI.audio.buzz(40);
    const mid = (res.p.est[0] + res.p.est[1]) / 2;
    const verdict = res.reveal >= res.p.est[1] ? 'STEAL! 🔥' : res.reveal <= res.p.est[0] ? 'Bit of a reach…' : 'Right on target.';
    toast(`${GI.POS[res.p.pos].label} ${res.p.name}: true rating ${res.reveal} — ${verdict}${res.slot === 'bench' ? ' (backup)' : ''}`, 3200);
    draftTicker.unshift(S.draft.log[S.draft.log.length - 1]);
    renderDraft();
  }

  // ================= ROSTER =================
  function renderRoster() {
    const r = S.rosters[S.user], ut = T(S.user);
    const inj = {};
    SN.injuredFor(S, S.user).forEach(({ s, weeks }) => (inj[s.id] = weeks));
    const card = (s, bench) => `<div class="rcard ${inj[s.id] ? 'hurt' : ''}">
        <div class="rc-top"><span class="pp-pos">${GI.POS[s.pos].label}</span><span class="rc-nm"><b>${s.name}</b><small>#${s.num} · age ${s.age} · ${s.yrsPro ? s.yrsPro + (s.yrsPro === 1 ? ' yr pro' : ' yrs pro') : 'rookie'}${bench ? ' · BACKUP' : ''}</small></span><span class="rc-ovr">${s.rating}<small>OVR</small></span></div>
        <div class="rc-stats"><span>POT <b>${SN.grade(s.pot)}</b></span><span>CLU <b>${s.clutch}</b></span><span>DUR <b>${s.dur}</b></span><span>EGO <b>${s.ego}</b></span></div>
        <div class="rc-foot"><span class="muted">${GI.SHOWME[s.pos].name} · ${money(s.contract.salary)}/yr · ${s.contract.active ? s.contract.years + ' yr' + (s.contract.years === 1 ? '' : 's') + ' left' : 'contract starts when he plays'}</span>
          ${inj[s.id] ? `<span class="pill red">Out ${inj[s.id] >= 6 ? 'season' : inj[s.id] + 'w'}</span>` : ''}</div>
        <div class="rc-act">${!bench && r.bench && (r.bench.pos === s.pos) ? `<button class="btn ghost small" data-swap="${s.id}">⇄ Swap with backup</button>` : ''}<button class="btn ghost small" data-rel="${s.id}">Release</button></div>
      </div>`;
    $('#rosterBody').innerHTML = `<div class="topbar" style="margin-bottom:0"><button class="iconbtn" id="roBack">←</button><h2>${ut.name} Roster</h2></div>
      <div class="sticker panel"><div class="row between"><span class="label">Stars ${r.stars.length}/8 · Payroll ${money(SN.salaryTotal(S, S.user))}/yr</span><span class="label">${SN.teamOvr(S, S.user)} OVR</span></div>
      <p class="muted" style="font-size:13px;margin:6px 0 0">Positions without a star are played by generic players. Your one backup star sits until a starter at his position gets hurt — his contract clock only starts once he plays.</p></div>
      <div class="rgrid">${r.stars.map((s) => card(s)).join('')}${r.bench ? card(r.bench, true) : '<div class="rcard empty">🪑 No backup star. Draft one once your 8 slots are full.</div>'}</div>
      <div class="sticker panel"><h3>Staff</h3><div class="coach">${['hc', 'oc', 'dc', 'stc'].map((k) => { const c = r.coaches[k]; return `<div><span class="muted" style="font-size:11px">${c.role}</span><b>${c.name}</b>${c.rating} rtg${c.style ? ' · ' + (GI.OC_STYLES[c.style] || GI.DC_STYLES[c.style]) : ''}</div>`; }).join('')}</div></div>`;
    $('#roBack').onclick = () => { renderHub(); show('hub'); };
    $$('#rosterBody [data-swap]').forEach((b) => (b.onclick = () => { if (SN.swapBench(S, b.dataset.swap)) { toast('Swapped. The backup is now a starter and his contract is active.'); renderRoster(); } }));
    $$('#rosterBody [data-rel]').forEach((b) => (b.onclick = () => {
      const s = SN.allStars(S, S.user).find((x) => x.id === b.dataset.rel);
      modal(`<h2>Release ${s.name}?</h2><p class="muted">He becomes a free agent and joins the next draft pool. You stop paying his ${money(s.contract.salary)}/yr.</p><div style="display:grid;gap:10px"><button class="btn red block" id="rl1">Release</button><button class="btn ghost block" id="rl2">Keep him</button></div>`, (m) => {
        m.querySelector('#rl1').onclick = () => { SN.release(S, s.id); closeModal(); renderRoster(); };
        m.querySelector('#rl2').onclick = closeModal;
      });
    }));
  }

  // ================= FRONT OFFICE =================
  let officeTab = 'upgrades';
  function renderOffice() {
    const tabs = [['upgrades', 'Upgrades'], ['finances', 'Finances'], ['contracts', 'Contracts'], ['trophies', 'Trophies']];
    let body = '';
    if (officeTab === 'upgrades') {
      body = Object.keys(SN.UPGRADES).map((k) => {
        const u = SN.UPGRADES[k], lv = S.up[k], cost = SN.upgradeCost(S, k);
        return `<div class="sticker upcard"><div class="up-ic">${u.icon}</div><div class="up-main"><b>${u.name}</b><div class="lvl">${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= lv ? 'on' : ''}"></i>`).join('')}</div><small>${u.desc.filter(Boolean).join(' · ')}</small></div>
          ${cost ? `<button class="btn ${S.cash >= cost ? 'gold' : 'ghost'} small" data-up="${k}" ${S.cash >= cost ? '' : 'disabled'}>Lv ${lv + 1} · ${money(cost)}</button>` : '<span class="pill green">MAX</span>'}</div>`;
      }).join('') + `<p class="muted" style="font-size:12.5px">Each upgrade level adds ${money(0.5)}/yr in upkeep. Stadium levels also lift ticket revenue and base morale.</p>`;
    } else if (officeTab === 'finances') {
      const rep = S.fin.reports[0];
      body = `<div class="sticker panel"><h3>This year so far</h3>
        <div class="fin"><span>Cash on hand</span><b>${money(S.cash)}</b></div>
        <div class="fin"><span>Ticket sales</span><b>${money(S.fin.tickets)}</b></div>
        <div class="fin"><span>Playoff gates</span><b>${money(S.fin.playoffs)}</b></div>
        <div class="fin"><span>Bonuses</span><b>${money(S.fin.bonus)}</b></div>
        <div class="fin"><span>Payroll (due at season end)</span><b>${money(SN.salaryTotal(S, S.user))}</b></div>
        <div class="fin"><span>TV deal (paid at season end)</span><b>${money(30)}</b></div>
        <p class="muted" style="font-size:12.5px">Win the Iron-Bowl for a ${money(15)} purse; reaching it pays ${money(4)}. Sellouts and home playoff games bring in extra gate money.</p></div>
        ${rep ? `<div class="sticker panel"><h3>Year ${rep.year} books</h3>
        <div class="fin"><span>Revenue</span><b>${money(rep.rev)}</b></div><div class="fin"><span>Expenses</span><b>${money(rep.exp)}</b></div><div class="fin"><span>Ended with</span><b>${money(rep.cash)}</b></div></div>` : ''}`;
    } else if (officeTab === 'contracts') {
      const exp = (S.expiring || []).map((id) => SN.allStars(S, S.user).find((x) => x.id === id)).filter(Boolean);
      body = exp.length ? exp.map((s) => `<div class="sticker upcard"><span class="pp-pos">${GI.POS[s.pos].label}</span><div class="up-main"><b>${s.name}</b><small>${s.rating} OVR · age ${s.age} · ego ${s.ego} · asks ${money(s.ask)}/yr</small></div>
          <div class="ctr"><button class="btn green small" data-rs="${s.id}" data-y="1">1 yr</button><button class="btn green small" data-rs="${s.id}" data-y="2">2 yrs</button><button class="btn green small" data-rs="${s.id}" data-y="3">3 yrs</button><button class="btn ghost small" data-let="${s.id}">Let go</button></div></div>`).join('')
        : `<div class="sticker panel"><p class="muted" style="margin:0">${S.phase === 'offseason' ? 'All contracts are settled.' : 'Contract decisions happen in the offseason. Rookie deals last 3 years.'}</p></div>`;
    } else {
      let t = [];
      try { t = JSON.parse(localStorage.getItem('gridiron_trophies') || '[]'); } catch (e) {}
      body = `<div class="sticker panel"><h3>🏆 Trophy room</h3>${t.length ? t.map((x) => `<div class="troph">${helmet(T(x.team), 'sm')}<span><b>${x.kind}</b><small>Year ${x.year} · ${T(x.team).name} · ${x.rec}</small></span><span class="cup">🏆</span></div>`).join('') : '<p class="muted">No hardware yet. Win the Iron-Bowl to fill this shelf.</p>'}</div>
        ${S.history.length ? `<div class="sticker panel"><h3>Past champions</h3>${S.history.map((h) => `<div class="troph small">${helmet(T(h.champ), 'xs')}<span>Year ${h.year}: <b>${T(h.champ).name}</b></span><span class="muted">you went ${h.rec}</span></div>`).join('')}</div>` : ''}`;
    }
    $('#officeBody').innerHTML = `<div class="topbar" style="margin-bottom:0"><button class="iconbtn" id="ofBack">←</button><h2>Front Office</h2><span class="cashpill">💰 ${money(S.cash)}</span></div>
      <div class="seg" id="ofTabs">${tabs.map(([k, n]) => `<button data-v="${k}" class="${k === officeTab ? 'on' : ''}">${n}${k === 'contracts' && (S.expiring || []).length ? ' •' : ''}</button>`).join('')}</div>${body}`;
    $('#ofBack').onclick = () => { renderHub(); show('hub'); };
    $$('#ofTabs button').forEach((b) => (b.onclick = () => { officeTab = b.dataset.v; renderOffice(); }));
    $$('#officeBody [data-up]').forEach((b) => (b.onclick = () => { if (SN.upgrade(S, b.dataset.up)) { sfx('star'); toast(`${SN.UPGRADES[b.dataset.up].name} upgraded!`); renderOffice(); } }));
    $$('#officeBody [data-rs]').forEach((b) => (b.onclick = () => { SN.resign(S, b.dataset.rs, +b.dataset.y); sfx('select'); renderOffice(); }));
    $$('#officeBody [data-let]').forEach((b) => (b.onclick = () => { SN.release(S, b.dataset.let); renderOffice(); }));
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
        S.bracket.rounds.forEach((rd, k) => {
          body += `<div class="sticker panel"><h3>${SN.ROUND_NAMES[k]}</h3>${rd.map((g) => gameRow(g, true)).join('')}</div>`;
        });
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
    return `<div class="grow">${side(g.a, g.as, aw)}<span class="at">@</span>${side(g.h, g.hs, hw)}${res}${g.ot ? '<small class="muted">OT</small>' : ''}</div>`;
  }

  // ================= THE GAZETTE =================
  let paperFrom = 'hub';
  function showPaper(paper, fresh) {
    paperFrom = fresh ? 'hub' : 'archive';
    $('#gazette').innerHTML = gazetteHTML(paper);
    show('paper');
    const gz = $('#gazette');
    gz.classList.remove('spin'); void gz.offsetWidth; gz.classList.add('spin');
    sfx('paper');
    const btn = $('#paperNext');
    btn.disabled = true;
    btn.textContent = fresh ? 'Continue ▶' : 'Back';
    const needChoice = () => fresh && paper.event && paper.event.choices && !paper.event.chosen;
    setTimeout(() => { if (!needChoice()) btn.disabled = false; }, fresh ? 1800 : 300);
    if (needChoice()) btn.textContent = 'Make your call above ↑';
    const bind = () => $$('#gazette [data-choice]').forEach((b) => (b.onclick = () => {
      SN.resolveChoice(S, paper, b.dataset.choice);
      sfx('select');
      $('#gazette').innerHTML = gazetteHTML(paper);
      btn.textContent = 'Continue ▶';
      setTimeout(() => (btn.disabled = false), 400);
    }));
    bind();
    btn.onclick = () => { renderHub(); show('hub'); if (paperFrom === 'archive') showArchive(); };
  }
  function gazetteHTML(p) {
    const left = p.left != null ? T(p.left) : null, right = p.right != null ? T(p.right) : null;
    const photo = left && right ? `<figure class="photo"><div class="halftone">${helmet(left, 'ph')}<span class="boom">💥</span>${helmet(right, 'ph', { flip: true })}</div>
      <figcaption>${p.caption ? p.caption : p.potw ? 'PLAY OF THE WEEK — ' + p.potw.text.replace(/^[A-Z]{2,4}: /, '') : `${left.name} and ${right.name} collide.`}</figcaption></figure>` : '';
    const ev = p.event;
    let evHTML = '';
    if (ev) {
      evHTML = `<div class="extra k-${ev.kind}"><span class="xtag">EXTRA! · ${ev.tag}</span><h3>${ev.title}</h3><p>${ev.body}</p>`;
      if (ev.choices && !ev.chosen) evHTML += `<div class="choices">${ev.choices.map((c) => `<button class="choice" data-choice="${c.id}"><b>${c.label}</b><small>${c.desc}</small></button>`).join('')}</div>`;
      else if (ev.effect) evHTML += `<p class="effect">➜ ${ev.effect}</p>`;
      evHTML += '</div>';
    }
    const scores = (p.scores || []).map((g) => `<li><span class="${g.hs < g.as ? 'w' : ''}">${T(g.a).abbr} ${g.as}</span> @ <span class="${g.hs > g.as ? 'w' : ''}">${T(g.h).abbr} ${g.hs}</span>${g.ot ? ' <i>OT</i>' : ''}</li>`).join('');
    const inj = (p.injuries || []).length ? p.injuries.map((i) => `<li class="${i.mine ? 'mine' : ''}">${i.text}</li>`).join('') : '<li>A clean bill of health around the league.</li>';
    const div = (p.division || []).map((d) => `<li class="${S && d.i === S.user ? 'mine' : ''}"><span>${T(d.i).city} ${T(d.i).name}</span><b>${d.rec}</b></li>`).join('');
    const notes = [p.userPlayoff, p.champion != null ? `🏆 ${T(p.champion).city} ${T(p.champion).name} are your Iron-Bowl champions.` : null].filter(Boolean).map((x) => `<p class="note">${x}</p>`).join('');
    return `<header class="mast"><div class="mast-top"><span>Vol. ${p.year}</span><span>${p.label}</span><span>25¢</span></div>
        <h1>The Grid-Iron Gazette</h1><div class="mast-rule">★ ALL THE FOOTBALL THAT'S FIT TO PRINT ★</div></header>
      <h2 class="headline">${p.headline || 'QUIET WEEK AROUND THE LEAGUE'}</h2>
      ${p.score ? `<div class="scoreline">${p.score}</div>` : ''}
      ${p.sub ? `<p class="deck">${p.sub}</p>` : ''}
      ${photo}${notes}${evHTML}
      ${(p.sections || []).length ? `<div class="secs">${p.sections.filter((x) => x.items && x.items.length).map((x) => `<section><h4>${x.title}</h4><ul class="inj">${x.items.map((i) => `<li>${i}</li>`).join('')}</ul></section>`).join('')}</div>` : ''}
      ${(p.scores || []).length ? `<div class="cols">
        <section><h4>Injury Report</h4><ul class="inj">${inj}</ul></section>
        <section><h4>${S ? SN.divName(S.user) : 'Division'}</h4><ul class="div">${div}</ul></section>
      </div>
      <section class="league"><h4>Around the League</h4><ul class="scores">${scores}</ul></section>` : ''}
      <footer class="paper-foot">Printed in ${S ? T(S.user).city : 'Grid Iron'} · Read it all before kickoff</footer>`;
  }
  function showArchive() {
    if (!S || !S.news.length) { toast('No papers yet. Play a week first!'); return; }
    modal(`<div class="row between"><h2>📰 Gazette Archive</h2>${closeBtn}</div><div class="arch">${S.news.map((p, k) => `<button class="archrow" data-k="${k}"><span class="label">${p.label} · Vol. ${p.year}</span><b>${p.headline || ''}</b></button>`).join('')}</div>`, (s) => {
      s.querySelector('#mx').onclick = closeModal;
      s.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => { closeModal(); showPaper(S.news[+b.dataset.k], false); }));
    });
  }
  function showRoster() {
    const ut = T(S.user);
    const inj = {};
    SN.injuredFor(S, S.user).forEach(({ s, weeks }) => (inj[s.id] = weeks));
    modal(`<div class="row between"><h2>${ut.name} Stars</h2>${closeBtn}</div>
      <div class="roster">${ut.stars.map((s) => `<div class="rrow ${inj[s.id] ? 'hurt' : ''}"><span class="rpos">${GI.POS[s.pos].label}</span><span class="rname"><b>${s.name}</b><small>#${s.num} · ${GI.SHOWME[s.pos].name}</small></span><span class="rrat">${s.rating}</span>${inj[s.id] ? `<span class="pill red">Out ${inj[s.id] >= 6 ? 'season' : inj[s.id] + 'w'}</span>` : ''}</div>`).join('')}</div>
      <div class="label" style="margin-top:14px">Staff</div>
      <div class="coach">${['hc', 'oc', 'dc', 'stc'].map((k) => { const c = ut.coaches[k]; return `<div><span class="muted" style="font-size:11px">${c.role}</span><b>${c.name}</b>${c.rating} rtg${c.style ? ' · ' + (GI.OC_STYLES[c.style] || GI.DC_STYLES[c.style]) : ''}</div>`; }).join('')}</div>`,
    (s) => (s.querySelector('#mx').onclick = closeModal));
  }
  function showTrophies() {
    let t = [];
    try { t = JSON.parse(localStorage.getItem('gridiron_trophies') || '[]'); } catch (e) {}
    const hist = (SN.load() || {}).history || [];
    modal(`<div class="row between"><h2>🏆 Trophy Room</h2>${closeBtn}</div>
      ${t.length ? `<div class="trophies">${t.map((x) => `<div class="troph">${helmet(T(x.team), 'sm')}<span><b>${x.kind}</b><small>Season ${x.year} · ${T(x.team).name} · ${x.rec}</small></span><span class="cup">🏆</span></div>`).join('')}</div>` : '<p class="muted">No hardware yet. Win the Iron-Bowl to fill this shelf.</p>'}
      ${hist.length ? `<div class="label" style="margin-top:14px">Past champions</div>${hist.map((h) => `<div class="troph small">${helmet(T(h.champ), 'xs')}<span>Season ${h.year}: <b>${T(h.champ).name}</b></span><span class="muted">you went ${h.rec}</span></div>`).join('')}` : ''}
      <p class="muted" style="font-size:12.5px;margin-top:14px">Records rooms and milestone trophies arrive with the Legacy update.</p>`,
    (s) => (s.querySelector('#mx').onclick = closeModal));
  }

  // ================= PREGAME =================
  let pgSeason = false;
  function startPregame(o, season) {
    pgSeason = !!season;
    const p = GI.prefs.get();
    if (!o.potw) o.potw = { off: p.potwOff || 'short', def: p.potwDef || 'zone' };
    G = GI.newGame(o);
    G.seasonGame = !!season;
    renderPregame();
    show('pregame');
  }
  $('#pgBack').onclick = () => { if (pgSeason) { renderHub(); show('hub'); } else show('pick'); };
  function renderPregame() {
    const ut = G.teams[G.user], ot = G.teams[other(G.user)];
    const ur = GI.ratings(ut), orr = GI.ratings(ot);
    $('#pgTitle').textContent = G.label || 'Game Day';
    const side = (t, r, home, flip) => `<div class="side">${helmet(t, 'lg', { flip })}<div class="tn">${t.city}<br>${t.name}</div><div class="row" style="margin-top:8px;gap:6px;justify-content:center;flex-wrap:wrap"><span class="pill">${r.ovr} OVR</span>${pgSeason ? `<span class="pill">${SN.recStr(S.rec[t.idx])}</span>` : ''}<span class="pill ${home ? 'gold' : ''}">${home ? 'HOME' : 'AWAY'}</span></div></div>`;
    $('#pgMatch').innerHTML = side(ut, ur, G.user === 'home') + `<div class="vs">VS</div>` + side(ot, orr, G.user !== 'home', true);
    $('#pgMods').innerHTML = pgSeason ? modsHTML() : '';
    const W = GI.WEATHER[G.weather];
    const homeT = G.teams.home;
    $('#pgConds').innerHTML = `
      <div class="sticker cond"><div class="label">Weather</div><div class="big">${W.icon} ${W.name}</div><div class="muted" style="font-size:12.5px">${W.desc}</div></div>
      <div class="sticker cond"><div class="label">Crowd</div><div class="big">📣 ${G.crowd.name}</div><div class="muted" style="font-size:12.5px">${G.crowd.level >= 50 ? `Fires up ${homeT.abbr} stars, rattles the road offense` : 'Quiet day. Little home edge.'}</div></div>`;
    const rows = [['RUN', 'run'], ['PASS', 'pass'], ['LINE', 'ol'], ['RUN D', 'runD'], ['PASS D', 'passD'], ['RUSH', 'rush'], ['ST', 'st']];
    $('#pgBars').innerHTML = `<div class="row between"><span class="label">${ut.abbr}</span><span class="label">Tale of the tape</span><span class="label">${ot.abbr}</span></div>` +
      rows.map(([k, key]) => `<div class="bar"><span class="v">${ur[key]}</span><div class="track l"><div class="fill" style="width:${ur[key]}%;background:${ut.c1}"></div></div><span class="k">${k}</span><div class="track"><div class="fill" style="width:${orr[key]}%;background:${ot.c1}"></div></div><span class="v">${orr[key]}</span></div>`).join('');
    renderPotw();
    const oc = ot.coaches.oc, dc = ot.coaches.dc;
    const ocHint = { run: 'Lean on Blitz In / Blitz Out to stuff the run.', pass: 'Cover Long and Press take away the air game.', gadget: 'Man coverage kills trick plays.', balanced: 'No obvious tell. Mix it up.' }[oc.style];
    const dcHint = { blitz: 'Trick plays and outside runs punish the blitz.', cover: 'Inside runs and short passes eat soft coverage.', press: 'Go deep over the press.', balanced: 'No obvious tell. Watch their tendencies.' }[dc.style];
    $('#pgScout').innerHTML = `<h3>🔎 Scouting ${ot.abbr}</h3>
      <ul class="scout"><li><b>OC ${oc.name}</b> — ${GI.OC_STYLES[oc.style]}. ${ocHint}</li><li><b>DC ${dc.name}</b> — ${GI.DC_STYLES[dc.style]}. ${dcHint}</li>
      ${G.intel ? `<li class="intel">📂 <b>Leaked:</b> their Play of the Week is <b>${GI.playName(G.cpuPotw.off)}</b> on offense and <b>${GI.playName(G.cpuPotw.def)}</b> on defense.</li>` : '<li class="muted">They have their own Play of the Week too. You won\'t know it unless the Gazette gets a leak.</li>'}
      ${G.film ? '<li class="bad">🎞️ They studied your film — they\'ll sit on your offensive Play of the Week.</li>' : ''}
      <li class="muted">${G.diff === 'rookie' ? 'Rookie level: they won\'t adjust to you.' : 'They adapt. Call the same play too often and they\'ll sit on it.'}</li></ul>
      <div class="label" style="margin-top:14px">Your staff</div>
      <div class="coach">${['hc', 'oc', 'dc', 'stc'].map((k) => { const c = ut.coaches[k]; return `<div><span class="muted" style="font-size:11px">${c.role}</span><b>${c.name}</b>${c.rating} rtg${c.style ? ' · ' + (GI.OC_STYLES[c.style] || GI.DC_STYLES[c.style]) : ''}</div>`; }).join('')}</div>`;
    const sl = (t) => `<div class="starlist">${t.stars.map((s) => `<span class="schip ${s.injured ? 'hurt' : ''}"><b>${GI.POS[s.pos].label}</b>${GI.shortName(s.name)} <span class="muted">${s.injured ? 'OUT' : s.rating}</span></span>`).join('')}</div>`;
    $('#pgStars').innerHTML = `<h3>★ Star Players</h3><div class="label">${ut.name}</div>${sl(ut)}<div class="label" style="margin-top:12px">${ot.name}</div>${sl(ot)}`;
  }
  function renderPotw() {
    const hc = G.teams[G.user].coaches.hc;
    const grid = (list, cur, key) => `<div class="potw-grid">${list.map((p) => `<button data-k="${key}" data-v="${p.id}" class="${cur === p.id ? 'on' : ''}">${p.name}</button>`).join('')}</div>`;
    $('#pgPotw').innerHTML = `<h3>📌 Play of the Week</h3><p class="muted" style="margin:0 0 8px;font-size:13.5px">Coach ${hc.name.split(' ').pop()} drilled one offensive and one defensive play. Each gets a boost for <b>3 reps</b> per game — save them for big downs. Calling the same play 3+ snaps in a row gets you read.</p>
      <div class="label">Offense</div>${grid(GI.OFF_PLAYS, G.potw.off, 'off')}<div class="label" style="margin-top:10px">Defense</div>${grid(GI.DEF_PLAYS, G.potw.def, 'def')}`;
    $$('#pgPotw button').forEach((b) => (b.onclick = () => {
      G.potw[b.dataset.k] = b.dataset.v;
      GI.prefs.set(b.dataset.k === 'off' ? { potwOff: b.dataset.v } : { potwDef: b.dataset.v });
      renderPotw();
    }));
  }
  $('#btnKick').onclick = () => { sfx('horn'); enterGame(); };

  // ================= GAME =================
  function enterGame() {
    if (!field) {
      field = new GI.Field($('#field'));
      field.onSfx = (n) => sfx(n);
      $('#fieldwrap').addEventListener('click', () => { closePop(); if (field.anim) field.finish(); dismissBanner(); });
      window.addEventListener('resize', () => setTimeout(updateInsets, 60));
    }
    field.speed = SPEEDS[speedIdx];
    field.setTeams(G.teams[G.user], G.teams[other(G.user)]);
    field.setWeather(G.weather);
    G.crazyLog = G.crazyLog || {};
    G.potwLeft = G.potwLeft || { off: 3, def: 3 };
    busy = false;
    $('#ticker').innerHTML = `<span class="txt">${G.log[0] ? G.log[0].text : ''}</span>`;
    show('game');
    setTimeout(next, 60);
  }
  $('#ticker').onclick = () => showLog();

  function updateInsets() {
    if (!field) return;
    const gm = $('#game'), W = gm.clientWidth, H = gm.clientHeight;
    const sb = $('#sb'), rail = $('#rail');
    const ps = $('#psheet'), open = ps.classList.contains('open');
    const landscape = W > H * 1.08 && W >= 560;
    // portrait: rail sits under the scoreboard. landscape: rail docks top-right above the play sheet
    rail.style.top = (landscape ? sb.offsetTop : sb.offsetTop + sb.offsetHeight + 6) + 'px';
    const railBottom = rail.offsetTop + rail.offsetHeight;
    $('#railPop').style.top = (railBottom + 6) + 'px';
    ps.style.top = landscape ? (railBottom + 8) + 'px' : '';
    const st = $('#status');
    const ins = { top: landscape ? sb.offsetTop + sb.offsetHeight + 6 : railBottom + 6, bottom: 0, right: 0 };
    if (open) {
      if (landscape) ins.right = W - ps.offsetLeft + 4; else ins.bottom = H - ps.offsetTop + 4;
    } else if (!st.hidden) ins.bottom = H - st.offsetTop + 4;
    field.setInsets(ins);
  }
  function openSheet(on) { $('#psheet').classList.toggle('open', on); updateInsets(); }
  function setStatus(txt) {
    const st = $('#status');
    st.hidden = !txt; if (txt) st.textContent = txt;
    updateInsets();
  }

  function renderSB() {
    const sideHTML = (s, cls) => {
      const t = G.teams[s];
      const hasBall = (G.phase === 'play' || G.phase === 'pat') && G.poss === s;
      return `<div class="sb-team ${cls}">${helmet(t, 'sm', { flip: cls === 'r' })}<span class="poss ${hasBall ? 'on' : ''}"></span><span class="score">${G.score[s]}</span></div>`;
    };
    let dd;
    if (G.over) dd = 'FINAL';
    else if (G.phase === 'kickoff') dd = 'KICKOFF';
    else if (G.phase === 'pat') dd = 'EXTRA POINT';
    else if (G.twoPt) dd = '2-PT TRY';
    else dd = `${ord(G.down)} & ${G.ballOn + G.toGo >= 100 ? 'Goal' : G.toGo} · ${GI.spotLabel(G)}`;
    const W = GI.WEATHER[G.weather];
    $('#sb').innerHTML = `<button class="sb-btn" id="btnMenu" aria-label="Menu">☰</button>` + sideHTML('away', 'l') +
      `<div class="sb-mid"><div class="clk">${G.over ? 'FINAL' : GI.qLabel(G.q) + ' ' + GI.clockStr(G.clock)}</div><div class="dd">${dd} ${W.icon}</div></div>` +
      sideHTML('home', 'r') + `<button class="sb-btn" id="btnSpeed" aria-label="Animation speed">${SPEED_LABEL[speedIdx]}</button>`;
    $('#btnMenu').onclick = (e) => { e.stopPropagation(); showMenu(); };
    $('#btnSpeed').onclick = (e) => {
      e.stopPropagation();
      speedIdx = (speedIdx + 1) % SPEEDS.length;
      field.speed = SPEEDS[speedIdx];
      e.currentTarget.textContent = SPEED_LABEL[speedIdx];
      GI.prefs.set({ speedIdx });
      toast(['Normal speed', 'Fast speed', 'Skip animations'][speedIdx], 1000);
    };
  }

  // ---------- star rail: all 8 stars, always visible, no scrolling ----------
  const GROUP = { QB: 0, RB: 0, WR: 0, TE: 0, OL: 0, KP: 1, LB: 2, DL: 2, S: 2, CB: 2 };
  let popId = null;
  function renderRail() {
    const t = G.teams[G.user];
    const list = t.stars.slice().sort((a, b) => GROUP[a.pos] - GROUP[b.pos]);
    let last = -1, html = '';
    list.forEach((s) => {
      const g = GROUP[s.pos];
      if (last !== -1 && g !== last) html += '<span class="rsep"></span>';
      last = g;
      const full = s.meter >= 100 && !s.armed && !s.injured;
      const cls = s.injured ? 'inj' : s.armed ? 'armed' : full ? 'full' : '';
      html += `<button class="rb ${cls} g${g}" data-id="${s.id}" aria-label="${GI.POS[s.pos].label} ${s.name} ${s.meter}%"><span class="rr" style="--p:${s.injured ? 0 : s.meter}"><span>${GI.POS[s.pos].label}</span></span></button>`;
    });
    $('#rail').innerHTML = html;
    $$('#rail .rb').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); openPop(b.dataset.id); }));
    if (popId) openPop(popId, true);
  }
  function openPop(id, refresh) {
    const t = G.teams[G.user], s = t.stars.find((x) => x.id === id);
    if (!s) return;
    if (!refresh && popId === id) { closePop(); return; }
    popId = id;
    const sm = GI.SHOWME[s.pos];
    const list = sm.o || sm.d;
    const sideTxt = sm.o ? 'on offense' : sm.d ? 'on defense' : 'on kicks';
    const full = s.meter >= 100 && !s.injured;
    let action;
    if (s.injured) action = '<span class="pill red">Injured — out this game</span>';
    else if (s.armed) action = '<button class="btn red small" id="popArm">Disarm</button>';
    else if (full) action = '<button class="btn gold small" id="popArm">🔥 Arm ' + sm.name + '</button>';
    else action = `<span class="muted" style="font-size:12.5px">Fills when he makes plays. ${100 - s.meter}% to go.</span>`;
    $('#railPop').innerHTML = `<div class="pp-head"><span class="pp-pos">${GI.POS[s.pos].label}</span><span class="pp-nm"><b>${s.name}</b><small>#${s.num} · ${s.rating} OVR · ${s.armed ? 'ARMED' : full ? 'ON FIRE' : s.meter + '%'}</small></span><button class="iconbtn sm" id="popX" aria-label="Close">✕</button></div>
      <div class="pp-bar"><i style="width:${s.injured ? 0 : s.meter}%"></i></div>
      <p class="pp-move"><b>${sm.name}</b> — ${sm.desc}. Fires ${sideTxt}${list ? ' on ' + list.map(GI.playName).join(', ') : ''}.${GI.RETURN_POS.includes(s.pos) ? ` Also <b>${GI.KICK_MOVES.ret.name}</b> on kick & punt returns.` : ''}${GI.COVER_POS.includes(s.pos) ? ` Also <b>${GI.KICK_MOVES.cov.name}</b> on kick coverage.` : ''}</p>
      <div class="pp-act">${action}</div>
      ${full && !s.armed ? '<p class="pp-tip">Two bad plays in a row while on fire cools him to 70%.</p>' : ''}`;
    $('#railPop').hidden = false;
    $('#popX').onclick = (e) => { e.stopPropagation(); closePop(); };
    const arm = $('#popArm');
    if (arm) arm.onclick = (e) => {
      e.stopPropagation();
      if (GI.toggleArm(G, s.id)) {
        if (s.armed) { sfx('armed'); GI.audio.buzz(30); toast(`★ ${GI.shortName(s.name)} armed: ${sm.name}`, 1600); closePop(); }
        renderRail(); markFire();
        if (!busy && $('#psheet').classList.contains('open')) renderPanel(GI.need(G));
        GI.save(G);
      }
    };
  }
  function closePop() { popId = null; const p = $('#railPop'); if (p) p.hidden = true; }
  $('#railPop').addEventListener('click', (e) => e.stopPropagation());
  function markFire() {
    if (!field || !field.ctxPlay) return;
    ['home', 'away'].forEach((side) => {
      const t = G.teams[side];
      field.players.forEach((p) => {
        const ps = p.side === 'o' ? field.ctxPlay.offSide : other(field.ctxPlay.offSide);
        if (ps !== side) return;
        const s = t.stars.find((x) => x.role === p.role && !x.injured);
        if (s) { p.fire = s.meter >= 100 || s.armed; p.armed = s.armed; }
      });
    });
  }

  function armedFor(playId) {
    return G.teams[G.user].stars.some((s) => s.armed && !s.injured && GI.SHOWME[s.pos].o && GI.SHOWME[s.pos].o.includes(playId));
  }
  function playBtn(p, kind) {
    const isPotw = kind === 'off' ? G.potw.off === p.id : G.potw.def === p.id;
    const left = G.potwLeft[kind];
    const run = (kind === 'off' ? G.hist.off : G.hist.def).slice(0, 2);
    const warn = run.length === 2 && run[0] === p.id && run[1] === p.id;
    const arm = kind === 'off' && armedFor(p.id);
    return `<button class="play ${warn ? 'warn' : ''}" data-call="${p.id}">${isPotw && left > 0 ? `<span class="potw">POTW ×${left}</span>` : ''}${arm ? '<span class="arm">★</span>' : ''}${warn ? '<span class="pred">3rd in a row</span>' : ''}${icon(p.id)}<span>${p.name}</span><small>${p.tag}</small></button>`;
  }

  function renderPanel(n) {
    const cp = $('#callpanel');
    clearTimeout(autoTimer);
    if (n.kind === 'over') { openSheet(false); setStatus('Final whistle!'); return; }
    const ut = G.teams[G.user], ot = G.teams[other(G.user)];
    let html = null;
    if (n.kind === 'kickoff') {
      if (n.userKicks) {
        html = `<div class="cp-head"><span class="t">Kickoff</span><span class="pill">${ut.abbr} kicking</span></div>${kickTip('cov')}
          <div class="grid"><button class="play sp" data-act="kick" style="grid-column:span ${n.onsideOk ? 2 : 3}">${icon('punt')}<span>Kick Deep</span></button>${n.onsideOk ? `<button class="play" data-act="onside">${icon('trick')}<span>Onside</span><small>~13%</small></button>` : ''}</div>`;
      } else {
        html = `<div class="cp-head"><span class="t">Kick return</span><span class="pill">${ot.abbr} kicking</span></div>${kickTip('ret')}
          <div class="grid"><button class="play sp wide" data-act="ready-ko">${icon('punt')}<span>Ready — receive the kick</span></button></div>`;
      }
    } else if (n.kind === 'pat') {
      if (n.userScored) {
        const xp = Math.round(GI.fgChance(G, G.user, 33) * 100);
        html = `<div class="cp-head"><span class="t">After the TD</span><span class="pill green">+6</span></div>
          <div class="grid"><div class="half"><button class="play sp" data-act="xp">${icon('fg')}<span>Kick PAT</span><small>${xp}%</small></button><button class="play" data-act="two">${icon('in_run')}<span>Go for 2</span><small>from the 2</small></button></div></div>`;
      } else { autoRun(`${ot.abbr} lining up the try…`, () => doStep({ type: 'pat', choice: GI.cpuPAT(G) }), 800); return; }
    } else if (n.kind === 'call') {
      const situ = G.twoPt ? '2-Pt Try' : `${ord(G.down)} & ${G.ballOn + G.toGo >= 100 ? 'Goal' : G.toGo}`;
      if (n.userOff) {
        html = `<div class="cp-head"><span class="t">Offense · ${situ}</span>${n.fourth ? '<span class="pill red">4th down</span>' : `<span class="pill">${GI.spotLabel(G)}</span>`}</div><div class="grid">`;
        html += GI.OFF_PLAYS.map((p) => playBtn(p, 'off')).join('');
        html += `<button class="play" data-act="coach">${icon('dice')}<span>Coach's Call</span><small>let OC pick</small></button>`;
        if (n.fourth) html += `<div class="half"><button class="play sp" data-act="punt">${icon('punt')}<span>Punt</span></button><button class="play sp" data-act="fg" ${n.fgPct < 3 ? 'disabled' : ''}>${icon('fg')}<span>Field Goal</span><small>${n.fgDist} yds · ${n.fgPct}%</small></button></div>`;
        html += '</div>';
      } else if (n.cpuSpecial) {
        if (n.cpuSpecial === 'punt') {
          html = `<div class="cp-head"><span class="t">Punt return</span><span class="pill">${ot.abbr} punting</span></div>${kickTip('ret')}
            <div class="grid"><button class="play sp wide" data-act="ready-punt">${icon('punt')}<span>Ready — return team out</span></button></div>`;
        } else {
          autoRun(`${ot.abbr} ${n.fgDist}-yard field goal try`, () => doStep({ type: 'play', call: null }), 1100);
          return;
        }
      } else {
        html = `<div class="cp-head"><span class="t">Defense · ${situ}</span><span class="pill">${GI.spotLabel(G)}</span></div><div class="grid">` + GI.DEF_PLAYS.map((p) => playBtn(p, 'def')).join('') + '</div>';
      }
    }
    setStatus(null);
    cp.innerHTML = html;
    openSheet(true);
    cp.querySelectorAll('[data-call]').forEach((b) => (b.onclick = () => !busy && doStep({ type: 'play', call: b.dataset.call })));
    cp.querySelectorAll('[data-act]').forEach((b) => (b.onclick = () => {
      if (busy) return;
      const a = b.dataset.act;
      if (a === 'kick' || a === 'ready-ko') doStep({ type: 'kickoff' });
      if (a === 'ready-punt') doStep({ type: 'play', call: null });
      if (a === 'onside') doStep({ type: 'kickoff', onside: true });
      if (a === 'xp') doStep({ type: 'pat', choice: 'xp' });
      if (a === 'two') doStep({ type: 'pat', choice: 'two' });
      if (a === 'punt') doStep({ type: 'play', special: 'punt' });
      if (a === 'fg') doStep({ type: 'play', special: 'fg' });
      if (a === 'coach') { const c = coachCall(); toast(`OC calls: ${GI.playName(c)}`, 1200); doStep({ type: 'play', call: c }); }
    }));
  }
  function kickTip(kind) {
    const list = kind === 'ret' ? GI.RETURN_POS : GI.COVER_POS;
    const st = G.teams[G.user].stars.filter((s) => list.includes(s.pos) && !s.injured);
    const armed = st.filter((s) => s.armed), full = st.filter((s) => s.meter >= 100 && !s.armed);
    const mv = GI.KICK_MOVES[kind].name;
    const lbl = list.map((p) => GI.POS[p].label).join('/');
    if (armed.length) return `<p class="kicktip ok">★ ${GI.shortName(armed[0].name)} is armed for <b>${mv}</b></p>`;
    if (full.length) return `<p class="kicktip fire">🔥 ${GI.shortName(full[0].name)} is on fire — tap his ring to arm <b>${mv}</b></p>`;
    if (!st.length) return `<p class="kicktip">No ${kind === 'ret' ? 'returner' : 'coverage'} stars (${lbl}) on your roster.</p>`;
    return `<p class="kicktip">${mv}: arm a ${lbl} star once his ring is full.</p>`;
  }
  function autoRun(msg, fn, ms) {
    openSheet(false);
    setStatus(msg);
    const go = () => { if (busy) return; if (popId) { autoTimer = setTimeout(go, 400); return; } fn(); };
    autoTimer = setTimeout(go, ms / Math.min(2, SPEEDS[speedIdx]));
  }

  function coachCall() {
    const w = { in_run: 22, out_run: 18, short: 28, long: 15, trick: 4 };
    const st = G.teams[G.user].coaches.oc.style;
    if (st === 'run') { w.in_run *= 1.4; w.out_run *= 1.4; }
    if (st === 'pass') { w.short *= 1.3; w.long *= 1.4; }
    if (st === 'gadget') w.trick *= 3;
    if (G.toGo >= 8) { w.short *= 2; w.long *= 2; w.in_run *= 0.4; }
    if (G.toGo <= 2) { w.in_run *= 2; w.long *= 0.4; }
    G.hist.off.slice(0, 2).forEach((c) => (w[c] *= 0.35));
    for (const k in w) if (armedFor(k)) w[k] *= 3;
    return GI.util.wpick(w);
  }

  async function next() {
    if (!G) return;
    const n = GI.need(G);
    renderSB();
    renderRail();
    if (G.flash) {
      const f = G.flash; G.flash = null;
      GI.save(G);
      if (f === 'half') await halftime();
      else if (f === 'ot') { sfx('horn'); toast('🏈 OVERTIME — sudden death!', 2600); }
      else toast(`End of the ${f === 'q2' ? '1st' : '3rd'} quarter`, 1600);
    }
    if (n.kind === 'over') return showFinal();
    field.showFormation(G);
    markFire();
    renderPanel(n);
  }

  async function doStep(act) {
    if (busy) return;
    busy = true;
    clearTimeout(autoTimer);
    closePop();
    openSheet(false); setStatus(null);
    const before = {};
    G.teams[G.user].stars.forEach((s) => (before[s.id] = s.meter));
    const res = GI.step(G, act);
    if (res.crazy && res.crazy.team === G.user) G.crazyLog[res.crazy.name] = (G.crazyLog[res.crazy.name] || 0) + 1;
    try {
      if (res.kind === 'setup2') toast('Going for two! Pick a play.', 1500);
      await field.runPlay(res, G);
      if (res.banner) {
        if (res.banner.clash) {
          sfx('clash'); GI.audio.buzz([40, 40, 80]);
          await showBanner(res.banner);
          if (res.banner.after) { sfx(res.banner.tone === 'good' ? 'star' : 'bad'); await showBanner({ title: res.banner.after, sub: '', tone: res.banner.tone, star: true }); }
        } else {
          if (res.banner.star) sfx('star');
          if (res.turnover || res.td) GI.audio.buzz(res.td ? [60, 40, 60] : 120);
          await showBanner(res.banner);
        }
      }
    } catch (e) { console.error(e); }
    setTicker(res);
    if (res.injury) res.injury.forEach((i) => toast(`🚑 ${G.teams[i.side].abbr} ${GI.POS[i.pos].label} ${i.name} injured — out for the game`, 2800));
    if (res.cooled) res.cooled.forEach((c) => { if (c.side === G.user) toast(`🧊 ${c.name} cooled off after two bad plays`, 2200); });
    const nowFire = G.teams[G.user].stars.filter((s) => !s.injured && s.meter >= 100 && before[s.id] < 100);
    if (nowFire.length) { sfx('fire'); toast(`🔥 ${nowFire.map((s) => GI.shortName(s.name)).join(' & ')} ${nowFire.length > 1 ? 'are' : 'is'} ON FIRE — tap their ring to arm`, 2600); }
    if (G.over && !G.seasonGame) GI.clearSave(); else GI.save(G);
    busy = false;
    next();
  }

  function setTicker(res) {
    if (!res.text) return;
    let tag = '';
    if (res.matrix != null) {
      const m = res.side === G.user ? res.matrix : -res.matrix;
      tag = { 2: '<span class="pill green">Beat it</span>', 1: '<span class="pill green" style="opacity:.75">Edge</span>', 0: '<span class="pill">Even</span>', '-1': '<span class="pill red" style="opacity:.75">Tough</span>', '-2': '<span class="pill red">Countered</span>' }[m];
      if (res.potw) tag += '<span class="pill gold">POTW</span>';
      if (res.cpuPotw) tag += '<span class="pill red">Their POTW</span>';
      if (res.predictable) tag += '<span class="pill red">Predictable</span>';
    }
    $('#ticker').innerHTML = `<span class="txt">${res.text}</span>${tag ? `<span class="tags">${tag}</span>` : ''}`;
  }

  let bannerDone = null;
  function showBanner(b) {
    return new Promise((resolve) => {
      const host = $('#bannerHost');
      host.innerHTML = `<div class="banner ${b.star ? 'star' : b.tone}"><div class="b">${b.title}</div>${b.sub ? `<div class="s">${b.sub}</div>` : ''}</div>`;
      const ms = SPEEDS[speedIdx] >= 99 ? 750 : 1350 / Math.sqrt(SPEEDS[speedIdx]);
      const timer = setTimeout(() => bannerDone && bannerDone(), ms);
      bannerDone = () => { clearTimeout(timer); host.innerHTML = ''; bannerDone = null; resolve(); };
    });
  }
  function dismissBanner() { if (bannerDone) bannerDone(); }

  function statsTable() {
    const L = G.teams.away, R = G.teams.home, a = G.stats.away, h = G.stats.home;
    const rows = [['Total yards', 'yds'], ['Passing', 'pass'], ['Rushing', 'rush'], ['First downs', 'first'], ['Turnovers', 'to'], ['Sacks taken', 'sacks']];
    return `<table class="stat-t"><tr><td>${L.abbr}</td><td></td><td>${R.abbr}</td></tr>${rows.map(([n, k]) => `<tr><td>${a[k]}</td><td>${n}</td><td>${h[k]}</td></tr>`).join('')}<tr><td>${GI.clockStr(a.top)}</td><td>Possession</td><td>${GI.clockStr(h.top)}</td></tr></table>`;
  }
  function halftime() {
    openSheet(false); setStatus(null);
    return new Promise((resolve) => {
      $('#modal').dataset.lock = '1';
      sfx('horn');
      G.potwLeft = { off: Math.max(G.potwLeft.off, 1), def: Math.max(G.potwLeft.def, 1) };
      modal(`<h2>Halftime</h2><div class="row between" style="margin-bottom:10px"><span class="disp" style="font-size:22px">${G.teams.away.abbr} ${G.score.away} — ${G.score.home} ${G.teams.home.abbr}</span></div>${statsTable()}
        <p class="muted" style="font-size:13.5px">${halftimeQuote()}</p><p class="muted" style="font-size:12.5px">Halftime adjustments: at least 1 Play of the Week rep restored on each side.</p><button class="btn gold block" id="go2">Start 2nd Half ▶</button>`, (s) => {
        s.querySelector('#go2').onclick = () => { delete $('#modal').dataset.lock; closeModal(); resolve(); };
      });
    });
  }
  function halftimeQuote() {
    const ut = G.teams[G.user], d = G.score[G.user] - G.score[other(G.user)];
    const c = ut.coaches.hc.name.split(' ').pop();
    if (d > 10) return `Coach ${c}: "Don't you dare let up. Finish them."`;
    if (d > 0) return `Coach ${c}: "We're ahead, but it's close. Keep mixing it up."`;
    if (d === 0) return `Coach ${c}: "Dead even. Whoever wants it more takes it."`;
    if (d > -11) return `Coach ${c}: "We're right there. Watch what they're sitting on and hit the counter."`;
    return `Coach ${c}: "Burn the tape from that half. New game."`;
  }

  function showFinal() {
    openSheet(false); setStatus(null); closePop();
    const u = G.user, o = other(u);
    const d = G.score[u] - G.score[o];
    sfx(d > 0 ? 'td' : d < 0 ? 'bad' : 'horn');
    const wl = d > 0 ? ['VICTORY!', 'var(--green)'] : d < 0 ? ['DEFEAT', 'var(--red)'] : ['TIE GAME', 'var(--ink)'];
    const ut = G.teams[u];
    let mvp = null, best = 0;
    for (const k in (G.crazyLog || {})) if (G.crazyLog[k] > best) { best = G.crazyLog[k]; mvp = k; }
    const mvpStar = mvp ? ut.stars.find((s) => GI.shortName(s.name) === mvp) : ut.stars.find((s) => s.pos === 'QB');
    const season = G.seasonGame && S;
    $('#finalBody').innerHTML = `
      <div class="sticker result"><div class="wl" style="background:${wl[1]}">${wl[0]}</div>
        <div class="fs">${helmet(G.teams.away, 'md')}<span>${G.score.away}</span><span class="muted" style="font-size:28px">—</span><span>${G.score.home}</span>${helmet(G.teams.home, 'md', { flip: true })}</div>
        <p class="muted" style="margin:14px 0 0">${G.label ? G.label + ' · ' : ''}${G.ot ? 'Final / OT' : 'Final'} · ${GI.WEATHER[G.weather].icon} ${GI.WEATHER[G.weather].name} · ${G.crowd.name} crowd</p></div>
      ${mvpStar ? `<div class="sticker panel"><div class="label">Star of the game</div><h3 style="margin:4px 0 0">★ ${mvpStar.name} <span class="muted" style="font-size:15px">${GI.POS[mvpStar.pos].label} #${mvpStar.num}</span></h3>${best ? `<p class="muted" style="margin:4px 0 0">${best} Show-Me play${best > 1 ? 's' : ''}</p>` : ''}</div>` : ''}
      <div class="sticker panel">${statsTable()}</div>
      <div style="display:grid;gap:12px">${season ? '<button class="btn gold block" id="fGazette">📰 Read the Gazette ▶</button>' : '<button class="btn gold block" id="fRematch">Rematch</button><button class="btn block" id="fNew">New Matchup</button><button class="btn ghost block" id="fMenu">Main Menu</button>'}</div>`;
    show('final');
    if (season) {
      $('#fGazette').onclick = () => {
        if (G.seasonDone) { renderHub(); show('hub'); return; }
        G.seasonDone = true;
        const paper = SN.finishWeek(S, G);
        GI.clearSave();
        showPaper(paper, true);
      };
      return;
    }
    GI.clearSave();
    const hi = G.teams[u].idx, oi = G.teams[o].idx;
    $('#fRematch').onclick = () => { setup.user = hi; startPregame({ user: hi, opp: oi, userHome: setup.home, qMin: setup.qMin, diff: setup.diff }); };
    $('#fNew').onclick = () => { setup.mode = 'quick'; setup.step = 'user'; renderPick(); show('pick'); };
    $('#fMenu').onclick = () => { refreshTitle(); show('title'); };
  }

  // ---------- modals ----------
  function showLog() {
    modal(`<div class="row between"><h2>Play-by-Play</h2>${closeBtn}</div><ul class="log">${G.log.map((l) => `<li class="${l.type}"><span class="q">${GI.qLabel(l.q)} ${GI.clockStr(l.clock)}</span><span>${l.text}</span></li>`).join('')}</ul>`, (s) => (s.querySelector('#mx').onclick = closeModal));
  }
  function showMenu() {
    closePop();
    modal(`<h2>Timeout</h2><div style="display:grid;gap:12px">
      <button class="btn gold block" id="m1">Resume</button>
      <button class="btn ghost block" id="m6">Play-by-Play</button>
      <button class="btn ghost block" id="m5">Box Score</button>
      <button class="btn ghost block" id="m2">Counter Chart</button>
      <button class="btn ghost block" id="m3">How to Play</button>
      <button class="btn ghost block" id="m7">Settings</button>
      <button class="btn red block" id="m4">Save & Quit</button></div>`, (s) => {
      s.querySelector('#m1').onclick = closeModal;
      s.querySelector('#m6').onclick = showLog;
      s.querySelector('#m2').onclick = () => showChart(true);
      s.querySelector('#m3').onclick = () => showHelp();
      s.querySelector('#m7').onclick = () => showSettings(true);
      s.querySelector('#m5').onclick = () => modal(`<div class="row between"><h2>Box Score</h2>${closeBtn}</div>${statsTable()}`, (q) => (q.querySelector('#mx').onclick = closeModal));
      s.querySelector('#m4').onclick = () => { GI.save(G); closeModal(); clearTimeout(autoTimer); refreshTitle(); show('title'); };
    });
  }
  function chartHTML() {
    const cls = { 2: 'p2', 1: 'p1', 0: 'z', '-1': 'm1', '-2': 'm2' };
    const sym = { 2: '++', 1: '+', 0: '·', '-1': '−', '-2': '−−' };
    const short = { man: 'Man', zone: 'Zone', deep: 'Long', press: 'Press', blitz_in: 'Blz In', blitz_out: 'Blz Out' };
    return `<table class="cc"><tr><th></th>${GI.DEF_PLAYS.map((d) => `<th>${short[d.id]}</th>`).join('')}</tr>${GI.OFF_PLAYS.map((o) => `<tr><th style="text-align:left">${o.name}</th>${GI.DEF_PLAYS.map((d) => { const v = GI.MATRIX[o.id][d.id]; return `<td class="${cls[v]}">${sym[v]}</td>`; }).join('')}</tr>`).join('')}</table>
      <p class="muted" style="font-size:12.5px">Green = good for the offense. Red = the defense has it covered. Every play has exactly one hard counter.</p>`;
  }
  function showChart(fromMenu) {
    modal(`<div class="row between"><h2>Counter Chart</h2>${closeBtn}</div>${chartHTML()}`, (s) => (s.querySelector('#mx').onclick = fromMenu ? showMenu : closeModal));
  }
  function showSettings(fromGame) {
    const p = GI.prefs.get();
    const row = (key, title, sub) => `<div class="set-row"><div><b>${title}</b><small>${sub}</small></div><button class="switch ${p[key] !== false ? 'on' : ''}" data-key="${key}" role="switch" aria-checked="${p[key] !== false}" aria-label="${title}"></button></div>`;
    const theme = p.theme || 'auto';
    modal(`<div class="row between"><h2>Settings</h2>${closeBtn}</div>
      ${row('sfx', 'Sound effects', 'Hits, whistles, touchdowns')}
      ${row('crowd', 'Crowd noise', 'Stadium ambience during games')}
      ${row('music', 'Menu music', 'Groove on the menus')}
      ${row('haptics', 'Vibration', 'Buzz on big plays (Android)')}
      <div class="set-row"><div><b>Theme</b><small>Menus and panels</small></div><div class="seg" id="themeSeg" style="width:190px"><button data-v="auto">Auto</button><button data-v="light">Light</button><button data-v="dark">Dark</button></div></div>
      <div class="danger"><b>Reset all data</b><p class="muted" style="margin:4px 0 10px;font-size:13px">Deletes your season, saved game, trophies and every setting on this device. This can't be undone.</p><button class="btn red small" id="resetBtn">Reset everything</button></div>`, (s) => {
      s.querySelector('#mx').onclick = fromGame ? showMenu : closeModal;
      s.querySelectorAll('.switch').forEach((b) => (b.onclick = () => {
        const on = !b.classList.contains('on');
        b.classList.toggle('on', on); b.setAttribute('aria-checked', on);
        GI.prefs.set({ [b.dataset.key]: on });
        GI.audio.refresh();
      }));
      s.querySelectorAll('#themeSeg button').forEach((b) => {
        b.classList.toggle('on', b.dataset.v === theme);
        b.onclick = () => { s.querySelectorAll('#themeSeg button').forEach((x) => x.classList.toggle('on', x === b)); GI.prefs.set({ theme: b.dataset.v }); applyTheme(); };
      });
      s.querySelector('#resetBtn').onclick = () => {
        const btn = s.querySelector('#resetBtn');
        if (!btn.dataset.sure) { btn.dataset.sure = '1'; btn.textContent = 'Tap again to confirm'; return; }
        try { Object.keys(localStorage).filter((k) => k.startsWith('gridiron')).forEach((k) => localStorage.removeItem(k)); } catch (e) {}
        location.reload();
      };
    });
  }
  function showHelp() {
    modal(`<div class="row between"><h2>How to Play</h2>${closeBtn}</div><div class="help">
      <p>Play a <b>Season</b> — schedule, standings, playoffs and the <b>Iron-Bowl</b> — or a one-off Quick Game. You call every snap on offense <b>and</b> defense.</p>
      <h3>🧠 Calls & counters</h3><p>Five offensive plays, six defensive looks. Each offensive play has one defense that shuts it down and one it gashes. The ticker shows what they called and whether you <b>beat it</b> or got <b>countered</b>. Tap it for the play-by-play.</p>${chartHTML()}
      <p>The CPU learns. Calling the same play 3 snaps in a row gets you <b>read</b> (a penalty), and they start sitting on whatever you lean on.</p>
      <h3>⭐ Star rail</h3><p>Your 8 stars sit in the rail under the scoreboard: offense on the left, the kicker in the middle, defense on the right. Rings fill as they make plays. At 100% a star catches fire 🔥 — tap the ring and <b>Arm</b> him any time, even during a kickoff. He'll take over the next play where he matters: Strip Sack, Pick Six, Lockdown, Breakaway, Pancake (+15), Seam Buster, Circus Catch, Dime Drop or Big Leg. Two bad plays in a row while on fire cools him to 70%.</p>
      <h3>⚔️ Star clashes</h3><p>When stars on both sides go off on the same snap, ratings, morale, the matchup and the weather decide who wins.</p>
      <h3>📌 Play of the Week</h3><p>One offensive and one defensive play get a boost for 3 reps per game (halftime restores at least one). The other team has its own — only a Gazette leak reveals it.</p>
      <h3>📰 The Gazette</h3><p>After every week the paper lands with your headline, the play of the week, injuries, scores and an <b>EXTRA!</b> story. Some stories change your next game (leaks, film study, storms, sellouts) and some make you choose how to handle a star.</p>
      <h3>🌦️ Game day</h3><p>Rain and snow cause fumbles; wind kills deep balls and long kicks; heat fills meters faster. Loud home crowds fire up home stars and rattle the road offense. Season injuries can last weeks.</p>
      </div>`, (s) => (s.querySelector('#mx').onclick = closeModal));
  }

  GI.ui = { showPaper: (p) => { S = S || SN.load(); showPaper(p, true); } }; // handy for testing
  window.addEventListener('pagehide', () => { if (G && !G.over && $('#game').classList.contains('on')) GI.save(G); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (field) field.fieldCache = null; });
  refreshTitle();
})();
