// Daily + weekly contracts and the 50-tier Season Track.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Contract } from '../engine/contracts'
import { COSMETICS, cosmeticById, type CosmeticDef } from '../engine/loadout'
import { SEASON_TIERS, SEASON_XP_PER_TIER, rankForXp, seasonTier } from '../engine/ranks'
import { useNav } from '../app/nav'
import { playSfx, vibrate } from '../services/sfx'
import { useGame } from '../store/gameStore'
import { Button, Panel, Pill, ProgressBar, ReadAloudButton, Screen } from '../ui/kit'
import { BottomAction, SectionTitle } from '../ui/b-controls'
import { CosmeticIcon } from '../ui/b-CosmeticIcon'
import { formatCountdown, msUntilMidnight, msUntilMonday, startQuickPlay, useReducedMotion, useTick } from '../ui/b-util'

const SEASON_REWARDS: Map<number, CosmeticDef[]> = (() => {
  const m = new Map<number, CosmeticDef[]>()
  for (const c of COSMETICS) {
    if (c.source.kind !== 'season') continue
    const arr = m.get(c.source.tier)
    if (arr) arr.push(c)
    else m.set(c.source.tier, [c])
  }
  return m
})()

interface Toast {
  key: number
  text: string
}

export function ContractsScreen() {
  const nav = useNav()
  const reduced = useReducedMotion()
  const contracts = useGame((s) => s.contracts)
  const refresh = useGame((s) => s.refreshContracts)
  const claimContract = useGame((s) => s.claimContract)
  const seasonXp = useGame((s) => s.seasonXp)
  const owned = useGame((s) => s.owned)
  const haptics = useGame((s) => s.settings.haptics)
  const paint = useGame((s) => cosmeticById.get(s.equipped.paint)?.value)
  const [toast, setToast] = useState<Toast | null>(null)
  useTick(30_000)

  // New day / week: make fresh contracts (resets at local midnight / Monday).
  useEffect(() => {
    refresh()
    const t = window.setTimeout(refresh, msUntilMidnight() + 1000)
    return () => window.clearTimeout(t)
  }, [refresh])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(t)
  }, [toast])

  const claim = (list: Contract[]) => {
    const s0 = useGame.getState()
    const tierBefore = seasonTier(s0.seasonXp)
    const rankBefore = rankForXp(s0.xp)
    let reward = 0
    for (const c of list) reward += claimContract(c.id)
    if (!reward) return
    const s1 = useGame.getState()
    const tierAfter = seasonTier(s1.seasonXp)
    const rankAfter = rankForXp(s1.xp)
    const extra = rankAfter > rankBefore ? ` · Rank ${rankAfter}!` : tierAfter > tierBefore ? ` · Season tier ${tierAfter}!` : ''
    playSfx(rankAfter > rankBefore ? 'rankup' : tierAfter > tierBefore ? 'unlock' : 'medal')
    vibrate([20, 40, 20], haptics)
    setToast({ key: Date.now(), text: `+${reward} XP${extra}` })
  }

  const all = [...contracts.daily, ...contracts.weekly]
  const claimable = all.filter((c) => c.done && !c.claimed)
  const tier = seasonTier(seasonXp)
  const intoTier = tier >= SEASON_TIERS ? SEASON_XP_PER_TIER : seasonXp - tier * SEASON_XP_PER_TIER

  return (
    <Screen title="Contracts" onBack={() => nav.back()}>
      <SectionTitle
        read={`Daily contracts. They reset at midnight. ${contracts.daily.map((c) => `${c.title}: ${c.progress} of ${c.goal}.`).join(' ')}`}
        right={<Pill>New in {formatCountdown(msUntilMidnight())}</Pill>}
      >
        Today
      </SectionTitle>
      <ContractList list={contracts.daily} onClaim={(c) => claim([c])} reduced={reduced} empty="New contracts are on the way." />

      <SectionTitle
        read={`Weekly contracts. They reset on Monday. ${contracts.weekly.map((c) => `${c.title}: ${c.progress} of ${c.goal}.`).join(' ')}`}
        right={<Pill>New in {formatCountdown(msUntilMonday())}</Pill>}
      >
        This week
      </SectionTitle>
      <ContractList list={contracts.weekly} onClaim={(c) => claim([c])} reduced={reduced} empty="New contracts are on the way." />

      {/* Season track */}
      <SectionTitle
        read={`Season Track. You are on tier ${tier} of ${SEASON_TIERS}. Every bit of XP moves you forward. ${SEASON_XP_PER_TIER - intoTier} XP to the next tier.`}
        right={
          <Pill className="text-gold border-gold/50">
            Tier {tier} / {SEASON_TIERS}
          </Pill>
        }
      >
        Season Track
      </SectionTitle>
      <Panel>
        <div className="flex justify-between text-sm mb-1">
          <span className="font-bold">{tier >= SEASON_TIERS ? 'Season complete!' : `Next: tier ${tier + 1}`}</span>
          <span className="text-dim tabular-nums">
            {tier >= SEASON_TIERS ? 'Max' : `${intoTier} / ${SEASON_XP_PER_TIER} XP`}
          </span>
        </div>
        <ProgressBar value={intoTier} max={SEASON_XP_PER_TIER} color="bg-gold" label="Season tier progress" />
        <p className="text-sm text-dim mt-2">All XP counts: runs, bosses, exams and contracts.</p>
        <SeasonTrack tier={tier} owned={owned} paint={paint} reduced={reduced} />
      </Panel>

      <BottomAction>
        {claimable.length > 0 ? (
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => claim(claimable)}
          >
            Claim {claimable.length === 1 ? 'reward' : `all ${claimable.length} rewards`}
          </Button>
        ) : (
          <Button variant="primary" size="lg" className="w-full" onClick={() => startQuickPlay()}>
            Play to make progress
          </Button>
        )}
      </BottomAction>

      {toast && (
        <div
          key={toast.key}
          role="status"
          className={`fixed left-1/2 -translate-x-1/2 bottom-28 z-40 px-5 py-3 rounded-2xl bg-gold text-ink text-xl font-extrabold shadow-[0_6px_0_#b45309] ${
            reduced ? '' : 'animate-pop'
          }`}
        >
          {toast.text}
        </div>
      )}
    </Screen>
  )
}

function ContractList({ list, onClaim, reduced, empty }: { list: Contract[]; onClaim: (c: Contract) => void; reduced: boolean; empty: string }) {
  if (!list.length) return <Panel className="text-dim">{empty}</Panel>
  return (
    <ul className="space-y-3">
      {list.map((c) => {
        const ready = c.done && !c.claimed
        return (
          <li key={c.id}>
            <Panel className={`flex flex-wrap items-center gap-3 ${ready ? '!border-good' : ''} ${c.claimed ? 'opacity-60' : ''}`}>
              <div className="text-3xl w-10 text-center shrink-0" aria-hidden>
                {c.claimed ? '✅' : ready ? '🎁' : iconFor(c)}
              </div>
              <div className="flex-1 min-w-[11rem]">
                <div className="flex items-start gap-2">
                  <p className="font-bold text-lg leading-snug flex-1">{c.title}</p>
                  <ReadAloudButton text={`${c.title}. ${c.progress} of ${c.goal}. Reward: ${c.rewardXp} XP.`} />
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <ProgressBar value={c.progress} max={c.goal} color={c.done ? 'bg-good' : 'bg-info'} className="flex-1" label={c.title} />
                  <span className="text-sm tabular-nums text-dim shrink-0">
                    {c.progress}/{c.goal}
                  </span>
                </div>
              </div>
              <div className="shrink-0 ml-auto">
                {c.claimed ? (
                  <span className="text-sm font-bold text-dim">Claimed</span>
                ) : ready ? (
                  <Button variant="good" className={`min-h-11 ${reduced ? '' : 'pulse-ring'}`} onClick={() => onClaim(c)}>
                    Claim +{c.rewardXp}
                  </Button>
                ) : (
                  <span className="text-sm font-bold text-gold">+{c.rewardXp} XP</span>
                )}
              </div>
            </Panel>
          </li>
        )
      })}
    </ul>
  )
}

function iconFor(c: Contract): string {
  switch (c.metric) {
    case 'runs':
      return '🏁'
    case 'streak':
      return '🔥'
    case 'correct':
      return '🎯'
    case 'signs':
      return '🪧'
    case 'numbers':
      return '🔢'
    case 'medals':
      return '🏅'
    case 'boss':
      return '👹'
    case 'days':
      return '📅'
    case 'perfect':
      return '💎'
  }
}

function SeasonTrack({ tier, owned, paint, reduced }: { tier: number; owned: string[]; paint?: string; reduced: boolean }) {
  const scroller = useRef<HTMLDivElement>(null)
  const current = useRef<HTMLLIElement>(null)

  // Scroll the current tier into the middle of the strip (horizontal only).
  useLayoutEffect(() => {
    const box = scroller.current
    const el = current.current
    if (!box || !el) return
    const target = el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2
    box.scrollTo({ left: Math.max(0, target), behavior: reduced ? 'auto' : 'smooth' })
  }, [tier, reduced])

  const tiers = Array.from({ length: SEASON_TIERS }, (_, i) => i + 1)
  return (
    <div ref={scroller} className="mt-4 -mx-4 px-4 overflow-x-auto pb-3 snap-x" tabIndex={0} aria-label="Season tiers, scroll sideways">
      <ol className="relative flex gap-2 w-max">
        {tiers.map((t) => {
          const rewards = SEASON_REWARDS.get(t) ?? []
          const reached = t <= tier
          const isNext = t === tier + 1
          const milestone = t % 10 === 0
          return (
            <li
              key={t}
              ref={isNext || (tier >= SEASON_TIERS && t === SEASON_TIERS) ? current : undefined}
              className={`snap-center shrink-0 w-24 rounded-2xl border-2 p-2 flex flex-col items-center gap-1 ${
                isNext ? 'border-gold bg-gold/10' : reached ? 'border-good/60 bg-good/5' : 'border-line bg-panel2'
              }`}
              aria-label={`Tier ${t}${rewards.length ? `: ${rewards.map((r) => r.name).join(', ')}` : ''}${reached ? ', reached' : ''}`}
            >
              <span className={`text-xs font-extrabold uppercase tracking-wider ${isNext ? 'text-gold' : reached ? 'text-good' : 'text-dim'}`}>
                {isNext ? 'Next' : `Tier ${t}`}
              </span>
              <div className="h-14 flex items-center justify-center">
                {rewards.length ? (
                  <span className={reached || owned.includes(rewards[0].id) ? '' : 'opacity-70'}>
                    <CosmeticIcon c={rewards[0]} size={52} paint={paint} />
                  </span>
                ) : (
                  <span className={`text-2xl ${reached ? 'text-good' : 'text-line'}`} aria-hidden>
                    {milestone ? '★' : '•'}
                  </span>
                )}
              </div>
              <span className="text-[0.7rem] leading-tight text-center min-h-[2em] font-bold">
                {rewards.map((r) => r.name).join(', ')}
              </span>
              {reached && <span className="text-good text-sm" aria-hidden>✓</span>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
