/* Grid Iron — screens, controls and game flow */
(function () {
  const GI = window.GI;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const other = GI.util.other;

  let G = null, field = null, busy = false, starTab = 'me', autoTimer = null;
  const P = GI.prefs.get();
  const setup = { home: P.home !== undefined ? P.home : true, qMin: P.qMin || 5, diff: P.diff || 'pro', user: P.user != null ? P.user : null, opp: null, step: 'user' };
  let speedIdx = P.speedIdx || 0;
  const SPEEDS = [1, 2, 99], SPEED_LABEL = ['1×', '2×', '⏭'];

  const textOn = (c) => (GI.lum(c) > 0.6 ? '#1d1d1f' : '#fff');
  const badge = (t, cls) => `<div class="badge ${cls || ''}" style="background:${t.c1};color:${textOn(t.c1)};border:3px solid ${t.c2}">${t.abbr}</div>`;
  const tilt = (i) => ((i * 37) % 7 - 3) * 0.6;
  const ord = (n) => ['', '1st', '2nd', '3rd', '4th'][n] || n + 'th';

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

  // ---------- screens ----------
  function show(id) {
    $$('.screen').forEach((s) => s.classList.toggle('on', s.id === id));
    if (id === 'game' && field) requestAnimationFrame(() => field.resize());
  }
  function toast(msg, ms) {
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

  // ---------- title ----------
  function refreshTitle() {
    const s = GI.load();
    $('#btnResume').hidden = !(s && !s.over && s.v === 1);
  }
  $('#btnQuick').onclick = () => { setup.step = 'user'; setup.opp = null; renderPick(); show('pick'); };
  $('#btnResume').onclick = () => { const s = GI.load(); if (s) { G = s; enterGame(); } };
  $('#btnHelp').onclick = () => showHelp();
  $$('[data-back]').forEach((b) => (b.onclick = () => {
    if (b.dataset.back === 'title' && setup.step === 'opp') { setup.step = 'user'; renderPick(); return; }
    if (b.dataset.back === 'title') refreshTitle();
    show(b.dataset.back);
  }));

  // ---------- team pick ----------
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
  function renderPick() {
    const opp = setup.step === 'opp';
    $('#pickTitle').textContent = opp ? 'Pick your opponent' : 'Pick your team';
    $('#settings').style.display = opp ? 'none' : '';
    const sel = opp ? setup.opp : setup.user;
    let html = '';
    if (opp) html += `<button class="tcard ${sel === -1 ? 'sel' : ''}" data-i="-1" style="transform:rotate(${tilt(99)}deg)"><div class="badge" style="background:var(--ink);color:var(--paper);border:3px solid var(--gold)">?</div><div class="nm">Random<br>Opponent</div></button>`;
    GI.TEAMS.forEach((t, i) => {
      const dis = opp && i === setup.user;
      html += `<button class="tcard ${sel === i ? 'sel' : ''} ${dis ? 'dis' : ''}" data-i="${i}" style="transform:rotate(${tilt(i)}deg)"><span class="ovr">${t.ovr}</span>${badge(t)}<div class="nm">${t.city}<br>${t.name}</div></button>`;
    });
    $('#teamGrid').innerHTML = html;
    $$('#teamGrid .tcard').forEach((c) => (c.onclick = () => {
      const i = +c.dataset.i;
      if (opp) setup.opp = i; else setup.user = i;
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
  let pre = null;
  function startPregame(user, opp) {
    pre = { user, opp };
    G = GI.newGame({ user, opp, userHome: setup.home, qMin: setup.qMin, diff: setup.diff, potw: { off: P.potwOff || 'short', def: P.potwDef || 'zone' } });
    renderPregame();
    show('pregame'); $('#pregame').scrollTop = 0;
  }
  function renderPregame() {
    const ut = G.teams[G.user], ot = G.teams[other(G.user)];
    const ur = GI.ratings(ut), orr = GI.ratings(ot);
    const side = (t, r, home) => `<div class="side">${badge(t, 'lg')}<div class="tn">${t.city}<br>${t.name}</div><div class="row" style="margin-top:8px;gap:6px"><span class="pill">${r.ovr} OVR</span><span class="pill ${home ? 'gold' : ''}">${home ? 'HOME' : 'AWAY'}</span></div></div>`;
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
      <li class="muted">${setup.diff === 'rookie' ? 'Rookie level: they won\'t adjust to you.' : 'They adapt. Call the same play too often and they\'ll sit on it.'}</li></ul>
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
  $('#btnKick').onclick = () => { enterGame(); };

  // ---------- game ----------
  function enterGame() {
    if (!field) {
      field = new GI.Field($('#field'));
      $('#fieldwrap').addEventListener('click', () => { if (field.anim) field.finish(); dismissBanner(); });
    }
    field.speed = SPEEDS[speedIdx];
    $('#btnSpeed').textContent = SPEED_LABEL[speedIdx];
    field.setTeams(G.teams[G.user], G.teams[other(G.user)]);
    field.setWeather(G.weather);
    G.crazyLog = G.crazyLog || {};
    show('game');
    busy = false;
    $('#ticker').innerHTML = `<span class="txt">${G.log[0] ? G.log[0].text : ''}</span>`;
    setTimeout(next, 60);
  }
  $('#btnSpeed').onclick = (e) => {
    e.stopPropagation();
    speedIdx = (speedIdx + 1) % SPEEDS.length;
    if (field) field.speed = SPEEDS[speedIdx];
    $('#btnSpeed').textContent = SPEED_LABEL[speedIdx];
    GI.prefs.set({ speedIdx });
  };
  $('#btnLog').onclick = (e) => { e.stopPropagation(); showLog(); };
  $('#btnMenu').onclick = (e) => { e.stopPropagation(); showMenu(); };
  $$('#starTab button').forEach((b) => (b.onclick = () => { starTab = b.dataset.v; $$('#starTab button').forEach((x) => x.classList.toggle('on', x === b)); renderStars(); }));

  function renderSB(n) {
    const sideHTML = (s, cls) => {
      const t = G.teams[s];
      const hasBall = (G.phase === 'play' || G.phase === 'pat') && G.poss === s;
      return `<div class="sb-team ${cls}">${badge(t, 'sm')}<span class="poss ${hasBall ? 'on' : ''}"></span><span class="score">${G.score[s]}</span></div>`;
    };
    let dd;
    if (G.over) dd = 'FINAL';
    else if (G.phase === 'kickoff') dd = 'KICKOFF';
    else if (G.phase === 'pat') dd = 'EXTRA POINT';
    else if (G.twoPt) dd = '2-PT TRY';
    else dd = `${ord(G.down)} & ${G.ballOn + G.toGo >= 100 ? 'Goal' : G.toGo} · ${GI.spotLabel(G)}`;
    $('#sb').innerHTML = sideHTML('away', 'l') + `<div class="sb-mid"><div class="clk">${G.over ? 'FINAL' : GI.qLabel(G.q) + ' ' + GI.clockStr(G.clock)}</div><div class="dd">${dd}</div></div>` + sideHTML('home', 'r');
    const W = GI.WEATHER[G.weather];
    $('#hudWx').textContent = `${W.icon} ${W.name}`;
  }

  function renderStars() {
    const mine = starTab === 'me';
    const t = G.teams[mine ? G.user : other(G.user)];
    const themArmed = G.teams[other(G.user)].stars.some((s) => s.armed);
    $('#starTab button[data-v="them"]').innerHTML = 'Them' + (themArmed ? ' <span style="color:var(--red)">●</span>' : '');
    $('#chips').innerHTML = t.stars.map((s) => {
      const full = s.meter >= 100 && !s.armed && !s.injured;
      const sub = s.injured ? 'INJURED' : s.armed ? 'ARMED ★' : full ? (mine ? 'TAP TO ARM' : 'READY') : s.meter + '%';
      return `<button class="chip ${full ? 'full' : ''} ${s.armed ? 'armed' : ''} ${s.injured ? 'inj' : ''} ${mine ? '' : 'ro'}" data-id="${s.id}">
        <span class="ring" style="--p:${s.injured ? 0 : s.meter}"><span>${GI.POS[s.pos].label}</span></span>
        <span class="nm">${s.name.split(' ').slice(1).join(' ')}<small>${sub}</small></span></button>`;
    }).join('');
    if (!mine) { $$('#chips .chip').forEach((c) => (c.onclick = () => { const s = t.stars.find((x) => x.id === c.dataset.id); toast(`${GI.POS[s.pos].label} ${GI.shortName(s.name)} · ${GI.SHOWME[s.pos].name}${s.armed ? ' — ARMED!' : ''}`); })); return; }
    $$('#chips .chip').forEach((c) => (c.onclick = () => {
      const s = t.stars.find((x) => x.id === c.dataset.id);
      if (s.injured) { toast(`${GI.shortName(s.name)} is out for the game.`); return; }
      if (GI.toggleArm(G, s.id)) {
        if (s.armed) {
          const sm = GI.SHOWME[s.pos];
          const list = sm.o || sm.d;
          toast(`★ ${GI.shortName(s.name)} armed: ${sm.name}${list ? ' — fires on ' + list.map(GI.playName).join(', ') : ' — next kick'}`, 2800);
        }
        renderStars(); renderPanel(GI.need(G));
      } else toast(`${GI.shortName(s.name)}: ${GI.SHOWME[s.pos].name} at ${s.meter}%. Make plays to fill it.`);
    }));
  }

  function armedFor(playId) {
    return G.teams[G.user].stars.some((s) => s.armed && !s.injured && GI.SHOWME[s.pos].o && GI.SHOWME[s.pos].o.includes(playId));
  }
  function playBtn(p, extra) {
    const potw = (G.potw.off === p.id || G.potw.def === p.id);
    const arm = armedFor(p.id);
    return `<button class="play" data-call="${p.id}">${potw ? '<span class="potw">POTW</span>' : ''}${arm ? '<span class="arm">★</span>' : ''}${icon(p.id)}<span>${p.name}</span>${extra || `<small>${p.tag}</small>`}</button>`;
  }

  function renderPanel(n) {
    const cp = $('#callpanel');
    cp.classList.toggle('busy', busy);
    clearTimeout(autoTimer);
    if (n.kind === 'over') { cp.innerHTML = '<div class="wait">Final whistle!</div>'; return; }
    const ut = G.teams[G.user], ot = G.teams[other(G.user)];
    if (n.kind === 'kickoff') {
      if (n.userKicks) {
        cp.innerHTML = `<div class="cp-head"><span class="t">Kickoff</span><span class="pill">${ut.abbr} kicking</span></div>
          <div class="grid"><button class="play sp ${n.onsideOk ? '' : 'wide'}" data-act="kick" style="${n.onsideOk ? 'grid-column:span 2' : ''}">${icon('punt')}<span>Kick Deep</span></button>${n.onsideOk ? `<button class="play" data-act="onside">${icon('trick')}<span>Onside</span><small>~13%</small></button>` : ''}</div>`;
      } else {
        cp.innerHTML = `<div class="cp-head"><span class="t">Kickoff</span><span class="pill">${ot.abbr} kicking</span></div><div class="wait">Return team set…</div>`;
        auto(() => doStep({ type: 'kickoff' }), 650);
      }
    } else if (n.kind === 'pat') {
      if (n.userScored) {
        const xp = Math.round(GI.fgChance(G, G.user, 33) * 100);
        cp.innerHTML = `<div class="cp-head"><span class="t">After the TD</span><span class="pill green">+6</span></div>
          <div class="grid"><div class="half"><button class="play sp" data-act="xp">${icon('fg')}<span>Kick PAT</span><small>${xp}%</small></button><button class="play" data-act="two">${icon('in_run')}<span>Go for 2</span><small>from the 2</small></button></div></div>`;
      } else {
        cp.innerHTML = `<div class="cp-head"><span class="t">${ot.abbr} scored</span></div><div class="wait">Lining up the try…</div>`;
        auto(() => doStep({ type: 'pat', choice: GI.cpuPAT(G) }), 650);
      }
    } else if (n.kind === 'call') {
      const situ = G.twoPt ? '2-Point Try' : `${ord(G.down)} & ${G.ballOn + G.toGo >= 100 ? 'Goal' : G.toGo}`;
      if (n.userOff) {
        let html = `<div class="cp-head"><span class="t">Offense · ${situ}</span>${n.fourth ? '<span class="pill red">4th down</span>' : `<span class="pill">${GI.spotLabel(G)}</span>`}</div><div class="grid">`;
        html += GI.OFF_PLAYS.map((p) => playBtn(p)).join('');
        html += `<button class="play" data-act="coach">${icon('dice')}<span>Coach's Call</span><small>let OC pick</small></button>`;
        if (n.fourth) {
          html += `<div class="half"><button class="play sp" data-act="punt">${icon('punt')}<span>Punt</span></button><button class="play sp" data-act="fg" ${n.fgPct < 3 ? 'disabled style="opacity:.4"' : ''}>${icon('fg')}<span>Field Goal</span><small>${n.fgDist} yds · ${n.fgPct}%</small></button></div>`;
        }
        cp.innerHTML = html + '</div>';
      } else if (n.cpuSpecial) {
        cp.innerHTML = `<div class="cp-head"><span class="t">${ot.abbr} ${n.cpuSpecial === 'punt' ? 'punting' : 'field goal unit'}</span><span class="pill">4th down</span></div><div class="wait">${n.cpuSpecial === 'punt' ? 'Punt return team on the field…' : `${n.fgDist}-yard try coming up… rush unit in!`}</div>`;
        auto(() => doStep({ type: 'play', call: null }), 900);
      } else {
        let html = `<div class="cp-head"><span class="t">Defense · ${situ}</span><span class="pill">${GI.spotLabel(G)}</span></div><div class="grid">`;
        html += GI.DEF_PLAYS.map((p) => playBtn(p)).join('');
        cp.innerHTML = html + '</div>';
      }
    }
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
  function auto(fn, ms) { autoTimer = setTimeout(() => { if (!busy) fn(); }, ms / Math.min(2, SPEEDS[speedIdx])); }

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
    renderSB(n);
    renderStars();
    if (G.flash) {
      const f = G.flash; G.flash = null;
      GI.save(G);
      if (f === 'half') { await halftime(); }
      else if (f === 'ot') toast('🏈 OVERTIME — sudden death!', 2600);
      else toast(`End of ${f === 'q2' ? '1st' : '3rd'} quarter`, 1600);
    }
    if (n.kind === 'over') return showFinal();
    field.showFormation(G);
    renderPanel(n);
  }

  async function doStep(act) {
    if (busy) return;
    busy = true;
    clearTimeout(autoTimer);
    $('#callpanel').classList.add('busy');
    const res = GI.step(G, act);
    if (res.crazy && res.crazy.team === G.user) G.crazyLog[res.crazy.name] = (G.crazyLog[res.crazy.name] || 0) + 1;
    if (res.kind === 'setup2') toast('Going for two! Pick a play.', 1500);
    await field.runPlay(res, G);
    if (res.banner) await showBanner(res.banner);
    setTicker(res);
    if (res.injury) res.injury.forEach((i) => toast(`🚑 ${G.teams[i.side].abbr} ${GI.POS[i.pos].label} ${i.name} injured — out for the game`, 2800));
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
      if (res.potw && ((res.potw === 'off' && res.side === G.user) || (res.potw === 'def' && res.side !== G.user))) tag += ' <span class="pill gold">POTW</span>';
    }
    $('#ticker').innerHTML = `<span class="txt">${res.text}</span>${tag ? `<span style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">${tag}</span>` : ''}`;
  }

  let bannerDone = null;
  function showBanner(b) {
    return new Promise((resolve) => {
      const host = $('#bannerHost');
      host.innerHTML = `<div class="banner ${b.star ? 'star' : b.tone}"><div class="b">${b.title}</div>${b.sub ? `<div class="s">${b.sub}</div>` : ''}</div>`;
      const ms = SPEEDS[speedIdx] >= 99 ? 650 : 1500 / Math.sqrt(SPEEDS[speedIdx]);
      bannerDone = () => { host.innerHTML = ''; bannerDone = null; resolve(); };
      setTimeout(() => bannerDone && bannerDone(), ms);
    });
  }
  function dismissBanner() { if (bannerDone) bannerDone(); }

  function statsTable() {
    const L = G.teams.away, R = G.teams.home, a = G.stats.away, h = G.stats.home;
    const rows = [['Total yards', 'yds'], ['Passing', 'pass'], ['Rushing', 'rush'], ['First downs', 'first'], ['Turnovers', 'to'], ['Sacks taken', 'sacks']];
    return `<table class="stat-t"><tr><td>${L.abbr}</td><td></td><td>${R.abbr}</td></tr>${rows.map(([n, k]) => `<tr><td>${a[k]}</td><td>${n}</td><td>${h[k]}</td></tr>`).join('')}<tr><td>${GI.clockStr(a.top)}</td><td>Possession</td><td>${GI.clockStr(h.top)}</td></tr></table>`;
  }
  function halftime() {
    return new Promise((resolve) => {
      $('#modal').dataset.lock = '1';
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
    const u = G.user, o = other(u);
    const d = G.score[u] - G.score[o];
    const wl = d > 0 ? ['VICTORY!', 'var(--green)'] : d < 0 ? ['DEFEAT', 'var(--red)'] : ['TIE GAME', 'var(--ink)'];
    const ut = G.teams[u];
    let mvp = null, best = 0;
    for (const k in (G.crazyLog || {})) if (G.crazyLog[k] > best) { best = G.crazyLog[k]; mvp = k; }
    const mvpStar = mvp ? ut.stars.find((s) => GI.shortName(s.name) === mvp) : ut.stars.find((s) => s.pos === 'QB');
    $('#finalBody').innerHTML = `
      <div class="sticker result"><div class="wl" style="background:${wl[1]}">${wl[0]}</div>
        <div class="fs">${badge(G.teams.away)}<span>${G.score.away}</span><span class="muted" style="font-size:28px">—</span><span>${G.score.home}</span>${badge(G.teams.home)}</div>
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
  function showLog() {
    modal(`<div class="row between"><h2>Play-by-Play</h2><button class="iconbtn" id="mx">✕</button></div><ul class="log">${G.log.map((l) => `<li class="${l.type}"><span class="q">${GI.qLabel(l.q)} ${GI.clockStr(l.clock)}</span><span>${l.text}</span></li>`).join('')}</ul>`, (s) => (s.querySelector('#mx').onclick = closeModal));
  }
  function showMenu() {
    modal(`<h2>Timeout</h2><div style="display:grid;gap:12px">
      <button class="btn gold block" id="m1">Resume</button>
      <button class="btn ghost block" id="m2">Counter Chart</button>
      <button class="btn ghost block" id="m3">How to Play</button>
      <button class="btn ghost block" id="m5">Box Score</button>
      <button class="btn red block" id="m4">Save & Quit</button></div>`, (s) => {
      s.querySelector('#m1').onclick = closeModal;
      s.querySelector('#m2').onclick = () => showChart(true);
      s.querySelector('#m3').onclick = () => showHelp();
      s.querySelector('#m5').onclick = () => modal(`<div class="row between"><h2>Box Score</h2><button class="iconbtn" id="mx">✕</button></div>${statsTable()}`, (q) => (q.querySelector('#mx').onclick = closeModal));
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
    modal(`<div class="row between"><h2>Counter Chart</h2><button class="iconbtn" id="mx">✕</button></div>${chartHTML()}`, (s) => (s.querySelector('#mx').onclick = fromMenu ? showMenu : closeModal));
  }
  function showHelp() {
    modal(`<div class="row between"><h2>How to Play</h2><button class="iconbtn" id="mx">✕</button></div><div class="help">
      <p>Pick a team and an opponent, set the conditions, and play a full game. Every snap you call the play — on offense <b>and</b> defense.</p>
      <h3>🧠 Calls & counters</h3><p>Five offensive plays, six defensive looks. Each offensive play has one defense that shuts it down and one it gashes. After each snap the ticker shows what they called and whether you <b>beat it</b> or got <b>countered</b>.</p>${chartHTML()}
      <p>The CPU learns. Spam the same play and they'll start sitting on its counter (except on Rookie).</p>
      <h3>★ Show-Me meters</h3><p>Each team has 8 star players. Their meters fill when they make plays (and faster with a loud home crowd). When a meter hits 100%, tap the star to <b>arm</b> them. On the next play where they can matter, they have a big chance to take over: a Strip Sack, Pick Six, Breakaway, Pancake Block (+15), Circus Catch, Dime Drop or Big Leg kick. Check the <b>Them</b> tab: a red dot means one of their stars is armed.</p>
      <h3>📌 Play of the Week</h3><p>Before kickoff, your coach drills one offensive and one defensive play. Calling them gives a boost.</p>
      <h3>🌦️ Game day</h3><p>Rain and snow cause fumbles and tough throws; wind kills deep balls and long kicks; heat fills meters faster. A loud crowd fires up home stars and can cause false starts on the road team. Stars can get hurt and miss the rest of the game.</p>
      <h3>🗺️ Coming next</h3><p>Seasons & standings, drafts, spring training, coach drama, the weekly newspaper, budgets, and jersey / stadium / gym customization.</p>
      </div>`, (s) => (s.querySelector('#mx').onclick = closeModal));
  }

  window.addEventListener('pagehide', () => { if (G && !G.over && $('#game').classList.contains('on')) GI.save(G); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (field) field.fieldCache = null; });
  refreshTitle();
})();
