// End-of-run scoreboard. Score, XP, rank, medals, misses. Always a win screen.
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { isBreakDue, resetSession, useReducedMotion } from '../app/effects'
import { useNav } from '../app/nav'
import { districtById, eventById, itemById, itemsIn, questionsByItem, story } from '../engine/content'
import type { Contract } from '../engine/contracts'
import { cosmeticById, type CosmeticDef } from '../engine/loadout'
import { MEDALS, medalById } from '../engine/medals'
import { MODE_UNLOCK_RANK, rankForXp, rankProgress, rankTitle } from '../engine/ranks'
import type { EventOutcome, RunMode, RunPlan, RunResult } from '../engine/run'
import { buildQuick } from '../engine/runBuilder'
import { playSfx } from '../services/sfx'
import { useGame, type RunSummary } from '../store/gameStore'
import { RankBadge } from '../ui/badges'
import { Celebration, useCountUp, useStagger } from '../ui/fx'
import { Button, Panel, Pill, ReadAloudButton, SignImage } from '../ui/kit'
import { MentorLine } from '../ui/Mentor'
import { ACTION_WORDS, buildCtx, campaignNext, missionPlan, nextMissionIn, planHasRoad, rebuildPlan, startPlan } from '../ui/play'

const MODE_NAMES: Record<RunMode, string> = {
  mission: 'Campaign',
  quick: 'Quick Play',
  sniper: 'Sign Sniper',
  hazard: 'Hazard Rush',
  numbers: 'Numbers Garage',
  replay: 'Replay Range',
  ghost: 'Ghost Race',
}

const SLOT_NAMES: Record<CosmeticDef['slot'], string> = { car: 'Car', paint: 'Paint', trail: 'Trail', horn: 'Horn', decal: 'Decal' }

type Phase = 'score' | 'xp' | 'celebrate' | 'medals' | 'done'

interface CelebrationDef {
  key: string
  icon: ReactNode
  kicker: string
  title: string
  subtitle?: string
  extra?: ReactNode
  sfx: 'rankup' | 'unlock'
}

interface NextAction {
  label: string
  run: () => void
}

/** Runs whose Debrief already played its timeline (coming back from the Garage must not replay it). */
const celebrated = new WeakSet<RunResult>()

function pickLine(lines: string[]): string {
  return lines.length ? lines[Math.floor(Math.random() * lines.length)] : ''
}

export function DebriefScreen({ result, summary }: { result: RunResult; summary: RunSummary }) {
  const nav = useNav()
  const reduced = useReducedMotion()
  const plan = result.plan
  const breakMin = useGame((s) => s.settings.breakReminderMin)

  // XP before/after come from the run record, never from live state.
  const xpAfter = summary.xpAfter
  const xpBefore = summary.xpBefore
  const rankUp = summary.rankAfter > summary.rankBefore
  const [again] = useState(() => celebrated.has(result))
  const [showBreak] = useState(() => !again && isBreakDue(breakMin))
  const [breakState, setBreakState] = useState<'ask' | 'resting' | 'dismissed'>('ask')
  const breakAsk = showBreak && breakState === 'ask'
  const takeBreak = () => {
    resetSession()
    setBreakState('resting')
  }

  // ---------- celebrations queue ----------
  const celebrations = useMemo<CelebrationDef[]>(() => {
    const out: CelebrationDef[] = []
    if (rankUp) {
      const opened = (Object.keys(MODE_UNLOCK_RANK) as RunMode[]).filter(
        (m) => MODE_UNLOCK_RANK[m] > summary.rankBefore && MODE_UNLOCK_RANK[m] <= summary.rankAfter,
      )
      const newTitle = rankTitle(summary.rankAfter) !== rankTitle(summary.rankBefore) ? rankTitle(summary.rankAfter) : undefined
      out.push({
        key: 'rank',
        icon: <RankBadge rank={summary.rankAfter} size={92} />,
        kicker: 'Rank up',
        title: `Rank ${summary.rankAfter}`,
        subtitle: pickLine(story.rankUpLines) || 'Nice work!',
        extra:
          newTitle || opened.length ? (
            <div className="flex flex-wrap justify-center gap-2">
              {newTitle && <Pill className="text-base border-gold text-gold">New title: {newTitle}</Pill>}
              {opened.map((m) => (
                <Pill key={m} className="text-base border-info text-info">
                  🔓 {MODE_NAMES[m]} unlocked
                </Pill>
              ))}
            </div>
          ) : undefined,
        sfx: 'rankup',
      })
    }
    if (summary.districtUnlocked) {
      const d = districtById.get(summary.districtUnlocked)
      if (d) {
        out.push({
          key: 'district',
          icon: '🗺️',
          kicker: d.isFinal ? 'Final boss open' : 'New district',
          title: d.name,
          subtitle: d.blurb,
          sfx: 'unlock',
        })
      }
    }
    return out
  }, [rankUp, summary])

  // ---------- timeline ----------
  const [phase, setPhase] = useState<Phase>(reduced || again ? 'done' : 'score')
  const [celebIdx, setCelebIdx] = useState(reduced && !again && celebrations.length ? 0 : -1)

  useEffect(() => {
    if (celebrated.has(result)) return
    celebrated.add(result)
    playSfx(result.completed ? 'win' : 'whoosh')
  }, [result])

  useEffect(() => {
    if (phase === 'score') {
      const t = window.setTimeout(() => setPhase('xp'), 1500)
      return () => window.clearTimeout(t)
    }
    if (phase === 'xp') {
      const t = window.setTimeout(() => {
        if (celebrations.length) {
          setCelebIdx(0)
          setPhase('celebrate')
        } else setPhase('medals')
      }, 1700)
      return () => window.clearTimeout(t)
    }
    if (phase === 'medals') {
      const t = window.setTimeout(() => setPhase('done'), summary.medals.length * 450 + 400)
      return () => window.clearTimeout(t)
    }
  }, [phase, celebrations.length, summary.medals.length])

  // Sound for each celebration as it opens.
  useEffect(() => {
    const c = celebrations[celebIdx]
    if (c) playSfx(c.sfx)
  }, [celebIdx, celebrations])

  const closeCelebration = () => {
    if (celebIdx + 1 < celebrations.length) setCelebIdx(celebIdx + 1)
    else {
      setCelebIdx(-1)
      if (phase === 'celebrate') setPhase('medals')
    }
  }

  // Tap anywhere during the count-up to skip ahead.
  const skip = () => {
    if (phase !== 'score' && phase !== 'xp') return
    if (celebrations.length) {
      setCelebIdx(0)
      setPhase('celebrate')
    } else setPhase('medals')
  }

  const scoreShown = useCountUp(result.score, { from: again ? result.score : 0, duration: 1200, delay: 250 })
  const xpShown = useCountUp(xpAfter, { from: again ? xpAfter : xpBefore, duration: 1400, run: phase !== 'score' })
  const medalsShown = useStagger(summary.medals.length, {
    run: phase === 'medals' || phase === 'done',
    stepMs: 450,
    onStep: () => {
      if (!again) playSfx('medal')
    },
  })
  const restVisible = phase === 'done' || phase === 'medals'

  // ---------- NEXT RUN ----------
  const next = useMemo<NextAction>(() => computeNext(plan), [plan])

  // ---------- header text ----------
  const banner = summary.missionCleared
    ? { text: 'MISSION CLEARED', cls: 'text-good' }
    : plan.mode === 'ghost'
      ? { text: 'GHOST RACE', cls: 'text-nitro' }
      : result.completed
        ? { text: 'RUN COMPLETE', cls: 'text-gold' }
        : { text: 'RUN ENDED', cls: 'text-info' }

  const ghostDiff = plan.ghostScore !== undefined ? result.score - plan.ghostScore : undefined
  const pct = summary.total ? Math.round((summary.correct / summary.total) * 100) : 0
  const mentorText = (() => {
    if (summary.total === 0) return 'Every drive counts. Let us hit the road again!'
    if (summary.misses.length === 0) return 'Perfect drive. Not a single miss. That is warden work!'
    if (pct >= 80) return `${pct}% right. Strong drive! Check your misses below, then go again.`
    if (pct >= 50) return `${pct}% right. You are getting it. Your misses come back soon so you can nail them.`
    return 'Tough road today. That is how you learn. Look at the misses, then run it back.'
  })()

  const prog = rankProgress(xpShown)
  const shownRank = rankForXp(xpShown)
  const celeb = celebIdx >= 0 ? celebrations[celebIdx] : undefined

  return (
    <div className="min-h-dvh" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <main className="w-full max-w-3xl mx-auto px-4 pt-6 pb-40 flex flex-col gap-4" onClick={skip}>
        {/* Banner + score */}
        <section className="text-center animate-pop" aria-label="Score">
          <div className="text-sm font-bold text-dim truncate">{plan.title}</div>
          <div className={`text-3xl sm:text-4xl font-extrabold tracking-wide mt-1 ${banner.cls}`}>{banner.text}</div>
          <div className="text-7xl sm:text-8xl font-extrabold glow tabular-nums mt-2" aria-live="off">
            {Math.round(scoreShown).toLocaleString()}
          </div>
          <div className="text-lg text-dim mt-1">
            <b className="text-text">{summary.correct}</b> of {summary.total} right · best streak <b className="text-text">{result.maxStreak}</b>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            {summary.newBest && summary.previousBest > 0 && (
              <Pill className="text-base border-gold text-gold animate-pop">⭐ NEW BEST · was {summary.previousBest.toLocaleString()}</Pill>
            )}
            {summary.newBest && summary.previousBest === 0 && <Pill className="text-base border-gold text-gold animate-pop">⭐ First score on the board!</Pill>}
            {ghostDiff !== undefined && (
              <Pill className={`text-base animate-pop ${ghostDiff > 0 ? 'border-good text-good' : 'border-nitro text-nitro'}`}>
                👻 {ghostDiff > 0 ? `Beat your ghost by ${ghostDiff.toLocaleString()}!` : ghostDiff === 0 ? 'Tied your ghost!' : `Ghost won by ${(-ghostDiff).toLocaleString()}`}
              </Pill>
            )}
            {summary.districtUnlocked && (
              <Pill className="text-base border-info text-info animate-pop">🗺️ {districtById.get(summary.districtUnlocked)?.name ?? 'New district'} unlocked</Pill>
            )}
          </div>
        </section>

        {/* Break first, when it is due: it is this screen's main action then. */}
        {showBreak && breakState !== 'dismissed' && (
          <BreakCard
            state={breakState}
            onKeepGoing={() => {
              resetSession()
              setBreakState('dismissed')
            }}
          />
        )}

        {/* XP + rank */}
        <Panel className={phase === 'score' ? 'opacity-40' : 'animate-rise'}>
          <div className="flex items-center gap-3">
            <RankBadge rank={shownRank} size={60} />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-extrabold">Rank {shownRank}</span>
                <span className="text-sm font-bold text-gold">{prog.title}</span>
              </div>
              <div className="h-4 rounded-full bg-panel2 border border-line overflow-hidden mt-1" role="progressbar" aria-label="XP to next rank" aria-valuenow={Math.round(prog.pct * 100)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-gold rounded-full" style={{ width: `${prog.pct * 100}%` }} />
              </div>
              <div className="text-xs text-dim mt-1">{prog.needed ? `${Math.max(0, Math.round(prog.needed - prog.into))} XP to rank ${shownRank + 1}` : 'Max rank!'}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-3xl font-extrabold text-gold tabular-nums">+{summary.xpGained}</div>
              <div className="text-xs font-bold text-dim">XP</div>
            </div>
          </div>
          {summary.seasonTierAfter > summary.seasonTierBefore && (
            <div className="mt-3 text-center">
              <Pill className="text-base border-nitro text-nitro">🎟️ Season tier {summary.seasonTierAfter} reached!</Pill>
            </div>
          )}
        </Panel>

        <MentorLine text={mentorText} />

        {/* Medals */}
        {(phase === 'medals' || phase === 'done') && (
          <section aria-label="Medals">
            <h2 className="text-lg font-extrabold text-dim uppercase tracking-wider mb-2">Medals</h2>
            {summary.medals.length === 0 ? (
              <NoMedalHint />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {summary.medals.slice(0, medalsShown).map((id) => {
                  const m = medalById.get(id)
                  if (!m) return null
                  return (
                    <div key={id} className="animate-pop rounded-2xl border-2 border-gold bg-gold/10 p-3 text-center">
                      <div className="text-5xl" aria-hidden>
                        {m.icon}
                      </div>
                      <div className="font-extrabold text-lg leading-tight mt-1">{m.name}</div>
                      <div className="text-sm text-dim leading-snug mt-0.5">{m.description}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {restVisible && (
          <>
            <MissesSection misses={summary.misses} plan={plan} />
            {summary.newCosmetics.length > 0 && <CosmeticsSection ids={summary.newCosmetics} />}
            {summary.contractsCompleted.length > 0 && <ContractsSection contracts={summary.contractsCompleted} />}
          </>
        )}
      </main>

      {/* Sticky actions: one primary, two small secondaries */}
      <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-ink via-ink/95 to-transparent pt-8 px-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <div className="max-w-3xl mx-auto flex items-stretch gap-2">
          <Button
            variant="secondary"
            className="min-h-14 px-4"
            onClick={() => {
              nav.home()
              nav.go({ name: 'map' })
            }}
            aria-label="Map"
          >
            🗺️<span className="hidden sm:inline"> Map</span>
          </Button>
          <Button variant="primary" size="lg" className="flex-1 min-w-0 px-3! sm:px-7! text-lg! sm:text-xl! leading-tight" onClick={breakAsk ? takeBreak : next.run}>
            {breakAsk ? 'TAKE A BREAK ☕' : next.label}
          </Button>
          <Button variant="secondary" className="min-h-14 px-4" onClick={nav.home} aria-label="Home">
            🏠<span className="hidden sm:inline"> Home</span>
          </Button>
        </div>
      </div>

      {celeb && (
        <Celebration key={celeb.key} icon={celeb.icon} kicker={celeb.kicker} title={celeb.title} subtitle={celeb.subtitle} onClose={closeCelebration}>
          {celeb.extra}
        </Celebration>
      )}
    </div>
  )
}

function computeNext(plan: RunPlan): NextAction {
  const s = useGame.getState()
  const nav = useNav.getState()
  const fallback = (): NextAction => {
    const q = buildQuick(buildCtx())
    if (planHasRoad(q)) return { label: 'QUICK PLAY ▶', run: () => startPlan(q, 'replace') }
    return {
      label: 'BACK TO MAP',
      run: () => {
        nav.home()
        nav.go({ name: 'map' })
      },
    }
  }

  if (plan.mode === 'mission' && plan.district) {
    const d = plan.district
    const nextIdx = nextMissionIn(s, d)
    if (nextIdx !== undefined) {
      const p = missionPlan(d, nextIdx)
      if (planHasRoad(p)) return { label: `NEXT: MISSION ${nextIdx + 1} ▶`, run: () => startPlan(p, 'replace') }
    }
    const bossReady = nextIdx === undefined && !s.bossesCleared.includes(d) && itemsIn(d).some((i) => (questionsByItem.get(i.id) ?? []).length > 0)
    if (bossReady) return { label: 'FIGHT THE BOSS ⚔️', run: () => nav.replace({ name: 'exam', kind: 'boss', district: d }) }
    const c = campaignNext(s)
    if (c) {
      const p = missionPlan(c.district, c.missionIndex)
      const short = districtById.get(c.district)?.short ?? 'Next'
      if (planHasRoad(p)) return { label: `NEXT: ${short.toUpperCase()} ${c.missionIndex + 1} ▶`, run: () => startPlan(p, 'replace') }
    }
    const again = rebuildPlan(plan)
    if (planHasRoad(again)) return { label: 'PLAY AGAIN ▶', run: () => startPlan(again, 'replace') }
    return fallback()
  }

  const again = rebuildPlan(plan)
  if (planHasRoad(again)) {
    const label = plan.mode === 'ghost' ? 'RACE AGAIN 👻' : `AGAIN: ${MODE_NAMES[plan.mode].toUpperCase()} ▶`
    return { label, run: () => startPlan(again, 'replace') }
  }
  return fallback()
}

function NoMedalHint() {
  const [hint] = useState(() => MEDALS[Math.floor(Math.random() * MEDALS.length)])
  return (
    <Panel className="flex items-center gap-3">
      <div className="text-4xl grayscale opacity-60" aria-hidden>
        {hint.icon}
      </div>
      <div className="flex-1">
        <div className="font-extrabold">Next medal to chase: {hint.name}</div>
        <div className="text-dim">{hint.description}</div>
      </div>
    </Panel>
  )
}

// ---------- misses ----------

function missDetails(o: EventOutcome, plan: RunPlan) {
  const ev = eventById.get(o.eventId) ?? plan.events.find((e) => e.id === o.eventId) ?? plan.pool?.find((e) => e.id === o.eventId)
  const item = itemById.get(o.itemId)
  let answer = ''
  let image: string | undefined
  let prompt = ''
  if (ev?.kind === 'gates') {
    answer = ev.choices[ev.answer]
    image = ev.image ?? item?.image
    prompt = ev.prompt
  } else if (ev?.kind === 'action') {
    answer = ACTION_WORDS[ev.action]
    image = ev.sign ?? item?.image
    prompt = ev.prompt
  } else if (o.action) {
    answer = ACTION_WORDS[o.action]
  }
  const line = ev?.missLine ?? item?.simple ?? ''
  return { ev, item, answer, image, prompt, line }
}

function MissesSection({ misses, plan }: { misses: EventOutcome[]; plan: RunPlan }) {
  const [all, setAll] = useState(false)
  if (misses.length === 0) {
    return (
      <Panel className="text-center">
        <div className="text-4xl" aria-hidden>
          💎
        </div>
        <div className="text-xl font-extrabold mt-1">No misses. Clean drive!</div>
      </Panel>
    )
  }
  const shown = all ? misses : misses.slice(0, 3)
  return (
    <section aria-label="Your misses">
      <h2 className="text-lg font-extrabold text-dim uppercase tracking-wider mb-2">
        Your {misses.length === 1 ? 'miss' : `${misses.length} misses`}
      </h2>
      <div className="flex flex-col gap-3">
        {shown.map((o) => (
          <MissCard key={o.itemId} outcome={o} plan={plan} />
        ))}
      </div>
      {misses.length > 3 && (
        <button onClick={() => setAll(!all)} className="mt-2 w-full min-h-12 text-info font-extrabold">
          {all ? 'Show fewer' : `See all ${misses.length} misses`}
        </button>
      )}
      <p className="text-sm text-dim mt-2 text-center">These come back in later runs and in Replay Range. No XP lost.</p>
    </section>
  )
}

function MissCard({ outcome, plan }: { outcome: EventOutcome; plan: RunPlan }) {
  const { item, answer, image, prompt, line } = missDetails(outcome, plan)
  const title = item?.title ?? prompt
  const speech = [answer ? `The answer: ${answer}` : '', line].filter(Boolean).join('. ')
  return (
    <article className="rounded-2xl border-2 border-line bg-panel p-3 flex gap-3 items-start">
      <div className="w-20 h-20 shrink-0 rounded-xl bg-ink/60 border border-line flex items-center justify-center">
        {image ? <SignImage id={image} size={68} /> : <span className="text-4xl" aria-hidden>{item?.kind === 'number' ? '🔢' : '📘'}</span>}
      </div>
      <div className="flex-1 min-w-0">
        {title && <div className="text-sm font-bold text-dim leading-tight">{title}</div>}
        {answer && (
          <div className="text-xl font-extrabold text-good leading-tight mt-0.5">
            <span aria-hidden>✓ </span>
            {answer}
          </div>
        )}
        {line && <p className="text-lg leading-snug mt-1">{line}</p>}
      </div>
      <ReadAloudButton text={speech} />
    </article>
  )
}

// ---------- unlocks / contracts / break ----------

function CosmeticsSection({ ids }: { ids: string[] }) {
  const nav = useNav()
  const list = ids.map((id) => cosmeticById.get(id)).filter((c): c is CosmeticDef => !!c)
  if (!list.length) return null
  return (
    <section aria-label="New unlocks" className="rounded-2xl border-2 border-nitro bg-nitro/10 p-4">
      <h2 className="text-lg font-extrabold uppercase tracking-wider text-nitro">🔓 New in your garage</h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {list.map((c) => (
          <li key={c.id} className="flex items-center gap-2 bg-panel border-2 border-line rounded-xl px-3 py-2">
            <CosmeticSwatch c={c} />
            <span className="font-bold">{c.name}</span>
            <span className="text-xs text-dim">{SLOT_NAMES[c.slot]}</span>
          </li>
        ))}
      </ul>
      <Button size="sm" className="mt-3 min-h-11" onClick={() => nav.go({ name: 'garage' })}>
        Open Garage →
      </Button>
    </section>
  )
}

function CosmeticSwatch({ c }: { c: CosmeticDef }) {
  if ((c.slot === 'paint' || c.slot === 'trail') && c.value.startsWith('#')) {
    return <span className="w-5 h-5 rounded-full border border-line" style={{ background: c.value }} aria-hidden />
  }
  if (c.slot === 'decal' && c.value) return <span aria-hidden>{c.value}</span>
  const icon = c.slot === 'car' ? '🚗' : c.slot === 'horn' ? '📯' : '✨'
  return <span aria-hidden>{icon}</span>
}

/** Finished contracts are paid out automatically when the run is recorded: just celebrate them. */
function ContractsSection({ contracts }: { contracts: Contract[] }) {
  return (
    <section aria-label="Contracts completed" className="rounded-2xl border-2 border-good bg-good/10 p-4">
      <h2 className="text-lg font-extrabold uppercase tracking-wider text-good">📋 Contract complete</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {contracts.map((c) => (
          <li key={c.id} className="flex items-center gap-3">
            <span className="flex-1 text-lg font-bold">{c.title}</span>
            <span className="font-extrabold text-good whitespace-nowrap">+{c.rewardXp} XP bonus</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function BreakCard({ state, onKeepGoing }: { state: 'ask' | 'resting'; onKeepGoing: () => void }) {
  const text =
    state === 'ask'
      ? 'Great work! Your brain learns best with breaks. Take a 5-minute break?'
      : 'Nice. Stand up, stretch, drink some water. Your progress is saved. See you in 5!'
  return (
    <section aria-label="Break reminder" className="rounded-2xl border-2 border-info bg-info/10 p-4">
      <div className="flex items-start gap-3">
        <div className="text-4xl" aria-hidden>
          {state === 'ask' ? '☕' : '🧘'}
        </div>
        <p className="flex-1 text-lg font-bold leading-snug">{text}</p>
        <ReadAloudButton text={text} />
      </div>
      {state === 'ask' && (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <p className="flex-1 text-base text-dim">Press the big button below for a break.</p>
          <Button variant="ghost" className="min-h-12" onClick={onKeepGoing}>
            Keep going
          </Button>
        </div>
      )}
    </section>
  )
}
