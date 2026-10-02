# ROAD WARDEN: Virginia — Project Plan

A real game, not a quiz with a skin. The learner drives. Signs, hazards and
decisions come at them in real time. The Virginia Driver's Manual is the rulebook
of the game world, and mastering it is how you rank up, unlock, and win.

Goal: a learner with ADHD and comprehension difficulties passes the Virginia DMV
knowledge exam, and keeps coming back to play until they do.

---

## 1. The target: the real exam

| Part | Questions | Pass rule | Notes |
|---|---|---|---|
| 1. Road signs | 10 | **All 10 correct** | Must pass Part 1 before Part 2 is shown |
| 2. General knowledge | 30 | 24 correct (80%) | Laws, safe driving, alcohol/drugs, penalties |

Manual (DMV 39) sections: 1 Testing, 2 Signals/Signs/Markings, 3 Safe Driving,
4 Seat Belts/Air Bags/Child Seats, 5 Penalties, 6 License Types, 7 Other Info,
8 Sample Exams.

Design consequences:
- **Signs are the hard gate.** One wrong sign fails the exam. Sign recognition is
  the core reflex the game trains, like aim in a shooter.
- Section 3 (Safe Driving) is most of Part 2. It becomes the bulk of the missions.
- The real exam is multiple choice on a screen. The game's "Exam Day" boss fights
  use that exact format so there is no surprise at the DMV.

**Done means:** 100% on signs and 90%+ on general on three Exam Day runs, on
three different days.

---

## 2. Platform: web game, developed in WSL

Browser game, playable on the Windows PC and on a phone. Python runs the content
pipeline. No install. Offline-capable as a PWA.

Why not a Python desktop game: Pygame can do the driving part, but it cannot
run on a phone, has weak UI, no built-in speech, and is painful to distribute.
Short phone sessions are where an ADHD learner actually plays.

Fallback if PC-only is ever required: wrap the same web build with pywebview.

---

## 3. The engagement model (what we are borrowing from CoD-style design)

The shooter formula that keeps people playing is not the shooting. It is:

| Shooter mechanic | Our version | What it does for learning |
|---|---|---|
| Short matches (3–6 min) with a scoreboard | **Missions** are 3–5 minute drives with an end-of-run debrief | Fits ADHD attention, builds the "one more" loop |
| Moment-to-moment reaction | **Signs and hazards appear on the road; you react in under 2 seconds** | Makes sign recognition a reflex, not recall |
| Kill streaks | **Clean Streak**: consecutive correct reactions build a multiplier, trigger nitro, slow-mo, flashy effects | Rewards accuracy, which is what the exam measures |
| XP and a long rank ladder | **100 ranks**, small XP steps, rank-up fanfare every few minutes early on | Constant visible progress |
| Prestige | **Prestige** resets rank for a badge, but keeps unlocks; resets only after Exam Day cleared | Replay without punishment |
| Loadouts and perks | **Garage**: cars, paint, horns, decals; **Perks** are learning aids earned by mastery (Hint Flare, Slow-Mo, Second Chance) | Agency, personalization |
| Medals / accolades | **Medals** at debrief: "Sign Sniper", "Iron Nerves", "Zero Tolerance", "Right-of-Way Royalty" | Names the skill so it sticks |
| Daily / weekly challenges | **Contracts**: 3 daily, 3 weekly, generated from weak topics | Brings them back tomorrow |
| Battle pass (free) | **Season Track**: 50 tiers of cosmetics; XP from any mode | Long-term goal with no paywall |
| Campaign with story | **Campaign**: you are a rookie courier/driver in Virginia; a mentor character; 16 districts; each district ends with a boss | Context makes rules meaningful |
| Multiplayer | **Ghost Races** against your own best run; **Family Leaderboard** (local, optional) | Competition without needing other players online |
| Killcam | **Replay**: after a mistake, watch the 5-second replay with the rule overlaid | Turns errors into the strongest learning moment |
| Announcer | **Mentor voice**: short pre-recorded or synthesized lines ("Clean streak! Keep it tight.") | Energy, feedback, read-aloud for free |
| Juice | Screen shake, combo counters, particle bursts, sound hits, haptic buzz on phone | Dopamine per correct action |

Rules we keep from the learning side (non-negotiable):
- Mistakes never cost rank or unlocks. They cost the streak and route the item
  into the review scheduler.
- Every mistake shows **why** in one sentence plus the picture. Never a paragraph.
- Read-aloud, dyslexia font, big text, high contrast, reduced motion are all
  one tap in settings. Reduced motion keeps the game playable with no shake or flash.
- Every mission ends with a win screen even on a bad run (XP always goes up).
- A break prompt after 20 minutes. Streak counts days played, not minutes.

---

## 4. Core gameplay

### 4.1 The driving layer

A 2.5D "behind the car" road runner (think endless-runner camera, three lanes,
road scrolls toward you). Controls are deliberately simple so the brain is free
for the rules:

| Input | PC | Phone |
|---|---|---|
| Change lane | ← → or A/D | swipe left/right |
| Brake / stop | ↓ or S | tap bottom |
| Go / accelerate | ↑ or W | tap top |
| Signal | Q / E | tap left/right corner |
| Answer prompt | 1–4 or click | tap card |

The road feeds **events** from the content database. Each event is one rule
from the manual, turned into something you *do*:

| Event type | What appears | Correct action |
|---|---|---|
| Sign reaction | A sign appears roadside; 4 quick-answer cards slide in, or the sign itself demands an action | Tap the meaning, or brake/yield/slow as the sign requires |
| Signal | Traffic light / flashing red / flashing yellow / arrow | Stop, go, yield correctly |
| Right of way | Cars approach an intersection, 4-way stop, uncontrolled intersection, roundabout | Go or wait at the right moment |
| Hazard | Pedestrian, cyclist, school bus with flashing lights, emergency vehicle behind, deer, motorcycle in blind spot | Stop, pull over, slow, keep distance |
| Lane and marking | Solid vs broken lines, HOV, turn lanes, railroad crossing | Pass or don't, pick lane |
| Conditions | Rain, fog, night, ice, skid | Slow, lights on, steer into skid |
| Numbers | "How many feet before your turn do you signal?" pops as a dial or quick-pick while driving | Pick the number |
| Decision scene | Car pulls up; a short illustrated scene with 4 choices (BAC, penalties, licensing) | Pick the choice |

Timing: a sign reaction gives 2–3 seconds (configurable, longer in early ranks).
Decision scenes pause the road. Nothing in Campaign has a hard clock the learner
can't extend; Hazard Rush and Exam Day are the only timed modes.

### 4.2 Streaks and scoring

- Each correct reaction = +points × multiplier.
- Multiplier climbs 1x → 2x → 3x → 5x at streaks of 3, 6, 10.
- Streak rewards: 5 = horn blast + sparkle, 10 = NITRO (speed and score boost),
  15 = SLOW-MO charge (bank it, spend it on a hard sign), 20 = gold trail cosmetic.
- A miss resets the multiplier, triggers the 5-second **Replay** with the rule,
  and the item is queued to reappear later in the same run and in tomorrow's run.

### 4.3 End-of-run debrief (the scoreboard)

One screen, always the same layout:
1. Score, XP gained, rank bar animating up.
2. Medals earned (big, loud).
3. "Your 3 misses" as picture cards with the one-line rule, tap for read-aloud.
4. One primary button: **NEXT RUN**. Secondary: Garage, Map.

---

## 5. Modes

| Mode | Length | What it is | Unlocks |
|---|---|---|---|
| **Campaign** | 3–5 min missions | Story-driven districts, each teaching one topic cluster. 16 districts, 4–6 missions each, boss at the end | Districts unlock in order; replaying is encouraged |
| **Quick Play** | 3 min | The scheduler builds a run from what is due for review. The default "just press play" | Always open |
| **Sign Sniper** | 90 sec | Pure sign recognition, speed ramps up, leaderboard vs self | Rank 3 |
| **Hazard Rush** | Until 3 misses | Survival mode, escalating difficulty, mixed topics | Rank 8 |
| **Numbers Garage** | 2 min | Every numeric fact as a dial or quick-pick mini-game | Rank 5 |
| **Replay Range** | varies | Only your recent misses, replayed as events | After first miss |
| **Ghost Race** | 3 min | Race your best run on a mission | After clearing a mission |
| **Exam Day** (boss) | ~10 min | The real thing: 10 signs then 30 questions, DMV screen look, mentor pep talk before, full breakdown after | Each district boss is a mini Exam Day on that topic; the Final Exam Day unlocks after all districts |

### 5.1 Campaign districts (topic order tuned for fast early wins)

1. Rookie Yard — tutorial, controls, first streak (2 missions)
2. Shape & Color Row — sign shapes and colors (the fastest confidence win)
3. Regulatory Strip — stop, yield, speed, no-turn, one-way
4. Warning Hills — curves, merges, crossings, slippery, deer
5. Guide & Work Zone — route markers, services, orange zone rules, flaggers
6. Signal Junction — lights, arrows, flashing, pavement markings
7. Right-of-Way Crossroads — intersections, 4-way stops, roundabouts, left turns
8. Speed & Distance Highway — speed limits, following distance, stopping distance
9. Lane & Pass Parkway — lanes, turning, passing, parking, parallel parking
10. Shared Road — pedestrians, cyclists, motorcycles, trucks, school buses, emergency vehicles, funerals
11. Storm Pass — rain, fog, snow, night, skids, hydroplaning, breakdowns
12. Zero Tolerance — alcohol, drugs, BAC numbers, distraction, texting law
13. Buckle Bay — seat belts, air bags, child seats
14. Court Street — penalties, points, suspensions, insurance
15. DMV Plaza — license types, testing rules, learner's permit rules
16. **Exam Day** — final boss

Each district: 4–6 missions, a **Boss** (topic mini-exam in DMV format), a badge,
a car cosmetic, and a mentor story beat.

---

## 6. Progression systems

**Rank (1–100):** XP from everything. Early ranks need little XP so the first
session has 4–5 rank-ups. Rank gates modes and perks.

**Mastery per topic (0–5 stars):** driven by the spaced-repetition scheduler,
never decreases. Shown on the Map as district "control."

**Perks (earned by mastery, not time):**
- Hint Flare — eliminates 2 wrong answers, 3 charges per run (Shape & Color 3★)
- Slow-Mo — doubles reaction time on next sign (Regulatory 3★)
- Second Chance — one miss per run does not break the streak (Warning 3★)
- Radar — upcoming sign shape shown early (Signal 3★)
- Perks are disabled in Exam Day. The learner is told why: "No perks at the DMV."

**Garage:** cars, paint, decals, horns, trails. Purely cosmetic. Unlock via
Season Track tiers, district badges, and medals.

**Contracts:** 3 daily (e.g. "Hit a 10 streak in Sign Sniper", "Clear 2 Replay
Range runs"), 3 weekly. Generated from the learner's weakest topics.

**Season Track:** 50 free tiers fed by all XP. Visible on home screen.

**Prestige:** available after the Final Exam Day is cleared. Rank resets to 1 with
a prestige badge; everything else stays. Gives a reason to keep practicing
before the real test date.

---

## 7. Learning engine (under the hood)

- **Scheduler:** Leitner boxes per item (sign, rule, number). Correct moves up a
  box; a miss drops to box 1. Signs need correct answers on 3 separate days to
  reach "mastered."
- **Run builder:** every run is 60% due-for-review items, 30% the mission's new
  items, 10% random mastered items (to keep them alive). Quick Play is 100% scheduler.
- **Mistake routing:** a missed item reappears later in the same run (different
  wording or disguised), then in Replay Range, then in tomorrow's Quick Play.
- **Readiness meter:** on the home screen, one bar. It is the projected Exam Day
  score from the scheduler. "Ready" lights up only at the done rule in section 1.
- **Exam Day bridging:** the Exam Day screen looks like the DMV computer. Same
  format, same wording style. It is the only place with no game juice, on purpose,
  so the real DMV screen feels familiar and calm.

---

## 8. Tech stack

| Layer | Choice | Reason |
|---|---|---|
| Game engine | **Phaser 3** (WebGL/Canvas) | Best fit for a 2.5D road runner on web; sprites, tweens, particles, input, audio all built in; runs well on phones |
| Menus / UI | React + TypeScript + Tailwind | Debrief, Garage, Map, Settings, Exam Day are UI, not game; React is faster for that |
| Bridge | Phaser scene ↔ React via an event bus | Clean split |
| State | Zustand + localStorage, Export/Import JSON | No backend in v1 |
| Animation / juice | Phaser tweens + particles; Framer Motion in React screens | Respects reduced-motion |
| Audio | Phaser audio (Howler under the hood) | Sound hits, horn, announcer |
| Voice | Web Speech API for read-aloud; optional recorded mentor lines later | Free first, upgrade later |
| Art | SVG signs (public-domain MUTCD/FHWA), simple vector cars and road; placeholder art first | Ship gameplay before polish |
| Offline | vite-plugin-pwa | Install to phone home screen |
| Tests | Vitest for scheduler/scoring/exam logic; Playwright for flows | The engine must be trustworthy |
| Content tools | Python 3.12: pdfplumber, pydantic | Extract manual, validate content |
| Hosting | GitHub Pages / Netlify, or local `npm run preview` over Wi-Fi | Free |

---

## 9. Content model

All rules, signs and scenarios are data. The game is a player for that data.

```
content/
  manual/                 # extracted manual text by section (reference)
  districts.json          # 16 districts, missions, bosses, unlock order
  signs/*.svg             # sign art
  items/<topic>.json      # learnable items: signs, rules, numbers
  events/<topic>.json     # how each item is played on the road
  questions/<topic>.json  # DMV-format multiple choice for bosses and Exam Day
  story.json              # mentor lines, district intros
  medals.json, contracts.json, cosmetics.json
```

Item (one learnable fact):
```json
{
  "id": "sign-stop",
  "topic": "regulatory",
  "simple": "8 sides, red. Stop fully behind the line. Go when it's safe.",
  "official": "A stop sign is red with white letters and has eight sides...",
  "image": "signs/stop.svg",
  "mnemonic": "8 sides = full stop, no 'rolling 8'",
  "numeric": false,
  "manualRef": "Section 2"
}
```

Event (how that item is played):
```json
{
  "id": "ev-stop-01",
  "item": "sign-stop",
  "kind": "sign-action",
  "scene": { "spawn": "stop-sign-right", "trafficCross": true },
  "correct": "brake-full-then-go",
  "reactionSeconds": 3,
  "missLine": "That's a STOP sign. Full stop, then go when clear."
}
```

Question (DMV format):
```json
{
  "id": "q-reg-0007",
  "item": "sign-stop",
  "prompt": "A sign with eight sides means:",
  "choices": ["Stop", "Yield", "Slow down", "Do not enter"],
  "answer": 0,
  "explain": "Only the STOP sign has eight sides."
}
```

**Targets for v1:** ~90 signs, ~300 items, ~400 events, ~450 DMV-format questions.
Every item has at least 2 events and 2 questions. Every number in the manual is an item.

**Rules:** written from the manual in our own words; one-sentence miss lines;
each item cites a manual section; validate script blocks any item over 40 words
or above ~6th grade reading level; sign art is public domain.

**Pipeline (Python):** `extract.py` (PDF to text) → `draft.py` (draft items,
events, questions per section; can use the Claude API with the manual as the
only source) → **human review of every item** → `validate.py` (schema,
citations, reading level, every item has events and questions, every sign has art).

---

## 10. Build phases

Each phase ends with something playable. The learner starts at Phase 1.

**Phase 0 — Setup (1 day)**
WSL toolchain, Vite + React + TS + Tailwind + Phaser scaffold, content schemas,
`validate.py`, manual extracted. Placeholder car and road on screen, lanes work.

**Phase 1 — Vertical slice: Sign Sniper + Rookie Yard (4–5 days)**
- Road runner with lane change, brake, go. Sign events with 4-card quick answer.
- Streak, multiplier, nitro at 10, miss Replay with rule overlay.
- Debrief screen, XP, ranks 1–20, first medals.
- Content: all signs (district 2–5 items and events).
- Scheduler with unit tests, localStorage save, Export/Import.
- *Learner can play Sign Sniper and the first districts.*

**Phase 2 — Campaign spine (5–6 days)**
- Districts 1–7 missions and bosses (DMV-format mini exams).
- Map screen with district control stars, mentor story beats.
- Right-of-way, signal and hazard event kinds.
- Settings: read-aloud, fonts, contrast, reduced motion, reaction time slider.
- Contracts (daily/weekly), Season Track, Garage with first cosmetics.

**Phase 3 — Full content + Exam Day (5–6 days)**
- Districts 8–15 content, decision scenes, Numbers Garage, Hazard Rush.
- Exam Day boss in DMV look, readiness meter, Replay Range, Ghost Race.
- Perks system.

**Phase 4 — Juice and voice (3 days)**
- Particles, screen shake, combo pops, sound pass, haptics on phone.
- Mentor announcer lines (speech synthesis first; record real lines if wanted).
- Rank-up and medal ceremonies, Prestige.

**Phase 5 — Ship (2–3 days)**
- PWA install, offline, phone layout and touch tuning, Playwright flow tests.
- Second-person review of every item and question.
- Deploy.

**Ongoing:** watch the learner play. Per-item miss rates and session length are
the tuning signals. Rewrite the top-missed items' miss lines and mnemonics weekly.

Total: roughly 4–5 weeks of focused work for a solid v1, with something
playable in the first week.

---

## 11. Project layout

```
driving-game/
  PLAN.md
  app/
    src/
      game/              # Phaser: scenes (Road, Sniper, HazardRush), events, juice, audio
      screens/           # React: Home, Map, Debrief, Garage, Contracts, ExamDay, Settings
      engine/            # scheduler.ts, runBuilder.ts, scoring.ts, ranks.ts, exam.ts
      store/             # zustand store, persistence, export/import
      bridge/            # Phaser <-> React event bus
      content/           # built JSON copied from /content
    tests/
  content/               # see section 9
  tools/                 # extract.py, draft.py, validate.py, requirements.txt
  .claude/
```

---

## 12. Risks

| Risk | Mitigation |
|---|---|
| Game is fun but exam scores lag | Readiness meter is the exam projection; Exam Day uses real format; perks off in Exam Day; done rule is 3 clean Exam Days |
| Reaction timing frustrates the learner | Reaction-time slider in settings; Campaign never fails a mission; Second Chance perk; reduced-motion mode |
| Juice overwhelms (sensory) | Reduced-motion and quiet-mode toggles; every effect is skippable |
| Content errors | Human review of every item; manual citation enforced by validate script; edition date tracked; recurring manual check |
| Scope creep in the game layer | Phase 1 vertical slice must be playable before any Phase 2 work; placeholder art until Phase 4 |
| Progress loss | Export/Import JSON; optional sync server later |
| Art/copyright | Public-domain MUTCD sign SVGs; own vector cars and road |

---

## 13. Open decisions (defaults chosen)

- **Camera:** 2.5D behind-the-car runner (default). Top-down is the simpler
  fallback if phone performance is poor.
- **Content drafting with the Claude API:** big time saver; needs an API key.
  Without it, items are hand-written to the same bar.
- **Mentor voice:** speech synthesis in v1. Recorded lines are a later upgrade.
- **Family leaderboard:** local-only in v1 (profiles on the same device).
- **Hosting:** GitHub Pages by default; local Wi-Fi preview if no internet is wanted.

---

## 14. Sources

- Virginia DMV, The Knowledge Exam: https://www.dmv.virginia.gov/licenses-ids/exams/know-exam
- Virginia Driver's Manual (DMV 39): https://www.dmv.virginia.gov/licenses-ids/exams/manual
- Manual PDF: https://www.dmv.virginia.gov/sites/default/files/forms/dmv39.pdf
