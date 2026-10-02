// Loads all content JSON at build time and builds lookup indexes.
import type {
  District,
  DistrictContent,
  DistrictId,
  GameEvent,
  Item,
  Question,
  SignInfo,
  Story,
} from './types'
import districtsJson from '@content/districts.json'
import registryJson from '@content/signs/registry.json'

const districtFiles = import.meta.glob<DistrictContent>('@content/districts/*.json', {
  eager: true,
  import: 'default',
})
const storyFiles = import.meta.glob<Story>('@content/story.json', { eager: true, import: 'default' })
const signUrls = import.meta.glob<string>('@content/signs/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
})

export const districts: District[] = (districtsJson as District[]).slice().sort((a, b) => a.order - b.order)
export const districtById = new Map<DistrictId, District>(districts.map((d) => [d.id, d]))
export const signRegistry: SignInfo[] = registryJson as SignInfo[]

const contentByDistrict = new Map<DistrictId, DistrictContent>()
for (const file of Object.values(districtFiles)) {
  if (file && file.district) contentByDistrict.set(file.district, file)
}

export const allItems: Item[] = []
export const allEvents: GameEvent[] = []
export const allQuestions: Question[] = []
for (const d of districts) {
  const c = contentByDistrict.get(d.id)
  if (!c) continue
  allItems.push(...c.items)
  allEvents.push(...c.events)
  allQuestions.push(...c.questions)
}

export const itemById = new Map<string, Item>(allItems.map((i) => [i.id, i]))
export const eventById = new Map<string, GameEvent>(allEvents.map((e) => [e.id, e]))
export const questionById = new Map<string, Question>(allQuestions.map((q) => [q.id, q]))

function groupBy<T>(list: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const t of list) {
    const k = key(t)
    const arr = m.get(k)
    if (arr) arr.push(t)
    else m.set(k, [t])
  }
  return m
}

export const eventsByItem = groupBy(allEvents, (e) => e.item)
export const questionsByItem = groupBy(allQuestions, (q) => q.item)
export const itemsByDistrict = groupBy(allItems, (i) => i.district) as Map<DistrictId, Item[]>

export function itemsIn(district: DistrictId): Item[] {
  return itemsByDistrict.get(district) ?? []
}

export function districtOfItem(itemId: string): DistrictId | undefined {
  return itemById.get(itemId)?.district
}

/** True if the item is about a road sign or signal (the Part 1 exam gate). */
export function isSignItem(item: Item): boolean {
  if (item.kind === 'sign') return true
  return (questionsByItem.get(item.id) ?? []).some((q) => q.part === 1)
}

const urlById = new Map<string, string>()
for (const [path, url] of Object.entries(signUrls)) {
  const id = path.split('/').pop()!.replace(/\.svg$/, '')
  urlById.set(id, url)
}

/** URL for an image id from content/signs, or undefined if the art is missing. */
export function imageUrl(id: string | undefined): string | undefined {
  if (!id) return undefined
  return urlById.get(id)
}

export function hasContent(district: DistrictId): boolean {
  return (contentByDistrict.get(district)?.items.length ?? 0) > 0
}

const fallbackStory: Story = {
  mentorName: 'Captain Rae',
  districts: [],
  streakLines: ['On fire!', 'Clean streak!', 'Keep it tight!'],
  missLines: ['Shake it off. Watch the replay.'],
  rankUpLines: ['Rank up! Nice work.'],
  examDayPepTalk: ['Breathe. Read every word. You trained for this.'],
}

export const story: Story = Object.values(storyFiles)[0] ?? fallbackStory

export function storyFor(district: DistrictId) {
  return story.districts.find((s) => s.district === district)
}

/** Campaign districts that have playable missions (not the final exam). */
export const campaignDistricts = districts.filter((d) => !d.isFinal)
export const finalDistrict = districts.find((d) => d.isFinal)!

/** Items per mission when a district is split into missions. */
export const ITEMS_PER_MISSION = 5

export function missionCount(district: DistrictId): number {
  const n = itemsIn(district).length
  if (n === 0) return 0
  return Math.max(1, Math.ceil(n / ITEMS_PER_MISSION))
}

export function missionItems(district: DistrictId, missionIndex: number): Item[] {
  const items = itemsIn(district)
  const count = missionCount(district)
  if (count === 0) return []
  // Spread items evenly so the last mission is not tiny.
  const per = Math.ceil(items.length / count)
  return items.slice(missionIndex * per, missionIndex * per + per)
}
