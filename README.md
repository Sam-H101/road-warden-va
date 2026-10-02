# Road Warden: Virginia

A driving game that teaches the Virginia Driver's Manual (DMV 39) to pass the
Virginia DMV knowledge exam. Built for a learner with ADHD and reading
comprehension difficulties: short runs, big text, read-aloud everywhere, instant
feedback, and a real exam rehearsal mode.

## Play it

**Windows, easiest:** double-click `play.bat`. It installs, builds and opens the
game in your browser at http://localhost:4173.

**Windows or WSL, from a terminal:**

```bash
cd app
npm install
npm run build
npm run preview -- --host
```

Open the printed URL. To play on a phone on the same Wi-Fi, open the
`Network:` URL on the phone, then use the browser's "Add to Home Screen" to
install it like an app. It works offline after the first load.

**Developing:** `cd app && npm run dev`.

## Checks

```bash
python tools/validate.py     # content schema, facts linkage, reading-length rules
cd app && npx tsc -b         # typecheck
cd app && npx vitest run     # unit tests
```

## Layout

- `PLAN.md` — game design and learning plan.
- `docs/ARCHITECTURE.md` — technical spec.
- `content/` — all learning content as JSON plus sign art. See `content/README.md`.
- `content/manual/` — the source manual and its extracted text.
- `app/` — the game (Vite, React, TypeScript, Phaser 3).
- `tools/` — Python content tools (`extract.py`, `validate.py`).

## Progress and saves

Progress is saved in the browser. Use Settings, then Export save, to back it up
or move it to another device, and Import save to load it.

## Content accuracy

Every fact is written from the Virginia Driver's Manual and fact-checked
against it. The manual is the authority: if anything in the game disagrees with
the current manual at dmv.virginia.gov, the manual wins.
