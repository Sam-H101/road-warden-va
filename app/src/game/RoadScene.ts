// The driving layer: pseudo-3D road, the player's car, events on the road and all
// the action rules. Run bookkeeping (queue, scoring, perks) lives in RunDirector.
import Phaser from 'phaser'
import { eventsByItem, imageUrl, story } from '../engine/content'
import type { PerkId, RunPlan, RunResult } from '../engine/run'
import { multiplierFor } from '../engine/run'
import type { ActionEvent, GameEvent, GateEvent, SceneProp, Weather } from '../engine/types'
import { playHorn, playSfx, vibrate } from '../services/sfx'
import { osPrefersReduced } from '../app/effects'
import { useGame } from '../store/gameStore'
import { carTextureKey, ensureTextures, PROP_INFO, propTextureKey, sceneryKeys, WALKER_BLIND_KEY, WALKER_KEY } from './art/textures'
import type { GameBus } from './bus'
import { BASE_WINDOW_MS, RunDirector, type Queued, type Resolution, BEHIND_WINDOW_MS } from './director'
import { LANE_COLORS, type Command, type HudState, type Lane, type Phase, type PromptInfo, type ReplayInfo } from './protocol'
import { FX, ensureFxTextures } from './scene/fxTextures'
import { Projection, Z_DRAW, Z_FAR } from './scene/projection'
import { PX_PER_LANE, RoadView, type RoadLine, type StopGuide } from './scene/RoadView'
import { WeatherFx } from './scene/WeatherFx'
import { ACTION_CONTROLS, correctText, eventImage, isPoliceBehind, propEmoji } from './words'

export interface CarLook {
  style: string
  paint: string
  decal: string
  trail: string
  horn: string
}

export interface SceneInit {
  plan: RunPlan
  bus: GameBus
  perks: PerkId[]
  car: CarLook
}

// ---------- tuning ----------
const CRUISE_MPH = 15 // calm slow roll
const GO_MPH = 45 // top speed shown while GO is on
const TIMED_CRUISE_MPH = 35 // timed / survival modes roll faster
const TIMED_GO_MPH = 55
const GO_RAMP_MS = 350 // how fast GO spins up or down
const BRAKE_MS = 1200 // full speed to 0
const ACCEL_MS = 1500 // 0 to full speed
const GAP_MS = 1200 // free cruising between events
const LANE_MS = 150
const DRIFT_MS = 520
const STOP_HOLD_MS = 800
const REPLAY_DELAY_MS = 550
const NITRO_MS = 4000
const GATE_Z = 1.05
const STOP_Z = 1.3
/** Slow roll: GO eases off to NEAR_BOOST when an action hazard gets this close, so it never arrives too fast to react. */
const ACTION_EASE_Z = 9
const NEAR_BOOST = 2
/** Slow / brake-straight count once you are slow enough inside this depth (you are "approaching" it). */
const NEAR_ZONE_Z = 6
/** Brake-straight: braking (without swerving) counts once the deer is this close. */
const BRAKE_ZONE_Z = 10
/** Slow roll: stopping for a stop event counts only this close to the stop line (you reacted to it). */
const STOP_ZONE_Z = 12
/** Go events: stalling counts as a miss only this close to the green light. */
const GO_STALL_Z = 10
/** Leftover visuals of a finished event farther than this fade out so they never overlap the next one. */
const LEFTOVER_Z = 7
const SLOW_MAX = 0.52
const BRAKE_STRAIGHT_MAX = 0.6
/** Stopped while something is still far away: after this long, coach "let go of BRAKE". */
const STUCK_NOTE_MS = 1800
const STUCK_NOTE = 'Let go of BRAKE to keep rolling.'
const STOP_FAR_NOTE = 'Let go of BRAKE. Roll closer, then stop at the line.'
/** Stop guide: shown once the stop line is this close. */
const GUIDE_SHOW_Z = 26
const BRAKE_NOW_NOTE = 'Brake now! Stop in the green box.'
const BRAKE_LATE_NOTE = 'Brake hard!'
const GO_FX_MS = 1100
const FONT = 'Lexend, "Segoe UI", system-ui, sans-serif'

const FLAT_PROPS: ReadonlySet<SceneProp> = new Set(['ponded-water', 'icy-bridge', 'stop-line', 'driveway-exit'])
const SPAN_PROPS: ReadonlySet<SceneProp> = new Set(['pedestrian-crosswalk', 'blind-pedestrian', 'railroad-gate-down', 'funeral-procession'])
const SHOULDER_PROPS: ReadonlySet<SceneProp> = new Set(['cyclist-ahead', 'pedestrian-crosswalk', 'blind-pedestrian'])
const RAIL_PROPS: ReadonlySet<SceneProp> = new Set(['railroad-gate-down', 'railroad-lights-flashing'])

export const imgKey = (id: string) => `img:${id}`

type Visual = Phaser.GameObjects.Image | Phaser.GameObjects.Container

interface WorldObj {
  obj: Visual
  x: number // lanes
  z: number
  lift: number // lanes above the ground
  size: number // display scale = size * laneW / z
  flat: boolean
  vz: number // own depth velocity (per ms), e.g. a bus driving off
  vx: number // own lateral velocity (lanes per ms)
  fadeInLane: boolean
  alphaMul: number
  /** Not carried by the road scroll (vehicles coming from behind). */
  pinned: boolean
  baseKey?: string
  flashKey?: string
  dead: boolean
}

interface Banner {
  ctr: Phaser.GameObjects.Container
  overlay: Phaser.GameObjects.Graphics
  w: number
  h: number
}

interface Behind {
  w: WorldObj
  mode: 'emergency' | 'tailgate'
  state: 'approach' | 'pass' | 'gone'
  t: number
  windowMs: number
  sirenAt: number
}

interface ActiveEvent {
  q: Queued
  ev: GameEvent
  key: string
  z: number
  windowMs: number
  spawnClock: number
  decided: boolean
  done: boolean
  correct: boolean
  metAt: number | null
  usedPerk?: PerkId
  note?: string
  // gates
  laneChoice: number[]
  correctLane: Lane
  removedLane: number | null
  banners: Banner[]
  // action
  hazard?: WorldObj
  stopLine?: RoadLine
  stopState: 'approach' | 'holding' | 'cleared'
  holdMs: number
  stoppedMs: number
  lockLane: number | null
  bolted: boolean
  trainStarted: boolean
  behind?: Behind
  /** Visuals this event added to the road (faded out if still far away when it ends). */
  owned: WorldObj[]
  ownLines: RoadLine[]
  /** Time the car has been standing still while the event is live (for the coaching note). */
  stillMs: number
  stuckNote: boolean
  /** Last braking cue shown for a stop event. */
  brakeCue?: 'early' | 'now' | 'late'
  /** The car has rolled since this event appeared (a held-over stop never counts as a reaction). */
  moved: boolean
}

function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function shuffled<T>(list: readonly T[]): T[] {
  const a = list.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickLine(list: readonly string[] | undefined): string | undefined {
  if (!list || !list.length) return undefined
  return list[Math.floor(Math.random() * list.length)]
}

/**
 * Phaser treats every data: URL as base64. Vite inlines small SVGs as URL-encoded
 * data URLs, so re-encode those as base64 (UTF-8 safe). Returns undefined if broken.
 */
export function loadableUrl(url: string): string | undefined {
  if (!url.startsWith('data:') || url.includes(';base64,')) return url
  try {
    const comma = url.indexOf(',')
    if (comma < 0) return undefined
    const mime = url.slice(5, comma).split(';')[0] || 'image/svg+xml'
    const bytes = new TextEncoder().encode(decodeURIComponent(url.slice(comma + 1)))
    let bin = ''
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    return `data:${mime};base64,${btoa(bin)}`
  } catch {
    return undefined
  }
}

/** Every sign image the run could show: plan events, pool, and requeue candidates. */
export function imageIdsFor(plan: RunPlan): string[] {
  const ids = new Set<string>()
  const items = new Set<string>()
  const add = (e: GameEvent | undefined) => {
    if (!e) return
    const id = e.kind === 'gates' ? e.image : e.kind === 'action' ? e.sign : undefined
    if (id) ids.add(id)
    if (e.item) items.add(e.item)
  }
  for (const e of plan.events ?? []) add(e)
  for (const e of plan.pool ?? []) add(e)
  for (const it of [...items]) for (const e of eventsByItem.get(it) ?? []) add(e)
  return [...ids]
}

export class RoadScene extends Phaser.Scene {
  private readonly cfg: SceneInit
  private readonly bus: GameBus
  readonly director: RunDirector
  private readonly proj = new Projection()
  private road!: RoadView
  private weather!: WeatherFx

  private phase: Phase = 'loading'
  private paused = false
  private frozen = false
  private clock = 0 // game ms (slowed by slow-mo)
  private activeMs = 0 // real ms of play, excludes pause
  private timeLeftMs = 0
  private dist = 0
  private visDist = 0
  private speed = 0
  private V = (Z_FAR - 1) / BASE_WINDOW_MS
  private targetV = this.V
  private hold = false
  private touchBrake = false
  private wasBraking = false
  private brakeKeys: Phaser.Input.Keyboard.Key[] = []
  private lane: Lane = 1
  private readonly carPos = { lane: 1, tilt: 0 }
  private laneTween?: Phaser.Tweens.Tween
  private car!: Phaser.GameObjects.Image
  private carFx!: Phaser.GameObjects.Graphics
  private carW = 160
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter
  private trail?: Phaser.GameObjects.Particles.ParticleEmitter
  private speedLines!: Phaser.GameObjects.Graphics
  private vignette!: Phaser.GameObjects.Image
  private slowTint!: Phaser.GameObjects.Rectangle
  private sirenG!: Phaser.GameObjects.Graphics
  private cur: ActiveEvent | null = null
  private world: WorldObj[] = []
  private behinds: Behind[] = []
  private lines: RoadLine[] = []
  private gapMs = GAP_MS
  private finishLine: RoadLine | null = null
  private pendingReplay: { info: ReplayInfo; wait: number } | null = null
  private nitroMs = 0
  private slowMo = false
  private hudAt = 0
  private seq = 0
  private bannerSeq = 0
  private hornCooldown = 0
  /** GO pressed: speed up to the next gate. Resets once that gate is decided. */
  private goMode = false
  /** Current road speed multiplier from GO (1 = calm cruise). */
  private boost = 1
  /** Speed-line spin-up after pressing GO (ms left). */
  private goFxMs = 0
  /** Car "lunge" forward when GO kicks in (0..1, tweened). */
  private readonly lunge = { v: 0 }
  /** Keys pressed before this time (e.g. the Enter that closed the Replay card) are ignored. */
  private keysAfter = 0
  /** A pause asked for while the Replay card was open (e.g. the tab was hidden); applied when it closes. */
  private pauseAfterReplay = false
  private trailColor: string
  private flashPhase = 0
  private offs: (() => void)[] = []
  private speedLineSeeds: { a: number; r: number; v: number }[] = []

  constructor(cfg: SceneInit) {
    super('road')
    this.cfg = cfg
    this.bus = cfg.bus
    this.director = new RunDirector(cfg.plan, cfg.perks)
    this.trailColor = cfg.car.trail
    this.timeLeftMs = this.director.timeLimitMs
    // Start at the run's own pace (slow roll in learning modes).
    this.V = this.targetV = (Z_FAR - 1) / this.director.windowMs(this.settings?.reactionScale ?? 1)
  }

  // ---------- settings ----------

  private get settings() {
    return useGame.getState().settings
  }

  private get reduced(): boolean {
    return !!this.settings.reducedMotion || osPrefersReduced()
  }

  // ---------- lifecycle ----------

  preload(): void {
    this.load.on('loaderror', (file: Phaser.Loader.File) => console.warn('[road] could not load', file?.key))
    for (const id of imageIdsFor(this.cfg.plan)) {
      const raw = imageUrl(id)
      const url = raw ? loadableUrl(raw) : undefined
      if (url && !this.textures.exists(imgKey(id))) this.load.svg(imgKey(id), url, { width: 256, height: 256 })
    }
  }

  create(): void {
    try {
      this.createScene()
    } catch (err) {
      console.error('[road] scene failed to start', err)
      this.bus.emit('failed', String(err))
    }
  }

  private createScene(): void {
    try {
      ensureTextures(this)
    } catch (err) {
      console.warn('[road] art textures failed, using fallbacks', err)
    }
    ensureFxTextures(this)
    this.proj.resize(this.scale.width, this.scale.height, this.dprGuess())

    let scenery: string[] = []
    try {
      scenery = sceneryKeys()
    } catch {
      scenery = []
    }
    this.road = new RoadView(this, this.proj, scenery, this.director.slowRoll ? 12 : 22)
    this.weather = new WeatherFx(this, this.proj)

    // Player car.
    let carKey: string = FX.car
    try {
      const k = carTextureKey(this, this.cfg.car.style, this.cfg.car.paint, this.cfg.car.decal)
      if (k && this.textures.exists(k)) carKey = k
    } catch (err) {
      console.warn('[road] car texture failed', err)
    }
    this.car = this.add.image(0, 0, carKey).setOrigin(0.5, 1).setDepth(990)
    this.carW = this.car.width || 160
    this.carFx = this.add.graphics().setDepth(991)
    this.sirenG = this.add.graphics().setDepth(1200)

    this.sparks = this.add.particles(0, 0, FX.spark, {
      speed: { min: 180 * this.proj.dpr, max: 520 * this.proj.dpr },
      angle: { min: 200, max: 340 },
      gravityY: 900 * this.proj.dpr,
      lifespan: 750,
      scale: { start: 0.9 * this.proj.dpr, end: 0 },
      rotate: { min: 0, max: 360 },
      tint: [0xfbbf24, 0x22c55e, 0xffffff, 0x38bdf8],
      emitting: false,
    })
    this.sparks.setDepth(2500)
    this.setTrail(this.trailColor)

    this.speedLines = this.add.graphics().setDepth(1500)
    for (let i = 0; i < 26; i++) this.speedLineSeeds.push({ a: Math.random() * Math.PI * 2, r: Math.random(), v: 0.8 + Math.random() * 0.8 })
    this.vignette = this.add.image(0, 0, FX.vignette).setOrigin(0, 0).setDepth(2100).setTint(0xff1744).setAlpha(0)
    this.slowTint = this.add.rectangle(0, 0, 10, 10, 0x38bdf8, 0.1).setOrigin(0, 0).setDepth(1990).setVisible(false)

    this.setupKeyboard()
    this.offs.push(this.bus.on('cmd', (c) => this.onCommand(c)))
    this.scale.on('resize', this.layout, this)
    this.events.once('shutdown', () => this.cleanup())
    this.events.once('destroy', () => this.cleanup())

    this.layout()

    if (!this.director.hasEvents) {
      // Nothing to play: finish at once.
      this.finish(true)
      return
    }
    this.startCountdown()
    this.emitHud()
  }

  private dprGuess(): number {
    const css = this.game.canvas?.clientWidth || this.scale.width
    return Math.max(1, this.scale.width / Math.max(1, css))
  }

  private cleanup(): void {
    for (const off of this.offs) off()
    this.offs = []
    this.scale.off('resize', this.layout, this)
  }

  private layout(): void {
    this.proj.resize(this.scale.width, this.scale.height, this.dprGuess())
    this.road?.layout()
    this.weather?.layout()
    const p = this.proj
    this.vignette?.setDisplaySize(p.W, p.H)
    this.slowTint?.setSize(p.W, p.H)
    if (this.car) this.render(0)
  }

  // ---------- input ----------

  private setupKeyboard(): void {
    const kb = this.input.keyboard
    if (!kb) return
    kb.addCapture('UP,DOWN,LEFT,RIGHT,SPACE')
    const K = Phaser.Input.Keyboard.KeyCodes
    this.brakeKeys = [K.DOWN, K.S, K.SPACE].map((code) => kb.addKey(code, code !== K.S))
    kb.on('keydown', this.onKeyDown, this)
  }

  private onKeyDown(e: KeyboardEvent): void {
    const k = e.key
    // Enter on a focused button or field belongs to that control, not to GO.
    if (k === 'Enter' && e.target instanceof Element && e.target.closest('button, input, select, textarea, a, [role="dialog"]')) return
    if (this.phase === 'replay') return
    if (k === 'Escape' || k === 'p' || k === 'P') {
      if (this.paused) this.setPaused(false)
      else this.setPaused(true)
      return
    }
    if (this.paused) return
    // A key that closed the Replay card must not also fire GO or a lane change.
    if (e.timeStamp > 0 && e.timeStamp <= this.keysAfter) return
    if (this.phase === 'countdown') {
      if (!['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(k)) this.go()
      return
    }
    if (this.phase !== 'drive' && this.phase !== 'ending') return
    if (e.repeat) return
    switch (k) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.changeLane(-1)
        break
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.changeLane(1)
        break
      case 'ArrowUp':
      case 'w':
      case 'W':
      case 'Enter':
      case 'g':
      case 'G':
        this.pressGo()
        break
      case 'k':
      case 'K':
        this.horn()
        break
      case 'h':
      case 'H':
        this.useFlare()
        break
      case 'f':
      case 'F':
        this.useSlowMo()
        break
    }
  }

  private onCommand(c: Command): void {
    switch (c.type) {
      case 'lane':
        if (!this.paused && (this.phase === 'drive' || this.phase === 'ending')) this.changeLane(c.dir)
        break
      case 'to-lane':
        if (!this.paused && (this.phase === 'drive' || this.phase === 'ending') && c.lane !== this.lane) {
          this.setLane(c.lane, LANE_MS * Math.abs(c.lane - this.lane))
          vibrate(8, this.settings.haptics)
        }
        break
      case 'brake':
        this.touchBrake = c.down
        break
      case 'horn':
        if (!this.paused && (this.phase === 'drive' || this.phase === 'ending')) this.horn()
        break
      case 'go':
        this.pressGo()
        break
      case 'perk':
        if (this.paused || this.phase !== 'drive') break
        if (c.id === 'hint-flare') this.useFlare()
        else this.useSlowMo()
        break
      case 'pause':
        this.setPaused(true)
        break
      case 'resume':
        this.setPaused(false)
        break
      case 'skip-countdown':
        if (this.phase === 'countdown') this.go()
        break
      case 'replay-done':
        this.closeReplay()
        break
    }
  }

  private brakeInput(): boolean {
    if (this.touchBrake) return true
    for (const k of this.brakeKeys) {
      // Space that closed the Replay card is not a brake press: ignore keys pressed before the card closed.
      if (k.isDown && !(k.timeDown > 0 && k.timeDown <= this.keysAfter)) return true
    }
    return false
  }

  private changeLane(dir: -1 | 1): void {
    const next = Math.max(0, Math.min(2, this.lane + dir)) as Lane
    if (next === this.lane) {
      // Bump against the edge: a tiny wiggle so the input still feels heard.
      if (!this.reduced) this.tweens.add({ targets: this.carPos, tilt: dir * 6, duration: 70, yoyo: true })
      return
    }
    this.setLane(next, LANE_MS)
    vibrate(8, this.settings.haptics)
  }

  private setLane(next: Lane, ms: number): void {
    const from = this.lane
    this.lane = next
    this.laneTween?.stop()
    this.carPos.tilt = (next - from) * 8
    this.laneTween = this.tweens.add({
      targets: this.carPos,
      lane: next,
      tilt: 0,
      duration: ms,
      ease: 'Sine.easeOut',
    })
    this.emitHud()
  }

  /** Green GO: speed up toward the next gate when the player is ready. */
  private pressGo(): void {
    if (!this.canGo()) return
    this.goMode = true
    playSfx('whoosh')
    vibrate(12, this.settings.haptics)
    // Juice: a short speed-line spin-up, a little forward lunge and a green "GO!".
    this.goFxMs = GO_FX_MS
    this.floatText('GO!', this.carScreenX(), this.proj.baseY - this.carH() * 1.35, '#4ade80', 0)
    if (!this.reduced) {
      this.tweens.killTweensOf(this.lunge)
      this.lunge.v = 0
      this.tweens.add({ targets: this.lunge, v: 1, duration: 140, ease: 'Quad.easeOut', yoyo: true, hold: 120 })
    }
    this.emitHud()
  }

  /** GO works while something is on its way to the car (not while held, pulled over or stopped at a light). */
  private canGo(): boolean {
    if (this.paused || this.phase !== 'drive' || this.goMode || this.hold || this.brakeInput()) return false
    const e = this.cur
    if (e && !e.done) return !(e.ev.kind === 'action' && e.ev.action === 'pull-over')
    return !!this.finishLine
  }

  private horn(): void {
    if (this.hornCooldown > 0) return
    this.hornCooldown = 450
    playHorn(this.cfg.car.horn)
    const e = this.cur
    // The horn scares deer off early. Brake-straight still needs no swerve and a slow pass.
    // Only a deer close enough to hear it (it then bolts; you still brake straight).
    if (e && e.ev.kind === 'action' && e.hazard && !e.bolted && e.hazard.z <= BRAKE_ZONE_Z && (e.ev.prop === 'deer-on-road' || e.ev.action === 'brake-straight')) {
      this.boltDeer(e)
    }
    this.floatText('HONK!', this.carScreenX(), this.proj.baseY - this.carH() * 1.4, '#fde68a', 0)
  }

  // ---------- pause / freeze ----------

  private setPaused(on: boolean): void {
    if (on === this.paused) return
    if (this.phase === 'replay') {
      // The Replay card is open: pause as soon as it closes (e.g. the tab was hidden).
      this.pauseAfterReplay = on
      return
    }
    if (on && (this.phase === 'done' || this.phase === 'loading')) return
    this.paused = on
    const kb = this.input.keyboard
    if (on) kb?.disableGlobalCapture()
    else kb?.enableGlobalCapture()
    if (on) this.touchBrake = false
    this.applyFreeze()
    this.bus.emit('paused', on)
    this.emitHud()
  }

  private applyFreeze(): void {
    const frozen = this.paused || this.phase === 'replay'
    if (frozen === this.frozen) return
    this.frozen = frozen
    if (frozen) {
      this.tweens.pauseAll()
      this.time.paused = true
      for (const em of this.allEmitters()) em.pause()
    } else {
      this.tweens.resumeAll()
      this.time.paused = false
      for (const em of this.allEmitters()) em.resume()
    }
  }

  private allEmitters(): Phaser.GameObjects.Particles.ParticleEmitter[] {
    const list = [this.sparks, ...this.weather.emitters]
    if (this.trail) list.push(this.trail)
    return list
  }

  // ---------- countdown / ending ----------

  private cdTimer?: Phaser.Time.TimerEvent

  private startCountdown(): void {
    this.phase = 'countdown'
    let n = 3
    const step = () => {
      if (this.phase !== 'countdown') return
      if (n > 0) {
        this.bus.emit('countdown', n)
        playSfx('countdown')
        n--
        this.cdTimer = this.time.delayedCall(750, step)
      } else this.go()
    }
    step()
  }

  private go(): void {
    if (this.phase !== 'countdown') return
    this.cdTimer?.remove()
    this.phase = 'drive'
    this.bus.emit('countdown', 'GO')
    playSfx('go')
    this.time.delayedCall(650, () => this.bus.emit('countdown', null))
    this.gapMs = 900
    this.emitHud()
  }

  private ending(text: string, sub?: string): void {
    if (this.phase === 'ending' || this.phase === 'done') return
    this.phase = 'ending'
    this.hold = false
    // Roll through the finish at calm cruise, not at GO speed.
    this.goMode = false
    if (this.slowMo) this.endSlowMo()
    if (this.cur && !this.cur.decided) this.cur.done = true
    this.cur = null
    this.weather.set('clear', this.reduced)
    this.road.setWeather('clear')
    this.bus.emit('prompt', null)
    this.banner(text, sub, 'finish', 1800)
    playSfx('win')
    if (!this.reduced) this.sparks.explode(40, this.carScreenX(), this.proj.baseY - this.carH())
    this.time.delayedCall(1600, () => this.finish(true))
    this.emitHud()
  }

  private finish(completed: boolean): void {
    if (this.phase === 'done') return
    this.phase = 'done'
    this.emitHud()
    this.bus.emit('finish', this.director.result(completed, this.activeMs))
  }

  /** The run so far, for quitting from the pause menu. */
  partialResult(): RunResult {
    return this.director.result(false, this.activeMs)
  }

  // ---------- main loop ----------

  update(_time: number, delta: number): void {
    if (!this.car) return
    const realDt = Math.min(Math.max(delta, 0), 50)
    if (this.paused || this.phase === 'replay' || this.phase === 'done' || this.phase === 'loading') return

    if (this.pendingReplay) {
      this.pendingReplay.wait -= realDt
      if (this.pendingReplay.wait <= 0) {
        this.openReplay(this.pendingReplay.info)
        this.pendingReplay = null
        return
      }
    }

    const dt = realDt * (this.slowMo ? 0.5 : 1)
    this.clock += dt
    if (this.phase === 'drive' || this.phase === 'ending') this.activeMs += realDt
    this.nitroMs = Math.max(0, this.nitroMs - realDt)
    this.hornCooldown = Math.max(0, this.hornCooldown - realDt)
    this.flashPhase += realDt
    this.goFxMs = Math.max(0, this.goFxMs - realDt)
    if (this.cur && this.speed > 0.05) this.cur.moved = true

    // Speed model: cruise when free, brake to 0 in ~1.2 s, re-accelerate in ~1.5 s.
    const braking = (this.phase === 'drive' && this.brakeInput()) || false
    if (braking && !this.wasBraking && this.speed > 0.3) playSfx('brake')
    this.wasBraking = braking
    if (this.phase === 'countdown') this.speed = 0
    else if (this.hold || braking) this.speed = Math.max(0, this.speed - dt / BRAKE_MS)
    else this.speed = Math.min(1, this.speed + dt / ACCEL_MS)

    // Braking or a forced hold cancels GO. GO spins the road up smoothly.
    if (this.goMode && (braking || this.hold)) this.goMode = false
    let boostTarget = this.goMode ? this.director.goMultiplier : 1
    // Slow roll: GO skips the waiting, never the reaction. Near an action hazard
    // the road eases to a readable pace so stopping or slowing stays fair.
    const near = this.cur
    if (this.goMode && this.director.slowRoll && near && !near.decided && near.ev.kind === 'action' && near.z <= ACTION_EASE_Z) {
      boostTarget = Math.min(boostTarget, NEAR_BOOST)
    }
    this.boost += (boostTarget - this.boost) * Math.min(1, dt / GO_RAMP_MS)

    this.V += (this.targetV - this.V) * Math.min(1, dt / 250)
    const dz = this.V * this.speed * this.boost * dt
    this.dist += dz
    this.visDist += dz * (this.nitroMs > 0 ? 1.6 : 1)

    this.proj.camLane = (this.carPos.lane - 1) * 0.35
    // Gentle curves between events; the road straightens while something approaches so labels stay centered.
    const calm = this.reduced ? 0 : this.cur && !this.cur.decided ? 0.25 : 1
    const curveTarget = calm * 0.24 * Math.sin(this.visDist / 140) * Math.sin(this.visDist / 61 + 1.3)
    this.proj.curve += (curveTarget - this.proj.curve) * Math.min(1, dt / 900)

    this.moveWorld(dz, dt)
    this.updateBehinds(dt)

    if (this.phase === 'drive') {
      if (this.cur) {
        this.updateEvent(this.cur, dt)
        if (this.cur && this.cur.done) this.endEvent()
      }
      this.updateRun(dt)
    }

    this.render(realDt)
    this.hudAt -= realDt
    if (this.hudAt <= 0) {
      this.hudAt = 66
      this.emitHud()
    }
  }

  private updateRun(dt: number): void {
    const d = this.director
    if (d.timed) {
      this.timeLeftMs = Math.max(0, this.timeLeftMs - dt)
      if (this.timeLeftMs <= 0 && !this.pendingReplay) {
        this.ending("TIME'S UP!", 'Nice driving.')
        return
      }
    }
    if (d.outOfLives && !this.pendingReplay) {
      this.ending('GREAT RUN!', 'You made it far.')
      return
    }
    if (this.finishLine) {
      if (this.finishLine.z <= 1.0) this.ending('FINISH!', pickLine(story.streakLines))
      return
    }
    if (this.cur || this.pendingReplay) return
    this.gapMs -= dt * Math.max(this.speed, 0.25)
    if (this.gapMs > 0) return
    const q = d.next()
    if (q) this.spawn(q)
    else if (d.endless) this.ending('GREAT RUN!')
    else this.spawnFinish()
  }

  private moveWorld(dz: number, dt: number): void {
    for (const o of this.world) {
      if (!o.pinned) o.z -= dz
      o.z += o.vz * dt
      o.x += o.vx * dt
      if (o.z < 0.35 || o.z > Z_DRAW + 20 || Math.abs(o.x) > 9) o.dead = true
    }
    for (const l of this.lines) l.z -= dz
    if (this.cur) this.cur.z -= dz
    // Drop finished objects (except ones the active event still owns).
    if (this.world.some((o) => o.dead)) {
      const keep: WorldObj[] = []
      for (const o of this.world) {
        if (o.dead) o.obj.destroy()
        else keep.push(o)
      }
      this.world = keep
    }
    this.lines = this.lines.filter((l) => l.z > 0.3 || l === this.finishLine)
  }

  // ---------- events ----------

  private spawn(q: Queued): void {
    const ev = q.ev
    const windowMs = this.director.windowMs(this.settings.reactionScale)
    this.targetV = (Z_FAR - 1) / windowMs
    const e: ActiveEvent = {
      q,
      ev,
      key: `${ev.id}#${++this.seq}`,
      z: Z_FAR,
      windowMs,
      spawnClock: this.clock,
      decided: false,
      done: false,
      correct: false,
      metAt: null,
      laneChoice: [0, 1, 2],
      correctLane: 1,
      removedLane: null,
      banners: [],
      stopState: 'approach',
      holdMs: 0,
      stoppedMs: 0,
      lockLane: null,
      bolted: false,
      trainStarted: false,
      owned: [],
      ownLines: [],
      stillMs: 0,
      stuckNote: false,
      moved: this.speed > 0.05,
    }
    // Every new gate or hazard starts calm; the player chooses when to GO.
    this.goMode = false
    const weather: Weather = ev.kind === 'action' && ev.weather ? ev.weather : 'clear'
    this.weather.set(weather, this.reduced)
    this.road.setWeather(weather)
    const worldBefore = this.world.length
    const linesBefore = this.lines.length
    try {
      if (ev.kind === 'gates') this.buildGates(e, ev)
      else this.buildAction(e, ev)
    } catch (err) {
      console.warn('[road] could not build event visuals', ev.id, err)
    }
    e.owned = this.world.slice(worldBefore).filter((o) => !o.pinned)
    e.ownLines = this.lines.slice(linesBefore)
    this.cur = e
    this.bus.emit('prompt', this.promptFor(e))
    this.emitHud()
  }

  private endEvent(): void {
    const e = this.cur
    if (!e) return
    this.cur = null
    this.gapMs = GAP_MS
    this.fadeLeftovers(e)
    const key = e.key
    this.time.delayedCall(e.correct ? 700 : 300, () => {
      if (!this.cur && this.phase === 'drive') this.bus.emit('prompt', null)
      else if (this.cur && this.cur.key === key) this.bus.emit('prompt', null)
    })
  }

  /**
   * In slow roll the player may stop for a red light while it is still far down
   * the road. Once that event is over, its far-away props quietly fade so they
   * never sit on top of the next gate. Near ones simply roll past.
   */
  private fadeLeftovers(e: ActiveEvent): void {
    for (const o of e.owned) {
      if (o.dead || o.z <= LEFTOVER_Z) continue
      this.tweens.add({ targets: o, alphaMul: 0, duration: this.reduced ? 1 : 450, onComplete: () => (o.dead = true) })
    }
    const far = new Set(e.ownLines.filter((l) => l.z > LEFTOVER_Z))
    if (far.size) this.lines = this.lines.filter((l) => !far.has(l))
  }

  private conditionMet(e: ActiveEvent): boolean {
    const ev = e.ev
    if (ev.kind === 'gates') return this.lane === e.correctLane
    switch (ev.action) {
      case 'stop':
        return this.speed <= 0.001
      case 'slow':
        return this.speed <= SLOW_MAX
      case 'go':
        return this.speed >= 0.4
      case 'move-left':
        return this.lane <= 1
      case 'move-right':
        return this.lane >= 1
      case 'pull-over':
        return this.lane === 2 && this.speed <= 0.01
      case 'brake-straight':
        return this.speed <= BRAKE_STRAIGHT_MAX && (e.lockLane === null || this.lane === e.lockLane)
    }
    return false
  }

  /** How close (depth) a live action event must be before braking for it counts. */
  private zoneFor(e: ActiveEvent): number {
    const ev = e.ev
    if (ev.kind !== 'action') return 0
    if (ev.action === 'slow') return NEAR_ZONE_Z
    if (ev.action === 'brake-straight') return BRAKE_ZONE_Z
    if (ev.action === 'stop') return this.stopZone(e)
    if (ev.action === 'pull-over') return Infinity
    if (ev.action === 'go') return GO_STALL_Z
    return 0
  }

  /** Depth at which stopping for a stop event counts (0 until the car has rolled since it appeared). */
  private stopZone(e: ActiveEvent): number {
    if (!e.moved) return 0
    return this.director.slowRoll ? STOP_ZONE_Z : Infinity
  }

  /** Gentle coaching when the car is parked while the gate or hazard is still far off. */
  private updateStuckNote(e: ActiveEvent, dt: number): void {
    if (e.decided) return
    const stopped = this.speed < 0.02 && !this.hold
    if (stopped && e.z > this.zoneFor(e)) e.stillMs += dt
    else e.stillMs = 0
    const want = e.stillMs >= STUCK_NOTE_MS
    if (want && !e.stuckNote) {
      e.stuckNote = true
      e.note = e.ev.kind === 'action' && e.ev.action === 'stop' && e.moved ? STOP_FAR_NOTE : STUCK_NOTE
      this.bus.emit('prompt', this.promptFor(e))
    } else if (!want && e.stuckNote && this.speed > 0.08) {
      e.stuckNote = false
      e.note = undefined
      this.bus.emit('prompt', this.promptFor(e))
    }
  }

  private updateEvent(e: ActiveEvent, dt: number): void {
    const ev = e.ev
    if (!e.decided) {
      if (this.conditionMet(e)) {
        if (e.metAt === null) e.metAt = this.clock
      } else e.metAt = null
    }
    if (ev.kind === 'gates' || ev.action !== 'pull-over') this.updateStuckNote(e, dt)

    if (ev.kind === 'gates') {
      if (!e.decided && e.z <= GATE_Z) this.decide(e, this.lane === e.correctLane)
      if (e.decided) e.done = true
      return
    }

    switch (ev.action) {
      case 'stop':
        if (e.stopState === 'approach' && !e.decided) {
          // Only a stop the learner made for THIS light counts: they rolled since it
          // appeared and stopped close enough to the line (not a held-over BRAKE).
          if (this.speed <= 0.001 && e.z > STOP_Z && e.z <= this.stopZone(e)) {
            e.stuckNote = false
            e.stopState = 'holding'
            this.hold = true
            e.note = 'Stopped. Wait for it…'
            this.decide(e, true)
          } else if (e.z <= STOP_Z) {
            this.decide(e, false)
            this.clearHazard(e, true)
            e.done = true
          }
        } else if (e.stopState === 'holding') {
          e.holdMs += dt
          if (!e.trainStarted && ev.prop && RAIL_PROPS.has(ev.prop)) this.startTrain(e)
          if (e.holdMs >= STOP_HOLD_MS) {
            e.stopState = 'cleared'
            this.clearHazard(e, false)
            this.hold = false
            e.note = this.brakeInput() ? 'Clear! Let go of BRAKE.' : 'Clear! Go.'
            this.floatText('GO!', this.carScreenX(), this.proj.baseY - this.carH() * 1.6, '#4ade80', 0)
            this.bus.emit('prompt', this.promptFor(e))
            e.done = true
          }
        }
        break
      case 'slow':
        // Slowing to half speed (or less) as you approach counts right away; the
        // hazard then simply rolls past while the next one is on its way.
        if (!e.decided) {
          if (e.z <= NEAR_ZONE_Z && this.speed <= SLOW_MAX) this.decide(e, true)
          else if (e.z <= GATE_Z) this.decide(e, false)
        }
        if (e.decided) e.done = true
        break
      case 'go':
        if (!e.decided) {
          if (this.speed < 0.15 && e.z <= GO_STALL_Z) e.stoppedMs += dt
          else e.stoppedMs = 0
          if (e.stoppedMs >= 1500) this.decide(e, false)
          else if (e.z <= GATE_Z) this.decide(e, this.speed >= 0.4)
        }
        if (e.decided) e.done = true
        break
      case 'move-left':
        if (!e.decided && e.z <= GATE_Z) this.decide(e, this.lane <= 1)
        if (e.decided) e.done = true
        break
      case 'move-right':
        if (!e.decided && e.z <= GATE_Z) this.decide(e, this.lane >= 1)
        if (e.decided) e.done = true
        break
      case 'pull-over':
        this.updatePullOver(e, dt)
        break
      case 'brake-straight': {
        const h = e.hazard
        if (e.lockLane === null) {
          // Until it is close, the deer wanders into whatever lane you are in.
          if (h && !e.bolted) h.x += (this.lane - 1 - h.x) * Math.min(1, dt / 120)
          if (e.z < 14) {
            e.lockLane = this.lane
            if (h && !e.bolted) h.x = this.lane - 1
          }
        } else if (!e.decided && this.lane !== e.lockLane) {
          // Swerving is the mistake this event teaches.
          this.decide(e, false)
          if (!e.bolted) this.boltDeer(e)
        }
        if (!e.decided && e.lockLane !== null && e.z <= BRAKE_ZONE_Z && this.speed <= BRAKE_STRAIGHT_MAX && this.lane === e.lockLane) {
          this.decide(e, true)
          if (!e.bolted) this.boltDeer(e)
        } else if (!e.decided && e.z <= STOP_Z) {
          this.decide(e, false)
          if (!e.bolted) this.boltDeer(e)
        }
        if (e.decided) e.done = true
        break
      }
    }

    // Deer always get out of the way before you reach them.
    if (ev.prop === 'deer-on-road' && e.hazard && !e.bolted && e.hazard.z < 1.6) this.boltDeer(e)
    // Vehicles behind (other than pull-over) close in until the event is decided, then pass.
    if (e.behind && e.behind.state === 'approach' && ev.action !== 'pull-over') {
      e.behind.t += dt
      if (e.decided) this.passBehind(e, false)
    }
  }

  private updatePullOver(e: ActiveEvent, dt: number): void {
    const b = e.behind
    if (!b) {
      if (!e.decided) {
        this.decide(e, this.lane === 2 && this.speed <= 0.01)
        e.done = true
      }
      return
    }
    if (b.state === 'approach') {
      b.t += dt
      if (!e.decided && this.lane === 2 && this.speed <= 0.01) {
        this.decide(e, true)
        this.hold = true
        e.note = 'Good. Let it pass…'
        this.bus.emit('prompt', this.promptFor(e))
        this.passBehind(e, true)
      } else if (!e.decided && b.t >= b.windowMs) {
        this.decide(e, false)
        this.passBehind(e, true)
      }
    }
    if (b.state !== 'approach' && (b.w.z > 3.5 || b.w.dead)) {
      if (this.hold) {
        this.hold = false
        this.floatText('GO!', this.carScreenX(), this.proj.baseY - this.carH() * 1.6, '#4ade80', 0)
      }
      e.done = true
    }
  }

  private decide(e: ActiveEvent, correct: boolean): void {
    if (e.decided) return
    e.decided = true
    e.correct = correct
    // Each new gate starts calm again; the player chooses when to GO.
    this.goMode = false
    const at = correct && e.metAt !== null ? e.metAt : this.clock
    // Pull-over is timed by the siren; everything else in slow roll has no real time pressure.
    const behindWin = e.ev.kind === 'action' && e.ev.action === 'pull-over' && e.behind ? e.behind.windowMs : undefined
    const calm = this.director.slowRoll && behindWin === undefined
    const res = this.director.resolve(e.q, correct, at - e.spawnClock, behindWin ?? e.windowMs, e.usedPerk, calm)
    if (this.slowMo) this.endSlowMo()
    if (correct) this.onCorrect(e, res)
    else this.onMiss(e, res)
    this.bus.emit('prompt', this.promptFor(e))
    this.emitHud()
  }

  private onCorrect(e: ActiveEvent, res: Resolution): void {
    playSfx('correct')
    vibrate(25, this.settings.haptics)
    const x = this.carScreenX()
    const y = this.proj.baseY - this.carH() * 0.6
    this.sparks.explode(this.reduced ? 8 : 22, x, y)
    this.floatText(`+${res.points}`, x, this.proj.baseY - this.carH() * 1.3, '#fbbf24', 0)
    // Slow roll shows one reward cue at a time: the streak badge already shows the multiplier.
    if (res.mult > 1 && !this.director.slowRoll) this.floatText(`×${res.mult}`, x + this.proj.laneW * 0.45, this.proj.baseY - this.carH() * 1.05, '#c4b5fd', 120)
    if (e.ev.kind === 'gates') this.markBanner(e, e.correctLane, 'correct')

    const line = pickLine(story.streakLines)
    switch (res.reward) {
      case 'horn':
        playHorn(this.cfg.car.horn)
        this.sparkle()
        this.banner(`STREAK ${res.streak}!`, line, 'streak', 2200)
        break
      case 'nitro':
        this.nitroMs = NITRO_MS
        playSfx('nitro')
        this.banner('NITRO!', line ?? `Streak ${res.streak}!`, 'nitro', NITRO_MS)
        // A full-screen flash is too busy for slow roll; keep it for the fast modes only.
        if (!this.reduced && !this.director.slowRoll) this.cameras.main.flash(160, 167, 139, 250)
        break
      case 'slow-mo-charge':
        playSfx('streak')
        this.banner(`STREAK ${res.streak}!`, this.cfg.plan.perksAllowed ? '+1 Slow-Mo charge 🐢' : line, 'streak', 2400)
        break
      case 'gold-trail':
        playSfx('streak')
        this.setTrail('#fbbf24')
        this.sparkle()
        this.banner('GOLD TRAIL!', `Streak ${res.streak}! ${line ?? ''}`.trim(), 'streak', 2600)
        break
      default:
        if (res.multUp) {
          playSfx('streak')
          this.banner(`×${res.mult} MULTIPLIER`, line, 'good', 1800)
        }
    }
  }

  private onMiss(e: ActiveEvent, res: Resolution): void {
    playSfx('miss')
    vibrate([50, 40, 50], this.settings.haptics)
    if (!this.reduced) {
      this.cameras.main.shake(this.director.slowRoll ? 160 : 220, this.director.slowRoll ? 0.003 : 0.006)
      this.tweens.killTweensOf(this.vignette)
      this.vignette.setAlpha(0)
      this.tweens.add({ targets: this.vignette, alpha: 0.6, duration: 120, yoyo: true, hold: 160 })
    }
    if (e.ev.kind === 'gates') {
      if (this.lane !== e.correctLane) this.markBanner(e, this.lane, 'miss')
      this.markBanner(e, e.correctLane, 'correct')
    }
    if (res.streakSaved) this.banner('🛡️ STREAK SAVED', 'Second Chance kept your streak.', 'good', 2000)
    this.pendingReplay = { info: this.replayFor(e, res), wait: REPLAY_DELAY_MS }
  }

  private openReplay(info: ReplayInfo): void {
    this.phase = 'replay'
    this.touchBrake = false
    this.applyFreeze()
    this.bus.emit('replay', info)
    this.emitHud()
  }

  private closeReplay(): void {
    if (this.phase !== 'replay') return
    this.bus.emit('replay', null)
    this.phase = 'drive'
    this.keysAfter = performance.now()
    this.applyFreeze()
    if (this.director.outOfLives) this.ending('GREAT RUN!', 'You made it far.')
    else if (this.director.timed && this.timeLeftMs <= 0) this.ending("TIME'S UP!", 'Nice driving.')
    if (this.pauseAfterReplay) {
      this.pauseAfterReplay = false
      this.setPaused(true)
    }
    this.emitHud()
  }

  // ---------- perks ----------

  private useFlare(): void {
    const e = this.cur
    if (!e || e.decided || e.ev.kind !== 'gates' || e.removedLane !== null) return
    if (!this.director.useFlare()) return
    const wrong = [0, 1, 2].filter((l) => l !== e.correctLane)
    const lane = wrong[Math.floor(Math.random() * wrong.length)]
    e.removedLane = lane
    e.usedPerk = e.usedPerk ?? 'hint-flare'
    this.markBanner(e, lane, 'removed')
    playSfx('whoosh')
    this.banner('🔦 HINT FLARE', 'One wrong gate is out.', 'info', 1400)
    this.bus.emit('prompt', this.promptFor(e))
    this.emitHud()
  }

  private useSlowMo(): void {
    const e = this.cur
    if (!e || e.decided || this.slowMo) return
    if (!this.director.useSlowMo()) return
    this.slowMo = true
    e.usedPerk = e.usedPerk ?? 'slow-mo'
    this.tweens.timeScale = 0.5
    this.slowTint.setVisible(true)
    playSfx('whoosh')
    this.banner('🐢 SLOW-MO', 'Time is slowed for this one.', 'info', 1400)
    this.emitHud()
  }

  private endSlowMo(): void {
    this.slowMo = false
    this.tweens.timeScale = 1
    this.slowTint.setVisible(false)
  }

  // ---------- building event visuals ----------

  private addWorld(obj: Visual, x: number, z: number, size: number, opts: Partial<WorldObj> = {}): WorldObj {
    const o: WorldObj = {
      obj,
      x,
      z,
      lift: 0,
      size,
      flat: false,
      vz: 0,
      vx: 0,
      fadeInLane: false,
      alphaMul: 1,
      pinned: false,
      dead: false,
      ...opts,
    }
    obj.setVisible(false)
    this.world.push(o)
    return o
  }

  private makeLabelBox(label: string, w: number, h: number, color: number): Phaser.GameObjects.Container {
    const g = this.add.graphics()
    g.fillStyle(color, 1)
    g.fillRoundedRect(-w / 2, -h, w, h, 12)
    g.lineStyle(5, 0x0f172a, 1)
    g.strokeRoundedRect(-w / 2, -h, w, h, 12)
    const t = this.add
      .text(0, -h / 2, label, {
        fontFamily: FONT,
        fontSize: `${Math.max(14, Math.min(28, w / 7))}px`,
        fontStyle: '800',
        color: '#0f172a',
        align: 'center',
        wordWrap: { width: w - 12, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 0.5)
    return this.add.container(0, 0, [g, t])
  }

  /** A prop sprite (or a labeled box if the art is missing). Returns the visual and its px width. */
  private makeProp(prop: SceneProp): { obj: Visual; w: number; key?: string } {
    const info = PROP_INFO[prop]
    const key = propTextureKey(prop)
    const w = info?.width ?? 160
    const h = info?.height ?? 120
    if (this.textures.exists(key)) {
      const img = this.add.image(0, 0, key).setOrigin(0.5, 1)
      return { obj: img, w: img.width || w, key }
    }
    return { obj: this.makeLabelBox(prop.replace(/-/g, ' '), w, h, 0xfbbf24), w }
  }

  /** Roadside sign on a post. Base units: 200 = one lane. */
  private makeSignPost(imageId: string | undefined, big: boolean): Phaser.GameObjects.Container {
    const size = big ? 236 : 196
    const postH = big ? 230 : 214
    const parts: Phaser.GameObjects.GameObject[] = []
    const g = this.add.graphics()
    g.fillStyle(0x64748b, 1)
    g.fillRect(-7, -postH, 14, postH)
    g.fillStyle(0x0b1020, 0.55)
    g.fillRoundedRect(-size / 2 - 10, -postH - size - 10, size + 20, size + 20, 18)
    parts.push(g)
    const key = imageId ? imgKey(imageId) : ''
    if (imageId && this.textures.exists(key)) {
      parts.push(this.add.image(0, -postH - 4, key).setOrigin(0.5, 1).setDisplaySize(size - 8, size - 8))
    } else if (imageId) {
      parts.push(this.add.image(0, -postH - 4, FX.missing).setOrigin(0.5, 1).setDisplaySize(size - 8, size - 8))
      const label = imageId.replace(/^(sign|signal|mark|curb|hand|diagram)-/, '').replace(/-/g, ' ').toUpperCase()
      parts.push(
        this.add
          .text(0, -postH - size / 2, label, {
            fontFamily: FONT,
            fontSize: '30px',
            fontStyle: '800',
            color: '#0f172a',
            align: 'center',
            wordWrap: { width: size - 30, useAdvancedWrap: true },
          })
          .setOrigin(0.5, 0.5),
      )
    } else {
      parts.push(this.add.image(0, -postH - 4, FX.caution).setOrigin(0.5, 1).setDisplaySize(size - 8, size - 8))
    }
    return this.add.container(0, 0, parts)
  }

  private labelResolution(): number {
    return Math.max(1, Math.min(3, (this.proj.laneW / 200) * 1.6))
  }

  private makeBanner(label: string, color: number): Banner {
    const W = 186
    const text = this.add
      .text(0, 0, label, {
        fontFamily: FONT,
        fontSize: '40px',
        fontStyle: '800',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: W - 22, useAdvancedWrap: true },
        lineSpacing: -2,
      })
      .setOrigin(0.5, 0.5)
      .setResolution(this.labelResolution())
    for (const s of [40, 36, 32, 29, 26, 23, 21, 19]) {
      text.setFontSize(s)
      if (text.getWrappedText(label).length <= 2 && text.width <= W - 14) break
    }
    const h = Math.max(100, Math.ceil(text.height) + 40)
    const g = this.add.graphics()
    g.fillStyle(0x1e293b, 1)
    g.fillRect(-W / 2 + 22, -30, 8, 32)
    g.fillRect(W / 2 - 30, -30, 8, 32)
    g.fillStyle(0x000000, 0.35)
    g.fillRoundedRect(-W / 2 + 6, 8, W, h, 18)
    g.fillStyle(0x0b1020, 0.97)
    g.fillRoundedRect(-W / 2, 0, W, h, 18)
    g.lineStyle(9, color, 1)
    g.strokeRoundedRect(-W / 2, 0, W, h, 18)
    g.fillStyle(color, 1)
    g.fillRoundedRect(-W / 2, 0, W, 18, { tl: 18, tr: 18, bl: 0, br: 0 })
    g.fillTriangle(-18, h + 6, 18, h + 6, 0, h + 26)
    text.setPosition(0, 9 + h / 2)
    const overlay = this.add.graphics()
    const ctr = this.add.container(0, 0, [g, text, overlay])
    return { ctr, overlay, w: W, h }
  }

  private markBanner(e: ActiveEvent, lane: number, how: 'correct' | 'miss' | 'removed'): void {
    const b = e.banners[lane]
    if (!b) return
    const o = b.overlay
    o.clear()
    const { w, h } = b
    if (how === 'removed') {
      o.fillStyle(0x334155, 0.82)
      o.fillRoundedRect(-w / 2, 0, w, h, 18)
      o.lineStyle(14, 0xf43f5e, 1)
      o.lineBetween(-w / 2 + 26, 18, w / 2 - 26, h - 18)
      o.lineBetween(w / 2 - 26, 18, -w / 2 + 26, h - 18)
      if (!this.reduced) this.tweens.add({ targets: b.ctr, angle: { from: -6, to: 0 }, duration: 300, ease: 'Back.easeOut' })
      return
    }
    const color = how === 'correct' ? 0x22c55e : 0xf43f5e
    o.lineStyle(14, color, 1)
    o.strokeRoundedRect(-w / 2 - 4, -4, w + 8, h + 8, 20)
    if (how === 'correct') {
      o.fillStyle(0x22c55e, 0.28)
      o.fillRoundedRect(-w / 2, 0, w, h, 18)
      if (!this.reduced) this.tweens.add({ targets: b.ctr, scale: { from: 1.18, to: 1 }, duration: 320, ease: 'Back.easeOut' })
    }
  }

  private buildGates(e: ActiveEvent, ev: GateEvent): void {
    e.laneChoice = shuffled([0, 1, 2])
    e.correctLane = Math.max(0, e.laneChoice.indexOf(ev.answer)) as Lane
    const TOP = -446
    const POST_X = 318
    const frame = this.add.graphics()
    frame.fillStyle(0x1e293b, 1)
    frame.fillRect(-POST_X - 11, TOP, 22, -TOP)
    frame.fillRect(POST_X - 11, TOP, 22, -TOP)
    frame.fillStyle(0x334155, 1)
    frame.fillRoundedRect(-POST_X - 26, TOP - 12, (POST_X + 26) * 2, 34, 8)
    frame.lineStyle(4, 0x0f172a, 1)
    frame.strokeRoundedRect(-POST_X - 26, TOP - 12, (POST_X + 26) * 2, 34, 8)
    for (let i = -POST_X; i < POST_X; i += 48) {
      frame.fillStyle(0xfacc15, 1)
      frame.fillRect(i, TOP - 4, 22, 18)
    }
    const parts: Phaser.GameObjects.GameObject[] = [frame]
    for (let lane = 0; lane < 3; lane++) {
      const label = ev.choices[e.laneChoice[lane]] ?? ''
      const b = this.makeBanner(label, LANE_COLORS[lane])
      b.ctr.setPosition((lane - 1) * 200, TOP + 30)
      parts.push(b.ctr)
      e.banners.push(b)
    }
    const gate = this.add.container(0, 0, parts)
    this.addWorld(gate, 0, Z_FAR, 1 / 200)
    if (ev.image) this.addWorld(this.makeSignPost(ev.image, true), 2.3, Z_FAR + 1.5, 1 / 200)
  }

  private buildAction(e: ActiveEvent, ev: ActionEvent): void {
    const action = ev.action
    const prop = ev.prop && PROP_INFO[ev.prop] ? ev.prop : undefined
    const info = prop ? PROP_INFO[prop] : undefined

    if (action === 'stop' || prop === 'stop-line') {
      const line: RoadLine = { z: Z_FAR, kind: 'stop' }
      this.lines.push(line)
      if (action === 'stop') e.stopLine = line
    }

    // Lane drift: some hazards start you where you have to react.
    if (action === 'move-left' && this.lane !== 2) this.drift(2, '↗')
    if (action === 'move-right' && this.lane !== 0) this.drift(0, '↖')
    if (action === 'pull-over' && this.lane === 2) this.drift(1, '↖')

    const behindProp = action === 'pull-over' ? (prop && info?.side === 'behind' ? prop : 'emergency-behind') : prop && info?.side === 'behind' ? prop : undefined
    if (behindProp) this.spawnBehind(e, behindProp === 'emergency-behind' && isPoliceBehind(ev) ? 'emergency-stopped' : behindProp)

    if (prop && prop !== 'stop-line' && prop !== behindProp) {
      const { obj, w, key } = this.makeProp(prop)
      const span = SPAN_PROPS.has(prop)
      const scaleMul = span ? 1.45 : 1
      const wl = (w / PX_PER_LANE) * scaleMul
      const side = info?.side ?? 'road'
      let x = 0
      let zOff = 0
      let fadeInLane = false
      let lift = 0
      if (action === 'move-left') x = 1.5 + wl * 0.42
      else if (action === 'move-right') x = -(1.5 + wl * 0.42)
      else if (prop === 'deer-on-road' || action === 'brake-straight') x = this.lane - 1
      else if (FLAT_PROPS.has(prop)) x = prop === 'driveway-exit' ? 1.0 : 0
      else if (side === 'right') {
        x = 1.62 + wl / 2
        zOff = action === 'stop' ? 0.15 : 0
      } else if (side === 'left') {
        x = -(1.62 + wl / 2)
        zOff = action === 'stop' ? 0.15 : 0
      } else if (side === 'overhead') {
        lift = 1.3
      } else if (action === 'stop') {
        zOff = span ? 0.45 : 0.75
      } else if (SHOULDER_PROPS.has(prop)) {
        x = 1.5 + wl * 0.3
        fadeInLane = true
      } else {
        // A vehicle ahead: put it in a lane next to yours.
        x = this.lane === 1 ? 1 : 0
        fadeInLane = true
      }
      const flashKey = (info as { flashKey?: string } | undefined)?.flashKey
      e.hazard = this.addWorld(obj, x, Z_FAR + zOff, scaleMul / PX_PER_LANE, {
        flat: FLAT_PROPS.has(prop),
        fadeInLane,
        lift,
        baseKey: key,
        flashKey: key && flashKey && this.textures.exists(flashKey) ? flashKey : undefined,
      })
    }

    if (ev.sign) {
      const z = action === 'stop' ? Z_FAR - 0.2 : Z_FAR - 0.4
      this.addWorld(this.makeSignPost(ev.sign, false), 2.35, z, 1 / 200)
    } else if (!prop && action !== 'pull-over') {
      this.addWorld(this.makeSignPost(undefined, false), 2.35, Z_FAR - 0.4, 1 / 200)
    }

    if (action === 'brake-straight' && !e.hazard) {
      const { obj, key } = this.makeProp('deer-on-road')
      e.hazard = this.addWorld(obj, this.lane - 1, Z_FAR, 1 / PX_PER_LANE, { baseKey: key })
    }
  }

  private drift(lane: Lane, arrow: string): void {
    this.setLane(lane, DRIFT_MS)
    this.floatText(arrow, this.proj.xOf(lane - 1, 1), this.proj.baseY - this.carH() * 1.5, '#e2e8f0', 0)
  }

  private spawnBehind(e: ActiveEvent, prop: SceneProp): void {
    const { obj, key } = this.makeProp(prop)
    const info = PROP_INFO[prop] as { flashKey?: string } | undefined
    const flashKey = info?.flashKey
    const lanePos = this.lane - 1
    const w = this.addWorld(obj, lanePos + (lanePos <= 0 ? 0.5 : -0.5), 0.5, 0.9 / PX_PER_LANE, {
      baseKey: key,
      pinned: true,
      flashKey: key && flashKey && this.textures.exists(flashKey) ? flashKey : undefined,
    })
    const mode = prop === 'tailgater-behind' ? 'tailgate' : 'emergency'
    const behindMs = Math.min(e.windowMs, BEHIND_WINDOW_MS * Math.max(1, Math.min(2, this.settings.reactionScale || 1)) * this.director.radarScale)
    const b: Behind = { w, mode, state: 'approach', t: 0, windowMs: behindMs, sirenAt: 1700 }
    e.behind = b
    this.behinds.push(b)
    if (mode === 'emergency') playSfx('siren')
  }

  private passBehind(e: ActiveEvent, fast: boolean): void {
    const b = e.behind
    if (!b || b.state !== 'approach') return
    b.state = 'pass'
    const passLane = this.lane === 1 ? 0 : 1
    this.tweens.add({ targets: b.w, x: passLane - 1, duration: 450, ease: 'Sine.easeInOut' })
    b.w.vz = fast ? 0.0025 : 0.0018
  }

  /** Vehicles behind the car: they close in, then pass in another lane. */
  private updateBehinds(dt: number): void {
    if (!this.behinds.length) return
    for (const b of this.behinds) {
      const w = b.w
      if (w.dead) b.state = 'gone'
      if (b.state === 'approach') {
        w.vz = 0
        if (b.mode === 'emergency') {
          // Close in over the first few seconds, then sit right behind so it is in view
          // above the bottom controls (on phones they cover the lowest ~120 px).
          const k = clamp01(b.t / Math.max(1, Math.min(b.windowMs, 4000)))
          w.z = 0.5 + 0.38 * (1 - (1 - k) * (1 - k))
          b.sirenAt -= dt
          if (b.sirenAt <= 0) {
            playSfx('siren')
            b.sirenAt = 1700
          }
        } else {
          w.z = Math.min(0.84, 0.5 + b.t / 2200)
        }
        // Follow the player half a lane over so the car stays visible.
        const lanePos = this.lane - 1
        const target = lanePos + (lanePos <= 0 ? 0.5 : -0.5)
        w.x += (target - w.x) * Math.min(1, dt / 500)
      } else if (b.state === 'pass') {
        w.vz = Math.min(0.035, w.vz + dt * 0.00003)
        if (w.z > 30) {
          w.dead = true
          b.state = 'gone'
        }
      }
    }
    this.behinds = this.behinds.filter((b) => b.state !== 'gone')
  }

  private startTrain(e: ActiveEvent): void {
    e.trainStarted = true
    const img = this.add.image(0, 0, FX.train).setOrigin(0.5, 1)
    const from = Math.random() < 0.5 ? -1 : 1
    this.addWorld(img, from * 7, e.z + 0.9, 1 / 150, { vx: (-from * 14) / 900 })
    playSfx('whoosh')
  }

  private boltDeer(e: ActiveEvent): void {
    const h = e.hazard
    if (!h || e.bolted) return
    e.bolted = true
    const dir = h.x >= 0 ? 1 : -1
    if (h.obj instanceof Phaser.GameObjects.Image) h.obj.setFlipX(dir < 0)
    h.vx = dir * 0.006
    this.tweens.add({ targets: h, alphaMul: 0, duration: 650, delay: 150 })
  }

  private clearHazard(e: ActiveEvent, instant: boolean): void {
    const h = e.hazard
    const ev = e.ev
    if (!h || ev.kind !== 'action' || !ev.prop) return
    const prop = ev.prop
    if (prop === 'deer-on-road') {
      this.boltDeer(e)
      return
    }
    const info = PROP_INFO[prop]
    const onRoad = Math.abs(h.x) < 1.5
    if (instant && !onRoad) return
    const cleared = info?.clearedKey ?? (prop === 'traffic-light-yellow' ? propTextureKey('traffic-light-green') : undefined)
    if (cleared && this.textures.exists(cleared) && h.obj instanceof Phaser.GameObjects.Image) {
      // The people or cars that were in the way leave the scene instead of vanishing.
      if (!instant) {
        if (prop === 'pedestrian-crosswalk' || prop === 'blind-pedestrian') this.walkOff(h, prop === 'blind-pedestrian')
        else if (prop === 'funeral-procession' && h.baseKey) this.slideOff(h, h.baseKey)
      }
      h.obj.setTexture(cleared)
      h.baseKey = cleared
      h.flashKey = undefined
      if (!this.reduced && !instant) this.tweens.add({ targets: h.obj, scaleX: { from: h.obj.scaleX * 1.12, to: h.obj.scaleX }, duration: 260 })
      if (prop === 'school-bus-stopped') this.time.delayedCall(instant ? 0 : 350, () => this.driveOff(h))
      return
    }
    if (onRoad && !h.flat) {
      if (instant) this.tweens.add({ targets: h, alphaMul: 0, duration: 200 })
      else this.driveOff(h)
    }
  }

  /** The pedestrian finishes crossing: a standalone walker steps off to the right. */
  private walkOff(h: WorldObj, blind: boolean): void {
    const key = blind ? WALKER_BLIND_KEY : WALKER_KEY
    if (!this.textures.exists(key)) return
    const img = this.add.image(0, 0, key).setOrigin(0.5, 1)
    // Same art scale as the crosswalk; the figure stood at x = 140 (120 blind) of the 300 px texture.
    const offPx = (blind ? 120 : 140) - 150
    const w = this.addWorld(img, h.x + offPx * h.size, h.z - 0.01, h.size, { vx: blind ? 0.0007 : 0.001 })
    this.tweens.add({ targets: w, alphaMul: 0, duration: 700, delay: this.reduced ? 0 : 1100, onComplete: () => (w.dead = true) })
  }

  /** The procession rolls on through the intersection. */
  private slideOff(h: WorldObj, key: string): void {
    const img = this.add.image(0, 0, key).setOrigin(0.5, 1)
    const w = this.addWorld(img, h.x, h.z - 0.01, h.size, { vx: 0.0016 })
    this.tweens.add({ targets: w, alphaMul: 0, duration: 600, delay: this.reduced ? 0 : 600, onComplete: () => (w.dead = true) })
  }

  private driveOff(h: WorldObj): void {
    h.vz = 0.006
    this.tweens.add({ targets: h, alphaMul: 0, duration: 900, delay: 300 })
  }

  private spawnFinish(): void {
    const line: RoadLine = { z: Z_FAR, kind: 'finish' }
    this.finishLine = line
    this.lines.push(line)
    const TOP = -430
    const g = this.add.graphics()
    g.fillStyle(0x1e293b, 1)
    g.fillRect(-329, TOP, 22, -TOP)
    g.fillRect(307, TOP, 22, -TOP)
    g.fillStyle(0x0f172a, 1)
    g.fillRoundedRect(-340, TOP - 20, 680, 120, 14)
    for (let i = 0; i < 17; i++) {
      for (let r = 0; r < 2; r++) {
        g.fillStyle((i + r) % 2 === 0 ? 0xf8fafc : 0x0f172a, 1)
        g.fillRect(-340 + i * 40, TOP - 20 + r * 20, 40, 20)
      }
    }
    const t = this.add
      .text(0, TOP + 60, 'FINISH', { fontFamily: FONT, fontSize: '64px', fontStyle: '800', color: '#fbbf24' })
      .setOrigin(0.5, 0.5)
      .setResolution(this.labelResolution())
    this.addWorld(this.add.container(0, 0, [g, t]), 0, Z_FAR, 1 / 200)
    playSfx('whoosh')
  }

  // ---------- rendering ----------

  private carH(): number {
    return (this.car.height || 112) * this.carScale()
  }

  private carScale(): number {
    return (this.proj.laneW * 0.76) / this.carW
  }

  private carScreenX(): number {
    return this.proj.xOf(this.carPos.lane - 1, 1)
  }

  /**
   * Depth the car will still travel if the player holds BRAKE from this moment.
   * Simulates the same speed model as update() (GO is cancelled by braking).
   */
  private predictStopDistance(): number {
    let s = this.speed
    let b = this.boost
    let d = 0
    const step = 16
    for (let i = 0; i < 400 && s > 0; i++) {
      s = Math.max(0, s - step / BRAKE_MS)
      b += (1 - b) * Math.min(1, step / GO_RAMP_MS)
      d += this.V * s * b * step
    }
    return d
  }

  /** Braking guide for a live stop event: the green stop box and where the car would stop. */
  private stopGuide(): StopGuide | null {
    const e = this.cur
    if (!e || e.decided || e.ev.kind !== 'action' || e.ev.action !== 'stop' || e.stopState !== 'approach') return null
    if (e.z > GUIDE_SHOW_Z || this.phase !== 'drive') return null
    const zoneDepth = (this.director.slowRoll ? STOP_ZONE_Z : 6) - STOP_Z
    // The car's nose ends up STOP_Z in front of the camera; the line must still be ahead of it.
    const marker = STOP_Z + this.predictStopDistance()
    const boxTo = e.z
    const boxFrom = Math.max(STOP_Z, e.z - zoneDepth)
    const state: StopGuide['state'] = marker >= boxTo ? 'late' : marker >= boxFrom ? 'good' : 'early'
    const pulse = this.reduced ? 0.5 : 0.5 + 0.5 * Math.sin(this.flashPhase / 260)
    this.updateBrakeCue(e, state)
    return { boxFrom, boxTo, marker, state, pulse }
  }

  /** One short coaching line at the right moment; never clobbers other notes. */
  private updateBrakeCue(e: ActiveEvent, state: 'early' | 'good' | 'late'): void {
    const braking = this.brakeInput() || this.hold
    const cue: 'early' | 'now' | 'late' = braking || this.speed < 0.05 ? 'early' : state === 'good' ? 'now' : state
    if (cue === e.brakeCue) return
    const prevText = e.brakeCue === 'now' ? BRAKE_NOW_NOTE : e.brakeCue === 'late' ? BRAKE_LATE_NOTE : undefined
    e.brakeCue = cue
    if (e.note && e.note !== prevText) return
    e.note = cue === 'now' ? BRAKE_NOW_NOTE : cue === 'late' ? BRAKE_LATE_NOTE : undefined
    if (cue === 'now') vibrate(15, this.settings.haptics)
    this.bus.emit('prompt', this.promptFor(e))
  }

  private render(realDt: number): void {
    const p = this.proj
    const lanePos = this.carPos.lane - 1
    const carX = this.carScreenX()
    const bob = this.reduced ? 0 : Math.sin(this.visDist * 2.2) * p.dpr * 0.8 * this.speed
    // GO lunge: the car squats and pulls a touch forward (smaller = farther away).
    const lunge = this.lunge.v
    const carY = p.baseY + bob - lunge * p.laneW * 0.05
    const carS = this.carScale() * (1 - lunge * 0.035)
    this.car.setPosition(carX, carY).setScale(carS)
    this.car.setAngle(this.carPos.tilt)

    this.road.draw(this.visDist, this.lines, { x: carX, y: p.baseY - 2, w: this.carW * carS * 1.05 }, this.stopGuide())

    // Brake lights.
    const fx = this.carFx
    fx.clear()
    const braking = this.speed < 0.999 && (this.hold || this.brakeInput()) && this.phase !== 'countdown'
    if (braking) {
      const cw = this.carW * carS
      const ch = this.carH()
      for (const sx of [-0.34, 0.34]) {
        fx.fillStyle(0xff1744, 0.35)
        fx.fillCircle(carX + sx * cw, carY - ch * 0.42, cw * 0.11)
        fx.fillStyle(0xff5252, 0.95)
        fx.fillCircle(carX + sx * cw, carY - ch * 0.42, cw * 0.05)
      }
    }

    // World objects.
    // Slow roll keeps flashing lights slow and soft so the scene stays calm.
    const calm = this.director.slowRoll
    const flashOn = !this.reduced && Math.floor(this.flashPhase / (calm ? 700 : 350)) % 2 === 1
    for (const o of this.world) this.place(o, lanePos, flashOn)

    // Emergency lights glow on top of the vehicle behind.
    this.sirenG.clear()
    for (const b of this.behinds) {
      if (b.mode !== 'emergency' || b.state !== 'approach' || b.w.dead) continue
      const z = b.w.z
      const x = p.xOf(b.w.x, z)
      const top = p.yOf(z) - ((b.w.obj.height || 140) * b.w.size * p.laneW) / z
      const r = p.lanePx(z) * 0.07
      const phase = this.reduced ? 0 : Math.floor(this.flashPhase / (calm ? 450 : 160)) % 2
      const glow = calm ? 0.4 : 0.55
      this.sirenG.fillStyle(phase === 0 ? 0xff1744 : 0x3b82f6, glow)
      this.sirenG.fillCircle(x - r * 1.2, top + r * 0.6, r * 1.4)
      this.sirenG.fillStyle(phase === 0 ? 0x3b82f6 : 0xff1744, glow)
      this.sirenG.fillCircle(x + r * 1.2, top + r * 0.6, r * 1.4)
    }

    // Trail follows the car.
    this.trail?.setPosition(carX, carY - this.carH() * 0.15)
    if (this.trail) {
      const on = this.speed > 0.25 && (this.phase === 'drive' || this.phase === 'ending')
      if (on && !this.trail.emitting) this.trail.start()
      else if (!on && this.trail.emitting) this.trail.stop()
    }

    this.weather.follow(carX)
    this.drawSpeedLines(realDt)
  }

  private place(o: WorldObj, carLanePos: number, flashOn: boolean): void {
    const p = this.proj
    const z = o.z
    if (o.dead || z < 0.4 || z > Z_DRAW) {
      o.obj.setVisible(false)
      return
    }
    const s = (o.size * p.laneW) / z
    o.obj.setVisible(true)
    o.obj.setPosition(p.xOf(o.x, z), p.yOf(z) - (o.lift * p.laneW) / z)
    o.obj.setScale(s)
    o.obj.setDepth(o.flat ? 100 - z : 1000 - z * 10)
    let a = clamp01((Z_FAR + 3 - z) / 6) * o.alphaMul
    if (o.fadeInLane && z < 1.9 && Math.abs(o.x - carLanePos) < 0.65) a *= 0.3
    o.obj.setAlpha(a)
    if (o.flashKey && o.baseKey && o.obj instanceof Phaser.GameObjects.Image) {
      const want = flashOn ? o.flashKey : o.baseKey
      if (o.obj.texture.key !== want) o.obj.setTexture(want)
    }
  }

  /** Envelope of the GO spin-up: quick rise, longer fade (0..1). */
  private goFxLevel(): number {
    if (this.goFxMs <= 0) return 0
    const t = 1 - this.goFxMs / GO_FX_MS
    return t < 0.15 ? t / 0.15 : Math.max(0, 1 - (t - 0.15) / 0.85)
  }

  /** Radial speed lines: a short burst when GO kicks in, and during NITRO. */
  private drawSpeedLines(realDt: number): void {
    const g = this.speedLines
    g.clear()
    if (this.reduced || this.frozen) return
    const go = this.goFxLevel()
    // NITRO is a reward, but in slow roll it stays soft.
    const nitro = this.nitroMs > 0 ? Math.min(1, this.nitroMs / 600) * (this.director.slowRoll ? 0.55 : 1) : 0
    const level = Math.max(go, nitro)
    if (level <= 0.01) return
    const p = this.proj
    const cx = p.vpX
    const cy = p.horizonY
    const maxR = Math.hypot(p.W, p.H)
    const goWins = go >= nitro
    const color = goWins ? 0xdcfce7 : 0xe9d5ff
    const rate = goWins ? 3.2 : 1.8
    g.lineStyle(Math.max(2, p.dpr * 2.5), color, 0.6 * level)
    for (const s of this.speedLineSeeds) {
      s.r += (realDt / 1000) * s.v * rate
      if (s.r > 1) {
        s.r = 0.15
        s.a = Math.random() * Math.PI * 2
      }
      // Keep the lines off the middle of the road ahead so gate labels stay clear.
      const sa = Math.sin(s.a)
      if (sa < -0.15 && Math.abs(Math.cos(s.a)) < 0.5) continue
      const r0 = s.r * maxR
      const r1 = r0 + maxR * (goWins ? 0.16 : 0.12)
      const ca = Math.cos(s.a)
      g.lineBetween(cx + ca * r0, cy + sa * r0, cx + ca * r1, cy + sa * r1)
    }
  }

  // ---------- juice helpers ----------

  private setTrail(color: string): void {
    this.trailColor = color
    this.trail?.destroy()
    this.trail = undefined
    if (!color) return
    const tints =
      color === 'rainbow'
        ? [0xef4444, 0xf97316, 0xfacc15, 0x22c55e, 0x38bdf8, 0x8b5cf6]
        : [Phaser.Display.Color.HexStringToColor(color).color]
    const p = this.proj
    this.trail = this.add.particles(0, 0, FX.dot, {
      speedY: { onEmit: () => (160 + Math.random() * 80) * p.dpr },
      speedX: { onEmit: () => (Math.random() - 0.5) * 50 * p.dpr },
      lifespan: 420,
      scale: { start: 0.9 * p.dpr, end: 0 },
      alpha: { start: 0.85, end: 0 },
      tint: tints,
      frequency: 28,
      quantity: 1,
      emitting: false,
    })
    this.trail.setDepth(989)
  }

  private sparkle(): void {
    if (this.reduced) return
    const x = this.carScreenX()
    const y = this.proj.baseY - this.carH() * 0.5
    this.sparks.explode(36, x, y)
  }

  private floatText(text: string, x: number, y: number, color: string, delay: number): void {
    const size = Math.round(Math.max(22, this.proj.laneW * 0.3))
    const t = this.add
      .text(x, y, text, {
        fontFamily: FONT,
        fontSize: `${size}px`,
        fontStyle: '800',
        color,
        stroke: '#0b1020',
        strokeThickness: Math.max(4, size / 7),
      })
      .setOrigin(0.5, 1)
      .setDepth(3000)
      .setAlpha(0)
    const rise = this.reduced ? 0 : this.proj.laneW * 0.55
    this.tweens.add({
      targets: t,
      alpha: { from: 1, to: 0 },
      y: y - rise,
      scale: this.reduced ? 1 : { from: 0.7, to: 1.1 },
      delay,
      duration: 950,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    })
  }

  private banner(text: string, sub: string | undefined, tone: 'streak' | 'nitro' | 'good' | 'info' | 'finish', durationMs: number): void {
    this.bus.emit('banner', { id: ++this.bannerSeq, text, sub, tone, durationMs })
  }

  // ---------- HUD messages ----------

  private promptFor(e: ActiveEvent): PromptInfo {
    const ev = e.ev
    const base: PromptInfo = {
      key: e.key,
      eventId: ev.id,
      kind: ev.kind,
      text: ev.prompt ?? '',
      image: eventImage(ev),
      isRequeue: e.q.isRequeue,
      status: e.decided ? (e.correct ? 'correct' : 'miss') : 'live',
      note: e.note,
    }
    if (ev.kind === 'gates') {
      const lane = (l: number) => ({
        label: ev.choices[e.laneChoice[l]] ?? '',
        removed: e.removedLane === l,
        correct: e.decided ? l === e.correctLane : undefined,
      })
      return { ...base, lanes: [lane(0), lane(1), lane(2)] }
    }
    return { ...base, prop: ev.prop, emoji: propEmoji(ev), weather: ev.weather, action: ev.action }
  }

  private replayFor(e: ActiveEvent, res: Resolution): ReplayInfo {
    const ev = e.ev
    return {
      key: e.key,
      image: eventImage(ev),
      propEmoji: propEmoji(ev),
      prompt: ev.prompt ?? '',
      correctText: correctText(ev),
      controlHint: ev.kind === 'action' ? ACTION_CONTROLS[ev.action] : undefined,
      missLine: ev.missLine ?? '',
      encouragement: pickLine(story.missLines),
      livesLeft: this.director.survival ? this.director.livesLeft : undefined,
      streakSaved: res.streakSaved,
    }
  }

  /** Seconds until the live gate or hazard reaches the car at the current speed. */
  private etaSec(): number | undefined {
    const e = this.cur
    // Pull over: the siren has its own short window.
    const b = e && !e.decided && e.ev.kind === 'action' && e.ev.action === 'pull-over' ? e.behind : undefined
    if (b && b.state === 'approach') return Math.max(0, Math.ceil((b.windowMs - b.t) / 1000))
    const zTarget = e && !e.decided ? e.z : this.finishLine ? this.finishLine.z : undefined
    if (zTarget === undefined) return undefined
    // Measured at cruise speed so the number stays steady while braking or stopped.
    const rate = this.V * this.boost // z per ms
    if (rate <= 0) return undefined
    return Math.max(0, Math.round((zTarget - GATE_Z) / rate / 1000))
  }

  /** Speedometer reading: calm cruise, rising toward the GO top speed as the boost spins up. */
  private mph(): number {
    const d = this.director
    const lo = d.slowRoll ? CRUISE_MPH : TIMED_CRUISE_MPH
    const hi = d.slowRoll ? GO_MPH : TIMED_GO_MPH
    const t = clamp01((this.boost - 1) / Math.max(0.001, d.goMultiplier - 1))
    return Math.round(this.speed * (lo + (hi - lo) * t))
  }

  private emitHud(): void {
    const d = this.director
    const e = this.cur
    const plan = this.cfg.plan
    const finite = !d.endless
    const done = d.outcomes.length
    const total = Math.max(d.total, done)
    let ghostDelta: number | undefined
    if (plan.ghostScore !== undefined && finite && total > 0) {
      ghostDelta = d.score - Math.round(plan.ghostScore * (done / total))
    }
    const gatesLive = !!e && !e.decided && e.ev.kind === 'gates'
    const hud: HudState = {
      phase: this.phase,
      mode: plan.mode,
      score: d.score,
      streak: d.streak,
      mult: multiplierFor(d.streak),
      progress: finite ? { done, total } : undefined,
      timeLeftMs: d.timed ? Math.max(0, this.timeLeftMs) : undefined,
      timeTotalMs: d.timed ? d.timeLimitMs : undefined,
      lives: d.survival ? { left: d.livesLeft, max: d.maxMisses } : undefined,
      ghostDelta,
      speed: this.speed,
      mph: this.mph(),
      going: this.goMode,
      goAvailable: this.canGo(),
      finishAhead: this.phase === 'drive' && !!this.finishLine && !this.cur,
      etaSec: this.etaSec(),
      slowRoll: d.slowRoll,
      braking: this.phase === 'drive' && this.brakeInput(),
      lane: this.lane,
      perks: {
        flare: d.perks.has('hint-flare')
          ? { charges: d.flareCharges, usable: gatesLive && e!.removedLane === null && d.flareCharges > 0 && this.phase === 'drive' }
          : undefined,
        slowMo:
          d.perks.has('slow-mo') || d.slowMoCharges > 0
            ? { charges: d.slowMoCharges, usable: !!e && !e.decided && !this.slowMo && d.slowMoCharges > 0 && this.phase === 'drive', active: this.slowMo }
            : undefined,
        secondChance: d.perks.has('second-chance') ? (d.secondChanceReady ? 'ready' : 'used') : undefined,
        radar: d.perks.has('radar') || undefined,
      },
      nitro: this.nitroMs > 0,
      siren: this.behinds.some((b) => b.mode === 'emergency' && b.state === 'approach'),
      slowMo: this.slowMo,
    }
    this.bus.emit('hud', hud)
  }
}
