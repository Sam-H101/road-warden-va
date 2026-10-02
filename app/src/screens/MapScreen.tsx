// Road-trip map: 15 districts and Exam Day on one winding road.
import { useEffect, useMemo, useRef, useState, type Ref } from 'react'
import { useReducedMotion } from '../app/effects'
import { useNav } from '../app/nav'
import { campaignDistricts, finalDistrict, missionCount } from '../engine/content'
import type { District } from '../engine/types'
import { isDistrictComplete, isExamDayUnlocked, unlockedDistricts, useGame } from '../store/gameStore'
import { Screen, Stars } from '../ui/kit'
import { campaignNext, clearedSet } from '../ui/play'

const ROW_H = 132
const TOP_PAD = 70
const X_PATTERN = [50, 78, 50, 22]

type NodeState = 'locked' | 'soon' | 'open' | 'current' | 'complete'

interface MapNode {
  d: District
  x: number
  y: number
  state: NodeState
  final: boolean
}

export function MapScreen() {
  const s = useGame()
  const nav = useNav()
  const reduced = useReducedMotion()
  const [notice, setNotice] = useState<string | null>(null)
  const currentRef = useRef<HTMLButtonElement>(null)

  const unlocked = unlockedDistricts(s)
  const next = campaignNext(s)
  const examOpen = isExamDayUnlocked(s)

  const nodes: MapNode[] = useMemo(() => {
    const all = finalDistrict ? [...campaignDistricts, finalDistrict] : [...campaignDistricts]
    return all.map((d, i) => {
      const final = !!d.isFinal
      let state: NodeState
      if (final) state = examOpen ? (s.bossesCleared.includes(d.id) ? 'complete' : 'current') : 'locked'
      else if (!unlocked.includes(d.id)) state = 'locked'
      else if (missionCount(d.id) === 0) state = 'soon'
      else if (next?.district === d.id) state = 'current'
      else if (isDistrictComplete(s, d.id)) state = 'complete'
      else state = 'open'
      return { d, x: final ? 50 : X_PATTERN[i % X_PATTERN.length], y: TOP_PAD + i * ROW_H, state, final }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.missionsCleared, s.bossesCleared, examOpen])

  const height = TOP_PAD * 2 + (nodes.length - 1) * ROW_H

  // Road path through every node, plus a gold overlay for the part already driven.
  const segment = (a: MapNode, b: MapNode) => `C ${a.x} ${a.y + ROW_H / 2}, ${b.x} ${b.y - ROW_H / 2}, ${b.x} ${b.y}`
  const fullPath = nodes.length ? `M ${nodes[0].x} ${nodes[0].y - TOP_PAD} L ${nodes[0].x} ${nodes[0].y} ` + nodes.slice(1).map((n, i) => segment(nodes[i], n)).join(' ') : ''
  const reachedIdx = nodes.reduce((acc, n, i) => (n.state !== 'locked' ? i : acc), 0)
  const donePath = nodes.length
    ? `M ${nodes[0].x} ${nodes[0].y - TOP_PAD} L ${nodes[0].x} ${nodes[0].y} ` + nodes.slice(1, reachedIdx + 1).map((n, i) => segment(nodes[i], n)).join(' ')
    : ''

  const cleared = campaignDistricts.filter((d) => missionCount(d.id) > 0 && s.bossesCleared.includes(d.id)).length
  const playable = campaignDistricts.filter((d) => missionCount(d.id) > 0).length

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' })
  }, [reduced])

  const open = (n: MapNode, idx: number) => {
    if (n.state === 'locked') {
      const prev = nodes[idx - 1]
      setNotice(n.final ? 'Exam Day opens when every district is cleared.' : `Clear every mission in ${prev?.d.name ?? 'the last district'} to unlock this.`)
      return
    }
    if (n.state === 'soon') {
      setNotice(`${n.d.name} is still being built. Coming soon!`)
      return
    }
    nav.go({ name: 'district', district: n.d.id })
  }

  return (
    <Screen
      title="Road Trip Map"
      onBack={nav.back}
      right={
        <span className="text-sm font-bold text-dim whitespace-nowrap">
          🏆 {cleared}/{playable}
        </span>
      }
    >
      <p className="text-center text-dim text-lg">Tap a stop on the road. Clear every mission to open the next one.</p>

      <div className="relative mx-auto max-w-md" style={{ height }}>
        <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden>
          <path d={fullPath} fill="none" stroke="#1c2440" strokeWidth="46" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path d={fullPath} fill="none" stroke="#2a3558" strokeWidth="38" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path d={donePath} fill="none" stroke="#fbbf24" strokeOpacity="0.25" strokeWidth="38" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path d={fullPath} fill="none" stroke="#eef2ff" strokeOpacity="0.5" strokeWidth="3" className="rw-road-dash" vectorEffect="non-scaling-stroke" />
        </svg>

        {nodes.map((n, i) => (
          <MapNodeButton
            key={n.d.id}
            node={n}
            stars={s.starsMax[n.d.id] ?? 0}
            bossCleared={s.bossesCleared.includes(n.d.id)}
            missionsDone={clearedSet(s, n.d.id).size}
            missions={missionCount(n.d.id)}
            onClick={() => open(n, i)}
            buttonRef={n.state === 'current' && !n.final ? currentRef : undefined}
          />
        ))}
      </div>

      {notice && (
        <div
          role="status"
          className="fixed left-1/2 -translate-x-1/2 z-30 w-[min(92vw,28rem)] bg-panel2 border-2 border-info rounded-2xl px-4 py-3 text-lg font-bold flex items-center gap-3 animate-rise"
          style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="Close" className="w-11 h-11 rounded-full bg-panel text-xl">
            ✕
          </button>
        </div>
      )}
    </Screen>
  )
}

function MapNodeButton({
  node,
  stars,
  bossCleared,
  missionsDone,
  missions,
  onClick,
  buttonRef,
}: {
  node: MapNode
  stars: number
  bossCleared: boolean
  missionsDone: number
  missions: number
  onClick: () => void
  buttonRef?: Ref<HTMLButtonElement>
}) {
  const { d, state, final } = node
  const locked = state === 'locked'
  const soon = state === 'soon'
  const current = state === 'current'
  const size = final ? 92 : current ? 80 : 68
  const color = locked ? '#2a3558' : d.color

  let face: string
  if (final) face = locked ? '🔒' : '🏁'
  else if (locked) face = '🔒'
  else if (soon) face = '🚧'
  else face = String(d.order)

  const status = locked ? 'locked' : soon ? 'coming soon' : state === 'complete' ? (bossCleared ? 'cleared' : 'boss ready') : `${missionsDone} of ${missions} missions`

  return (
    <div className="absolute flex flex-col items-center" style={{ left: `${node.x}%`, top: node.y, transform: 'translate(-50%, -50%)', width: 132 }}>
      {current && !final && (
        <span className="absolute -top-9 text-3xl rw-bob" aria-hidden>
          🚙
        </span>
      )}
      <button
        ref={buttonRef}
        onClick={onClick}
        aria-label={`${d.name}, ${status}`}
        className={`relative rounded-full flex items-center justify-center font-extrabold border-4 transition hover:scale-105 ${current ? 'pulse-ring' : ''} ${
          locked ? 'opacity-70' : ''
        } ${soon ? 'border-dashed' : ''}`}
        style={{
          width: size,
          height: size,
          borderColor: color,
          background: locked ? '#141a2e' : `radial-gradient(circle at 35% 30%, ${color}55, #141a2e 70%)`,
          fontSize: face.length > 1 && !/\d/.test(face) ? size * 0.42 : size * 0.4,
          boxShadow: locked ? 'none' : `0 6px 0 ${color}66`,
        }}
      >
        <span className={locked ? 'text-dim' : 'text-text'}>{face}</span>
        {!final && state === 'complete' && (
          <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-good text-ink text-base flex items-center justify-center border-2 border-ink" aria-hidden>
            ✓
          </span>
        )}
        {!final && !locked && !soon && (
          <span
            className={`absolute -top-1 -right-2 w-8 h-8 rounded-full text-base flex items-center justify-center border-2 border-ink ${bossCleared ? 'bg-gold' : 'bg-panel2'}`}
            title={bossCleared ? 'Boss beaten' : `Boss: ${d.boss}`}
            aria-hidden
          >
            {bossCleared ? '👑' : '⚔️'}
          </span>
        )}
      </button>
      <div className={`mt-1.5 text-center leading-tight font-extrabold ${final ? 'text-lg text-gold' : 'text-sm'} ${locked ? 'text-dim' : ''}`}>
        {final ? d.name : d.short}
      </div>
      {!final && !locked && !soon && <Stars count={stars} size="text-sm" />}
      {soon && <div className="text-xs text-dim font-bold">Coming soon</div>}
    </div>
  )
}
