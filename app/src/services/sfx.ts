// Synthesized sound effects (WebAudio). No audio files to license or load.
// Every sound respects the mute flag and volume from settings.

type SfxName =
  | 'correct'
  | 'miss'
  | 'tick'
  | 'streak'
  | 'nitro'
  | 'rankup'
  | 'medal'
  | 'unlock'
  | 'click'
  | 'countdown'
  | 'go'
  | 'brake'
  | 'whoosh'
  | 'horn-classic'
  | 'horn-truck'
  | 'horn-tune'
  | 'horn-beep'
  | 'siren'
  | 'fail'
  | 'win'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let volume = 0.7
let muted = false

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : volume
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function setSfxVolume(v: number, isMuted: boolean) {
  volume = Math.max(0, Math.min(1, v))
  muted = isMuted
  if (master) master.gain.value = muted ? 0 : volume
}

/** Call from a user gesture (first click) so browsers allow audio. */
export function unlockAudio() {
  audio()
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.3, slideTo?: number) {
  const a = audio()
  if (!a || !master) return
  const t0 = a.currentTime + start
  const osc = a.createOscillator()
  const g = a.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g)
  g.connect(master)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

function noise(start: number, dur: number, gain = 0.2, filterFreq = 1200) {
  const a = audio()
  if (!a || !master) return
  const t0 = a.currentTime + start
  const len = Math.floor(a.sampleRate * dur)
  const buf = a.createBuffer(1, len, a.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = a.createBufferSource()
  src.buffer = buf
  const f = a.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = filterFreq
  const g = a.createGain()
  g.gain.value = gain
  src.connect(f)
  f.connect(g)
  g.connect(master)
  src.start(t0)
}

export function playSfx(name: SfxName) {
  if (muted) return
  switch (name) {
    case 'correct':
      tone(660, 0, 0.12, 'triangle', 0.25)
      tone(990, 0.08, 0.18, 'triangle', 0.25)
      break
    case 'miss':
      tone(220, 0, 0.25, 'sawtooth', 0.15, 140)
      break
    case 'tick':
      tone(1200, 0, 0.04, 'square', 0.06)
      break
    case 'streak':
      tone(523, 0, 0.1, 'square', 0.12)
      tone(659, 0.08, 0.1, 'square', 0.12)
      tone(784, 0.16, 0.18, 'square', 0.14)
      break
    case 'nitro':
      noise(0, 0.6, 0.25, 600)
      tone(200, 0, 0.6, 'sawtooth', 0.1, 900)
      break
    case 'rankup':
      ;[523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.1, 0.25, 'triangle', 0.22))
      break
    case 'medal':
      tone(880, 0, 0.15, 'sine', 0.25)
      tone(1318, 0.12, 0.3, 'sine', 0.22)
      break
    case 'unlock':
      tone(392, 0, 0.12, 'triangle', 0.2)
      tone(587, 0.1, 0.12, 'triangle', 0.2)
      tone(784, 0.2, 0.3, 'triangle', 0.22)
      break
    case 'click':
      tone(800, 0, 0.03, 'square', 0.05)
      break
    case 'countdown':
      tone(440, 0, 0.15, 'square', 0.12)
      break
    case 'go':
      tone(880, 0, 0.3, 'square', 0.15)
      break
    case 'brake':
      noise(0, 0.25, 0.08, 3000)
      break
    case 'whoosh':
      noise(0, 0.3, 0.12, 900)
      break
    case 'horn-classic':
      tone(330, 0, 0.35, 'sawtooth', 0.12)
      tone(415, 0, 0.35, 'sawtooth', 0.1)
      break
    case 'horn-truck':
      tone(150, 0, 0.6, 'sawtooth', 0.16)
      tone(190, 0, 0.6, 'sawtooth', 0.12)
      break
    case 'horn-tune':
      ;[392, 392, 392, 523, 659].forEach((f, i) => tone(f, i * 0.12, 0.1, 'square', 0.1))
      break
    case 'horn-beep':
      tone(600, 0, 0.1, 'square', 0.12)
      tone(600, 0.15, 0.1, 'square', 0.12)
      break
    case 'siren':
      for (let i = 0; i < 4; i++) tone(700, i * 0.4, 0.2, 'sine', 0.08, 1000)
      break
    case 'fail':
      tone(392, 0, 0.2, 'triangle', 0.18)
      tone(330, 0.18, 0.2, 'triangle', 0.18)
      tone(262, 0.36, 0.35, 'triangle', 0.18)
      break
    case 'win':
      ;[523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.2, 'triangle', 0.2))
      break
  }
}

export function playHorn(value: string) {
  const map: Record<string, SfxName> = { classic: 'horn-classic', truck: 'horn-truck', tune: 'horn-tune', beep: 'horn-beep' }
  playSfx(map[value] ?? 'horn-classic')
}

export function vibrate(pattern: number | number[], enabled: boolean) {
  if (!enabled) return
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* not supported */
  }
}

export type { SfxName }
