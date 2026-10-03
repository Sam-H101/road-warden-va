// The big question / situation card at the top of the drive, plus the three
// lane-aligned answer chips for gate events (the readable copy of the gate labels).
import { memo, useEffect, useState } from 'react'
import { imageUrl } from '../../engine/content'
import { ReadAloudButton, SignImage, useAutoRead } from '../../ui/kit'
import { LANE_CSS, LANE_NAMES, type Lane, type PromptInfo } from '../protocol'
import { keepFocus } from './Controls'
import { PROP_EMOJI, WEATHER_LABEL } from '../words'

const ARROWS = ['◀', '▲', '▶'] as const
const SHORT = '(max-height: 520px)'
/** Hazards you slow or stop for: GO only brings them closer, it is not the answer. */
const BRAKE_ACTIONS = new Set(['stop', 'slow', 'brake-straight'])

/** True on short screens (phone landscape) where the card must stay compact. */
function useShortScreen(): boolean {
  const [short, setShort] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(SHORT).matches)
  useEffect(() => {
    const mq = window.matchMedia?.(SHORT)
    if (!mq) return
    const on = () => setShort(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return !!short
}

function speechFor(p: PromptInfo): string {
  if (!p.lanes) return p.text
  const names = ['Left', 'Middle', 'Right']
  const opts = p.lanes
    .map((l, i) => (l.removed ? '' : `${names[i]}: ${l.label}.`))
    .filter(Boolean)
    .join(' ')
  return `${p.text} ${opts}`
}

export const PromptCard = memo(function PromptCard({
  prompt,
  lane,
  reduced,
  onPickLane,
  etaSec,
  going,
  goAvailable,
  slowRoll,
}: {
  prompt: PromptInfo
  lane: Lane
  reduced: boolean
  onPickLane: (lane: Lane) => void
  /** Seconds until the gate reaches the car. */
  etaSec?: number
  going?: boolean
  /** GO can be pressed now (not during a pull-over or a forced stop). */
  goAvailable?: boolean
  slowRoll?: boolean
}) {
  // Auto-read once per spawn: the question AND the three answers (there is time for it in slow roll).
  useAutoRead(prompt.status === 'live' ? speechFor(prompt) : undefined, [prompt.key])
  const short = useShortScreen()

  const hasImg = !!imageUrl(prompt.image)
  const emoji = hasImg ? undefined : (prompt.emoji ?? (prompt.prop ? PROP_EMOJI[prompt.prop] : undefined))
  const ring =
    // Opaque, dark backgrounds keep the text readable over a bright sky.
    prompt.status === 'correct'
      ? 'border-good bg-[#0d2a1e]/95'
      : prompt.status === 'miss'
        ? 'border-bad bg-[#2a0d16]/95'
        : 'border-line bg-ink/85'
  const weather = prompt.weather && prompt.weather !== 'clear' ? WEATHER_LABEL[prompt.weather] : ''

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        key={reduced ? 'prompt' : prompt.key}
        className={`pointer-events-auto rounded-2xl border-2 backdrop-blur-sm shadow-[0_8px_24px_rgba(0,0,0,0.45)] ${short ? 'p-2' : 'p-2.5 sm:p-3'} flex items-center gap-3 transition-colors ${ring} ${reduced ? '' : 'animate-rise'}`}
        role="status"
        aria-live="polite"
      >
        {hasImg ? (
          <div className="shrink-0 rounded-xl bg-white/10 p-1">
            <SignImage id={prompt.image} size={short ? 48 : 76} />
          </div>
        ) : emoji ? (
          <div
            className={`shrink-0 rounded-xl bg-white/10 grid place-items-center ${short ? 'w-12 h-12 text-3xl' : 'w-16 h-16 sm:w-20 sm:h-20 text-4xl sm:text-5xl'}`}
            aria-hidden
          >
            {emoji}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          {(prompt.isRequeue || weather) && (
            <div className="flex flex-wrap gap-1.5 mb-1">
              {prompt.isRequeue && <span className="rounded-full bg-info/20 text-info text-xs font-bold px-2 py-0.5">🔁 One more try</span>}
              {weather && <span className="rounded-full bg-panel2 text-dim text-xs font-bold px-2 py-0.5">{weather}</span>}
            </div>
          )}
          <p className={`font-extrabold leading-snug text-text ${short ? 'text-lg' : 'text-[clamp(1.05rem,3dvh,1.5rem)]'}`}>{prompt.text}</p>
          {prompt.status === 'correct' && <p className="text-good font-bold text-base mt-0.5">✓ {prompt.note ?? 'Nice!'}</p>}
          {prompt.status === 'miss' && <p className="text-bad font-bold text-base mt-0.5">Almost! Replay next.</p>}
          {prompt.status === 'live' && prompt.note && <p className="text-gold font-bold text-base mt-0.5">{prompt.note}</p>}
          {prompt.status === 'live' && !prompt.note && slowRoll && etaSec !== undefined && (
            <p className="text-text/90 font-bold text-base mt-1 tabular-nums" aria-live="off">
              {going ? (
                <span className="text-good">GO! Here in {etaSec}s</span>
              ) : goAvailable ? (
                <>
                  Take your time: <span className="text-gold">{etaSec}s</span> · {prompt.action && BRAKE_ACTIONS.has(prompt.action) ? 'GO brings it closer' : 'Ready? Press'}{' '}
                  {!(prompt.action && BRAKE_ACTIONS.has(prompt.action)) && <span className="text-good">GO</span>}
                </>
              ) : (
                <>
                  {prompt.action === 'pull-over' ? 'Time left' : 'Take your time'}: <span className="text-gold">{etaSec}s</span>
                </>
              )}
            </p>
          )}
        </div>
        <span className="contents" onMouseDown={keepFocus}>
          <ReadAloudButton text={speechFor(prompt)} />
        </span>
      </div>

      {prompt.lanes && (
        <div className={`grid grid-cols-3 gap-1.5 sm:gap-3 px-0.5 ${short ? 'mt-2.5' : 'mt-3'}`}>
          {prompt.lanes.map((choice, i) => {
            const active = lane === i
            const color = LANE_CSS[i]
            const shown = prompt.status !== 'live' && choice.correct
            // Long words get a smaller size so they wrap between words, never mid-word.
            const long = /\S{7,}/.test(choice.label)
            const size = short ? (long ? 'text-sm' : 'text-base') : long ? 'text-[0.85rem] sm:text-base' : 'text-[0.95rem] sm:text-lg'
            return (
              <button
                type="button"
                key={i}
                onMouseDown={keepFocus}
                onClick={() => onPickLane(i as Lane)}
                disabled={choice.removed || prompt.status !== 'live'}
                aria-label={`${LANE_NAMES[i]} lane: ${choice.label}${active ? ' (your lane)' : ''}`}
                className={`pointer-events-auto relative rounded-xl border-[3px] px-1.5 ${short ? 'pt-2.5 pb-1.5 min-h-[2.9rem]' : 'pt-3 pb-2 min-h-[3.75rem] sm:min-h-[4.25rem]'} flex items-center justify-center text-center font-extrabold leading-tight ${size} [overflow-wrap:break-word] hyphens-none transition-transform ${
                  shown ? 'bg-[#14532d] text-white' : 'bg-ink/85 text-text'
                } ${active && prompt.status === 'live' ? 'ring-4 ring-gold scale-[1.04]' : ''} ${choice.removed ? 'opacity-35 line-through' : ''}`}
                style={{ borderColor: shown ? '#22c55e' : color }}
              >
                <span
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 text-xs font-black tracking-wide text-ink"
                  style={{ background: shown ? '#22c55e' : color }}
                  aria-hidden
                >
                  {ARROWS[i]} {LANE_NAMES[i]}
                </span>
                <span className="block w-full">{choice.label}</span>
                {active && prompt.status === 'live' && (
                  <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 rounded-full bg-gold px-1.5 text-xs font-black text-ink" aria-hidden>
                    YOU
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
})

/** Shown after the last gate while the finish line rolls in (slow roll lets the learner GO to it). */
export const FinishCard = memo(function FinishCard({
  etaSec,
  going,
  slowRoll,
  reduced,
}: {
  etaSec?: number
  going?: boolean
  slowRoll?: boolean
  reduced: boolean
}) {
  const text = 'Finish line ahead!'
  useAutoRead(text, ['finish'])
  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        className={`pointer-events-auto rounded-2xl border-2 border-gold/80 bg-ink/85 backdrop-blur-sm shadow-[0_8px_24px_rgba(0,0,0,0.45)] p-2.5 sm:p-3 flex items-center gap-3 ${reduced ? '' : 'animate-rise'}`}
        role="status"
        aria-live="polite"
      >
        <div className="shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-white/10 grid place-items-center text-4xl" aria-hidden>
          🏁
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold leading-snug text-text text-xl sm:text-2xl">{text}</p>
          {slowRoll && etaSec !== undefined && (
            <p className="text-text/90 font-bold text-base mt-1 tabular-nums" aria-live="off">
              {going ? (
                <span className="text-good">GO! Here in {etaSec}s</span>
              ) : (
                <>
                  Here in <span className="text-gold">{etaSec}s</span> · Ready? Press <span className="text-good">GO</span>
                </>
              )}
            </p>
          )}
        </div>
        <span className="contents" onMouseDown={keepFocus}>
          <ReadAloudButton text={text} />
        </span>
      </div>
    </div>
  )
})
