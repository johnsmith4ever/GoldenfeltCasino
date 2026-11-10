/* Minimal WebAudio synth — chips, cards, wins. No assets needed. */

let ctx: AudioContext | null = null
let muted = false

export function setMuted(m: boolean) { muted = m }
export function isMuted() { return muted }

function ac(): AudioContext | null {
  if (muted) return null
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.08, when = 0, slide = 0) {
  const c = ac()
  if (!c) return
  const t = c.currentTime + when
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g).connect(c.destination)
  osc.start(t)
  osc.stop(t + dur + 0.05)
}

function noise(dur: number, gain = 0.05, when = 0, freq = 2000) {
  const c = ac()
  if (!c) return
  const t = c.currentTime + when
  const len = Math.floor(c.sampleRate * dur)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = c.createBufferSource()
  src.buffer = buf
  const f = c.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = freq
  const g = c.createGain()
  g.gain.value = gain
  src.connect(f).connect(g).connect(c.destination)
  src.start(t)
}

export const sfx = {
  click: () => tone(880, 0.06, 'square', 0.03),
  chip: () => { noise(0.05, 0.1, 0, 3200); tone(1400, 0.05, 'square', 0.03) },
  deal: () => noise(0.09, 0.07, 0, 1200),
  flip: () => noise(0.07, 0.06, 0, 2400),
  dice: () => { noise(0.06, 0.09, 0, 1800); noise(0.05, 0.07, 0.08, 1500); noise(0.06, 0.08, 0.16, 2000) },
  reelStop: () => { tone(220, 0.07, 'square', 0.05); noise(0.04, 0.06, 0, 2600) },
  spin: () => tone(160, 0.5, 'sawtooth', 0.02, 0, 120),
  tick: () => tone(520 + Math.random() * 60, 0.025, 'square', 0.018),
  riser: () => tone(180, 1.4, 'sawtooth', 0.018, 0, 700),
  lever: () => { noise(0.18, 0.06, 0, 500); tone(110, 0.2, 'square', 0.04, 0.08, -40) },
  coin: () => { tone(1567, 0.1, 'sine', 0.06); tone(2093, 0.14, 'sine', 0.06, 0.08) },
  win: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.07, i * 0.09)) },
  bigWin: () => {
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.3, 'triangle', 0.07, i * 0.1))
    noise(0.5, 0.03, 0.3, 5000)
  },
  lose: () => { tone(330, 0.2, 'sawtooth', 0.04); tone(233, 0.35, 'sawtooth', 0.04, 0.14) },
  push: () => tone(440, 0.15, 'sine', 0.05),
}
