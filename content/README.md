# Content authoring guide

All learning content lives here as JSON. The game is a player for this data.
The TypeScript contract is `app/src/engine/types.ts`. The validator is
`tools/validate.py` (run `python tools/validate.py`). Content that fails
validation does not ship.

## Source of truth

Every fact must come from the Virginia Driver's Manual (DMV 39). The extracted
text is in `content/manual/manual.txt` with `===== PAGE N =====` markers. Manual
printed page numbers (e.g. "| 15") differ from PDF page numbers; cite the
printed page, e.g. `"Section 3, p. 15"`.

Never invent numbers, fines, ages, distances or rules. If the manual does not say
it, do not write it. Do not copy commercial practice-test sites.

## The learner

The player has ADHD and reading comprehension difficulties. Therefore:

- `simple` text: at most 40 words, short sentences, ~5th grade reading level,
  concrete, second person ("You must stop."). One idea per item.
- `prompt` text in game events: very short (see limits). Present tense.
- `missLine`: one sentence, at most 20 words, states the rule, never shames.
- Prefer concrete verbs: stop, slow down, wait, move over.
- Mnemonics must actually help memory. Skip them if nothing good exists.

## Files

```
content/
  districts.json          16 districts (fixed; do not edit ids)
  signs/registry.json     every image id that content may reference
  signs/<id>.svg          the art, one file per registry id
  districts/<district-id>.json   items, events, questions for one district
  story.json              mentor dialogue
```

### districts/<district-id>.json

```json
{
  "district": "d03-regulatory",
  "items": [ ... ],
  "events": [ ... ],
  "questions": [ ... ]
}
```

### Item (one fact)

```json
{
  "id": "reg-stop-sign",
  "district": "d03-regulatory",
  "kind": "sign",
  "title": "Stop sign: full stop",
  "simple": "A red sign with 8 sides means STOP. Stop all the way at the line. Go only when it is safe.",
  "official": "This eight-sided shape always means stop. You must come to a complete stop at the sign, stop line, pedestrian crosswalk or curb.",
  "image": "sign-stop",
  "mnemonic": "8 sides, 0 rolling.",
  "manualRef": "Section 2, p. 6"
}
```

- `id`: kebab-case, globally unique. Prefix with a district short code
  (`rook-`, `shape-`, `reg-`, `warn-`, `work-`, `sig-`, `row-`, `spd-`, `lane-`,
  `share-`, `cond-`, `imp-`, `belt-`, `pen-`, `lic-`).
- `kind`: `sign` (about a sign/signal/marking image), `number` (the key fact is a
  number: feet, seconds, MPH, days, dollars, points, ages, BAC), or `rule`.
- `image`: must be an id from `signs/registry.json`. Required for `kind: sign`.

### Events (how an item is played on the road)

Two kinds. Every item needs at least 2 events. Aim for a mix.

**gates** — three lane gates with answers; the player steers into the right one.
```json
{
  "id": "ev-reg-stop-sign-1",
  "item": "reg-stop-sign",
  "kind": "gates",
  "prompt": "What does this sign mean?",
  "image": "sign-stop",
  "choices": ["Full stop", "Slow down", "Yield"],
  "answer": 0,
  "missLine": "8 sides means STOP. Always a full stop."
}
```
- `prompt` <= 12 words. Each choice <= 28 characters. Exactly 3 choices.
- Wrong choices must be plausible and clearly wrong per the manual.
- Vary which index is correct (0, 1, 2) across events.
- For numbers, use 3 numeric choices: `["50 feet", "100 feet", "200 feet"]`.

**action** — a situation; the player must do the right driving action.
```json
{
  "id": "ev-row-school-bus-1",
  "item": "row-school-bus-stop",
  "kind": "action",
  "prompt": "School bus stopped, red lights flashing!",
  "prop": "school-bus-stopped",
  "action": "stop",
  "missLine": "Stop for a school bus with flashing red lights until it moves again."
}
```
- `prop`: one of the SceneProp values in `types.ts` (procedurally drawn), and/or
  `sign`: any registry image id shown on a roadside post.
- `weather` optional: `clear | rain | fog | night | snow`.
- `action`: `stop | slow | go | move-left | move-right | pull-over | brake-straight`.
  - `move-left` = hazard on the right shoulder; change to a lane not next to it.
  - `pull-over` = emergency vehicle behind; move right and stop.
  - `brake-straight` = do not swerve, stay in lane and brake (deer).
  - `go` = the correct move is to keep going (e.g. green light, way is clear).
- Only use action events when the action is clearly right per the manual.
- `prompt` <= 10 words.

### Questions (DMV exam format)

```json
{
  "id": "q-reg-stop-sign-1",
  "item": "reg-stop-sign",
  "part": 1,
  "prompt": "This road sign means:",
  "image": "sign-stop",
  "choices": ["Stop completely", "Slow down", "Yield to traffic", "Stop only if cars are coming"],
  "answer": 0,
  "explain": "An eight-sided sign always means come to a complete stop."
}
```
- `part: 1` = road sign question; must have `image` of a sign/signal. Used for
  the 10 sign questions on Exam Day.
- `part: 2` = general knowledge.
- Exactly 4 choices. Vary the correct index (0-3). Write in the DMV style
  ("This road sign means:", "When ..., you must:"). "All of these" is allowed
  when true per the manual.
- Every item needs at least 2 questions, worded differently.
- `explain`: one sentence, the rule.

## Quality bar

- Each fact appears in at least 2 differently worded events and 2 questions.
- Distractors use real concepts from the manual so learning transfers.
- No trick questions. No double negatives.
- Read your `simple` text aloud. If it sounds like a lawyer, rewrite it.
