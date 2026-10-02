// Full-screen celebration moment (boss cleared, exam passed, unlocks) with sound.
import { useEffect, useRef, type ReactNode } from 'react'
import { playSfx, vibrate, type SfxName } from '../services/sfx'
import { useGame } from '../store/gameStore'
import { Button, ReadAloudButton, useAutoRead } from './kit'
import { useReducedMotion } from './b-util'
import { Confetti } from './fx'

export function Celebration({
  icon,
  title,
  line,
  sound = 'win',
  buttonLabel = 'Awesome!',
  onClose,
  children,
}: {
  icon: ReactNode
  title: string
  line?: string
  sound?: SfxName
  buttonLabel?: string
  onClose: () => void
  children?: ReactNode
}) {
  const reduced = useReducedMotion()
  const haptics = useGame((s) => s.settings.haptics)
  const played = useRef(false)
  useAutoRead(`${title}. ${line ?? ''}`)

  useEffect(() => {
    if (played.current) return
    played.current = true
    playSfx(sound)
    vibrate([40, 60, 80], haptics)
  }, [sound, haptics])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/90 backdrop-blur-sm overflow-y-auto"
    >
      {!reduced && sound === 'win' && <Confetti />}
      {!reduced && (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[36rem] h-[36rem] max-w-[140vw] rounded-full bg-gold/15 blur-3xl" />
        </div>
      )}
      <div className={`relative w-full max-w-md text-center ${reduced ? '' : 'animate-pop'}`}>
        <div className={`text-7xl mb-3 ${reduced ? '' : 'glow'}`} aria-hidden>
          {icon}
        </div>
        <div className="flex items-center justify-center gap-2">
          <h2 className="text-3xl font-extrabold text-gold glow">{title}</h2>
          <ReadAloudButton text={`${title}. ${line ?? ''}`} />
        </div>
        {line && <p className="text-lg mt-3 text-text">{line}</p>}
        {children && <div className="mt-5">{children}</div>}
        <Button variant="primary" size="lg" className="mt-6 w-full" onClick={onClose} autoFocus>
          {buttonLabel}
        </Button>
      </div>
    </div>
  )
}
