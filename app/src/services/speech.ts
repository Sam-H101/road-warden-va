// Read-aloud using the browser's speech synthesis. Free, offline on most devices.

let rate = 0.95
let enabled = true

export function configureSpeech(opts: { rate?: number; enabled?: boolean }) {
  if (opts.rate !== undefined) rate = opts.rate
  if (opts.enabled !== undefined) enabled = opts.enabled
}

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find((v) => /en-US/i.test(v.lang) && /natural|neural|online/i.test(v.name)) ??
    voices.find((v) => /en-US/i.test(v.lang)) ??
    voices.find((v) => /^en/i.test(v.lang))
  )
}

/** Speak text now, cancelling anything already being spoken. */
export function speak(text: string, opts: { force?: boolean } = {}) {
  if (!canSpeak() || (!enabled && !opts.force)) return
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(clean)
  u.rate = rate
  u.pitch = 1
  const v = pickVoice()
  if (v) u.voice = v
  window.speechSynthesis.speak(u)
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel()
}
