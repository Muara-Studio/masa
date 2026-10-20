// All sound is synthesised with WebAudio: UI ticks, a transition whoosh, and a SOUND-toggled ambient bed
// (a slow slendro bell pattern over a soft drone). Off by default; the AudioContext is made on the first toggle.
const BASE = 293.66; // degree 0, near D4
const CENTS = [0, 231, 474, 717, 955]; // one slendro tuning: five near-equal steps per octave, no semitones
const hz = (d) => BASE * 2 ** (Math.floor(d / 5) + CENTS[((d % 5) + 5) % 5] / 1200);
const PATTERN = [2, 1, 2, 3, -1, 4, 3, 2, -1, 1, 0, 1, 4, 3, 1, 0]; // scale degrees, -1 rests; the gong lands on the last beat
const BEAT = 0.75; // seconds

let ac, out, wet, noise, bed, voices = [], timer, beat = 0, on = false, lastHover = 0;

function ensure() {
  if (ac) return;
  ac = new AudioContext();
  out = ac.createGain();
  out.gain.value = 0.9;
  out.connect(ac.destination);
  wet = ac.createConvolver();
  wet.buffer = tail(2.8);
  wet.connect(out);
  noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

// decaying stereo noise is a cheap, soft room impulse
function tail(sec) {
  const n = (ac.sampleRate * sec) | 0, b = ac.createBuffer(2, n, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3;
  }
  return b;
}

function tone(f, t, { type = 'sine', gain = 0.1, decay = 1, attack = 0.004, cents = 0, dest = out } = {}) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.value = f;
  o.detune.value = cents;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + attack + decay + 0.05);
}

// a pair of players tuned a little apart beat against each other (ombak); 2.76x is a metal bar's first overtone
function bell(f, t, gain, decay = 2.4) {
  tone(f, t, { gain, decay, dest: bed });
  tone(f, t, { gain: gain * 0.7, decay: decay * 0.9, cents: 18, dest: bed });
  tone(f, t, { gain: gain * 0.16, decay: 0.45, cents: 1758, dest: bed });
}

function tick() {
  if (!bed || ac.state !== 'running') return; // a suspended clock would bunch notes up
  const t = ac.currentTime + 0.05, n = PATTERN.length, d = PATTERN[beat % n];
  if (d >= 0) bell(hz(d), t, 0.05);
  if (d >= 0 && beat % 2 && Math.random() < 0.35) bell(hz(d + 5), t + BEAT / 2, 0.016, 1.2); // sparse ornament an octave up
  if (beat % n === n - 1) bell(hz(-5), t, 0.09, 5); // gong
  beat++;
}

function startBed() {
  const t = ac.currentTime;
  bed = ac.createGain();
  bed.gain.setValueAtTime(0, t);
  bed.gain.linearRampToValueAtTime(1, t + 2.5);
  bed.connect(out);
  bed.connect(wet);
  const lp = ac.createBiquadFilter(), dg = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  dg.gain.value = 0.05;
  lp.connect(dg).connect(bed);
  voices = [hz(-10), hz(-7)].map((f, k) => {
    const o = ac.createOscillator();
    o.type = k ? 'triangle' : 'sine';
    o.frequency.value = f;
    o.detune.value = k ? 5 : -5;
    o.connect(lp);
    o.start(t);
    return o;
  });
  lfo.frequency.value = 0.07; // the drone breathes
  lg.gain.value = 0.025;
  lfo.connect(lg).connect(dg.gain);
  lfo.start(t);
  voices.push(lfo);
  beat = 0;
  tick();
  timer = setInterval(tick, BEAT * 1000); // shortcut: timer-driven, so background tabs slow the pattern; use an AudioWorklet clock if it matters
}

function stopBed() {
  clearInterval(timer);
  if (!bed) return;
  const t = ac.currentTime, b = bed;
  b.gain.cancelScheduledValues(t);
  b.gain.setValueAtTime(b.gain.value, t);
  b.gain.setTargetAtTime(0, t, 0.25);
  voices.forEach((o) => o.stop(t + 1.5));
  bed = null;
  setTimeout(() => { b.disconnect(); if (!on) ac.suspend(); }, 1600);
}

globalThis.document?.addEventListener('visibilitychange', () => {
  if (ac && on) document.hidden ? ac.suspend() : ac.resume();
});

export const sfx = {
  hover() {
    if (!on) return;
    const now = performance.now();
    if (now - lastHover < 60) return;
    lastHover = now;
    tone(hz(12), ac.currentTime, { type: 'triangle', gain: 0.025, decay: 0.06, attack: 0.002 });
  },
  click() {
    if (!on) return;
    const t = ac.currentTime;
    tone(hz(7), t, { type: 'triangle', gain: 0.06, decay: 0.22 });
    tone(hz(9), t + 0.07, { type: 'triangle', gain: 0.05, decay: 0.32 });
  },
  whoosh() {
    if (!on) return;
    const t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise;
    s.loop = true;
    f.type = 'bandpass';
    f.Q.value = 0.9;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(2800, t + 0.45);
    f.frequency.exponentialRampToValueAtTime(500, t + 1.1);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.14, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    s.connect(f).connect(g).connect(out);
    g.connect(wet);
    s.start(t);
    s.stop(t + 1.25);
  },
  get on() { return on; },
  toggle() {
    on = !on;
    if (on) { ensure(); ac.resume(); startBed(); } else stopBed();
    return on;
  },
};
