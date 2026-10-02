// The hub. One giant PLAY button; everything else is a glance or a shortcut.
import { useMemo, useState } from 'react'
import { useNav } from '../app/nav'
import { districtById, missionCount, missionItems } from '../engine/content'
import type { Contract } from '../engine/contracts'
import { rankProgress, SEASON_TIERS, SEASON_XP_PER_TIER, seasonTier } from '../engine/ranks'
import { readiness } from '../engine/readiness'
import { buildQuick } from '../engine/runBuilder'
import { playSfx } from '../services/sfx'
import { isExamDayUnlocked, useGame } from '../store/gameStore'
import { RankBadge } from '../ui/badges'
import { Button, Panel, ProgressBar, ReadAloudButton, Stars } from '../ui/kit'
import { MentorLine } from '../ui/Mentor'
import {
  buildCtx,
  campaignNext,
  clearedSet,
  currentDistrict,
  dayStreak,
  dueCount,
  greeting,
  missionPlan,
  playedToday,
  startPlan,
} from '../ui/play'

/** Quick Play takes over the PLAY button once this many facts are due. */
const DUE_FOR_QUICK = 3

export function HomeScreen() {
  const s = useGame()
  const go = useNav((n) => n.go)
  const [notice, setNotice] = useState<string | null>(null)

  const prog = rankProgress(s.xp)
  const due = dueCount(s)
  const next = campaignNext(s)
  const streak = dayStreak(s.playDays)
  const today = playedToday(s.playDays)
  const ready = useMemo(() => readiness(s.items), [s.items])
  const examOpen = isExamDayUnlocked(s)

  const useQuick = due >= DUE_FOR_QUICK || !next
  const nextDistrict = next ? districtById.get(next.district) : undefined
  const playSub = useQuick
    ? due > 0
      ? `Quick Play · ${due} ${due === 1 ? 'fact' : 'facts'} to review`
      : 'Quick Play · mixed practice'
    : `${nextDistrict?.short ?? 'Campaign'} · Mission ${(next?.missionIndex ?? 0) + 1}`

  const play = () => {
    setNotice(null)
    if (useQuick) {
      if (startPlan(buildQuick(buildCtx()))) return
      if (next && startPlan(missionPlan(next.district, next.missionIndex))) return
    } else if (next) {
      if (startPlan(missionPlan(next.district, next.missionIndex))) return
    }
    setNotice('No roads are ready yet. New missions are on the way!')
  }

  const name = s.playerName || 'Warden'
  const mentorText = (() => {
    if (examOpen && !s.bossesCleared.includes('d16-examday')) return `${name}, Exam Day is open. You trained for this. Ready when you are.`
    if (!today && streak >= 1) return `${greeting()}, ${name}! Play today to make it ${streak + 1} days in a row.`
    if (due >= DUE_FOR_QUICK) return `${due} facts are ready to review. A Quick Play locks them in.`
    if (nextDistrict) return `${greeting()}, ${name}. ${nextDistrict.name} is waiting for you.`
    return `${greeting()}, ${name}. Keep those skills sharp!`
  })()

  return (
    <div className="min-h-dvh pb-10" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <main className="w-full max-w-3xl mx-auto px-4 py-4 flex flex-col gap-4">
        {/* Top bar: rank + streak */}
        <header className="flex items-center gap-3">
          <button onClick={() => go({ name: 'stats' })} aria-label={`Rank ${prog.rank}. Open stats`} className="rounded-xl">
            <RankBadge rank={prog.rank} prestige={s.prestige} size={58} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-extrabold truncate">{name}</span>
              <span className="text-sm font-bold text-gold shrink-0">{prog.title}</span>
            </div>
            <ProgressBar value={prog.into} max={prog.needed || 1} label="XP to next rank" className="mt-1" />
            <div className="text-xs text-dim mt-1">
              {prog.needed ? `${Math.max(0, prog.needed - prog.into)} XP to rank ${prog.rank + 1}` : 'Max rank!'}
            </div>
          </div>
          <div
            className={`shrink-0 flex flex-col items-center justify-center w-16 h-16 rounded-2xl border-2 ${today ? 'border-gold bg-gold/10' : 'border-line bg-panel'}`}
            aria-label={`${streak} day streak`}
            title="Days in a row"
          >
            <span className={`text-2xl leading-none ${today ? '' : 'grayscale opacity-60'}`} aria-hidden>
              🔥
            </span>
            <span className="text-sm font-extrabold">{streak}</span>
            <span className="text-[10px] text-dim leading-none">{streak === 1 ? 'day' : 'days'}</span>
          </div>
        </header>

        <MentorLine text={mentorText} />

        {/* THE primary action */}
        <div className="flex flex-col items-stretch gap-2">
          <Button variant="primary" size="xl" onClick={play} className="w-full pulse-ring py-6! text-4xl!">
            ▶ PLAY
          </Button>
          <div className="text-center text-dim font-bold">{playSub}</div>
          {notice && (
            <div role="status" className="text-center text-info font-bold">
              {notice}
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <CampaignCard />
          <ReadinessCard
            signs={Math.round(ready.signPct * 10)}
            rules={Math.round(ready.generalPct * 30)}
            overall={ready.overall}
            hasSigns={ready.totalSigns > 0}
            hasRules={ready.totalGeneral > 0}
          />
          <ContractsCard contracts={s.contracts.daily} />
          <SeasonCard seasonXp={s.seasonXp} />
        </div>

        <nav aria-label="More" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickLink icon="🗺️" label="Map" onClick={() => go({ name: 'map' })} />
          <QuickLink icon="🎮" label="Modes" onClick={() => go({ name: 'modes' })} />
          <QuickLink icon="🚗" label="Garage" onClick={() => go({ name: 'garage' })} />
          <QuickLink icon="📋" label="Contracts" onClick={() => go({ name: 'contracts' })} />
          <QuickLink icon="📚" label="Library" onClick={() => go({ name: 'library' })} />
          <QuickLink icon="📊" label="Stats" onClick={() => go({ name: 'stats' })} />
          <QuickLink icon="⚙️" label="Settings" onClick={() => go({ name: 'settings' })} />
          {examOpen && <QuickLink icon="🏁" label="Exam Day" onClick={() => go({ name: 'district', district: 'd16-examday' })} highlight />}
        </nav>
      </main>
    </div>
  )
}

function QuickLink({ icon, label, onClick, highlight = false }: { icon: string; label: string; onClick: () => void; highlight?: boolean }) {
  return (
    <button
      onClick={() => {
        playSfx('click')
        onClick()
      }}
      className={`min-h-16 flex items-center gap-3 px-4 py-3 rounded-2xl border-2 font-extrabold text-lg text-left transition hover:border-info ${
        highlight ? 'bg-gold/15 border-gold' : 'bg-panel border-line'
      }`}
    >
      <span className="text-2xl" aria-hidden>
        {icon}
      </span>
      {label}
    </button>
  )
}

function CampaignCard() {
  const s = useGame()
  const go = useNav((n) => n.go)
  const d = currentDistrict(s)
  const dist = d ? districtById.get(d) : undefined
  if (!d || !dist) {
    return (
      <Panel>
        <div className="text-sm font-bold text-dim uppercase tracking-wider">Campaign</div>
        <p className="text-lg mt-1">New districts are being built. Check back soon!</p>
      </Panel>
    )
  }
  const n = missionCount(d)
  const done = clearedSet(s, d).size
  const next = campaignNext(s)
  const nextIdx = next && next.district === d ? next.missionIndex : undefined
  const topics = nextIdx !== undefined ? missionItems(d, nextIdx).slice(0, 2).map((i) => i.title) : []
  const bossDone = s.bossesCleared.includes(d)
  return (
    <button
      onClick={() => {
        playSfx('click')
        go({ name: 'district', district: d })
      }}
      className="text-left bg-panel border-2 border-line rounded-2xl p-4 hover:border-info transition relative overflow-hidden"
      aria-label={`Continue campaign: ${dist.name}`}
    >
      <span className="absolute left-0 top-0 bottom-0 w-2" style={{ background: dist.color }} aria-hidden />
      <div className="pl-2">
        <div className="text-sm font-bold text-dim uppercase tracking-wider">Continue campaign</div>
        <div className="text-2xl font-extrabold mt-1">{dist.name}</div>
        <div className="flex items-center gap-2 mt-1">
          <Stars count={s.starsMax[d] ?? 0} size="text-lg" />
        </div>
        <div className="mt-2 text-lg">
          {nextIdx !== undefined ? (
            <>
              Next: <b>Mission {nextIdx + 1}</b> <span className="text-dim">of {n}</span>
            </>
          ) : bossDone ? (
            <>District cleared! 🏆</>
          ) : (
            <>
              Boss ready: <b>{dist.boss}</b>
            </>
          )}
        </div>
        {topics.length > 0 && <div className="text-dim text-sm mt-1 truncate">{topics.join(' · ')}</div>}
        <ProgressBar value={done} max={n || 1} color="bg-info" className="mt-3" label="Missions cleared" />
      </div>
    </button>
  )
}

function ReadinessCard({ signs, rules, overall, hasSigns, hasRules }: { signs: number; rules: number; overall: number; hasSigns: boolean; hasRules: boolean }) {
  const go = useNav((n) => n.go)
  const signLine = hasSigns ? `Signs: ${signs} of 10 ready.` : 'Signs: coming soon.'
  const ruleLine = hasRules ? `Rules: ${rules} of 30 ready.` : 'Rules: coming soon.'
  const speech = `Exam readiness. ${signLine} You need all 10. ${ruleLine} You need 24.`
  const pct = Math.round(overall * 100)
  return (
    <Panel>
      <div className="flex items-center gap-2">
        <div className="flex-1 text-sm font-bold text-dim uppercase tracking-wider">Exam readiness</div>
        <ReadAloudButton text={speech} />
      </div>
      <div className="flex items-end gap-3 mt-1">
        <div className="text-4xl font-extrabold">{pct}%</div>
        <ProgressBar value={overall} max={1} color={pct >= 85 ? 'bg-good' : 'bg-gold'} className="mb-2" label="Exam readiness" />
      </div>
      <ul className="mt-2 space-y-2 text-lg">
        <li className="flex items-center gap-2">
          <span aria-hidden>🛑</span>
          <span className="flex-1">
            {hasSigns ? (
              <>
                Signs: <b className={signs >= 10 ? 'text-good' : ''}>{signs} of 10</b> ready
              </>
            ) : (
              'Signs: coming soon'
            )}
          </span>
          <span className="text-sm text-dim">need 10</span>
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden>📘</span>
          <span className="flex-1">
            {hasRules ? (
              <>
                Rules: <b className={rules >= 24 ? 'text-good' : ''}>{rules} of 30</b> ready
              </>
            ) : (
              'Rules: coming soon'
            )}
          </span>
          <span className="text-sm text-dim">need 24</span>
        </li>
      </ul>
      <button onClick={() => go({ name: 'stats' })} className="mt-2 text-info font-bold min-h-11">
        See details →
      </button>
    </Panel>
  )
}

function ContractsCard({ contracts }: { contracts: Contract[] }) {
  const claim = useGame((s) => s.claimContract)
  const go = useNav((n) => n.go)
  const [flash, setFlash] = useState<{ id: string; xp: number } | null>(null)
  return (
    <Panel>
      <div className="flex items-center">
        <div className="flex-1 text-sm font-bold text-dim uppercase tracking-wider">Today's contracts</div>
        <button onClick={() => go({ name: 'contracts' })} className="text-info font-bold min-h-11 px-2">
          All →
        </button>
      </div>
      {contracts.length === 0 ? (
        <p className="text-dim mt-1">New contracts arrive tomorrow.</p>
      ) : (
        <ul className="mt-1 space-y-3">
          {contracts.map((c) => (
            <li key={c.id} className="flex items-center gap-3">
              <span className="text-xl w-7 text-center" aria-hidden>
                {c.claimed ? '✅' : c.done ? '🎁' : '🎯'}
              </span>
              <div className="flex-1 min-w-0">
                <div className={`font-bold leading-tight ${c.claimed ? 'text-dim line-through' : ''}`}>{c.title}</div>
                {!c.done && <ProgressBar value={c.progress} max={c.goal} color="bg-info" className="mt-1" label={`${c.progress} of ${c.goal}`} />}
                {!c.done && (
                  <div className="text-xs text-dim mt-0.5">
                    {c.progress} / {c.goal} · +{c.rewardXp} XP
                  </div>
                )}
              </div>
              {c.done && !c.claimed && (
                <Button
                  variant="good"
                  size="sm"
                  className="min-h-11 px-4"
                  onClick={() => {
                    const xp = claim(c.id)
                    if (xp) {
                      playSfx('unlock')
                      setFlash({ id: c.id, xp })
                    }
                  }}
                >
                  Claim +{c.rewardXp}
                </Button>
              )}
              {flash?.id === c.id && (
                <span className="text-good font-extrabold animate-pop" role="status">
                  +{flash.xp} XP
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function SeasonCard({ seasonXp }: { seasonXp: number }) {
  const tier = seasonTier(seasonXp)
  const maxed = tier >= SEASON_TIERS
  const into = seasonXp % SEASON_XP_PER_TIER
  return (
    <Panel>
      <div className="text-sm font-bold text-dim uppercase tracking-wider">Season track</div>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-3xl font-extrabold text-nitro">Tier {tier}</span>
        <span className="text-dim">of {SEASON_TIERS}</span>
      </div>
      <ProgressBar value={maxed ? 1 : into} max={maxed ? 1 : SEASON_XP_PER_TIER} color="bg-nitro" className="mt-2" label="Season tier progress" />
      <div className="text-sm text-dim mt-1">{maxed ? 'Season complete! Legend status.' : `${SEASON_XP_PER_TIER - into} XP to tier ${tier + 1}`}</div>
    </Panel>
  )
}
