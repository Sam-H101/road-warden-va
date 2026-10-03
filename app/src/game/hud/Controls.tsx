// Bottom HUD: speedometer, HORN, perk buttons, the green GO button and the big hold-to-BRAKE button.
import { memo, useRef, type PointerEvent as RPointerEvent } from 'react'
import type { Command, HudState } from '../protocol'

const MAX_MPH = 60

function Speedometer({ mph, braking, nitro }: { mph: number; braking: boolean; nitro: boolean }) {
  const r = 30
  const c = 2 * Math.PI * r
  const arc = 0.75 // three-quarter dial
  const frac = Math.max(0, Math.min(1, mph / MAX_MPH))
  const color = braking ? '#f43f5e' : nitro ? '#a78bfa' : '#38bdf8'
  return (
    <div className="relative w-[min(4.5rem,19vw,19dvh)] h-[min(4.5rem,19vw,19dvh)] sm:w-[min(5rem,19dvh)] sm:h-[min(5rem,19dvh)] rounded-full bg-ink/80 border-2 border-line" aria-label={`Speed ${mph} miles per hour`} role="img">
      <svg viewBox="0 0 80 80" className="absolute inset-0 w-full h-full -rotate-[225deg]">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#2a3558" strokeWidth="7" strokeDasharray={`${c * arc} ${c}`} strokeLinecap="round" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeDasharray={`${c * arc * frac} ${c}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 120ms linear, stroke 200ms' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center leading-none">
          <div className="text-lg sm:text-2xl font-extrabold tabular-nums">{mph}</div>
          <div className="text-xs font-black tracking-wide text-dim">MPH</div>
        </div>
      </div>
    </div>
  )
}

function PerkButton({
  icon,
  label,
  hint,
  charges,
  usable,
  active,
  onPress,
}: {
  icon: string
  label: string
  hint: string
  charges: number
  usable: boolean
  active?: boolean
  onPress: () => void
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={!usable}
      aria-label={`${label}, ${charges} left (${hint})`}
      title={`${label} (${hint})`}
      onMouseDown={keepFocus}
      className={`pointer-events-auto relative w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 text-2xl grid place-items-center transition active:scale-95 disabled:opacity-40 ${
        active ? 'bg-info/40 border-info pulse-ring' : usable ? 'bg-panel2/95 border-gold' : 'bg-panel2/80 border-line'
      }`}
    >
      <span aria-hidden>{icon}</span>
      <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-gold text-ink text-xs font-black grid place-items-center tabular-nums">{charges}</span>
      <span className="absolute -left-5 text-xs font-bold text-dim hidden [@media(pointer:fine)]:block">{hint}</span>
    </button>
  )
}

/**
 * Mouse clicks on HUD buttons must not leave focus behind: Enter is the GO key,
 * and a focused button would also get "clicked" again by it.
 */
export function keepFocus(e: { preventDefault: () => void }) {
  e.preventDefault()
}

/** A simple horn icon (emoji horns render inconsistently across systems). */
function HornIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5v3h2.5L15 18.5v-13L5.5 10.5H3z" fill="currentColor" fillOpacity="0.3" />
      <path d="M6.5 13.5l1.2 5h2.4l-1-4.2" />
      <path d="M18 9.2l2.5-1.4M18.6 12h2.9M18 14.8l2.5 1.4" />
    </svg>
  )
}

export const Controls = memo(function Controls({ hud, send, reduced = false }: { hud: HudState; send: (c: Command) => void; reduced?: boolean }) {
  const brakeId = useRef<number | null>(null)
  const live = hud.phase === 'drive' || hud.phase === 'ending'

  const brakeDown = (e: RPointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    brakeId.current = e.pointerId
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    send({ type: 'brake', down: true })
  }
  const brakeUp = (e: RPointerEvent<HTMLButtonElement>) => {
    if (brakeId.current !== null && e.pointerId !== brakeId.current) return
    brakeId.current = null
    send({ type: 'brake', down: false })
  }

  const p = hud.perks
  return (
    <div className="relative flex items-end gap-2 sm:gap-3">
      {/* Perks sit in their own small column above the speedometer, never in the GO/BRAKE row. */}
      {(p.flare || p.slowMo || p.secondChance || p.radar) && (
        <div className="absolute left-0 bottom-full mb-3 flex flex-col items-start gap-2 [@media(max-height:700px)]:flex-row [@media(max-height:700px)]:items-end">
          {(p.secondChance || p.radar) && (
            <div className="flex flex-col gap-1">
              {p.secondChance && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold border ${p.secondChance === 'ready' ? 'bg-good/20 text-good border-good' : 'bg-panel2 text-dim border-line'}`}>
                  🛡️ {p.secondChance === 'ready' ? 'Ready' : 'Used'}
                </span>
              )}
              {p.radar && <span className="rounded-full px-2 py-0.5 text-xs font-bold border bg-info/20 text-info border-info">📡 Radar</span>}
            </div>
          )}
          {p.flare && (
            <PerkButton
              icon="🔦"
              label="Hint flare"
              hint="H"
              charges={p.flare.charges}
              usable={p.flare.usable}
              onPress={() => send({ type: 'perk', id: 'hint-flare' })}
            />
          )}
          {p.slowMo && (
            <PerkButton
              icon="🐢"
              label="Slow-mo"
              hint="F"
              charges={p.slowMo.charges}
              usable={p.slowMo.usable}
              active={p.slowMo.active}
              onPress={() => send({ type: 'perk', id: 'slow-mo' })}
            />
          )}
        </div>
      )}
      <div className="relative">
        <Speedometer mph={hud.mph} braking={hud.braking} nitro={hud.nitro} />
        <button
          type="button"
          onMouseDown={keepFocus}
          onClick={() => send({ type: 'horn' })}
          disabled={!live}
          aria-label="Horn"
          title="Horn (K)"
          className="pointer-events-auto absolute -top-4 -right-6 w-11 h-11 rounded-full bg-panel2/95 border-2 border-line text-gold grid place-items-center active:scale-95 disabled:opacity-40"
        >
          <HornIcon />
        </button>
      </div>

      <div className="flex-1" />

      <div className="flex flex-col items-center">
        <style>{`@keyframes rw-go-pulse { 0% { box-shadow: 0 6px 0 #15803d, 0 0 0 0 rgba(74,222,128,0.55); } 70%,100% { box-shadow: 0 6px 0 #15803d, 0 0 0 16px rgba(74,222,128,0); } }`}</style>
        <button
          type="button"
          onMouseDown={keepFocus}
          onClick={() => send({ type: 'go' })}
          disabled={!hud.goAvailable}
          aria-label={hud.going ? 'Going fast' : 'Go: speed up to the next gate'}
          title="GO: speed up (↑, W or Enter)"
          className={`pointer-events-auto select-none touch-none w-[min(5rem,21vw,21dvh)] h-[min(5rem,21vw,21dvh)] sm:w-[min(6rem,21dvh)] sm:h-[min(6rem,21dvh)] rounded-full border-4 font-black text-2xl tracking-wider grid place-items-center transition-transform active:scale-95 ${
            hud.going
              ? 'bg-good border-white text-ink scale-95 shadow-[0_0_30px_rgba(34,197,94,0.8)]'
              : hud.goAvailable
                ? 'bg-good border-[#15803d] text-ink shadow-[0_6px_0_#15803d]'
                : 'bg-[#1d4d33] border-[#15803d] text-white/45'
          }`}
          style={
            // A slow, soft invitation to press GO while something is on its way.
            hud.goAvailable && !hud.going && hud.slowRoll && hud.etaSec !== undefined && !reduced ? { animation: 'rw-go-pulse 2.4s ease-out infinite' } : undefined
          }
        >
          {hud.going ? 'GO!' : 'GO'}
        </button>
        <span className="mt-2 rounded-full bg-ink/75 px-2 py-0.5 text-[0.7rem] font-bold text-text/85 hidden [@media(pointer:fine)]:block">↑ / Enter</span>
      </div>

      <div className="flex flex-col items-center">
        <button
          type="button"
          tabIndex={-1}
          aria-label="Brake (hold)"
          title="Brake: hold ↓, S or Space"
          onPointerDown={brakeDown}
          onPointerUp={brakeUp}
          onPointerCancel={brakeUp}
          onLostPointerCapture={brakeUp}
          onContextMenu={(e) => e.preventDefault()}
          className={`pointer-events-auto select-none touch-none w-[min(6rem,25vw,25dvh)] h-[min(6rem,25vw,25dvh)] sm:w-[min(7rem,25dvh)] sm:h-[min(7rem,25dvh)] rounded-full border-4 font-black text-lg sm:text-xl tracking-wider text-white grid place-items-center transition-transform ${
            hud.braking ? 'bg-bad border-white scale-95 shadow-[0_0_30px_rgba(244,63,94,0.8)]' : 'bg-bad/90 border-[#9f1239] shadow-[0_6px_0_#9f1239]'
          }`}
        >
          BRAKE
        </button>
        <span className="mt-2 rounded-full bg-ink/75 px-2 py-0.5 text-[0.7rem] font-bold text-text/85 hidden [@media(pointer:fine)]:block">hold ↓ / Space</span>
      </div>
    </div>
  )
})
