// Garage: car preview, cosmetics by slot, and the perk loadout.
import { useMemo, useState } from 'react'
import { districtById } from '../engine/content'
import { COSMETICS, MAX_EQUIPPED_PERKS, PERKS, cosmeticById, type CosmeticDef, type CosmeticSlot } from '../engine/loadout'
import type { PerkId } from '../engine/run'
import { useNav } from '../app/nav'
import { playHorn, playSfx } from '../services/sfx'
import { ownedPerks, useGame } from '../store/gameStore'
import { Button, Panel, Pill, ReadAloudButton, Screen, Stars } from '../ui/kit'
import { BottomAction, SectionTitle } from '../ui/b-controls'
import { CarPreview } from '../ui/b-CarPreview'
import { CosmeticIcon } from '../ui/b-CosmeticIcon'
import { sourceLabel, startQuickPlay, useReducedMotion } from '../ui/b-util'

const SLOTS: { slot: CosmeticSlot; label: string; icon: string }[] = [
  { slot: 'car', label: 'Car', icon: '🚗' },
  { slot: 'paint', label: 'Paint', icon: '🎨' },
  { slot: 'trail', label: 'Trail', icon: '💨' },
  { slot: 'horn', label: 'Horn', icon: '📯' },
  { slot: 'decal', label: 'Decal', icon: '⭐' },
]

function valueOf(id: string | undefined, fallback = ''): string {
  return (id && cosmeticById.get(id)?.value) ?? fallback
}

export function GarageScreen() {
  const nav = useNav()
  const reduced = useReducedMotion()
  const owned = useGame((s) => s.owned)
  const equipped = useGame((s) => s.equipped)
  const equip = useGame((s) => s.equip)
  const starsMax = useGame((s) => s.starsMax)
  const perksEquipped = useGame((s) => s.perksEquipped)
  const togglePerk = useGame((s) => s.togglePerk)

  const [slot, setSlot] = useState<CosmeticSlot>('car')
  const [preview, setPreview] = useState<Partial<Record<CosmeticSlot, string>>>({})

  const ownedSet = useMemo(() => new Set(owned), [owned])
  const shown = { ...equipped, ...preview }
  const lockedPreview = Object.values(preview)
    .map((id) => (id ? cosmeticById.get(id) : undefined))
    .find((c): c is CosmeticDef => !!c && !ownedSet.has(c.id))

  const items = COSMETICS.filter((c) => c.slot === slot)
  const perksOwned = ownedPerks({ starsMax })

  const pick = (c: CosmeticDef) => {
    if (c.slot === 'horn') playHorn(c.value)
    if (ownedSet.has(c.id)) {
      equip(c.slot, c.id)
      if (c.slot !== 'horn') playSfx('click')
      setPreview((p) => {
        const next = { ...p }
        delete next[c.slot]
        return next
      })
    } else {
      if (c.slot !== 'horn') playSfx('tick')
      setPreview((p) => ({ ...p, [c.slot]: c.id }))
    }
  }

  const carName = cosmeticById.get(shown.car)?.name ?? 'Car'
  const paintName = cosmeticById.get(shown.paint)?.name ?? ''

  return (
    <Screen title="Garage" onBack={() => nav.back()}>
      {/* Preview stage */}
      <section
        className="relative rounded-3xl border-2 border-line overflow-hidden"
        style={{ background: 'radial-gradient(120% 80% at 50% 0%, #26315a 0%, #141a2e 55%, #0b1020 100%)' }}
      >
        <svg aria-hidden className="absolute inset-0 w-full h-full" viewBox="0 0 400 300" preserveAspectRatio="none">
          <polygon points="170,40 230,40 400,300 0,300" fill="#1b2340" />
          <polygon points="170,40 176,40 30,300 0,300" fill="#2a3558" />
          <polygon points="224,40 230,40 400,300 370,300" fill="#2a3558" />
          <line x1="190" y1="40" x2="135" y2="300" stroke="#fbbf24" strokeOpacity="0.35" strokeWidth="3" strokeDasharray="14 18" />
          <line x1="210" y1="40" x2="265" y2="300" stroke="#fbbf24" strokeOpacity="0.35" strokeWidth="3" strokeDasharray="14 18" />
        </svg>
        <div className="relative flex justify-center pt-6 pb-2 px-4">
          <CarPreview
            style={valueOf(shown.car, 'compact')}
            paint={valueOf(shown.paint, '#38bdf8')}
            decal={valueOf(shown.decal)}
            trail={valueOf(shown.trail)}
            size={300}
            animate={!reduced}
            title={`${paintName} ${carName}`}
          />
        </div>
        <div className="relative flex flex-wrap items-center justify-between gap-2 px-4 pb-4">
          <div>
            <p className="text-xl font-extrabold">{carName}</p>
            <p className="text-dim text-sm">
              {paintName}
              {cosmeticById.get(shown.decal)?.value ? ` · ${cosmeticById.get(shown.decal)?.name}` : ''}
            </p>
          </div>
          <Button size="sm" className="min-h-11" onClick={() => playHorn(valueOf(shown.horn, 'classic'))} aria-label="Test horn">
            📯 Honk
          </Button>
        </div>
        {lockedPreview && (
          <div className="relative flex flex-wrap items-center gap-3 border-t-2 border-line bg-ink/70 px-4 py-3">
            <span className="text-2xl" aria-hidden>
              🔒
            </span>
            <p className="flex-1 min-w-[10rem]">
              <strong>{lockedPreview.name}</strong> is locked. <span className="text-gold font-bold">{sourceLabel(lockedPreview)}</span> to unlock it.
            </p>
            <Button size="sm" className="min-h-11" onClick={() => setPreview({})}>
              Back to my car
            </Button>
          </div>
        )}
      </section>

      {/* Slot tabs */}
      <div role="tablist" aria-label="Garage slots" className="mt-5 flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {SLOTS.map((s) => {
          const total = COSMETICS.filter((c) => c.slot === s.slot).length
          const have = COSMETICS.filter((c) => c.slot === s.slot && ownedSet.has(c.id)).length
          const on = slot === s.slot
          return (
            <button
              key={s.slot}
              role="tab"
              aria-selected={on}
              onClick={() => {
                playSfx('click')
                setSlot(s.slot)
              }}
              className={`shrink-0 min-h-12 px-4 rounded-xl border-2 font-bold flex items-center gap-2 transition-colors ${
                on ? 'bg-info text-ink border-info' : 'bg-panel2 border-line text-dim hover:text-text'
              }`}
            >
              <span aria-hidden>{s.icon}</span>
              {s.label}
              <span className={`text-xs ${on ? 'text-ink/70' : 'text-dim'}`}>
                {have}/{total}
              </span>
            </button>
          )
        })}
      </div>

      {/* Items */}
      <ul role="tabpanel" className="mt-3 grid grid-cols-2 min-[440px]:grid-cols-3 sm:grid-cols-4 gap-3">
        {items.map((c) => {
          const isOwned = ownedSet.has(c.id)
          const isEquipped = equipped[c.slot] === c.id
          const isPreview = preview[c.slot] === c.id
          return (
            <li key={c.id}>
              <button
                onClick={() => pick(c)}
                aria-pressed={isEquipped}
                aria-label={`${c.name}. ${isEquipped ? 'Equipped' : isOwned ? 'Tap to equip' : `Locked. ${sourceLabel(c)}`}`}
                className={`relative w-full h-full min-h-36 flex flex-col items-center gap-1 p-3 rounded-2xl border-2 text-center transition-colors ${
                  isEquipped
                    ? 'border-gold bg-gold/10'
                    : isPreview
                      ? 'border-info bg-info/10'
                      : isOwned
                        ? 'border-line bg-panel hover:border-info'
                        : 'border-line/60 bg-panel/50 hover:border-line'
                }`}
              >
                <span className={isOwned ? '' : 'opacity-40 grayscale'}>
                  <CosmeticIcon c={c} size={64} paint={valueOf(shown.paint, '#38bdf8')} />
                </span>
                <span className={`font-bold leading-tight ${isOwned ? '' : 'text-dim'}`}>{c.name}</span>
                {isEquipped ? (
                  <span className="text-xs font-extrabold text-gold uppercase tracking-wider">Equipped</span>
                ) : isOwned ? (
                  <span className="text-xs text-dim">{c.slot === 'horn' ? 'Tap to hear + equip' : 'Tap to equip'}</span>
                ) : (
                  <span className="text-xs text-dim leading-tight">
                    <span aria-hidden>🔒 </span>
                    {sourceLabel(c)}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      {/* Perks */}
      <SectionTitle
        read={`Perks are learning aids you earn by mastering districts. You can equip ${MAX_EQUIPPED_PERKS}. Perks are off on Exam Day, just like at the real DMV.`}
        right={
          <Pill className="text-sm">
            {perksEquipped.length} / {MAX_EQUIPPED_PERKS} equipped
          </Pill>
        }
      >
        Perks
      </SectionTitle>
      <p className="text-dim -mt-1 mb-3">Earned by mastery. No perks at the DMV, so they are off on Exam Day.</p>
      <div className="space-y-3">
        {PERKS.map((p) => (
          <PerkCard
            key={p.id}
            id={p.id}
            ownedPerk={perksOwned.includes(p.id)}
            equipped={perksEquipped.includes(p.id)}
            full={perksEquipped.length >= MAX_EQUIPPED_PERKS}
            stars={starsMax[p.unlock.district] ?? 0}
            onToggle={() => {
              togglePerk(p.id)
              playSfx(perksEquipped.includes(p.id) ? 'click' : 'unlock')
            }}
          />
        ))}
      </div>

      <BottomAction>
        <Button variant="primary" size="lg" className="w-full" onClick={() => startQuickPlay()}>
          Drive this ride
        </Button>
      </BottomAction>
    </Screen>
  )
}

function PerkCard({
  id,
  ownedPerk,
  equipped,
  full,
  stars,
  onToggle,
}: {
  id: PerkId
  ownedPerk: boolean
  equipped: boolean
  full: boolean
  stars: number
  onToggle: () => void
}) {
  const p = PERKS.find((x) => x.id === id)!
  const d = districtById.get(p.unlock.district)
  const need = `Get ${p.unlock.stars} stars in ${d?.name ?? p.unlock.district}`
  return (
    <Panel className={`flex flex-wrap items-center gap-3 ${equipped ? '!border-gold bg-gold/5' : ''} ${ownedPerk ? '' : 'opacity-80'}`}>
      <div
        className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center text-3xl border-2 ${
          ownedPerk ? 'bg-panel2 border-line' : 'bg-panel2 border-line grayscale opacity-50'
        }`}
        aria-hidden
      >
        {p.icon}
      </div>
      <div className="flex-1 min-w-[12rem]">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-extrabold">{p.name}</h3>
          {!ownedPerk && <span aria-label="Locked">🔒</span>}
        </div>
        <p className="text-dim">{p.description}</p>
        {!ownedPerk && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-bold">{need}:</span>
            <Stars count={Math.min(stars, p.unlock.stars)} max={p.unlock.stars} size="text-lg" />
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <ReadAloudButton text={`${p.name}. ${p.description} ${ownedPerk ? '' : `To unlock: ${need}.`}`} />
        {ownedPerk &&
          (equipped ? (
            <Button variant="secondary" className="min-h-11" onClick={onToggle}>
              Equipped ✓
            </Button>
          ) : (
            <Button variant="good" className="min-h-11" onClick={onToggle} disabled={full} title={full ? `You can equip ${MAX_EQUIPPED_PERKS}. Unequip one first.` : undefined}>
              Equip
            </Button>
          ))}
      </div>
      {ownedPerk && !equipped && full && <p className="basis-full text-sm text-dim">Slots full. Tap an equipped perk to free a slot.</p>}
    </Panel>
  )
}
