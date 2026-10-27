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
    TE: { side: 'O', label: 'TE', full: 'Tight End' },
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
    TE: { o: ['short', 'in_run', 'out_run', 'trick'], name: 'Seam Buster', desc: 'Rumbles up the seam, or seals the edge for +12' },
    DL: { d: ['short', 'long', 'trick', 'in_run', 'out_run'], name: 'Strip Sack', desc: 'Sack or tackle for loss, may force a fumble' },
    LB: { d: ['in_run', 'out_run', 'short', 'trick'], name: 'Takeaway', desc: 'Punches the ball out or jumps the route' },
    S:  { d: ['short', 'long', 'trick'], name: 'Pick Six Hunt', desc: 'Picks it off and takes it back' },
    CB: { d: ['short', 'long'], name: 'Lockdown', desc: 'Jumps the route: pick or pass breakup' },
    KP: { k: true, name: 'Big Leg', desc: '+8 yards of range, booming punts' },
  };
  // special-teams show-me moves (armed stars fire on kick and punt plays)
  GI.RETURN_POS = ['RB', 'WR', 'CB', 'S'];
  GI.COVER_POS = ['LB', 'S'];
  GI.KICK_MOVES = {
    ret: { name: 'House Call', desc: 'Takes a kick or punt back for a huge return, maybe all the way' },
    cov: { name: 'Big Hit', desc: 'Blows up the returner on kick coverage, can jar the ball loose' },
  };
  // one college per franchise city (same order as TEAMS_BASE): drafting a "hometown hero" fires up the fans
  GI.COLLEGES = ['Hill Country State', 'Red Mountain Tech', 'Snake River U', 'Harbor City', 'Lowcountry A&M', 'Buckeye Valley', 'Great Plains U', 'Rio Grande State', 'Central Valley Tech', 'Charter Oak', 'Pacific Islands U', 'Mesa Verde', 'Bluegrass State', 'Delta State', 'Lakeshore State', 'Platte River U',
    'Sunshine Tech', 'Timberline', 'Ocean State', 'Triangle Tech', 'Silver State', 'James River U', 'Sierra Polytechnic', 'Wasatch State', 'Alamo A&M', 'Inland Empire U', 'Gateway U', 'Green Country State', 'Northern Lights U', 'Maumee Valley', 'Coastal Georgia', 'Prairie Wind Tech'];
  GI.homeCollege = (teamIdx) => GI.COLLEGES[teamIdx];
  GI.COLLEGE_COLORS = ['#bf5700', '#8b1e3f', '#0b6e4f', '#1d3557', '#2a9d8f', '#bb0000', '#6a994e', '#c1440e', '#3a5a40', '#0f4c81', '#00818a', '#9d4edd', '#005eb8', '#7b2d26', '#007a33', '#b08d57',
    '#ff7f11', '#2d6a4f', '#3f88c5', '#cc0033', '#264653', '#7f1d1d', '#e76f51', '#1b4965', '#9b2226', '#588157', '#4361ee', '#d00000', '#14746f', '#6b705c', '#bc6c25', '#023e8a'];

  // star traits: 1-2 per star (some have none)
  GI.TRAITS = {
    leader: { name: 'Leader', icon: '📣', desc: '+3 team morale every game he plays' },
    diva: { name: 'Diva', icon: '💅', desc: 'Meter fills 20% faster, more clutch — and more drama' },
    gymrat: { name: 'Gym Rat', icon: '🏋️', desc: 'Grows faster at spring training' },
    ironman: { name: 'Ironman', icon: '🛡️', desc: 'Rarely gets hurt, heals faster' },
    biggame: { name: 'Big Game', icon: '💎', desc: 'Clutch and hot in playoffs and rivalry games' },
    mentor: { name: 'Mentor', icon: '🎓', desc: 'Young stars at his position grow faster' },
  };
  GI.TRAIT_KEYS = Object.keys(GI.TRAITS);

  // offseason playbook identity
  GI.IDENTITIES = {
    ground: { name: 'Ground & Pound', icon: '🐂', calls: { in_run: 0.22, out_run: 0.18 }, fit: ['RB', 'OL', 'TE'], desc: 'Runs hit harder. RB, OL and TE stars love it.' },
    air: { name: 'Air Raid', icon: '🚀', calls: { long: 0.22, short: 0.12 }, fit: ['QB', 'WR'], desc: 'Deep shots land more. QB and WR stars love it.' },
    west: { name: 'West Coast', icon: '🌊', calls: { short: 0.24, out_run: 0.08 }, fit: ['QB', 'TE', 'RB'], desc: 'Quick timing throws. QB, TE and RB stars love it.' },
    blitz: { name: 'Blitz Heavy', icon: '⚡', calls: { blitz_in: 0.22, blitz_out: 0.22 }, fit: ['LB', 'DL'], desc: 'Pressure packages hit home. LB and DL stars love it.' },
    bend: { name: "Bend Don't Break", icon: '🧱', calls: { deep: 0.16, zone: 0.16 }, rz: 0.3, fit: ['S', 'CB'], desc: 'Shells hold and the red zone tightens. S and CB stars love it.' },
  };

  // halftime adjustments
  GI.ADJUST = {
    double: { name: 'Double their top target', icon: '🎯', desc: 'Their passing game −, their run game +' },
    stack: { name: 'Stack the box', icon: '🧱', desc: 'Their run game −, their deep ball +' },
    ground: { name: 'Lean on the run', icon: '🐂', desc: 'Your runs +, your passes a little −' },
    protect: { name: 'Protect the QB', icon: '🛡️', desc: 'Half as many sacks, deep shots slightly −' },
    airout: { name: 'Air it out', icon: '🚀', desc: 'Your deep ball +, a bit more pick risk' },
    secure: { name: 'Ball security', icon: '🤲', desc: 'Half the turnovers, slightly less punch' },
    tempo: { name: 'Up-tempo', icon: '⏩', desc: 'Faster snaps and hotter star meters' },
  };

  // why a call beat (or lost to) the other side's call
  GI.REASON = {
    'in_run|deep': 'Inside runs gash a deep shell', 'in_run|blitz_in': 'The A-gap blitz met him in the hole',
    'out_run|blitz_in': 'Everyone crashed inside — the edge was wide open', 'out_run|blitz_out': 'Edge rushers sealed the corner',
    'short|deep': 'Soft cushion underneath — easy pitch-and-catch', 'short|press': 'Jammed at the line, no quick throws',
    'long|press': 'Pressed corners got beat over the top', 'long|deep': 'Safeties were waiting deep',
    'trick|blitz_in': 'Blitzers flew past the flea flicker', 'trick|blitz_out': 'Edge pressure overran the trick',
    'trick|man': 'Man coverage stayed glued on the trick',
  };

  // Legacy store cosmetics (bought with Legacy Points)
  GI.COSMETICS = {
    jersey: {
      home: { name: 'Home', cost: 0, desc: 'Your classic colors' },
      throwback: { name: 'Throwback', cost: 40, desc: 'Colors flipped, old-school' },
      blackout: { name: 'Blackout', cost: 60, desc: 'All black, trim in your color' },
      gold: { name: 'Gold Rush', cost: 80, desc: 'Champion gold' },
      ice: { name: 'Ice', cost: 60, desc: 'Arctic white' },
      rush: { name: 'Color Rush', cost: 50, desc: 'Head to toe in your main color' },
      heritage: { name: 'Heritage', cost: 0, desc: 'Vintage wool look. Unlocked by finishing that team\'s album page', special: true },
    },
    field: {
      classic: { name: 'Classic Turf', cost: 0, desc: 'Fresh-cut stripes' },
      checker: { name: 'Checkerboard', cost: 50, desc: 'Checkerboard end zones' },
      retro: { name: 'Retro Grass', cost: 50, desc: 'Sun-baked 70s field' },
      night: { name: 'Night Game', cost: 70, desc: 'Under the lights' },
      neon: { name: 'Neon', cost: 90, desc: 'Glowing yard lines' },
    },
    celebrate: {
      confetti: { name: 'Confetti', cost: 0, desc: 'Paper confetti burst' },
      fireworks: { name: 'Fireworks', cost: 50, desc: 'Sparks fly on every score' },
      stickers: { name: 'Sticker Storm', cost: 60, desc: 'Stars and crests rain down' },
      goldrain: { name: 'Gold Rain', cost: 80, desc: 'A shower of gold' },
    },
    ball: {
      classic: { name: 'Game Ball', cost: 0, desc: 'Pebbled leather, white laces' },
      white: { name: 'All-Star White', cost: 30, desc: 'The exhibition ball' },
      gold: { name: 'Golden Ball', cost: 60, desc: 'For the ones who win it all' },
      neon: { name: 'Neon', cost: 50, desc: 'Glows when it flies' },
    },
    board: {
      prime: { name: 'Prime Time', cost: 0, desc: 'Green game clock' },
      gold: { name: 'Gold Standard', cost: 40, desc: 'Gold clock and trim' },
      ice: { name: 'Ice Blue', cost: 30, desc: 'Cool blue clock' },
      crimson: { name: 'Crimson', cost: 30, desc: 'Red-hot clock' },
      royal: { name: 'Royal', cost: 30, desc: 'Purple clock' },
    },
  };
  // flexible star slot limits (on-field room)
  GI.FLEX_MAX = { RB: 1, WR: 3, TE: 1, OL: 3, LB: 2, S: 2, DL: 3, CB: 2 };

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
    dome:  { name: 'Indoors', icon: '🏟️', pass: 0.05, long: 0.05, run: 0, fum: 0.9, kick: 2, desc: 'Perfect conditions under the roof — and it gets loud' },
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
