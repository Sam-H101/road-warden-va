// Results for Exam Day, the sign test and district bosses. Kind, clear, never shaming.
import { useMemo, useState } from 'react'
import { districtById, questionById, storyFor } from '../engine/content'
import {
  BOSS_PASS_PCT,
  EXAM_PART1_PASS,
  EXAM_PART2_COUNT,
  EXAM_PART2_PASS,
  READY_PART2,
  READY_RUNS_NEEDED,
  type ExamAnswer,
} from '../engine/exam'
import { cosmeticById } from '../engine/loadout'
import { rankTitle } from '../engine/ranks'
import type { DistrictId, Question } from '../engine/types'
import { useNav } from '../app/nav'
import { unlockedDistricts, useGame, type ExamSummary } from '../store/gameStore'
import { Button, Panel, Pill, ReadAloudButton, Screen, SignImage, useAutoRead } from '../ui/kit'
import { BottomAction, SectionTitle } from '../ui/b-controls'
import { Celebration } from '../ui/b-Celebration'
import { CosmeticIcon } from '../ui/b-CosmeticIcon'
import { startQuickPlay, useReducedMotion } from '../ui/b-util'

type Mode = 'exam' | 'boss' | 'signs'

export function ExamResultScreen({ summary }: { summary: ExamSummary }) {
  const nav = useNav()
  const reduced = useReducedMotion()
  const missionsCleared = useGame((s) => s.missionsCleared)
  const equippedPaint = useGame((s) => s.equipped.paint)
  const { result } = summary
  const paper = result.paper
  const mode: Mode = paper.kind === 'exam' ? 'exam' : paper.district ? 'boss' : 'signs'
  const district = paper.district
  const d = district ? districtById.get(district) : undefined

  const p1Total = paper.part1.length
  const p2Total = paper.part2.length
  const total = p1Total + p2Total
  const correctAll = result.part1Correct + result.part2Correct
  const bossNeed = Math.ceil(total * BOSS_PASS_PCT)
  const rankUp = summary.rankAfter > summary.rankBefore
  const passed = result.passed

  const headline = useMemo(() => buildHeadline(mode, summary, { p1Total, total, bossNeed, correctAll, boss: d?.boss }), [
    mode,
    summary,
    p1Total,
    total,
    bossNeed,
    correctAll,
    d?.boss,
  ])
  useAutoRead(`${headline.title}. ${headline.sub}`)

  const [celebrate, setCelebrate] = useState(() => passed || summary.newCosmetics.length > 0 || rankUp)

  const misses = useMemo(
    () =>
      result.answers
        .filter((a) => !a.correct)
        .map((a) => ({ a, q: questionById.get(a.questionId) ?? [...paper.part1, ...paper.part2].find((x) => x.id === a.questionId) }))
        .filter((m): m is { a: ExamAnswer; q: Question } => !!m.q),
    [result, paper],
  )
  const [showAllMisses, setShowAllMisses] = useState(false)

  const unlocked = unlockedDistricts({ missionsCleared })
  const districtRows = Object.entries(result.byDistrict)
    .filter(([, v]) => v.total > 0)
    .map(([id, v]) => ({ id: id as DistrictId, ...v, pct: v.correct / v.total }))
    .sort((a, b) => a.pct - b.pct || b.total - a.total)

  const bossWon = mode === 'boss' && passed
  const primary = bossWon
    ? {
        label: 'Back to map',
        go: () => {
          nav.home()
          nav.go({ name: 'map' })
        },
      }
    : { label: 'Practice my weak spots', go: () => startQuickPlay() }

  const retry = () => nav.replace({ name: 'exam', kind: mode, district })

  return (
    <Screen title={mode === 'boss' ? 'Boss result' : mode === 'signs' ? 'Sign Test result' : 'Exam Day result'} onBack={() => nav.home()}>
      {/* Hero */}
      <section
        className={`relative overflow-hidden rounded-3xl border-2 p-5 sm:p-6 text-center ${
          passed ? 'border-good bg-good/10' : 'border-info/60 bg-info/5'
        } ${reduced ? '' : 'animate-rise'}`}
      >
        <div className="absolute right-3 top-3">
          <ReadAloudButton text={`${headline.title}. ${headline.sub}`} />
        </div>
        <div className="text-6xl" aria-hidden>
          {headline.icon}
        </div>
        <h2 className={`text-3xl sm:text-4xl font-extrabold mt-2 ${passed ? 'text-good' : 'text-text'}`}>{headline.title}</h2>
        <p className="text-lg mt-2 max-w-md mx-auto">{headline.sub}</p>
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          <Pill className="text-base !px-3 !py-1.5 text-gold border-gold/50">+{summary.xpGained} XP</Pill>
          {rankUp && (
            <Pill className="text-base !px-3 !py-1.5 text-nitro border-nitro/50">
              Rank {summary.rankAfter} · {rankTitle(summary.rankAfter)}
            </Pill>
          )}
          {result.ready && <Pill className="text-base !px-3 !py-1.5 text-good border-good/50">Ready run ✓</Pill>}
        </div>
      </section>

      {/* Scores vs pass lines */}
      <SectionTitle>Your score</SectionTitle>
      <Panel className="space-y-5">
        {mode === 'exam' && (
          <>
            <ScoreRow
              label="Part 1: Road signs"
              value={result.part1Correct}
              max={p1Total}
              lines={[{ at: Math.min(EXAM_PART1_PASS, p1Total), label: 'Pass' }]}
              ok={result.part1Passed}
            />
            {result.stoppedAfterPart1 ? (
              <div className="rounded-xl bg-panel2 border border-line p-3 text-dim">
                <strong className="text-text">Part 2: General knowledge</strong>
                <p className="mt-1">The real test stops if a sign is missed. Get all signs right and Part 2 opens.</p>
              </div>
            ) : (
              <ScoreRow
                label="Part 2: General knowledge"
                value={result.part2Correct}
                max={p2Total || EXAM_PART2_COUNT}
                lines={[
                  { at: EXAM_PART2_PASS, label: 'Pass' },
                  { at: READY_PART2, label: 'Ready' },
                ]}
                ok={result.part2Correct >= EXAM_PART2_PASS}
              />
            )}
          </>
        )}
        {mode === 'signs' && (
          <ScoreRow label="Road signs" value={result.part1Correct} max={p1Total} lines={[{ at: p1Total, label: 'Pass' }]} ok={passed} />
        )}
        {mode === 'boss' && (
          <>
            <ScoreRow label="Boss questions" value={correctAll} max={total} lines={[{ at: bossNeed, label: 'Win' }]} ok={correctAll >= bossNeed} />
            {p1Total > 0 && (
              <ScoreRow label="Sign questions (all must be right)" value={result.part1Correct} max={p1Total} lines={[{ at: p1Total, label: 'Win' }]} ok={result.part1Passed} />
            )}
          </>
        )}
      </Panel>

      {/* Ready rule */}
      {mode === 'exam' && <ReadyDays days={summary.examReadyDays} thisRunReady={result.ready} />}

      {/* By district */}
      {districtRows.length > 1 && (
        <>
          <SectionTitle read="Here is how you did in each topic. Tap Practice to train the weak ones.">By topic</SectionTitle>
          <Panel className="space-y-3">
            {districtRows.map((r) => {
              const dd = districtById.get(r.id)
              const weak = r.pct < 0.8
              const canPractice = unlocked.includes(r.id)
              return (
                <div key={r.id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="font-bold truncate">{dd?.name ?? r.id}</span>
                      <span className="tabular-nums text-dim shrink-0">
                        {r.correct}/{r.total}
                      </span>
                    </div>
                    <div className="h-3 mt-1 rounded-full bg-panel2 border border-line overflow-hidden">
                      <div
                        className={`h-full rounded-full ${weak ? 'bg-bad/80' : 'bg-good'}`}
                        style={{ width: `${Math.max(4, r.pct * 100)}%`, background: weak ? undefined : dd?.color }}
                      />
                    </div>
                  </div>
                  {weak && canPractice ? (
                    <Button size="sm" variant="secondary" className="min-h-11 shrink-0" onClick={() => nav.go({ name: 'district', district: r.id })}>
                      Practice
                    </Button>
                  ) : (
                    <span className="w-[5.25rem] shrink-0 text-center text-sm text-good font-bold">{weak ? '' : 'Solid'}</span>
                  )}
                </div>
              )
            })}
          </Panel>
        </>
      )}

      {/* Misses */}
      {misses.length > 0 && (
        <>
          <SectionTitle>
            {misses.length === 1 ? 'The one to review' : `${misses.length} to review`}
          </SectionTitle>
          <div className="space-y-3">
            {(showAllMisses ? misses : misses.slice(0, 4)).map(({ a, q }) => (
              <MissCard key={q.id} q={q} chosen={a.chosen} />
            ))}
          </div>
          {misses.length > 4 && !showAllMisses && (
            <Button variant="ghost" className="w-full mt-2 min-h-11" onClick={() => setShowAllMisses(true)}>
              Show all {misses.length}
            </Button>
          )}
        </>
      )}

      {/* Unlocks (also shown in the celebration) */}
      {summary.newCosmetics.length > 0 && (
        <>
          <SectionTitle>New in your garage</SectionTitle>
          <Panel>
            <CosmeticList ids={summary.newCosmetics} paint={cosmeticById.get(equippedPaint)?.value} />
          </Panel>
        </>
      )}

      <div className="flex flex-wrap gap-3 mt-6">
        <Button variant="secondary" className="flex-1 min-w-[9rem]" onClick={retry}>
          {mode === 'boss' ? 'Fight again' : 'Take it again'}
        </Button>
        <Button variant="secondary" className="flex-1 min-w-[9rem]" onClick={() => nav.go({ name: 'library', district: mode === 'boss' ? district : undefined })}>
          Study guide
        </Button>
      </div>

      <BottomAction>
        <Button variant="primary" size="lg" className="w-full" onClick={primary.go}>
          {primary.label}
        </Button>
      </BottomAction>

      {celebrate && (
        <Celebration
          icon={summary.bossNewlyCleared ? '🏆' : passed ? '🎉' : rankUp ? '⬆️' : '🎁'}
          title={celebrationTitle(mode, summary, d?.boss, rankUp)}
          line={celebrationLine(mode, summary, district, rankUp)}
          sound={passed ? 'win' : rankUp ? 'rankup' : 'unlock'}
          onClose={() => setCelebrate(false)}
          buttonLabel="See my results"
        >
          {summary.newCosmetics.length > 0 && (
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-dim mb-2">Unlocked</p>
              <CosmeticList ids={summary.newCosmetics} paint={cosmeticById.get(equippedPaint)?.value} center />
            </div>
          )}
        </Celebration>
      )}
    </Screen>
  )
}

// ---------- text ----------

function buildHeadline(
  mode: Mode,
  s: ExamSummary,
  n: { p1Total: number; total: number; bossNeed: number; correctAll: number; boss?: string },
): { icon: string; title: string; sub: string } {
  const r = s.result
  if (mode === 'exam') {
    if (r.ready) return { icon: '🏁', title: 'Ready run!', sub: `All signs right and ${r.part2Correct} of ${EXAM_PART2_COUNT} in Part 2. That is test-ready.` }
    if (r.passed)
      return {
        icon: '✅',
        title: 'You passed!',
        sub: `${r.part2Correct} of ${EXAM_PART2_COUNT} in Part 2. Get ${READY_PART2} or more for a ready run.`,
      }
    if (r.stoppedAfterPart1) {
      const missed = n.p1Total - r.part1Correct
      return {
        icon: '🪧',
        title: missed <= 2 ? 'Not yet — you are close' : 'Not yet — signs first',
        sub: `You got ${r.part1Correct} of ${n.p1Total} signs. The test needs all of them. ${missed === 1 ? 'Just one sign to fix!' : `${missed} signs to fix.`}`,
      }
    }
    const gap = EXAM_PART2_PASS - r.part2Correct
    return {
      icon: '💪',
      title: gap <= 4 ? 'Not yet — you are close' : 'Not yet — keep training',
      sub: `Signs: all right! Part 2: ${r.part2Correct} of ${EXAM_PART2_COUNT}. You need ${EXAM_PART2_PASS}. ${gap === 1 ? 'Just one more!' : `${gap} more to go.`}`,
    }
  }
  if (mode === 'signs') {
    if (r.passed) return { icon: '🎯', title: 'All signs right!', sub: `${r.part1Correct} of ${n.p1Total}. That is what the real test needs.` }
    const missed = n.p1Total - r.part1Correct
    return {
      icon: '🪧',
      title: missed <= 2 ? 'Not yet — you are close' : 'Not yet — keep training',
      sub: `You got ${r.part1Correct} of ${n.p1Total}. The test needs all of them. ${missed === 1 ? 'Just one to fix!' : `${missed} to fix.`}`,
    }
  }
  if (r.passed) return { icon: '🏆', title: `${n.boss ?? 'Boss'} defeated!`, sub: `${n.correctAll} of ${n.total} right. You own this district.` }
  const gap = Math.max(0, n.bossNeed - n.correctAll)
  if (gap === 0 && !r.part1Passed)
    return { icon: '🛡️', title: 'Not yet — you are close', sub: `Great score! One sign slipped. Every sign must be right to win.` }
  return {
    icon: '🛡️',
    title: gap <= 2 ? 'Not yet — you are close' : 'Not yet — round 2 will go better',
    sub: `${n.correctAll} of ${n.total} right. You need ${n.bossNeed}. ${gap === 1 ? 'Just one more!' : `${gap} more to go.`}`,
  }
}

function celebrationTitle(mode: Mode, s: ExamSummary, boss: string | undefined, rankUp: boolean): string {
  if (mode === 'boss' && s.result.passed) return `${boss ?? 'Boss'} defeated!`
  if (mode === 'exam' && s.bossNewlyCleared) return 'Exam Day cleared!'
  if (mode === 'exam' && s.result.ready) return 'Ready run!'
  if (s.result.passed) return mode === 'signs' ? 'Perfect signs!' : 'You passed!'
  if (rankUp) return `Rank ${s.rankAfter}!`
  return 'New gear unlocked!'
}

function celebrationLine(mode: Mode, s: ExamSummary, district: DistrictId | undefined, rankUp: boolean): string {
  if (mode === 'boss' && s.result.passed) return (district && storyFor(district)?.outro) || 'District cleared. Great driving, warden.'
  if (mode === 'exam' && s.result.passed) {
    const left = Math.max(0, READY_RUNS_NEEDED - s.examReadyDays)
    return s.result.ready
      ? left === 0
        ? 'Three ready days. You are ready for the real DMV!'
        : `This one counts. ${left} more ready ${left === 1 ? 'day' : 'days'} to go.`
      : 'You beat the pass line. Keep going for a ready run.'
  }
  if (mode === 'signs' && s.result.passed) return 'Every sign right. That is the hardest part of the real test.'
  if (rankUp) return `You are now a ${rankTitle(s.rankAfter)}. Every answer counts.`
  return 'Check it out in the Garage.'
}

// ---------- pieces ----------

function ScoreRow({ label, value, max, lines, ok }: { label: string; value: number; max: number; lines: { at: number; label: string }[]; ok: boolean }) {
  const pct = max ? Math.min(1, value / max) : 0
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-bold">{label}</span>
        <span className={`text-2xl font-extrabold tabular-nums whitespace-nowrap shrink-0 ${ok ? 'text-good' : 'text-text'}`}>
          {value}
          <span className="text-dim text-base font-bold"> / {max}</span>
        </span>
      </div>
      <div className={`relative mb-6 ${lines.length > 1 ? 'mt-6' : 'mt-2'}`}>
        <div className="h-4 rounded-full bg-panel2 border border-line overflow-hidden">
          <div className={`h-full rounded-full transition-[width] duration-700 ${ok ? 'bg-good' : 'bg-info'}`} style={{ width: `${pct * 100}%` }} />
        </div>
        {lines.map((l, i) => {
          const left = max ? Math.min(100, (l.at / max) * 100) : 100
          const above = i % 2 === 1 // alternate labels above / below so close lines never overlap
          const align = left > 88 ? 'right-0' : left < 12 ? 'left-0' : 'left-1/2 -translate-x-1/2'
          return (
            <div key={l.label} className="absolute top-[-4px] h-6 w-1" style={{ left: `calc(${left}% - 2px)` }}>
              <div className="w-1 h-6 rounded bg-gold" />
              <span className={`absolute ${align} ${above ? 'bottom-full mb-0.5' : 'top-full mt-0.5'} text-[0.7rem] font-bold text-gold whitespace-nowrap`}>
                {l.label} {l.at}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ReadyDays({ days, thisRunReady }: { days: number; thisRunReady: boolean }) {
  const shown = Math.min(days, READY_RUNS_NEEDED)
  const text = `Ready days: ${shown} of ${READY_RUNS_NEEDED}. A ready run is all signs right and ${READY_PART2} or more in Part 2. Do it on ${READY_RUNS_NEEDED} different days and you are ready for the real test.`
  return (
    <>
      <SectionTitle read={text}>Road to the real test</SectionTitle>
      <Panel>
        <div className="flex items-center gap-3">
          {Array.from({ length: READY_RUNS_NEEDED }, (_, i) => (
            <div
              key={i}
              className={`flex-1 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-extrabold ${
                i < shown ? 'bg-good/20 border-good text-good' : 'bg-panel2 border-line text-line'
              }`}
              aria-hidden
            >
              {i < shown ? '✓' : i + 1}
            </div>
          ))}
        </div>
        <p className="mt-3 text-dim">
          <strong className="text-text">
            {shown} of {READY_RUNS_NEEDED} ready days.
          </strong>{' '}
          Ready = all signs + {READY_PART2}/{EXAM_PART2_COUNT}, on {READY_RUNS_NEEDED} different days.
          {thisRunReady && <span className="text-good font-bold"> Today counts!</span>}
        </p>
      </Panel>
    </>
  )
}

function MissCard({ q, chosen }: { q: Question; chosen: number }) {
  const right = q.choices[q.answer]
  const picked = q.choices[chosen]
  const text = `${q.prompt} Right answer: ${right}. ${q.explain}`
  return (
    <Panel className="flex gap-3">
      {q.image && <SignImage id={q.image} size={64} className="shrink-0 self-start" />}
      <div className="flex-1 min-w-0">
        <p className="font-bold leading-snug">{q.prompt}</p>
        {picked !== undefined && picked !== right && (
          <p className="mt-2 text-dim">
            You picked: <span className="line-through decoration-bad/70">{picked}</span>
          </p>
        )}
        <p className="mt-1">
          <span className="text-good font-extrabold">✓ {right}</span>
        </p>
        <p className="mt-1 text-dim">{q.explain}</p>
      </div>
      <ReadAloudButton text={text} />
    </Panel>
  )
}

function CosmeticList({ ids, paint, center = false }: { ids: string[]; paint?: string; center?: boolean }) {
  return (
    <ul className={`flex flex-wrap gap-3 ${center ? 'justify-center' : ''}`}>
      {ids.map((id) => {
        const c = cosmeticById.get(id)
        if (!c) return null
        return (
          <li key={id} className="flex flex-col items-center w-24 p-2 rounded-xl bg-panel2 border-2 border-gold/50">
            <CosmeticIcon c={c} size={56} paint={paint} />
            <span className="text-sm font-bold text-center leading-tight mt-1">{c.name}</span>
            <span className="text-[0.7rem] uppercase tracking-wider text-dim">{c.slot}</span>
          </li>
        )
      })}
    </ul>
  )
}

