# src/game — the driving layer

The Phaser road scene plus the React HUD that sits on top of it. The spec is the
"Gameplay spec" and "Pacing" sections of `docs/ARCHITECTURE.md`.

## Files

| File | What it does |
|---|---|
| `GameView.tsx` | The drive screen. Lazy-loads Phaser, wires the bus, renders the HUD, touch gestures (swipe, tap thirds), pause and quit. Finishes at once with an empty result if the plan has nothing playable. |
| `createGame.ts` | Creates and destroys the `Phaser.Game` for one run (DPR-aware sizing, resize observer). Dev builds expose the scene as `window.__roadScene` for play tests. |
| `RoadScene.ts` | The scene: speed model, GO, lanes, events and every action rule, juice, weather, countdown, finish. |
| `director.ts` | Pure run logic (no Phaser): queue, requeues, scoring, streak rewards, perks, lives, pacing constants. Tested in `director.test.ts`. |
| `protocol.ts`, `bus.ts` | Typed messages between scene and HUD. One bus per run, cleared on unmount. |
| `words.ts` | Plain-language action words and control hints for the HUD and the Replay card. |
| `scene/` | Projection (pseudo-3D), road drawing + scenery, weather overlays, small effect textures, colour themes. |
| `hud/` | Top HUD (score, streak, progress/time/lives), prompt card and finish card, controls (speedometer, horn, perks, GO, BRAKE), banners/countdown/edge glows, pause menu, Replay card. |
| `art/` | Procedural textures: player cars, props (with cleared and flash frames), scenery, traffic, standalone walkers. |

## Pacing (player-tested, do not undo)

- **Learning modes** (mission, quick, replay, ghost) slow-roll at 15 mph: each gate
  or hazard takes up to `SLOW_ROLL_WINDOW_MS` (60 s) to arrive. The prompt card says
  "Take your time: 52s · Ready? Press GO".
- **GO** (button, ↑, W, G, Enter) speeds the road up so the next gate arrives in about
  `GO_ARRIVE_MS` (4.5 s), with a whoosh, a short speed-line spin-up and a small lunge.
  Braking cancels GO. GO resets on every decision and every new spawn, so each gate
  starts calm. GO is not offered while held at a stop or during a pull-over.
- **Near an action hazard** GO eases to 2× cruise (from depth 9), so stopping or slowing
  is always fair. GO skips the waiting, never the reaction time.
- **Emergency from behind** keeps its own `BEHIND_WINDOW_MS` (12 s × reaction scale).
- **Timed / survival** modes use `BASE_WINDOW_MS` (6.5 s × reaction scale, min 3 s, with
  ramp); GO is ×2 there.
- **Finish line**: after the last event a "Finish line ahead!" card appears; GO works.

## Action rules (depth z: 1 = at the car)

| Action | Success | Miss |
|---|---|---|
| gates | in the lane holding the right answer when the gate reaches z ≤ 1.05 | any other lane |
| stop | speed reaches 0 before the stop line reaches z = 1.3. Then a 0.8 s hold while the hazard clears (light turns green, bus folds its arm and drives off, pedestrian walks off, train passes, gate lifts, flagger flips to SLOW, procession rolls on). | the line passes while moving |
| slow | at half speed or less while the hazard is within z ≤ 6 (counts at once) | reaches z ≤ 1.05 faster than that |
| go | passes at ≥ 40% speed | stopped (< 15%) for 1.5 s within z ≤ 10, or passing slower |
| move-left / move-right | in a lane away from the shoulder hazard when it passes (traffic drifts you toward it on spawn) | still in the hazard's lane |
| pull-over | in the right lane and stopped before the siren window ends; the vehicle then passes | window runs out |
| brake-straight | ≤ 60% speed within z ≤ 10, without changing lanes after the deer locks to your lane (z < 14); the deer bolts | swerving, or arriving faster |

The horn scares a deer that is close (z ≤ 10); you still have to brake straight.
If the car is parked while the gate or hazard is still far away, the prompt card
coaches "Let go of BRAKE to keep rolling." When an event ends while its props are
still far away (for example you stopped for a red light as soon as you saw it),
those props fade out so they never overlap the next one.

## Calm visuals

Slow roll uses fewer roadside props (12 instead of 22), slower flashing lights
(700 ms instead of 350 ms), a soft red/blue siren fade instead of a strobe, a
gentler miss shake, softer NITRO lines and smaller banners placed low over the
open road. Correct answers stay juicy: sparks, "+N", "×M", the gate lights up green,
sound and a haptic tick. `settings.reducedMotion` removes shake, flashing, speed
lines, lunges and zooms everywhere.

## Testing

- Unit: `npx vitest run src/game`.
- Browser: the dev server exposes `window.__roadScene`. A play test can start any
  plan with `(await import('/src/app/nav.ts')).useNav.getState().go({ name: 'drive', plan })`
  and read `__roadScene.cur`, `.lane`, `.speed`, `.director.outcomes`.
