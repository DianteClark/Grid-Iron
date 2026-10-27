/* Grid Iron — stadiums, surfaces, roofs and climate-driven weather */
(function () {
  const GI = window.GI;
  // [name, roof, surface, climate, capacity (k)]
  // roof: open | dome | retract   surface: grass | turf | blue   climate drives the weather
  const BASE = [
    ['Lone Star Field', 'open', 'grass', 'hot', 72],            // Austin
    ['The Foundry', 'open', 'grass', 'hot', 64],                // Birmingham
    ['The Blue Yard', 'open', 'blue', 'alpine', 52],            // Boise
    ['Bridgeworks Park', 'open', 'turf', 'windy', 70],          // Brooklyn
    ['Tidewater Stadium', 'open', 'grass', 'wet', 58],          // Charleston
    ['Comet Field', 'open', 'grass', 'cold', 80],               // Columbus
    ['The Funnel', 'retract', 'turf', 'windy', 55],             // Des Moines
    ['Sun Bowl Yard', 'open', 'turf', 'desert', 60],            // El Paso
    ['Valley Field', 'open', 'grass', 'hot', 50],               // Fresno
    ['The Den', 'open', 'grass', 'cold', 54],                   // Hartford
    ['Aloha Field', 'open', 'grass', 'tropical', 50],           // Honolulu
    ['Mesa Grounds', 'open', 'grass', 'desert', 56],            // Albuquerque
    ['Derby Park', 'open', 'grass', 'mild', 66],                // Louisville
    ['The Pyramid', 'dome', 'turf', 'hot', 64],                 // Memphis
    ['Lakefront Field', 'open', 'grass', 'cold', 73],           // Milwaukee
    ['Stockyard Stadium', 'open', 'grass', 'windy', 60],        // Omaha
    ['Launch Dome', 'dome', 'turf', 'hot', 68],                 // Orlando
    ['Timber Field', 'open', 'grass', 'wet', 62],               // Portland
    ['Lighthouse Park', 'open', 'grass', 'cold', 50],           // Providence
    ['Triangle Field', 'open', 'grass', 'mild', 60],            // Raleigh
    ['The Jackpot Dome', 'dome', 'turf', 'desert', 58],         // Reno
    ['Capitol Grounds', 'open', 'grass', 'mild', 61],           // Richmond
    ['Golden Roof Arena', 'retract', 'grass', 'hot', 62],       // Sacramento
    ['Summit Field', 'open', 'turf', 'alpine', 64],             // Salt Lake
    ['The Alamo Dome', 'dome', 'turf', 'hot', 70],              // San Antonio
    ['Bigfoot Bowl', 'open', 'grass', 'cold', 48],              // Spokane
    ['Gateway Dome', 'dome', 'turf', 'mild', 66],               // St. Louis
    ['Gusher Field', 'open', 'turf', 'windy', 57],              // Tulsa
    ['Northern Lights Dome', 'dome', 'turf', 'cold', 46],       // Anchorage
    ['The Glasshouse', 'retract', 'turf', 'cold', 55],          // Toledo
    ['Spanish Moss Park', 'open', 'grass', 'wet', 52],          // Savannah
    ['Hangar Field', 'open', 'turf', 'windy', 59],              // Wichita
  ];
  GI.ROOFS = { open: { name: 'Open air', icon: '🌤️' }, dome: { name: 'Dome', icon: '🏟️' }, retract: { name: 'Retractable roof', icon: '🪟' } };
  GI.SURFACES = {
    grass: { name: 'Grass', icon: '🌱', desc: 'Natural grass. Gets sloppy in rain and snow.' },
    turf: { name: 'Turf', icon: '⚡', desc: 'Fast track: outside runs and deep balls get a lift, a few more injuries.' },
    blue: { name: 'Blue turf', icon: '💙', desc: 'Fast, famous and a little disorienting for visitors.' },
  };
  GI.CLIMATES = {
    cold: { name: 'Cold winters', early: { clear: 55, rain: 15, wind: 20, heat: 5, snow: 5 }, late: { clear: 28, rain: 10, wind: 20, snow: 42, heat: 0 } },
    mild: { name: 'Mild', early: { clear: 55, rain: 20, wind: 15, heat: 10, snow: 0 }, late: { clear: 48, rain: 25, wind: 17, snow: 10, heat: 0 } },
    hot: { name: 'Hot', early: { clear: 40, rain: 10, wind: 5, heat: 45, snow: 0 }, late: { clear: 62, rain: 20, wind: 10, heat: 8, snow: 0 } },
    wet: { name: 'Rainy', early: { clear: 35, rain: 45, wind: 15, heat: 5, snow: 0 }, late: { clear: 30, rain: 45, wind: 15, snow: 10, heat: 0 } },
    windy: { name: 'Windy', early: { clear: 42, rain: 10, wind: 40, heat: 8, snow: 0 }, late: { clear: 30, rain: 8, wind: 40, snow: 22, heat: 0 } },
    alpine: { name: 'High altitude', early: { clear: 60, rain: 15, wind: 15, heat: 10, snow: 0 }, late: { clear: 35, rain: 0, wind: 20, snow: 45, heat: 0 } },
    desert: { name: 'Desert', early: { clear: 50, rain: 0, wind: 10, heat: 40, snow: 0 }, late: { clear: 72, rain: 3, wind: 20, heat: 5, snow: 0 } },
    tropical: { name: 'Tropical', early: { clear: 40, rain: 35, wind: 5, heat: 20, snow: 0 }, late: { clear: 45, rain: 35, wind: 10, heat: 10, snow: 0 } },
  };
  GI.NEUTRAL_VENUE = { idx: -1, name: 'Iron Bowl Stadium', roof: 'retract', surface: 'grass', climate: 'mild', cap: 90, neutral: true };
  GI.STADIUMS = BASE.map((b, i) => ({ idx: i, name: b[0], roof: b[1], surface: b[2], climate: b[3], cap: b[4] }));

  // the franchise can renovate its own building
  GI.venueOf = function (idx, S) {
    if (idx == null || idx < 0) return Object.assign({}, GI.NEUTRAL_VENUE);
    const v = Object.assign({}, GI.STADIUMS[idx]);
    const o = S && S.stadium && S.user === idx ? S.stadium : null;
    if (o) Object.assign(v, o);
    return v;
  };
  // weather from where (climate) and when (0 = opening week, 1 = playoffs)
  GI.climateOdds = function (climate, when) {
    const c = GI.CLIMATES[climate] || GI.CLIMATES.mild, t = Math.max(0, Math.min(1, when == null ? Math.random() : when));
    const w = {};
    Object.keys(GI.WEATHER).forEach((k) => { if (k === 'dome') return; w[k] = Math.max(0, (c.early[k] || 0) * (1 - t) + (c.late[k] || 0) * t); });
    return w;
  };
  GI.rollWeather = function (venue, when, rnd) {
    const R = rnd || Math.random;
    const w = GI.climateOdds(venue.climate, when);
    let tot = 0; for (const k in w) tot += w[k];
    let x = R() * tot, pick = 'clear';
    for (const k in w) { x -= w[k]; if (x <= 0) { pick = k; break; } }
    return pick;
  };
  // the roof decides what actually reaches the field
  GI.underRoof = function (venue, weather) {
    if (venue.roof === 'dome') return { weather: 'dome', note: null };
    if (venue.roof === 'retract' && weather !== 'clear') return { weather: 'dome', note: `${GI.WEATHER[weather].icon} ${GI.WEATHER[weather].name} outside — the roof is closed` };
    return { weather, note: null };
  };
  GI.venueTips = function (v, weather) {
    const t = [];
    if (v.roof === 'dome' || weather === 'dome') t.push('Indoors: no weather and the noise bounces off the roof. Visiting offenses jump early.');
    if (v.surface !== 'grass') t.push('Fast turf: outside runs and deep shots get a little extra.');
    if (v.surface === 'grass' && (weather === 'rain' || weather === 'snow')) t.push('Wet grass: footing is sloppy. Runs slow down and the ball gets slippery.');
    if (v.climate === 'alpine' && v.roof !== 'dome') t.push('Thin air: kicks carry farther and visitors fade in the 4th quarter.');
    if (weather === 'wind') t.push('Wind: long passes and long kicks get knocked down. Grind it out.');
    if (weather === 'heat') t.push('Heat: deeper rosters win late, and meters fill faster.');
    if (weather === 'snow') t.push('Snow: short passes and runs. Field goals get dicey.');
    if (v.neutral) t.push('Neutral site: no home crowd edge for anyone.');
    return t;
  };
})();
