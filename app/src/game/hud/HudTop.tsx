// Top HUD row: pause, score (+ ghost delta), streak/multiplier badge, run meter.
import { memo } from 'react'
import type { HudState } from '../protocol'
import { keepFocus } from './Controls'

const MULT_STYLE: Record<number, string> = {
  1: 'bg-panel2/90 text-text border-line',
  2: 'bg-info/25 text-info border-info',
  3: 'bg-nitro/25 text-nitro border-nitro',
  5: 'bg-gold/25 text-gold border-gold',
}

function fmtTime(ms: number): string {
  const s = Math.ceil(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Left cluster: pause button and score (with ghost delta). */
export const HudScore = memo(function HudScore({ hud, onPause }: { hud: HudState; onPause: () => void }) {
  return (
    <div className="flex items-start gap-2 shrink-0">
      <button
        type="button"
        aria-label="Pause"
        title="Pause (Esc)"
        onMouseDown={keepFocus}
        onClick={onPause}
        className="pointer-events-auto shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-ink/80 border-2 border-line text-text grid place-items-center active:scale-95"
      >
        <span className="flex gap-1" aria-hidden>
          <span className="block w-1.5 h-4 rounded-sm bg-text" />
          <span className="block w-1.5 h-4 rounded-sm bg-text" />
        </span>
      </button>
      <div className="min-w-0 rounded-2xl bg-ink/70 px-2.5 sm:px-3 py-1.5 border border-line/60">
        <div className="text-xs font-bold uppercase tracking-wider text-dim leading-none">Score</div>
        <div className="text-xl sm:text-3xl font-extrabold tabular-nums leading-tight text-gold glow">{hud.score.toLocaleString()}</div>
        {hud.ghostDelta !== undefined && (
          <div className={`text-xs font-bold tabular-nums whitespace-nowrap ${hud.ghostDelta >= 0 ? 'text-good' : 'text-dim'}`}>
            👻 {hud.ghostDelta >= 0 ? `+${hud.ghostDelta}` : hud.ghostDelta} vs best
          </div>
        )}
      </div>
    </div>
  )
})

/** Right cluster: streak + multiplier badge and the run meter (progress, time or lives). */
export const HudStatus = memo(function HudStatus({ hud, reduced }: { hud: HudState; reduced: boolean }) {
  const multCls = MULT_STYLE[hud.mult] ?? MULT_STYLE[1]
  return (
    <div className="flex items-start gap-2 shrink-0">
      <div
        key={reduced ? 'streak' : `streak-${hud.streak}`}
        className={`rounded-2xl border-2 px-2 sm:px-2.5 py-1 text-center min-w-[3.25rem] sm:min-w-[3.75rem] ${multCls} ${!reduced && hud.streak > 0 ? 'animate-pop' : ''}`}
        aria-label={`Streak ${hud.streak}, multiplier ${hud.mult}`}
      >
        <div className="text-xs font-bold uppercase tracking-wide opacity-80 leading-none">Streak</div>
        <div className="text-lg sm:text-xl font-extrabold tabular-nums leading-tight">
          {hud.streak > 0 ? '🔥' : ''}
          {hud.streak}
          <span className="ml-1 text-xs font-black">×{hud.mult}</span>
        </div>
      </div>
      <RunMeter hud={hud} />
    </div>
  )
})

function RunMeter({ hud }: { hud: HudState }) {
  if (hud.lives) {
    return (
      <div className="rounded-2xl bg-ink/70 border border-line/60 px-2.5 py-1.5 text-center" aria-label={`${hud.lives.left} of ${hud.lives.max} lives left`}>
        <div className="text-xs font-bold uppercase tracking-wide text-dim leading-none">Lives</div>
        <div className="text-lg leading-tight">
          {Array.from({ length: hud.lives.max }, (_, i) => (
            <span key={i} className={i < hud.lives!.left ? '' : 'opacity-25 grayscale'}>
              ❤️
            </span>
          ))}
        </div>
      </div>
    )
  }
  if (hud.timeLeftMs !== undefined) {
    const low = hud.timeLeftMs < 10_000
    const pct = hud.timeTotalMs ? hud.timeLeftMs / hud.timeTotalMs : 0
    return (
      <div className="rounded-2xl bg-ink/70 border border-line/60 px-2 sm:px-2.5 py-1.5 text-center min-w-[3.75rem] sm:min-w-[4.5rem]" aria-label={`${Math.ceil(hud.timeLeftMs / 1000)} seconds left`}>
        <div className="text-xs font-bold uppercase tracking-wide text-dim leading-none">Time</div>
        <div className={`text-xl font-extrabold tabular-nums leading-tight ${low ? 'text-gold' : 'text-text'}`}>⏱ {fmtTime(hud.timeLeftMs)}</div>
        <div className="h-1.5 rounded-full bg-panel2 overflow-hidden mt-0.5">
          <div className={`h-full ${low ? 'bg-gold' : 'bg-info'}`} style={{ width: `${Math.max(0, Math.min(1, pct)) * 100}%` }} />
        </div>
      </div>
    )
  }
  if (hud.progress) {
    const { done, total } = hud.progress
    return (
      <div className="rounded-2xl bg-ink/70 border border-line/60 px-2 sm:px-2.5 py-1.5 text-center min-w-[3.75rem] sm:min-w-[4.5rem]" aria-label={`${done} of ${total} done`}>
        <div className="text-xs font-bold uppercase tracking-wide text-dim leading-none">Road</div>
        <div className="text-xl font-extrabold tabular-nums leading-tight">
          {done}
          <span className="text-dim text-base"> / {total}</span>
        </div>
        <div className="h-1.5 rounded-full bg-panel2 overflow-hidden mt-0.5">
          <div className="h-full bg-good transition-[width] duration-500" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
      </div>
    )
  }
  return null
}
