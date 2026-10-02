// Shared content + engine types. This file is the contract between the content
// JSON files in /content and the game. Keep it in sync with content/README.md
// and tools/validate.py.

export type DistrictId =
  | 'd01-rookie'
  | 'd02-shapes'
  | 'd03-regulatory'
  | 'd04-warning'
  | 'd05-workzone'
  | 'd06-signals'
  | 'd07-rightofway'
  | 'd08-speed'
  | 'd09-lanes'
  | 'd10-sharing'
  | 'd11-conditions'
  | 'd12-impaired'
  | 'd13-belts'
  | 'd14-penalties'
  | 'd15-licensing'
  | 'd16-examday'

export interface District {
  id: DistrictId
  order: number
  name: string
  short: string // 2-3 words for map tiles
  blurb: string // one sentence, what you learn here
  color: string // hex accent
  manualSections: string[]
  boss: string // boss name
  isFinal?: boolean
}

/** One learnable fact from the manual. */
export interface Item {
  id: string // globally unique, kebab-case, e.g. "reg-stop-sign"
  district: DistrictId
  kind: 'sign' | 'rule' | 'number'
  title: string // <= 6 words
  simple: string // <= 40 words, ~5th grade reading level
  official: string // short quote or close paraphrase from the manual
  image?: string // image id from content/signs (no extension), e.g. "sign-stop"
  mnemonic?: string // optional memory hook, <= 20 words
  manualRef: string // e.g. "Section 2, p. 6"
}

/** Scene props the game can draw procedurally for action events. */
export type SceneProp =
  | 'traffic-light-red'
  | 'traffic-light-yellow'
  | 'traffic-light-green'
  | 'traffic-light-flashing-red'
  | 'traffic-light-flashing-yellow'
  | 'traffic-light-out'
  | 'school-bus-stopped'
  | 'pedestrian-crosswalk'
  | 'blind-pedestrian'
  | 'cyclist-ahead'
  | 'motorcycle-ahead'
  | 'deer-on-road'
  | 'emergency-behind'
  | 'emergency-stopped'
  | 'tow-truck-stopped'
  | 'trash-truck-stopped'
  | 'railroad-gate-down'
  | 'railroad-lights-flashing'
  | 'flagger-stop'
  | 'flagger-slow'
  | 'funeral-procession'
  | 'work-zone-cones'
  | 'truck-ahead'
  | 'tailgater-behind'
  | 'ponded-water'
  | 'icy-bridge'
  | 'stop-line'
  | 'driveway-exit'

export type Weather = 'clear' | 'rain' | 'fog' | 'night' | 'snow'

/**
 * Required player action for an action event.
 * - stop: come to a full stop before the line (the game then lets you go)
 * - slow: be at or below 50% of cruise speed when you reach it
 * - go: keep moving; stopping or crawling is wrong
 * - move-left: be in a lane left of the hazard (hazard is on the right shoulder)
 * - move-right: be in a lane right of the hazard
 * - pull-over: move to the far right lane and stop
 * - brake-straight: stay in your lane and brake (do not swerve)
 */
export type RequiredAction = 'stop' | 'slow' | 'go' | 'move-left' | 'move-right' | 'pull-over' | 'brake-straight'

/** Drive through the lane gate with the right answer. 3 choices, one correct. */
export interface GateEvent {
  id: string
  item: string // Item.id
  kind: 'gates'
  prompt: string // <= 12 words, shown big on screen
  image?: string // optional image id shown on a roadside billboard
  choices: [string, string, string] // each <= 28 characters
  answer: 0 | 1 | 2
  missLine: string // <= 20 words, said when wrong
}

/** React to a situation on the road with the right driving action. */
export interface ActionEvent {
  id: string
  item: string
  kind: 'action'
  prompt: string // <= 10 words, e.g. "School bus ahead!"
  prop?: SceneProp
  sign?: string // image id of a roadside sign to show instead of / with the prop
  weather?: Weather
  action: RequiredAction
  missLine: string
}

export type GameEvent = GateEvent | ActionEvent

/** DMV-format multiple choice, used in bosses and Exam Day. */
export interface Question {
  id: string
  item: string
  part: 1 | 2 // 1 = road sign question (must have image), 2 = general knowledge
  prompt: string
  image?: string
  choices: [string, string, string, string]
  answer: 0 | 1 | 2 | 3
  explain: string // one sentence
}

export interface DistrictContent {
  district: DistrictId
  items: Item[]
  events: GameEvent[]
  questions: Question[]
}

export interface SignInfo {
  id: string
  name: string
  group: 'regulatory' | 'warning' | 'workzone' | 'guide' | 'signal' | 'marking' | 'curb' | 'hand' | 'diagram'
  description: string
}

export interface StoryLine {
  district: DistrictId
  intro: string[] // mentor lines before first mission, 2-4 short lines
  bossIntro: string
  outro: string // after boss cleared
}

export interface Story {
  mentorName: string
  districts: StoryLine[]
  streakLines: string[]
  missLines: string[] // generic encouragement after a miss
  rankUpLines: string[]
  examDayPepTalk: string[]
}
