// Daily and weekly contracts. Generated from a date seed and the learner's weak spots.
import { mulberry32, hashString, shuffle } from './rng'
import type { RunMode, RunResult } from './run'
import type { DistrictId } from './types'

export type ContractMetric =
  | 'runs' // finish N runs (any mode or a given mode)
  | 'streak' // reach a streak of N in one run
  | 'correct' // N correct answers (optionally in a district)
  | 'signs' // N correct sign answers
  | 'numbers' // N correct number answers
  | 'medals' // earn N medals
  | 'boss' // clear N bosses
  | 'days' // play on N different days this week
  | 'perfect' // N runs with zero misses

export interface Contract {
  id: string
  title: string
  metric: ContractMetric
  goal: number
  progress: number
  mode?: RunMode
  district?: DistrictId
  rewardXp: number
  done: boolean
  claimed: boolean
}

export interface ContractContext {
  weakDistricts: DistrictId[] // weakest unlocked districts first
  districtName: (d: DistrictId) => string
  unlockedModes: RunMode[]
}

type Template = (rng: () => number, ctx: ContractContext) => Omit<Contract, 'id' | 'progress' | 'done' | 'claimed'> | null

const DAILY: Template[] = [
  () => ({ title: 'Hit a 6 streak in any run', metric: 'streak', goal: 6, rewardXp: 60 }),
  () => ({ title: 'Finish 2 runs', metric: 'runs', goal: 2, rewardXp: 50 }),
  (_r, c) =>
    c.weakDistricts[0]
      ? {
          title: `Get 10 right in ${c.districtName(c.weakDistricts[0])}`,
          metric: 'correct',
          goal: 10,
          district: c.weakDistricts[0],
          rewardXp: 80,
        }
      : null,
  () => ({ title: 'Read 12 signs correctly', metric: 'signs', goal: 12, rewardXp: 70 }),
  (_r, c) =>
    c.unlockedModes.includes('sniper')
      ? { title: 'Finish a Sign Sniper run', metric: 'runs', goal: 1, mode: 'sniper', rewardXp: 60 }
      : null,
  (_r, c) =>
    c.unlockedModes.includes('numbers')
      ? { title: 'Nail 6 number facts', metric: 'numbers', goal: 6, rewardXp: 70 }
      : null,
  (_r, c) =>
    c.unlockedModes.includes('replay')
      ? { title: 'Clear a Replay Range run', metric: 'runs', goal: 1, mode: 'replay', rewardXp: 60 }
      : null,
  () => ({ title: 'Earn 2 medals', metric: 'medals', goal: 2, rewardXp: 60 }),
  () => ({ title: 'Answer 30 correctly', metric: 'correct', goal: 30, rewardXp: 80 }),
]

const WEEKLY: Template[] = [
  () => ({ title: 'Play on 4 different days', metric: 'days', goal: 4, rewardXp: 300 }),
  () => ({ title: 'Clear a district boss', metric: 'boss', goal: 1, rewardXp: 250 }),
  () => ({ title: 'Earn 8 medals', metric: 'medals', goal: 8, rewardXp: 250 }),
  () => ({ title: 'Finish 3 flawless runs', metric: 'perfect', goal: 3, rewardXp: 300 }),
  () => ({ title: 'Hit a 15 streak', metric: 'streak', goal: 15, rewardXp: 250 }),
  () => ({ title: 'Read 60 signs correctly', metric: 'signs', goal: 60, rewardXp: 300 }),
]

function generate(templates: Template[], seedKey: string, count: number, ctx: ContractContext): Contract[] {
  const rng = mulberry32(hashString(seedKey))
  const out: Contract[] = []
  for (const t of shuffle(templates, rng)) {
    if (out.length >= count) break
    const c = t(rng, ctx)
    if (!c) continue
    out.push({ ...c, id: `${seedKey}:${out.length}`, progress: 0, done: false, claimed: false })
  }
  return out
}

export function dailyContracts(day: string, ctx: ContractContext): Contract[] {
  return generate(DAILY, `daily:${day}`, 3, ctx)
}

export function weeklyContracts(week: string, ctx: ContractContext): Contract[] {
  return generate(WEEKLY, `weekly:${week}`, 3, ctx)
}

export interface RunFacts {
  result: RunResult
  correctByDistrict: Map<DistrictId, number>
  signCorrect: number
  numberCorrect: number
  medals: number
  bossCleared: boolean
  newPlayDay: boolean
}

/** Returns updated contract (new object) after a run or boss. */
export function advanceContract(c: Contract, f: RunFacts): Contract {
  if (c.done) return c
  let p = c.progress
  const o = f.result.outcomes
  switch (c.metric) {
    case 'runs':
      if (f.result.completed && (!c.mode || c.mode === f.result.plan.mode)) p += 1
      break
    case 'streak':
      p = Math.max(p, f.result.maxStreak)
      break
    case 'correct':
      p += c.district ? (f.correctByDistrict.get(c.district) ?? 0) : o.filter((x) => x.correct).length
      break
    case 'signs':
      p += f.signCorrect
      break
    case 'numbers':
      p += f.numberCorrect
      break
    case 'medals':
      p += f.medals
      break
    case 'boss':
      if (f.bossCleared) p += 1
      break
    case 'days':
      if (f.newPlayDay) p += 1
      break
    case 'perfect':
      if (f.result.completed && o.length >= 8 && o.every((x) => x.correct)) p += 1
      break
  }
  p = Math.min(p, c.goal)
  return { ...c, progress: p, done: p >= c.goal }
}
