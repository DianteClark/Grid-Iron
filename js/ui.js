/* Grid Iron — core screens: title, team pick, pregame, the game itself, final, Gazette, settings */
(function () {
  const GI = window.GI;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const other = GI.util.other;
  const sfx = (n) => GI.audio && GI.audio.play(n);
  const SN = GI.season;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  let G = null, S = null, field = null, busy = false, autoTimer = null;
  const P = GI.prefs.get();
  const pref = (k, d) => { const v = GI.prefs.get()[k]; return v === undefined ? d : v; };
  const setup = { mode: 'quick', venue: P.venue || (P.home === false ? 'away' : 'home'), weather: P.weather || 'auto', qMin: P.qMin || 5, diff: P.diff || 'pro', weeks: P.weeks || 12, user: P.user != null ? P.user : null, opp: null, step: 'user' };
  let speedIdx = P.speedIdx || 0;
  const SPEEDS = [1, 2, 99], SPEED_LABEL = ['1×', '2×', '⏭'];
  const ord = (n) => ['', '1st', '2nd', '3rd', '4th'][n] || n + 'th';
  const T = (i) => GI.TEAMS[i];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- theme ----------
  function applyTheme() {
    const t = GI.prefs.get().theme || 'auto';
    if (t !== 'light') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  }
  applyTheme();

  function helmet(t, cls, opts) { return GI.crestSVG(t, cls, opts); } // team identity = shield crest
  GI.helmetSVG = helmet;
  $('#logoHelmet').innerHTML = '<img src="icons/favicon.svg" alt="" width="200" height="200">';

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
    // v1 playbook: a little diagram for every play
    power: `${dot(16, 20)}${dot(16, 12)}<path d="M16 8V2M12 6l4-4 4 4" ${A}/>`,
    counter: `${dot(16, 19)}<path d="M16 15l-5-3 10-8M17 4h4v4" ${A}/>`,
    pa_boot: `${dot(12, 19)}<path d="M12 15c4 0 9-1 11-4" ${A}/><path d="M23 11C23 6 19 3 10 2" ${A} stroke-dasharray="3 3"/>`,
    slants: `${dot(8, 19)}${dot(22, 19)}<path d="M8 15v-3l7-7M22 15v-3l-7-7" ${A} stroke-dasharray="3 3"/>`,
    verticals: `<path d="M5 20V5M12 20V3M20 20V3M27 20V5M2 8l3-3 3 3M24 8l3-3 3 3" ${A}/>`,
    bubble: `${dot(10, 19)}<path d="M10 16l12-3" ${A} stroke-dasharray="3 3"/><path d="M22 13c3 0 5-3 5-8M24 7l3-3 3 3" ${A}/>`,
    stretch: `${dot(6, 19)}<path d="M6 15c0-3 7-5 19-5M21 6l4 4-4 4" ${A}/>`,
    draw: `${dot(16, 19)}<rect x="12" y="9" width="8" height="5" rx="1.5" ${A}/><path d="M16 9V2M13 5l3-3 3 3" ${A}/>`,
    mesh: `<path d="M4 7l24 8M28 7L4 15" ${A}/><path d="M24 11l4 4-5 1M8 11l-4 4 5 1" ${A}/>`,
    flea: `${dot(16, 20)}<path d="M16 16V10c-4 0-4 6 0 6" ${A}/><path d="M18 9C22 7 25 5 27 2" ${A} stroke-dasharray="3 3"/>`,
    reverse: `${dot(16, 19)}<path d="M16 15H7c-2 0-3-2-1-4 3-4 10-6 20-6M22 2l4 3-4 3" ${A}/>`,
    rb_screen: `${dot(16, 19)}<path d="M16 15c-5 0-9-1-10-6" ${A} stroke-dasharray="3 3"/><path d="M6 9h8M11 6l3 3-3 3" ${A}/>`,
    cover2: `${dot(9, 5)}${dot(23, 5)}<path d="M4 18c3-6 21-6 24 0" ${A} stroke-dasharray="3 3"/>`,
    cover3: `${dot(5, 6)}${dot(16, 4)}${dot(27, 6)}<path d="M6 18h20" ${A} stroke-dasharray="3 3"/>`,
    run_commit: `${dot(5, 14)}${dot(11, 12)}${dot(16, 11)}${dot(21, 12)}${dot(27, 14)}<path d="M16 2v4" ${A}/>`,
    man1: `${dot(16, 4)}${dot(8, 15)}${dot(24, 15)}<path d="M8 11v-1M24 11v-1" ${A}/>`,
    robber: `${dot(16, 11)}<path d="M5 18c4-4 18-4 22 0M16 6V2" ${A} stroke-dasharray="3 3"/><path d="M12 11h-6M20 11h6" ${A}/>`,
    quarters: `${dot(4, 6)}${dot(12, 4)}${dot(20, 4)}${dot(28, 6)}<path d="M4 16h24" ${A} stroke-dasharray="3 3"/>`,
    prevent: `<path d="M2 14C6 2 26 2 30 14" ${A}/>${dot(8, 9)}${dot(16, 6)}${dot(24, 9)}`,
    tampa: `${dot(9, 5)}${dot(23, 5)}${dot(16, 15)}<path d="M16 11V6M13 8l3-3 3 3" ${A}/>`,
    agap: `<path d="M13 2v15M19 2v15M10 13l3 4 3-4M16 13l3 4 3-4" ${A}/>`,
    edge: `<path d="M4 3l8 13M28 3l-8 13M9 16h4v-4M23 16h-4v-4" ${A}/>`,
    zero: `<path d="M5 2v13M16 2v13M27 2v13M2 11l3 4 3-4M13 11l3 4 3-4M24 11l3 4 3-4" ${A}/>`,
    dice: `<rect x="7" y="4" width="18" height="16" rx="4" ${A}/>${dot(12, 9)}${dot(20, 15)}`,
  };
  const icon = (id) => `<svg viewBox="0 0 32 22" aria-hidden="true">${ICON[id] || ICON[GI.baseOf ? GI.baseOf(id) : id] || ''}</svg>`;

  // ---------- screens / overlays ----------
  function show(id) {
    const prev = $('.screen.on');
    if (prev && prev.id !== id) toastQ.length = 0; // stale news from the last screen
    $$('.screen').forEach((s) => s.classList.toggle('on', s.id === id));
    wakeOn(id === 'game');
    if (field) { field.calm = !!pref('calm', false); field.highContrast = !!pref('hiLines', false); }
    closePop();
    if (id === 'game') {
      if (field) requestAnimationFrame(() => { field.resize(); updateInsets(); });
      GI.audio.scene('game', G ? Math.min(100, G.crowd.level + (G.venue && G.weather === 'dome' ? 12 : 0)) : 0);
    } else GI.audio.scene('menu');
    const el = $('#' + id); if (el) el.scrollTop = 0;
    if (id !== 'game' && id !== 'paper') setTimeout(flushRewards, 400);
  }
  // toasts queue up instead of stomping on each other (max 3 waiting)
  const toastQ = []; let toastOn = false;
  function toast(msg, ms) {
    if (toastOn) { if (toastQ.length < 5 && !toastQ.some((q) => q[0] === msg)) toastQ.push([msg, ms]); return; }
    toastOn = true;
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg; t.setAttribute('role', 'status');
    document.body.appendChild(t);
    const dur = toastQ.length ? Math.min(ms || 2200, 1500) : ms || 2200;
    setTimeout(() => { t.remove(); toastOn = false; const n = toastQ.shift(); if (n) toast(n[0], n[1]); }, dur);
  }
  // Legacy Points: a little celebration when you get back to a menu
  let rewardBusy = false;
  function flushRewards() {
    if (rewardBusy || !GI.legacy) return;
    const lp = GI.legacy.takePending(), fresh = GI.legacy.takeFresh();
    const total = lp.reduce((t, x) => t + x.n, 0);
    if (!total) return;
    rewardBusy = true;
    const shiny = fresh.filter((f) => (f.shiny || []).length).length;
    const parts = [];
    if (total) parts.push(`+${total} Legacy Points`);
    toast(parts.join(' · '), 2600);
    if (total) sfx('star');
    setTimeout(() => (rewardBusy = false), 2600);
  }
  function modal(html, onReady) {
    $('#sheet').innerHTML = html;
    $('#modal').classList.add('on');
    $('#sheet').scrollTop = 0;
    if (onReady) onReady($('#sheet'));
  }
  function closeModal() { $('#modal').classList.remove('on'); delete $('#modal').dataset.lock; }
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' && !$('#modal').dataset.lock) closeModal(); });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    // a fast double-tap on a navigation button shouldn't fire twice (skipping a screen)
    if (b.matches('.iconbtn, .scard, #pickNext, #pgBack, #btnKick, #paperNext, #fGazette, #fRematch, #fSwap, #fNew, #fMenu, #hubPlay, #hubSim, #hubAdvance')) {
      const now = performance.now();
      if (b._lastTap && now - b._lastTap < 300) { e.stopImmediatePropagation(); e.preventDefault(); return; }
      b._lastTap = now;
    }
    sfx('tap');
  }, true);
  // ---------- back: the on-screen ← and the phone's back gesture do the same thing ----------
  const BACKS = { pick: '#pickBack', pregame: '#pgBack', hub: '#hubBack', draft: '#drBack', roster: '#roBack', office: '#ofBack', trade: '#trBack', records: '#rcBack', tables: '#tbBack', legacy: '#albBack, #lgBack', reel: '#reelDone' };
  function goBack() {
    if ($('#modal').classList.contains('on')) { if (!$('#modal').dataset.lock) closeModal(); return true; }
    const cur = $('.screen.on'); if (!cur) return false;
    if (cur.id === 'game') { showMenu(); return true; }
    if (cur.id === 'paper') { const b = $('#paperNext'); if (!b.disabled) b.click(); return true; }
    if (cur.id === 'final') { const b = $('#fGazette') || $('#fMenu'); if (b) b.click(); return true; }
    const sel = BACKS[cur.id]; if (!sel) return false;
    const b = sel.split(',').map((x) => $(x.trim())).find((x) => x && x.offsetParent !== null);
    if (b) { b._lastTap = 0; b.click(); return true; }
    return false;
  }
  GI.goBack = goBack;
  try {
    history.replaceState({ gi: 'root' }, '');
    history.pushState({ gi: 'app' }, '');
    window.addEventListener('popstate', () => {
      const cur = $('.screen.on');
      if (cur && cur.id === 'title' && !$('#modal').classList.contains('on')) { history.back(); return; } // leave the app from the title screen
      goBack();
      history.pushState({ gi: 'app' }, '');
    });
  } catch (e) {}
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') { e.preventDefault(); goBack(); return; }
    const cur = $('.screen.on'); if (!cur || cur.id !== 'game' || $('#modal').classList.contains('on')) return;
    const k = e.key.toLowerCase();
    if (/^[1-9]$/.test(k)) { const bs = $$('#psheet.open #callpanel .play:not([disabled])'); const b = bs[+k - 1]; if (b) { e.preventDefault(); b.click(); } return; }
    if ((k === ' ' || k === 'enter') && e.target.closest('button, a, [tabindex]')) return; // let focused buttons work
    if (k === ' ' || k === 'enter') { e.preventDefault(); if (field && field.anim) field.finish(); dismissBanner(); return; }
    if (k === 's') $('#gbSpeed').click();
    if (k === 'w') $('#gbCam').click();
    if (k === 'k') $('#gbKey').click();
    if (k === 'b') $('#gbStats').click();
    if (k === 'c') $('#gbTac').click();
    if (k === 't') { const b = $('#psheet.open [data-act="to"]'); if (b) b.click(); }
    if (k === 'arrowleft' || k === 'arrowright' || k === 'q' || k === 'e') {
      const tabs = $$('#psheet.open .ftab'); const i = tabs.findIndex((b) => b.classList.contains('on'));
      if (tabs.length && i >= 0) { e.preventDefault(); tabs[(i + (k === 'arrowleft' || k === 'q' ? tabs.length - 1 : 1)) % tabs.length].click(); }
    }
  });
  // keep the screen awake during games; save if the app gets backgrounded
  let wake = null;
  async function wakeOn(on) {
    try {
      if (on && !wake && navigator.wakeLock) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => (wake = null)); }
      else if (!on && wake) { await wake.release(); wake = null; }
    } catch (e) { wake = null; }
  }
  document.addEventListener('visibilitychange', () => {
    const cur = $('.screen.on');
    if (document.visibilityState === 'hidden') { if (G && !G.over && cur && cur.id === 'game') GI.save(G); }
    else if (cur && cur.id === 'game') wakeOn(true);
  });
  const closeBtn = '<button class="iconbtn" id="mx" aria-label="Close">✕</button>';
  const confirmBox = (title, body, yes, no, onYes, danger) => modal(`<h2>${title}</h2><p class="muted">${body}</p><div style="display:grid;gap:10px"><button class="btn ${danger ? 'red' : 'green'} block" id="cf1">${yes}</button><button class="btn ghost block" id="cf2">${no}</button></div>`, (s) => {
    s.querySelector('#cf1').onclick = () => { closeModal(); onYes(); };
    s.querySelector('#cf2').onclick = closeModal;
  });

  // ---------- v1 player cards ----------
  const TIER_NAME = { bronze: 'Starter', silver: 'Pro', gold: 'Pro Bowl', elite: 'All-Pro', star: 'Star Player' };
  // a jersey in the team's colors: the card's portrait
  function jerseySVG(c1, c2, label, small) {
    const ink = GI.inkOn(c1);
    const fs = String(label).length > 2 ? 26 : 34;
    return `<svg class="jersey" viewBox="0 0 100 92" aria-hidden="true">
      <path d="M31 9 43 4c3 5 11 5 14 0l12 5 23 12-8 22-10-4v49H26V39l-10 4-8-22z" fill="${c1}" stroke="rgba(0,0,0,.45)" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M43 4c3 6 11 6 14 0" fill="none" stroke="${c2}" stroke-width="4"/>
      <path d="M18 30l7 3M82 30l-7 3" stroke="${c2}" stroke-width="5" stroke-linecap="round"/>
      <path d="M33 14 43 9c3 4 11 4 14 0l10 5" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="2"/>
      ${small ? '' : `<text x="50" y="${62 + (fs === 34 ? 4 : 0)}" text-anchor="middle" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="900" font-style="italic" font-size="${fs}" fill="${ink}" stroke="${c2}" stroke-width="1.6" paint-order="stroke">${label}</text>`}
    </svg>`;
  }
  // the player's shape: three stats as a triangle (top = his first stat)
  function statTri(c) {
    const keys = GI.cards.STATS[c.pos];
    const V = [[50, 8], [10, 74], [90, 74]], cx = 50, cy = 52;
    const at = (i, f) => [cx + (V[i][0] - cx) * f, cy + (V[i][1] - cy) * f];
    const f = (v) => Math.max(0.1, (v - 45) / 54);
    const pts = keys.map(([k], i) => at(i, f(c.stats[k])).map((x) => x.toFixed(1)).join(',')).join(' ');
    const ring = (fr) => [0, 1, 2].map((i) => at(i, fr).join(',')).join(' ');
    return `<svg class="tri" viewBox="0 0 100 86" aria-hidden="true">
      <polygon points="${ring(1)}" class="t-grid"/><polygon points="${ring(0.66)}" class="t-grid"/><polygon points="${ring(0.33)}" class="t-grid"/>
      <polygon points="${pts}" class="t-shape"/>
      ${keys.map(([k], i) => { const p = at(i, f(c.stats[k])); return `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.2" class="t-dot"/>`; }).join('')}
    </svg>`;
  }
  function cardHTML(c, team, opts) {
    opts = opts || {};
    const CD = GI.cards;
    const tier = c.tier || CD.tierOf(c.rating).key;
    const c1 = team ? (team.c1 || '#3a4766') : '#3a4766', c2 = team ? (team.c2 || '#ffffff') : '#ffffff';
    const label = c.unit ? GI.POS[c.pos].label : c.num != null ? c.num : GI.POS[c.pos].label;
    const arch = GI.dev ? GI.dev.archetype(c) : '';
    const traits = (c.traits || []).filter((k) => GI.TRAIT_ICON[k]).map((k) => `<i title="${GI.TRAITS[k].name}">${GI.ico(GI.TRAIT_ICON[k])}</i>`).join('');
    const cost = GI.dev ? GI.dev.levelCost(c.rating) : 100;
    const maxed = c.pot && c.rating >= c.pot;
    const xpw = maxed ? 100 : Math.min(100, Math.round(((c.xp || 0) / cost) * 100));
    const im = opts.imp;
    const flags = [im && im.captain ? '<span class="cflag capt">C</span>' : '', im && im.tier ? `<span class="cflag imp t-${GI.impact.keyOf(im.tier)}">${GI.ico('spark')}${GI.impact.nameOf(im.tier)}</span>` : '', opts.hurt ? `<span class="cflag red">${esc(opts.hurt)}</span>` : '', opts.bench ? '<span class="cflag">Bench</span>' : '', c.gem ? `<span class="cflag gem">${GI.ico('spark')}Gem</span>` : ''].join('');
    const stats = c.stats ? CD.STATS[c.pos].map(([k, n]) => `<span class="cs"><em>${c.stats[k]}</em><small>${n}</small></span>`).join('') : '';
    return `<button class="pcard t-${tier} ${opts.small ? 'sm' : ''} ${opts.hurt ? 'hurt' : ''}" style="--tc:${c1};--tc2:${c2}" ${opts.id ? `data-card="${esc(c.id)}"` : ''} aria-label="${esc(c.name)}, ${GI.POS[c.pos].label}, ${c.rating} overall, ${TIER_NAME[tier]}">
      <span class="pc-bg"></span>
      <span class="pc-top"><span class="pc-ovr">${c.rating}<small>${GI.POS[c.pos].label}</small></span>${opts.small ? '' : `<span class="pc-tier">${c.star ? GI.ico('star') : ''}${TIER_NAME[tier]}</span>`}</span>
      <span class="pc-art">${c.unit ? `<span class="pc-unit">${jerseySVG(c1, c2, '', true)}${jerseySVG(c1, c2, label)}${jerseySVG(c1, c2, '', true)}</span>` : jerseySVG(c1, c2, label)}</span>
      <span class="pc-name">${esc(opts.small && !c.unit ? GI.shortName(c.name) : c.name)}</span>
      ${opts.small ? '' : `<span class="pc-arch">${esc(arch)}</span>
      <span class="pc-body">${c.stats ? statTri(c) : ''}<span class="pc-stats">${stats}</span></span>
      <span class="pc-xp" title="${maxed ? 'At his ceiling' : `${c.xp || 0} / ${cost} XP to the next level`}"><i><b style="width:${xpw}%"></b></i><span>${maxed ? 'CEILING' : 'POT ' + c.pot}</span></span>
      <span class="pc-foot"><span>${c.age ? 'AGE ' + c.age : ''}</span><span class="pc-traits">${traits}</span></span>`}
      ${flags ? `<span class="pc-flags">${flags}</span>` : ''}
    </button>`;
  }
  // a quick roster look: a handful of cards, best first
  function lineupStrip(team, n) {
    const list = (team.stars || []).slice().sort((a, b) => b.rating - a.rating).slice(0, n || 6);
    return `<div class="cstrip">${list.map((c) => cardHTML(c, team, { small: true })).join('')}</div>`;
  }

  // ---------- Impact Cards ----------
  // a compact chip: tier band, who, his move and the boost; `c` is a card (+ team for its tier) or a game entry
  function impChip(c, team, opts) {
    opts = opts || {};
    const IM = GI.impact;
    const tier = opts.tier != null ? opts.tier : team ? IM.tierOf(team, c) : c.tier;
    const cap = team ? IM.isCaptain(team, c) : c.captain;
    const tag = c.num != null && !c.unit ? '#' + c.num : GI.POS[c.pos].label;
    const tc = opts.tc;
    return `<${opts.btn ? 'button' : 'span'} class="ichip t-${IM.keyOf(tier)} ${opts.on ? 'on' : ''} ${opts.dim ? 'dim' : ''}" ${opts.data || ''}>
      <span class="ic-tag" ${tc ? `style="background:${tc.c1};color:${GI.inkOn(tc.c1)}"` : ''}>${esc(tag)}</span>
      <span class="ic-mid"><b>${esc(GI.POS[c.pos].label + ' ' + (c.unit ? c.name : GI.shortName(c.name)))}${cap ? ' <em class="cap">C</em>' : ''}</b><small>${IM.MOVE[c.pos] || ''} · ${tier ? IM.nameOf(tier) + ' +' + IM.pctOf(tier) + '%' : 'No card'}</small></span>
      ${opts.left != null ? `<span class="ic-left">${'<i></i>'.repeat(opts.left)}${'<i class="u"></i>'.repeat(Math.max(0, IM.USES - opts.left))}</span>` : ''}
    </${opts.btn ? 'button' : 'span'}>`;
  }
  function impTeamHTML(side) {
    const list = (G.imp && G.imp[side]) || [];
    const t = G.teams[side];
    if (!list.length) return '<p class="muted" style="font-size:12.5px;margin:4px 0">No Impact Cards.</p>';
    return `<div class="ichips">${list.map((c) => impChip(c, null, { tc: teamColors(t), left: c.left })).join('')}</div>`;
  }
  function impactFlash(list) {
    const host = $('#bannerHost');
    list.forEach((f, i) => {
      const mine = f.side === G.user;
      const el = document.createElement('div');
      el.className = `impflash t-${GI.impact.keyOf(f.tier)} ${mine ? 'mine' : 'theirs'}`;
      el.style.top = mine ? '29%' : 'calc(29% + 78px)';
      el.innerHTML = `<small>${mine ? 'Impact Card' : 'Their Impact Card'}${f.captain ? ' · Captain' : ''}</small><b>${esc(GI.shortName(f.name))} · ${GI.impact.MOVE[f.pos]}</b><span>${GI.impact.nameOf(f.tier)} +${GI.impact.pctOf(f.tier)}% · ${f.left} left</span>`;
      host.appendChild(el);
      setTimeout(() => el.remove(), 2100);
    });
    if (list.some((f) => f.side === G.user)) { sfx('impact'); GI.audio.buzz(25); } else sfx('theirImpact');
  }

  // ---------- title ----------
  function refreshTitle() {
    const g = GI.load();
    $('#btnResume').hidden = !(g && !g.over && g.v === 1);
    S = SN.load();
    if (S) {
      const ut = T(S.user);
      const status = { draft: 'Draft day', camp: 'Spring training', offseason: 'Offseason' }[S.phase] || (SN.current(S).label + (S.phase === 'playoffs' ? ' · Playoffs' : ''));
      $('#seasonCard').innerHTML = `<button class="sticker scard" id="btnContinue">${helmet(ut, 'md')}<span><b>Continue Franchise · Year ${S.year}</b><small>${ut.name} · ${SN.recStr(S.rec[S.user])} · ${status}</small></span><span class="go">▶</span></button>`;
      $('#btnContinue').onclick = () => { S = SN.load(); GI.UI.renderHub(); show('hub'); };
    } else $('#seasonCard').innerHTML = '';
    const lp = GI.legacy.get();
    $('#lpBadge').textContent = lp.lp;
    $('#dailyChip').hidden = lp.daily === new Date().toDateString();
  }
  $('#btnQuick').onclick = () => { setup.mode = 'quick'; setup.step = 'user'; setup.opp = null; renderPick(); show('pick'); };
  $('#btnSeason').onclick = () => {
    const go = () => { setup.mode = 'season'; setup.step = 'user'; renderPick(); show('pick'); };
    if (SN.load()) confirmBox('Start a new franchise?', 'Your current franchise will be replaced. (Your Legacy Points, album and all-time Hall of Fame stay.)', 'Start New Franchise', 'Keep My Franchise', go, true);
    else go();
  };
  $('#btnResume').onclick = () => { const g = GI.load(); if (g) { G = g; if (G.seasonGame) S = SN.load(); enterGame(); } };
  $('#btnHelp').onclick = () => showHelp();
  $('#btnSettings').onclick = () => showSettings();
  $('#btnTrophies').onclick = () => GI.UI.openLegacy('hall');
  $('#btnAlbum').onclick = () => GI.UI.openLegacy('cards');
  $('#btnFriends').onclick = () => GI.UI.openFriends();
  $('#btnStore').onclick = () => GI.UI.openLegacy('store');

  // ---------- team pick ----------
  $$('#settings .seg').forEach((seg) => {
    const key = seg.dataset.set;
    const cur = String(setup[key]);
    seg.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('on', b.dataset.v === cur);
      b.onclick = () => {
        seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
        const v = b.dataset.v;
        setup[key] = key === 'qMin' || key === 'weeks' ? +v : v;
        GI.prefs.set({ venue: setup.venue, weather: setup.weather, qMin: setup.qMin, diff: setup.diff, weeks: setup.weeks });
      };
    });
  });
  $('#pickBack').onclick = () => {
    if (setup.step === 'opp') { setup.step = 'user'; renderPick(); $('#pick').scrollTop = 0; return; }
    refreshTitle(); show('title');
  };
  const rndTeam = (not) => { let i; do { i = Math.floor(Math.random() * 32); } while (i === not); return i; };
  function quickOpts(user, opp) {
    let venue = setup.venue;
    if (venue === 'random') venue = ['home', 'away', 'neutral'][Math.floor(Math.random() * 3)];
    let weather = setup.weather;
    if (weather === 'random') weather = ['clear', 'rain', 'snow', 'wind', 'heat'][Math.floor(Math.random() * 5)];
    return { user, opp, userHome: venue !== 'away', neutral: venue === 'neutral', weather: weather === 'auto' ? null : weather, weatherPick: weather !== 'auto', qMin: setup.qMin, diff: setup.diff, quick: true };
  }
  $('#pickSurprise').onclick = () => {
    const user = rndTeam(-1), opp = rndTeam(user);
    const sv = setup.venue, sw = setup.weather;
    setup.venue = 'random'; setup.weather = 'random';
    const o = quickOpts(user, opp);
    setup.venue = sv; setup.weather = sw;
    toast(`🎲 ${T(user).name} vs ${T(opp).name}`, 1800);
    startPregame(o);
  };
  function renderPick() {
    const opp = setup.step === 'opp';
    $('#pickTitle').textContent = opp ? 'Pick your opponent' : setup.mode === 'season' ? 'Pick your franchise' : 'Pick your team';
    $('#pickSurprise').hidden = setup.mode !== 'quick' || opp;
    $('#pickSteps').innerHTML = setup.mode === 'quick' ? `<span class="${opp ? 'done' : 'on'}">1 · Your team${opp && setup.user != null ? ': ' + (setup.user === -1 ? '🎲 Random' : esc(T(setup.user).name)) : ''}</span><span class="${opp ? 'on' : ''}">2 · Opponent</span>` : '';
    $('#pickBack').setAttribute('aria-label', opp ? 'Back to your team' : 'Back to menu');
    $('#settings').style.display = opp ? 'none' : '';
    $$('#settings [data-only]').forEach((r) => (r.style.display = r.dataset.only === setup.mode ? '' : 'none'));
    const sel = opp ? setup.opp : setup.user;
    const sortBy = pref('pickSort', 'az');
    $('#pickSort').innerHTML = [['az', 'A–Z'], ['ovr', 'Best'], ['dome', '🏟️ Domes'], ['turf', '⚡ Turf']].map(([k, n]) => `<button data-v="${k}" class="${sortBy === k ? 'on' : ''}">${n}</button>`).join('');
    $$('#pickSort button').forEach((b) => (b.onclick = () => { GI.prefs.set({ pickSort: b.dataset.v }); renderPick(); }));
    let html = '';
    html += `<button class="tcard ${sel === -1 ? 'sel' : ''}" data-i="-1">${helmet({ c1: '#1d1d1f', c2: '#ffc93c', abbr: '?', city: '', name: 'Random', glyph: 'dice' }, 'md')}<div class="nm">Random<br>${opp ? 'Opponent' : 'Team'}</div></button>`;
    let order = GI.TEAMS.map((t, i) => i);
    if (sortBy === 'ovr' && setup.mode !== 'season') order.sort((a, b) => GI.TEAMS[b].ovr - GI.TEAMS[a].ovr);
    if (sortBy === 'dome') order = order.filter((i) => GI.STADIUMS[i].roof !== 'open');
    if (sortBy === 'turf') order = order.filter((i) => GI.STADIUMS[i].surface !== 'grass');
    order.forEach((i) => {
      const t = GI.TEAMS[i];
      const dis = opp && i === setup.user;
      const V = GI.STADIUMS[i];
      html += `<button class="tcard ${sel === i ? 'sel' : ''} ${dis ? 'dis' : ''}" data-i="${i}">${setup.mode === 'season' ? '' : `<span class="ovr">${t.ovr}</span>`}${helmet(t, 'md')}<div class="nm">${t.city}<br>${t.name}</div><div class="tv" title="${esc(V.name)}">${GI.ROOFS[V.roof].icon}${V.surface === 'grass' ? '🌱' : '⚡'}</div></button>`;
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
      GI.UI.renderHub(); show('hub');
      return;
    }
    if (setup.step === 'user') {
      if (setup.user !== -1) GI.prefs.set({ user: setup.user });
      setup.step = 'opp'; setup.opp = null; renderPick();
      $('#pick').scrollTop = 0;
      return;
    }
    const user = setup.user === -1 ? rndTeam(setup.opp) : setup.user;
    let opp = setup.opp;
    if (opp === -1) opp = rndTeam(user);
    if (setup.user === -1) toast(`🎲 You're the ${T(user).city} ${T(user).name}!`, 2000);
    startPregame(quickOpts(user, opp));
  };

  // ================= THE GAZETTE =================
  let paperFrom = 'hub';
  function showPaper(paper, fresh, after) {
    paperFrom = fresh ? 'hub' : 'archive';
    $('#gazette').innerHTML = gazetteHTML(paper);
    $('#gazette').classList.toggle('champs', paper.special === 'champs');
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
    const reel = $('#gz-reel'); if (reel) reel.onclick = () => GI.UI.openReel();
    btn.onclick = () => {
      if (after) { after(); return; }
      GI.UI.renderHub(); show('hub');
      if (paperFrom === 'archive') showArchive();
    };
  }
  function gazetteHTML(p) {
    const left = p.left != null ? T(p.left) : null, right = p.right != null ? T(p.right) : null;
    const champs = p.special === 'champs' && S;
    const photo = left && right && !champs ? `<figure class="photo"><div class="halftone">${helmet(left, 'ph')}<span class="boom">💥</span>${helmet(right, 'ph', { flip: true })}</div>
      <figcaption>${p.caption ? p.caption : p.potw ? 'PLAY OF THE WEEK — ' + p.potw.text.replace(/^[A-Z]{2,4}: /, '') : `${left.name} and ${right.name} collide.`}</figcaption></figure>` : '';
    const ev = p.event;
    let evHTML = '';
    if (ev) {
      evHTML = `<div class="extra k-${ev.kind}"><span class="xtag">EXTRA! · ${ev.tag}</span><h3>${ev.title}</h3><p>${ev.body}</p>`;
      if (ev.choices && !ev.chosen) evHTML += `<div class="choices">${ev.choices.map((c) => `<button class="choice" data-choice="${c.id}"><b>${c.label}</b><small>${c.desc}</small></button>`).join('')}</div>`;
      else if (ev.effect) evHTML += `<p class="effect">➜ ${ev.effect}</p>`;
      evHTML += '</div>';
    }
    const quote = p.quote ? `<blockquote class="pquote"><p>“${esc(p.quote.text)}”</p><cite>— Coach ${esc(p.quote.coach.split(' ').pop())}, ${esc(p.quote.trig.toLowerCase())} presser</cite></blockquote>` : '';
    const scores = (p.scores || []).map((g) => `<li><span class="${g.hs < g.as ? 'w' : ''}">${T(g.a).abbr} ${g.as}</span> @ <span class="${g.hs > g.as ? 'w' : ''}">${T(g.h).abbr} ${g.hs}</span>${g.ot ? ' <i>OT</i>' : ''}</li>`).join('');
    const inj = (p.injuries || []).length ? p.injuries.map((i) => `<li class="${i.mine ? 'mine' : ''}">${i.text}</li>`).join('') : '<li>A clean bill of health around the league.</li>';
    const div = (p.division || []).map((d) => `<li class="${S && d.i === S.user ? 'mine' : ''}"><span>${T(d.i).city} ${T(d.i).name}</span><b>${d.rec}</b></li>`).join('');
    const notes = [p.userPlayoff, p.champion != null && !champs ? `🏆 ${T(p.champion).city} ${T(p.champion).name} are your Iron-Bowl champions.` : null].filter(Boolean).map((x) => `<p class="note">${x}</p>`).join('');
    const power = (p.power || []).length ? `<section class="power"><h4>Power Rankings</h4><ol>${p.power.map((x) => { const mv = x.prev ? x.prev - x.rank : 0; return `<li class="${S && x.i === S.user ? 'mine' : ''}"><b>${x.rank}</b> ${T(x.i).city} ${T(x.i).name} <i class="${mv > 0 ? 'up' : mv < 0 ? 'dn' : ''}">${mv > 0 ? '▲' + mv : mv < 0 ? '▼' + -mv : '—'}</i></li>`; }).join('')}</ol>${p.myRank && p.myRank.rank > 10 ? `<p class="myrank">${T(S.user).name}: #${p.myRank.rank}</p>` : ''}</section>` : '';
    let champHTML = '';
    if (champs) {
      const ut = T(S.user);
      const roster = SN.allStars(S, S.user);
      const pr = (S.bracket ? S.bracket.rounds : []).map((rd) => rd.find((g) => g.h === S.user || g.a === S.user)).filter(Boolean);
      champHTML = `<div class="champfront"><div class="cf-crest">${helmet(ut, 'xl')}</div><div class="cf-year">YEAR ${p.year} · ${SN.recStr(S.rec[S.user])}</div>
        <ul class="cf-run">${pr.map((g, k) => `<li><span>${SN.ROUND_NAMES[k]}</span><b>${T(g.h === S.user ? g.a : g.h).abbr} — ${g.h === S.user ? g.hs + '-' + g.as : g.as + '-' + g.hs}</b></li>`).join('')}</ul>
        <div class="cf-roster">${roster.map((s) => `<span>${GI.POS[s.pos].label} ${esc(s.name)}</span>`).join('')}</div>
        ${S.reel && S.reel.length ? '<button class="btn gold small" id="gz-reel">▶ Watch the season highlight reel</button>' : ''}</div>`;
    }
    return `<header class="mast"><div class="mast-top"><span>Vol. ${p.year}</span><span>${p.label}</span><span>${champs ? 'Collector’s Edition' : '25¢'}</span></div>
        <h1>The Grid-Iron Gazette</h1><div class="mast-rule">★ ALL THE FOOTBALL THAT'S FIT TO PRINT ★</div></header>
      ${champs ? '<div class="cf-banner">CHAMPIONS</div>' : ''}
      <h2 class="headline">${p.headline || 'QUIET WEEK AROUND THE LEAGUE'}</h2>
      ${p.score ? `<div class="scoreline">${p.score}</div>` : ''}
      ${p.sub ? `<p class="deck">${p.sub}</p>` : ''}
      ${champHTML}${photo}${notes}${quote}${evHTML}
      ${(p.sections || []).length ? `<div class="secs">${p.sections.filter((x) => x.items && x.items.length).map((x) => `<section><h4>${x.title}</h4><ul class="inj">${x.items.map((i) => `<li>${i}</li>`).join('')}</ul></section>`).join('')}</div>` : ''}
      ${power}
      ${(p.scores || []).length ? `<div class="cols">
        <section><h4>Injury Report</h4><ul class="inj">${inj}</ul></section>
        <section><h4>${S ? SN.divName(S.user) : 'Division'}</h4><ul class="div">${div}</ul></section>
      </div>
      <section class="league"><h4>Scoreboard</h4><ul class="scores">${scores}</ul></section>` : ''}
      <footer class="paper-foot">Printed in ${S ? T(S.user).city : 'Grid Iron'} · Read it all before kickoff</footer>`;
  }
  function showArchive() {
    if (!S || !S.news.length) { toast('No papers yet. Play a week first!'); return; }
    modal(`<div class="row between"><h2>📰 Gazette Archive</h2>${closeBtn}</div><div class="arch">${S.news.map((p, k) => `<button class="archrow" data-k="${k}"><span class="label">${p.label} · Vol. ${p.year}</span><b>${p.headline || ''}</b></button>`).join('')}</div>`, (s) => {
      s.querySelector('#mx').onclick = closeModal;
      s.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => { closeModal(); showPaper(S.news[+b.dataset.k], false); }));
    });
  }

  // ================= PREGAME =================
  let pgSeason = false;
  function startPregame(o, season) {
    pgSeason = !!season;
    const p = GI.prefs.get();
    if (!o.potw) o.potw = { off: p.potwOff || 'short', def: p.potwDef || 'zone' };
    o.keyMode = !!p.keyMode;
    G = GI.newGame(o);
    G.seasonGame = !!season;
    renderPregame();
    show('pregame');
  }
  $('#pgBack').onclick = () => { if (pgSeason) { GI.UI.renderHub(); show('hub'); } else if (G && G.friend) GI.UI.openFriends(); else show('pick'); };
  function renderPregame() {
    const ut = G.teams[G.user], ot = G.teams[other(G.user)];
    const ur = GI.ratings(ut), orr = GI.ratings(ot);
    $('#pgTitle').textContent = G.label || 'Game Day';
    const side = (t, r, home, flip) => `<div class="side">${helmet(t, 'lg', { flip })}<div class="tn">${t.city}<br>${t.name}</div><div class="row" style="margin-top:8px;gap:6px;justify-content:center;flex-wrap:wrap"><span class="pill">${r.ovr} OVR</span>${pgSeason ? `<span class="pill">${SN.recStr(S.rec[t.idx])}</span>` : ''}<span class="pill ${home && !G.neutral ? 'gold' : ''}">${G.neutral ? 'NEUTRAL' : home ? 'HOME' : 'AWAY'}</span></div></div>`;
    $('#pgMatch').innerHTML = side(ut, ur, G.user === 'home') + `<div class="vs">VS</div>` + side(ot, orr, G.user !== 'home', true);
    // matchup storylines: rivalries, revenge, coaching trees, duos, style clashes
    const mine = (G.edge && G.edge[G.user].notes) || [], theirs = (G.edge && G.edge[other(G.user)].notes) || [];
    const uniq = (l) => l.filter((n, k) => l.findIndex((x) => x.text === n.text) === k);
    const edgeHTML = (G.rivalry && G.rivalry.hot ? `<div class="rivalry">${GI.ico('flame')} RIVALRY GAME</div>` : '') +
      (mine.length || theirs.length ? `<div class="sticker panel edges"><h3>${GI.ico('puzzle')} Storylines</h3>${uniq(mine).map((n) => `<div class="edge mine"><span>${GI.emo(n.icon)}</span><p>${n.text}</p></div>`).join('')}${uniq(theirs).filter((n) => !mine.some((m) => m.text === n.text)).map((n) => `<div class="edge theirs"><span>${GI.emo(n.icon)}</span><p><b>${ot.abbr}:</b> ${n.text}</p></div>`).join('')}</div>` : '');
    let hurtHTML = '';
    if (pgSeason) {
      const q = SN.questionable(S, S.user);
      if (q.length) hurtHTML = `<div class="sticker panel"><h3>${GI.ico('medic')} Questionable</h3><p class="muted" style="margin:0 0 8px;font-size:13px">One-week injuries. Push him to play: he's −6 OVR and fragile — get hurt again and it's 2+ more weeks.</p>${q.map((s) => `<label class="hurtrow"><input type="checkbox" data-hurt="${s.id}" ${S.playHurt[s.id] ? 'checked' : ''}> <span><b>${GI.POS[s.pos].label} ${esc(s.name)}</b> (${s.rating} OVR)</span></label>`).join('')}</div>`;
    }
    $('#pgMods').innerHTML = (pgSeason ? GI.UI.modsHTML() : '') + edgeHTML + hurtHTML;
    $$('#pgMods [data-hurt]').forEach((c) => (c.onchange = () => {
      if (c.checked) S.playHurt[c.dataset.hurt] = true; else delete S.playHurt[c.dataset.hurt];
      SN.save(S);
      const o = SN.gameOptions(S); const pp = GI.prefs.get();
      o.potw = { off: pp.potwOff || 'short', def: pp.potwDef || 'zone' }; o.keyMode = !!pp.keyMode;
      G = GI.newGame(o); G.seasonGame = true; renderPregame();
    }));
    const W = GI.WEATHER[G.weather];
    const homeT = G.teams.home, V = G.venue || GI.venueOf(homeT.idx);
    const tips = GI.venueTips(V, G.weather);
    $('#pgConds').innerHTML = `
      <div class="sticker cond venue"><div class="label">${V.neutral ? 'Neutral site' : esc(homeT.city) + ' · home of the ' + esc(homeT.name)}</div><div class="big">${GI.ico('stadium')} ${esc(V.name)}</div>
        <div class="stadchips"><span class="pill">${GI.ROOFS[V.roof].icon} ${GI.ROOFS[V.roof].name}</span><span class="pill">${GI.SURFACES[V.surface].icon} ${GI.SURFACES[V.surface].name}</span><span class="pill">${GI.ico('roster')} ${V.cap}k</span></div>
        ${tips.length ? `<ul class="vtips">${tips.map((t) => `<li>${t}</li>`).join('')}</ul>` : ''}</div>
      <div class="sticker cond"><div class="label">Weather</div><div class="big">${W.icon} ${W.name}</div><div class="muted" style="font-size:12.5px">${G.roofNote ? esc(G.roofNote) : W.desc}</div></div>
      <div class="sticker cond"><div class="label">Crowd</div><div class="big">${GI.ico('leader')} ${G.crowd.name}</div><div class="muted" style="font-size:12.5px">${G.neutral ? 'Split down the middle. No home edge.' : G.crowd.level >= 50 ? `Fires up ${homeT.abbr} stars, rattles the road offense` : 'Quiet day. Little home edge.'}</div></div>`;
    const rows = [['RUN', 'run'], ['PASS', 'pass'], ['LINE', 'ol'], ['RUN D', 'runD'], ['PASS D', 'passD'], ['RUSH', 'rush'], ['ST', 'st']];
    // v1: the effective rating — talent first, then everything that nudges it
    G.effMods = null;
    const eu = GI.effRating(G, G.user), eo = GI.effRating(G, other(G.user));
    const modList = (e) => e.mods.length ? e.mods.map((m) => `<li class="${m.v > 0 ? 'up' : 'dn'}"><b>${m.v > 0 ? '+' : ''}${m.v}</b><span>${esc(m.label)}${m.scope !== 'all' ? `<i>${m.scope === 'off' ? 'on offense' : m.scope === 'def' ? 'on defense' : 'in the kicking game'}</i>` : ''}</span></li>`).join('') : '<li class="muted">No edges either way</li>';
    const effGap = eu.eff - eo.eff;
    const odds = GI.winOdds ? GI.winOdds(effGap) : null;
    $('#pgEff').innerHTML = `<h3>📊 Effective rating</h3>
      <div class="effrow"><div class="effside"><span class="label">${esc(ut.abbr)}</span><div class="effnum"><small>${eu.base}</small><span>→</span><b>${eu.eff}</b></div><ul class="effmods">${modList(eu)}</ul></div>
      <div class="effside r"><span class="label">${esc(ot.abbr)}</span><div class="effnum"><small>${eo.base}</small><span>→</span><b>${eo.eff}</b></div><ul class="effmods">${modList(eo)}</ul></div></div>
      ${odds != null ? `<div class="effodds"><div class="oddsbar"><i style="width:${odds}%;background:${ut.c1}"></i></div><p>${effGap === 0 ? 'Dead even on paper.' : effGap > 0 ? `You're the better team by ${effGap}.` : `They're better by ${-effGap}.`} Expected win chance: <b>${odds}%</b>. Your calls and impact moments move it from there.</p></div>` : ''}`;
    $('#pgBars').innerHTML = `<div class="row between"><span class="label">${ut.abbr}</span><span class="label">Tale of the tape</span><span class="label">${ot.abbr}</span></div>` +
      rows.map(([k, key]) => `<div class="bar"><span class="v">${ur[key]}</span><div class="track l"><div class="fill" style="width:${ur[key]}%;background:${ut.c1}"></div></div><span class="k">${k}</span><div class="track"><div class="fill" style="width:${orr[key]}%;background:${ot.c1}"></div></div><span class="v">${orr[key]}</span></div>`).join('');
    renderPotw();
    const oc = ot.coaches.oc, dc = ot.coaches.dc;
    const ocHint = { run: 'Run Commit and the blitzes stuff the ground game.', pass: 'Cover 4, Robber and Press Man take away the air game.', gadget: 'Prevent, Cover 0 and Cover 1 Man shut down the gadgets.', balanced: 'No obvious tell. Mix it up.' }[oc.style];
    const dcHint = { blitz: 'Draws, bubbles and counters punish the blitz.', cover: 'Power runs and slants eat soft coverage.', press: 'Mesh, WR Reverse and Flea Flicker beat the man looks.', balanced: 'No obvious tell. Watch their tendencies.' }[dc.style];
    const idn = ot.identity && GI.IDENTITIES[ot.identity];
    const keys = [];
    const gap = (a, b) => a - b;
    const opts = [
      [gap(ur.pass, orr.passD), `Air it out: your passing game (${ur.pass}) has the edge on their coverage (${orr.passD}).`],
      [gap(ur.run, orr.runD), `Pound the rock: your run game (${ur.run}) should push around their front (${orr.runD}).`],
      [gap(ur.passD, orr.pass), `Make them run it: your secondary (${ur.passD}) can take away their passing game.`],
      [gap(ur.runD, orr.run), `Sell out vs the pass: your run defense (${ur.runD}) can handle their ground game alone.`],
      [gap(orr.rush, ur.ol), `Get the ball out fast: their pass rush (${orr.rush}) beats your line (${ur.ol}). Short passes and runs.`],
      [gap(orr.pass, ur.passD), `Danger through the air: their passing game (${orr.pass}) outclasses your coverage. Dial up Cover 4 and Press Man.`],
    ].sort((a, b) => b[0] - a[0]);
    opts.filter((x) => x[0] >= 4).slice(0, 2).forEach((x) => keys.push(x[1]));
    if (!keys.length) keys.push('Dead even on paper. Win the counter-call battle and the turnover margin.');
    const vt = GI.venueTips(G.venue || GI.venueOf(G.teams.home.idx), G.weather); if (vt[0]) keys.push(vt[0]);
    $('#pgScout').innerHTML = `<h3>${GI.ico('key')} Keys to the game</h3><ol class="keys">${keys.slice(0, 3).map((k) => `<li>${k}</li>`).join('')}</ol>
      <h3 style="margin-top:16px">${GI.ico('scout')} Scouting ${ot.abbr}</h3>
      <ul class="scout"><li><b>OC ${oc.name}</b> — ${GI.OC_STYLES[oc.style]}. ${ocHint}</li><li><b>DC ${dc.name}</b> — ${GI.DC_STYLES[dc.style]}. ${dcHint}</li>
      ${idn ? `<li><b>Playbook:</b> ${idn.icon} ${idn.name}. ${idn.desc}</li>` : ''}
      ${G.intel ? `<li class="intel">${GI.ico('eye')} <b>Leaked:</b> their go-to play is <b>${GI.playName(G.cpuPotw.off)}</b> (counter: <b>${GI.playName(GI.counterOf(G.cpuPotw.off))}</b>). On defense they trust <b>${GI.playName(G.cpuPotw.def)}</b>.</li>` : '<li class="muted">They have their own Play of the Week too. You won\'t know it unless the Gazette gets a leak.</li>'}
      ${G.film ? '<li class="bad">🎞️ They studied your film — they\'ll sit on your offensive Play of the Week.</li>' : ''}
      <li class="muted">${G.diff === 'rookie' ? 'Rookie level: they won\'t adjust to you.' : 'They adapt a little. Call the same play too often and they\'ll sit on it — and their tendencies show in the play sheet.'}</li></ul>
      <div class="label" style="margin-top:14px">Your staff</div>
      <div class="coach">${['hc', 'oc', 'dc', 'stc'].map((k) => { const c = ut.coaches[k]; return `<div><span class="muted" style="font-size:11px">${c.role}</span><b>${c.name}</b>${c.rating} rtg${c.style ? ' · ' + (GI.OC_STYLES[c.style] || GI.DC_STYLES[c.style]) : ''}</div>`; }).join('')}</div>`;
    const tr = (s) => (s.traits || []).map((k) => GI.TRAITS[k] ? `<i title="${GI.TRAITS[k].name}">${GI.TRAITS[k].icon}</i>` : '').join('');
    const sl = (t) => `<div class="starlist">${t.stars.map((s) => `<span class="schip ${s.injured ? 'hurt' : ''}"><b>${GI.POS[s.pos].label}</b>${GI.shortName(s.name)} <span class="muted">${s.injured ? 'OUT' : s.rating}</span>${tr(s)}</span>`).join('')}</div>`;
    $('#pgStars').innerHTML = ut.v === 1
      ? `<h3>${GI.ico('cards')} Top cards</h3><div class="label">${esc(ut.name)}</div>${lineupStrip(teamColors(ut), 6)}<div class="label" style="margin-top:12px">${esc(ot.name)}</div>${lineupStrip(ot, 6)}
        <h3 style="margin-top:16px">${GI.ico('spark')} Impact Cards</h3><p class="muted" style="margin:-2px 0 8px;font-size:12.5px">Each fires ${GI.impact ? GI.impact.USES : 3} times. Tap yours in the play sheet to play it on the next snap that player is part of.</p>
        <div class="label">${esc(ut.name)}</div>${impTeamHTML(G.user)}<div class="label" style="margin-top:10px">${esc(ot.name)}</div>${impTeamHTML(other(G.user))}`
      : `<h3>★ Star Players</h3><div class="label">${ut.name}</div>${sl(ut)}<div class="label" style="margin-top:12px">${ot.name}</div>${sl(ot)}`;
    const km = !!GI.prefs.get().keyMode;
    $('#pgMode').innerHTML = `<h3>${GI.ico('pad')} How do you want to play?</h3><div class="seg" id="modeSeg"><button data-v="0" class="${km ? '' : 'on'}">Every snap</button><button data-v="1" class="${km ? 'on' : ''}">Key moments</button></div>
      <p class="muted" style="margin:8px 0 0;font-size:13px">${km ? 'The routine snaps sim on their own. You take over in the red zone, on 4th downs, in the two-minute drill, in crunch time and whenever a star catches fire.' : 'You call every snap on offense and defense. You can still sim a drive or skip to halftime from the ☰ menu.'}</p>`;
    $$('#modeSeg button').forEach((b) => (b.onclick = () => { GI.prefs.set({ keyMode: b.dataset.v === '1' }); G.keyMode = b.dataset.v === '1'; renderPregame(); }));
  }
  function renderPotw() {
    const hc = G.teams[G.user].coaches.hc;
    const grid = (list, cur, key) => `<div class="potw-grid">${list.map((p) => `<button data-k="${key}" data-v="${p.id}" class="${cur === p.id ? 'on' : ''}">${p.name}</button>`).join('')}</div>`;
    $('#pgPotw').innerHTML = `<h3>${GI.ico('pin')} Play of the Week</h3><p class="muted" style="margin:0 0 8px;font-size:13.5px">Coach ${hc.name.split(' ').pop()} drilled one offensive and one defensive play. Each gets a boost for <b>3 reps</b> per game — save them for big downs. Calling the same play 3+ snaps in a row gets you read.</p>
      <div class="label">Offense</div>${grid(GI.OFF_PLAYS, G.potw.off, 'off')}<div class="label" style="margin-top:10px">Defense</div>${grid(GI.DEF_PLAYS, G.potw.def, 'def')}
      ${G.intel ? '' : '<p class="muted" style="margin:8px 0 0;font-size:12.5px">Tip: the Gazette\'s scouting report sometimes leaks their go-to play. Drill its counter.</p>'}`;
    $$('#pgPotw button').forEach((b) => (b.onclick = () => {
      G.potw[b.dataset.k] = b.dataset.v;
      GI.prefs.set(b.dataset.k === 'off' ? { potwOff: b.dataset.v } : { potwDef: b.dataset.v });
      renderPotw();
    }));
  }
  $('#btnKick').onclick = () => { sfx('horn'); G.keyMode = !!GI.prefs.get().keyMode; enterGame(); };

  // ================= GAME =================
  function teamColors(t) { return t.idx != null && G && t === G.teams[G.user] ? Object.assign({}, t, GI.legacy.jersey(t)) : t; }
  function enterGame() {
    if (!field) {
      field = new GI.Field($('#field'));
      field.onSfx = (n) => sfx(n);
      $('#fieldwrap').addEventListener('click', () => { closePop(); if (field.anim) field.finish(); dismissBanner(); });
      window.addEventListener('resize', () => setTimeout(updateInsets, 60));
    }
    field.speed = SPEEDS[speedIdx];
    field.wide = !!GI.prefs.get().wide; field.redraw();
    renderSB.last = null;
    field.setTeams(teamColors(G.teams[G.user]), G.teams[other(G.user)]);
    if (!G.venue) { const ib = G.playoff && /IRON-BOWL/i.test(G.label || ''); G.venue = ib ? Object.assign({}, GI.NEUTRAL_VENUE) : GI.venueOf(G.teams.home.idx, S); G.neutral = ib; }
    const mineHome = !G.venue.neutral && G.venue.idx === G.teams[G.user].idx;
    field.setVenue(G.venue, mineHome ? GI.legacy.equipped('field') : 'classic', G.crowd.level, G.venue.neutral ? null : G.teams.home.idx === G.teams[G.user].idx ? teamColors(G.teams.home) : G.teams.home);
    field.setWeather(G.weather);
    field.ballSkin = GI.legacy.equipped('ball');
    G.crazyLog = G.crazyLog || {};
    G.reelCands = G.reelCands || [];
    G.potwLeft = G.potwLeft || { off: 3, def: 3 };
    G.to = G.to || { home: 3, away: 3 };
    busy = false;
    $('#ticker').innerHTML = `<span class="txt">${G.log[0] ? G.log[0].text : ''}</span>`;
    show('game');
    setTimeout(next, 60);
  }
  $('#ticker').onclick = () => showLog();

  function updateInsets() {
    if (!field) return;
    const gm = $('#game'), W = gm.clientWidth, H = gm.clientHeight;
    const sb = $('#sb'), rail = $('#rail'), bar = $('#gbar');
    const ps = $('#psheet'), open = ps.classList.contains('open');
    const landscape = W > H * 1.08 && W >= 560;
    rail.style.top = (landscape ? sb.offsetTop : sb.offsetTop + sb.offsetHeight + 6) + 'px';
    const railBottom = rail.hidden ? sb.offsetTop + sb.offsetHeight : rail.offsetTop + rail.offsetHeight;
    $('#railPop').style.top = (railBottom + 6) + 'px';
    ps.style.top = landscape ? (railBottom + 8) + 'px' : '';
    const st = $('#status');
    const ins = { top: landscape ? sb.offsetTop + sb.offsetHeight + 6 : railBottom + 6, bottom: H - bar.offsetTop + 4, right: 0 };
    if (open) {
      if (landscape) ins.right = W - ps.offsetLeft + 4; else ins.bottom = H - ps.offsetTop + 4;
    } else if (!st.hidden) ins.bottom = Math.max(ins.bottom, H - st.offsetTop + 4);
    field.setInsets(ins);
    const tip = $('.coachtip'); if (tip) tip.style.bottom = (open && !landscape ? H - ps.offsetTop + 10 : H - bar.offsetTop + 10) + 'px';
  }
  function openSheet(on) { $('#psheet').classList.toggle('open', on); updateInsets(); }
  function setStatus(txt) {
    const st = $('#status');
    st.hidden = !txt; if (txt) st.textContent = txt;
    updateInsets();
  }

  function renderSB() {
    const sideHTML = (s, cls) => {
      const t = teamColors(G.teams[s]);
      const hasBall = (G.phase === 'play' || G.phase === 'pat') && G.poss === s;
      const bar = `<i style="background:${t.c1};box-shadow:0 0 0 1px ${t.c2}55"></i>`;
      const parts = [`<span class="poss ${hasBall ? 'on' : ''}"></span>`, `<b>${esc(t.abbr)}</b>`, bar];
      return `<div class="sb-t ${cls} ${s === G.user ? 'me' : ''}">${(cls === 'l' ? parts : parts.reverse()).join('')}</div>`;
    };
    const tosFor = (s) => `<span class="tos" aria-label="${G.to[s]} timeouts">${[0, 1, 2].map((k) => `<i class="${k < G.to[s] ? 'on' : ''}"></i>`).join('')}</span>`;
    const opp = other(G.user);
    const hot = G.teams[opp].stars.filter((x) => !x.injured && (x.meter >= 100 || x.armed)).length;
    let dd;
    if (G.over) dd = 'Final';
    else if (G.phase === 'kickoff') dd = 'Kickoff';
    else if (G.phase === 'pat') dd = 'Extra point';
    else if (G.twoPt) dd = '2-pt try';
    else dd = `${ord(G.down)} & ${G.ballOn + G.toGo >= 100 ? 'Goal' : G.toGo} · ${GI.spotLabel(G)}${G.phase === 'play' && G.ballOn >= 80 ? ' <span class="rzpill">RED ZONE</span>' : ''}`;
    const W = GI.WEATHER[G.weather];
    const running = G.runoff > 0 && !G.over;
    const ha = teamColors(G.teams.away), hh = teamColors(G.teams.home);
    const pos = 50 + (G.mom || 0) / 2;
    const prev = renderSB.last || {};
    const bumpA = prev.away != null && prev.away !== G.score.away, bumpH = prev.home != null && prev.home !== G.score.home;
    renderSB.last = { away: G.score.away, home: G.score.home };
    $('#sb').dataset.skin = GI.legacy.equipped('board') || 'prime';
    $('#sb').innerHTML = `<div class="sb-main">${sideHTML('away', 'l')}
      <div class="sb-score"><span class="${bumpA ? 'bump' : ''}">${G.score.away}</span><em>-</em><span class="${bumpH ? 'bump' : ''}">${G.score.home}</span></div>
      ${sideHTML('home', 'r')}
      <div class="sb-clock ${running ? 'run' : ''}">${G.over ? 'FINAL' : GI.clockStr(running ? GI.clockLeft(G) : G.clock)}${G.over ? '' : `<small>${GI.qLabel(G.q)}</small>`}</div></div>
      <div class="sb-sub">${tosFor('away')}<span class="dd">${dd} ${W.icon}${hot ? ` <span class="opphot" title="${esc(G.teams[opp].abbr)} stars on fire">🔥${hot > 1 ? hot : ''}</span>` : ''}</span>${tosFor('home')}</div>
      <div class="mom" title="Momentum" style="--ca:${ha.c1};--ch:${hh.c1}"><i style="left:${pos}%"></i></div>`;
    renderBar();
  }

  // ---------- bottom tab bar ----------
  function renderBar() {
    const sp = $('#gbSpeed'); if (!sp) return;
    sp.innerHTML = `<span>${['▶', '▶▶', '⏭'][speedIdx]}</span>${['1x', '2x', 'Skip'][speedIdx]}`;
    $('#gbCam').innerHTML = `<span>${field && field.wide ? '⊙' : '⛶'}</span>${field && field.wide ? 'Close' : 'Wide'}`;
    const k = $('#gbKey'); k.classList.toggle('hot', !!G.keyMode); k.innerHTML = `<span>⚡</span>${G.keyMode ? 'Key: On' : 'Key'}`;
  }
  const tap = (id, fn) => { $(id).onclick = (e) => { e.stopPropagation(); sfx('tap'); fn(); }; };
  tap('#gbPause', () => showMenu());
  tap('#gbSpeed', () => {
    speedIdx = (speedIdx + 1) % SPEEDS.length;
    field.speed = SPEEDS[speedIdx];
    GI.prefs.set({ speedIdx }); renderBar();
    toast(['Normal speed', 'Fast speed', 'Skip animations'][speedIdx], 1000);
  });
  tap('#gbCam', () => { field.wide = !field.wide; GI.prefs.set({ wide: field.wide }); field.redraw(); renderBar(); });
  tap('#gbTac', () => showTactics());
  tap('#gbStats', () => showBox());
  tap('#gbKey', () => { G.keyMode = !G.keyMode; GI.prefs.set({ keyMode: G.keyMode }); renderBar(); toast(G.keyMode ? '⚡ Key moments only' : 'Calling every snap', 1400); if (!busy && G.keyMode) next(); });

  // ---------- star rail ----------
  const GROUP = { QB: 0, RB: 0, WR: 0, TE: 0, OL: 0, KP: 1, LB: 2, DL: 2, S: 2, CB: 2 };
  let popId = null;
  function renderRail() {
    const t = G.teams[G.user];
    const list = t.stars.filter((s) => GI.hasMeter(t, s)).sort((a, b) => GROUP[a.pos] - GROUP[b.pos]);
    $('#rail').hidden = !list.length; // v1: only Star Players (90+) carry a meter
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
    const traits = (s.traits || []).map((k) => GI.TRAITS[k] ? `<span class="trait">${GI.TRAITS[k].icon} ${GI.TRAITS[k].name}</span>` : '').join('');
    $('#railPop').innerHTML = `<div class="pp-head"><span class="pp-pos">${GI.POS[s.pos].label}</span><span class="pp-nm"><b>${s.name}</b><small>#${s.num} · ${s.rating} OVR · ${s.armed ? 'ARMED' : full ? 'ON FIRE' : s.meter + '%'}</small></span><button class="iconbtn sm" id="popX" aria-label="Close">✕</button></div>
      <div class="pp-bar"><i style="width:${s.injured ? 0 : s.meter}%"></i></div>
      ${traits ? `<div class="traits">${traits}</div>` : ''}
      <p class="pp-move"><b>${sm.name}</b> — ${sm.desc}. Fires ${sideTxt}${list ? ' on ' + list.map(GI.playName).join(', ') : ''}.${GI.RETURN_POS.includes(s.pos) ? ` Also <b>${GI.KICK_MOVES.ret.name}</b> on kick & punt returns.` : ''}${GI.COVER_POS.includes(s.pos) ? ` Also <b>${GI.KICK_MOVES.cov.name}</b> on kick coverage.` : ''}</p>
      <div class="pp-act">${action}</div>
      ${full && !s.armed ? `<p class="pp-tip">${pref('autoArm', true) ? 'Auto-arm is on: he fires on the next snap where he matters. ' : ''}Two bad plays in a row while on fire cools him to 70%.</p>` : ''}`;
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
    return G.teams[G.user].stars.some((s) => s.armed && !s.injured && GI.SHOWME[s.pos].o && GI.SHOWME[s.pos].o.includes(GI.baseOf(playId)));
  }
  function playBtn(p, kind) {
    const isPotw = kind === 'off' ? G.potw.off === p.id : G.potw.def === p.id;
    const left = G.potwLeft[kind];
    const run = (kind === 'off' ? G.hist.off : G.hist.def).slice(0, 2);
    const warn = run.length === 2 && run[0] === p.id && run[1] === p.id;
    const arm = kind === 'off' && armedFor(p.id);
    return `<button class="play ${warn ? 'warn' : ''}" data-call="${p.id}">${isPotw && left > 0 ? `<span class="potw">POTW ×${left}</span>` : ''}${arm ? '<span class="arm">★</span>' : ''}${warn ? '<span class="pred">3rd in a row</span>' : ''}${icon(p.id)}<span>${p.name}</span><small>${p.tag}</small></button>`;
  }
  // what the CPU likes to call right now (base tendencies + its recent habit)
  function tendHTML() {
    const t = GI.tendency(G).slice(0, 3);
    const h = GI.cpuHabit(G);
    const tip = GI.situationTip(G);
    const userOff = G.poss === G.user;
    const lean = t.map((x) => `<span>${GI.playName(x.id)} <b>${x.p}%</b></span>`).join('');
    return `<button class="tend" id="tendBtn"><span class="tl">${userOff ? 'Their D leans' : 'Their O leans'}</span>${lean}</button>
      ${h ? `<div class="habit">${GI.ico('eye')} ${h.third ? 'On 3rd/4th down' : 'On early downs'} they've called <b>${GI.playName(h.call)}</b> ${h.n} of the last ${h.of}</div>` : ''}
      ${tip ? `<div class="situ">${GI.ico('bulb')} ${tip}</div>` : ''}`;
  }

  // the playbook is grouped: four formations on offense, four packages on defense
  const bookTab = { off: null, def: null };
  function tabsHTML(kind) {
    const groups = kind === 'off' ? GI.FORMATIONS : GI.FRONTS;
    const key = kind === 'off' ? 'form' : 'front';
    const list = kind === 'off' ? GI.OFF_PLAYS : GI.DEF_PLAYS;
    if (!bookTab[kind] || !groups.some((g) => g.id === bookTab[kind])) {
      const last = GI.playOf(G.hist[kind][0]) || GI.playOf(G.potw[kind]);
      bookTab[kind] = last ? last[key] : groups[0].id;
    }
    const cur = groups.find((g) => g.id === bookTab[kind]);
    const tabs = groups.map((g) => {
      const plays = list.filter((p) => p[key] === g.id);
      const potw = plays.some((p) => p.id === G.potw[kind]) && G.potwLeft[kind] > 0;
      const arm = kind === 'off' && plays.some((p) => armedFor(p.id));
      return `<button class="ftab ${g.id === cur.id ? 'on' : ''}" data-tab="${g.id}" data-kind="${kind}">${g.short || g.name}${potw ? '<i class="fp"></i>' : ''}${arm ? '<i class="fa"></i>' : ''}</button>`;
    }).join('');
    const plays = list.filter((p) => p[key] === cur.id);
    return { tabs: `<div class="ftabs" role="tablist">${tabs}</div><p class="fdesc"><b>${cur.name}</b> · ${cur.desc}</p>`, plays };
  }
  // the user's Impact Cards for this side of the ball: tap one to play it on the next snap he's part of
  function impRowHTML(sd) {
    const list = ((G.imp && G.imp[G.user]) || []).filter((c) => c.side === sd && c.tier > 0);
    if (!list.length || G.twoPt) return '';
    const armed = G.impArm && G.impArm[G.user];
    const a = list.find((c) => c.id === armed);
    return `<div class="improw">${list.map((c) => impChip(c, null, { btn: true, tc: teamColors(G.teams[G.user]), left: c.left, on: c.id === armed, dim: !c.left, data: `data-imp="${esc(c.id)}" ${c.left ? '' : 'disabled'}` })).join('')}</div>
      ${a ? `<div class="impnote">${GI.ico('spark')} <b>${esc(GI.shortName(a.name))}</b> is ready: his card fires on the next snap that fits (${GI.impact.FIT_WORD[a.pos]}).</div>` : '<div class="impnote muted">Tap a card to play it this snap.</div>'}`;
  }
  function renderPanel(n) {
    const cp = $('#callpanel');
    clearTimeout(autoTimer);
    if (n.kind === 'over') { openSheet(false); setStatus('Final whistle!'); return; }
    const ut = G.teams[G.user], ot = G.teams[other(G.user)];
    let html = null;
    if (n.cpuTO && !G.pending.toShown) { G.pending.toShown = true; toast(`⏱ ${ot.abbr} call timeout (${G.to[other(G.user)]} left)`, 1800); }
    if (n.kind === 'expiring') {
      const what = G.q === 2 ? 'half' : G.q >= 4 ? (G.q >= 5 ? 'overtime period' : 'game') : 'quarter';
      if (!n.canTO) { autoRun(`⏱ Time runs out on the ${what}`, () => doStep({ type: 'runout' }), 900); return; }
      html = `<div class="cp-head"><span class="t">⏱ The clock is running!</span><span class="pill red">${G.clock}s left</span></div>
        <p class="kicktip">The ${what} ends before the next snap unless you stop the clock.</p>
        <div class="grid"><div class="half"><button class="play sp" data-act="to">⏱<span>Timeout</span><small>${G.to[G.user]} left</small></button><button class="play" data-act="runout"><span>Let it run</span><small>end the ${what}</small></button></div></div>`;
    } else if (n.kind === 'kickoff') {
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
      const tools = [];
      if (n.canTO) tools.push(`<button class="tool" data-act="to">${GI.ico('clock')} Timeout <b>${G.to[G.user]}</b></button>`);
      if (n.userOff && !G.twoPt && (n.lateHalf || G.hurry[G.user])) tools.push(`<button class="tool ${G.hurry[G.user] ? 'on' : ''}" data-act="hurry">${GI.ico('ffwd')} Hurry-up ${G.hurry[G.user] ? 'ON' : 'off'}</button>`);
      if (n.canSpike) tools.push(`<button class="tool" data-act="spike">${GI.ico('ball')} Spike</button>`);
      if (n.canKneel) tools.push(`<button class="tool" data-act="kneel">${GI.ico('kneel')} Kneel</button>`);
      const toolHTML = tools.length ? `<div class="tools">${tools.join('')}</div>` : '';
      if (n.userOff) {
        html = `<div class="cp-head"><span class="t">Offense · ${situ}</span>${n.fourth ? '<span class="pill red">4th down</span>' : `<span class="pill">${GI.spotLabel(G)}</span>`}</div>${toolHTML}${G.twoPt ? '' : tendHTML()}<div class="grid">`;
        const bk = tabsHTML('off');
        html = html.replace(/<div class="grid">$/, impRowHTML('o') + bk.tabs + '<div class="grid">');
        html += bk.plays.map((p) => playBtn(p, 'off')).join('');
        html += `<button class="play coachc wide" data-act="coach">${icon('dice')}<span>Coach's Call</span><small>OC picks from the whole book</small></button>`;
        if (n.fourth) html += `<div class="half"><button class="play sp" data-act="punt">${icon('punt')}<span>Punt</span></button><button class="play sp" data-act="fg" ${n.fgPct < 3 ? 'disabled' : ''}>${icon('fg')}<span>Field Goal</span><small>${n.fgDist} yds · ${n.fgPct}%</small></button></div>`;
        html += '</div>';
      } else if (n.cpuSpecial) {
        if (n.cpuSpecial === 'punt') {
          html = `<div class="cp-head"><span class="t">Punt return</span><span class="pill">${ot.abbr} punting</span></div>${toolHTML}${kickTip('ret')}
            <div class="grid"><button class="play sp wide" data-act="ready-punt">${icon('punt')}<span>Ready — return team out</span></button></div>`;
        } else if (n.cpuSpecial === 'kneel') {
          autoRun(`${ot.abbr} take a knee…`, () => doStep({ type: 'play', call: null }), 900);
          return;
        } else {
          autoRun(`${ot.abbr} ${n.fgDist}-yard field goal try`, () => doStep({ type: 'play', call: null }), 1100);
          return;
        }
      } else {
        const bk = tabsHTML('def');
        html = `<div class="cp-head"><span class="t">Defense · ${situ}</span><span class="pill">${GI.spotLabel(G)}</span></div>${toolHTML}${G.twoPt ? '' : tendHTML()}${impRowHTML('d')}${bk.tabs}<div class="grid">` + bk.plays.map((p) => playBtn(p, 'def')).join('')
          + `<button class="play coachc wide" data-act="dcoach">${icon('dice')}<span>Coach's Call</span><small>DC picks from the whole book</small></button></div>`;
      }
    }
    setStatus(null);
    cp.innerHTML = html;
    openSheet(true);
    cp.querySelectorAll('[data-imp]').forEach((b) => (b.onclick = () => {
      G.impArm = G.impArm || {};
      G.impArm[G.user] = G.impArm[G.user] === b.dataset.imp ? null : b.dataset.imp;
      sfx(G.impArm[G.user] ? 'armed' : 'tap'); GI.save(G); renderPanel(n);
    }));
    cp.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { bookTab[b.dataset.kind] = b.dataset.tab; sfx('tap'); renderPanel(n); }));
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
      if (a === 'spike') doStep({ type: 'spike' });
      if (a === 'kneel') doStep({ type: 'kneel' });
      if (a === 'runout') doStep({ type: 'runout' });
      if (a === 'to') { const saved = GI.callTimeout(G, G.user); if (saved !== false) { sfx('whistle'); toast(`⏱ Timeout! Saved ${saved}s · ${G.to[G.user]} left`, 1600); renderSB(); GI.save(G); renderPanel(GI.need(G)); } }
      if (a === 'hurry') { GI.setHurry(G, !G.hurry[G.user]); toast(G.hurry[G.user] ? '⏩ Hurry-up: snaps come fast, slightly sloppier' : 'Huddling up again', 1400); renderPanel(GI.need(G)); }
      if (a === 'coach') { const c = coachCall(); toast(`OC calls: ${GI.playName(c)}`, 1200); doStep({ type: 'play', call: c }); }
      if (a === 'dcoach') { const c = coachDefCall(); toast(`DC calls: ${GI.playName(c)}`, 1200); doStep({ type: 'play', call: c }); }
    }));
    const tb = $('#tendBtn'); if (tb) tb.onclick = () => showTendency();
    tipOnce('calls', n.kind === 'call');
    tipOnce('tend', n.kind === 'call' && G.cpuLog && G.cpuLog.length >= 4);
    tipOnce('clock', n.kind === 'call' && n.lateHalf);
  }
  function showTactics() {
    closePop();
    const tendOK = !G.over && G.phase === 'play' && G.cpuLog && G.cpuLog.length >= 2;
    let tend = '';
    if (tendOK) {
      const all = GI.tendency(G);
      tend = `<h3 style="margin:4px 0 6px">${esc(G.teams[other(G.user)].abbr)} on ${ord(G.down)} & ${G.toGo}</h3>${all.map((x) => `<div class="sbar"><span>${GI.playName(x.id)}</span><div><i style="width:${Math.min(100, x.p * 2.2)}%;filter:none"></i></div><b>${x.p}%</b></div>`).join('')}`;
    }
    modal(`<div class="row between"><h2>Tactics</h2>${closeBtn}</div>${tend}<h3 style="margin:14px 0 6px">Counter chart</h3>${chartHTML()}`, (s) => (s.querySelector('#mx').onclick = closeModal));
  }
  function showBox() {
    closePop();
    modal(`<div class="row between"><h2>Box Score</h2>${closeBtn}</div>${statsTable()}<h3 style="margin:14px 0 6px">${esc(G.teams[G.user].abbr)} stars</h3>${starLines(G.user)}<h3 style="margin:14px 0 6px">${esc(G.teams[other(G.user)].abbr)} stars</h3>${starLines(other(G.user))}`, (q) => (q.querySelector('#mx').onclick = closeModal));
  }
  function showTendency() {
    const all = GI.tendency(G);
    const userOff = G.poss === G.user;
    modal(`<div class="row between"><h2>Their tendencies</h2>${closeBtn}</div>
      <p class="muted" style="margin-top:-4px;font-size:13.5px">What ${G.teams[other(G.user)].abbr}'s ${userOff ? 'defensive' : 'offensive'} coordinator likes on <b>${ord(G.down)} & ${G.toGo}</b> from the ${GI.spotLabel(G)}, before he adjusts to you.</p>
      ${all.map((x) => `<div class="sbar"><span>${GI.playName(x.id)}</span><div><i style="width:${Math.min(100, x.p * 2.2)}%;filter:none"></i></div><b>${x.p}%</b></div>`).join('')}
      <p class="muted" style="font-size:12.5px">Find their most likely call, then pick the play that beats it on the counter chart.</p>`, (s) => (s.querySelector('#mx').onclick = closeModal));
  }
  function kickTip(kind) {
    const list = kind === 'ret' ? GI.RETURN_POS : GI.COVER_POS;
    const st = G.teams[G.user].stars.filter((s) => list.includes(s.pos) && !s.injured);
    const armed = st.filter((s) => s.armed), full = st.filter((s) => s.meter >= 100 && !s.armed);
    const mv = GI.KICK_MOVES[kind].name;
    const lbl = list.map((p) => GI.POS[p].label).join('/');
    if (armed.length) return `<p class="kicktip ok">★ ${GI.shortName(armed[0].name)} is armed for <b>${mv}</b></p>`;
    if (full.length) return `<p class="kicktip fire">🔥 ${GI.shortName(full[0].name)} is on fire — ${pref('autoArm', true) ? 'auto-arm will fire him up' : 'tap his ring to arm'} <b>${mv}</b></p>`;
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
    const pw = GI.spreadOff(w, st);
    G.hist.off.slice(0, 2).forEach((c) => { if (pw[c] != null) pw[c] *= 0.35; });
    for (const k in pw) if (armedFor(k)) pw[k] *= 3;
    return GI.util.wpick(pw);
  }
  function coachDefCall() {
    const w = { man: 18, zone: 22, deep: 14, press: 14, blitz_in: 14, blitz_out: 14 };
    const st = G.teams[G.user].coaches.dc.style;
    if (G.toGo >= 8) { w.deep *= 1.8; w.zone *= 1.4; }
    if (G.toGo <= 2) { w.blitz_in *= 1.8; w.blitz_out *= 1.4; w.deep *= 0.4; }
    const pw = GI.spreadDef(w, st);
    G.hist.def.slice(0, 2).forEach((c) => { if (pw[c] != null) pw[c] *= 0.35; });
    return GI.util.wpick(pw);
  }

  // ---------- key moments: skip the routine snaps ----------
  async function fastForward(reason) {
    busy = true;
    openSheet(false);
    setStatus(reason || '⏩ Simming to the next key moment…');
    const u = G.user, before = { us: G.score[u], them: G.score[other(u)] };
    GI.finishAuto(G, (g) => !!GI.keyMoment(g) || g.over);
    const plays = G.lastAuto || [];
    plays.forEach((r) => {
      if (r.crazy && r.crazy.team === u) G.crazyLog[r.crazy.name] = (G.crazyLog[r.crazy.name] || 0) + 1;
      collectReel(r);
    });
    await sleep(Math.min(900, 250 + plays.length * 40));
    const d1 = G.score[u] - before.us, d2 = G.score[other(u)] - before.them;
    if (plays.length) {
      const last = plays[plays.length - 1];
      setTicker(last);
      toast(`⏩ ${plays.length} snap${plays.length > 1 ? 's' : ''} simmed${d1 || d2 ? ` · you +${d1}, them +${d2}` : ''}`, 1800);
    }
    setStatus(null);
    busy = false;
    GI.save(G);
    next(true);
  }
  function simUntil(cond, label) {
    if (busy || G.over) return;
    closeModal();
    busy = true;
    openSheet(false);
    setStatus(label);
    setTimeout(() => {
      const u = G.user, before = { us: G.score[u], them: G.score[other(u)] };
      GI.finishAuto(G, cond);
      (G.lastAuto || []).forEach((r) => { if (r.crazy && r.crazy.team === u) G.crazyLog[r.crazy.name] = (G.crazyLog[r.crazy.name] || 0) + 1; collectReel(r); });
      const plays = (G.lastAuto || []).length;
      if (plays) setTicker(G.lastAuto[plays - 1]);
      toast(`${plays} snap${plays === 1 ? "" : "s"} simmed · you +${G.score[u] - before.us}, them +${G.score[other(u)] - before.them}`, 2000);
      setStatus(null); busy = false; GI.save(G);
      next(true);
    }, 350);
  }

  async function next(fromSim) {
    if (!G) return;
    const n = GI.need(G);
    renderSB();
    renderRail();
    if (G.flash) {
      const f = G.flash; G.flash = null;
      GI.save(G);
      if (f === 'half') await halftime();
      else if (f === 'ot') { sfx('horn'); toast('🏈 OVERTIME — sudden death!', 2600); }
      else if (f === 'twomin') { sfx('whistle'); toast('⏱ Two-minute warning', 1800); tipOnce('clock', true); }
      else toast(`End of the ${f === 'q2' ? '1st' : '3rd'} quarter`, 1600);
      if (f === 'half') return next(fromSim);
    }
    if (n.kind === 'over') return showFinal();
    if (G.keyMode && !G.over) {
      const key = GI.keyMoment(G);
      if (!key && !fromSim) { fastForward(); return; }
      if (!key && fromSim) { fastForward(); return; }
      if (key && key !== G.lastKey) { G.lastKey = key; setStatus(null); showBanner({ title: 'KEY MOMENT', sub: key, tone: 'warn' }); }
    }
    field.showFormation(G);
    markFire();
    renderPanel(n);
  }

  function collectReel(res) {
    if (!G.seasonGame || !GI.league) return;
    const mine = res.side === G.user || (res.crazy && res.crazy.team === G.user) || (res.clash && res.clash.winSide === G.user);
    const score = GI.league.reelScore(res) + (mine ? 3 : -5);
    if (score < 6 || res.kind === 'penalty' || res.kind === 'runout') return;
    G.reelCands.push({ res: JSON.parse(JSON.stringify(res)), score, user: G.user, home: G.teams.home.idx, away: G.teams.away.idx, text: res.text });
    G.reelCands.sort((a, b) => b.score - a.score);
    if (G.reelCands.length > 4) G.reelCands.length = 4;
  }

  async function doStep(act) {
    if (busy) return;
    busy = true;
    clearTimeout(autoTimer);
    closePop();
    openSheet(false); setStatus(null);
    const before = {};
    G.teams[G.user].stars.forEach((s) => (before[s.id] = s.meter));
    if (pref('autoArm', true)) {
      const armed = GI.autoArm(G, act);
      if (armed.length) { sfx('armed'); toast(`★ Auto-armed: ${armed.map((s) => GI.shortName(s.name)).join(' & ')}`, 1300); }
    }
    const res = GI.step(G, act);
    if (res.crazy && res.crazy.team === G.user) G.crazyLog[res.crazy.name] = (G.crazyLog[res.crazy.name] || 0) + 1;
    collectReel(res);
    try {
      if (res.kind === 'setup2') toast('Going for two! Pick a play.', 1500);
      if (res.impact && res.impact.some((f) => f.side === G.user)) G.impUsed = true;
      if (res.impact && SPEEDS[speedIdx] < 99) impactFlash(res.impact);
      await field.runPlay(res, G);
      if (res.matrix != null && SPEEDS[speedIdx] < 99) reveal(res);
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
      // slow-motion replay for your stars' big moments
      const mineShow = (res.crazy && res.crazy.team === G.user) || (res.clash && res.clash.winSide === G.user);
      if (mineShow && pref('replays', true) && SPEEDS[speedIdx] < 99 && !G.keyModeSkipping) await replay(res);
      if (res.record) { sfx('horn'); await showBanner({ title: 'NEW RECORD!', sub: `${GI.shortName(res.record.name)}: ${res.record.v.toLocaleString()} ${GI.STAT_NAME[res.record.key]} in a game`, tone: 'warn', star: true }); }
      if (res.milestone) { sfx('star'); await showBanner({ title: 'MILESTONE!', sub: `${GI.shortName(res.milestone.name)}: ${res.milestone.th.toLocaleString()} career ${GI.STAT_NAME[res.milestone.key]}`, tone: 'warn', star: true }); }
    } catch (e) { console.error(e); }
    setTicker(res);
    if (res.injury) res.injury.forEach((i) => toast(`🚑 ${G.teams[i.side].abbr} ${GI.POS[i.pos].label} ${i.name} injured — out for the game`, 2800));
    if (res.driveSum && !G.keyModeSkipping) driveChip(res.driveSum);
    if (res.cooled) res.cooled.forEach((c) => { if (c.side === G.user) toast(`🧊 ${c.name} cooled off after two bad plays`, 2200); });
    const nowFire = G.teams[G.user].stars.filter((s) => !s.injured && s.meter >= 100 && before[s.id] < 100);
    if (nowFire.length) { sfx('fire'); toast(`🔥 ${nowFire.map((s) => GI.shortName(s.name)).join(' & ')} ${nowFire.length > 1 ? 'are' : 'is'} ON FIRE${pref('autoArm', true) ? '' : ' — tap their ring to arm'}`, 2600); tipOnce('rail', true); }
    if (G.over && !G.seasonGame) GI.clearSave(); else GI.save(G);
    busy = false;
    tipOnce('ticker', res.matrix != null);
    next();
  }
  function driveChip(d) {
    $$('.drivechip').forEach((x) => x.remove());
    const el = document.createElement('div');
    const good = (d.how === 'Touchdown' || d.how === 'Field goal') === (d.side === G.user);
    el.className = 'drivechip ' + (good ? 'good' : 'bad');
    el.innerHTML = `<b>${esc(G.teams[d.side].abbr)} drive</b><span>${d.plays} plays · ${d.yds} yds · ${GI.clockStr(d.secs)}</span><i>${d.how}</i>`;
    $('#bannerHost').appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }
  // the reveal: what they called, and why it worked (or didn't)
  function reveal(res) {
    const host = $('#bannerHost');
    const userOff = res.side === G.user;
    const m = userOff ? res.matrix : -res.matrix;
    const their = userOff ? (res.dcall || res.def) : (res.call || res.off);
    const cls = m >= 1 ? 'good' : m <= -1 ? 'bad' : '';
    const why = res.reason && Math.abs(res.matrix) === 2 ? res.reason : m >= 1 ? 'Your call had the edge' : m <= -1 ? 'Their call had the edge' : 'Even matchup';
    const el = document.createElement('div');
    el.className = 'reveal ' + cls;
    el.innerHTML = `<small>They called</small><b>${GI.playName(their)}</b><span>${why}</span>`;
    host.appendChild(el);
    setTimeout(() => el.remove(), 2300);
  }
  async function replay(res) {
    const c = res.crazy || {};
    const card = document.createElement('div');
    card.className = 'replaycard';
    const team = G.teams[c.team || G.user];
    card.innerHTML = `<span class="rp-tag">⟲ REPLAY</span><div class="rp-body"><span class="rp-num" style="background:${teamColors(team).c1};color:${GI.inkOn(teamColors(team).c1)}">${c.num != null ? c.num : '★'}</span><span><b>${esc(c.full || c.name || (res.clash ? res.clash.winner : ''))}</b><small>${c.pos ? GI.POS[c.pos].label + ' · ' : ''}${esc(c.title || 'Star Clash')}</small></span></div>`;
    $('#bannerHost').appendChild(card);
    const sp = field.speed;
    field.speed = 0.42;
    try { await field.runPlay(res, G, true); } catch (e) {}
    field.speed = sp;
    card.remove();
  }

  function setTicker(res) {
    if (!res.text) return;
    let tag = '';
    if (res.matrix != null) {
      const m = res.side === G.user ? res.matrix : -res.matrix;
      tag = { 2: '<span class="pill green">Beat it</span>', 1: '<span class="pill green" style="opacity:.75">Edge</span>', 0: '<span class="pill">Even</span>', '-1': '<span class="pill red" style="opacity:.75">Tough</span>', '-2': '<span class="pill red">Countered</span>' }[m];
      if (res.potw) tag += '<span class="pill gold">POTW</span>';
      if (res.cpuPotw) tag += '<span class="pill red">Their POTW</span>';
      (res.impact || []).forEach((f) => (tag += `<span class="pill ${f.side === G.user ? 'gold' : 'red'}">${f.side === G.user ? 'Impact' : 'Their Impact'}</span>`));
      if (res.predictable) tag += '<span class="pill red">Predictable</span>';
    }
    $('#ticker').innerHTML = `<span class="txt">${res.text}</span>${tag ? `<span class="tags">${tag}</span>` : ''}`;
  }

  let bannerDone = null;
  function showBanner(b) {
    return new Promise((resolve) => {
      const host = $('#bannerHost');
      host.querySelectorAll('.banner').forEach((x) => x.remove());
      const el = document.createElement('div');
      el.className = `banner ${b.star ? 'star' : b.tone}`;
      el.innerHTML = `<div class="b">${b.title}</div>${b.sub ? `<div class="s">${b.sub}</div>` : ''}`;
      host.appendChild(el);
      const ms = SPEEDS[speedIdx] >= 99 ? 750 : 1350 / Math.sqrt(SPEEDS[speedIdx]);
      const timer = setTimeout(() => bannerDone && bannerDone(), ms);
      bannerDone = () => { clearTimeout(timer); el.remove(); bannerDone = null; resolve(); };
    });
  }
  function dismissBanner() { if (bannerDone) bannerDone(); }

  function statsTable() {
    const L = G.teams.away, R = G.teams.home, a = G.stats.away, h = G.stats.home;
    const rows = [['Total yards', 'yds'], ['Passing', 'pass'], ['Rushing', 'rush'], ['First downs', 'first'], ['Turnovers', 'to'], ['Sacks taken', 'sacks']];
    return `<table class="stat-t"><tr><td>${L.abbr}</td><td></td><td>${R.abbr}</td></tr>${rows.map(([n, k]) => `<tr><td>${a[k]}</td><td>${n}</td><td>${h[k]}</td></tr>`).join('')}<tr><td>${GI.clockStr(a.top)}</td><td>Possession</td><td>${GI.clockStr(h.top)}</td></tr></table>`;
  }
  function starLines(side) {
    const t = G.teams[side];
    const rows = Object.values(G.ps || {}).filter((p) => p.side === side && t.stars.some((s) => s.id === p.id)).map((p) => ({ p, line: GI.league.statLine(p), v: GI.league.statScore(p) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 5);
    if (!rows.length) return '<p class="muted" style="font-size:13px;margin:0">No star stat lines.</p>';
    return `<ul class="slines">${rows.map((x) => `<li><span class="pp-pos">${GI.POS[x.p.pos].label}</span><b>${GI.shortName(x.p.name)}</b><span>${x.line}</span></li>`).join('')}</ul>`;
  }
  function halftime() {
    openSheet(false); setStatus(null);
    return new Promise((resolve) => {
      $('#modal').dataset.lock = '1';
      sfx('horn');
      G.potwLeft = { off: Math.max(G.potwLeft.off, 1), def: Math.max(G.potwLeft.def, 1) };
      const hints = GI.adjustHints(G);
      let pickAdj = G.adj[G.user] || null;
      const theirs = G.adj[other(G.user)];
      const draw = (s) => {
        s.innerHTML = `<h2>Halftime</h2><div class="row between" style="margin-bottom:10px"><span class="disp" style="font-size:22px">${G.teams.away.abbr} ${G.score.away} — ${G.score.home} ${G.teams.home.abbr}</span></div>${statsTable()}<div class="label" style="margin:12px 0 6px">First-half leaders</div>${starLines(G.user)}
          <p class="muted" style="font-size:13.5px">${halftimeQuote()}</p>
          <h3 style="margin:12px 0 4px">📋 Make one adjustment</h3>
          <div class="adjgrid">${Object.keys(GI.ADJUST).map((k) => { const a = GI.ADJUST[k]; return `<button class="adj ${pickAdj === k ? 'on' : ''}" data-adj="${k}"><b>${a.icon} ${a.name}</b><small>${a.desc}</small>${hints[k] ? `<em>✔ ${hints[k]}</em>` : ''}</button>`; }).join('')}</div>
          ${theirs ? `<p class="muted" style="font-size:13px;margin:10px 0 0">🕵️ Word from their locker room: <b>${GI.ADJUST[theirs].name}</b>.</p>` : ''}
          <p class="muted" style="font-size:12.5px">At least 1 Play of the Week rep restored on each side.</p>
          <button class="btn gold block" id="go2">${pickAdj ? 'Start 2nd Half ▶' : 'Skip — no changes ▶'}</button>`;
        s.querySelectorAll('[data-adj]').forEach((b) => (b.onclick = () => { pickAdj = b.dataset.adj; sfx('select'); draw(s); }));
        s.querySelector('#go2').onclick = () => { if (pickAdj) GI.setAdjust(G, G.user, pickAdj); closeModal(); GI.save(G); resolve(); };
      };
      modal('', draw);
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
    openSheet(false); setStatus(null); closePop(); removeTip();
    const u = G.user, o = other(u);
    const d = G.score[u] - G.score[o];
    sfx(d > 0 ? 'td' : d < 0 ? 'bad' : 'horn');
    const wl = d > 0 ? ['VICTORY!', 'var(--green)'] : d < 0 ? ['DEFEAT', 'var(--red)'] : ['TIE GAME', 'var(--ink)'];
    const ut = G.teams[u];
    let mvp = null, best = 0;
    for (const k in (G.crazyLog || {})) if (G.crazyLog[k] > best) { best = G.crazyLog[k]; mvp = k; }
    const mvpStar = mvp ? ut.stars.find((s) => GI.shortName(s.name) === mvp) : ut.stars.find((s) => s.pos === 'QB');
    const season = G.seasonGame && S;
    if (!season && GI.legacy) { // quick games fill the album too
      ['home', 'away'].forEach((side) => GI.legacy.collect(G.teams[side].stars.map((s) => ({ key: 'c:' + s.id, name: s.name, pos: s.pos, num: s.num, rating: s.rating, team: G.teams[side].abbr, tname: G.teams[side].name, c1: G.teams[side].c1, c2: G.teams[side].c2, glyph: G.teams[side].glyph || GI.TEAM_GLYPH[G.teams[side].idx], ti: G.teams[side].idx }))));
      if (d > 0 && !G.lpGiven) { G.lpGiven = true; GI.legacy.addLP(G.diff === 'legend' ? 3 : G.diff === 'pro' ? 2 : 1, 'Quick game win'); }
    }
    if (d > 0 && !G.dailyGiven) { G.dailyGiven = true; GI.legacy.dailyWin(); }
    // quick-game record with each team
    let qline = '';
    if (!season && !G.friend && !G.recCounted) {
      G.recCounted = true;
      const qr = Object.assign({}, GI.prefs.get().qrec || {});
      const k = String(ut.idx), r = Object.assign({ w: 0, l: 0, t: 0, st: 0, best: 0 }, qr[k]);
      if (d > 0) { r.w++; r.st = Math.max(1, r.st + 1); } else if (d < 0) { r.l++; r.st = Math.min(-1, r.st - 1); } else { r.t++; r.st = 0; }
      r.best = Math.max(r.best, r.st);
      qr[k] = r; GI.prefs.set({ qrec: qr });
      G.qrec = r;
    }
    if (!season && G.qrec) { const r = G.qrec; qline = `<p class="qrec">Your ${esc(ut.name)}: <b>${r.w}-${r.l}${r.t ? '-' + r.t : ''}</b>${r.st >= 2 ? ` · 🔥 ${r.st}-game win streak` : r.st <= -2 ? ` · ${-r.st} straight losses` : ''}${r.best >= 3 ? ` · best streak ${r.best}` : ''}</p>`; }
    const recs = (G.records || []).concat(G.milestones || []);
    $('#finalBody').innerHTML = `
      <div class="sticker result"><div class="wl" style="background:${wl[1]}">${wl[0]}</div>
        <div class="fs">${helmet(G.teams.away, 'md')}<span>${G.score.away}</span><span class="muted" style="font-size:28px">—</span><span>${G.score.home}</span>${helmet(G.teams.home, 'md', { flip: true })}</div>
        <p class="muted" style="margin:14px 0 0">${G.label ? G.label + ' · ' : ''}${G.ot ? 'Final / OT' : 'Final'} · ${G.venue ? esc(G.venue.name) + ' · ' : ''}${GI.WEATHER[G.weather].icon} ${GI.WEATHER[G.weather].name} · ${G.crowd.name} crowd</p>${qline}
        ${linescore()}</div>
      ${flowChart()}
      ${mvpStar ? `<div class="sticker panel"><div class="label">Star of the game</div><h3 style="margin:4px 0 0">★ ${mvpStar.name} <span class="muted" style="font-size:15px">${GI.POS[mvpStar.pos].label} #${mvpStar.num}</span></h3>${best ? `<p class="muted" style="margin:4px 0 0">${best} Show-Me play${best > 1 ? 's' : ''}</p>` : ''}</div>` : ''}
      ${recs.length ? `<div class="sticker panel"><h3>${GI.ico('scroll')} History made</h3><ul class="slines">${recs.map((r) => `<li><span class="pp-pos">${r.th ? '🏅' : '📜'}</span><b>${GI.shortName(r.name)}</b><span>${r.th ? `${r.th.toLocaleString()} career ${GI.STAT_NAME[r.key]}` : `record ${r.v} ${GI.STAT_NAME[r.key]}`}</span></li>`).join('')}</ul></div>` : ''}
      <div class="sticker panel"><h3>${ut.abbr} star lines</h3>${starLines(u)}</div>
      <div class="sticker panel">${statsTable()}</div>
      <div style="display:grid;gap:12px">${season ? '<button class="btn gold block" id="fGazette">📰 Read the Gazette ▶</button>' : G.friend ? '<div id="friendFinal"></div><div class="menu-duo"><button class="btn" id="fFriends">Friends</button><button class="btn ghost" id="fMenu">Main Menu</button></div>' : '<div class="menu-duo"><button class="btn gold" id="fRematch">Rematch</button><button class="btn" id="fSwap">Swap sides</button></div><button class="btn block" id="fNew">New Matchup</button><div class="menu-duo"><button class="btn ghost" id="fShare">Share result</button><button class="btn ghost" id="fMenu">Main Menu</button></div>'}</div>`;
    show('final');
    if (GI.UI.shareToasts) setTimeout(GI.UI.shareToasts, 600);
    if (season) {
      $('#fGazette').onclick = () => {
        if (G.seasonDone) { GI.UI.renderHub(); show('hub'); return; }
        const go = () => {
          G.seasonDone = true;
          const paper = SN.finishWeek(S, G);
          GI.clearSave();
          showPaper(paper, true);
        };
        const pc = GI.league.pressFor(S, G);
        if (pc) pressConference(pc, go); else go();
      };
      return;
    }
    GI.clearSave();
    if (G.friend) {
      $('#fFriends').onclick = () => GI.UI.openFriends();
      $('#fMenu').onclick = () => { refreshTitle(); show('title'); };
      GI.UI.friendFinal(G);
      return;
    }
    const hi = G.teams[u].idx, oi = G.teams[o].idx;
    $('#fRematch').onclick = () => { setup.user = hi; startPregame(quickOpts(hi, oi)); };
    $('#fSwap').onclick = () => { setup.user = oi; startPregame(quickOpts(oi, hi)); };
    $('#fShare').onclick = () => shareResult();
    $('#fNew').onclick = () => { setup.mode = 'quick'; setup.step = 'user'; renderPick(); show('pick'); };
    $('#fMenu').onclick = () => { refreshTitle(); show('title'); };
  }
  // ---------- final-screen extras ----------
  function linescore() {
    const fl = G.flow || []; if (fl.length < 2 || fl[0].length < 3) return '';
    const qs = Math.max(4, Math.min(5, G.q));
    const at = (t) => { let r = [0, 0]; for (const f of fl) { if (f[0] <= t) r = [f[1], f[2]]; else break; } return r; };
    const cols = []; let prev = [0, 0];
    for (let q = 1; q <= qs; q++) { const cur = q === qs ? [G.score.home, G.score.away] : at(q * G.qLen); cols.push([cur[0] - prev[0], cur[1] - prev[1]]); prev = cur; }
    const row = (side, k) => `<tr><th>${esc(G.teams[side].abbr)}</th>${cols.map((c) => `<td>${c[k]}</td>`).join('')}<td class="tot">${G.score[side]}</td></tr>`;
    return `<table class="lscore"><tr><th></th>${cols.map((_, i) => `<th>${i < 4 ? 'Q' + (i + 1) : 'OT'}</th>`).join('')}<th>T</th></tr>${row('away', 1)}${row('home', 0)}</table>`;
  }
  function flowChart() {
    const fl = (G.flow || []).filter((f) => f.length >= 3); if (fl.length < 4) return '';
    const W = 320, H = 90, end = Math.max(fl[fl.length - 1][0], G.qLen * 4);
    const m = fl.map((f) => f[1] - f[2]);
    const mx = Math.max(7, ...m.map(Math.abs));
    const X = (t) => (t / end) * W, Y = (v) => H / 2 - (v / mx) * (H / 2 - 6);
    let d = `M0 ${H / 2}`; fl.forEach((f, i) => { d += ` L${X(f[0]).toFixed(1)} ${Y(m[i]).toFixed(1)}`; });
    const hc = G.teams.home.c1, ac = G.teams.away.c1;
    return `<div class="sticker panel"><div class="row between"><h3>📈 Game flow</h3><span class="label">${esc(G.teams.home.abbr)} ▲ · ▼ ${esc(G.teams.away.abbr)}</span></div>
      <svg class="flow" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Score margin over time">
        <defs><clipPath id="fUp"><rect width="${W}" height="${H / 2}"/></clipPath><clipPath id="fDn"><rect y="${H / 2}" width="${W}" height="${H / 2}"/></clipPath></defs>
        ${[1, 2, 3].map((q) => `<line x1="${X(q * G.qLen)}" x2="${X(q * G.qLen)}" y1="0" y2="${H}" stroke="currentColor" stroke-opacity=".12"/>`).join('')}
        <line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" stroke="currentColor" stroke-opacity=".3"/>
        <path d="${d} L${W} ${Y(m[m.length - 1])} L${W} ${H / 2} Z" fill="${hc}" fill-opacity=".45" clip-path="url(#fUp)"/>
        <path d="${d} L${W} ${Y(m[m.length - 1])} L${W} ${H / 2} Z" fill="${ac}" fill-opacity=".45" clip-path="url(#fDn)"/>
        <path d="${d}" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/>
      </svg></div>`;
  }
  async function shareResult() {
    const u = G.user, o = other(u);
    const txt = `🏈 Grid Iron: ${G.teams[u].city} ${G.teams[u].name} ${G.score[u]}, ${G.teams[o].city} ${G.teams[o].name} ${G.score[o]}${G.ot ? ' (OT)' : ''} at ${G.venue ? G.venue.name : 'the stadium'} ${GI.WEATHER[G.weather].emoji || ''}`;
    try {
      if (navigator.share) { await navigator.share({ text: txt }); return; }
      await navigator.clipboard.writeText(txt); toast('📋 Result copied');
    } catch (e) { if (e && e.name !== 'AbortError') modal(`<div class="row between"><h2>Share</h2>${closeBtn}</div><textarea class="codebox" readonly>${esc(txt)}</textarea>`, (m) => (m.querySelector('#mx').onclick = closeModal)); }
  }
  function pressConference(pc, done) {
    $('#modal').dataset.lock = '1';
    sfx('paper');
    modal(`<div class="presser"><span class="pill ${pc.win ? 'green' : 'red'}">🎙️ ${pc.trig}</span><h2 style="margin-top:8px">Press Conference</h2><p class="muted" style="margin-top:-4px">${pc.prompt}</p>
      <div class="pq">${pc.choices.map((c) => `<button class="pqbtn" data-pc="${c.id}"><span class="label">${c.label}</span><b>“${esc(c.quote)}”</b><small>${c.desc}</small></button>`).join('')}</div></div>`, (s) => {
      s.querySelectorAll('[data-pc]').forEach((b) => (b.onclick = () => { GI.league.pressChoose(S, pc, b.dataset.pc); closeModal(); sfx('select'); done(); }));
    });
  }

  // ---------- coach tips (first games) ----------
  const TIPS = {
    calls: 'Pick a play. Every call beats some looks and has one hard counter. ☰ → Counter Chart shows them all.',
    ticker: 'After each snap you see what they called — and why it worked or didn\'t. Tap the ticker for the play-by-play.',
    rail: 'Those rings are your stars\' Show-Me meters. Full ring = 🔥. Tap a ring to see his move (auto-arm can fire him for you).',
    tend: 'This strip shows what they like in this exact down & distance. Guess their call, then pick its counter.',
    clock: 'Crunch time: call ⏱ timeouts to save the clock, ⏩ hurry up, 🏈 spike it — or 🧎 kneel to run it out with a lead.',
  };
  let tipQueue = null;
  function tipOnce(key, cond) {
    if (!cond || !pref('tips', true)) return;
    const done = GI.prefs.get().tipsDone || [];
    if (done.includes(key) || $('.coachtip')) return;
    const el = document.createElement('div');
    el.className = 'coachtip sticker';
    el.innerHTML = `<span class="ct-ic">🧢</span><p>${TIPS[key]}</p><button class="btn small gold">Got it</button>`;
    $('#game').appendChild(el);
    el.querySelector('button').onclick = (e) => { e.stopPropagation(); GI.prefs.set({ tipsDone: done.concat([key]) }); el.remove(); };
    updateInsets();
  }
  function removeTip() { $$('.coachtip').forEach((x) => x.remove()); }

  // ---------- modals ----------
  function showLog() {
    modal(`<div class="row between"><h2>Play-by-Play</h2>${closeBtn}</div><ul class="log">${G.log.map((l) => `<li class="${l.type}"><span class="q">${GI.qLabel(l.q)} ${GI.clockStr(l.clock)}</span><span>${l.text}</span></li>`).join('')}</ul>`, (s) => (s.querySelector('#mx').onclick = closeModal));
  }
  function showMenu() {
    closePop();
    const userPoss = G.poss === G.user;
    const V = G.venue;
    modal(`<h2>Timeout</h2>${V ? `<p class="muted" style="margin:-4px 0 12px;font-size:13px">🏟️ ${esc(V.name)} · ${GI.WEATHER[G.weather].icon} ${GI.WEATHER[G.weather].name} · ${G.crowd.name} crowd · ${GI.qLabel(G.q)} ${GI.clockStr(G.clock)}</p>` : ''}<div style="display:grid;gap:10px">
      <button class="btn gold block" id="m1">Resume</button>
      <div class="menu-sims"><button class="btn ghost small" id="mDrive">⏩ Sim this drive</button><button class="btn ghost small" id="mHalf">⏩ Sim to ${G.q <= 2 ? 'halftime' : 'the end'}</button></div>
      <button class="btn ghost small block" id="mKey">${G.keyMode ? '🎯 Key moments: ON — play every snap' : '🎯 Switch to key moments only'}</button>
      <div class="menu-sims"><button class="btn ghost small" id="m6">Play-by-Play</button><button class="btn ghost small" id="m5">Box Score</button></div>
      <div class="menu-sims"><button class="btn ghost small" id="m2">Counter Chart</button><button class="btn ghost small" id="m3">How to Play</button></div>
      <button class="btn ghost small block" id="m7">Settings</button>
      <button class="btn red block" id="m4">Save & Quit</button></div>`, (s) => {
      s.querySelector('#m1').onclick = closeModal;
      s.querySelector('#m6').onclick = showLog;
      s.querySelector('#m2').onclick = () => showChart(true);
      s.querySelector('#m3').onclick = () => showHelp();
      s.querySelector('#m7').onclick = () => showSettings(true);
      s.querySelector('#m5').onclick = showBox;
      s.querySelector('#m4').onclick = () => { GI.save(G); closeModal(); clearTimeout(autoTimer); removeTip(); refreshTitle(); show('title'); };
      s.querySelector('#mKey').onclick = () => { G.keyMode = !G.keyMode; GI.prefs.set({ keyMode: G.keyMode }); closeModal(); renderBar(); toast(G.keyMode ? '🎯 Key moments only' : 'Calling every snap', 1400); if (!busy) next(); };
      const startPoss = G.poss, startQ = G.q;
      s.querySelector('#mDrive').onclick = () => simUntil((g) => g.poss !== startPoss || g.phase === 'kickoff' || g.over, `⏩ Simming the ${userPoss ? 'drive' : 'defensive series'}…`);
      s.querySelector('#mHalf').onclick = () => simUntil(startQ <= 2 ? (g) => g.q >= 3 || g.over : (g) => g.over || g.q > startQ + 10, startQ <= 2 ? '⏩ Simming to halftime…' : '⏩ Simming to the final whistle…');
    });
  }
  function chartHTML() {
    if (GI.FORMATIONS) {
      return GI.FORMATIONS.map((f) => `<div class="cbook"><div class="label">${f.name}</div>${GI.OFF_PLAYS.filter((p) => p.form === f.id).map((p) => `<div class="crow"><span class="ci">${icon(p.id)}</span><b>${p.name}</b><span class="cw"><i class="m2">Stopped by</i> ${GI.playName(p.counter)}</span><span class="cw"><i class="p2">Gashes</i> ${GI.playName(p.gash)}</span></div>`).join('')}</div>`).join('')
        + '<p class="muted" style="font-size:12.5px">Every play has exactly one call that shuts it down and one it carves up. Everything else is close to even, so talent decides it.</p>';
    }
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
    const row = (key, title, sub, def) => { const on = p[key] === undefined ? def !== false : p[key] !== false; return `<div class="set-row"><div><b>${title}</b><small>${sub}</small></div><button class="switch ${on ? 'on' : ''}" data-key="${key}" role="switch" aria-checked="${on}" aria-label="${title}"></button></div>`; };
    const theme = p.theme || 'auto';
    modal(`<div class="row between"><h2>Settings</h2>${closeBtn}</div>
      ${row('sfx', 'Sound effects', 'Hits, whistles, touchdowns')}
      ${row('crowd', 'Crowd noise', 'Stadium ambience during games')}
      ${row('music', 'Menu music', 'Groove on the menus')}
      ${row('haptics', 'Vibration', 'Buzz on big plays (Android)')}
      ${row('autoArm', 'Auto-arm stars', 'On-fire stars fire on the next snap where they matter')}
      ${row('replays', 'Show-Me replays', 'Slow-motion replay of your stars’ big moments')}
      ${row('tips', 'Coach tips', 'Pop-up hints in your first games')}
      ${row('calm', 'Reduce motion', 'No screen shake or flashes on big plays', false)}
      ${row('hiLines', 'High-contrast lines', 'White line of scrimmage, orange line to gain', false)}
      <div class="set-row"><div><b>Theme</b><small>Menus and panels</small></div><div class="seg" id="themeSeg" style="width:170px"><button data-v="auto">Night</button><button data-v="light">Day</button></div></div>
      <div class="backup"><b>💾 Backup & restore</b><p class="muted" style="margin:4px 0 10px;font-size:13px">Phones can clear website data. Save a backup of your franchise, album and Legacy Points — and restore it on any device.</p>
        <div class="menu-sims"><button class="btn gold small" id="bkFile">⬇ Download file</button><button class="btn ghost small" id="bkCode">📋 Copy code</button></div>
        <div class="menu-sims" style="margin-top:8px"><button class="btn ghost small" id="bkLoad">⬆ Restore file</button><button class="btn ghost small" id="bkPaste">📥 Paste code</button></div>
        <input type="file" id="bkInput" accept=".json,.txt,application/json" hidden></div>
      <div class="danger"><b>Reset all data</b><p class="muted" style="margin:4px 0 10px;font-size:13px">Deletes your franchise, saved game, trophies, album, Legacy Points and every setting on this device. This can't be undone.</p><button class="btn red small" id="resetBtn">Reset everything</button></div>`, (s) => {
      s.querySelector('#mx').onclick = fromGame ? showMenu : closeModal;
      s.querySelectorAll('.switch').forEach((b) => (b.onclick = () => {
        const on = !b.classList.contains('on');
        b.classList.toggle('on', on); b.setAttribute('aria-checked', on);
        GI.prefs.set({ [b.dataset.key]: on });
        if (b.dataset.key === 'tips' && on) GI.prefs.set({ tipsDone: [] });
        GI.audio.refresh();
      }));
      s.querySelectorAll('#themeSeg button').forEach((b) => {
        b.classList.toggle('on', b.dataset.v === theme);
        b.onclick = () => { s.querySelectorAll('#themeSeg button').forEach((x) => x.classList.toggle('on', x === b)); GI.prefs.set({ theme: b.dataset.v }); applyTheme(); };
      });
      s.querySelector('#bkFile').onclick = () => {
        if (G && !G.over && $('#game').classList.contains('on')) GI.save(G);
        const blob = new Blob([GI.legacy.exportData()], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = `gridiron-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
        toast('Backup downloaded 💾');
      };
      s.querySelector('#bkCode').onclick = async () => {
        const code = await GI.legacy.exportCode();
        try { await navigator.clipboard.writeText(code); toast(`Backup code copied (${Math.round(code.length / 1024)} KB) 📋`); }
        catch (e) { modal(`<div class="row between"><h2>Backup code</h2>${closeBtn}</div><p class="muted">Copy all of this and keep it somewhere safe.</p><textarea class="codebox" readonly>${code}</textarea>`, (q) => { q.querySelector('#mx').onclick = closeModal; q.querySelector('textarea').select(); }); }
      };
      const restore = async (text) => {
        try { await GI.legacy.importAny(text); toast('Restored! Reloading…'); setTimeout(() => location.reload(), 700); }
        catch (e) { toast('That doesn\'t look like a Grid Iron backup'); }
      };
      s.querySelector('#bkLoad').onclick = () => s.querySelector('#bkInput').click();
      s.querySelector('#bkInput').onchange = (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => restore(r.result); r.readAsText(f); };
      s.querySelector('#bkPaste').onclick = () => modal(`<div class="row between"><h2>Restore from code</h2>${closeBtn}</div><p class="muted">Paste your backup code. This replaces everything on this device.</p><textarea class="codebox" id="pasteBox" placeholder="GI1:…"></textarea><button class="btn green block" id="pasteGo" style="margin-top:10px">Restore</button>`, (q) => {
        q.querySelector('#mx').onclick = closeModal;
        q.querySelector('#pasteGo').onclick = () => restore(q.querySelector('#pasteBox').value);
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
      <p>Build a <b>Franchise</b> (drafts, contracts, trades, the Iron-Bowl) or jump into an <b>Exhibition</b>. Talent comes first: the better team wins most of the time, so building your roster is how you win. Good play-calling is how you steal the close ones.</p>
      <h3>🧠 The playbook</h3><p>Twelve plays in four <b>formations</b> (I-Form, Shotgun, Singleback, Trick Bag) and twelve calls in four <b>defensive packages</b> (4-3, Nickel, Dime, Blitz). Switch with the tabs on the play sheet. Every play has <b>exactly one</b> call that shuts it down and one it carves up. After every snap you see <b>what they called and why</b>. The play sheet shows their <b>tendencies</b>; the Gazette's <b>scouting report</b> sometimes leaks their go-to play. Read it, then call the counter.</p>${chartHTML()}
      <p>Down & distance matter: on 3rd & long they expect a pass (runs catch them napping); short yardage favors power runs and play-action shots; the red zone squeezes deep balls. Call the same play 3 snaps in a row and you get <b>read</b>.</p>
      <h3>⚡ Impact Cards</h3><p>Players rated 80+ and your two <b>captains</b> carry an Impact Card. Bring 5 to a game; tap one in the play sheet and it fires on the next snap that player is part of, raising the odds the play works (Bronze +5% up to Elite +20%). Each fires 3 times a game. Upgrade them in the Locker Room with Impact Points earned by playing. Cards rated 90+ overall are <b>Star Players</b> with a Show-Me meter.</p><h3>⏱ The clock</h3><p>The clock keeps running between snaps. Late in a half you get <b>timeouts</b> (3 per half), <b>hurry-up</b>, <b>spike</b> and <b>kneel</b>. There's a two-minute warning in the 2nd and 4th quarters.</p>
      <h3>🌊 Momentum</h3><p>Touchdowns, turnovers, sacks and star plays swing the momentum bar under the clock. Whoever has it plays a little better and the home crowd gets louder.</p>
      <h3>⭐ Star rail</h3><p>Your stars' rings fill as they make plays. At 100% a star catches fire 🔥 — arm him (or let <b>auto-arm</b> do it) and he takes over the next play where he matters. Two bad plays in a row while on fire cools him to 70%. Big moments get a slow-motion replay.</p>
      <h3>🏟️ Stadiums & weather</h3><p>Every team has a home: <b>domes</b> keep the weather out and the noise in, <b>retractable roofs</b> close when it turns ugly, and open-air parks get the climate — snow up north late in the year, heat down south early. <b>Turf</b> is fast (outside runs and deep balls get a lift); <b>grass</b> gets sloppy in rain and snow; <b>thin air</b> carries kicks and wears visitors down. The Iron-Bowl is at a neutral site. In franchise mode you can renovate and rename your building.</p>
      <h3>🎮 Controls</h3><p>The bar along the bottom: <b>Pause</b>, <b>speed</b> (1x, 2x, skip), <b>Wide</b> camera, <b>Tactics</b> (counter chart and their tendencies), <b>Stats</b> (box score) and <b>Key</b> moments. On a keyboard: <b>1–9</b> call plays, <b>Q</b>/<b>E</b> or <b>← →</b> switch formation, <b>Space</b> skips an animation, <b>T</b> timeout, <b>S</b> speed, <b>W</b> wide, <b>C</b> tactics, <b>B</b> box score, <b>Esc</b> pause/back. Your phone's back gesture works like the ← button.</p>
      <h3>📋 Halftime</h3><p>Pick one adjustment — double their top target, stack the box, protect the QB, up-tempo and more. They make one too.</p>
      <h3>🎯 Key moments</h3><p>Short on time? Choose <b>Key moments</b> before kickoff: routine snaps sim, and you take over in the red zone, on 4th down, in the two-minute drill and crunch time. ☰ also lets you sim a drive or skip to halftime.</p>
      <h3>🧩 Storylines</h3><p>Rivalries heat up when you lose to a team. Coaches who were fired or poached get revenge games. Stars facing the team that cut them play angry. Coaches who worked together know each other's playbooks. QB-receiver duos click after two seasons.</p>
      <h3>📰 The Gazette</h3><p>After every week: headline, power rankings, injuries, league news and an <b>EXTRA!</b> story — leaks, holdouts, hot seats and more. Big games end with a press conference.</p>
      <h3>🤝 Friends</h3><p>Send your franchise team's <b>team code</b> to a friend and add theirs in <b>Friends & Challenges</b>. Play their team, then send them the <b>result code</b>: it lands in their record, their rivalry heat and their Gazette. Series records and rivalries build up over time.</p><h3>🏛️ Legacy & share cards</h3><p>Win to earn <b>Legacy Points</b> for jerseys, fields, celebrations, balls and scorebugs in the Store. Records, 1,000-yard seasons, the longest pass and run in franchise history, new Star Players and titles become <b>share cards</b> you can post.</p>
      </div>`, (s) => (s.querySelector('#mx').onclick = closeModal));
  }

  // shared with the other UI files
  GI.UI = {
    $, $$, esc, show, toast, modal, closeModal, closeBtn, confirmBox, helmet, sfx, icon, sleep, ord, T, flushRewards, cardHTML, lineupStrip, impChip,
    money: (x) => SN.money(x), showPaper, showArchive, startPregame, refreshTitle, showSettings, showHelp,
    getS: () => S, setS: (x) => (S = x), getG: () => G, setG: (x) => (G = x), getField: () => field,
  };
  GI.ui = { showPaper: (p) => { S = S || SN.load(); showPaper(p, true); } }; // handy for testing
  window.addEventListener('pagehide', () => { if (G && !G.over && $('#game').classList.contains('on')) GI.save(G); });
  setTimeout(refreshTitle, 0);
})();
