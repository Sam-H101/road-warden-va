// Progress: exam readiness, district mastery, exam history, medals case, totals.
import { useMemo } from 'react'
import { campaignDistricts, finalDistrict, isSignItem, itemsIn } from '../engine/content'
import { EXAM_PART1_COUNT, EXAM_PART2_COUNT, READY_RUNS_NEEDED, readyDays } from '../engine/exam'
import { MEDALS } from '../engine/medals'
import { rankProgress } from '../engine/ranks'
import { districtStars, readiness } from '../engine/readiness'
import { isMastered } from '../engine/scheduler'
import { useNav } from '../app/nav'
import { unlockedDistricts, useGame } from '../store/gameStore'
import { Button, Panel, Pill, ProgressBar, ReadAloudButton, Screen, Stars } from '../ui/kit'
import { BottomAction, SectionTitle } from '../ui/b-controls'
import { formatDay, formatDuration, startQuickPlay } from '../ui/b-util'

export function StatsScreen() {
  const nav = useNav()
  const items = useGame((s) => s.items)
  const starsMax = useGame((s) => s.starsMax)
  const missionsCleared = useGame((s) => s.missionsCleared)
  const bossesCleared = useGame((s) => s.bossesCleared)
  const examHistory = useGame((s) => s.examHistory)
  const medals = useGame((s) => s.medals)
  const stats = useGame((s) => s.stats)
  const playDays = useGame((s) => s.playDays)
  const xp = useGame((s) => s.xp)
  const prestige = useGame((s) => s.prestige)

  const r = useMemo(() => readiness(items), [items])
  const unlocked = unlockedDistricts({ missionsCleared })
  const ready = readyDays(examHistory).length
  const rp = rankProgress(xp)
  const answered = stats.correct + stats.wrong
  const accuracy = answered ? Math.round((stats.correct / answered) * 100) : 0
  const overallPct = Math.round(r.overall * 100)

  const readText = `Exam readiness ${overallPct} percent. Signs mastered: ${r.masteredSigns} of ${r.totalSigns}. Rules mastered: ${r.masteredGeneral} of ${r.totalGeneral}. Ready exam days: ${Math.min(ready, READY_RUNS_NEEDED)} of ${READY_RUNS_NEEDED}.`

  return (
    <Screen title="Progress" onBack={() => nav.back()}>
      {/* Readiness */}
      <Panel className="!p-5">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="text-sm font-bold uppercase tracking-wider text-dim">Exam readiness</p>
            <p className="text-5xl font-extrabold text-gold glow tabular-nums mt-1">{overallPct}%</p>
          </div>
          <ReadAloudButton text={readText} />
        </div>
        <ProgressBar value={r.overall} max={1} className="mt-3" label="Exam readiness" />
        <div className="grid grid-cols-1 min-[440px]:grid-cols-3 gap-3 mt-4">
          <Meter label="Signs mastered" value={r.masteredSigns} max={r.totalSigns} color="bg-bad" note="Part 1: all 10 must be right" />
          <Meter label="Rules mastered" value={r.masteredGeneral} max={r.totalGeneral} color="bg-info" note="Part 2: need 24 of 30" />
          <Meter label="Ready exam days" value={Math.min(ready, READY_RUNS_NEEDED)} max={READY_RUNS_NEEDED} color="bg-good" note="10/10 signs + 27/30, 3 days" />
        </div>
      </Panel>

      {/* Districts */}
      <SectionTitle read="Stars show how well you know each district. Mastery shows how many facts are locked in.">Districts</SectionTitle>
      <Panel className="!p-0 overflow-hidden">
        <ul className="divide-y divide-line">
          {campaignDistricts.map((d) => {
            const list = itemsIn(d.id)
            const mastered = list.filter((i) => isMastered(items[i.id], isSignItem(i))).length
            const stars = Math.max(starsMax[d.id] ?? 0, districtStars(d.id, items))
            const open = unlocked.includes(d.id)
            const boss = bossesCleared.includes(d.id)
            return (
              <li key={d.id}>
                <button
                  disabled={!open}
                  onClick={() => nav.go({ name: 'district', district: d.id })}
                  className={`w-full text-left flex items-center gap-3 px-4 py-3 min-h-16 ${open ? 'hover:bg-panel2' : 'opacity-50'}`}
                >
                  <span className="w-2 self-stretch rounded-full shrink-0" style={{ background: d.color }} aria-hidden />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold truncate">{d.name}</span>
                      {boss && <span title="Boss cleared" aria-label="Boss cleared">🏆</span>}
                      {!open && <span aria-label="Locked">🔒</span>}
                    </div>
                    {list.length ? (
                      <div className="flex items-center gap-2 mt-1">
                        <ProgressBar value={mastered} max={list.length} color="bg-good" className="flex-1" label={`${d.name} mastery`} />
                        <span className="text-xs text-dim tabular-nums shrink-0">
                          {mastered}/{list.length}
                        </span>
                      </div>
                    ) : (
                      <p className="text-xs text-dim mt-1">Coming soon</p>
                    )}
                  </div>
                  <Stars count={stars} size="text-base" />
                </button>
              </li>
            )
          })}
          {finalDistrict && (
            <li className="flex items-center gap-3 px-4 py-3 min-h-16">
              <span className="w-2 self-stretch rounded-full shrink-0 bg-gold" aria-hidden />
              <span className="font-bold flex-1">{finalDistrict.name}</span>
              {bossesCleared.includes(finalDistrict.id) ? <Pill className="text-good border-good/50">Cleared 🏆</Pill> : <Pill>Final boss</Pill>}
            </li>
          )}
        </ul>
      </Panel>

      {/* Exam history */}
      <SectionTitle>Exam Day history</SectionTitle>
      {examHistory.length === 0 ? (
        <Panel className="text-dim">No Exam Day runs yet. It opens when every district is cleared.</Panel>
      ) : (
        <Panel className="!p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[22rem]">
              <thead>
                <tr className="text-sm text-dim border-b border-line">
                  <th className="px-4 py-2 font-bold">Day</th>
                  <th className="px-2 py-2 font-bold">Signs</th>
                  <th className="px-2 py-2 font-bold">Rules</th>
                  <th className="px-4 py-2 font-bold">Result</th>
                </tr>
              </thead>
              <tbody>
                {examHistory
                  .slice()
                  .reverse()
                  .slice(0, 20)
                  .map((h, i) => (
                    <tr key={i} className="border-b border-line last:border-b-0">
                      <td className="px-4 py-2 whitespace-nowrap">{formatDay(h.day)}</td>
                      <td className={`px-2 py-2 tabular-nums ${h.part1Correct >= EXAM_PART1_COUNT ? 'text-good font-bold' : ''}`}>
                        {h.part1Correct}/{EXAM_PART1_COUNT}
                      </td>
                      <td className="px-2 py-2 tabular-nums">{h.part1Correct >= EXAM_PART1_COUNT ? `${h.part2Correct}/${EXAM_PART2_COUNT}` : '—'}</td>
                      <td className="px-4 py-2">
                        {h.ready ? (
                          <span className="text-good font-extrabold">Ready ✓</span>
                        ) : h.passed ? (
                          <span className="text-good font-bold">Passed</span>
                        ) : (
                          <span className="text-dim">Not yet</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* Medals */}
      <SectionTitle>Medals</SectionTitle>
      <ul className="grid grid-cols-2 min-[440px]:grid-cols-3 sm:grid-cols-4 gap-3">
        {MEDALS.map((m) => {
          const n = medals[m.id] ?? 0
          const got = n > 0
          return (
            <li key={m.id} className={`relative rounded-2xl border-2 p-3 text-center ${got ? 'border-gold/60 bg-gold/5' : 'border-line bg-panel'}`}>
              <div className="absolute right-1 top-1">
                <ReadAloudButton text={`${m.name}. ${m.description}${got ? ` Earned ${n} times.` : ''}`} className="!w-9 !h-9 !text-base" />
              </div>
              <div className="text-4xl mt-1" style={got ? undefined : { filter: 'brightness(0)', opacity: 0.35 }} aria-hidden>
                {m.icon}
              </div>
              <p className={`font-bold mt-1 leading-tight ${got ? '' : 'text-dim'}`}>{m.name}</p>
              <p className="text-xs text-dim mt-1 leading-snug">{m.description}</p>
              {got && <Pill className="mt-2 text-gold border-gold/50">×{n}</Pill>}
            </li>
          )
        })}
      </ul>

      {/* Totals */}
      <SectionTitle>Totals</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Stat label="Rank" value={`${rp.rank}`} sub={`${rp.title}${prestige ? ` · Prestige ${prestige}` : ''}`} />
        <Stat label="Runs" value={`${stats.runs}`} />
        <Stat label="Accuracy" value={answered ? `${accuracy}%` : '—'} sub={answered ? `${stats.correct} of ${answered}` : undefined} />
        <Stat label="Best streak" value={`${stats.bestStreak}`} />
        <Stat label="Time played" value={formatDuration(stats.timePlayedMs)} />
        <Stat label="Days played" value={`${playDays.length}`} />
      </div>

      <BottomAction>
        <Button variant="primary" size="lg" className="w-full" onClick={() => startQuickPlay()}>
          Practice my weak spots
        </Button>
      </BottomAction>
    </Screen>
  )
}

function Meter({ label, value, max, color, note }: { label: string; value: number; max: number; color: string; note: string }) {
  return (
    <div className="rounded-xl bg-panel2 border border-line p-3">
      <p className="text-sm font-bold">{label}</p>
      <p className="text-2xl font-extrabold tabular-nums">
        {value}
        <span className="text-base text-dim"> / {max}</span>
      </p>
      <ProgressBar value={value} max={max || 1} color={color} className="mt-1" label={label} />
      <p className="text-xs text-dim mt-1">{note}</p>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-panel border-2 border-line p-3">
      <p className="text-sm text-dim font-bold">{label}</p>
      <p className="text-2xl font-extrabold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-dim">{sub}</p>}
    </div>
  )
}
