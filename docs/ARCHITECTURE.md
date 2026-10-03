# Road Warden: Virginia — Architecture and build spec

Read `PLAN.md` for the why. This file is the how. Every agent builds against it.

## Stack

- Vite 8 + React 19 + TypeScript 6 (strict, `erasableSyntaxOnly`: **no enums, no
  parameter properties, no namespaces**). Use `import type` for types
  (`verbatimModuleSyntax`).
- Phaser **3.90** (not 4) for the driving layer.
- Zustand 5 for state. Tailwind CSS 4 (CSS-first config in `src/index.css`;
  theme colors: `ink panel panel2 line text dim gold good bad info nitro`, e.g.
  `bg-panel text-dim border-line`). Font: Lexend.
- Vitest for tests. Content JSON imported from `../content` via the `@content`
  alias.
- Run from `F:/driving game/app`: `npx tsc -b` (typecheck), `npm run build`,
  `npx vitest run`, `npm run dev`.

## Directory ownership

| Path | Owner | Notes |
|---|---|---|
| `src/engine/**` | engine (done) | Pure logic. Read it, do not rewrite. Small bug fixes OK, say so in your summary. |
| `src/store/gameStore.ts` | engine (done) | Zustand persisted store `useGame`. Same rule. |
| `src/services/{sfx,speech}.ts` | done | `playSfx(name)`, `playHorn(value)`, `vibrate()`, `speak(text)`. |
| `src/ui/kit.tsx` | done | `Button Panel SignImage ReadAloudButton useAutoRead ProgressBar Stars Screen Pill`. Add new shared components in `src/ui/` as new files. |
| `src/app/nav.ts` | done | `useNav().go(screen)`, `back()`, `home()`. Screen union lists every screen. |
| `src/game/**` | game agent | Phaser scene + `GameView` React wrapper + HUD. |
| `src/game/art/**` | game-art agent | Procedural textures for cars and scene props. |
| `src/App.tsx`, `src/main.tsx`, `src/app/effects.ts` | ui-a | Shell, router switch, settings side-effects. |
| `src/screens/{Home,Intro,MapScreen,District,Briefing,Debrief,Modes}.tsx` | ui-a | |
| `src/screens/{Exam,ExamResult,Garage,Contracts,Settings,Stats,Library}.tsx` | ui-b | |
| `src/engine/*.test.ts` | tests agent | |

## Screen component contract

Every screen is a default-less named export taking the props shown. The router
in `App.tsx` switches on `useNav().screen.name`.

```ts
// ui-a
export function HomeScreen(): JSX.Element
export function IntroScreen(): JSX.Element
export function MapScreen(): JSX.Element
export function DistrictScreen(props: { district: DistrictId }): JSX.Element
export function BriefingScreen(props: { plan: RunPlan }): JSX.Element
export function DebriefScreen(props: { result: RunResult; summary: RunSummary }): JSX.Element
export function ModesScreen(): JSX.Element
// ui-b
export function ExamScreen(props: { kind: 'exam' | 'boss' | 'signs'; district?: DistrictId }): JSX.Element
export function ExamResultScreen(props: { summary: ExamSummary }): JSX.Element
export function GarageScreen(): JSX.Element
export function ContractsScreen(): JSX.Element
export function SettingsScreen(): JSX.Element
export function StatsScreen(): JSX.Element
export function LibraryScreen(props: { district?: DistrictId }): JSX.Element
// game
export function GameView(props: { plan: RunPlan; onFinish: (r: RunResult) => void; onQuit: () => void }): JSX.Element
```

Files: `src/screens/Home.tsx` exports `HomeScreen`, `src/screens/MapScreen.tsx`
exports `MapScreen`, etc. `src/game/GameView.tsx` exports `GameView`.

Flow:
- Drive screen: `App.tsx` renders `<GameView plan onFinish onQuit />`. `onFinish`
  calls `useGame.getState().recordRun(result)` and navigates (replace) to
  `{ name: 'debrief', result, summary }`. `onQuit` records the partial run if
  at least one event was answered (`completed: false`), then goes back.
- Starting a mission: `District` builds a plan with `buildMission` and goes to
  `briefing` if `plan.newItemIds` has items not in `briefedItems`, else straight
  to `drive`. Briefing shows intel cards, calls `markBriefed`, then `replace`s
  to `drive`.
- Boss and Exam: `ExamScreen` builds the paper with `buildBoss` / `buildExam`
  (signs mode = only `part1` of `buildExam`, graded as part 1 only), records via
  `recordExam(paper, answers)`, and `replace`s to `exam-result`.

## Design rules (non-negotiable, the learner has ADHD + comprehension issues)

- One idea per screen. At most ~40 words of body text visible at once.
- Exactly one primary (gold) button per screen. Its label says what happens next.
- Every text block a learner must understand gets a `ReadAloudButton` and
  `useAutoRead` when it is the main content.
- Big touch targets (min 44px). Works at 380px wide (phone portrait) and on a PC.
- Mistakes never cost XP, rank or unlocks. Language never shames.
- Respect `settings.reducedMotion` (no shake/flash, minimal animation) and the
  html classes `big-text`, `high-contrast`, `font-system`.
- Celebrate: rank-ups, medals, unlocks get a full-screen moment with sound.

## Gameplay spec (game agent)

### Canvas and camera
- Phaser `Scale.RESIZE`, parent = a div filling the drive screen. Transparent
  React HUD on top. Pseudo-3D road: horizon at ~35% height. For depth `z`
  (1 = at the player, larger = farther), screen y = horizonY + (baseY -
  horizonY) / z and scale = 1 / z. Road half-width at depth z = roadHalfW / z.
  Three lanes (index 0 left, 1 center, 2 right) plus shoulders.
- Draw road each frame with Graphics: alternating grass/road/rumble/lane-dash
  bands keyed to distance traveled so motion is visible. Roadside scenery
  (trees, posts, buildings) streams past for speed feel.
- Player car at the bottom, centered on its lane, tweened between lanes
  (~150 ms). Car texture from `game/art` using equipped car + paint + decal.
  Trail particles if a trail is equipped.

### Controls
| Action | Keyboard | Touch |
|---|---|---|
| Lane left/right | ←/→ or A/D | swipe left/right, or tap left/right third of the screen |
| Brake (hold) | ↓, S or Space | press and hold the BRAKE button (bottom right) |
| Horn | ↑ or W | HORN button (fun only; also scares deer) |
| Hint flare perk | H | perk button |
| Slow-mo | F | perk button |
| Pause | Esc / P | pause button |
Speed: cruise speed when not braking; braking decelerates to 0 in ~1.2 s;
releasing re-accelerates to cruise in ~1.5 s. Show a speedometer.

### Pacing: slow roll + green GO (player-tested requirement, do not undo)
The learner found the original pace too fast and distracting. Current design:
- **Learning modes** (mission, quick, replay, ghost): the car cruises at a calm
  15 mph and each gate or hazard takes **up to 60 s** to reach the car
  (`SLOW_ROLL_WINDOW_MS` in `game/director.ts`). The prompt card shows
  "Take your time: 52s · Ready? Press GO".
- **Green GO button** (also ↑, W, G, Enter): speeds the road up so the gate
  arrives in ~4.5 s (`GO_ARRIVE_MS`). Braking cancels GO. GO resets after each
  decision, so every gate starts calm. Horn is K.
- **Emergency vehicle from behind** keeps its own short window
  (`BEHIND_WINDOW_MS` = 12 s × reaction scale) so the siren never lasts a minute.
- **Timed/survival modes** (sniper, numbers, hazard): base window 6.5 s ×
  reaction scale, min 3 s, with ramp; GO still works (×2).
- Keep visuals calm: no busy flashing, modest scenery, effects short.

### Events
The run queue is `plan.events`. Spawn one event at a time at z = far (~40).
Travel time to the player at cruise is `RunDirector.windowMs()` (see Pacing).
Gap between events ~1.2 s of free cruising.
The prompt for the current event is shown in the React HUD at the top in big
text with a read-aloud button (auto-read if setting is `auto`). If the event has
an image, show it big on a roadside billboard in the scene AND as a thumbnail
in the HUD prompt card.

**gates**: three overhead gates spanning the three lanes, each labeled with one
choice (shuffle choice→lane per spawn). Labels are big, high contrast, use the
game font, wrap to 2 lines max. Decision is the player's lane when the gates
reach z ≤ 1.05. Correct = lane holding `choices[answer]`.

**action**: draw the `prop` (texture from `game/art`) and/or the roadside
`sign` image; apply `weather` overlay for this event (rain/snow particles, fog
gradient, night = darken + headlight cone). Rules:
- `stop`: success when speed reaches 0 before the prop's stop line reaches
  z = 1.3. While stopped for 0.8 s the hazard clears (light turns green / bus
  folds stop arm and drives off / pedestrian walks off / train passes / gate
  lifts / flagger flips to SLOW), then the player may go. Miss if the stop line
  passes the player while speed > 0.
- `slow`: at z ≤ 1.05 success if speed ≤ 50% of cruise.
- `go`: miss if the player is stopped (speed < 15%) for 1.5 s while the event is
  active, or passes it at < 40% cruise. Success when it passes at ≥ 40%.
- `move-left`: hazard on the right shoulder. On spawn, if the player is not in
  lane 2, ease them to lane 2 (traffic drift, with a little "↗" hint). Success if
  the player is in lane 0 or 1 when it passes.
- `move-right`: mirror of move-left (hazard on the left; start lane 0; success
  lane 1 or 2).
- `pull-over`: an emergency vehicle with siren approaches from behind (bottom of
  screen, flashing lights, `playSfx('siren')`). Start player in lane 0 or 1.
  Success if player is in lane 2 and stopped before it reaches them (window);
  it then passes and the player resumes.
- `brake-straight`: hazard (deer) in the player's current lane. Success if the
  player did not change lanes during the event and speed is ≤ 60% when it
  reaches z ≤ 1.3 (the deer then bolts off). Changing lanes = miss ("do not
  swerve"). Horn makes the deer run off early but still requires no swerve.

### Scoring, streaks, juice
Use `pointsFor`, `multiplierFor`, `streakReward` from `engine/run.ts`.
- Correct: `playSfx('correct')`, particle burst at the car, floating "+N ×M",
  short green flash on the gate (no flash/shake if reduced motion), haptic tick.
- Miss: `playSfx('miss')`, red vignette + small camera shake (unless reduced
  motion), streak resets to 0 (unless second-chance perk unused), then the
  **Replay card** (React overlay): pauses the road, shows "REPLAY" header, the
  event image, the correct answer (or correct action in plain words), the
  `missLine` (auto read if setting is auto), and a big "Got it" button (auto
  continue after 6 s; Enter/Space continues). Then the item is re-queued: insert
  `requeueEventFor(itemId, eventId)` 3-4 events later (mark `isRequeue`). At
  most one requeue per item per run.
- Streak rewards: 5 = horn + sparkle; 10 = NITRO (speed lines, faster scenery,
  score banner "NITRO!" for 4 s, `playSfx('nitro')`); 15 = +1 slow-mo charge;
  20+ every 10 = gold trail. Show a random `story.streakLines` line in a banner.
- HUD (React, top): score, streak and multiplier badge, progress ("7 / 18" or
  time left for timed modes, lives for hazard), ghost delta if `plan.ghostScore`
  ("+320 vs best"). Bottom: speedometer, BRAKE button, HORN, perk buttons.
- Countdown "3-2-1-GO" at start (skippable with any key).
- Pause menu: Resume, Settings shortcut (reaction time slider + read-aloud +
  reduced motion inline), Quit run.

### Modes
- mission / quick / replay / ghost: run through `plan.events` (+ requeues), then
  finish with `completed: true`.
- sniper / numbers: `timeLimitSec`; keep drawing from `plan.pool` (cycle) until
  time is up. `completed: true` when time runs out.
- hazard: draw from `plan.pool` until `maxMisses` misses. `completed: true`.
- Perks only if `plan.perksAllowed`. Equipped perks from `useGame` `perksEquipped`
  (only those in `ownedPerks`). hint-flare: 3 charges, removes one wrong gate.
  slow-mo: charges (2 + streak rewards) halve time speed for the current event.
  second-chance: first miss keeps the streak. radar: windows ×1.3.

### Result
Build `RunResult` exactly as typed in `engine/run.ts` and call `onFinish`. Clean
up the Phaser game on unmount (`game.destroy(true)`). No memory leaks between
runs. The scene must never crash on missing art: fall back to a labeled box.

### Break reminder
If `settings.breakReminderMin > 0` and total play this session passes it, after
the run show a friendly "Great work — take a 5-minute break?" card on debrief
(ui-a owns this; session start time can live in a module variable).

## Art spec (game-art agent)

`src/game/art/textures.ts` exports:
```ts
export function ensureTextures(scene: Phaser.Scene): void // generate all textures once
export function carTextureKey(scene: Phaser.Scene, style: string, paint: string, decal: string): string
export function propTextureKey(prop: SceneProp): string // texture already generated by ensureTextures
export const PROP_INFO: Record<SceneProp, { side: 'road' | 'left' | 'right' | 'behind' | 'overhead'; width: number; height: number; clearedKey?: string }>
export function sceneryKeys(): string[] // trees, poles, buildings, bushes for roadside
export function vehicleKeys(): string[] // ambient traffic cars
```
All drawn with `Phaser.GameObjects.Graphics` + `generateTexture` (no image
files). Back-view car styles: compact, sedan, hatch, pickup, muscle,
interceptor, rally, hyper, legend. Props for every `SceneProp` in
`engine/types.ts`, each readable at small size, with a cleared variant where the
stop rule needs one (green light, bus with arm folded, empty crosswalk, gate up,
flagger SLOW). Bright, chunky, toy-like arcade style.
