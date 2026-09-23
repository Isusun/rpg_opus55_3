'use strict';
// =============================================================
// オーディオ: WebAudio によるチップチューン風BGMシーケンサと効果音
//  外部音源ファイルは使わず、すべてオシレータとノイズで合成する。
//  既定はOFF。ONにしたときに初めて AudioContext を生成する。
// =============================================================
const Sound = (() => {
  let ctx = null, master = null, bgmBus = null, sfxBus = null, noiseBuf = null;
  let current = null; // 再生中のBGM
  let timer = null;

  const NOTE_IDX = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  function freq(name) {
    const m = /^([A-G][#b]?)(\d)$/.exec(name);
    if (!m) return 0;
    const midi = 12 * (parseInt(m[2], 10) + 1) + NOTE_IDX[m[1]];
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
  // "C5/2 E5/2 R/4" → [{f, len}]
  function parseLine(str) {
    return str.trim().split(/\s+/).map((tok) => {
      const [n, l] = tok.split('/');
      return { f: n === 'R' ? 0 : freq(n), len: parseFloat(l || '1') };
    });
  }
  const CHORD = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], dim: [0, 3, 6] };
  function chordNotes(sym, oct) {
    const m = /^([A-G][#b]?)(m|7|dim)?$/.exec(sym);
    const root = 12 * (oct + 1) + NOTE_IDX[m[1]];
    return (CHORD[m[2] || ''] || CHORD['']).map((iv) => 440 * Math.pow(2, (root + iv - 69) / 12));
  }

  // ---------- 楽曲（すべてオリジナル） ----------
  // bpm: 8分音符=1ステップ換算のテンポ / prog: 1小節=8ステップごとのコード
  const SONGS = {
    title: { bpm: 80, prog: 'C G Am Em F C Dm G', bass: 'long', arp: 'up', drums: '',
      mel: 'E5/4 G5/2 C6/2 D6/4 B5/4 C6/2 B5/2 A5/4 G5/6 E5/2 F5/4 A5/2 C6/2 G5/4 E5/2 C5/2 D5/2 E5/2 F5/2 A5/2 G5/8' },
    town: { bpm: 104, prog: 'F C Dm Bb F C Bb C', bass: 'walk', arp: 'waltz', drums: 'k...h...k...h...',
      mel: 'A4/2 C5/2 F5/4 E5/2 D5/2 C5/4 D5/2 F5/2 A5/3 G5/1 F5/4 D5/4 C5/2 A4/2 F4/2 A4/2 G4/2 C5/2 E5/4 D5/2 C5/2 Bb4/2 D5/2 C5/8' },
    field: { bpm: 128, prog: 'G D Em C G D C D', bass: 'drive', arp: 'up', drums: 'k.h.s.h.k.h.s.hh',
      mel: 'G4/2 B4/2 D5/3 G5/1 F#5/2 E5/2 D5/4 E5/2 G5/2 B5/2 A5/2 G5/4 E5/4 D5/2 G5/2 B5/3 A5/1 A5/2 F#5/2 D5/4 E5/2 D5/2 C5/2 B4/2 A4/4 D5/4' },
    dungeon: { bpm: 88, prog: 'Am Am F E Am Dm E E', bass: 'long', arp: 'down', drums: 'k.......h...k...',
      mel: 'A4/3 C5/1 E5/4 D5/2 C5/2 B4/4 C5/3 A4/1 F4/4 G#4/6 R/2 A4/2 E5/2 A5/4 F5/2 E5/2 D5/4 E5/2 D5/2 C5/2 B4/2 G#4/8' },
    battle: { bpm: 152, prog: 'Dm Dm Bb C Dm Dm Bb A', bass: 'drive', arp: 'up', drums: 'k.hsk.hsk.hsk.ss',
      mel: 'D5/1 D5/1 F5/1 A5/1 D6/2 A5/2 C6/2 A5/1 G5/1 F5/2 E5/2 F5/1 G5/1 A5/2 Bb5/2 A5/2 G5/2 E5/2 C5/4 D5/1 D5/1 F5/1 A5/1 D6/3 E6/1 F6/2 E6/2 D6/2 A5/2 Bb5/2 A5/2 G5/2 F5/2 E5/2 C#5/2 A4/4' },
    boss: { bpm: 164, prog: 'Em C D B Em C Am B', bass: 'drive', arp: 'up', drums: 'kkhskkhskkhskshs',
      mel: 'E5/1 R/1 E5/1 G5/1 B5/2 E6/2 D6/2 C6/2 B5/2 G5/2 A5/2 F#5/2 D5/2 A5/2 B5/4 D#5/4 E5/1 G5/1 B5/1 E6/1 G6/2 F#6/2 E6/2 C6/2 G5/4 A5/2 C6/2 E6/2 D6/2 D#6/4 B5/4' },
    lastdungeon: { bpm: 96, prog: 'Bm G A F# Bm G Em F#', bass: 'long', arp: 'down', drums: 'k...h.h.k...h...',
      mel: 'B4/2 D5/2 F#5/4 G5/2 F#5/2 D5/4 E5/2 C#5/2 A4/4 A#4/6 R/2 B4/2 F#5/2 B5/4 A5/2 G5/2 D5/4 E5/2 G5/2 B5/2 A5/2 A#5/8' },
    reverse: { bpm: 76, prog: 'Cm Ab Fm G Cm Ab Fm G', bass: 'long', arp: 'down', drums: 'k.......k.......',
      mel: 'C5/4 Eb5/2 G5/2 Ab5/4 G5/4 F5/2 Eb5/2 C5/4 B4/8 C5/2 G5/2 C6/4 Bb5/2 Ab5/2 G5/4 F5/2 Ab5/2 C6/2 B5/2 G5/8' },
    ending: { bpm: 88, prog: 'F G Em Am Dm G C C', bass: 'long', arp: 'up', drums: '',
      mel: 'A5/4 G5/2 F5/2 G5/4 D5/4 E5/2 G5/2 B5/2 C6/2 A5/8 F5/2 A5/2 D6/4 B5/2 A5/2 G5/4 E5/2 G5/2 C6/2 D6/2 C6/8' },
  };
  // 事前展開
  for (const s of Object.values(SONGS)) {
    s.melody = parseLine(s.mel);
    s.chords = s.prog.split(' ');
    s.steps = s.chords.length * 8;
  }

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.2;
      master = ctx.createGain(); master.gain.value = 0.8;
      master.connect(comp); comp.connect(ctx.destination);
      bgmBus = ctx.createGain(); sfxBus = ctx.createGain();
      bgmBus.connect(master); sfxBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      applyVolumes();
      return true;
    } catch (e) { ctx = null; return false; }
  }
  function applyVolumes() {
    if (!ctx) return;
    const t = ctx.currentTime;
    bgmBus.gain.setTargetAtTime(Settings.get('bgm') ? Settings.get('bgmVol') * 0.55 : 0, t, 0.05);
    sfxBus.gain.setTargetAtTime(Settings.get('sfx') ? Settings.get('sfxVol') * 0.8 : 0, t, 0.02);
  }

  function tone(bus, f, t, dur, type, vol, opt) {
    if (!f) return;
    opt = opt || {};
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (opt.slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * opt.slide), t + dur);
    if (opt.vib) {
      const lfo = ctx.createOscillator(); const lg = ctx.createGain();
      lfo.frequency.value = 5.5; lg.gain.value = f * 0.006;
      lfo.connect(lg); lg.connect(o.frequency); lfo.start(t + 0.08); lfo.stop(t + dur + 0.1);
    }
    const a = 0.006, r = Math.min(0.08, dur * 0.4);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.setValueAtTime(vol * (opt.sus || 0.7), t + Math.max(a, dur - r));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (opt.lp) { const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = opt.lp; o.connect(f2); node = f2; }
    node.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(bus, t, dur, vol, hp) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = hp ? 'highpass' : 'lowpass'; f.frequency.value = hp || 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(bus);
    src.start(t); src.stop(t + dur + 0.02);
  }

  // ---------- BGM スケジューラ ----------
  function startSong(name) {
    const song = SONGS[name];
    if (!song) return;
    const stepDur = 60 / song.bpm / 2;
    current = { name, song, stepDur, step: 0, next: ctx.currentTime + 0.08, melIdx: 0, melLeft: 0 };
    if (timer) clearInterval(timer);
    timer = setInterval(schedule, 25);
    schedule();
  }
  function schedule() {
    if (!ctx || !current) return;
    const c = current, s = c.song;
    while (c.next < ctx.currentTime + 0.18) {
      const t = c.next, st = c.step % s.steps, bar = Math.floor(st / 8), beat = st % 8;
      const ch = chordNotes(s.chords[bar], 3);
      // メロディ
      if (st === 0) { c.melIdx = 0; c.melLeft = 0; }
      if (c.melLeft <= 0 && c.melIdx < s.melody.length) {
        const n = s.melody[c.melIdx++];
        tone(bgmBus, n.f, t, n.len * c.stepDur * 0.95, 'square', 0.085, { lp: 3200, vib: n.len >= 3, sus: 0.6 });
        c.melLeft = n.len;
      }
      c.melLeft -= 1;
      // ベース
      const root = ch[0] / 2;
      if (s.bass === 'long') { if (beat === 0) tone(bgmBus, root, t, c.stepDur * 7.5, 'triangle', 0.2, { sus: 0.8 }); }
      else if (s.bass === 'walk') { if (beat % 2 === 0) tone(bgmBus, [root, ch[1] / 2, ch[2] / 2, ch[1] / 2][beat / 2], t, c.stepDur * 1.8, 'triangle', 0.2); }
      else if (beat % 2 === 0 || beat === 7) tone(bgmBus, beat === 4 ? root * 1.5 : root, t, c.stepDur * 0.9, 'triangle', 0.22);
      // 和音アルペジオ
      if (s.arp === 'waltz') { if (beat % 2 === 1) ch.forEach((f) => tone(bgmBus, f * 2, t, c.stepDur * 0.8, 'triangle', 0.035)); }
      else {
        const seq = s.arp === 'down' ? ch.slice().reverse() : ch;
        tone(bgmBus, seq[beat % seq.length] * 2, t, c.stepDur * 0.9, 'triangle', 0.045);
      }
      // ドラム
      if (s.drums) {
        const d = s.drums[st % s.drums.length];
        if (d === 'k') { tone(bgmBus, 110, t, 0.12, 'sine', 0.3, { slide: 0.35 }); }
        else if (d === 's') noise(bgmBus, t, 0.1, 0.12, 1500);
        else if (d === 'h') noise(bgmBus, t, 0.03, 0.05, 6000);
      }
      c.step++;
      c.next += c.stepDur;
    }
  }
  function stopSong() {
    if (timer) { clearInterval(timer); timer = null; }
    current = null;
  }

  // ---------- 効果音 ----------
  const SFX = {
    cursor: (t) => tone(sfxBus, 880, t, 0.04, 'square', 0.08),
    ok: (t) => { tone(sfxBus, 660, t, 0.05, 'square', 0.1); tone(sfxBus, 990, t + 0.05, 0.07, 'square', 0.1); },
    cancel: (t) => { tone(sfxBus, 520, t, 0.05, 'square', 0.09); tone(sfxBus, 390, t + 0.05, 0.07, 'square', 0.09); },
    buzz: (t) => tone(sfxBus, 140, t, 0.18, 'square', 0.12, { lp: 900 }),
    hit: (t) => { noise(sfxBus, t, 0.12, 0.3, 400); tone(sfxBus, 180, t, 0.1, 'square', 0.12, { slide: 0.4 }); },
    crit: (t) => { noise(sfxBus, t, 0.2, 0.4, 300); tone(sfxBus, 300, t, 0.2, 'sawtooth', 0.12, { slide: 0.3 }); tone(sfxBus, 1200, t, 0.08, 'square', 0.08); },
    hurt: (t) => { noise(sfxBus, t, 0.18, 0.3, 200); tone(sfxBus, 120, t, 0.16, 'square', 0.14, { slide: 0.5 }); },
    miss: (t) => tone(sfxBus, 600, t, 0.12, 'sine', 0.1, { slide: 1.6 }),
    defeat: (t) => { tone(sfxBus, 400, t, 0.25, 'square', 0.1, { slide: 0.2 }); noise(sfxBus, t, 0.3, 0.12, 2000); },
    magic: (t) => { for (let i = 0; i < 5; i++) tone(sfxBus, 600 + i * 180, t + i * 0.03, 0.08, 'triangle', 0.08); },
    fire: (t) => { noise(sfxBus, t, 0.35, 0.3, 500); tone(sfxBus, 220, t, 0.3, 'sawtooth', 0.06, { slide: 0.6, lp: 1200 }); },
    ice: (t) => { for (let i = 0; i < 4; i++) tone(sfxBus, 1800 - i * 200, t + i * 0.04, 0.1, 'sine', 0.08); },
    thunder: (t) => { noise(sfxBus, t, 0.4, 0.4, 100); tone(sfxBus, 90, t, 0.35, 'sawtooth', 0.1, { slide: 0.5 }); },
    wind: (t) => noise(sfxBus, t, 0.4, 0.2, 2500),
    light: (t) => { [1047, 1319, 1568, 2093].forEach((f, i) => tone(sfxBus, f, t + i * 0.04, 0.2, 'sine', 0.07)); },
    dark: (t) => { tone(sfxBus, 90, t, 0.45, 'sawtooth', 0.12, { slide: 0.6, lp: 700 }); noise(sfxBus, t, 0.4, 0.1, 150); },
    heal: (t) => { [523, 659, 784, 1047].forEach((f, i) => tone(sfxBus, f, t + i * 0.06, 0.14, 'triangle', 0.1)); },
    status: (t) => { tone(sfxBus, 300, t, 0.2, 'square', 0.08, { slide: 0.7, lp: 1500 }); tone(sfxBus, 240, t + 0.1, 0.2, 'square', 0.08, { lp: 1500 }); },
    buff: (t) => { [440, 554, 659].forEach((f, i) => tone(sfxBus, f, t + i * 0.05, 0.12, 'square', 0.07)); },
    levelup: (t) => { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(sfxBus, f, t + i * 0.09, i === 5 ? 0.45 : 0.1, 'square', 0.1)); },
    victory: (t) => { [784, 784, 784, 1047].forEach((f, i) => tone(sfxBus, f, t + i * 0.12, i === 3 ? 0.5 : 0.1, 'square', 0.1)); [392, 523].forEach((f, i) => tone(sfxBus, f, t + 0.36 + i * 0.01, 0.5, 'triangle', 0.14)); },
    encounter: (t) => { for (let i = 0; i < 6; i++) tone(sfxBus, 300 + (i % 2) * 300, t + i * 0.05, 0.05, 'square', 0.1); },
    chest: (t) => { [659, 784, 988, 1319].forEach((f, i) => tone(sfxBus, f, t + i * 0.07, 0.12, 'square', 0.09)); },
    item: (t) => { [784, 988, 1175].forEach((f, i) => tone(sfxBus, f, t + i * 0.08, 0.14, 'triangle', 0.1)); },
    door: (t) => { noise(sfxBus, t, 0.2, 0.2, 300); tone(sfxBus, 160, t, 0.15, 'square', 0.08); },
    warp: (t) => tone(sfxBus, 300, t, 0.35, 'triangle', 0.12, { slide: 3 }),
    run: (t) => { for (let i = 0; i < 4; i++) tone(sfxBus, 800 - i * 120, t + i * 0.04, 0.05, 'square', 0.07); },
    poison: (t) => tone(sfxBus, 200, t, 0.2, 'sawtooth', 0.08, { slide: 0.6, lp: 900 }),
    coin: (t) => { tone(sfxBus, 1319, t, 0.06, 'square', 0.08); tone(sfxBus, 1760, t + 0.06, 0.12, 'square', 0.08); },
    bump: (t) => tone(sfxBus, 90, t, 0.06, 'square', 0.08),
    switch: (t) => { tone(sfxBus, 300, t, 0.05, 'square', 0.1); tone(sfxBus, 600, t + 0.06, 0.08, 'square', 0.1); },
    rock: (t) => noise(sfxBus, t, 0.2, 0.25, 150),
    inn: (t) => { [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(sfxBus, f, t + i * 0.18, 0.3, 'triangle', 0.12)); },
    gameover: (t) => { [392, 370, 349, 330].forEach((f, i) => tone(sfxBus, f, t + i * 0.3, 0.35, 'triangle', 0.14)); },
    save: (t) => { [880, 1175].forEach((f, i) => tone(sfxBus, f, t + i * 0.08, 0.12, 'triangle', 0.1)); },
    step: (t) => noise(sfxBus, t, 0.03, 0.05, 3000),
  };

  return {
    SONGS,
    /** ユーザー操作時に呼ぶ（自動再生制限の解除） */
    unlock() {
      if (!(Settings.get('bgm') || Settings.get('sfx'))) return;
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
      if (Settings.get('bgm') && this.want && (!current || current.name !== this.want)) this.bgm(this.want);
    },
    want: null,
    bgm(name) {
      this.want = name;
      if (!Settings.get('bgm')) { stopSong(); return; }
      if (!ensure()) return;
      if (current && current.name === name) return;
      stopSong();
      if (name) startSong(name);
    },
    stopBgm() { this.want = null; stopSong(); },
    sfx(name) {
      if (!Settings.get('sfx') || !SFX[name]) return;
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
      SFX[name](ctx.currentTime + 0.005);
    },
    settingsChanged() {
      if (Settings.get('bgm') || Settings.get('sfx')) ensure();
      applyVolumes();
      if (!Settings.get('bgm')) stopSong();
      else if (this.want && (!current || current.name !== this.want)) { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); stopSong(); startSong(this.want); }
    },
  };
})();
