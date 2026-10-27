/* Grid Iron — static data: teams, positions, plays, counters */
(function () {
  const GI = (window.GI = window.GI || {});

  // ---------- seeded RNG ----------
  GI.mulberry32 = function (a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // ---------- 32 custom teams ----------
  GI.TEAMS_BASE = [
    ['Austin', 'Outlaws', 'AUS', '#e8681a', '#1f1b18'],
    ['Birmingham', 'Ironmen', 'BHM', '#5b6670', '#d7263d'],
    ['Boise', 'Peaks', 'BOI', '#1e5aa8', '#f28c28'],
    ['Brooklyn', 'Bridges', 'BKN', '#22223b', '#f2c14e'],
    ['Charleston', 'Tides', 'CHS', '#119da4', '#0b3954'],
    ['Columbus', 'Comets', 'CMB', '#c1121f', '#003049'],
    ['Des Moines', 'Twisters', 'DSM', '#6a4c93', '#ffca3a'],
    ['El Paso', 'Scorpions', 'ELP', '#d4a017', '#3d2b1f'],
    ['Fresno', 'Rattlers', 'FRE', '#4f772d', '#ecf39e'],
    ['Hartford', 'Foxes', 'HFD', '#d9480f', '#1b4332'],
    ['Honolulu', 'Waves', 'HNL', '#00a6a6', '#f6aa1c'],
    ['Albuquerque', 'Roadrunners', 'ABQ', '#bc4b51', '#5b8e7d'],
    ['Louisville', 'Stallions', 'LOU', '#7b2cbf', '#e0aaff'],
    ['Memphis', 'Blues', 'MEM', '#1d4ed8', '#93c5fd'],
    ['Milwaukee', 'Muskies', 'MKE', '#2d6a4f', '#95d5b2'],
    ['Omaha', 'Stampede', 'OMA', '#8d0801', '#f4d58d'],
    ['Orlando', 'Moonshots', 'ORL', '#3a0ca3', '#4cc9f0'],
    ['Portland', 'Lumberjacks', 'POR', '#386641', '#bc4749'],
    ['Providence', 'Keepers', 'PRV', '#14213d', '#fca311'],
    ['Raleigh', 'Foxhounds', 'RAL', '#9d0208', '#e5e5e5'],
    ['Reno', 'Jackpots', 'RNO', '#e63946', '#2a9d8f'],
    ['Richmond', 'Generals', 'RIC', '#283618', '#dda15e'],
    ['Sacramento', 'Gold Rush', 'SAC', '#e9b20c', '#264653'],
    ['Salt Lake', 'Summit', 'SLC', '#0077b6', '#caf0f8'],
    ['San Antonio', 'Vaqueros', 'SAT', '#6d4c41', '#ff7f11'],
    ['Spokane', 'Sasquatch', 'SPK', '#606c38', '#fefae0'],
    ['St. Louis', 'Arches', 'STL', '#adb5bd', '#0b090a'],
    ['Tulsa', 'Wildcatters', 'TUL', '#ff006e', '#3a0ca3'],
    ['Anchorage', 'Aurora', 'ANC', '#06d6a0', '#073b4c'],
    ['Toledo', 'Glassmen', 'TOL', '#48cae4', '#023e8a'],
    ['Savannah', 'Ghosts', 'SAV', '#495057', '#c7f9cc'],
    ['Wichita', 'Aviators', 'WIC', '#003566', '#ffc300'],
  ];

  GI.FIRST = ['Marcus','Dre','Tyrell','Jalen','Cody','Ray','Eli','Brock','Deshawn','Mateo','Luis','Andre','Trey','Malik','Jaxon','Darius','Colt','Keon','Isaiah','Bo','Xavier','Rashad','Tanner','Quinn','Dante','Jamal','Wes','Kofi','Rico','Zeke','Hank','Omar','Devin','Nico','Gage','Theo','Rex','Amari','Cruz','Kai','Booker','Lamar','Otis','Silas','Jules','Ty','Moses','Easton','Cam','Reggie'];
  GI.LAST = ['Rivers','Stone','Washington','Hollis','Banks','Carter','Mercer','Fontaine','Okafor','Delgado','Brooks','Hayes','Pruitt','Vance','Kingsley','Moreau','Whitfield','Tate','Barlow','Nakamura','Ellison','Grady','Ashford','Booker','Calloway','Dunbar','Everett','Fairley','Gentry','Holloway','Ivey','Jefferson','Kemper','Lockett','Maddox','Norwood','Odom','Pickens','Quarles','Rollins','Sutton','Thorne','Underwood','Voss','Wilder','Yates','Zamora','Abernathy','Blackwell','Cortez','Drummond','Easley','Flowers','Goodwin','Harlan','Ingram','Jolly','Knox','Langston','Monroe'];
  GI.COACH_LAST = ['Halvorsen','McBride','Pettaway','Garrity','Lindqvist','Oduya','Sorensen','Buckner','Ferraro','Whitlock','Castellanos','Dobbs','Ainsley','Marchetti','Royce','Vandermeer','Caldwell','Ibarra','Northcutt','Pryor'];

  // ---------- positions ----------
  GI.POS = {
    QB: { side: 'O', label: 'QB', full: 'Quarterback' },
    RB: { side: 'O', label: 'RB', full: 'Running Back' },
    WR: { side: 'O', label: 'WR', full: 'Wide Receiver' },
    OL: { side: 'O', label: 'OL', full: 'Offensive Line' },
    LB: { side: 'D', label: 'LB', full: 'Linebacker' },
    S:  { side: 'D', label: 'S',  full: 'Safety' },
    DL: { side: 'D', label: 'DL', full: 'Defensive Line' },
    CB: { side: 'D', label: 'CB', full: 'Cornerback' },
    KP: { side: 'ST', label: 'K/P', full: 'Kicker / Punter' },
  };
  // what a Show-Me play looks like for each star
  GI.SHOWME = {
    QB: { o: ['short', 'long', 'trick'], name: 'Dime Drop', desc: 'Guaranteed strike downfield' },
    RB: { o: ['in_run', 'out_run', 'trick'], name: 'Breakaway', desc: 'Busts one loose for a huge gain' },
    WR: { o: ['short', 'long', 'trick'], name: 'Circus Catch', desc: 'Hauls in anything near him' },
    OL: { o: ['in_run', 'out_run'], name: 'Pancake Block', desc: '+15 extra yards on a run' },
    DL: { d: ['short', 'long', 'trick', 'in_run', 'out_run'], name: 'Strip Sack', desc: 'Sack or tackle for loss, may force a fumble' },
    LB: { d: ['in_run', 'out_run', 'short', 'trick'], name: 'Takeaway', desc: 'Punches the ball out or jumps the route' },
    S:  { d: ['short', 'long', 'trick'], name: 'Pick Six Hunt', desc: 'Picks it off and takes it back' },
    CB: { d: ['short', 'long'], name: 'Lockdown', desc: 'Jumps the route: pick or pass breakup' },
    KP: { k: true, name: 'Big Leg', desc: '+8 yards of range, booming punts' },
  };
  // flexible star slot limits (on-field room)
  GI.FLEX_MAX = { RB: 1, WR: 3, OL: 3, LB: 2, S: 2, DL: 3, CB: 2 };

  // ---------- plays ----------
  GI.OFF_PLAYS = [
    { id: 'in_run', name: 'Inside Run', tag: 'RUN', desc: 'Power up the gut. Steady yards.' },
    { id: 'out_run', name: 'Outside Run', tag: 'RUN', desc: 'Stretch to the edge. Boom or bust.' },
    { id: 'short', name: 'Short Pass', tag: 'PASS', desc: 'Quick hitter. High completion.' },
    { id: 'long', name: 'Long Pass', tag: 'PASS', desc: 'Go deep. Big risk, big reward.' },
    { id: 'trick', name: 'Trick Play', tag: 'TRICK', desc: 'Flea flicker. Wild results.' },
  ];
  GI.DEF_PLAYS = [
    { id: 'man', name: 'Man', tag: 'COVER', desc: 'Stick to your man. Kills trick plays.' },
    { id: 'zone', name: 'Zone', tag: 'COVER', desc: 'Balanced and safe. No big holes.' },
    { id: 'deep', name: 'Cover Long', tag: 'COVER', desc: 'Safeties deep. Stops the bomb.' },
    { id: 'press', name: 'Press', tag: 'COVER', desc: 'Jam at the line. Stops short passes.' },
    { id: 'blitz_in', name: 'Blitz In', tag: 'BLITZ', desc: 'Send the A-gap. Stuffs inside runs.' },
    { id: 'blitz_out', name: 'Blitz Out', tag: 'BLITZ', desc: 'Crash the edges. Stuffs outside runs.' },
  ];
  // offense advantage: + good for offense, - good for defense
  GI.MATRIX = {
    in_run:  { man: 0,  zone: 0,  deep: 2,  press: 1,  blitz_in: -2, blitz_out: 1 },
    out_run: { man: 1,  zone: 0,  deep: 1,  press: 0,  blitz_in: 2,  blitz_out: -2 },
    short:   { man: 0,  zone: -1, deep: 2,  press: -2, blitz_in: 1,  blitz_out: 1 },
    long:    { man: 1,  zone: -1, deep: -2, press: 2,  blitz_in: -1, blitz_out: 0 },
    trick:   { man: -2, zone: 0,  deep: 0,  press: 1,  blitz_in: 2,  blitz_out: 2 },
  };
  GI.counterOf = function (off) { // defense that shuts the play down
    const row = GI.MATRIX[off];
    return Object.keys(row).find((d) => row[d] === -2);
  };
  GI.playName = function (id) {
    const p = GI.OFF_PLAYS.concat(GI.DEF_PLAYS).find((x) => x.id === id);
    return p ? p.name : ({ punt: 'Punt', fg: 'Field Goal', xp: 'Extra Point', kick: 'Kickoff' }[id] || id);
  };

  GI.WEATHER = {
    clear: { name: 'Clear', icon: '☀️', pass: 0, long: 0, run: 0, fum: 1, kick: 0, desc: 'Perfect football weather' },
    rain:  { name: 'Rain', icon: '🌧️', pass: -0.4, long: -0.2, run: 0, fum: 1.7, kick: -2, desc: 'Slick ball: more fumbles, tougher throws' },
    snow:  { name: 'Snow', icon: '❄️', pass: -0.6, long: -0.4, run: -0.2, fum: 1.4, kick: -4, desc: 'Slow footing, short kicks' },
    wind:  { name: 'Windy', icon: '💨', pass: -0.1, long: -0.8, run: 0, fum: 1, kick: -6, desc: 'Deep balls and kicks get knocked down' },
    heat:  { name: 'Scorcher', icon: '🔥', pass: 0, long: 0, run: 0, fum: 1.1, kick: 1, desc: 'Players tire late; meters fill faster' },
  };
  GI.CROWD = [
    { name: 'Half Empty', level: 20 },
    { name: 'Rowdy', level: 50 },
    { name: 'Packed', level: 75 },
    { name: 'Deafening', level: 95 },
  ];
  GI.OC_STYLES = { run: 'Ground & Pound', pass: 'Air Raid', balanced: 'Balanced', gadget: 'Gadget Guru' };
  GI.DC_STYLES = { blitz: 'Blitz Happy', cover: 'Bend Don\'t Break', press: 'Lockdown Press', balanced: 'Balanced' };
})();
