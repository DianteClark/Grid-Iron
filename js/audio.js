/* Grid Iron — synthesized sound effects and music (Web Audio, no files) */
(function () {
  const GI = window.GI;
  let ctx = null, master = null, sfxBus = null, musicBus = null, crowdBus = null, noiseBuf = null;
  let crowdSrc = null, crowdFilter = null, musicTimer = null, musicOn = false, step = 0, nextT = 0;
  const prefs = () => GI.prefs.get();

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
    crowdBus = ctx.createGain(); crowdBus.gain.value = 0; crowdBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  // browsers need a user gesture before audio can start
  const unlock = () => {
    if (!init()) return;
    if (ctx.state === 'suspended') ctx.resume();
    GI.audio.refresh();
  };
  ['pointerdown', 'touchend', 'keydown'].forEach((e) => window.addEventListener(e, unlock, { passive: true }));
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });

  const sfxOn = () => prefs().sfx !== false;
  function tone(freq, dur, type, vol, when, slideTo) {
    const t = when || ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  function noise(dur, vol, filterType, freq, when, q, bus) {
    const t = when || ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = filterType || 'lowpass'; f.frequency.value = freq || 1000; f.Q.value = q || 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus || sfxBus); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  function swell(peak, dur) { // crowd roar on top of the ambience
    const t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t); s.stop(t + dur + 0.1);
  }

  const SFX = {
    tap: () => tone(880, 0.05, 'triangle', 0.08),
    impact: () => { const t = ctx.currentTime; [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'triangle', 0.11, t + i * 0.055)); swell(0.18, 0.5); },
    theirImpact: () => { const t = ctx.currentTime; [392, 330, 262].forEach((f, i) => tone(f, 0.18, 'sawtooth', 0.05, t + i * 0.07)); },
    card: () => { const t = ctx.currentTime; tone(1175, 0.1, 'sine', 0.1, t); tone(1568, 0.22, 'sine', 0.09, t + 0.08); },
    select: () => { tone(660, 0.06, 'triangle', 0.1); tone(990, 0.08, 'triangle', 0.08, ctx.currentTime + 0.05); },
    snap: () => { noise(0.07, 0.35, 'lowpass', 500); tone(120, 0.08, 'sine', 0.3); },
    hit: () => { noise(0.16, 0.55, 'lowpass', 700); tone(80, 0.14, 'sine', 0.45, null, 45); },
    bighit: () => { noise(0.3, 0.8, 'lowpass', 900); tone(70, 0.3, 'sine', 0.6, null, 35); swell(0.25, 1.2); },
    kick: () => { tone(140, 0.12, 'sine', 0.55, null, 60); noise(0.09, 0.4, 'highpass', 1500); },
    catch: () => { tone(420, 0.05, 'square', 0.08); noise(0.05, 0.25, 'bandpass', 2200, null, 2); },
    whistle: () => {
      const t = ctx.currentTime;
      const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 2650; lfo.frequency.value = 38; lg.gain.value = 120;
      lfo.connect(lg); lg.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.02); g.gain.setValueAtTime(0.09, t + 0.22); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      o.connect(g); g.connect(sfxBus); o.start(t); lfo.start(t); o.stop(t + 0.35); lfo.stop(t + 0.35);
    },
    td: () => {
      const t = ctx.currentTime;
      [261.6, 329.6, 392, 523.2].forEach((f, i) => { tone(f, 0.9, 'sawtooth', 0.07, t + i * 0.09); tone(f * 1.005, 0.9, 'square', 0.03, t + i * 0.09); });
      tone(523.2, 1.2, 'sawtooth', 0.08, t + 0.42); tone(659.3, 1.2, 'sawtooth', 0.06, t + 0.42);
      swell(0.5, 2.6);
    },
    good: () => { tone(523, 0.12, 'triangle', 0.14); tone(784, 0.25, 'triangle', 0.14, ctx.currentTime + 0.1); swell(0.3, 1.4); },
    bad: () => { tone(330, 0.18, 'sawtooth', 0.08, null, 250); tone(220, 0.35, 'sawtooth', 0.08, ctx.currentTime + 0.16, 160); },
    turnover: () => { tone(700, 0.4, 'square', 0.07, null, 180); noise(0.25, 0.4, 'lowpass', 800); swell(0.35, 1.6); },
    fire: () => { noise(0.5, 0.25, 'bandpass', 600, null, 0.8); tone(200, 0.4, 'sawtooth', 0.05, null, 600); },
    armed: () => { const t = ctx.currentTime; [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.14, 'triangle', 0.12, t + i * 0.06)); },
    clash: () => { tone(1800, 0.5, 'square', 0.06, null, 900); tone(1200, 0.6, 'triangle', 0.1, null, 400); noise(0.35, 0.6, 'highpass', 2500); tone(60, 0.4, 'sine', 0.6, null, 30); },
    star: () => { const t = ctx.currentTime; [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.22, 'triangle', 0.1, t + i * 0.05)); swell(0.35, 1.6); },
    flag: () => { tone(1400, 0.08, 'square', 0.06); tone(1400, 0.08, 'square', 0.06, ctx.currentTime + 0.12); },
    paper: () => { const t = ctx.currentTime; for (let i = 0; i < 5; i++) noise(0.12, 0.18, 'bandpass', 1200 + i * 500, t + i * 0.12, 1.2); tone(90, 0.25, 'sine', 0.5, t + 0.75, 50); noise(0.2, 0.4, 'lowpass', 600, t + 0.75); },
    horn: () => { tone(220, 1.1, 'sawtooth', 0.12); tone(277, 1.1, 'sawtooth', 0.09); tone(330, 1.1, 'sawtooth', 0.07); },
  };

  // ---------- crowd ambience ----------
  function startCrowd(level) {
    if (!ctx) return;
    if (!crowdSrc) {
      crowdSrc = ctx.createBufferSource(); crowdSrc.buffer = noiseBuf; crowdSrc.loop = true;
      crowdFilter = ctx.createBiquadFilter(); crowdFilter.type = 'bandpass'; crowdFilter.frequency.value = 700; crowdFilter.Q.value = 0.4;
      crowdSrc.connect(crowdFilter); crowdFilter.connect(crowdBus); crowdSrc.start();
    }
    const on = sfxOn() && prefs().crowd !== false;
    crowdBus.gain.setTargetAtTime(on ? 0.012 + (level / 100) * 0.05 : 0, ctx.currentTime, 0.5);
  }

  // ---------- music: a simple stadium groove ----------
  const BPM = 104, SPB = 60 / BPM / 4; // 16th notes
  const BASS = [43.65, 0, 43.65, 0, 0, 43.65, 0, 51.91, 55, 0, 55, 0, 0, 51.91, 0, 48.99];
  const CHORDS = [[174.6, 220, 261.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 207.7, 246.9]];
  function schedule() {
    while (nextT < ctx.currentTime + 0.15) {
      const s = step % 16, bar = Math.floor(step / 16) % 4, t = nextT;
      if (s % 4 === 0) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.2); }
      if (s === 4 || s === 12) noise(0.14, 0.28, 'bandpass', 1800, t, 0.8, musicBus);
      if (s % 2 === 1) noise(0.03, 0.07, 'highpass', 7000, t, 0.7, musicBus);
      const b = BASS[s] * (bar === 2 ? 1.122 : bar === 3 ? 0.944 : 1);
      if (b) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = b * 2; g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.0001, t + SPB * 1.8); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + SPB * 2); }
      if (s === 0 || s === 10) CHORDS[bar].forEach((f) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.value = f * 2; g.gain.setValueAtTime(0.025, t); g.gain.exponentialRampToValueAtTime(0.0001, t + SPB * 3); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + SPB * 3.2); });
      nextT += SPB; step++;
    }
  }
  function startMusic() {
    if (!ctx || musicOn) return;
    musicOn = true; nextT = ctx.currentTime + 0.05; step = 0;
    musicBus.gain.cancelScheduledValues(ctx.currentTime); musicBus.gain.setTargetAtTime(0.32, ctx.currentTime, 0.3);
    musicTimer = setInterval(schedule, 50);
  }
  function stopMusic() {
    if (!musicOn) return;
    musicOn = false; clearInterval(musicTimer);
    if (ctx) musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
  }

  let scene = 'menu', crowdLevel = 0;
  GI.audio = {
    play(name) {
      if (!ctx || !sfxOn() || ctx.state !== 'running') return;
      try { SFX[name] && SFX[name](); } catch (e) {}
    },
    buzz(ms) { if (prefs().haptics !== false && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) {} },
    scene(s, level) { scene = s; crowdLevel = level || 0; this.refresh(); },
    refresh() {
      if (!ctx) return;
      const wantMusic = prefs().music !== false && scene === 'menu';
      if (wantMusic) startMusic(); else stopMusic();
      if (scene === 'game') startCrowd(crowdLevel); else if (crowdBus) crowdBus.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
    },
  };
})();
