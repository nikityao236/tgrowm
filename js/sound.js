// Звук TGM без файлов: всё синтезируется на лету (звон монет, рост дерева, ворчание гнома, шум леса).
let ctx = null;
let master = null;
let ambient = null;
let mode = 'fx'; // off | fx | all

function ensure() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
  } catch { ctx = null; }
  return ctx;
}
function env(g, t0, a, d, peak) {
  g.gain.cancelScheduledValues(t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}
function tone(freq, t0, { type = 'sine', a = 0.005, d = 0.4, peak = 0.2, to = null } = {}) {
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + a + d);
  env(g, t0, a, d, peak);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + a + d + 0.05);
}
function noise(t0, { d = 0.2, peak = 0.15, f = 1200, q = 1, type = 'bandpass', sweepTo = null } = {}) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * d));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource(); s.buffer = buf;
  const flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.setValueAtTime(f, t0); flt.Q.value = q;
  if (sweepTo) flt.frequency.exponentialRampToValueAtTime(sweepTo, t0 + d);
  const g = ctx.createGain(); env(g, t0, 0.01, d, peak);
  s.connect(flt); flt.connect(g); g.connect(master);
  s.start(t0);
}

const SFX = {
  tap(t) { noise(t, { d: 0.05, peak: 0.07, f: 900, q: 2 }); tone(220, t, { type: 'triangle', d: 0.06, peak: 0.05 }); },
  coin(t) { tone(1318.5, t, { d: 0.5, peak: 0.13 }); tone(1760, t + 0.07, { d: 0.7, peak: 0.11 }); },
  coins(t) { [0, 0.07, 0.14, 0.22, 0.3].forEach((o, i) => tone(1100 + i * 170, t + o, { d: 0.45, peak: 0.09 })); },
  whoosh(t) { noise(t, { d: 0.8, peak: 0.16, f: 300, q: 0.8, sweepTo: 2600 }); },
  grow(t) { [392, 494, 587, 784].forEach((f, i) => tone(f, t + i * 0.09, { type: 'triangle', d: 0.7, peak: 0.12 })); noise(t + 0.2, { d: 0.9, peak: 0.04, f: 5000, q: 3, type: 'highpass' }); },
  levelup(t) { [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => { tone(f, t + i * 0.11, { type: 'triangle', d: 0.9, peak: 0.13 }); tone(f * 2, t + i * 0.11, { d: 0.7, peak: 0.045 }); }); },
  grumble(t) { tone(98, t, { type: 'sawtooth', d: 0.5, peak: 0.1, to: 70 }); tone(104, t + 0.04, { type: 'sawtooth', d: 0.5, peak: 0.07, to: 74 }); noise(t, { d: 0.4, peak: 0.04, f: 220, q: 1, type: 'lowpass' }); },
  comfort(t) { [261.6, 329.6, 392].forEach((f) => tone(f, t, { a: 0.08, d: 1.2, peak: 0.08 })); },
  pop(t) { tone(520, t, { d: 0.12, peak: 0.11, to: 900 }); },
  error(t) { tone(180, t, { type: 'square', d: 0.12, peak: 0.05 }); },
};

function startAmbient() {
  if (!ensure() || ambient) return;
  const t = ctx.currentTime;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07, t + 3); g.connect(master);
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate); const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.04 * w) / 1.04; data[i] = last * 6; }
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 0.4;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
  const lg = ctx.createGain(); lg.gain.value = 240;
  lfo.connect(lg); lg.connect(lp.frequency);
  src.connect(lp); lp.connect(g);
  src.start(t); lfo.start(t);
  // далёкие сверчки
  const timer = setInterval(() => {
    if (!ctx || ctx.state !== 'running') return;
    const n = ctx.currentTime;
    const base = 4300 + Math.random() * 500;
    for (let k = 0; k < 3; k++) tone(base, n + k * 0.09, { a: 0.01, d: 0.05, peak: 0.01 });
  }, 3800);
  ambient = { g, src, lfo, timer };
}
function stopAmbient() {
  if (!ambient) return;
  const a = ambient; ambient = null;
  clearInterval(a.timer);
  try { a.g.gain.cancelScheduledValues(ctx.currentTime); a.g.gain.setValueAtTime(a.g.gain.value, ctx.currentTime); a.g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6); } catch { /* ignore */ }
  setTimeout(() => { try { a.src.stop(); a.lfo.stop(); } catch { /* ignore */ } }, 700);
}

export const snd = {
  setMode(m) {
    mode = ['off', 'fx', 'all'].includes(m) ? m : 'fx';
    if (mode === 'all') { if (ctx && ctx.state === 'running') startAmbient(); } else stopAmbient();
  },
  // Браузеры включают звук только после нажатия: вызываем при первом касании
  unlock() {
    if (mode === 'off' || !ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (mode === 'all') startAmbient();
  },
  play(name) {
    if (mode === 'off' || !ensure() || !SFX[name]) return;
    if (ctx.state === 'suspended') ctx.resume();
    try { SFX[name](ctx.currentTime + 0.01); } catch { /* звук не критичен */ }
  },
};

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else if (mode !== 'off') ctx.resume();
  });
}
