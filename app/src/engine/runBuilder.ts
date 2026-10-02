// Builds the queue of road events for every mode.
import {
  allEvents,
  allItems,
  districtById,
  eventsByItem,
  isSignItem,
  itemById,
  itemsIn,
  missionItems,
} from './content'
import { mulberry32, hashString, shuffle, type Rng, defaultRng } from './rng'
import { isDue, isMastered, reviewPriority, type ItemState } from './scheduler'
import type { RunPlan } from './run'
import type { DistrictId, GameEvent, Item } from './types'

type States = Record<string, ItemState>

export interface BuildCtx {
  states: States
  today: string
  unlocked: DistrictId[]
  rng?: Rng
}

/** Pick an event for an item, preferring kinds/ids not in `avoid`. */
export function pickEventFor(itemId: string, rng: Rng, avoid: Set<string> = new Set(), preferKind?: GameEvent['kind']): GameEvent | undefined {
  const evs = eventsByItem.get(itemId) ?? []
  if (!evs.length) return undefined
  const fresh = evs.filter((e) => !avoid.has(e.id))
  const pool = fresh.length ? fresh : evs
  const kindPool = preferKind ? pool.filter((e) => e.kind === preferKind) : []
  const final = kindPool.length ? kindPool : pool
  return final[Math.floor(rng() * final.length)]
}

/** A different event for the same item, used to re-test a miss later in the run. */
export function requeueEventFor(itemId: string, missedEventId: string, rng: Rng = defaultRng): GameEvent | undefined {
  return pickEventFor(itemId, rng, new Set([missedEventId]))
}

/**
 * Space events so the same item never appears twice within `gap` slots when avoidable.
 */
export function spaceOut(events: GameEvent[], gap = 3): GameEvent[] {
  const out: GameEvent[] = []
  const pending = events.slice()
  while (pending.length) {
    const recent = new Set(out.slice(-gap).map((e) => e.item))
    const idx = pending.findIndex((e) => !recent.has(e.item))
    out.push(pending.splice(idx === -1 ? 0 : idx, 1)[0])
  }
  return out
}

function dueItems(ctx: BuildCtx, filter: (i: Item) => boolean = () => true): Item[] {
  return allItems
    .filter((i) => filter(i) && ctx.unlocked.includes(i.district) && isDue(ctx.states[i.id], ctx.today))
    .sort((a, b) => reviewPriority(ctx.states[a.id], ctx.today) - reviewPriority(ctx.states[b.id], ctx.today))
}

function masteredItems(ctx: BuildCtx): Item[] {
  return allItems.filter((i) => ctx.unlocked.includes(i.district) && isMastered(ctx.states[i.id], isSignItem(i)))
}

/** Items in unlocked districts the player has never seen, in campaign order. */
function unseenItems(ctx: BuildCtx): Item[] {
  return allItems.filter((i) => ctx.unlocked.includes(i.district) && !ctx.states[i.id]?.seen)
}

export function buildMission(district: DistrictId, missionIndex: number, ctx: BuildCtx, opts: { ghost?: number } = {}): RunPlan {
  const key = `mission:${district}:${missionIndex}`
  // Ghost races replay the same seed so the road is the same as your best run.
  const rng = opts.ghost !== undefined ? mulberry32(hashString(key)) : (ctx.rng ?? defaultRng)
  const items = missionItems(district, missionIndex)
  const used = new Set<string>()

  // Two looks at every mission item: one early, one later. Prefer an action event
  // for the second look so the rule becomes something you do.
  const firstPass: GameEvent[] = []
  const secondPass: GameEvent[] = []
  for (const it of items) {
    const a = pickEventFor(it.id, rng, used, 'gates')
    if (a) {
      used.add(a.id)
      firstPass.push(a)
    }
    const b = pickEventFor(it.id, rng, used, 'action')
    if (b) {
      used.add(b.id)
      secondPass.push(b)
    }
  }

  // Review: due items from anywhere unlocked (not this mission), then a couple of
  // mastered items to keep them alive.
  const missionIds = new Set(items.map((i) => i.id))
  const review = dueItems(ctx, (i) => !missionIds.has(i.id)).slice(0, 4)
  const keepAlive = shuffle(masteredItems(ctx).filter((i) => !missionIds.has(i.id)), rng).slice(0, 2)
  const reviewEvents = [...review, ...keepAlive]
    .map((i) => pickEventFor(i.id, rng, used))
    .filter((e): e is GameEvent => !!e)

  const half = Math.ceil(reviewEvents.length / 2)
  const events = spaceOut([
    ...shuffle([...firstPass, ...reviewEvents.slice(0, half)], rng),
    ...shuffle([...secondPass, ...reviewEvents.slice(half)], rng),
  ])
  const d = districtById.get(district)
  return {
    mode: opts.ghost !== undefined ? 'ghost' : 'mission',
    key,
    title: `${d?.name ?? district} · Mission ${missionIndex + 1}`,
    district,
    missionIndex,
    events,
    ramp: 0,
    perksAllowed: true,
    ghostScore: opts.ghost,
    newItemIds: items.filter((i) => !ctx.states[i.id]?.seen).map((i) => i.id),
  }
}

export function buildQuick(ctx: BuildCtx, size = 14): RunPlan {
  const rng = ctx.rng ?? defaultRng
  const due = dueItems(ctx).slice(0, size - 3)
  const fresh = unseenItems(ctx).slice(0, Math.max(2, size - due.length - 2))
  const alive = shuffle(masteredItems(ctx), rng).slice(0, 2)
  let items = [...due, ...fresh, ...alive]
  if (items.length < size) {
    // Early game: fill with anything seen in unlocked districts.
    const seen = allItems.filter((i) => ctx.unlocked.includes(i.district) && ctx.states[i.id]?.seen && !items.includes(i))
    items = [...items, ...shuffle(seen, rng).slice(0, size - items.length)]
  }
  const used = new Set<string>()
  const events = items
    .map((i) => {
      const e = pickEventFor(i.id, rng, used)
      if (e) used.add(e.id)
      return e
    })
    .filter((e): e is GameEvent => !!e)
  return {
    mode: 'quick',
    key: 'quick',
    title: 'Quick Play',
    events: spaceOut(shuffle(events, rng)),
    ramp: 0,
    perksAllowed: true,
    newItemIds: fresh.map((i) => i.id),
  }
}

function signGateEvents(ctx: BuildCtx): GameEvent[] {
  return allEvents.filter((e) => {
    const it = itemById.get(e.item)
    return !!it && e.kind === 'gates' && !!e.image && isSignItem(it) && ctx.unlocked.includes(it.district)
  })
}

export function buildSniper(ctx: BuildCtx): RunPlan {
  const rng = ctx.rng ?? defaultRng
  const pool = shuffle(signGateEvents(ctx), rng)
  return {
    mode: 'sniper',
    key: 'sniper',
    title: 'Sign Sniper',
    events: spaceOut(pool.slice(0, 12)),
    pool,
    timeLimitSec: 90,
    ramp: 0.06,
    perksAllowed: true,
    newItemIds: [],
  }
}

export function buildHazard(ctx: BuildCtx): RunPlan {
  const rng = ctx.rng ?? defaultRng
  const pool = shuffle(
    allEvents.filter((e) => {
      const it = itemById.get(e.item)
      return !!it && ctx.unlocked.includes(it.district) && !!ctx.states[it.id]?.seen
    }),
    rng,
  )
  // Bias toward action events: this is a survival drive.
  const actions = pool.filter((e) => e.kind === 'action')
  const gates = pool.filter((e) => e.kind === 'gates')
  const mixed = spaceOut([...actions.slice(0, 8), ...gates.slice(0, 4)].sort(() => rng() - 0.5))
  return {
    mode: 'hazard',
    key: 'hazard',
    title: 'Hazard Rush',
    events: mixed,
    pool: [...actions, ...gates],
    maxMisses: 3,
    ramp: 0.04,
    perksAllowed: true,
    newItemIds: [],
  }
}

export function buildNumbers(ctx: BuildCtx): RunPlan {
  const rng = ctx.rng ?? defaultRng
  const pool = shuffle(
    allEvents.filter((e) => {
      const it = itemById.get(e.item)
      return !!it && it.kind === 'number' && e.kind === 'gates' && ctx.unlocked.includes(it.district)
    }),
    rng,
  )
  return {
    mode: 'numbers',
    key: 'numbers',
    title: 'Numbers Garage',
    events: spaceOut(pool.slice(0, 12)),
    pool,
    timeLimitSec: 120,
    ramp: 0.03,
    perksAllowed: true,
    newItemIds: [],
  }
}

/** Items missed recently (most recent first). */
export function recentMissItems(states: States, limit = 10): Item[] {
  return Object.entries(states)
    .filter(([, s]) => s.recentMissAt > 0 && s.lastResult === 'wrong')
    .sort((a, b) => b[1].recentMissAt - a[1].recentMissAt)
    .map(([id]) => itemById.get(id))
    .filter((i): i is Item => !!i)
    .slice(0, limit)
}

export function buildReplay(ctx: BuildCtx): RunPlan {
  const rng = ctx.rng ?? defaultRng
  const items = recentMissItems(ctx.states)
  const used = new Set<string>()
  const events: GameEvent[] = []
  for (const it of items) {
    for (let k = 0; k < 2; k++) {
      const e = pickEventFor(it.id, rng, used)
      if (e) {
        used.add(e.id)
        events.push(e)
      }
    }
  }
  return {
    mode: 'replay',
    key: 'replay',
    title: 'Replay Range',
    events: spaceOut(shuffle(events, rng)),
    ramp: 0,
    perksAllowed: true,
    newItemIds: [],
  }
}

/** Any district item ids that have content (for UI listing). */
export function districtHasEvents(d: DistrictId): boolean {
  return itemsIn(d).some((i) => (eventsByItem.get(i.id) ?? []).length > 0)
}
