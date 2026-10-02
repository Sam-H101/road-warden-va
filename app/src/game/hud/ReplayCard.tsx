// The Replay card after a miss: picture, the right answer in plain words, the
// one-line rule. Big "Got it" button; continues by itself after 6 s unless the
// learner starts interacting with the card.
import { useEffect, useRef, useState } from 'react'
import { imageUrl } from '../../engine/content'
import { Button, ReadAloudButton, SignImage, useAutoRead } from '../../ui/kit'
import type { ReplayInfo } from '../protocol'

const AUTO_MS = 6000

export function ReplayCard({ info, reduced, onDone }: { info: ReplayInfo; reduced: boolean; onDone: () => void }) {
  const [auto, setAuto] = useState(true)
  const doneRef = useRef(false)
  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    onDone()
  }
  const finishRef = useRef(finish)
  finishRef.current = finish

  useAutoRead(info.missLine, [info.key])

  useEffect(() => {
    if (!auto) return
    const t = window.setTimeout(() => finishRef.current(), AUTO_MS)
    return () => window.clearTimeout(t)
  }, [auto, info.key])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault()
        finishRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const hasImg = !!imageUrl(info.image)
  const isAction = !!info.controlHint
  const speech = `${info.missLine} ${isAction ? 'Do this' : 'The answer is'}: ${info.correctText}`

  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-ink/80 backdrop-blur-sm p-4 pointer-events-auto" role="dialog" aria-modal="true" aria-label="Replay">
      <div
        className={`w-full max-w-md rounded-3xl border-2 border-line bg-panel p-5 shadow-2xl ${reduced ? '' : 'animate-pop'}`}
        onPointerDown={(e) => {
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
          <Button variant="primary" size="xl" className="w-full" onClick={finish} autoFocus>
            Got it
          </Button>
          <div className="mt-2 h-1.5 rounded-full bg-panel2 overflow-hidden" aria-hidden>
            {auto && (
              <div
                key={info.key}
                className="h-full bg-gold/70 origin-left"
                style={reduced ? { width: '100%' } : { animation: `rw-shrink ${AUTO_MS}ms linear forwards` }}
              />
            )}
          </div>
          <style>{`@keyframes rw-shrink { from { transform: scaleX(1); } to { transform: scaleX(0); } }`}</style>
          {!auto && <p className="mt-1 text-center text-xs text-dim">Take your time.</p>}
        </div>
      </div>
    </div>
  )
}
