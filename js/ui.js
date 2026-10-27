/* Grid Iron — screens, controls and game flow */
(function () {
  const GI = window.GI;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const other = GI.util.other;
  const sfx = (n) => GI.audio && GI.audio.play(n);

  let G = null, field = null, busy = false, autoTimer = null;
  const P = GI.prefs.get();
  const setup = { home: P.home !== undefined ? P.home : true, qMin: P.qMin || 5, diff: P.diff || 'pro', user: P.user != null ? P.user : null, opp: null, step: 'user' };
  let speedIdx = P.speedIdx || 0;
  const SPEEDS = [1, 2, 99], SPEED_LABEL = ['1×', '2×', '⏭'];
  const ord = (n) => ['', '1st', '2nd', '3rd', '4th'][n] || n + 'th';
  const tilt = (i) => ((i * 37) % 7 - 3) * 0.6;

  // ---------- theme ----------
  function applyTheme() {
    const t = GI.prefs.get().theme || 'auto';
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  }
  applyTheme();

  // ---------- helmets ----------
  let helmId = 0;
  const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.round(v * k).toString(16).padStart(2, '0'); return '#' + f((n >> 16) & 255) + f((n >> 8) & 255) + f(n & 255); };
  function helmet(t, cls) {
    const id = 'hc' + (++helmId), c1 = t.c1, c2 = t.c2;
    const shell = 'M12 60C4 40 14 10 46 8c22-2 38 9 43 25c1.5 4 2.5 8 2.5 11H75c-4 0-6 3-6 7v11c0 5-4 8-9 8H28c-10 0-15-4-16-10z';
    const mask = 'M68 47c10-3 22-2 28 3M68 61c10 4 21 3 27-2M95 49c2.5 4 2.5 8 0 11M82 45.5v16.5';
    const stripe = 'M15 42C14 23 30 13 50 12c16-1 29 6 35 17';
    return `<svg class="helm ${cls || ''}" viewBox="0 0 100 80" aria-label="${t.name} helmet">
      <defs><clipPath id="${id}"><path d="${shell}"/></clipPath></defs>
      <path d="${shell}" fill="#fff" stroke="#fff" stroke-width="7" stroke-linejoin="round"/>
      <path d="${mask}" stroke="#fff" stroke-width="8" stroke-linecap="round" fill="none"/>
      <path d="${shell}" fill="${c1}"/>
      <g clip-path="url(#${id})"><path d="M0 58c25 10 50 8 100-2v30H0z" fill="${shade(c1, 0.8)}"/>
        <path d="${stripe}" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round"/><path d="${stripe}" stroke="${c2}" stroke-width="4.6" fill="none" stroke-linecap="round"/>
        <path d="M26 24c6-6 13-8 20-8" stroke="rgba(255,255,255,.5)" stroke-width="3.5" fill="none" stroke-linecap="round"/></g>
      <circle cx="43" cy="44" r="5.5" fill="${shade(c1, 0.62)}"/><circle cx="43" cy="44" r="2.6" fill="${shade(c1, 0.4)}"/>
      <path d="${mask}" stroke="#c4cad2" stroke-width="3.8" stroke-linecap="round" fill="none"/>
    </svg>`;
  }
  $('#logoHelmet').innerHTML = helmet({ c1: '#ff5a4e', c2: '#ffc93c', name: 'Grid Iron' }, 'lg');

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
    if (id === 'game') {
      if (field) requestAnimationFrame(() => { field.resize(); updateInsets(); });
      GI.audio.scene('game', G ? G.crowd.level : 0);
    } else GI.audio.scene('menu');
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
    if (onReady) onReady($('#sheet'));
  }
  function closeModal() { $('#modal').classList.remove('on'); }
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' && !$('#modal').dataset.lock) closeModal(); });
  document.addEventListener('click', (e) => { if (e.target.closest('button')) sfx('tap'); }, true);

  // ---------- title ----------
  function refreshTitle() {
    const s = GI.load();
    $('#btnResume').hidden = !(s && !s.over && s.v === 1);
  }
  $('#btnQuick').onclick = () => { setup.step = 'user'; setup.opp = null; renderPick(); show('pick'); };
  $('#btnResume').onclick = () => { const s = GI.load(); if (s) { G = s; enterGame(); } };
  $('#btnHelp').onclick = () => showHelp();
  $('#btnSettings').onclick = () => showSettings();
  $$('[data-back]').forEach((b) => (b.onclick = () => {
    if (b.dataset.back === 'title' && setup.step === 'opp') { setup.step = 'user'; renderPick(); return; }
    if (b.dataset.back === 'title') refreshTitle();
    show(b.dataset.back);
  }));

  // ---------- team pick ----------
  function bindSettingsSegs() {
    $$('#settings .seg').forEach((seg) => {
      const key = seg.dataset.set;
      const cur = key === 'home' ? (setup.home ? '1' : '0') : String(setup[key]);
      seg.querySelectorAll('button').forEach((b) => {
        b.classList.toggle('on', b.dataset.v === cur);
        b.onclick = () => {
          seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
          const v = b.dataset.v;
          setup[key] = key === 'home' ? v === '1' : key === 'qMin' ? +v : v;
          GI.prefs.set({ home: setup.home, qMin: setup.qMin, diff: setup.diff });
        };
      });
    });
  }
  bindSettingsSegs();
  function renderPick() {
    const opp = setup.step === 'opp';
    $('#pickTitle').textContent = opp ? 'Pick your opponent' : 'Pick your team';
    $('#settings').style.display = opp ? 'none' : '';
    const sel = opp ? setup.opp : setup.user;
    let html = '';
    if (opp) html += `<button class="tcard ${sel === -1 ? 'sel' : ''}" data-i="-1" style="transform:rotate(${tilt(99)}deg)">${helmet({ c1: '#1d1d1f', c2: '#ffc93c', name: 'Random' }, 'md')}<div class="nm">Random<br>Opponent</div></button>`;
    GI.TEAMS.forEach((t, i) => {
      const dis = opp && i === setup.user;
      html += `<button class="tcard ${sel === i ? 'sel' : ''} ${dis ? 'dis' : ''}" data-i="${i}" style="transform:rotate(${tilt(i)}deg)"><span class="ovr">${t.ovr}</span>${helmet(t, 'md')}<div class="nm">${t.city}<br>${t.name}</div></button>`;
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
    $('#pickNext').textContent = opp ? 'Game Day ▶' : 'Next: Opponent ▶';
    $('#pickNext').className = 'btn ' + (opp ? 'green' : 'gold');
  }
  $('#pickNext').onclick = () => {
    if (setup.step === 'user') {
      GI.prefs.set({ user: setup.user });
      setup.step = 'opp'; setup.opp = null; renderPick();
      $('#pick').scrollTop = 0;
      return;
    }
    let opp = setup.opp;
    if (opp === -1) { do { opp = Math.floor(Math.random() * 32); } while (opp === setup.user); }
    startPregame(setup.user, opp);
  };

  // ---------- pregame ----------
  function startPregame(user, opp) {
    const p = GI.prefs.get();
    G = GI.newGame({ user, opp, userHome: setup.home, qMin: setup.qMin, diff: setup.diff, potw: { off: p.potwOff || 'short', def: p.potwDef || 'zone' } });
    renderPregame();
    show('pregame'); $('#pregame').scrollTop = 0;
  }
  function renderPregame() {
    const ut = G.teams[G.user], ot = G.teams[other(G.user)];
    const ur = GI.ratings(ut), orr = GI.ratings(ot);
    const side = (t, r, home) => `<div class="side">${helmet(t, 'lg')}<div class="tn">${t.city}<br>${t.name}</div><div class="row" style="margin-top:8px;gap:6px"><span class="pill">${r.ovr} OVR</span><span class="pill ${home ? 'gold' : ''}">${home ? 'HOME' : 'AWAY'}</span></div></div>`;
    $('#pgMatch').innerHTML = side(ut, ur, G.user === 'home') + `<div class="vs">VS</div>` + side(ot, orr, G.user !== 'home');
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
      <li class="muted">${setup.diff === 'rookie' ? 'Rookie level: they won\'t adjust to you.' : 'They adapt. Call the same play too often and they\'ll sit on it.'}</li>
      <li class="muted">Watch their helmets: a star on fire 🔥 is ready to take over.</li></ul>
      <div class="label" style="margin-top:14px">Your staff</div>
      <div class="coach">${['hc', 'oc', 'dc', 'stc'].map((k) => { const c = ut.coaches[k]; return `<div><span class="muted" style="font-size:11px">${c.role}</span><b>${c.name}</b>${c.rating} rtg${c.style ? ' · ' + (GI.OC_STYLES[c.style] || GI.DC_STYLES[c.style]) : ''}</div>`; }).join('')}</div>`;
    const sl = (t) => `<div class="starlist">${t.stars.map((s) => `<span class="schip"><b>${GI.POS[s.pos].label}</b>${GI.shortName(s.name)} <span class="muted">${s.rating}</span></span>`).join('')}</div>`;
    $('#pgStars').innerHTML = `<h3>★ Star Players</h3><div class="label">${ut.name}</div>${sl(ut)}<div class="label" style="margin-top:12px">${ot.name}</div>${sl(ot)}`;
  }
  function renderPotw() {
    const hc = G.teams[G.user].coaches.hc;
    const grid = (list, cur, key) => `<div class="potw-grid">${list.map((p) => `<button data-k="${key}" data-v="${p.id}" class="${cur === p.id ? 'on' : ''}">${p.name}</button>`).join('')}</div>`;
    $('#pgPotw').innerHTML = `<h3>📌 Play of the Week</h3><p class="muted" style="margin:0 0 8px;font-size:13.5px">Coach ${hc.name.split(' ').pop()} drills one offensive and one defensive play all week. Call them on game day for a boost.</p>
      <div class="label">Offense</div>${grid(GI.OFF_PLAYS, G.potw.off, 'off')}<div class="label" style="margin-top:10px">Defense</div>${grid(GI.DEF_PLAYS, G.potw.def, 'def')}`;
    $$('#pgPotw button').forEach((b) => (b.onclick = () => {
      G.potw[b.dataset.k] = b.dataset.v;
      GI.prefs.set(b.dataset.k === 'off' ? { potwOff: b.dataset.v } : { potwDef: b.dataset.v });
      renderPotw();
    }));
  }
  $('#btnKick').onclick = () => { sfx('horn'); enterGame(); };

  // ---------- game ----------
  function enterGame() {
    if (!field) {
      field = new GI.Field($('#field'));
      field.onSfx = (n) => sfx(n);
      $('#fieldwrap').addEventListener('click', () => { if (field.anim) field.finish(); dismissBanner(); });
      window.addEventListener('resize', () => setTimeout(updateInsets, 60));
    }
    field.speed = SPEEDS[speedIdx];
    field.setTeams(G.teams[G.user], G.teams[other(G.user)]);
    field.setWeather(G.weather);
    G.crazyLog = G.crazyLog || {};
    busy = false;
    $('#ticker').innerHTML = `<span class="txt">${G.log[0] ? G.log[0].text : ''}</span>`;
    show('game');
    setTimeout(next, 60);
  }
  $('#ticker').onclick = () => showLog();

  function updateInsets() {
    if (!field) return;
    // use layout boxes (offsetTop/Left) so the sheet's slide transition doesn't skew the numbers
    const gm = $('#game'), W = gm.clientWidth, H = gm.clientHeight;
    const sb = $('#sb');
    const ps = $('#psheet'), open = ps.classList.contains('open');
    const landscape = W > H * 1.08 && W >= 560;
    const st = $('#status');
    const ins = { top: sb.offsetTop + sb.offsetHeight + 6, bottom: 0, right: 0 };
    if (open) {
      if (landscape) ins.right = W - ps.offsetLeft + 4; else ins.bottom = H - ps.offsetTop + 4;
    } else if (!st.hidden) ins.bottom = H - st.offsetTop + 4;
    field.setInsets(ins);
  }
  function openSheet(on) {
    $('#psheet').classList.toggle('open', on);
    updateInsets();
  }
  function setStatus(txt) {
    const st = $('#status');
    st.hidden = !txt; if (txt) st.textContent = txt;
    updateInsets();
  }

  function renderSB() {
    const sideHTML = (s, cls) => {
      const t = G.teams[s];
      const hasBall = (G.phase === 'play' || G.phase === 'pat') && G.poss === s;
      return `<div class="sb-team ${cls}">${helmet(t, 'sm')}<span class="poss ${hasBall ? 'on' : ''}"></span><span class="score">${G.score[s]}</span></div>`;
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

  function renderStars() {
    const t = G.teams[G.user];
    $('#chips').innerHTML = t.stars.map((s) => {
      const full = s.meter >= 100 && !s.armed && !s.injured;
      const sub = s.injured ? 'INJURED' : s.armed ? 'ARMED ★' : full ? '🔥 TAP TO ARM' : s.meter + '%';
      return `<button class="chip ${full ? 'full' : ''} ${s.armed ? 'armed' : ''} ${s.injured ? 'inj' : ''}" data-id="${s.id}">
        <span class="ring" style="--p:${s.injured ? 0 : s.meter}"><span>${GI.POS[s.pos].label}</span></span>
        <span class="nm">${s.name.split(' ').slice(1).join(' ')}<small>${sub}</small></span></button>`;
    }).join('');
    $$('#chips .chip').forEach((c) => (c.onclick = () => {
      const s = t.stars.find((x) => x.id === c.dataset.id);
      if (s.injured) { toast(`${GI.shortName(s.name)} is out for the game.`); return; }
      if (GI.toggleArm(G, s.id)) {
        if (s.armed) {
          const sm = GI.SHOWME[s.pos];
          const list = sm.o || sm.d;
          sfx('armed'); GI.audio.buzz(30);
          toast(`★ ${GI.shortName(s.name)} armed: ${sm.name}${list ? ' — fires on ' + list.map(GI.playName).join(', ') : ' — next kick'}`, 2800);
        }
        renderStars(); renderPanel(GI.need(G));
        field.showFormation(G);
        markFire();
      } else toast(`${GI.shortName(s.name)}: ${GI.SHOWME[s.pos].name} at ${s.meter}%. Make plays to fill it. Two bad plays while on fire cools them off.`, 2600);
    }));
  }
  function markFire() { // sync fire state of helmets on the field
    if (!field) return;
    ['home', 'away'].forEach((side) => {
      const t = G.teams[side];
      field.players.forEach((p) => {
        const isO = p.side === 'o';
        const ps = field.ctxPlay ? (isO ? field.ctxPlay.offSide : other(field.ctxPlay.offSide)) : null;
        if (ps !== side) return;
        const s = t.stars.find((x) => x.role === p.role && !x.injured);
        if (s) { p.fire = s.meter >= 100 || s.armed; p.armed = s.armed; }
      });
    });
  }

  function armedFor(playId) {
    return G.teams[G.user].stars.some((s) => s.armed && !s.injured && GI.SHOWME[s.pos].o && GI.SHOWME[s.pos].o.includes(playId));
  }
  function playBtn(p) {
    const potw = (G.potw.off === p.id || G.potw.def === p.id);
    const arm = armedFor(p.id);
    return `<button class="play" data-call="${p.id}">${potw ? '<span class="potw">POTW</span>' : ''}${arm ? '<span class="arm">★</span>' : ''}${icon(p.id)}<span>${p.name}</span><small>${p.tag}</small></button>`;
  }

  function renderPanel(n) {
    const cp = $('#callpanel');
    clearTimeout(autoTimer);
    if (n.kind === 'over') { openSheet(false); setStatus('Final whistle!'); return; }
    const ut = G.teams[G.user], ot = G.teams[other(G.user)];
    let html = null;
    if (n.kind === 'kickoff') {
      if (n.userKicks) {
        html = `<div class="cp-head"><span class="t">Kickoff</span><span class="pill">${ut.abbr} kicking</span></div>
          <div class="grid"><button class="play sp" data-act="kick" style="grid-column:span ${n.onsideOk ? 2 : 3}">${icon('punt')}<span>Kick Deep</span></button>${n.onsideOk ? `<button class="play" data-act="onside">${icon('trick')}<span>Onside</span><small>~13%</small></button>` : ''}</div>`;
      } else { autoRun(`${ot.abbr} kicking off…`, () => doStep({ type: 'kickoff' }), 750); return; }
    } else if (n.kind === 'pat') {
      if (n.userScored) {
        const xp = Math.round(GI.fgChance(G, G.user, 33) * 100);
        html = `<div class="cp-head"><span class="t">After the TD</span><span class="pill green">+6</span></div>
          <div class="grid"><div class="half"><button class="play sp" data-act="xp">${icon('fg')}<span>Kick PAT</span><small>${xp}%</small></button><button class="play" data-act="two">${icon('in_run')}<span>Go for 2</span><small>from the 2</small></button></div></div>`;
      } else { autoRun(`${ot.abbr} lining up the try…`, () => doStep({ type: 'pat', choice: GI.cpuPAT(G) }), 750); return; }
    } else if (n.kind === 'call') {
      const situ = G.twoPt ? '2-Pt Try' : `${ord(G.down)} & ${G.ballOn + G.toGo >= 100 ? 'Goal' : G.toGo}`;
      if (n.userOff) {
        html = `<div class="cp-head"><span class="t">Offense · ${situ}</span>${n.fourth ? '<span class="pill red">4th down</span>' : `<span class="pill">${GI.spotLabel(G)}</span>`}</div><div class="grid">`;
        html += GI.OFF_PLAYS.map(playBtn).join('');
        html += `<button class="play" data-act="coach">${icon('dice')}<span>Coach's Call</span><small>let OC pick</small></button>`;
        if (n.fourth) html += `<div class="half"><button class="play sp" data-act="punt">${icon('punt')}<span>Punt</span></button><button class="play sp" data-act="fg" ${n.fgPct < 3 ? 'disabled' : ''}>${icon('fg')}<span>Field Goal</span><small>${n.fgDist} yds · ${n.fgPct}%</small></button></div>`;
        html += '</div>';
      } else if (n.cpuSpecial) {
        autoRun(n.cpuSpecial === 'punt' ? `${ot.abbr} punting — return team out` : `${ot.abbr} ${n.fgDist}-yard field goal try`, () => doStep({ type: 'play', call: null }), 1000);
        return;
      } else {
        html = `<div class="cp-head"><span class="t">Defense · ${situ}</span><span class="pill">${GI.spotLabel(G)}</span></div><div class="grid">` + GI.DEF_PLAYS.map(playBtn).join('') + '</div>';
      }
    }
    setStatus(null);
    cp.innerHTML = html;
    openSheet(true);
    cp.querySelectorAll('[data-call]').forEach((b) => (b.onclick = () => !busy && doStep({ type: 'play', call: b.dataset.call })));
    cp.querySelectorAll('[data-act]').forEach((b) => (b.onclick = () => {
      if (busy) return;
      const a = b.dataset.act;
      if (a === 'kick') doStep({ type: 'kickoff' });
      if (a === 'onside') doStep({ type: 'kickoff', onside: true });
      if (a === 'xp') doStep({ type: 'pat', choice: 'xp' });
      if (a === 'two') doStep({ type: 'pat', choice: 'two' });
      if (a === 'punt') doStep({ type: 'play', special: 'punt' });
      if (a === 'fg') doStep({ type: 'play', special: 'fg' });
      if (a === 'coach') { const c = coachCall(); toast(`OC calls: ${GI.playName(c)}`, 1200); doStep({ type: 'play', call: c }); }
    }));
  }
  function autoRun(msg, fn, ms) {
    openSheet(false);
    setStatus(msg);
    autoTimer = setTimeout(() => { if (!busy) fn(); }, ms / Math.min(2, SPEEDS[speedIdx]));
  }

  function coachCall() {
    const w = { in_run: 22, out_run: 18, short: 28, long: 15, trick: 4 };
    const st = G.teams[G.user].coaches.oc.style;
    if (st === 'run') { w.in_run *= 1.4; w.out_run *= 1.4; }
    if (st === 'pass') { w.short *= 1.3; w.long *= 1.4; }
    if (st === 'gadget') w.trick *= 3;
    if (G.toGo >= 8) { w.short *= 2; w.long *= 2; w.in_run *= 0.4; }
    if (G.toGo <= 2) { w.in_run *= 2; w.long *= 0.4; }
    G.hist.off.slice(0, 3).forEach((c) => (w[c] *= 0.5));
    for (const k in w) if (armedFor(k)) w[k] *= 3;
    return GI.util.wpick(w);
  }

  async function next() {
    if (!G) return;
    const n = GI.need(G);
    renderSB();
    renderStars();
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
    if (nowFire.length) { sfx('fire'); toast(`🔥 ${nowFire.map((s) => GI.shortName(s.name)).join(' & ')} ${nowFire.length > 1 ? 'are' : 'is'} ON FIRE — tap to arm`, 2600); }
    if (G.over) GI.clearSave(); else GI.save(G);
    busy = false;
    next();
  }

  function setTicker(res) {
    if (!res.text) return;
    let tag = '';
    if (res.matrix != null) {
      const m = res.side === G.user ? res.matrix : -res.matrix;
      tag = { 2: '<span class="pill green">Beat it</span>', 1: '<span class="pill green" style="opacity:.75">Edge</span>', 0: '<span class="pill">Even</span>', '-1': '<span class="pill red" style="opacity:.75">Tough</span>', '-2': '<span class="pill red">Countered</span>' }[m];
      if (res.potw && ((res.potw === 'off' && res.side === G.user) || (res.potw === 'def' && res.side !== G.user))) tag += '<span class="pill gold">POTW</span>';
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
      modal(`<h2>Halftime</h2><div class="row between" style="margin-bottom:10px"><span class="disp" style="font-size:22px">${G.teams.away.abbr} ${G.score.away} — ${G.score.home} ${G.teams.home.abbr}</span></div>${statsTable()}
        <p class="muted" style="font-size:13.5px">${halftimeQuote()}</p><button class="btn gold block" id="go2">Start 2nd Half ▶</button>`, (s) => {
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
    GI.clearSave();
    openSheet(false); setStatus(null);
    const u = G.user, o = other(u);
    const d = G.score[u] - G.score[o];
    sfx(d > 0 ? 'td' : d < 0 ? 'bad' : 'horn');
    const wl = d > 0 ? ['VICTORY!', 'var(--green)'] : d < 0 ? ['DEFEAT', 'var(--red)'] : ['TIE GAME', 'var(--ink)'];
    const ut = G.teams[u];
    let mvp = null, best = 0;
    for (const k in (G.crazyLog || {})) if (G.crazyLog[k] > best) { best = G.crazyLog[k]; mvp = k; }
    const mvpStar = mvp ? ut.stars.find((s) => GI.shortName(s.name) === mvp) : ut.stars.find((s) => s.pos === 'QB');
    $('#finalBody').innerHTML = `
      <div class="sticker result"><div class="wl" style="background:${wl[1]}">${wl[0]}</div>
        <div class="fs">${helmet(G.teams.away, 'md')}<span>${G.score.away}</span><span class="muted" style="font-size:28px">—</span><span>${G.score.home}</span>${helmet(G.teams.home, 'md')}</div>
        <p class="muted" style="margin:14px 0 0">${G.ot ? 'Final / OT' : 'Final'} · ${GI.WEATHER[G.weather].icon} ${GI.WEATHER[G.weather].name} · ${G.crowd.name} crowd</p></div>
      ${mvpStar ? `<div class="sticker panel"><div class="label">Star of the game</div><h3 style="margin:4px 0 0">★ ${mvpStar.name} <span class="muted" style="font-size:15px">${GI.POS[mvpStar.pos].label} #${mvpStar.num}</span></h3>${best ? `<p class="muted" style="margin:4px 0 0">${best} Show-Me play${best > 1 ? 's' : ''}</p>` : ''}</div>` : ''}
      <div class="sticker panel">${statsTable()}</div>
      <div style="display:grid;gap:12px"><button class="btn gold block" id="fRematch">Rematch</button><button class="btn block" id="fNew">New Matchup</button><button class="btn ghost block" id="fMenu">Main Menu</button></div>`;
    show('final'); $('#final').scrollTop = 0;
    const hi = G.teams[u].idx, oi = G.teams[o].idx;
    $('#fRematch').onclick = () => { setup.user = hi; startPregame(hi, oi); };
    $('#fNew').onclick = () => { setup.step = 'user'; renderPick(); show('pick'); };
    $('#fMenu').onclick = () => { refreshTitle(); show('title'); };
  }

  // ---------- modals ----------
  const closeBtn = '<button class="iconbtn" id="mx" aria-label="Close">✕</button>';
  function showLog() {
    modal(`<div class="row between"><h2>Play-by-Play</h2>${closeBtn}</div><ul class="log">${G.log.map((l) => `<li class="${l.type}"><span class="q">${GI.qLabel(l.q)} ${GI.clockStr(l.clock)}</span><span>${l.text}</span></li>`).join('')}</ul>`, (s) => (s.querySelector('#mx').onclick = closeModal));
  }
  function showMenu() {
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
    const row = (key, title, sub, def) => `<div class="set-row"><div><b>${title}</b><small>${sub}</small></div><button class="switch ${p[key] !== false && def !== false ? 'on' : ''} ${p[key] === false ? '' : ''}" data-key="${key}" role="switch" aria-checked="${p[key] !== false}" aria-label="${title}"></button></div>`;
    const theme = p.theme || 'auto';
    modal(`<div class="row between"><h2>Settings</h2>${closeBtn}</div>
      ${row('sfx', 'Sound effects', 'Hits, whistles, touchdowns')}
      ${row('crowd', 'Crowd noise', 'Stadium ambience during games')}
      ${row('music', 'Menu music', 'Groove on the menus')}
      ${row('haptics', 'Vibration', 'Buzz on big plays (Android)')}
      <div class="set-row"><div><b>Theme</b><small>Menus and panels</small></div><div class="seg" id="themeSeg" style="width:190px"><button data-v="auto">Auto</button><button data-v="light">Light</button><button data-v="dark">Dark</button></div></div>
      <div class="danger"><b>Reset all data</b><p class="muted" style="margin:4px 0 10px;font-size:13px">Deletes your saved game and every setting on this device. This can't be undone.</p><button class="btn red small" id="resetBtn">Reset everything</button></div>`, (s) => {
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
      <p>Pick a team and an opponent and play a full game. You call every snap — on offense <b>and</b> defense.</p>
      <h3>🧠 Calls & counters</h3><p>Five offensive plays, six defensive looks. Each offensive play has one defense that shuts it down and one it gashes. After each snap the ticker shows what they called and whether you <b>beat it</b> or got <b>countered</b>. Tap the ticker for the full play-by-play.</p>${chartHTML()}
      <p>The CPU learns. Spam the same play and they'll start sitting on its counter (except on Rookie).</p>
      <h3>🔥 Stars & Show-Me meters</h3><p>Each team has 8 stars, shown as helmets on the field. Meters fill when stars make plays (faster with a loud home crowd). At 100% the star catches fire: tap their chip to <b>arm</b> them. On the next play where they matter, they have a big chance to take over — Strip Sack, Pick Six, Lockdown, Breakaway, Pancake Block (+15), Circus Catch, Dime Drop or Big Leg.</p>
      <p>Don't sit on it too long: two bad plays in a row while on fire cools a star back to 70%. Watch the other team's helmets too — fire means they're ready.</p>
      <h3>⚔️ Star clashes</h3><p>When an offensive and defensive star both go off on the same snap, they clash. Ratings, morale, the play matchup and the weather decide who wins. The winner keeps 40% of their meter and swings team morale.</p>
      <h3>📌 Play of the Week</h3><p>Before kickoff your coach drills one offensive and one defensive play. Calling them gives a boost.</p>
      <h3>🌦️ Game day</h3><p>Rain and snow cause fumbles and tough throws; wind kills deep balls and long kicks; heat fills meters faster. A loud crowd fires up home stars and can cause false starts on the road team. Stars can get hurt and miss the rest of the game.</p>
      <h3>👆 Controls</h3><p>Tap the field to skip an animation. ☰ opens the menu, the speed button cycles 1× / 2× / skip.</p>
      </div>`, (s) => (s.querySelector('#mx').onclick = closeModal));
  }

  window.addEventListener('pagehide', () => { if (G && !G.over && $('#game').classList.contains('on')) GI.save(G); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (field) field.fieldCache = null; });
  refreshTitle();
})();
