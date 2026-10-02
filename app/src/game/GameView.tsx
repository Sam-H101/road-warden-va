// The drive screen: mounts the Phaser road scene and layers the React HUD on top.
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { cosmeticById } from '../engine/loadout'
import type { PerkId, RunPlan, RunResult } from '../engine/run'
import { stopSpeaking } from '../services/speech'
import { ownedPerks, useGame } from '../store/gameStore'
import { createBus } from './bus'
import type { GameHandle } from './createGame'
import { emptyResult, runHasEvents } from './director'
import { Controls } from './hud/Controls'
import { HudScore, HudStatus } from './hud/HudTop'
import { Banner, Countdown, EdgeFx, LoadingCover } from './hud/Overlays'
import { PauseMenu } from './hud/PauseMenu'
import { PromptCard } from './hud/PromptCard'
import { ReplayCard } from './hud/ReplayCard'
import type { BannerInfo, Command, HudState, Lane, PromptInfo, ReplayInfo } from './protocol'
import type { CarLook } from './RoadScene'

const SWIPE_PX = 34
const TAP_PX = 14
const TAP_MS = 350

function initialHud(plan: RunPlan): HudState {
  return {
    phase: 'loading',
    mode: plan.mode,
    score: 0,
    streak: 0,
    mult: 1,
    speed: 0,
    mph: 0,
    braking: false,
    going: false,
    goAvailable: false,
    slowRoll: !['sniper', 'numbers', 'hazard'].includes(plan.mode),
    lane: 1,
    perks: {},
    nitro: false,
    siren: false,
    slowMo: false,
  }
}

function equippedLook(): CarLook {
  const s = useGame.getState()
  const val = (id: string | undefined, fallback: string) => (id ? (cosmeticById.get(id)?.value ?? fallback) : fallback)
  return {
    style: val(s.equipped.car, 'compact'),
    paint: val(s.equipped.paint, '#38bdf8') || '#38bdf8',
    decal: val(s.equipped.decal, ''),
    trail: val(s.equipped.trail, ''),
    horn: val(s.equipped.horn, 'classic') || 'classic',
  }
}

function equippedPerks(plan: RunPlan): PerkId[] {
  if (!plan.perksAllowed) return []
  const s = useGame.getState()
  const owned = new Set(ownedPerks(s))
  return s.perksEquipped.filter((p) => owned.has(p))
}

export function GameView({
  plan,
  onFinish,
  onQuit,
}: {
  plan: RunPlan
  onFinish: (r: RunResult) => void
  /** Called with the run so far (completed: false) when the learner quits. */
  onQuit: (partial?: RunResult) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<GameHandle | null>(null)
  const finishedRef = useRef(false)
  const onFinishRef = useRef(onFinish)
  const onQuitRef = useRef(onQuit)
  onFinishRef.current = onFinish
  onQuitRef.current = onQuit

  const reduced = useGame((s) => s.settings.reducedMotion)
  const empty = useMemo(() => !runHasEvents(plan), [plan])

  const [hud, setHud] = useState<HudState>(() => initialHud(plan))
  const [prompt, setPrompt] = useState<PromptInfo | null>(null)
  const [replay, setReplay] = useState<ReplayInfo | null>(null)
  const [banner, setBanner] = useState<BannerInfo | null>(null)
  const [countdown, setCountdown] = useState<number | 'GO' | null>(null)
  const [paused, setPaused] = useState(false)
  const [failed, setFailed] = useState(false)

  const send = useCallback((c: Command) => handleRef.current?.send(c), [])

  // No events at all: finish straight away with an empty, completed run.
  useEffect(() => {
    if (!empty || finishedRef.current) return
    finishedRef.current = true
    onFinishRef.current(emptyResult(plan))
  }, [empty, plan])

  // Mount Phaser (lazy-loaded) and wire the bus.
  useEffect(() => {
    if (empty) return
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    const bus = createBus()
    const offs = [
      bus.on('hud', setHud),
      bus.on('prompt', setPrompt),
      bus.on('replay', setReplay),
      bus.on('banner', setBanner),
      bus.on('countdown', setCountdown),
      bus.on('paused', setPaused),
      bus.on('finish', (r) => {
        if (finishedRef.current) return
        finishedRef.current = true
        stopSpeaking()
        onFinishRef.current(r)
      }),
    ]
    import('./createGame')
      .then(({ createGame }) => {
        if (cancelled) return
        handleRef.current = createGame(host, { plan, bus, perks: equippedPerks(plan), car: equippedLook() })
      })
      .catch((err) => {
        console.error('[game] failed to start', err)
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      for (const off of offs) off()
      handleRef.current?.destroy()
      handleRef.current = null
      bus.clear()
      stopSpeaking()
    }
  }, [plan, empty])

  // Banners hide on their own.
  useEffect(() => {
    if (!banner) return
    const t = window.setTimeout(() => setBanner((b) => (b && b.id === banner.id ? null : b)), banner.durationMs)
    return () => window.clearTimeout(t)
  }, [banner])

  // No page scrolling or pull-to-refresh while driving.
  useEffect(() => {
    const html = document.documentElement
    const prev = { overflow: document.body.style.overflow, overscroll: html.style.overscrollBehavior }
    document.body.style.overflow = 'hidden'
    html.style.overscrollBehavior = 'none'
    const block = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault()
    }
    document.addEventListener('touchmove', block, { passive: false })
    return () => {
      document.body.style.overflow = prev.overflow
      html.style.overscrollBehavior = prev.overscroll
      document.removeEventListener('touchmove', block)
    }
  }, [])

  // Leaving the tab pauses the run.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) send({ type: 'pause' })
    }
    const onBlur = () => send({ type: 'brake', down: false })
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('blur', onBlur)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('blur', onBlur)
    }
  }, [send])

  // Touch: swipe left/right or tap the left/right third of the road.
  const gesture = useRef<{ id: number; x: number; y: number; t: number; fired: boolean } | null>(null)
  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (!(e.target instanceof HTMLCanvasElement)) return
    if (hud.phase === 'countdown') {
      send({ type: 'skip-countdown' })
      return
    }
    gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), fired: false }
  }
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g || g.id !== e.pointerId || g.fired) return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.2) {
      g.fired = true
      send({ type: 'lane', dir: dx < 0 ? -1 : 1 })
    }
  }
  const onPointerUp = (e: RPointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    gesture.current = null
    if (!g || g.id !== e.pointerId || g.fired) return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    if (Math.hypot(dx, dy) <= TAP_PX && performance.now() - g.t <= TAP_MS) {
      const rect = e.currentTarget.getBoundingClientRect()
      const fx = (e.clientX - rect.left) / Math.max(1, rect.width)
      if (fx < 1 / 3) send({ type: 'lane', dir: -1 })
      else if (fx > 2 / 3) send({ type: 'lane', dir: 1 })
    }
  }

  const quit = () => {
    if (finishedRef.current) return
    finishedRef.current = true
    const partial = handleRef.current?.partialResult()
    stopSpeaking()
    onQuitRef.current(partial)
  }

  const pickLane = useCallback((lane: Lane) => send({ type: 'to-lane', lane }), [send])
  const pause = useCallback(() => send({ type: 'pause' }), [send])

  if (empty) return <LoadingCover title={plan.title} />

  const loading = hud.phase === 'loading'
  return (
    <div
      className="absolute inset-0 overflow-hidden select-none bg-ink"
      style={{ touchAction: 'none', overscrollBehavior: 'none', WebkitUserSelect: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (gesture.current = null)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div ref={hostRef} className="absolute inset-0" />

      {/* HUD: transparent to touches except for its controls. */}
      <div className="absolute inset-0 pointer-events-none flex flex-col">
        <EdgeFx nitro={hud.nitro} siren={hud.siren} slowMo={hud.slowMo} reduced={reduced} />
        {/* Top: score left, status right, prompt below (inline between them on short landscape screens). */}
        <div className="px-3 sm:px-5" style={{ paddingTop: 'max(0.6rem, env(safe-area-inset-top))' }}>
          <div className="flex flex-wrap items-start gap-x-2 gap-y-2 sm:gap-y-3 [@media(max-height:520px)]:flex-nowrap">
            <HudScore hud={hud} onPause={pause} />
            <div className="flex-1 [@media(max-height:520px)]:hidden" />
            {prompt && (
              <div className="order-last basis-full min-w-0 [@media(max-height:520px)]:order-none [@media(max-height:520px)]:basis-auto [@media(max-height:520px)]:flex-1">
                <PromptCard prompt={prompt} lane={hud.lane} reduced={reduced} onPickLane={pickLane} etaSec={hud.etaSec} going={hud.going} slowRoll={hud.slowRoll} />
              </div>
            )}
            {!prompt && <div className="hidden [@media(max-height:520px)]:block flex-1" />}
            <HudStatus hud={hud} reduced={reduced} />
          </div>
        </div>
        <div className="flex-1" />
        <div className="px-3 sm:px-5" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <Controls hud={hud} send={send} />
          <p className="mt-1 text-center text-xs font-semibold text-dim/90 hidden sm:[@media(pointer:fine)]:block">
            ← → change lane · ↑ or Enter GO · hold ↓ or Space to brake · K horn · Esc pause
          </p>
        </div>
        {banner && <Banner banner={banner} reduced={reduced} />}
        {countdown !== null && <Countdown value={countdown} reduced={reduced} />}
      </div>

      {replay && <ReplayCard info={replay} reduced={reduced} onDone={() => send({ type: 'replay-done' })} />}
      {paused && !replay && <PauseMenu title={plan.title} onResume={() => send({ type: 'resume' })} onQuit={quit} />}
      {(loading || failed) && (
        <div className="absolute inset-0 z-30">
          <LoadingCover title={failed ? 'The road could not load.' : plan.title} />
          {failed && (
            <div className="absolute inset-x-0 bottom-10 flex justify-center">
              <button type="button" onClick={quit} className="rounded-2xl bg-gold text-ink font-extrabold px-8 py-4 text-xl">
                Back
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
