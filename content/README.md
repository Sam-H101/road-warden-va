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
- Complete grammar everywhere. Every prompt, `missLine`, `explain` and `simple`
  is made of complete sentences (subject, verb, articles, correct punctuation).
  No headline style, no clipped notes ("Heavy rain. Which beams?"), no trailing
  "...", no symbols such as `&`, `->`, `w/` or a slash standing in for a word.
  Short does not mean clipped: say it in a few plain words, but say it properly.
- `prompt` text in game events: short (see limits). Present tense.
- `missLine`: one or two complete sentences, at most 24 words, states the rule,
  never shames.
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
  "choices": ["Come to a full stop", "Slow down", "Yield to traffic"],
  "answer": 0,
  "missLine": "A sign with eight sides always means stop. Come to a full stop."
}
```
- `prompt`: one complete question ending in `?`, at most 16 words. Never two
  clipped sentences and never a stem that ends in `...` or `:`.
- Each choice is a direct answer to that question, written as a grammatical short
  phrase (`"The right lane"`, `"Turn them on"`). At most 32 characters (they sit on
  small road banners; 28 reads best), a capital first letter, no period at the
  end. Exactly 3 choices.
- Wrong choices must be plausible and clearly wrong per the manual.
- Vary which index is correct (0, 1, 2) across events.
- For numbers, use 3 numeric choices: `["50 feet", "100 feet", "200 feet"]`.

**action** — a situation; the player must do the right driving action.
```json
{
  "id": "ev-row-school-bus-1",
  "item": "row-school-bus-stop",
  "kind": "action",
  "prompt": "A school bus is stopped with its red lights flashing!",
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
- `prompt`: one or two complete sentences describing the scene, at most 14 words
  in all, ending in `.` or `!`. Do not add a hint the situation does not contain.

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
- Exactly 4 choices. Vary the correct index (0-3). Prefer a complete direct
  question ending in `?`. A completion stem ending in `:` ("This road sign means:")
  is fine only when every one of the four choices completes it as a correct
  sentence. Choices have a capital first letter and no end period. "All of these"
  is allowed when true per the manual.
- Every item needs at least 2 questions, worded differently.
- `explain`: one or two complete sentences, at most 30 words, the rule.
- Prompts: at most 32 words.

## Quality bar

- Each fact appears in at least 2 differently worded events and 2 questions.
- Distractors use real concepts from the manual so learning transfers.
- No trick questions. No double negatives.
- Read your `simple` text aloud. If it sounds like a lawyer, rewrite it.
