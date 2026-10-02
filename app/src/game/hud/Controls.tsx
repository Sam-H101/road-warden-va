// Bottom HUD: speedometer, HORN, perk buttons, the green GO button and the big hold-to-BRAKE button.
import { memo, useRef, type PointerEvent as RPointerEvent } from 'react'
import type { Command, HudState } from '../protocol'

const MAX_MPH = 50

function Speedometer({ mph, braking, nitro }: { mph: number; braking: boolean; nitro: boolean }) {
  const r = 30
  const c = 2 * Math.PI * r
  const arc = 0.75 // three-quarter dial
  const frac = Math.max(0, Math.min(1, mph / MAX_MPH))
  const color = braking ? '#f43f5e' : nitro ? '#a78bfa' : '#38bdf8'
  return (
    <div className="relative w-[4.5rem] h-[4.5rem] sm:w-20 sm:h-20 rounded-full bg-ink/80 border-2 border-line" aria-label={`Speed ${mph} miles per hour`} role="img">
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
          <div className="text-xl sm:text-2xl font-extrabold tabular-nums">{mph}</div>
          <div className="text-[0.55rem] font-black tracking-widest text-dim">MPH</div>
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
      className={`pointer-events-auto relative w-14 h-14 rounded-full border-2 text-2xl grid place-items-center transition active:scale-95 disabled:opacity-40 ${
        active ? 'bg-info/40 border-info pulse-ring' : usable ? 'bg-panel2/95 border-gold' : 'bg-panel2/80 border-line'
      }`}
    >
      <span aria-hidden>{icon}</span>
      <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-gold text-ink text-xs font-black grid place-items-center tabular-nums">{charges}</span>
      <span className="absolute -bottom-4 text-[0.6rem] font-bold text-dim hidden [@media(pointer:fine)]:block">{hint}</span>
    </button>
  )
}

export const Controls = memo(function Controls({ hud, send }: { hud: HudState; send: (c: Command) => void }) {
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
    <div className="flex items-end gap-2 sm:gap-3">
      <div className="relative">
        <Speedometer mph={hud.mph} braking={hud.braking} nitro={hud.nitro} />
        <button
          type="button"
          onClick={() => send({ type: 'horn' })}
          disabled={!live}
          aria-label="Horn"
          title="Horn (K)"
          className="pointer-events-auto absolute -top-4 -right-6 w-11 h-11 rounded-full bg-panel2/95 border-2 border-line text-lg grid place-items-center active:scale-95 disabled:opacity-40"
        >
          📯
        </button>
      </div>

      <div className="flex-1" />

      <div className="flex flex-wrap-reverse items-end justify-end gap-2 pb-1">
        {(p.secondChance || p.radar) && (
          <div className="flex flex-col gap-1 self-center">
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

      <div className="flex flex-col items-center">
        <button
          type="button"
          onClick={() => send({ type: 'go' })}
          disabled={!hud.goAvailable}
          aria-label={hud.going ? 'Going fast' : 'Go: speed up to the next gate'}
          title="GO: speed up (↑, W or Enter)"
          className={`pointer-events-auto select-none touch-none w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 font-black text-2xl tracking-wider grid place-items-center transition-transform active:scale-95 ${
            hud.going
              ? 'bg-good border-white text-ink scale-95 shadow-[0_0_30px_rgba(34,197,94,0.8)]'
              : hud.goAvailable
                ? 'bg-good border-[#15803d] text-ink shadow-[0_6px_0_#15803d]' + (hud.etaSec !== undefined && hud.slowRoll ? ' pulse-ring' : '')
                : 'bg-good/40 border-[#15803d] text-ink/60'
          }`}
        >
          {hud.going ? 'GO!' : 'GO'}
        </button>
        <span className="mt-1 text-[0.65rem] font-bold text-dim hidden [@media(pointer:fine)]:block">↑ / Enter</span>
      </div>

      <div className="flex flex-col items-center">
        <button
          type="button"
          aria-label="Brake (hold)"
          title="Brake: hold ↓, S or Space"
          onPointerDown={brakeDown}
          onPointerUp={brakeUp}
          onPointerCancel={brakeUp}
          onLostPointerCapture={brakeUp}
          onContextMenu={(e) => e.preventDefault()}
          className={`pointer-events-auto select-none touch-none w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 font-black text-xl tracking-wider text-white grid place-items-center transition-transform ${
            hud.braking ? 'bg-bad border-white scale-95 shadow-[0_0_30px_rgba(244,63,94,0.8)]' : 'bg-bad/90 border-[#9f1239] shadow-[0_6px_0_#9f1239]'
          }`}
        >
          BRAKE
        </button>
        <span className="mt-1 text-[0.65rem] font-bold text-dim hidden [@media(pointer:fine)]:block">hold ↓ / Space</span>
      </div>
    </div>
  )
})
