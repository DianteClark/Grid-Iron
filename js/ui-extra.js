/* Grid Iron — Legacy screens: the Hall, the sticker album and the store */
(function () {
  const GI = window.GI;
  const U = GI.UI;
  const { $, $$, esc, show, toast, modal, closeModal, closeBtn, confirmBox, helmet, sfx, T } = U;
  const Lg = GI.legacy;
  const sleep = U.sleep;

  // ================= LEGACY =================
  let lgTab = 'hall', albumTeam = null, storeCat = 'jersey', kitTeam;
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
        body = `<div class="row between"><button class="btn ghost small" id="albBack">← Pages</button><b>${title}</b></div><div class="stkgrid">${list.map(sticker).join('') || '<p class="muted">Empty page. Play them to collect stickers!</p>'}</div>`;
      }
    } else {
      const cats = [['jersey', 'Jerseys'], ['field', 'Fields'], ['celebrate', 'Celebrate'], ['ball', 'Balls'], ['board', 'Scorebug']];
      const S0 = GI.season.load();
      if (kitTeam === undefined) kitTeam = S0 ? S0.user : GI.prefs.get().user != null ? GI.prefs.get().user : null;
      const fav = T(kitTeam != null ? kitTeam : (GI.prefs.get().user != null ? GI.prefs.get().user : 0));
      const preview = (cat, id) => {
        if (cat === 'jersey') { const j = Lg.kit(fav, id); return `<span class="sw ball3d" style="--c1:${j.c1};--c2:${j.c2}"></span>`; }
        if (cat === 'field') { const c = { classic: ['#36a04d', '#2f9346', '#fff'], checker: ['#36a04d', fav.c1, '#fff'], retro: ['#93ad4a', '#87a243', '#fff3d1'], night: ['#2a6a33', '#14301a', '#eaf6ff'], neon: ['#121f36', '#0b1424', '#5ef2ff'] }[id]; return `<span class="sw fld" style="background:repeating-linear-gradient(0deg,${c[0]} 0 8px,${c[1]} 8px 16px);box-shadow:inset 0 0 0 2px ${c[2]}"></span>`; }
        if (cat === 'ball') return `<span class="sw fb fb-${id}"></span>`;
        if (cat === 'board') return `<span class="sw sbprev" data-skin="${id}"><i>3:05</i></span>`;
        return `<span class="sw">${{ confetti: '🎊', fireworks: '🎆', stickers: '⭐', goldrain: '🪙' }[id]}</span>`;
      };
      const items = GI.COSMETICS[storeCat];
      const curId = storeCat === 'jersey' ? Lg.jerseyId(kitTeam) : D.equip[storeCat];
      const kitPick = storeCat === 'jersey' ? `<div class="kitrow"><span class="label">Kit for</span><select class="txt" id="kitTeam"><option value="">Every team (default)</option>${GI.TEAMS.map((t, i) => `<option value="${i}" ${kitTeam === i ? 'selected' : ''}>${t.city} ${t.name}${S0 && S0.user === i ? ' ★' : ''}</option>`).join('')}</select></div>` : '';
      body = `<div class="sticker panel lpcard"><div><span class="label">Legacy Points</span><b>${D.lp}</b><small>${storeCat === 'field' ? 'Your field skin is used at home games in your stadium' : storeCat === 'jersey' ? 'Every kit is cut from that team\'s own colors' : 'Cosmetics show up in every mode'}</small></div></div>
        <div class="seg scroll" id="catSeg">${cats.map(([k, n]) => `<button data-v="${k}" class="${storeCat === k ? 'on' : ''}">${n}</button>`).join('')}</div>${kitPick}
        <div class="storegrid">${Object.keys(items).map((id) => {
          const it = items[id], eq = curId === id;
          const own = it.special ? kitTeam != null && Lg.heritageOpen(kitTeam) : D.owned[storeCat].includes(id);
          let act;
          if (eq) act = '<span class="pill green">Equipped</span>';
          else if (it.special) act = kitTeam == null ? '<small class="muted">Pick a team above</small>' : own ? `<button class="btn ghost small" data-eq="${id}">Equip</button>` : `<small class="muted">Finish the ${esc(T(kitTeam).name)} album page</small>`;
          else act = own ? `<button class="btn ghost small" data-eq="${id}">Equip</button>` : `<button class="btn ${D.lp >= it.cost ? 'gold' : 'ghost'} small" data-buy="${id}" ${D.lp >= it.cost ? '' : 'disabled'}>🏅 ${it.cost}</button>`;
          return `<div class="sticker sitem ${eq ? 'eq' : ''}">${preview(storeCat, id)}<b>${it.name}</b><small>${it.desc}</small>${act}</div>`; }).join('')}</div>`;
    }
    $('#legacyBody').innerHTML = `<div class="topbar" style="margin-bottom:0"><button class="iconbtn" id="lgBack">←</button><h2>Legacy</h2><span class="cashpill">🏅 ${D.lp}</span></div>
      <div class="seg" id="lgTabs">${tabs.map(([k, n]) => `<button data-v="${k}" class="${lgTab === k ? 'on' : ''}">${n}</button>`).join('')}</div>${body}`;
    $('#lgBack').onclick = () => { U.refreshTitle(); show('title'); };
    $$('#lgTabs button').forEach((b) => (b.onclick = () => { lgTab = b.dataset.v; albumTeam = null; renderLegacy(); }));
    const ts = $('#toStore'); if (ts) ts.onclick = () => { lgTab = 'store'; renderLegacy(); };
    $$('#legacyBody [data-pg]').forEach((b) => (b.onclick = () => { albumTeam = b.dataset.pg; renderLegacy(); $('#legacy').scrollTop = 0; }));
    const pb = $('#albBack'); if (pb) pb.onclick = () => { albumTeam = null; renderLegacy(); };
    $$('#catSeg button').forEach((b) => (b.onclick = () => { storeCat = b.dataset.v; renderLegacy(); }));
    $$('#legacyBody [data-buy]').forEach((b) => (b.onclick = () => {
      const prev = Lg.equipped(storeCat);
      const r = Lg.buy(storeCat, b.dataset.buy); if (!r.ok) { toast(r.why); return; }
      if (storeCat === 'jersey' && kitTeam != null) { Lg.get().equip.jersey = prev; Lg.equip('jersey', b.dataset.buy, kitTeam); }
      sfx('td'); toast(`Unlocked: ${GI.COSMETICS[storeCat][b.dataset.buy].name}!`); refreshField(); renderLegacy();
    }));
    $$('#legacyBody [data-eq]').forEach((b) => (b.onclick = () => { Lg.equip(storeCat, b.dataset.eq, storeCat === 'jersey' ? kitTeam : null); sfx('select'); refreshField(); renderLegacy(); }));
    const kt = $('#kitTeam'); if (kt) kt.onchange = () => { kitTeam = kt.value === '' ? null : +kt.value; renderLegacy(); };
  }
  function refreshField() {
    const f = U.getField(), G = U.getG(); if (!f) return;
    if (G && G.venue && f.venue) { const home = !G.venue.neutral && G.venue.idx === G.teams[G.user].idx; f.skin = home ? Lg.equipped('field') : 'classic'; }
    f.ballSkin = Lg.equipped('ball');
    f.fieldCache = null;
  }

  Object.assign(U, { openLegacy, renderLegacy });
})();
