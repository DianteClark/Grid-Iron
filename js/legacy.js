/* Grid Iron — Legacy: Legacy Points, the store & cosmetics, the sticker album, the all-time Hall of Fame, backups */
(function () {
  const GI = window.GI;
  const KEY = 'gridiron_legacy';
  const CATS = ['jersey', 'field', 'celebrate', 'ball', 'board'];
  const blank = () => ({ lp: 0, earned: 0, owned: { jersey: ['home'], field: ['classic'], celebrate: ['confetti'], ball: ['classic'], board: ['prime'] }, equip: { jersey: 'home', field: 'classic', celebrate: 'confetti', ball: 'classic', board: 'prime' }, equipTeam: {}, album: {}, hof: [], log: [], pages: {}, daily: null });
  let D = null;
  function load() {
    if (D) return D;
    try { D = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { D = blank(); }
    CATS.forEach((k) => { if (!D.owned[k]) D.owned[k] = blank().owned[k]; if (!D.equip[k]) D.equip[k] = blank().equip[k]; });
    if (!D.equipTeam) D.equipTeam = {};
    return D;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(D)); }
    catch (e) { // storage full: trim the oldest plain stickers and retry
      const keys = Object.keys(D.album).filter((k) => !(D.album[k].shiny || []).length).sort((a, b) => D.album[a].got - D.album[b].got);
      keys.slice(0, Math.ceil(keys.length / 4)).forEach((k) => delete D.album[k]);
      try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e2) {}
    }
  }
  const SHINY_LP = { MVP: 4, OPOY: 2, DPOY: 2, ROY: 2, 'Hall of Fame': 5, Champion: 1, Career: 2 };
  const Lg = {
    get: load,
    reload() { D = null; return load(); },
    addLP(n, why) {
      if (!n) return;
      load();
      D.lp += n; D.earned += n;
      D.log.unshift({ n, why, t: Date.now() });
      if (D.log.length > 40) D.log.length = 40;
      Lg.pending.push({ n, why });
      save();
    },
    pending: [],
    takePending() { const p = Lg.pending; Lg.pending = []; return p; },
    owns(cat, id) { return load().owned[cat].includes(id); },
    buy(cat, id) {
      load();
      const c = GI.COSMETICS[cat][id];
      if (!c || D.owned[cat].includes(id)) return { ok: false, why: 'Already yours' };
      if (D.lp < c.cost) return { ok: false, why: `Need ${c.cost - D.lp} more Legacy Points` };
      D.lp -= c.cost; D.owned[cat].push(id); D.equip[cat] = id;
      save();
      return { ok: true };
    },
    CATS,
    // jerseys can be set per team: teamIdx null = the default for every team
    equip(cat, id, teamIdx) {
      load();
      if (cat === 'jersey' && id === 'heritage') { if (teamIdx == null || !D.pages[teamIdx]) return false; }
      else if (!D.owned[cat].includes(id)) return false;
      if (cat === 'jersey' && teamIdx != null) D.equipTeam[teamIdx] = id; else D.equip[cat] = id;
      save(); return true;
    },
    equipped(cat) { return load().equip[cat]; },
    jerseyId(teamIdx) { load(); const t = teamIdx != null ? D.equipTeam[teamIdx] : null; return t || D.equip.jersey; },
    heritageOpen(teamIdx) { return !!load().pages[teamIdx]; },
    // the jersey you wear changes your on-field colors — always built from your team's own colors
    jersey(team) {
      let j = Lg.jerseyId(team.idx);
      if (j === 'heritage' && !D.pages[team.idx]) j = 'home';
      return Lg.kit(team, j);
    },
    kit(team, j) {
      const c1 = team.c1, c2 = team.c2;
      if (j === 'heritage') return { c1: GI.mixHex ? GI.mixHex(c1, '#e9dcc0', 0.28) : c1, c2: '#f4ecd8' };
      if (j === 'rush') return { c1, c2: c1 };
      if (j === 'throwback') return { c1: c2, c2: c1 };
      if (j === 'blackout') return { c1: '#202024', c2: c1 };
      if (j === 'gold') return { c1: '#d9a514', c2: c1 };
      if (j === 'ice') return { c1: '#eef3f8', c2: c1 };
      return { c1, c2 };
    },
    // ---------- the sticker album ----------
    collect(list, shiny) {
      load();
      const fresh = [];
      (list || []).forEach((x) => {
        if (!x || !x.key) return;
        const cur = D.album[x.key];
        if (!cur) {
          D.album[x.key] = Object.assign({}, x, { got: Date.now(), shiny: shiny ? [shiny] : [] });
          fresh.push(D.album[x.key]);
          if (shiny && SHINY_LP[shiny]) Lg.addLP(SHINY_LP[shiny], `Shiny sticker: ${shiny}`);
        } else {
          cur.rating = Math.max(cur.rating || 0, x.rating || 0);
          cur.year = x.year || cur.year;
          if (shiny && !cur.shiny.includes(shiny)) { cur.shiny.push(shiny); fresh.push(cur); if (SHINY_LP[shiny]) Lg.addLP(SHINY_LP[shiny], `Shiny sticker: ${shiny}`); }
        }
      });
      // finish a team page (8 stickers) for a bonus
      const per = {};
      Object.values(D.album).forEach((s) => { if (s.ti != null) per[s.ti] = (per[s.ti] || 0) + 1; });
      Object.keys(per).forEach((ti) => { if (per[ti] >= 8 && !D.pages[ti]) { D.pages[ti] = true; Lg.addLP(10, `Album page complete: ${(GI.TEAMS[ti] || {}).name || 'team'} (Heritage jersey unlocked)`); } });
      Lg.fresh.push(...fresh.filter((f) => !Lg.fresh.includes(f)));
      save();
      return fresh;
    },
    fresh: [],
    takeFresh() { const f = Lg.fresh; Lg.fresh = []; return f; },
    albumStats() {
      const a = Object.values(load().album);
      const teams = {};
      a.forEach((s) => { const k = s.ti != null ? s.ti : 'x'; teams[k] = (teams[k] || 0) + 1; });
      return { total: a.length, shiny: a.filter((s) => (s.shiny || []).length).length, teams };
    },
    // first win of the day pays a little extra
    dailyWin() {
      load();
      const today = new Date().toDateString();
      if (D.daily === today) return 0;
      D.daily = today; save();
      Lg.addLP(5, 'First win of the day');
      return 5;
    },
    addHof(e) { load(); D.hof.unshift(e); if (D.hof.length > 80) D.hof.length = 80; save(); },
    // ---------- backups ----------
    exportData() {
      const data = {};
      try { Object.keys(localStorage).filter((k) => k.startsWith('gridiron')).forEach((k) => (data[k] = localStorage.getItem(k))); } catch (e) {}
      return JSON.stringify({ app: 'grid-iron', v: 1, at: new Date().toISOString(), data });
    },
    async exportCode() {
      const json = Lg.exportData();
      try {
        if (window.CompressionStream) {
          const cs = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
          const buf = new Uint8Array(await new Response(cs).arrayBuffer());
          let bin = ''; for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 8192));
          return 'GI1:' + btoa(bin);
        }
      } catch (e) {}
      return 'GI0:' + btoa(unescape(encodeURIComponent(json)));
    },
    async importAny(text) {
      text = (text || '').trim();
      let json = text;
      if (text.startsWith('GI1:')) {
        const bin = atob(text.slice(4));
        const buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        const ds = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
        json = await new Response(ds).text();
      } else if (text.startsWith('GI0:')) json = decodeURIComponent(escape(atob(text.slice(4))));
      const o = JSON.parse(json);
      if (!o || o.app !== 'grid-iron' || !o.data) throw new Error('Not a Grid Iron backup');
      Object.keys(localStorage).filter((k) => k.startsWith('gridiron')).forEach((k) => localStorage.removeItem(k));
      Object.keys(o.data).forEach((k) => localStorage.setItem(k, o.data[k]));
      D = null;
      return o;
    },
  };
  GI.legacy = Lg;
})();
