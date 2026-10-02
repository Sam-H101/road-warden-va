// One district: mentor intro, missions, boss, study cards.
import { useState } from 'react'
import { useNav } from '../app/nav'
import { campaignDistricts, districtById, itemsIn, missionCount, missionItems, questionsByItem, story, storyFor } from '../engine/content'
import { BOSS_PASS_PCT, BOSS_QUESTION_COUNT, EXAM_PART1_COUNT, EXAM_PART2_COUNT, EXAM_PART2_PASS, READY_PART2, READY_RUNS_NEEDED } from '../engine/exam'
import type { District, DistrictId } from '../engine/types'
import { isExamDayUnlocked, isSignTestUnlocked, unlockedDistricts, useGame } from '../store/gameStore'
import { Button, Panel, Pill, ProgressBar, ReadAloudButton, Screen, Stars } from '../ui/kit'
import { MentorLine } from '../ui/Mentor'
import { clearedSet, isMissionOpen, missionKey, missionPlan, nextMissionIn, startPlan } from '../ui/play'

export function DistrictScreen({ district }: { district: DistrictId }) {
  const d = districtById.get(district)
  const nav = useNav()
  if (!d) {
    return (
      <Screen title="Not found" onBack={nav.back}>
        <Panel>That district is not on the map yet.</Panel>
      </Screen>
    )
  }
  if (d.isFinal) return <ExamDayDistrict d={d} />
  return <CampaignDistrict d={d} />
}

function hasBossQuestions(d: DistrictId): boolean {
  return itemsIn(d).some((i) => (questionsByItem.get(i.id) ?? []).length > 0)
}

function CampaignDistrict({ d }: { d: District }) {
  const s = useGame()
  const nav = useNav()
  const [notice, setNotice] = useState<string | null>(null)
  const lines = storyFor(d.id)
  const n = missionCount(d.id)
  const done = clearedSet(s, d.id)
  const nextIdx = nextMissionIn(s, d.id)
  const allDone = n > 0 && nextIdx === undefined
  const bossCleared = s.bossesCleared.includes(d.id)
  const bossAvailable = hasBossQuestions(d.id)
  const unlocked = unlockedDistricts(s)
  const order = campaignDistricts.findIndex((x) => x.id === d.id)
  const nextDistrict = campaignDistricts[order + 1]
  const nextDistrictOpen = !!nextDistrict && unlocked.includes(nextDistrict.id) && missionCount(nextDistrict.id) > 0

  const play = (i: number, ghost?: number) => {
    setNotice(null)
    if (!startPlan(missionPlan(d.id, i, ghost))) setNotice('This mission has no road events yet. Try another one!')
  }
  const fightBoss = () => nav.go({ name: 'exam', kind: 'boss', district: d.id })

  // Exactly one primary action.
  let primary: { label: string; run: () => void } | null = null
  if (nextIdx !== undefined) primary = { label: `START MISSION ${nextIdx + 1} ▶`, run: () => play(nextIdx) }
  else if (allDone && bossAvailable && !bossCleared) primary = { label: `FIGHT THE BOSS ⚔️`, run: fightBoss }
  else if (nextDistrictOpen) primary = { label: `NEXT: ${nextDistrict.short.toUpperCase()} →`, run: () => nav.replace({ name: 'district', district: nextDistrict.id }) }
  else if (!nextDistrict && isExamDayUnlocked(s)) primary = { label: 'GO TO EXAM DAY 🏁', run: () => nav.go({ name: 'district', district: 'd16-examday' }) }

  const firstVisit = done.size === 0
  const mentorText = bossCleared && lines?.outro ? lines.outro : (lines?.intro ?? []).join(' ') || d.blurb

  return (
    <Screen title={d.name} onBack={nav.back} right={<Stars count={s.starsMax[d.id] ?? 0} size="text-lg" />}>
      <div className="flex flex-col gap-4 pb-28">
        <div className="relative rounded-2xl overflow-hidden border-2 border-line p-4" style={{ background: `linear-gradient(135deg, ${d.color}33, #141a2e 65%)` }}>
          <div className="text-xs font-extrabold tracking-widest uppercase" style={{ color: d.color }}>
            District {d.order}
          </div>
          <div className="flex items-start gap-2 mt-1">
            <p className="flex-1 text-xl font-bold leading-snug">{d.blurb}</p>
            <ReadAloudButton text={d.blurb} />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <ProgressBar value={done.size} max={n || 1} color="bg-info" label="Missions cleared" />
            <span className="text-sm font-bold text-dim whitespace-nowrap">
              {done.size}/{n} missions
            </span>
          </div>
        </div>

        <MentorLine text={mentorText} auto={firstVisit} />

        {notice && (
          <div role="status" className="text-info font-bold text-center">
            {notice}
          </div>
        )}

        {n === 0 ? (
          <Panel>
            <p className="text-lg">🚧 Missions for this district are still being built. Check back soon!</p>
          </Panel>
        ) : (
          <section aria-label="Missions" className="flex flex-col gap-3">
            <h2 className="text-lg font-extrabold text-dim uppercase tracking-wider">Missions</h2>
            {Array.from({ length: n }, (_, i) => {
              const cleared = done.has(i)
              const open = isMissionOpen(s, d.id, i)
              const best = s.bestScores[missionKey(d.id, i)] ?? 0
              const topics = missionItems(d.id, i).map((it) => it.title)
              const isNext = i === nextIdx
              return (
                <div
                  key={i}
                  className={`rounded-2xl border-2 p-3 flex items-center gap-3 ${isNext ? 'border-gold bg-gold/5' : 'border-line bg-panel'} ${open ? '' : 'opacity-60'}`}
                >
                  <div
                    className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center text-xl font-extrabold ${
                      cleared ? 'bg-good text-ink' : isNext ? 'bg-gold text-ink' : 'bg-panel2 text-dim'
                    }`}
                    aria-hidden
                  >
                    {cleared ? '✓' : open ? i + 1 : '🔒'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-lg">
                      Mission {i + 1}
                      {cleared && <span className="sr-only"> (cleared)</span>}
                    </div>
                    <div className="text-sm text-dim truncate">{topics.slice(0, 3).join(' · ')}</div>
                    {best > 0 && <div className="text-xs font-bold text-gold mt-0.5">Best: {best.toLocaleString()}</div>}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                    {open && !isNext && (
                      <Button size="sm" className="min-h-11" onClick={() => play(i)} aria-label={`Play mission ${i + 1}`}>
                        {cleared ? 'Replay' : 'Play'}
                      </Button>
                    )}
                    {cleared && best > 0 && (
                      <Button size="sm" className="min-h-11 border-nitro! text-nitro" onClick={() => play(i, best)} aria-label={`Ghost race mission ${i + 1}`}>
                        👻 Ghost race
                      </Button>
                    )}
                    {isNext && <Pill className="border-gold text-gold">Next up</Pill>}
                  </div>
                </div>
              )
            })}
          </section>
        )}

        {n > 0 && bossAvailable && (
          <BossCard d={d} unlocked={allDone} cleared={bossCleared} missionsLeft={n - done.size} onFight={fightBoss} isPrimary={primary?.run === fightBoss} />
        )}

        <button
          onClick={() => nav.go({ name: 'library', district: d.id })}
          className="min-h-14 flex items-center gap-3 px-4 rounded-2xl bg-panel border-2 border-line hover:border-info text-left font-extrabold text-lg"
        >
          <span className="text-2xl" aria-hidden>
            📚
          </span>
          <span className="flex-1">Study cards for {d.short}</span>
          <span className="text-dim">→</span>
        </button>
      </div>

      {primary && <StickyPrimary label={primary.label} onClick={primary.run} />}
    </Screen>
  )
}

function BossCard({
  d,
  unlocked,
  cleared,
  missionsLeft,
  onFight,
  isPrimary,
}: {
  d: District
  unlocked: boolean
  cleared: boolean
  missionsLeft: number
  onFight: () => void
  isPrimary: boolean
}) {
  const intro = storyFor(d.id)?.bossIntro ?? `${d.boss} is waiting.`
  return (
    <section
      aria-label="Boss"
      className={`rounded-2xl border-2 p-4 ${unlocked && !cleared ? 'border-bad bg-bad/10' : 'border-line bg-panel'}`}
    >
      <div className="flex items-center gap-3">
        <div className="text-4xl" aria-hidden>
          {cleared ? '👑' : unlocked ? '⚔️' : '🔒'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-extrabold tracking-widest uppercase text-bad">Boss</div>
          <div className="text-xl font-extrabold">{d.boss}</div>
        </div>
        {cleared && <Pill className="border-gold text-gold">Beaten</Pill>}
      </div>
      {unlocked ? (
        <>
          <div className="flex items-start gap-2 mt-3">
            <p className="flex-1 text-lg">{intro}</p>
            <ReadAloudButton text={intro} />
          </div>
          <p className="text-sm text-dim mt-1">
            {BOSS_QUESTION_COUNT} questions, just like the DMV test. Get {Math.ceil(BOSS_QUESTION_COUNT * BOSS_PASS_PCT)} right to win.
          </p>
          {!isPrimary && (
            <Button className="mt-3 w-full" onClick={onFight}>
              {cleared ? 'Rematch' : 'Fight the boss'}
            </Button>
          )}
        </>
      ) : (
        <p className="mt-2 text-lg text-dim">
          Clear {missionsLeft} more {missionsLeft === 1 ? 'mission' : 'missions'} to face the boss.
        </p>
      )}
    </section>
  )
}

function StickyPrimary({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-ink via-ink/95 to-transparent pt-6 px-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
      <div className="max-w-3xl mx-auto">
        <Button variant="primary" size="lg" className="w-full" onClick={onClick}>
          {label}
        </Button>
      </div>
    </div>
  )
}

// ---------- Exam Day (the final district) ----------

function ExamDayDistrict({ d }: { d: District }) {
  const s = useGame()
  const nav = useNav()
  const open = isExamDayUnlocked(s)
  const signsOpen = isSignTestUnlocked(s)
  const readyDays = new Set(s.examHistory.filter((h) => h.ready).map((h) => h.day)).size
  const pep = story.examDayPepTalk.join(' ')
  const rules = `Part one has ${EXAM_PART1_COUNT} sign questions. You need all ${EXAM_PART1_COUNT}. Part two has ${EXAM_PART2_COUNT} questions. You need ${EXAM_PART2_PASS}.`
  const left = campaignDistricts.filter((x) => missionCount(x.id) > 0 && (s.missionsCleared[x.id]?.length ?? 0) < missionCount(x.id)).length
  const recent = s.examHistory.slice(-5).reverse()

  return (
    <Screen title={d.name} onBack={nav.back}>
      <div className="flex flex-col gap-4 pb-28">
        <MentorLine text={open ? pep : 'Exam Day is the final boss. Clear every district first, then come back here.'} auto />

        <Panel>
          <div className="flex items-start gap-2">
            <h2 className="flex-1 text-lg font-extrabold text-dim uppercase tracking-wider">How it works</h2>
            <ReadAloudButton text={rules} />
          </div>
          <ul className="mt-2 space-y-2 text-lg">
            <li>
              🛑 <b>Part 1:</b> {EXAM_PART1_COUNT} signs. Need <b>all {EXAM_PART1_COUNT}</b>.
            </li>
            <li>
              📘 <b>Part 2:</b> {EXAM_PART2_COUNT} questions. Need <b>{EXAM_PART2_PASS}</b>.
            </li>
            <li className="text-dim text-base">No perks at the DMV, so none here either.</li>
          </ul>
        </Panel>

        <Panel>
          <h2 className="text-lg font-extrabold text-dim uppercase tracking-wider">Ready for the real test?</h2>
          <p className="text-lg mt-1">
            Score 10/10 signs and {READY_PART2}/30 on {READY_RUNS_NEEDED} different days.
          </p>
          <div className="flex items-center gap-3 mt-3">
            <ProgressBar value={readyDays} max={READY_RUNS_NEEDED} color="bg-good" label="Ready days" />
            <span className="font-extrabold whitespace-nowrap">
              {readyDays} / {READY_RUNS_NEEDED} days
            </span>
          </div>
          {readyDays >= READY_RUNS_NEEDED && <p className="text-good font-extrabold text-lg mt-2">You are ready for the DMV! 🎉</p>}
        </Panel>

        {recent.length > 0 && (
          <Panel>
            <h2 className="text-lg font-extrabold text-dim uppercase tracking-wider">Recent tries</h2>
            <ul className="mt-2 space-y-1">
              {recent.map((h, i) => (
                <li key={i} className="flex items-center gap-3 text-lg">
                  <span aria-hidden>{h.ready ? '🌟' : h.passed ? '✅' : '📝'}</span>
                  <span className="flex-1 text-dim">{h.day}</span>
                  <span>
                    Signs {h.part1Correct}/10 · Rules {h.part2Correct}/30
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {!open && (
          <Panel>
            <p className="text-lg">
              🔒 {left} {left === 1 ? 'district' : 'districts'} left to clear.
            </p>
          </Panel>
        )}

        {signsOpen && (
          <Button size="lg" className="w-full" onClick={() => nav.go({ name: 'exam', kind: 'signs' })}>
            🛑 Practice: Sign Test (10 signs)
          </Button>
        )}
      </div>
      {open && <StickyPrimary label="START EXAM DAY 🏁" onClick={() => nav.go({ name: 'exam', kind: 'exam' })} />}
    </Screen>
  )
}
