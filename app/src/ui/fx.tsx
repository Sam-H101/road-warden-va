// Juice for the React screens: celebration overlay, confetti, count-up numbers.
// Everything respects reduced motion (no movement, final values right away).
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useReducedMotion } from '../app/effects'
import { Button, ReadAloudButton, useAutoRead } from './kit'

/** Keyframes used by the ui-a screens. Rendered once by App. */
export function FxStyles() {
  return (
    <style>{`
@keyframes rw-fall {
  0% { transform: translate3d(0,-10vh,0) rotate(0deg); opacity: 1; }
  100% { transform: translate3d(var(--rw-drift, 0px),110vh,0) rotate(720deg); opacity: 0.9; }
}
@keyframes rw-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
@keyframes rw-dash { to { stroke-dashoffset: -40; } }
@keyframes rw-glow { 0%,100% { filter: drop-shadow(0 0 0 rgb(251 191 36 / 0)); } 50% { filter: drop-shadow(0 0 14px rgb(251 191 36 / 0.8)); } }
@keyframes rw-slide-l { 0% { transform: translateX(24px); opacity: 0; } 100% { transform: translateX(0); opacity: 1; } }
.rw-bob { animation: rw-bob 2.4s ease-in-out infinite; }
.rw-glow { animation: rw-glow 1.8s ease-in-out infinite; }
.rw-road-dash { stroke-dasharray: 14 26; animation: rw-dash 1.6s linear infinite; }
.rw-slide-in { animation: rw-slide-l 0.35s ease-out both; }
.rw-confetti { position: absolute; top: 0; width: 10px; height: 14px; border-radius: 2px; animation: rw-fall linear forwards; }
.rw-noscrollbar::-webkit-scrollbar { display: none; }
.rw-noscrollbar { scrollbar-width: none; }
@media (prefers-reduced-motion: reduce) {
  .rw-bob, .rw-glow, .rw-road-dash, .rw-slide-in, .pulse-ring, .shine, .animate-pop, .animate-rise { animation: none !important; }
  .rw-confetti { display: none; }
}
`}</style>
  )
}

const CONFETTI_COLORS = ['#fbbf24', '#38bdf8', '#22c55e', '#f43f5e', '#a78bfa', '#fb923c']

export function Confetti({ count = 40 }: { count?: number }) {
  const reduced = useReducedMotion()
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        dur: 1.8 + Math.random() * 1.6,
        drift: (Math.random() - 0.5) * 160,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      })),
    [count],
  )
  if (reduced) return null
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden z-[60]">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="rw-confetti"
          style={
            {
              left: `${p.left}%`,
              background: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.dur}s`,
              '--rw-drift': `${p.drift}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}

/**
 * Full-screen moment for rank-ups, unlocks and other big wins.
 * One button closes it (Enter / Space / Esc work too).
 */
export function Celebration({
  icon,
  kicker,
  title,
  subtitle,
  buttonLabel = 'Nice!',
  onClose,
  children,
  accent = '#fbbf24',
}: {
  icon: ReactNode
  kicker?: string
  title: string
  subtitle?: string
  buttonLabel?: string
  onClose: () => void
  children?: ReactNode
  accent?: string
}) {
  const speech = [kicker, title, subtitle].filter(Boolean).join('. ')
  useAutoRead(speech)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-ink/90 backdrop-blur-sm">
      <Confetti />
      <div className="relative w-full max-w-md text-center animate-pop">
        <div
          className="mx-auto mb-4 flex items-center justify-center w-32 h-32 rounded-full text-7xl border-4 rw-glow"
          style={{ borderColor: accent, background: `radial-gradient(circle, ${accent}33, transparent 70%)` }}
        >
          {icon}
        </div>
        {kicker && <div className="text-sm font-extrabold tracking-[0.3em] uppercase" style={{ color: accent }}>{kicker}</div>}
        <h2 className="text-4xl sm:text-5xl font-extrabold glow mt-1 leading-tight">{title}</h2>
        {subtitle && (
          <div className="mt-3 flex items-start justify-center gap-2">
            <p className="text-lg text-dim">{subtitle}</p>
            <ReadAloudButton text={speech} />
          </div>
        )}
        {children && <div className="mt-4">{children}</div>}
        <Button autoFocus variant="primary" size="lg" className="mt-6 w-full" onClick={onClose}>
          {buttonLabel}
        </Button>
      </div>
    </div>
  )
}

/** Animate a number from `from` to `to`. Reduced motion jumps straight to `to`. */
export function useCountUp(to: number, opts: { from?: number; duration?: number; delay?: number; run?: boolean } = {}): number {
  const { from = 0, duration = 1200, delay = 0, run = true } = opts
  const reduced = useReducedMotion()
  const [value, setValue] = useState(reduced ? to : from)
  useEffect(() => {
    if (reduced) {
      setValue(to)
      return
    }
    if (!run) {
      setValue(from)
      return
    }
    let raf = 0
    let start = 0
    const timer = window.setTimeout(() => {
      const step = (t: number) => {
        if (!start) start = t
        const k = Math.min(1, (t - start) / duration)
        const eased = 1 - Math.pow(1 - k, 3)
        setValue(from + (to - from) * eased)
        if (k < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }, delay)
    return () => {
      window.clearTimeout(timer)
      cancelAnimationFrame(raf)
    }
  }, [to, from, duration, delay, run, reduced])
  return value
}

/** Reveal items one by one (returns how many are visible). */
export function useStagger(count: number, opts: { stepMs?: number; delay?: number; run?: boolean; onStep?: (i: number) => void } = {}): number {
  const { stepMs = 450, delay = 0, run = true, onStep } = opts
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(0)
  const cb = useRef(onStep)
  useEffect(() => {
    cb.current = onStep
  })
  useEffect(() => {
    if (!run) return
    if (reduced) {
      setShown(count)
      if (count > 0) cb.current?.(count - 1)
      return
    }
    const timers: number[] = []
    for (let i = 0; i < count; i++) {
      timers.push(
        window.setTimeout(() => {
          setShown(i + 1)
          cb.current?.(i)
        }, delay + i * stepMs),
      )
    }
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [count, stepMs, delay, run, reduced])
  return shown
}
