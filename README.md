# Road Warden

A driving game that teaches your state's driver manual so you pass the DMV
knowledge (learner's permit) exam. Pick any of the 50 states on first launch.
Virginia has the full course from the Virginia Driver's Manual (DMV 39); other
states practice the road signs and signals that are the same nationwide until
their manual is added (see `content/README.md`, "Adding a state"). Built for a learner with ADHD and reading
comprehension difficulties: short runs, big text, read-aloud everywhere, instant
feedback, and a real exam rehearsal mode.

## Play it

**Online (no install):** https://sam-h101.github.io/road-warden-va/
Works on a PC or phone. On a phone, use the browser's "Add to Home Screen" to
install it like an app; it then works offline.

**Windows, offline copy:** double-click `play.bat`. It installs, builds and opens the
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
cd server && npx vitest run  # sync worker tests
```

## Layout

- `PLAN.md` — game design and learning plan.
- `docs/ARCHITECTURE.md` — technical spec.
- `content/` — all learning content as JSON plus sign art. See `content/README.md`.
- `content/states/` — the 50-state list and each state's course and manual.
- `server/` — the sync worker for online saves (Google sign-in, progress stored in a private GitHub repo).
- `app/` — the game (Vite, React, TypeScript, Phaser 3).
- `tools/` — Python content tools (`extract.py`, `validate.py`).

## Progress and saves

Progress is saved in the browser, separately for each state. Use Settings, then
Export save, to back it up or move it to another device, and Import save to load it.

**Save online:** when the game is built with a Google client ID and a sync
URL, Settings shows "Sign in with Google". Progress then also saves to a
private GitHub repository through a small worker, and merges across devices.
Setup is in `server/README.md`.

## Content accuracy

Every fact is written from the state's driver's manual and fact-checked
against it. The manual is the authority: if anything in the game disagrees with
your state's current manual, the manual wins.
