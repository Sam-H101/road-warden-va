// Perks (learning aids earned by mastery) and Garage cosmetics.
import type { DistrictId } from './types'
import type { PerkId } from './run'

export interface PerkDef {
  id: PerkId
  name: string
  icon: string
  description: string
  unlock: { district: DistrictId; stars: number }
  chargesPerRun: number
}

export const PERKS: PerkDef[] = [
  {
    id: 'hint-flare',
    name: 'Hint Flare',
    icon: '🔦',
    description: 'Knocks out one wrong lane gate. 3 charges per run. Press H or tap the flare.',
    unlock: { district: 'd02-shapes', stars: 3 },
    chargesPerRun: 3,
  },
  {
    id: 'slow-mo',
    name: 'Slow-Mo',
    icon: '🐢',
    description: 'Starts each run with 2 slow-mo charges. Slows time on a hard one. Press F or tap.',
    unlock: { district: 'd03-regulatory', stars: 3 },
    chargesPerRun: 2,
  },
  {
    id: 'second-chance',
    name: 'Second Chance',
    icon: '🛡️',
    description: 'Your first miss each run does not break your streak.',
    unlock: { district: 'd04-warning', stars: 3 },
    chargesPerRun: 1,
  },
  {
    id: 'radar',
    name: 'Radar',
    icon: '📡',
    description: 'Shows what is coming earlier, so you get more time to think.',
    unlock: { district: 'd06-signals', stars: 3 },
    chargesPerRun: 0,
  },
]

export const perkById = new Map(PERKS.map((p) => [p.id, p]))
export const MAX_EQUIPPED_PERKS = 2

export type CosmeticSlot = 'car' | 'paint' | 'trail' | 'horn' | 'decal'

export interface CosmeticDef {
  id: string
  slot: CosmeticSlot
  name: string
  /** paint/trail: hex color; car: body style key; horn: sound key; decal: emoji */
  value: string
  source: { kind: 'default' } | { kind: 'season'; tier: number } | { kind: 'boss'; district: DistrictId } | { kind: 'rank'; rank: number } | { kind: 'medal'; medal: string }
}

export const COSMETICS: CosmeticDef[] = [
  { id: 'car-compact', slot: 'car', name: 'Compact', value: 'compact', source: { kind: 'default' } },
  { id: 'car-sedan', slot: 'car', name: 'Sedan', value: 'sedan', source: { kind: 'rank', rank: 4 } },
  { id: 'car-hatch', slot: 'car', name: 'Hot Hatch', value: 'hatch', source: { kind: 'boss', district: 'd03-regulatory' } },
  { id: 'car-pickup', slot: 'car', name: 'Pickup', value: 'pickup', source: { kind: 'boss', district: 'd05-workzone' } },
  { id: 'car-muscle', slot: 'car', name: 'Muscle', value: 'muscle', source: { kind: 'season', tier: 10 } },
  { id: 'car-interceptor', slot: 'car', name: 'Interceptor', value: 'interceptor', source: { kind: 'boss', district: 'd08-speed' } },
  { id: 'car-rally', slot: 'car', name: 'Rally', value: 'rally', source: { kind: 'season', tier: 25 } },
  { id: 'car-hyper', slot: 'car', name: 'Hypercar', value: 'hyper', source: { kind: 'boss', district: 'd15-licensing' } },
  { id: 'car-legend', slot: 'car', name: 'Legend GT', value: 'legend', source: { kind: 'season', tier: 50 } },

  { id: 'paint-sky', slot: 'paint', name: 'Sky Blue', value: '#38bdf8', source: { kind: 'default' } },
  { id: 'paint-red', slot: 'paint', name: 'Racing Red', value: '#ef4444', source: { kind: 'rank', rank: 2 } },
  { id: 'paint-lime', slot: 'paint', name: 'Lime', value: '#84cc16', source: { kind: 'season', tier: 2 } },
  { id: 'paint-violet', slot: 'paint', name: 'Violet', value: '#8b5cf6', source: { kind: 'boss', district: 'd02-shapes' } },
  { id: 'paint-orange', slot: 'paint', name: 'Work Zone Orange', value: '#f97316', source: { kind: 'season', tier: 5 } },
  { id: 'paint-pink', slot: 'paint', name: 'Hot Pink', value: '#ec4899', source: { kind: 'boss', district: 'd10-sharing' } },
  { id: 'paint-black', slot: 'paint', name: 'Stealth Black', value: '#1f2937', source: { kind: 'rank', rank: 15 } },
  { id: 'paint-white', slot: 'paint', name: 'Pearl', value: '#f8fafc', source: { kind: 'season', tier: 15 } },
  { id: 'paint-gold', slot: 'paint', name: 'Gold', value: '#fbbf24', source: { kind: 'boss', district: 'd16-examday' } },
  { id: 'paint-teal', slot: 'paint', name: 'Teal', value: '#14b8a6', source: { kind: 'boss', district: 'd09-lanes' } },
  { id: 'paint-storm', slot: 'paint', name: 'Storm Gray', value: '#64748b', source: { kind: 'boss', district: 'd11-conditions' } },

  { id: 'trail-none', slot: 'trail', name: 'None', value: '', source: { kind: 'default' } },
  { id: 'trail-blue', slot: 'trail', name: 'Blue Streak', value: '#38bdf8', source: { kind: 'season', tier: 3 } },
  { id: 'trail-fire', slot: 'trail', name: 'Fire', value: '#f97316', source: { kind: 'medal', medal: 'iron-nerves' } },
  { id: 'trail-green', slot: 'trail', name: 'Green Light', value: '#22c55e', source: { kind: 'boss', district: 'd06-signals' } },
  { id: 'trail-gold', slot: 'trail', name: 'Gold Trail', value: '#fbbf24', source: { kind: 'medal', medal: 'unstoppable' } },
  { id: 'trail-rainbow', slot: 'trail', name: 'Rainbow', value: 'rainbow', source: { kind: 'season', tier: 40 } },

  { id: 'horn-classic', slot: 'horn', name: 'Classic', value: 'classic', source: { kind: 'default' } },
  { id: 'horn-truck', slot: 'horn', name: 'Big Rig', value: 'truck', source: { kind: 'boss', district: 'd10-sharing' } },
  { id: 'horn-tune', slot: 'horn', name: 'La Cucaracha-ish', value: 'tune', source: { kind: 'season', tier: 20 } },
  { id: 'horn-beep', slot: 'horn', name: 'Beep Beep', value: 'beep', source: { kind: 'rank', rank: 6 } },

  { id: 'decal-none', slot: 'decal', name: 'None', value: '', source: { kind: 'default' } },
  { id: 'decal-star', slot: 'decal', name: 'Star', value: '⭐', source: { kind: 'boss', district: 'd01-rookie' } },
  { id: 'decal-bolt', slot: 'decal', name: 'Bolt', value: '⚡', source: { kind: 'season', tier: 8 } },
  { id: 'decal-flame', slot: 'decal', name: 'Flame', value: '🔥', source: { kind: 'rank', rank: 10 } },
  { id: 'decal-crown', slot: 'decal', name: 'Crown', value: '👑', source: { kind: 'medal', medal: 'right-of-way-royalty' } },
  { id: 'decal-diamond', slot: 'decal', name: 'Diamond', value: '💎', source: { kind: 'medal', medal: 'flawless' } },
  { id: 'decal-deer', slot: 'decal', name: 'Deer', value: '🦌', source: { kind: 'boss', district: 'd04-warning' } },
  { id: 'decal-shield', slot: 'decal', name: 'Shield', value: '🛡️', source: { kind: 'boss', district: 'd13-belts' } },
  { id: 'decal-gavel', slot: 'decal', name: 'Gavel', value: '⚖️', source: { kind: 'boss', district: 'd14-penalties' } },
  { id: 'decal-cone', slot: 'decal', name: 'Cone', value: '🚧', source: { kind: 'boss', district: 'd05-workzone' } },
  { id: 'decal-check', slot: 'decal', name: 'Checkered', value: '🏁', source: { kind: 'season', tier: 30 } },
  { id: 'decal-bus', slot: 'decal', name: 'School Bus', value: '🚌', source: { kind: 'boss', district: 'd07-rightofway' } },
  { id: 'decal-phone', slot: 'decal', name: 'No Phone', value: '📵', source: { kind: 'boss', district: 'd12-impaired' } },
]

export const cosmeticById = new Map(COSMETICS.map((c) => [c.id, c]))

export const DEFAULT_EQUIPPED: Record<CosmeticSlot, string> = {
  car: 'car-compact',
  paint: 'paint-sky',
  trail: 'trail-none',
  horn: 'horn-classic',
  decal: 'decal-none',
}

export function describeSource(c: CosmeticDef, districtName: (d: DistrictId) => string): string {
  const s = c.source
  switch (s.kind) {
    case 'default':
      return 'Starter'
    case 'season':
      return `Season tier ${s.tier}`
    case 'boss':
      return `Beat ${districtName(s.district)} boss`
    case 'rank':
      return `Reach rank ${s.rank}`
    case 'medal':
      return `Earn medal`
  }
}
