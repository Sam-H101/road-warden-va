// Pause menu: Resume, quick settings inline, and Quit (with a confirm step).
import { useState } from 'react'
import { Button } from '../../ui/kit'
import { useGame, type ReadAloudMode } from '../../store/gameStore'

const READ_MODES: { id: ReadAloudMode; label: string }[] = [
  { id: 'off', label: 'Off' },
  { id: 'tap', label: 'Tap 🔊' },
  { id: 'auto', label: 'Auto' },
]

function reactionWord(v: number): string {
  if (v <= 1.05) return 'Normal'
  if (v <= 1.35) return 'A bit more time'
  if (v <= 1.7) return 'More time'
  return 'Extra time'
}

export function PauseMenu({ title, slowRoll, onResume, onQuit }: { title: string; slowRoll: boolean; onResume: () => void; onQuit: () => void }) {
  const settings = useGame((s) => s.settings)
  const update = useGame((s) => s.updateSettings)
  const [confirm, setConfirm] = useState(false)

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-ink/85 backdrop-blur-sm p-4 pointer-events-auto overflow-y-auto" role="dialog" aria-modal="true" aria-label="Paused">
      <div className="w-full max-w-md rounded-3xl border-2 border-line bg-panel p-5 shadow-2xl my-auto">
        {confirm ? (
          <>
            <h2 className="text-2xl font-extrabold text-center">Quit this run?</h2>
            <p className="mt-2 text-center text-dim text-lg">Everything you answered still counts.</p>
            <div className="mt-6 flex flex-col gap-3">
              <Button variant="primary" size="lg" className="w-full" onClick={() => setConfirm(false)} autoFocus>
                Keep driving
              </Button>
              <Button variant="danger" size="md" className="w-full" onClick={onQuit}>
                Quit run
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="text-center">
              <div className="text-xs font-black tracking-[0.3em] text-dim">PAUSED</div>
              <h2 className="text-xl font-extrabold mt-1 truncate">{title}</h2>
            </div>
            <Button variant="primary" size="xl" className="w-full mt-4" onClick={onResume} autoFocus>
              Resume
            </Button>

            <div className="mt-6 space-y-5">
              {slowRoll ? (
                <p className="rounded-2xl bg-panel2 border border-line p-3 text-base font-semibold leading-snug">
                  ⏳ This road gives you up to 60 seconds for each question. Press <span className="text-good font-extrabold">GO</span> when you are ready.
                </p>
              ) : (
              <label className="block">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-bold">Reaction time</span>
                  <span className="text-gold font-extrabold">{reactionWord(settings.reactionScale)}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={2}
                  step={0.25}
                  value={settings.reactionScale}
                  onChange={(e) => update({ reactionScale: Number(e.target.value) })}
                  className="w-full h-11 accent-[#fbbf24] cursor-pointer"
                  aria-label="Reaction time"
                />
                <div className="flex justify-between text-sm text-dim font-semibold -mt-1">
                  <span>Normal</span>
                  <span>More time</span>
                </div>
              </label>
              )}

              <div>
                <div className="font-bold mb-1.5">Read aloud</div>
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Read aloud">
                  {READ_MODES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={settings.readAloud === m.id}
                      onClick={() => update({ readAloud: m.id })}
                      className={`h-11 rounded-xl border-2 font-bold ${settings.readAloud === m.id ? 'bg-info/25 border-info text-text' : 'bg-panel2 border-line text-dim'}`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={settings.reducedMotion}
                onClick={() => update({ reducedMotion: !settings.reducedMotion })}
                className="w-full flex items-center justify-between gap-3 min-h-11"
              >
                <span className="text-left">
                  <span className="block font-bold">Calm mode (less motion)</span>
                  <span className="block text-xs text-dim">No shaking, flashing or zooming</span>
                </span>
                <span className={`relative w-14 h-8 rounded-full transition ${settings.reducedMotion ? 'bg-good' : 'bg-panel2 border-2 border-line'}`}>
                  <span className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${settings.reducedMotion ? 'left-7' : 'left-1'}`} />
                </span>
              </button>
            </div>

            <Button variant="ghost" size="md" className="w-full mt-6" onClick={() => setConfirm(true)}>
              Quit run
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
