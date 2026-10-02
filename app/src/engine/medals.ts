// Medals awarded at the end-of-run debrief. Each names a skill so it sticks.
import { districtOfItem, isSignItem, itemById } from './content'
import type { RunResult } from './run'

export interface MedalDef {
  id: string
  name: string
  icon: string // emoji used on the debrief
  description: string
}

export const MEDALS: MedalDef[] = [
  { id: 'flawless', name: 'Flawless Run', icon: '💎', description: 'Finish a run with zero misses.' },
  { id: 'sign-sniper', name: 'Sign Sniper', icon: '🎯', description: 'Read 5 or more signs in a run with no sign misses.' },
  { id: 'iron-nerves', name: 'Iron Nerves', icon: '🔥', description: 'Hit a 10 streak.' },
  { id: 'unstoppable', name: 'Unstoppable', icon: '⚡', description: 'Hit a 20 streak.' },
  { id: 'quick-draw', name: 'Quick Draw', icon: '⏱️', description: 'Average reaction under 40% of the time window (5+ answers).' },
  { id: 'comeback', name: 'Comeback Kid', icon: '💪', description: 'Get 5 right in a row after a miss.' },
  { id: 'brake-master', name: 'Brake Master', icon: '🛑', description: 'Nail 3 or more stop situations with no stop misses.' },
  { id: 'zero-tolerance', name: 'Zero Tolerance', icon: '🚫', description: 'Get 3 or more alcohol and distraction facts right with no misses.' },
  { id: 'right-of-way-royalty', name: 'Right-of-Way Royalty', icon: '👑', description: 'Get 3 or more right-of-way facts right with no misses.' },
  { id: 'number-cruncher', name: 'Number Cruncher', icon: '🔢', description: 'Get 4 or more number facts right with no number misses.' },
  { id: 'storm-chaser', name: 'Storm Chaser', icon: '⛈️', description: 'Handle 2 or more bad-weather situations with no misses.' },
  { id: 'marathon', name: 'Road Tripper', icon: '🛣️', description: 'Answer 25 or more in one run.' },
]

export const medalById = new Map(MEDALS.map((m) => [m.id, m]))

export function awardMedals(result: RunResult, weatherEventIds: Set<string>): string[] {
  const o = result.outcomes
  const out: string[] = []
  if (o.length === 0) return out
  const misses = o.filter((x) => !x.correct).length

  const group = (pred: (itemId: string, eventId: string) => boolean) => {
    const g = o.filter((x) => pred(x.itemId, x.eventId))
    return { n: g.length, ok: g.filter((x) => x.correct).length }
  }

  if (misses === 0 && result.completed && o.length >= 8) out.push('flawless')

  const signs = group((id) => {
    const it = itemById.get(id)
    return !!it && isSignItem(it)
  })
  if (signs.n >= 5 && signs.ok === signs.n) out.push('sign-sniper')

  if (result.maxStreak >= 10) out.push('iron-nerves')
  if (result.maxStreak >= 20) out.push('unstoppable')

  const answered = o.filter((x) => x.correct)
  if (answered.length >= 5) {
    const avg = answered.reduce((s, x) => s + x.reactionMs / Math.max(1, x.windowMs), 0) / answered.length
    if (avg < 0.4) out.push('quick-draw')
  }

  for (let i = 0; i < o.length; i++) {
    if (!o[i].correct) {
      const after = o.slice(i + 1, i + 6)
      if (after.length === 5 && after.every((x) => x.correct)) {
        out.push('comeback')
        break
      }
    }
  }

  const stops = o.filter((x) => x.action === 'stop')
  if (stops.length >= 3 && stops.every((x) => x.correct)) out.push('brake-master')

  const imp = group((id) => districtOfItem(id) === 'd12-impaired')
  if (imp.n >= 3 && imp.ok === imp.n) out.push('zero-tolerance')

  const row = group((id) => districtOfItem(id) === 'd07-rightofway')
  if (row.n >= 3 && row.ok === row.n) out.push('right-of-way-royalty')

  const nums = group((id) => itemById.get(id)?.kind === 'number')
  if (nums.n >= 4 && nums.ok === nums.n) out.push('number-cruncher')

  const wx = group((_id, ev) => weatherEventIds.has(ev))
  if (wx.n >= 2 && wx.ok === wx.n) out.push('storm-chaser')

  if (o.length >= 25) out.push('marathon')
  return out
}
