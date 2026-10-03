// The Replay card after a miss: picture, the right answer in plain words, the
// one-line rule. Big "Got it" button. Learning (slow-roll) runs wait for the
// learner; timed modes continue by themselves after a while (scaled by the
// learner's reaction setting) unless the learner interacts with the card.
import { useEffect, useRef, useState } from 'react'
import { imageUrl } from '../../engine/content'
import { useGame } from '../../store/gameStore'
import { Button, ReadAloudButton, SignImage, useAutoRead } from '../../ui/kit'
import type { ReplayInfo } from '../protocol'

/** Timed modes only: base time before the card continues by itself. */
const AUTO_MS = 9000
/** Keys pressed this soon after the card opens (e.g. a held BRAKE) never close it. */
const KEY_GUARD_MS = 400

export function ReplayCard({ info, reduced, slowRoll, onDone }: { info: ReplayInfo; reduced: boolean; slowRoll: boolean; onDone: () => void }) {
  const reactionScale = useGame((s) => s.settings.reactionScale)
  const readAloud = useGame((s) => s.settings.readAloud)
  // No timer in learning runs or while the card is read out loud: the learner decides.
  const [auto, setAuto] = useState(() => !slowRoll && readAloud !== 'auto')
  const autoMs = Math.round(AUTO_MS * Math.max(1, Math.min(2, reactionScale || 1)))
  const openedAt = useRef(performance.now())
  const boxRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef(false)
  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    onDone()
  }
  const finishRef = useRef(finish)
  finishRef.current = finish

  const hasImg = !!imageUrl(info.image)
  const isAction = !!info.controlHint
  const speech = `${isAction ? 'Do this' : 'The answer is'}: ${info.correctText}. ${info.missLine}`

  // Read the whole card: the right answer first, then the rule.
  useAutoRead(speech, [info.key])

  // Focus the dialog itself (not "Got it"), so releasing a held Space never clicks it.
  useEffect(() => {
    openedAt.current = performance.now()
    boxRef.current?.focus({ preventScroll: true })
  }, [info.key])

  useEffect(() => {
    if (!auto) return
    const t = window.setTimeout(() => finishRef.current(), autoMs)
    // A hidden tab stops the countdown: the card waits for the learner.
    const onVis = () => {
      if (document.hidden) setAuto(false)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [auto, autoMs, info.key])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isGo = e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar'
      if (!isGo) {
        if (e.key !== 'Tab' && e.key !== 'Shift') setAuto(false)
        return
      }
      // Auto-repeat from a key held since before the card opened (BRAKE) must not close it.
      if (e.repeat || performance.now() - openedAt.current < KEY_GUARD_MS) {
        e.preventDefault()
        return
      }
      // Enter/Space on another focused button (Read aloud) does that button's job.
      const t = e.target instanceof Element ? e.target.closest('button') : null
      if (t && !t.closest('[data-gotit]')) return
      e.preventDefault()
      finishRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      ref={boxRef}
      tabIndex={-1}
      className="absolute inset-0 z-40 grid place-items-center overflow-y-auto bg-ink/80 backdrop-blur-sm p-4 pointer-events-auto outline-none"
      role="dialog"
      aria-modal="true"
      aria-label="Replay"
    >
      <div
        className={`w-full max-w-md my-auto rounded-3xl border-2 border-line bg-panel p-5 shadow-2xl ${reduced ? '' : 'animate-pop'}`}
        onPointerDown={(e) => {
          if (!(e.target as HTMLElement).closest('[data-gotit]')) setAuto(false)
        }}
        onFocusCapture={(e) => {
          if (!(e.target as HTMLElement).closest('[data-gotit]')) setAuto(false)
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-black tracking-[0.3em] text-gold">🎬 REPLAY</span>
          <ReadAloudButton text={speech} />
        </div>

        {(hasImg || info.propEmoji) && (
          <div className="flex justify-center my-3">
            {hasImg ? (
              <div className="rounded-2xl bg-white/10 p-2">
                <SignImage id={info.image} size={128} />
              </div>
            ) : (
              <div className="w-28 h-28 rounded-2xl bg-white/10 grid place-items-center text-6xl" aria-hidden>
                {info.propEmoji}
              </div>
            )}
          </div>
        )}

        {info.prompt && <p className="text-center text-dim font-semibold">{info.prompt}</p>}

        <div className="mt-3 rounded-2xl border-2 border-good bg-good/15 p-3 text-center">
          <div className="text-xs font-black tracking-widest text-good">{isAction ? 'DO THIS' : 'RIGHT ANSWER'}</div>
          <div className="text-2xl font-extrabold leading-snug mt-0.5">{info.correctText}</div>
          {info.controlHint && <div className="text-sm font-semibold text-dim mt-1">{info.controlHint}</div>}
        </div>

        <p className="mt-3 text-lg font-semibold leading-snug text-center">{info.missLine}</p>

        {(info.streakSaved || info.livesLeft !== undefined) && (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {info.streakSaved && <span className="rounded-full bg-good/20 text-good border border-good px-3 py-1 text-sm font-bold">🛡️ Streak saved</span>}
            {info.livesLeft !== undefined && (
              <span className="rounded-full bg-panel2 border border-line px-3 py-1 text-sm font-bold">
                {info.livesLeft > 0 ? `❤️ ${info.livesLeft} ${info.livesLeft === 1 ? 'life' : 'lives'} left` : 'Last one — great run!'}
              </span>
            )}
          </div>
        )}

        <div data-gotit className="mt-5">
          <Button variant="primary" size="xl" className="w-full" onClick={finish}>
            Got it
          </Button>
          <div className="mt-2 h-1.5 rounded-full bg-panel2 overflow-hidden" aria-hidden>
            {auto && (
              <div
                key={info.key}
                className="h-full bg-gold/70 origin-left"
                style={reduced ? { width: '100%' } : { animation: `rw-shrink ${autoMs}ms linear forwards` }}
              />
            )}
          </div>
          <style>{`@keyframes rw-shrink { from { transform: scaleX(1); } to { transform: scaleX(0); } }`}</style>
          {!auto && <p className="mt-1 text-center text-sm text-dim">Take your time. Press Got it when you are ready.</p>}
        </div>
      </div>
    </div>
  )
}
