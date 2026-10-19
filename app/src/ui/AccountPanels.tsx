// Settings panels for the player's state and for online saves (Google sign-in).
import { useEffect, useRef, useState } from 'react'
import { activeState, examSummary, stateCoverage, switchState } from '../engine/states'
import { renderGoogleButton, signOut, syncConfigured, syncNow, useSync } from '../services/sync'
import { useGame } from '../store/gameStore'
import { Button, Panel } from './kit'
import { InlineConfirm, SectionTitle } from './b-controls'
import { StatePicker } from './StatePicker'

export function StatePanel() {
  const [open, setOpen] = useState(false)
  const [pick, setPick] = useState<string | null>(null)
  const info = `You are studying for the ${activeState.name} test. ${stateCoverage(activeState)}`

  return (
    <>
      <SectionTitle read={info}>Your state</SectionTitle>
      <Panel>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[10rem]">
            <div className="text-xl font-extrabold">{activeState.name}</div>
            <p className="text-sm text-dim">{stateCoverage(activeState)}</p>
            {examSummary(activeState) && <p className="text-sm text-dim mt-1">{examSummary(activeState)} Check with your DMV, since rules change.</p>}
            {activeState.manualUrl && (
              <a href={activeState.manualUrl} target="_blank" rel="noreferrer" className="text-sm text-info font-bold underline">
                Open the official {activeState.name} manual
              </a>
            )}
          </div>
          {!open && <Button onClick={() => setOpen(true)}>Change state</Button>}
        </div>
        {open && (
          <div className="mt-3 flex flex-col gap-3">
            <p className="text-base">Each state keeps its own progress. You can switch back any time.</p>
            <StatePicker current={pick ?? activeState.code} onPick={(s) => setPick(s.code)} />
            {pick && pick !== activeState.code ? (
              <InlineConfirm
                message="Switch states now?"
                detail="The game will restart. Your progress for each state is kept."
                confirmLabel="Switch"
                cancelLabel="Cancel"
                tone="calm"
                onConfirm={() => {
                  const g = useGame.getState()
                  switchState(pick, { playerName: g.playerName, settings: g.settings })
                }}
                onCancel={() => {
                  setPick(null)
                  setOpen(false)
                }}
              />
            ) : (
              <Button onClick={() => setOpen(false)}>Keep {activeState.name}</Button>
            )}
          </div>
        )}
      </Panel>
    </>
  )
}

function ago(ms: number): string {
  const s = Math.round((Date.now() - ms) / 1000)
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`
}

export function OnlineSavePanel() {
  const { status, user, lastSyncAt, message } = useSync()
  const btn = useRef<HTMLDivElement>(null)
  const signedIn = !!user && status !== 'signed-out'

  useEffect(() => {
    if (syncConfigured && !signedIn && btn.current) void renderGoogleButton(btn.current)
  }, [signedIn])

  if (!syncConfigured) return null

  const line =
    status === 'syncing'
      ? 'Saving online…'
      : status === 'synced'
        ? `Saved online ${ago(lastSyncAt)}.`
        : status === 'offline'
          ? 'Offline. It will save online when you reconnect.'
          : status === 'error'
            ? 'Online save did not work. It will try again.'
            : ''

  return (
    <>
      <SectionTitle read="Sign in with Google to save your progress online. Then you can keep playing on another phone or computer.">Save online</SectionTitle>
      <Panel>
        {signedIn ? (
          <div className="flex flex-wrap items-center gap-3">
            {user.picture && <img src={user.picture} alt="" className="w-11 h-11 rounded-full" referrerPolicy="no-referrer" />}
            <div className="flex-1 min-w-[10rem]">
              <div className="font-extrabold">Signed in{user.name ? ` as ${user.name}` : ''}</div>
              <p className="text-sm text-dim" aria-live="polite">
                {line}
              </p>
            </div>
            <Button onClick={() => void syncNow()} disabled={status === 'syncing'}>
              Save now
            </Button>
            <Button onClick={signOut}>Sign out</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-base">Sign in to keep your progress safe and play on any device.</p>
            <div ref={btn} className="min-h-11" />
          </div>
        )}
        {message && <p className={`text-sm mt-2 ${status === 'error' ? 'text-bad' : 'text-dim'}`}>{message}</p>}
      </Panel>
    </>
  )
}
