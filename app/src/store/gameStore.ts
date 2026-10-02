// Persistent player state. Everything lives in localStorage; Export/Import JSON
// lets the learner move a save between devices.
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { campaignDistricts, districtById, eventById, isSignItem, itemById, missionCount, districts } from '../engine/content'
import { advanceContract, dailyContracts, weeklyContracts, type Contract, type ContractContext } from '../engine/contracts'
import { gradeExam, type ExamRecord, type ExamResult } from '../engine/exam'
import { COSMETICS, DEFAULT_EQUIPPED, MAX_EQUIPPED_PERKS, PERKS, type CosmeticSlot } from '../engine/loadout'
import { awardMedals } from '../engine/medals'
import { MODE_UNLOCK_RANK, rankForXp, seasonTier } from '../engine/ranks'
import { districtStars, weakestDistricts } from '../engine/readiness'
import { dayKey, weekKey } from '../engine/rng'
import type { EventOutcome, PerkId, RunMode, RunResult } from '../engine/run'
import { xpForRun } from '../engine/run'
import { review, type ItemState } from '../engine/scheduler'
import type { DistrictId } from '../engine/types'
import type { ExamAnswer, ExamPaper } from '../engine/exam'

export type ReadAloudMode = 'off' | 'tap' | 'auto'

export interface Settings {
  reactionScale: number // 1 = normal, up to 2 = twice the time
  reducedMotion: boolean
  readAloud: ReadAloudMode
  bigText: boolean
  highContrast: boolean
  font: 'lexend' | 'system'
  volume: number // 0..1
  muted: boolean
  haptics: boolean
  breakReminderMin: number // 0 = off
  voiceRate: number // speech rate 0.7..1.2
}

export const DEFAULT_SETTINGS: Settings = {
  reactionScale: 1.25,
  reducedMotion: false,
  readAloud: 'tap',
  bigText: false,
  highContrast: false,
  font: 'lexend',
  volume: 0.7,
  muted: false,
  haptics: true,
  breakReminderMin: 20,
  voiceRate: 0.95,
}

export interface Stats {
  runs: number
  correct: number
  wrong: number
  bestStreak: number
  timePlayedMs: number
}

export interface RunSummary {
  xpGained: number
  rankBefore: number
  rankAfter: number
  medals: string[]
  newCosmetics: string[]
  seasonTierBefore: number
  seasonTierAfter: number
  newBest: boolean
  previousBest: number
  missionCleared: boolean
  districtUnlocked?: DistrictId
  contractsCompleted: Contract[]
  misses: EventOutcome[] // one per missed item
  correct: number
  total: number
}

export interface ExamSummary {
  result: ExamResult
  xpGained: number
  rankBefore: number
  rankAfter: number
  bossNewlyCleared: boolean
  newCosmetics: string[]
  examReadyDays: number
}

export interface GameState {
  version: 1
  playerName: string
  createdAt: number
  items: Record<string, ItemState>
  xp: number
  prestige: number
  seasonXp: number
  missionsCleared: Partial<Record<DistrictId, number[]>>
  bossesCleared: DistrictId[]
  starsMax: Partial<Record<DistrictId, number>>
  medals: Record<string, number>
  owned: string[]
  equipped: Record<CosmeticSlot, string>
  perksEquipped: PerkId[]
  bestScores: Record<string, number>
  stats: Stats
  playDays: string[]
  contracts: { day: string; daily: Contract[]; week: string; weekly: Contract[] }
  examHistory: ExamRecord[]
  settings: Settings
  briefedItems: string[] // items whose intro card has been shown
  seenIntro: boolean
}

interface Actions {
  setName: (name: string) => void
  recordRun: (result: RunResult) => RunSummary
  recordExam: (paper: ExamPaper, answers: ExamAnswer[]) => ExamSummary
  markBriefed: (ids: string[]) => void
  equip: (slot: CosmeticSlot, id: string) => void
  togglePerk: (id: PerkId) => void
  claimContract: (id: string) => number
  refreshContracts: () => void
  updateSettings: (patch: Partial<Settings>) => void
  setSeenIntro: () => void
  doPrestige: () => boolean
  exportSave: () => string
  importSave: (json: string) => { ok: boolean; error?: string }
  resetAll: () => void
}

export type Store = GameState & Actions

function initialState(): GameState {
  return {
    version: 1,
    playerName: '',
    createdAt: Date.now(),
    items: {},
    xp: 0,
    prestige: 0,
    seasonXp: 0,
    missionsCleared: {},
    bossesCleared: [],
    starsMax: {},
    medals: {},
    owned: COSMETICS.filter((c) => c.source.kind === 'default').map((c) => c.id),
    equipped: { ...DEFAULT_EQUIPPED },
    perksEquipped: [],
    bestScores: {},
    stats: { runs: 0, correct: 0, wrong: 0, bestStreak: 0, timePlayedMs: 0 },
    playDays: [],
    contracts: { day: '', daily: [], week: '', weekly: [] },
    examHistory: [],
    settings: { ...DEFAULT_SETTINGS },
    briefedItems: [],
    seenIntro: false,
  }
}

// ---------- selectors (pure functions of state) ----------

export function isDistrictComplete(s: Pick<GameState, 'missionsCleared'>, d: DistrictId): boolean {
  const n = missionCount(d)
  if (n === 0) return true
  const cleared = s.missionsCleared[d] ?? []
  return cleared.length >= n
}

/** Districts unlock in order: the next opens when every mission in the previous is cleared. */
export function unlockedDistricts(s: Pick<GameState, 'missionsCleared'>): DistrictId[] {
  const out: DistrictId[] = []
  for (const d of campaignDistricts) {
    out.push(d.id)
    if (!isDistrictComplete(s, d.id)) break
  }
  return out
}

export function isExamDayUnlocked(s: Pick<GameState, 'missionsCleared'>): boolean {
  return campaignDistricts.every((d) => isDistrictComplete(s, d.id))
}

/** Sign-only practice test opens once every sign district (1-6) is complete. */
export function isSignTestUnlocked(s: Pick<GameState, 'missionsCleared'>): boolean {
  return campaignDistricts.filter((d) => d.order <= 6).every((d) => isDistrictComplete(s, d.id))
}

export function rankOf(s: Pick<GameState, 'xp'>): number {
  return rankForXp(s.xp)
}

export function hasAnyMiss(s: Pick<GameState, 'items'>): boolean {
  return Object.values(s.items).some((i) => i.lastResult === 'wrong')
}

export function hasClearedMission(s: Pick<GameState, 'missionsCleared'>): boolean {
  return Object.values(s.missionsCleared).some((m) => (m?.length ?? 0) > 0)
}

export function isModeUnlocked(s: GameState, mode: RunMode): boolean {
  const rank = rankOf(s)
  if (rank < MODE_UNLOCK_RANK[mode]) return false
  if (mode === 'replay') return hasAnyMiss(s)
  if (mode === 'ghost') return hasClearedMission(s)
  return true
}

export function unlockedModes(s: GameState): RunMode[] {
  return (['mission', 'quick', 'sniper', 'hazard', 'numbers', 'replay', 'ghost'] as RunMode[]).filter((m) => isModeUnlocked(s, m))
}

export function ownedPerks(s: Pick<GameState, 'starsMax'>): PerkId[] {
  return PERKS.filter((p) => (s.starsMax[p.unlock.district] ?? 0) >= p.unlock.stars).map((p) => p.id)
}

function contractCtx(s: GameState): ContractContext {
  return {
    weakDistricts: weakestDistricts(s.items, unlockedDistricts(s)),
    districtName: (d) => districtById.get(d)?.short ?? d,
    unlockedModes: unlockedModes(s),
  }
}

function withFreshContracts(s: GameState): GameState['contracts'] {
  const day = dayKey()
  const week = weekKey()
  const c = s.contracts
  const ctx = contractCtx(s)
  return {
    day,
    daily: c.day === day ? c.daily : dailyContracts(day, ctx),
    week,
    weekly: c.week === week ? c.weekly : weeklyContracts(week, ctx),
  }
}

function cosmeticUnlocked(s: GameState, id: string): boolean {
  const c = COSMETICS.find((x) => x.id === id)
  if (!c) return false
  const src = c.source
  switch (src.kind) {
    case 'default':
      return true
    case 'season':
      return seasonTier(s.seasonXp) >= src.tier
    case 'boss':
      return s.bossesCleared.includes(src.district)
    case 'rank':
      return rankOf(s) >= src.rank
    case 'medal':
      return (s.medals[src.medal] ?? 0) > 0
  }
}

function grantCosmetics(s: GameState): { owned: string[]; fresh: string[] } {
  const owned = new Set(s.owned)
  const fresh: string[] = []
  for (const c of COSMETICS) {
    if (!owned.has(c.id) && cosmeticUnlocked(s, c.id)) {
      owned.add(c.id)
      fresh.push(c.id)
    }
  }
  return { owned: [...owned], fresh }
}

function updateStars(s: GameState): GameState['starsMax'] {
  const next = { ...s.starsMax }
  for (const d of districts) {
    const stars = districtStars(d.id, s.items)
    next[d.id] = Math.max(next[d.id] ?? 0, stars)
  }
  return next
}

export const useGame = create<Store>()(
  persist(
    (set, get) => ({
      ...initialState(),

      setName: (name) => set({ playerName: name.slice(0, 24) }),

      setSeenIntro: () => set({ seenIntro: true }),

      markBriefed: (ids) => set((s) => ({ briefedItems: [...new Set([...s.briefedItems, ...ids])] })),

      recordRun: (result) => {
        const s0 = get()
        const today = dayKey()
        const now = Date.now()
        const rankBefore = rankOf(s0)
        const tierBefore = seasonTier(s0.seasonXp)

        // 1. Scheduler updates, in order.
        const items = { ...s0.items }
        for (const o of result.outcomes) {
          const it = itemById.get(o.itemId)
          items[o.itemId] = review(items[o.itemId], o.correct, today, { isSign: it ? isSignItem(it) : false, now })
        }

        // 2. Medals.
        const weatherIds = new Set(
          result.outcomes
            .map((o) => eventById.get(o.eventId))
            .filter((e) => e && e.kind === 'action' && e.weather && e.weather !== 'clear')
            .map((e) => e!.id),
        )
        const medals = awardMedals(result, weatherIds)
        const medalCounts = { ...s0.medals }
        for (const m of medals) medalCounts[m] = (medalCounts[m] ?? 0) + 1

        // 3. Missions, unlocks, best scores.
        const missionsCleared = { ...s0.missionsCleared }
        let missionCleared = false
        const p = result.plan
        const unlockedBefore = unlockedDistricts(s0)
        if (result.completed && (p.mode === 'mission' || p.mode === 'ghost') && p.district !== undefined && p.missionIndex !== undefined) {
          const list = new Set(missionsCleared[p.district] ?? [])
          if (!list.has(p.missionIndex)) missionCleared = true
          list.add(p.missionIndex)
          missionsCleared[p.district] = [...list].sort((a, b) => a - b)
        }
        const unlockedAfter = unlockedDistricts({ missionsCleared })
        const districtUnlocked = unlockedAfter.find((d) => !unlockedBefore.includes(d))

        const previousBest = s0.bestScores[p.key] ?? 0
        const newBest = result.completed && result.score > previousBest
        const bestScores = newBest ? { ...s0.bestScores, [p.key]: result.score } : s0.bestScores

        // 4. XP.
        const xpGained = xpForRun(result, medals.length)
        const correct = result.outcomes.filter((o) => o.correct).length
        const playDays = s0.playDays.includes(today) ? s0.playDays : [...s0.playDays, today]

        let s1: GameState = {
          ...s0,
          items,
          medals: medalCounts,
          missionsCleared,
          bestScores,
          xp: s0.xp + xpGained,
          seasonXp: s0.seasonXp + xpGained,
          playDays,
          stats: {
            runs: s0.stats.runs + 1,
            correct: s0.stats.correct + correct,
            wrong: s0.stats.wrong + (result.outcomes.length - correct),
            bestStreak: Math.max(s0.stats.bestStreak, result.maxStreak),
            timePlayedMs: s0.stats.timePlayedMs + result.durationMs,
          },
        }
        s1.starsMax = updateStars(s1)

        // 5. Contracts.
        const contracts = withFreshContracts(s1)
        const correctByDistrict = new Map<DistrictId, number>()
        let signCorrect = 0
        let numberCorrect = 0
        for (const o of result.outcomes) {
          if (!o.correct) continue
          const it = itemById.get(o.itemId)
          if (!it) continue
          correctByDistrict.set(it.district, (correctByDistrict.get(it.district) ?? 0) + 1)
          if (isSignItem(it)) signCorrect++
          if (it.kind === 'number') numberCorrect++
        }
        const facts = {
          result,
          correctByDistrict,
          signCorrect,
          numberCorrect,
          medals: medals.length,
          bossCleared: false,
          newPlayDay: !s0.playDays.includes(today),
        }
        const before = new Set([...contracts.daily, ...contracts.weekly].filter((c) => c.done).map((c) => c.id))
        contracts.daily = contracts.daily.map((c) => advanceContract(c, facts))
        contracts.weekly = contracts.weekly.map((c) => advanceContract(c, facts))
        const contractsCompleted = [...contracts.daily, ...contracts.weekly].filter((c) => c.done && !before.has(c.id))
        s1 = { ...s1, contracts }

        // 6. Cosmetics.
        const { owned, fresh } = grantCosmetics(s1)
        s1 = { ...s1, owned }
        set(s1)

        // One miss card per item, in the order they happened.
        const seenMiss = new Set<string>()
        const misses = result.outcomes.filter((o) => {
          if (o.correct || seenMiss.has(o.itemId)) return false
          seenMiss.add(o.itemId)
          return true
        })

        return {
          xpGained,
          rankBefore,
          rankAfter: rankOf(s1),
          medals,
          newCosmetics: fresh,
          seasonTierBefore: tierBefore,
          seasonTierAfter: seasonTier(s1.seasonXp),
          newBest,
          previousBest,
          missionCleared,
          districtUnlocked,
          contractsCompleted,
          misses,
          correct,
          total: result.outcomes.length,
        }
      },

      recordExam: (paper, answers) => {
        const s0 = get()
        const today = dayKey()
        const now = Date.now()
        const rankBefore = rankOf(s0)
        const result = gradeExam(paper, answers)

        // Exam answers also feed the scheduler.
        const items = { ...s0.items }
        for (const a of answers) {
          const q = [...paper.part1, ...paper.part2].find((x) => x.id === a.questionId)
          if (!q) continue
          const it = itemById.get(q.item)
          items[q.item] = review(items[q.item], a.correct, today, { isSign: it ? isSignItem(it) : false, now })
        }

        let bossNewlyCleared = false
        let bossesCleared = s0.bossesCleared
        if (paper.kind === 'boss' && paper.district && result.passed && !bossesCleared.includes(paper.district)) {
          bossesCleared = [...bossesCleared, paper.district]
          bossNewlyCleared = true
        }
        if (paper.kind === 'exam' && result.ready && !bossesCleared.includes('d16-examday')) {
          bossesCleared = [...bossesCleared, 'd16-examday']
          bossNewlyCleared = true
        }
        const examHistory =
          paper.kind === 'exam'
            ? [
                ...s0.examHistory,
                { day: today, part1Correct: result.part1Correct, part2Correct: result.part2Correct, passed: result.passed, ready: result.ready },
              ]
            : s0.examHistory

        const correct = answers.filter((a) => a.correct).length
        const xpGained = 30 + correct * 10 + (result.passed ? 150 : 0) + (bossNewlyCleared ? 200 : 0)
        const playDays = s0.playDays.includes(today) ? s0.playDays : [...s0.playDays, today]

        let s1: GameState = {
          ...s0,
          items,
          bossesCleared,
          examHistory,
          playDays,
          xp: s0.xp + xpGained,
          seasonXp: s0.seasonXp + xpGained,
        }
        s1.starsMax = updateStars(s1)

        const contracts = withFreshContracts(s1)
        const fakeRun: RunResult = {
          plan: { mode: 'quick', key: 'exam', title: 'Exam', events: [], ramp: 0, perksAllowed: false, newItemIds: [] },
          outcomes: [],
          score: 0,
          maxStreak: 0,
          durationMs: 0,
          completed: false,
          slowMoUsed: 0,
        }
        const facts = {
          result: fakeRun,
          correctByDistrict: new Map<DistrictId, number>(),
          signCorrect: answers.filter((a) => a.part === 1 && a.correct).length,
          numberCorrect: 0,
          medals: 0,
          bossCleared: result.passed && paper.kind === 'boss',
          newPlayDay: !s0.playDays.includes(today),
        }
        contracts.daily = contracts.daily.map((c) => advanceContract(c, facts))
        contracts.weekly = contracts.weekly.map((c) => advanceContract(c, facts))
        s1 = { ...s1, contracts }

        const { owned, fresh } = grantCosmetics(s1)
        s1 = { ...s1, owned }
        set(s1)

        return {
          result,
          xpGained,
          rankBefore,
          rankAfter: rankOf(s1),
          bossNewlyCleared,
          newCosmetics: fresh,
          examReadyDays: new Set(s1.examHistory.filter((h) => h.ready).map((h) => h.day)).size,
        }
      },

      equip: (slot, id) => {
        const s = get()
        if (!s.owned.includes(id)) return
        const c = COSMETICS.find((x) => x.id === id)
        if (!c || c.slot !== slot) return
        set({ equipped: { ...s.equipped, [slot]: id } })
      },

      togglePerk: (id) => {
        const s = get()
        if (!ownedPerks(s).includes(id)) return
        if (s.perksEquipped.includes(id)) set({ perksEquipped: s.perksEquipped.filter((p) => p !== id) })
        else if (s.perksEquipped.length < MAX_EQUIPPED_PERKS) set({ perksEquipped: [...s.perksEquipped, id] })
      },

      claimContract: (id) => {
        const s = get()
        let reward = 0
        const claim = (list: Contract[]) =>
          list.map((c) => {
            if (c.id === id && c.done && !c.claimed) {
              reward = c.rewardXp
              return { ...c, claimed: true }
            }
            return c
          })
        const contracts = { ...s.contracts, daily: claim(s.contracts.daily), weekly: claim(s.contracts.weekly) }
        if (!reward) return 0
        let s1: GameState = { ...s, contracts, xp: s.xp + reward, seasonXp: s.seasonXp + reward }
        const { owned } = grantCosmetics(s1)
        s1 = { ...s1, owned }
        set(s1)
        return reward
      },

      refreshContracts: () => {
        const s = get()
        set({ contracts: withFreshContracts(s) })
      },

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      doPrestige: () => {
        const s = get()
        if (!s.bossesCleared.includes('d16-examday')) return false
        set({ prestige: s.prestige + 1, xp: 0 })
        return true
      },

      exportSave: () => {
        const s = get()
        const data: Record<string, unknown> = {}
        for (const k of Object.keys(initialState()) as (keyof GameState)[]) data[k] = s[k]
        return JSON.stringify({ app: 'road-warden-va', exportedAt: new Date().toISOString(), data }, null, 2)
      },

      importSave: (json) => {
        try {
          const parsed = JSON.parse(json)
          if (parsed?.app !== 'road-warden-va' || typeof parsed.data !== 'object') {
            return { ok: false, error: 'This file is not a Road Warden save.' }
          }
          const base = initialState()
          const data = parsed.data as Partial<GameState>
          if (data.version !== 1) return { ok: false, error: 'This save is from a different version.' }
          set({ ...base, ...data, settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) } })
          return { ok: true }
        } catch {
          return { ok: false, error: 'Could not read that file.' }
        }
      },

      resetAll: () => set(initialState()),
    }),
    {
      name: 'road-warden-va',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => {
        const out: Partial<GameState> = {}
        for (const k of Object.keys(initialState()) as (keyof GameState)[]) {
          ;(out as Record<string, unknown>)[k] = s[k]
        }
        return out
      },
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<GameState>
        return { ...current, ...p, settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) } }
      },
    },
  ),
)

/** Convenience: read state outside React. */
export const gameState = () => useGame.getState()
