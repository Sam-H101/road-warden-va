// Every way to play, with plain-words lock reasons.
import { useState } from 'react'
import { useNav } from '../app/nav'
import { districtById } from '../engine/content'
import { MODE_UNLOCK_RANK } from '../engine/ranks'
import type { RunMode, RunPlan } from '../engine/run'
import { buildHazard, buildNumbers, buildQuick, buildReplay, buildSniper } from '../engine/runBuilder'
import { playSfx } from '../services/sfx'
import { isExamDayUnlocked, isModeUnlocked, isSignTestUnlocked, rankOf, useGame, type GameState } from '../store/gameStore'
import { Button, Panel, Screen } from '../ui/kit'
import { allClearedMissions, buildCtx, dueCount, missionKey, missionPlan, startPlan } from '../ui/play'

interface Tile {
  id: string
  icon: string
  name: string
  blurb: string
  length: string
  locked: string | null // plain reason, or null when open
  run: () => void
}

function rankLock(s: GameState, mode: RunMode): string | null {
  const need = MODE_UNLOCK_RANK[mode]
  return rankOf(s) < need ? `Reach rank ${need}` : null
}

export function ModesScreen() {
  const s = useGame()
  const nav = useNav()
  const [notice, setNotice] = useState<string | null>(null)
  const [ghostOpen, setGhostOpen] = useState(false)

  const launch = (build: () => RunPlan, emptyMsg: string) => {
    setNotice(null)
    if (!startPlan(build())) setNotice(emptyMsg)
  }

  const due = dueCount(s)
  const rank = rankOf(s)

  const tiles: Tile[] = [
    {
      id: 'campaign',
      icon: '🗺️',
      name: 'Campaign',
      blurb: 'Story missions across Virginia. Learn new rules.',
      length: '3-5 min',
      locked: null,
      run: () => nav.go({ name: 'map' }),
    },
    {
      id: 'quick',
      icon: '⚡',
      name: 'Quick Play',
      blurb: due > 0 ? `Reviews what you need most. ${due} due now.` : 'A mixed drive picked just for you.',
      length: '3 min',
      locked: null,
      run: () => launch(() => buildQuick(buildCtx()), 'Nothing to review yet. Start the campaign first!'),
    },
    {
      id: 'sniper',
      icon: '🎯',
      name: 'Sign Sniper',
      blurb: 'Signs only. How many can you read in 90 seconds?',
      length: '90 sec',
      locked: rankLock(s, 'sniper'),
      run: () => launch(() => buildSniper(buildCtx()), 'No signs unlocked yet. Clear more campaign districts first.'),
    },
    {
      id: 'numbers',
      icon: '🔢',
      name: 'Numbers Garage',
      blurb: 'Feet, miles, ages and limits. Pick the right number.',
      length: '2 min',
      locked: rankLock(s, 'numbers'),
      run: () => launch(() => buildNumbers(buildCtx()), 'No number facts unlocked yet. Keep playing the campaign!'),
    },
    {
      id: 'hazard',
      icon: '🚨',
      name: 'Hazard Rush',
      blurb: 'Survive as long as you can. 3 misses ends the run.',
      length: 'Until 3 misses',
      locked: rankLock(s, 'hazard'),
      run: () => launch(() => buildHazard(buildCtx()), 'Play a few missions first so the road has hazards to throw at you.'),
    },
    {
      id: 'replay',
      icon: '🔁',
      name: 'Replay Range',
      blurb: 'Only the ones you missed. Fix them for good.',
      length: 'Short',
      locked: rankLock(s, 'replay') ?? (isModeUnlocked(s, 'replay') ? null : 'Opens after your first miss'),
      run: () => launch(() => buildReplay(buildCtx()), 'No recent misses. Nice driving!'),
    },
    {
      id: 'ghost',
      icon: '👻',
      name: 'Ghost Race',
      blurb: 'Race your own best score on a mission.',
      length: '3-5 min',
      locked: rankLock(s, 'ghost') ?? (isModeUnlocked(s, 'ghost') ? null : 'Clear a mission first'),
      run: () => setGhostOpen(true),
    },
    {
      id: 'signs',
      icon: '🛑',
      name: 'Sign Test',
      blurb: '10 sign questions. Like the DMV, you need all 10.',
      length: '5 min',
      locked: isSignTestUnlocked(s) ? null : 'Clear districts 1 to 6',
      run: () => nav.go({ name: 'exam', kind: 'signs' }),
    },
    {
      id: 'exam',
      icon: '🏁',
      name: 'Exam Day',
      blurb: 'The real test: 10 signs, then 30 questions.',
      length: '~10 min',
      locked: isExamDayUnlocked(s) ? null : 'Clear every district',
      run: () => nav.go({ name: 'district', district: 'd16-examday' }),
    },
  ]

  const recommended = due >= 3 ? 'quick' : 'campaign'

  return (
    <Screen title="Modes" onBack={nav.back} right={<span className="text-sm font-bold text-dim">Rank {rank}</span>}>
      {notice && (
        <div role="status" className="mb-3 rounded-2xl border-2 border-info bg-info/10 px-4 py-3 text-lg font-bold">
          {notice}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {tiles.map((t) => (
          <ModeTile key={t.id} tile={t} recommended={t.id === recommended} />
        ))}
      </div>
      {ghostOpen && <GhostPicker onClose={() => setGhostOpen(false)} onNotice={setNotice} />}
    </Screen>
  )
}

function ModeTile({ tile, recommended }: { tile: Tile; recommended: boolean }) {
  const locked = !!tile.locked
  return (
    <button
      disabled={locked}
      onClick={() => {
        playSfx('click')
        tile.run()
      }}
      aria-label={`${tile.name}. ${tile.blurb}${locked ? ` Locked: ${tile.locked}.` : ''}`}
      className={`relative text-left rounded-2xl border-2 p-4 flex items-start gap-3 min-h-24 transition ${
        locked ? 'bg-panel/60 border-line cursor-not-allowed' : recommended ? 'bg-gold/10 border-gold hover:brightness-110' : 'bg-panel border-line hover:border-info'
      }`}
    >
      <span className={`text-4xl leading-none mt-1 ${locked ? 'grayscale opacity-50' : ''}`} aria-hidden>
        {tile.icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2 flex-wrap">
          <span className={`text-xl font-extrabold ${locked ? 'text-dim' : ''}`}>{tile.name}</span>
          <span className="text-xs font-bold text-dim bg-panel2 border border-line rounded-full px-2 py-0.5">{tile.length}</span>
          {recommended && !locked && <span className="text-xs font-extrabold text-gold">★ Suggested</span>}
        </span>
        <span className={`block mt-1 leading-snug ${locked ? 'text-dim' : ''}`}>{tile.blurb}</span>
        {locked && (
          <span className="mt-2 inline-flex items-center gap-1 text-sm font-extrabold text-info">
            🔒 {tile.locked}
          </span>
        )}
      </span>
    </button>
  )
}

function GhostPicker({ onClose, onNotice }: { onClose: () => void; onNotice: (m: string) => void }) {
  const s = useGame()
  // Most advanced cleared mission first: that is the freshest one to race.
  const list = allClearedMissions(s).reverse()
  const race = (d: (typeof list)[number]) => {
    const best = s.bestScores[missionKey(d.district, d.missionIndex)] ?? 0
    onClose()
    if (!startPlan(missionPlan(d.district, d.missionIndex, best))) onNotice('That mission has no road events right now.')
  }
  return (
    <div role="dialog" aria-modal="true" aria-label="Pick a ghost race" className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-ink/80 backdrop-blur-sm p-3" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
      <Panel className="max-h-[80dvh] flex flex-col animate-rise">
        <div className="flex flex-col min-h-0">
          <div className="flex items-center gap-2">
            <h2 className="flex-1 text-2xl font-extrabold">👻 Pick a race</h2>
            <button onClick={onClose} aria-label="Close" className="w-11 h-11 rounded-full bg-panel2 border-2 border-line text-xl">
              ✕
            </button>
          </div>
          <p className="text-dim mt-1">Same road as your best run. Beat your own score!</p>
          <ul className="mt-3 flex flex-col gap-2 overflow-y-auto">
            {list.map((m, i) => {
              const d = districtById.get(m.district)
              const best = s.bestScores[missionKey(m.district, m.missionIndex)] ?? 0
              return (
                <li key={`${m.district}:${m.missionIndex}`}>
                  <button
                    onClick={() => race(m)}
                    className={`w-full min-h-14 flex items-center gap-3 rounded-xl border-2 px-3 py-2 text-left hover:border-nitro ${i === 0 ? 'border-nitro bg-nitro/10' : 'border-line bg-panel2'}`}
                  >
                    <span className="w-2 self-stretch rounded-full" style={{ background: d?.color ?? '#a78bfa' }} aria-hidden />
                    <span className="flex-1 min-w-0">
                      <span className="block font-extrabold truncate">
                        {d?.short ?? m.district} · Mission {m.missionIndex + 1}
                      </span>
                      <span className="block text-sm text-dim">Ghost: {best.toLocaleString()} pts</span>
                    </span>
                    {i === 0 && <span className="text-xs font-extrabold text-nitro">Latest</span>}
                  </button>
                </li>
              )
            })}
          </ul>
          {list.length === 0 && <p className="mt-3 text-lg">Clear a mission first, then race your ghost here.</p>}
          <Button className="mt-3" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </Panel>
      </div>
    </div>
  )
}
