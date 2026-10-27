/* Grid Iron — Legacy (Hall, sticker album, store) and Career Mode screens */
(function () {
  const GI = window.GI;
  const U = GI.UI;
  const { $, $$, esc, show, toast, modal, closeModal, closeBtn, confirmBox, helmet, sfx, T } = U;
  const CR = GI.career, Lg = GI.legacy;
  const sleep = U.sleep;

  // ================= LEGACY =================
  let lgTab = 'hall', albumTeam = null, storeCat = 'jersey';
  function openLegacy(tab) { if (tab) lgTab = tab; albumTeam = null; renderLegacy(); show('legacy'); }
  function sticker(s) {
    const shiny = (s.shiny || []).length;
    return `<div class="stk ${shiny ? 'shiny' : ''}" style="--c1:${s.c1 || '#888'};--c2:${s.c2 || '#fff'}">
      <div class="stk-top"><span class="stk-num">${s.num != null ? s.num : '★'}</span><span class="stk-pos">${GI.POS[s.pos] ? GI.POS[s.pos].label : s.pos}</span></div>
      <div class="stk-crest">${s.glyph ? `<svg viewBox="0 0 100 100">${GI.glyphSVG(s.glyph, GI.inkOn(s.c1 || '#888'), s.c1 || '#888')}</svg>` : ''}</div>
      <b>${esc(s.name)}</b><small>${esc(s.tname || s.team || '')} · ${s.rating}</small>
      ${shiny ? `<span class="stk-shine">✨ ${s.shiny.join(' · ')}</span>` : ''}</div>`;
  }
  function renderLegacy() {
    const D = Lg.get();
    const tabs = [['hall', '🏆 Hall'], ['album', '📒 Album'], ['store', '🛍️ Store']];
    let body = '';
    if (lgTab === 'hall') {
      let t = [];
      try { t = JSON.parse(localStorage.getItem('gridiron_trophies') || '[]'); } catch (e) {}
      body = `<div class="sticker panel lpcard"><div><span class="label">Legacy Points</span><b>${D.lp}</b><small>${D.earned} earned all-time</small></div><button class="btn gold small" id="toStore">Spend them ▶</button></div>
        <div class="sticker panel"><h3>🏆 Trophy shelf</h3>${t.length ? `<div class="trophies">${t.map((x) => `<div class="troph">${helmet(T(x.team), 'sm')}<span><b>${x.kind}</b><small>Year ${x.year} · ${T(x.team).name} · ${x.rec}</small></span><span class="cup">🏆</span></div>`).join('')}</div>` : '<p class="muted">No hardware yet. Win the Iron-Bowl to fill this shelf.</p>'}</div>
        <div class="sticker panel"><h3>🏛️ All-time Hall of Fame</h3>${D.hof.length ? D.hof.slice(0, 40).map((h) => `<div class="hofcard">${helmet(T(h.team), 'sm')}<div><b>${esc(h.name)}</b><small>${GI.POS[h.pos] ? GI.POS[h.pos].label : ''} · ${esc(h.tname || '')}${h.career ? ' · 🎮 your career' : ''}</small><p>${esc(h.line || '')}${h.rings ? ` · 💍×${h.rings}` : ''}</p></div></div>`).join('') : '<p class="muted">Legends get inducted when they retire — in your franchises and your careers.</p>'}</div>
        <div class="sticker panel"><h3>Recent Legacy Points</h3>${D.log.length ? `<ul class="lplog">${D.log.slice(0, 15).map((l) => `<li><b>+${l.n}</b> ${esc(l.why)}</li>`).join('')}</ul>` : '<p class="muted">Win games, hit owner goals, collect shiny stickers and win awards to earn points.</p>'}</div>`;
    } else if (lgTab === 'album') {
      const st = Lg.albumStats();
      const all = Object.values(D.album);
      if (albumTeam == null) {
        const pages = GI.TEAMS.map((t, i) => ({ t, i, n: st.teams[i] || 0 }));
        const extra = all.filter((s) => s.ti == null).length;
        body = `<div class="sticker panel albumhead"><div><b>${st.total}</b><small>stickers</small></div><div><b>${st.shiny}</b><small>shiny ✨</small></div><div><b>${Object.keys(D.pages).length}/32</b><small>pages done</small></div></div>
          <p class="muted" style="font-size:13px;margin:0">Every star you play with or against gets a sticker. MVPs, champions, Hall of Famers and your career players come out shiny. Fill a team page (8 stickers) for +10 Legacy Points.</p>
          <div class="pages">${pages.map((p) => `<button class="page ${D.pages[p.i] ? 'done' : ''}" data-pg="${p.i}">${helmet(p.t, 'sm')}<span>${p.t.abbr}</span><small>${p.n}/8</small></button>`).join('')}${extra ? `<button class="page" data-pg="x"><span class="page-ic">🎓</span><span>Other</span><small>${extra}</small></button>` : ''}<button class="page" data-pg="shiny"><span class="page-ic">✨</span><span>Shiny</span><small>${st.shiny}</small></button></div>`;
      } else {
        const list = all.filter((s) => albumTeam === 'shiny' ? (s.shiny || []).length : albumTeam === 'x' ? s.ti == null : s.ti === +albumTeam).sort((a, b) => ((b.shiny || []).length - (a.shiny || []).length) || b.rating - a.rating);
        const title = albumTeam === 'shiny' ? '✨ Shiny stickers' : albumTeam === 'x' ? 'College & other' : `${T(+albumTeam).city} ${T(+albumTeam).name}`;
        body = `<div class="row between"><button class="btn ghost small" id="pgBack">← Pages</button><b>${title}</b></div><div class="stkgrid">${list.map(sticker).join('') || '<p class="muted">Empty page. Play them to collect stickers!</p>'}</div>`;
      }
    } else {
      const cats = [['jersey', 'Jerseys'], ['field', 'Fields'], ['celebrate', 'Celebrations']];
      const fav = T(GI.prefs.get().user != null ? GI.prefs.get().user : 0);
      const preview = (cat, id) => {
        if (cat === 'jersey') { const c = { home: [fav.c1, fav.c2], throwback: [fav.c2, fav.c1], blackout: ['#202024', fav.c1], gold: ['#d9a514', fav.c1], ice: ['#eef3f8', fav.c1] }[id]; return `<span class="sw coin" style="background:${c[0]};box-shadow:0 0 0 3px ${c[1]},0 0 0 5px #fff"></span>`; }
        if (cat === 'field') { const c = { classic: ['#52b25d', '#4aa854', '#fff'], checker: ['#52b25d', fav.c1, '#fff'], retro: ['#93ad4a', '#87a243', '#fff3d1'], night: ['#2a6a33', '#14301a', '#eaf6ff'], neon: ['#121f36', '#0b1424', '#5ef2ff'] }[id]; return `<span class="sw fld" style="background:repeating-linear-gradient(0deg,${c[0]} 0 8px,${c[1]} 8px 16px);box-shadow:inset 0 0 0 2px ${c[2]}"></span>`; }
        return `<span class="sw">${{ confetti: '🎊', fireworks: '🎆', stickers: '⭐', goldrain: '🪙' }[id]}</span>`;
      };
      const items = GI.COSMETICS[storeCat];
      body = `<div class="sticker panel lpcard"><div><span class="label">Legacy Points</span><b>${D.lp}</b><small>Cosmetics show up in every mode</small></div></div>
        <div class="seg" id="catSeg">${cats.map(([k, n]) => `<button data-v="${k}" class="${storeCat === k ? 'on' : ''}">${n}</button>`).join('')}</div>
        <div class="storegrid">${Object.keys(items).map((id) => { const it = items[id], own = D.owned[storeCat].includes(id), eq = D.equip[storeCat] === id;
          return `<div class="sticker sitem ${eq ? 'eq' : ''}">${preview(storeCat, id)}<b>${it.name}</b><small>${it.desc}</small>${eq ? '<span class="pill green">Equipped</span>' : own ? `<button class="btn ghost small" data-eq="${id}">Equip</button>` : `<button class="btn ${D.lp >= it.cost ? 'gold' : 'ghost'} small" data-buy="${id}" ${D.lp >= it.cost ? '' : 'disabled'}>🏅 ${it.cost}</button>`}</div>`; }).join('')}</div>`;
    }
    $('#legacyBody').innerHTML = `<div class="topbar" style="margin-bottom:0"><button class="iconbtn" id="lgBack">←</button><h2>Legacy</h2><span class="cashpill">🏅 ${D.lp}</span></div>
      <div class="seg" id="lgTabs">${tabs.map(([k, n]) => `<button data-v="${k}" class="${lgTab === k ? 'on' : ''}">${n}</button>`).join('')}</div>${body}`;
    $('#lgBack').onclick = () => { U.refreshTitle(); show('title'); };
    $$('#lgTabs button').forEach((b) => (b.onclick = () => { lgTab = b.dataset.v; albumTeam = null; renderLegacy(); }));
    const ts = $('#toStore'); if (ts) ts.onclick = () => { lgTab = 'store'; renderLegacy(); };
    $$('#legacyBody [data-pg]').forEach((b) => (b.onclick = () => { albumTeam = b.dataset.pg; renderLegacy(); $('#legacy').scrollTop = 0; }));
    const pb = $('#pgBack'); if (pb) pb.onclick = () => { albumTeam = null; renderLegacy(); };
    $$('#catSeg button').forEach((b) => (b.onclick = () => { storeCat = b.dataset.v; renderLegacy(); }));
    $$('#legacyBody [data-buy]').forEach((b) => (b.onclick = () => { const r = Lg.buy(storeCat, b.dataset.buy); if (!r.ok) { toast(r.why); return; } sfx('td'); toast(`Unlocked: ${GI.COSMETICS[storeCat][b.dataset.buy].name}!`); refreshField(); renderLegacy(); }));
    $$('#legacyBody [data-eq]').forEach((b) => (b.onclick = () => { Lg.equip(storeCat, b.dataset.eq); sfx('select'); refreshField(); renderLegacy(); }));
  }
  function refreshField() { const f = U.getField(); if (f) f.fieldCache = null; }

  // ================= CAREER MODE =================
  let C = null, cfield = null;
  function openCareer(fromMenu) {
    C = CR.load();
    if (fromMenu && C && C.phase !== 'retired') { renderCareer(); show('career'); return; }
    if (fromMenu && C && C.phase === 'retired') { renderCareer(); show('career'); return; }
    if (!C) draft0 = null;
    renderCareer(); show('career');
  }
  // ---------- create ----------
  let draft0 = null;
  function newDraft() {
    const p = GI.prefs.get();
    return { name: '', pos: 'QB', num: 7, ci: p.user != null ? p.user : 0, trait: null, pts: { skill: 6, clutch: 3, dur: 3, spark: 0 } };
  }
  function renderCreate() {
    const d = draft0 || (draft0 = newDraft());
    const used = d.pts.skill + d.pts.clutch + d.pts.dur + d.pts.spark;
    const left = CR.POINTS - used;
    const pt = (k, lbl, per, base, unit) => `<div class="ptrow"><span><b>${lbl}</b><small>${base + d.pts[k] * per}${unit}</small></span><button class="iconbtn sm" data-pt="${k}" data-d="-1" ${d.pts[k] <= 0 ? 'disabled' : ''}>−</button><b class="ptv">${d.pts[k]}</b><button class="iconbtn sm" data-pt="${k}" data-d="1" ${left <= 0 ? 'disabled' : ''}>+</button></div>`;
    $('#careerBody').innerHTML = `<div class="topbar" style="margin-bottom:0"><button class="iconbtn" id="crBack">←</button><h2>Create a Player</h2></div>
      <div class="sticker panel"><label class="label" for="cName">Name</label><input id="cName" class="txt" maxlength="22" placeholder="First Last" value="${esc(d.name)}">
        <div class="row" style="margin-top:10px;gap:10px"><div style="flex:1"><label class="label" for="cNum">Number</label><input id="cNum" class="txt" type="number" min="0" max="99" value="${d.num}"></div>
        <div style="flex:2"><label class="label" for="cCol">College</label><select id="cCol" class="txt">${GI.COLLEGES.map((c, i) => `<option value="${i}" ${d.ci === i ? 'selected' : ''}>${c} (${T(i).city})</option>`).join('')}</select></div></div>
        <p class="muted" style="font-size:12px;margin:6px 0 0">🏠 Get drafted by your college's hometown team (${T(d.ci).city}) and the fans go wild.</p></div>
      <div class="sticker panel"><h3>Position</h3><div class="posgrid">${CR.POSITIONS.map((p) => `<button class="${d.pos === p ? 'on' : ''}" data-pos="${p}"><b>${GI.POS[p].label}</b><small>${GI.SHOWME[p].name}</small></button>`).join('')}</div>
        <p class="muted" style="font-size:12.5px;margin:8px 0 0">${CR.isDef(d.pos) ? 'Defense: read the offense before the snap and pick your answer.' : d.pos === 'KP' ? 'Kicker: nail the timing meter. Wind and distance shrink the window.' : 'Offense: read the defense before the snap and pick your answer.'}</p></div>
      <div class="sticker panel"><div class="row between"><h3>Attributes</h3><span class="pill ${left ? 'gold' : 'green'}">${left} points left</span></div>
        ${pt('skill', 'Skill (OVR)', 1, CR.BASE.rating, ' OVR')}${pt('clutch', 'Clutch', 4, CR.BASE.clutch, '')}${pt('dur', 'Durability', 4, CR.BASE.dur, '')}${pt('spark', '⚡ Spark', 2, Math.round(CR.BASE.spark * 100), '% breakthrough')}</div>
      <div class="sticker panel"><h3>Signature trait</h3><div class="traitgrid">${GI.TRAIT_KEYS.map((k) => `<button class="${d.trait === k ? 'on' : ''}" data-tr="${k}"><b>${GI.TRAITS[k].icon} ${GI.TRAITS[k].name}</b><small>${GI.TRAITS[k].desc}</small></button>`).join('')}</div></div>
      <button class="btn green block" id="cStart">Start college career ▶</button>`;
    $('#crBack').onclick = () => { U.refreshTitle(); show('title'); };
    $('#cName').oninput = (e) => (d.name = e.target.value);
    $('#cNum').oninput = (e) => (d.num = Math.max(0, Math.min(99, +e.target.value || 0)));
    $('#cCol').onchange = (e) => { d.ci = +e.target.value; renderCreate(); };
    $$('#careerBody [data-pos]').forEach((b) => (b.onclick = () => { d.pos = b.dataset.pos; sfx('select'); renderCreate(); }));
    $$('#careerBody [data-tr]').forEach((b) => (b.onclick = () => { d.trait = d.trait === b.dataset.tr ? null : b.dataset.tr; renderCreate(); }));
    $$('#careerBody [data-pt]').forEach((b) => (b.onclick = () => { const k = b.dataset.pt; d.pts[k] = Math.max(0, d.pts[k] + +b.dataset.d); renderCreate(); }));
    $('#cStart').onclick = () => {
      const name = (d.name || '').trim().replace(/\s+/g, ' ');
      if (name.split(' ').length < 2) { toast('Give him a first and last name'); return; }
      if (left > 0) { toast(`Spend your last ${left} point${left > 1 ? 's' : ''}`); return; }
      const go = () => { C = CR.create({ name, pos: d.pos, num: d.num, ci: d.ci, trait: d.trait, pts: d.pts }); draft0 = null; sfx('horn'); renderCareer(); };
      const old = CR.load();
      if (old && old.phase !== 'retired' && old.phase !== 'franchise') confirmBox('Replace your current career?', `${esc(old.p.name)}'s career will be gone.`, 'Start fresh', 'Cancel', go, true);
      else go();
    };
  }
  // ---------- hub ----------
  function pcard() {
    const p = C.p;
    const team = C.pro ? T(C.pro.team) : CR.collegeTeam(p.ci);
    return `<div class="sticker pcard2" style="--tc:${team.c1}"><div class="pc-num" style="background:${team.c1};color:${GI.inkOn(team.c1)}">${p.num}</div>
      <div class="pc-info"><span class="label">${GI.POS[p.pos].full} · age ${p.age}</span><h2>${esc(p.name)}</h2><small>${C.pro ? `${team.city} ${team.name}` : `${esc(p.college)} ${team.name}`}</small>
      <div class="traits">${(p.traits || []).map((k) => `<span class="trait">${GI.TRAITS[k].icon} ${GI.TRAITS[k].name}</span>`).join('')}${p.rings ? `<span class="trait">💍×${p.rings}</span>` : ''}${p.awards.length ? `<span class="trait">🏆×${p.awards.length}</span>` : ''}</div></div>
      <div class="pc-ovr">${p.rating}<small>OVR</small></div></div>`;
  }
  function renderCareer() {
    C = CR.load();
    if (!C) { renderCreate(); return; }
    const p = C.p;
    let body = '';
    const sh = (st) => GI.league.statLine(st || {});
    if (C.phase === 'college') {
      const gs = C.college.games;
      const nextIdx = gs.findIndex((g) => !g.done);
      const stock = Math.round(C.college.stock);
      body = `<div class="sticker panel"><div class="row between"><h3>📈 Draft stock</h3><span class="pill gold">Projected: round ${CR.projRound(C)}</span></div><div class="stock"><i style="width:${stock}%"></i></div><p class="muted" style="font-size:12.5px;margin:6px 0 0">Big games, wins and the combine move your stock. Scouts are watching every snap you control.</p></div>
        <div class="sticker panel"><h3>${esc(p.college)} schedule</h3>${gs.map((g, k) => { const op = CR.collegeTeam(g.opp); return `<div class="cgrow ${k === nextIdx ? 'cur' : ''}">${helmet(op, 'xs')}<span>${g.home ? 'vs' : '@'} ${esc(op.city)}</span>${g.done ? `<b class="${g.win ? 'w' : 'l'}">${g.win ? 'W' : 'L'} ${g.us}-${g.them}</b><span class="grade">${g.grade}</span>` : k === nextIdx ? '<b>Next</b>' : '<span class="muted">—</span>'}</div>`; }).join('')}</div>
        ${Object.keys(C.college.stats).length ? `<div class="sticker panel"><h3>College stats</h3><p style="margin:0">${sh(C.college.stats)}</p></div>` : ''}
        ${nextIdx >= 0 ? '<button class="btn green block" id="cgPlay">Play next game ▶</button>' : '<button class="btn gold block" id="cgCombine">Head to the Combine ▶</button>'}`;
    } else if (C.phase === 'draft') {
      const S = GI.season.load();
      body = `<div class="sticker panel"><h3>📋 Mock drafts</h3>${(C.mock || []).map((m) => `<div class="cgrow">${helmet(T(m.team), 'xs')}<span>${m.outlet}</span><b>Round ${m.round} · ${T(m.team).abbr}</b></div>`).join('')}
        <p class="muted" style="font-size:12.5px;margin:6px 0 0">Combine: ${C.combine ? C.combine.scores.map((x) => Math.round(x * 100)).join(' / ') : '—'}. Stock ${Math.round(C.college.stock)}.</p></div>
        ${S ? `<div class="sticker panel"><h3>🏟️ Your franchise</h3><p class="muted" style="margin:0 0 10px;font-size:13.5px">Enter the <b>${T(S.user).city} ${T(S.user).name}</b> franchise's next draft. Draft him yourself — or watch a rival take him and play against him.</p><button class="btn gold block" id="cdFr">Enter my franchise's draft ▶</button></div>` : ''}
        <div class="sticker panel"><h3>🎓 Go pro</h3><p class="muted" style="margin:0 0 10px;font-size:13.5px">Enter the league draft and play out your pro career: you control his key moments every game, season after season, all the way to the Hall of Fame.</p><button class="btn green block" id="cdPro">Draft day ▶</button></div>`;
    } else if (C.phase === 'franchise') {
      const f = C.franchise || {};
      body = f.waiting ? `<div class="sticker panel"><h3>⏳ Waiting on draft day</h3><p class="muted" style="margin:0">${esc(p.name)} is in your franchise's next draft pool, tagged 🎮. Head to the draft room when the time comes.</p></div>`
        : `<div class="sticker panel"><h3>${f.mine ? '🎉 He\'s yours!' : `📺 Drafted by the ${T(f.team).name}`}</h3><p class="muted" style="margin:0">Round ${f.round}, #${f.overall} overall in Year ${f.year}. ${f.mine ? 'He\'s on your roster now — build around him.' : 'You\'ll see him across the line. Make him regret it.'}</p></div>`;
      body += `<button class="btn gold block" id="cfOpen">Open franchise ▶</button><button class="btn ghost block" id="cNew" style="margin-top:10px">Start a new career</button>`;
    } else if (C.phase === 'pro') {
      const pr = C.pro, s = pr.season;
      if (!s) {
        body = C.offers ? offersHTML() : `<button class="btn green block" id="cNextSeason">Start Year ${pr.year} ▶</button>`;
        if (!C.offers && C.mustRetire) body = `<div class="sticker panel"><h3>The end of the road</h3><p class="muted">At ${p.age} (${p.rating} OVR), it's time to hang up the cleats.</p></div><button class="btn gold block" id="cRetire">Retire ▶</button>`;
        else if (!C.offers && p.age >= 30) body += '<button class="btn ghost block" id="cRetire" style="margin-top:10px">Retire now</button>';
      } else {
        const nextG = s.games.find((g) => !g.done);
        const po = s.playoff;
        body = `<div class="sticker panel"><div class="row between"><h3>Year ${pr.year} · ${T(pr.team).name}</h3><span class="pill">${s.w}-${s.l}</span></div>
          <div class="cgames">${s.games.map((g) => `<span class="cg ${g.done ? (g.win ? 'w' : 'l') : ''}" title="${T(g.opp).abbr}">${g.done ? (g.win ? 'W' : 'L') : T(g.opp).abbr}</span>`).join('')}</div>
          ${po ? `<p style="margin:8px 0 0"><b>🏟️ Playoffs:</b> ${po.champ ? '🏆 IRON-BOWL CHAMPIONS!' : po.out ? 'Eliminated' : ['Wild Card', 'Divisional', 'Iron-Bowl'][po.round]}</p>` : ''}
          <p class="muted" style="font-size:13px;margin:8px 0 0">${sh(s.stats)}</p></div>
          ${CR.seasonOver(C) ? '<button class="btn gold block" id="cEndSeason">End of season ▶</button>' : `<button class="btn green block" id="cPlayPro">${nextG ? `Play ${nextG.home ? 'vs' : '@'} ${T(nextG.opp).city} ▶` : `Play the ${['Wild Card game', 'Divisional round', 'IRON-BOWL'][po.round]} ▶`}</button>`}`;
      }
      body += `<div class="sticker panel"><h3>Career</h3><p style="margin:0">${sh(p.career)}</p><p class="muted" style="font-size:12.5px;margin:6px 0 0">${p.career.seasons || 0} seasons · ${p.career.gp} games · ${C.draft ? `drafted R${C.draft.round} #${C.draft.overall}` : ''} · ${pr.contract ? `$${pr.contract.salary}M × ${pr.contract.years} yrs` : ''}</p>${p.awards.length ? `<p style="margin:6px 0 0">${p.awards.map((a) => `<span class="trait">🏆 ${a}</span>`).join(' ')}</p>` : ''}</div>`;
      body += pr.seasons.length ? `<div class="sticker panel"><h3>Seasons</h3>${pr.seasons.map((x) => `<div class="cgrow">${helmet(T(x.team), 'xs')}<span>Y${x.year} · ${x.w}-${x.l}${x.champ ? ' 🏆' : ''}</span><small class="muted">${sh(x.stats)}</small></div>`).join('')}</div>` : '';
    } else if (C.phase === 'retired') {
      body = `<div class="sticker panel hofbox ${C.hof ? 'in' : ''}"><div class="hof-ic">${C.hof ? '🏛️' : '👋'}</div><h2>${C.hof ? 'Hall of Fame!' : 'A fine career'}</h2><p class="muted">${C.hof ? `${esc(p.name)} is enshrined in Grid Iron history. Legacy score ${C.hofScore}.` : `Legacy score ${C.hofScore} — the Hall needs ${GI.league.HOF_LINE}.`}</p>
        <p>${sh(p.career)}</p>${p.awards.length ? `<p>${p.awards.map((a) => `<span class="trait">🏆 ${a}</span>`).join(' ')}</p>` : ''}${p.rings ? `<p>💍 × ${p.rings}</p>` : ''}</div>
        <button class="btn green block" id="cNew">Start a new career ▶</button>`;
    }
    $('#careerBody').innerHTML = `<div class="topbar" style="margin-bottom:0"><button class="iconbtn" id="crBack">←</button><h2>Career</h2>${C.phase !== 'retired' && C.phase !== 'franchise' ? '<button class="iconbtn" id="crMore" aria-label="More">⋯</button>' : ''}</div>${pcard()}${body}`;
    const on = (id, fn) => { const b = $('#' + id); if (b) b.onclick = fn; };
    on('crBack', () => { U.refreshTitle(); show('title'); });
    on('crMore', () => modal(`<div class="row between"><h2>${esc(p.name)}</h2>${closeBtn}</div><div style="display:grid;gap:10px"><button class="btn ghost block" id="cmLog">Career log</button><button class="btn red block" id="cmNew">Start a new career</button></div>`, (s) => {
      s.querySelector('#mx').onclick = closeModal;
      s.querySelector('#cmLog').onclick = () => modal(`<div class="row between"><h2>Career log</h2>${closeBtn}</div><ul class="lplog">${C.log.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`, (q) => (q.querySelector('#mx').onclick = closeModal));
      s.querySelector('#cmNew').onclick = () => { closeModal(); confirmBox('Start over?', `${esc(p.name)}'s career will be replaced.`, 'Start fresh', 'Cancel', () => { CR.clear(); draft0 = null; renderCareer(); }, true); };
    }));
    on('cgPlay', () => playCareerGame('college'));
    on('cgCombine', () => combine());
    on('cdPro', () => draftDay());
    on('cdFr', () => { const S = GI.season.load(); CR.enterFranchise(C, S); U.setS(S); sfx('horn'); toast(`${p.name} is in the ${T(S.user).city} draft pool 🎮`, 2600); renderCareer(); });
    on('cfOpen', () => { const S = GI.season.load(); if (!S) { toast('No franchise found'); return; } U.setS(S); U.renderHub(); show('hub'); });
    on('cNew', () => { CR.clear(); draft0 = null; renderCareer(); });
    on('cPlayPro', () => playCareerGame('pro'));
    on('cEndSeason', () => endSeason());
    on('cNextSeason', () => { CR.newSeason(C); renderCareer(); });
    on('cRetire', () => confirmBox('Retire?', 'Hang up the cleats and see if the Hall comes calling.', 'Retire', 'Keep playing', () => { CR.retire(C); sfx(C.hof ? 'td' : 'horn'); renderCareer(); }, false));
    $$('#careerBody [data-offer]').forEach((b) => (b.onclick = () => { CR.signOffer(C, +b.dataset.offer); sfx('horn'); renderCareer(); }));
  }
  function offersHTML() {
    return `<div class="sticker panel"><h3>✍️ Contract time</h3><p class="muted" style="margin:0 0 8px;font-size:13px">Your deal is up. Stay, or chase a ring somewhere else?</p>${C.offers.map((o, k) => `<button class="offer" data-offer="${k}">${helmet(T(o.team), 'sm')}<span><b>${T(o.team).city} ${T(o.team).name}${k === 0 ? ' (current)' : ''}</b><small>$${o.salary}M × ${o.years} yrs · team ${o.contender} OVR</small></span></button>`).join('')}</div>`;
  }
  // ---------- season end ----------
  function endSeason() {
    const sm = CR.endSeason(C);
    sfx(sm.aw.length || sm.champ ? 'td' : 'paper');
    $('#modal').dataset.lock = '1';
    modal(`<h2>${sm.champ ? '🏆 Champions!' : 'Season wrap'}</h2>
      ${sm.aw.length ? `<div class="awlist">${sm.aw.map((a) => `<span class="pill gold">🏆 ${a}</span>`).join(' ')}</div>` : '<p class="muted">No hardware this year.</p>'}
      <p>Rating: <b>${sm.before} → ${sm.after}</b>${sm.breakthrough ? ' ⚡ BREAKTHROUGH!' : ''}</p>
      <p class="muted" style="font-size:13px">${sm.rel >= 1.2 ? 'A monster year.' : sm.rel >= 0.95 ? 'A solid year.' : 'A season to forget. Bounce back.'}</p>
      <button class="btn gold block" id="seOk">Continue ▶</button>`, (s) => (s.querySelector('#seOk').onclick = () => { closeModal(); renderCareer(); }));
  }
  // ---------- draft day (standalone) ----------
  async function draftDay() {
    const d = CR.runDraft(C);
    C = CR.load();
    $('#modal').dataset.lock = '1';
    modal(`<div class="draftday"><span class="label">The Grid Iron Draft</span><h2 id="ddH">Round 1 is underway…</h2><div id="ddTeam" class="dd-team"></div><p id="ddSub" class="muted"></p><button class="btn gold block" id="ddOk" hidden>Start my pro career ▶</button></div>`);
    const H = $('#ddH'), Tm = $('#ddTeam'), Sb = $('#ddSub');
    for (let r = 1; r < d.round; r++) { H.textContent = `Round ${r}… still waiting`; sfx('tap'); await sleep(650); }
    H.textContent = `Round ${d.round}, pick ${d.pick}…`; await sleep(900);
    sfx('horn');
    Tm.innerHTML = `${helmet(T(d.team), 'xl')}`;
    H.textContent = `The ${T(d.team).city} ${T(d.team).name} select…`;
    await sleep(900);
    H.textContent = C.p.name + '!';
    Sb.textContent = `#${d.overall} overall${d.team === C.p.ci ? ' · 🏠 hometown hero!' : ''} · rookie deal $${C.pro.contract.salary}M × 3 yrs`;
    $('#ddOk').hidden = false;
    $('#ddOk').onclick = () => { closeModal(); renderCareer(); };
  }
  // ---------- the combine (timing drills) ----------
  async function combine() {
    const scores = [];
    for (let i = 0; i < CR.DRILLS.length; i++) {
      const dr = CR.DRILLS[i];
      const q = await timingDrill({ title: dr.name, sub: dr.desc, zone: 0.16 + (C.p.rating - 64) / 400, speed: 1.1 + i * 0.25, label: `Drill ${i + 1} of 3` });
      scores.push(q);
    }
    CR.combineDone(C, scores);
    const avg = scores.reduce((t, x) => t + x, 0) / scores.length;
    sfx(avg >= 0.7 ? 'td' : 'paper');
    toast(`Combine grade: ${avg >= 0.85 ? 'A+ 🔥' : avg >= 0.7 ? 'B' : avg >= 0.5 ? 'C' : 'D'} — stock ${Math.round(C.college.stock)}`, 2600);
    renderCareer();
  }
  // a needle sweeps back and forth; tap when it's in the green
  function timingDrill(o) {
    return new Promise((resolve) => {
      $('#modal').dataset.lock = '1';
      modal(`<div class="drill"><span class="label">${o.label || ''}</span><h2>${o.title}</h2><p class="muted" style="margin-top:-4px">${o.sub}</p>
        <div class="meter"><div class="zone" style="left:${(0.5 + (o.shift || 0) - o.zone / 2) * 100}%;width:${o.zone * 100}%"></div><div class="zone2" style="left:${(0.5 + (o.shift || 0) - o.zone / 6) * 100}%;width:${(o.zone / 3) * 100}%"></div><i id="needle"></i></div>
        <button class="btn gold block" id="drTap">TAP!</button><p class="muted" id="drRes" style="text-align:center;min-height:20px"></p></div>`);
      const needle = $('#needle');
      let t0 = performance.now(), stop = false, pos = 0;
      const loop = (now) => {
        if (stop) return;
        const u = ((now - t0) / 1000) * o.speed;
        pos = 0.5 - 0.5 * Math.cos(u * Math.PI);
        needle.style.left = pos * 100 + '%';
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
      $('#drTap').onclick = () => {
        if (stop) return;
        stop = true;
        const c = 0.5 + (o.shift || 0), half = o.zone / 2, dist = Math.abs(pos - c);
        const q = dist <= half ? 0.6 + 0.4 * (1 - dist / half) : Math.max(0, 0.6 - (dist - half) * 2.2);
        $('#drRes').textContent = q >= 0.92 ? 'PERFECT! 🔥' : q >= 0.6 ? 'Good!' : q >= 0.3 ? 'Close…' : 'Missed it';
        sfx(q >= 0.6 ? 'good' : 'bad');
        setTimeout(() => { closeModal(); resolve(q); }, 750);
      };
    });
  }
  // ---------- playing a career game: key moments on the field ----------
  let cg = null;
  function playCareerGame(kind) {
    C = CR.load();
    const p = C.p;
    let mine, opp, label, oppOvr, myOvr, playoffRound = null;
    const meStar = { id: p.id, pos: p.pos, name: p.name, num: p.num, rating: p.rating, meter: 60, clutch: p.clutch, dur: p.dur, ego: p.ego, traits: p.traits };
    if (kind === 'college') {
      const idx = C.college.games.findIndex((g) => !g.done);
      const g = C.college.games[idx];
      mine = CR.collegeTeam(p.ci, [meStar]); opp = CR.collegeTeam(g.opp);
      label = `College · Game ${idx + 1}`; myOvr = mine.ovr; oppOvr = opp.ovr;
      cg = CR.newGame(C, { kind, idx, home: g.home });
    } else {
      const s = C.pro.season;
      const g = s.games.find((x) => !x.done);
      const oi = g ? g.opp : s.playoff.opp;
      if (!g) playoffRound = s.playoff.round;
      const base = GI.TEAMS[C.pro.team];
      mine = GI.buildTeam(C.pro.team);
      mine.stars = mine.stars.filter((x) => x.pos !== p.pos).concat([meStar]);
      GI.assignRoles(mine.stars);
      mine.stars = mine.stars.filter((x) => x.role);
      opp = GI.buildTeam(oi);
      label = g ? `Year ${C.pro.year} · Week ${s.games.indexOf(g) + 1}` : ['Wild Card', 'Divisional Round', 'THE IRON-BOWL'][playoffRound];
      myOvr = base.ovr; oppOvr = GI.TEAMS[oi].ovr + (playoffRound != null ? 3 : 0);
      cg = CR.newGame(C, { kind, home: g ? g.home : true, playoffRound });
    }
    cg.mine = mine; cg.opp = opp; cg.label = label; cg.myOvr = myOvr; cg.oppOvr = oppOvr;
    show('cgame');
    if (!cfield) { cfield = new GI.Field($('#cfield')); cfield.onSfx = (n) => sfx(n); $('#cgame .fieldwrap').addEventListener('click', () => { if (cfield.anim) cfield.finish(); }); }
    cfield.resize();
    cfield.setTeams(mine, opp);
    cfield.setWeather(GI.util.wpick({ clear: 6, rain: 1, snow: 1, wind: 1 }));
    cfield.speed = 1;
    nextMoment();
  }
  function fakeG(m, offense) {
    const side = offense ? 'home' : 'away';
    return { user: 'home', teams: { home: cg.mine, away: cg.opp }, phase: 'play', poss: side, ballOn: m.ballOn != null ? m.ballOn : 70, toGo: m.toGo || 10, down: m.down || 1, twoPt: false, kickTeam: side };
  }
  function csb() {
    const m = cg.moments[Math.min(cg.cur, cg.moments.length - 1)];
    $('#csb').innerHTML = `<div class="sb-team l">${helmet(cg.mine, 'sm')}<span class="score">${cg.us}</span></div><div class="sb-mid"><div class="clk">${cg.cur < cg.moments.length ? GI.qLabel(m.q) + ' ' + GI.clockStr(m.clock) : 'FINAL'}</div><div class="dd">${esc(cg.label)} · moment ${Math.min(cg.cur + 1, cg.moments.length)}/${cg.moments.length}</div></div><div class="sb-team r">${helmet(cg.opp, 'sm', { flip: true })}<span class="score">${cg.them}</span></div>`;
  }
  function careerInsets() {
    const gm = $('#cgame'), W = gm.clientWidth, H = gm.clientHeight, ps = $('#psheet2'), sb = $('#csb');
    const land = W > H * 1.08 && W >= 560;
    const open = ps.classList.contains('open');
    cfield.setInsets({ top: sb.offsetTop + sb.offsetHeight + 6, bottom: open && !land ? H - ps.offsetTop + 4 : 0, right: open && land ? W - ps.offsetLeft + 4 : 0 });
  }
  async function nextMoment() {
    csb();
    setTimeout(careerInsets, 30);
    const panel = $('#cpanel');
    if (cg.cur >= cg.moments.length) return finishCareerGame();
    const m = cg.moments[cg.cur], p = C.p;
    const def = CR.isDef(p.pos);
    if (p.pos === 'KP') {
      const G = fakeG({ ballOn: Math.min(99, 117 - m.dist), toGo: 10, down: 4 }, true);
      G.phase = 'play';
      cfield.showFormation(G);
      panel.innerHTML = `<div class="cp-head"><span class="t">${m.dist}-yard field goal</span><span class="pill ${m.wind ? 'blue' : ''}">${m.wind ? `💨 wind ${m.wind > 0 ? '→' : '←'} ${Math.abs(m.wind)}` : 'calm'}</span></div>
        <p class="kicktip">${m.big ? '🔥 This one decides the game.' : 'Nail the timing: the window shrinks with distance and wind.'}</p><button class="btn gold block" id="kickGo">Line it up ▶</button>`;
      $('#psheet2').classList.add('open');
      $('#kickGo').onclick = async () => {
        $('#psheet2').classList.remove('open'); panel.innerHTML = '';
        const zone = Math.max(0.07, 0.3 - (m.dist - 25) * 0.006 + (p.rating - 64) * 0.003);
        const q = await timingDrill({ title: `${m.dist} yards`, sub: m.wind ? 'Wind is pushing the window' : 'Calm conditions', zone, speed: 1.2 + m.dist / 60, shift: m.wind * 0.04, label: m.big ? 'GAME ON THE LINE' : 'Field goal' });
        const r = CR.resolve(C, cg, null, q);
        await runMoment(r, true);
      };
      return;
    }
    const kit = CR.KITS[p.pos];
    const G = fakeG(m, !def);
    cfield.showFormation(G);
    const scoreDiff = cg.us - cg.them;
    panel.innerHTML = `<div class="cp-head"><span class="t">${GI.qLabel(m.q)} · ${['', '1st', '2nd', '3rd', '4th'][m.down]} & ${m.toGo}</span><span class="pill ${m.big ? 'red' : ''}">${m.big ? 'BIG MOMENT' : def ? 'On defense' : 'On offense'}</span></div>
      <p class="read">👁️ <b>Pre-snap read:</b> ${kit.looks[m.hint]}${scoreDiff ? ` · ${scoreDiff > 0 ? 'up' : 'down'} ${Math.abs(scoreDiff)}` : ''}</p>
      <div class="mopts">${kit.opts.map((o) => `<button class="play" data-o="${o.id}"><span>${o.label}</span><small>${o.sub}</small></button>`).join('')}</div>`;
    $('#psheet2').classList.add('open');
    $$('#cpanel [data-o]').forEach((b) => (b.onclick = async () => {
      $('#psheet2').classList.remove('open'); panel.innerHTML = '';
      const r = CR.resolve(C, cg, b.dataset.o);
      await runMoment(r, !def);
    }));
  }
  async function runMoment(r, offense) {
    const m = cg.moments[cg.cur - 1];
    const G = fakeG(m, offense);
    try { await cfield.runPlay(r.res, G); } catch (e) { console.error(e); }
    const tone = r.tier === 'big' || r.tier === 'good' ? 'good' : r.tier === 'bad' ? 'bad' : 'plain';
    sfx(r.tier === 'big' ? 'star' : r.tier === 'good' ? 'good' : r.tier === 'bad' ? 'bad' : 'whistle');
    if (r.tier === 'big') GI.audio.buzz([40, 30, 60]);
    csb();
    const mu = r.res.matchup;
    const host = $('#cbanner');
    host.innerHTML = `<div class="banner ${r.tier === 'big' ? 'star' : tone}"><div class="b">${{ big: 'HUGE!', good: 'NICE!', meh: 'MEH', bad: 'OUCH' }[r.tier]}</div><div class="s">${esc(r.text)}</div></div>${mu ? `<div class="reveal ${mu.beat ? 'good' : mu.lost ? 'bad' : ''}"><small>They showed</small><b>${esc(mu.lookText)}</b><span>${mu.beat ? 'You read it perfectly' : mu.lost ? 'Wrong answer for that look' : 'A neutral matchup'}</span></div>` : ''}`;
    await sleep(1700);
    host.innerHTML = '';
    nextMoment();
  }
  function finishCareerGame() {
    CR.finishGame(C, cg, cg.myOvr, cg.oppOvr);
    if (cg.kind === 'college') CR.recordCollege(C, cg.idx, cg);
    else CR.recordPro(C, cg, cg.playoffRound != null ? cg.playoffRound : null);
    csb();
    sfx(cg.win ? 'td' : 'bad');
    $('#modal').dataset.lock = '1';
    modal(`<div class="result" style="padding:6px 0 0"><div class="wl" style="background:${cg.win ? 'var(--green)' : 'var(--red)'}">${cg.win ? 'WIN!' : 'LOSS'}</div>
      <div class="fs">${helmet(cg.mine, 'md')}<span>${cg.us}</span><span class="muted" style="font-size:28px">—</span><span>${cg.them}</span>${helmet(cg.opp, 'md', { flip: true })}</div></div>
      <div class="gradebig"><span class="label">Your grade</span><b class="g-${cg.grade}">${cg.grade}</b></div>
      <p style="text-align:center;margin:0 0 6px">${GI.league.statLine(cg.stats)}</p>
      <ul class="lplog">${cg.plays.map((x) => `<li><b>${{ big: '🔥', good: '✅', meh: '➖', bad: '❌' }[x.tier]}</b> ${esc(x.text)}</li>`).join('')}</ul>
      <button class="btn gold block" id="cgDone" style="margin-top:12px">Continue ▶</button>`, (s) => (s.querySelector('#cgDone').onclick = () => { closeModal(); C = CR.load(); renderCareer(); show('career'); }));
  }
  $('#cgQuit') && ($('#cgQuit').onclick = () => confirmBox('Leave this game?', 'Progress in this game is lost — it will be replayed.', 'Leave', 'Stay', () => { renderCareer(); show('career'); }, true));

  Object.assign(U, { openLegacy, openCareer, renderLegacy, renderCareer, timingDrill });
})();
