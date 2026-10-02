// Settings. Every change applies right away (app/effects.ts mirrors them to <html>, audio and speech).
import { useRef, useState } from 'react'
import { useNav } from '../app/nav'
import { playHorn, playSfx, setSfxVolume, vibrate } from '../services/sfx'
import { canSpeak, configureSpeech, speak } from '../services/speech'
import { DEFAULT_SETTINGS, useGame, type ReadAloudMode, type Settings } from '../store/gameStore'
import { Button, Panel, Screen } from '../ui/kit'
import { BottomAction, InlineConfirm, SectionTitle, Segmented, SettingRow, Slider, Toggle } from '../ui/b-controls'

function reactionWord(v: number): string {
  if (v <= 1.05) return 'Normal'
  if (v <= 1.35) return 'A bit more time'
  if (v <= 1.7) return 'More time'
  return 'Extra time'
}

function speedWord(v: number): string {
  if (v <= 0.8) return 'Slow'
  if (v <= 0.9) return 'Relaxed'
  if (v <= 1.02) return 'Normal'
  return 'Fast'
}

type Msg = { kind: 'ok' | 'bad'; text: string } | null

export function SettingsScreen() {
  const nav = useNav()
  const settings = useGame((s) => s.settings)
  const update = useGame((s) => s.updateSettings)
  const playerName = useGame((s) => s.playerName)
  const setName = useGame((s) => s.setName)
  const exportSave = useGame((s) => s.exportSave)
  const importSave = useGame((s) => s.importSave)
  const resetAll = useGame((s) => s.resetAll)

  const fileInput = useRef<HTMLInputElement>(null)
  const [saveMsg, setSaveMsg] = useState<Msg>(null)
  const [resetStep, setResetStep] = useState<0 | 1 | 2>(0)
  const [nameDraft, setNameDraft] = useState(playerName)

  const set = (patch: Partial<Settings>) => update(patch)

  const testVoice = () => {
    configureSpeech({ rate: settings.voiceRate })
    speak('Stop sign ahead. Come to a full stop, then go when it is safe.', { force: true })
  }

  const doExport = () => {
    try {
      const json = exportSave()
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const day = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `road-warden-save-${day}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 2000)
      setSaveMsg({ kind: 'ok', text: 'Save file downloaded. Keep it somewhere safe.' })
    } catch {
      setSaveMsg({ kind: 'bad', text: 'Could not make the save file on this device.' })
    }
  }

  const doImport = async (file: File | undefined) => {
    if (!file) return
    try {
      const text = await file.text()
      const res = importSave(text)
      if (res.ok) {
        playSfx('unlock')
        setNameDraft(useGame.getState().playerName)
        setSaveMsg({ kind: 'ok', text: 'Save loaded. Welcome back!' })
      } else setSaveMsg({ kind: 'bad', text: res.error ?? 'That file did not work.' })
    } catch {
      setSaveMsg({ kind: 'bad', text: 'Could not read that file.' })
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const commitName = () => {
    const clean = nameDraft.trim()
    if (clean && clean !== playerName) setName(clean)
    else setNameDraft(playerName)
  }

  return (
    <Screen title="Settings" onBack={() => nav.back()}>
      {/* Driving */}
      <SectionTitle read="Reaction time. Slide right to get more time to react to signs and hazards on the road.">Driving</SectionTitle>
      <Panel>
        <Slider
          label="Reaction time"
          value={settings.reactionScale}
          min={1}
          max={2}
          step={0.05}
          onChange={(v) => set({ reactionScale: Math.round(v * 100) / 100 })}
          left="Normal"
          right="Extra time"
          display={`${reactionWord(settings.reactionScale)} (${settings.reactionScale.toFixed(2)}×)`}
        />
        <p className="text-sm text-dim mt-2">More time never lowers your score or XP. Use what feels good.</p>
      </Panel>

      {/* Reading and voice */}
      <SectionTitle read="Read aloud. Off hides the speaker buttons. Tap reads when you press a speaker. Auto reads new text by itself.">
        Reading and voice
      </SectionTitle>
      <Panel>
        <SettingRow label="Read aloud" hint={settings.readAloud === 'auto' ? 'Reads new text by itself.' : settings.readAloud === 'tap' ? 'Tap a 🔊 button to hear text.' : 'Speaker buttons are hidden.'}>
          <Segmented<ReadAloudMode>
            label="Read aloud"
            value={settings.readAloud}
            onChange={(v) => set({ readAloud: v })}
            options={[
              { value: 'off', label: 'Off' },
              { value: 'tap', label: 'Tap' },
              { value: 'auto', label: 'Auto' },
            ]}
          />
        </SettingRow>
        <div className="py-3 border-b border-line">
          <Slider
            label="Voice speed"
            value={settings.voiceRate}
            min={0.7}
            max={1.2}
            step={0.05}
            onChange={(v) => {
              const rate = Math.round(v * 100) / 100
              set({ voiceRate: rate })
              configureSpeech({ rate })
            }}
            left="Slow"
            right="Fast"
            display={speedWord(settings.voiceRate)}
          />
        </div>
        <div className="pt-3">
          <Button onClick={testVoice} disabled={!canSpeak()} className="min-h-11">
            🔊 Test the voice
          </Button>
          {!canSpeak() && <p className="text-sm text-dim mt-2">This browser cannot read aloud.</p>}
        </div>
      </Panel>

      {/* Look */}
      <SectionTitle>Look and feel</SectionTitle>
      <Panel>
        <SettingRow label="Big text" hint="Makes all text larger.">
          <Toggle label="Big text" checked={settings.bigText} onChange={(v) => set({ bigText: v })} />
        </SettingRow>
        <SettingRow label="High contrast" hint="Pure black and white for easier reading.">
          <Toggle label="High contrast" checked={settings.highContrast} onChange={(v) => set({ highContrast: v })} />
        </SettingRow>
        <SettingRow label="Font" hint="Lexend is made for easy reading.">
          <Segmented<'lexend' | 'system'>
            label="Font"
            value={settings.font}
            onChange={(v) => set({ font: v })}
            options={[
              { value: 'lexend', label: 'Lexend' },
              { value: 'system', label: 'System' },
            ]}
          />
        </SettingRow>
        <SettingRow label="Reduced motion" hint="No shaking, flashing or big animations.">
          <Toggle label="Reduced motion" checked={settings.reducedMotion} onChange={(v) => set({ reducedMotion: v })} />
        </SettingRow>
      </Panel>

      {/* Sound */}
      <SectionTitle>Sound and buzz</SectionTitle>
      <Panel>
        <div className="pb-3 border-b border-line">
          <Slider
            label="Volume"
            value={Math.round(settings.volume * 100)}
            min={0}
            max={100}
            step={5}
            onChange={(v) => {
              const volume = v / 100
              set({ volume })
              setSfxVolume(volume, settings.muted)
            }}
            left="Quiet"
            right="Loud"
            display={settings.muted ? 'Muted' : `${Math.round(settings.volume * 100)}%`}
          />
          <div className="flex flex-wrap gap-2 mt-2">
            <Button
              size="sm"
              className="min-h-11"
              onClick={() => {
                setSfxVolume(settings.volume, settings.muted)
                playSfx('correct')
              }}
              disabled={settings.muted}
            >
              ▶ Test sound
            </Button>
            <Button size="sm" className="min-h-11" onClick={() => playHorn('classic')} disabled={settings.muted}>
              📯 Honk
            </Button>
          </div>
        </div>
        <SettingRow label="Mute all sound">
          <Toggle
            label="Mute all sound"
            checked={settings.muted}
            onChange={(v) => {
              set({ muted: v })
              setSfxVolume(settings.volume, v)
            }}
          />
        </SettingRow>
        <SettingRow label="Phone buzz" hint="Small vibrations on phones.">
          <Toggle
            label="Phone buzz"
            checked={settings.haptics}
            onChange={(v) => {
              set({ haptics: v })
              vibrate(40, v)
            }}
          />
        </SettingRow>
      </Panel>

      {/* Breaks */}
      <SectionTitle read="Break reminder. The game will suggest a short break after this many minutes of play.">Breaks</SectionTitle>
      <Panel>
        <SettingRow label="Break reminder" hint="A friendly nudge to rest your eyes and brain.">
          <Segmented<number>
            label="Break reminder"
            value={[0, 15, 20, 30].includes(settings.breakReminderMin) ? settings.breakReminderMin : DEFAULT_SETTINGS.breakReminderMin}
            onChange={(v) => set({ breakReminderMin: v })}
            options={[
              { value: 0, label: 'Off' },
              { value: 15, label: '15m' },
              { value: 20, label: '20m' },
              { value: 30, label: '30m' },
            ]}
          />
        </SettingRow>
      </Panel>

      {/* Player */}
      <SectionTitle>Player</SectionTitle>
      <Panel>
        <label htmlFor="player-name" className="font-bold block">
          Your name
        </label>
        <div className="flex flex-wrap gap-2 mt-2">
          <input
            id="player-name"
            value={nameDraft}
            maxLength={24}
            autoComplete="nickname"
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
            placeholder="Warden"
            className="flex-1 min-w-[10rem] min-h-12 px-4 rounded-xl bg-panel2 border-2 border-line text-lg focus:border-info outline-none"
          />
        </div>
      </Panel>

      {/* Save */}
      <SectionTitle read="Your progress lives on this device. Export makes a save file. Import loads a save file, for example from another device.">
        Your save
      </SectionTitle>
      <Panel>
        <p className="text-dim">Progress lives on this device. Export a file to back it up or move it.</p>
        <div className="flex flex-wrap gap-3 mt-3">
          <Button onClick={doExport} className="flex-1 min-w-[9rem]">
            ⬇ Export save
          </Button>
          <Button onClick={() => fileInput.current?.click()} className="flex-1 min-w-[9rem]">
            ⬆ Import save
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => void doImport(e.target.files?.[0])}
          />
        </div>
        {saveMsg && (
          <p role="status" className={`mt-3 font-bold ${saveMsg.kind === 'ok' ? 'text-good' : 'text-bad'}`}>
            {saveMsg.text}
          </p>
        )}

        <div className="mt-5 pt-4 border-t border-line">
          {resetStep === 0 && (
            <Button variant="ghost" className="min-h-11 !text-bad" onClick={() => setResetStep(1)}>
              Reset all progress…
            </Button>
          )}
          {resetStep === 1 && (
            <InlineConfirm
              message="Erase all progress?"
              detail="Ranks, stars, garage and exam history will be gone. Tip: export a save first."
              cancelLabel="Keep my progress"
              confirmLabel="Yes, continue"
              onCancel={() => setResetStep(0)}
              onConfirm={() => setResetStep(2)}
            />
          )}
          {resetStep === 2 && (
            <InlineConfirm
              message="Last check. This cannot be undone."
              detail="Tap Erase everything to start over from rank 1."
              cancelLabel="Never mind"
              confirmLabel="Erase everything"
              onCancel={() => setResetStep(0)}
              onConfirm={() => {
                resetAll()
                setResetStep(0)
                setNameDraft('')
                nav.home()
              }}
            />
          )}
        </div>
      </Panel>

      <BottomAction>
        <Button variant="primary" size="lg" className="w-full" onClick={() => nav.back()}>
          Done
        </Button>
      </BottomAction>
    </Screen>
  )
}
