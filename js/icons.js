/* Grid Iron v1 — one consistent line-icon set (24×24, 2px strokes, currentColor). No emoji in the chrome. */
(function () {
  const GI = window.GI;
  const P = {
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M10 17h4"/>',
    album: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v18M12 8h4M12 12h4"/>',
    store: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14M12 17.5v.1"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    roster: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5A5 5 0 0 1 21 19"/>',
    office: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2M10 21v-3h4v3"/>',
    gazette: '<rect x="3" y="5" width="15" height="15" rx="1"/><path d="M18 9h3v9a2 2 0 0 1-2 2M6 9h9M6 13h9M6 16h6"/>',
    standings: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    bracket: '<path d="M3 5h5v6H3M3 13h5v6H3M8 8h4v8H8M12 12h5M17 9h4v6h-4z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M7 14h2M11 14h2M15 14h2"/>',
    trade: '<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
    pillar: '<path d="M3 21h18M5 21V10M10 21V10M14 21V10M19 21V10M2 10l10-6 10 6z"/>',
    film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4"/>',
    leader: '<path d="M4 10v4h3l7 4V6l-7 4z"/><path d="M17 9a4 4 0 0 1 0 6"/>',
    diva: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>',
    gymrat: '<path d="M6 8v8M3 10v4M18 8v8M21 10v4M6 12h12"/>',
    ironman: '<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/>',
    biggame: '<path d="M6 4h12l3 5-9 11L3 9z"/><path d="M3 9h18M9 4l3 16M15 4l-3 16"/>',
    mentor: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5M22 9v5"/>',
    spark: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10M10 20v-5h4v5"/>',
    star: '<path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4l-5.5 2.9 1-6.2L3 9.7l6.2-.9z"/>',
    whistle: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 9h6M9 13h6M9 17h3"/>',
    auto: '<path d="M5 12a7 7 0 1 1 2 5"/><path d="M5 19v-5h5"/>',
    ffwd: '<path d="M4 6l8 6-8 6zM12 6l8 6-8 6z"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    medic: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .9-3 2s1.3 1.8 3 2 3 .9 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v2M12 16v2"/>',
    flame: '<path d="M12 21c4 0 7-3 7-7 0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-5 5-5 8 0 4 3 7 7 7z"/>',
    stadium: '<ellipse cx="12" cy="9" rx="9" ry="3.5"/><path d="M3 9v6c0 2 4 3.5 9 3.5s9-1.5 9-3.5V9M7 12v4M12 12.5v4.5M17 12v4"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    chart: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    check: '<path d="M4 12l5 5L20 6"/>',
    scout: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    rain: '<path d="M7 15a4 4 0 1 1 1-7.9A5 5 0 0 1 17.6 9 3.5 3.5 0 0 1 17 16H7z"/><path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2"/>',
    snow: '<path d="M12 2v20M4 7l16 10M4 17L20 7M9 3l3 2 3-2M9 21l3-2 3 2"/>',
    wind: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7"/>',
    heat: '<path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z"/><path d="M12 9v7"/>',
    dome: '<path d="M3 18a9 9 0 0 1 18 0z"/><path d="M3 18h18M8 18v-4M12 18v-6M16 18v-4"/>',
    retract: '<path d="M3 18a9 9 0 0 1 9-9"/><path d="M3 18h18M12 9v9M15 11l3-2M18 14l3-1"/>',
    open: '<path d="M3 18h18M5 18v-6l3 2 4-4 4 4 3-2v6"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>',
    cards: '<rect x="7" y="4" width="12" height="16" rx="2"/><path d="M5 7v12a2 2 0 0 0 2 2h9"/>',
    pin: '<path d="M12 22s7-7.5 7-12a7 7 0 1 0-14 0c0 4.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
    pad: '<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 10v5M4.5 12.5h5M15 11h.1M18 14h.1"/>',
    clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M10 2h4"/>',
    ball: '<ellipse cx="12" cy="12" rx="9.5" ry="6" transform="rotate(-35 12 12)"/><path d="M9 15l6-6M10.5 10.5l1.5 1.5M12 9l1.5 1.5M9 12l1.5 1.5"/>',
    kneel: '<circle cx="13" cy="4" r="2"/><path d="M13 7l-2 6h5l1 7M11 13l-4 3v4"/>',
    bulb: '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V16h8v-1.3A7 7 0 0 0 12 2z"/>',
    scroll: '<path d="M6 3h11a2 2 0 0 1 2 2v13a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-1h11v1a3 3 0 0 0 3 3M6 3a2 2 0 0 0-2 2v2h4"/>',
    puzzle: '<path d="M4 7h4a2 2 0 1 1 4 0h4v4a2 2 0 1 1 0 4v4H4v-4a2 2 0 1 0 0-4z"/>',
    plane: '<path d="M2 16l20-8-6 13-3-6z"/><path d="M13 15L22 8"/>',

  };
  GI.ICON = P;
  // emoji that still live in older story text → the matching line icon
  const EMO = { '🔥': 'flame', '🤝': 'mentor', '🧠': 'eye', '⚔️': 'target', '⚔': 'target', '🪓': 'flame', '🔁': 'trade', '😤': 'flame', '🎓': 'mentor', '😒': 'diva', '📈': 'chart', '📉': 'chart', '🗯️': 'leader', '⏳': 'clock', '📜': 'scroll', '🏅': 'trophy', '🗣️': 'leader', '🙊': 'diva', '💸': 'coin', '🔄': 'trade', '🎩': 'star', '👑': 'star', '🏟️': 'stadium', '⭐': 'star', '★': 'star', '💍': 'trophy', '🛡️': 'ironman', '📣': 'leader' };
  GI.emo = (e) => (EMO[e] ? GI.ico(EMO[e]) : e && /^[\x00-\x7f]*$/.test(e) ? e : GI.ico('spark'));
  GI.ico = (name, cls) => `<svg class="ico ${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
  // traits get a real icon instead of an emoji
  GI.TRAIT_ICON = { leader: 'leader', diva: 'diva', gymrat: 'gymrat', ironman: 'ironman', biggame: 'biggame', mentor: 'mentor' };
  if (GI.TRAITS) Object.keys(GI.TRAIT_ICON).forEach((k) => { if (GI.TRAITS[k]) GI.TRAITS[k].icon = GI.ico(GI.TRAIT_ICON[k], 'tr'); });
  // weather and roofs: line icons instead of emoji (the emoji stay for plain-text sharing)
  if (GI.WEATHER) { const W = { clear: 'sun', rain: 'rain', snow: 'snow', wind: 'wind', heat: 'heat', dome: 'dome' }; Object.keys(W).forEach((k) => { if (GI.WEATHER[k]) { GI.WEATHER[k].emoji = GI.WEATHER[k].icon; GI.WEATHER[k].icon = GI.ico(W[k], 'wx'); } }); }
  if (GI.ROOFS) { const RF = { open: 'open', dome: 'dome', retract: 'retract' }; Object.keys(RF).forEach((k) => { if (GI.ROOFS[k]) { GI.ROOFS[k].emoji = GI.ROOFS[k].icon; GI.ROOFS[k].icon = GI.ico(RF[k], 'wx'); } }); }
  const IDN = { ground: 'flame', air: 'spark', west: 'chart', blitz: 'target', bend: 'ironman' };
  if (GI.IDENTITIES) Object.keys(IDN).forEach((k) => { if (GI.IDENTITIES[k]) GI.IDENTITIES[k].icon = GI.ico(IDN[k], 'tr'); });
})();
