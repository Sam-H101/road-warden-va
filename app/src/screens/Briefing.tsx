// Intel cards for new items before a drive. One fact per card.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNav } from '../app/nav'
import { itemById } from '../engine/content'
import type { RunPlan } from '../engine/run'
import { MAX_NEW_PER_RUN } from '../engine/runBuilder'
import type { Item } from '../engine/types'
import { useGame } from '../store/gameStore'
import { Button, ReadAloudButton, Screen, SignImage, useAutoRead } from '../ui/kit'
import { MentorAvatar } from '../ui/Mentor'
import { unbriefedItems } from '../ui/play'
import { Swiper } from '../ui/Swiper'

/** Cards per briefing (shared with the run builder's new-item limit). */
const MAX_CARDS = MAX_NEW_PER_RUN
/** The very first briefing stays short: the learner has just read the how-to cards. */
const FIRST_CARDS = 2

export function BriefingScreen({ plan }: { plan: RunPlan }) {
  const nav = useNav()
  const markBriefed = useGame((s) => s.markBriefed)
  // Freeze the list on mount so marking items briefed does not reshuffle the deck.
  const items = useMemo(() => {
    const first = useGame.getState().briefedItems.length === 0
    return unbriefedItems(plan)
      .slice(0, first ? FIRST_CARDS : MAX_CARDS)
      .map((id) => itemById.get(id))
      .filter((i): i is Item => !!i)
  }, [plan])
  const [index, setIndex] = useState(0)
  const seenUpTo = useRef(0)
  seenUpTo.current = Math.max(seenUpTo.current, index)

  const startDrive = () => {
    // Only the cards the learner actually saw: skipped ones come back next time.
    markBriefed(items.slice(0, seenUpTo.current + 1).map((i) => i.id))
    nav.replace({ name: 'drive', plan })
  }

  // Nothing new to show: go straight to the road.
  useEffect(() => {
    if (items.length === 0) nav.replace({ name: 'drive', plan })
  }, [items.length, nav, plan])

  if (items.length === 0) return null

  const last = index >= items.length - 1
  return (
    <Screen
      title="Intel briefing"
      onBack={nav.back}
      right={
        <span className="text-lg font-extrabold text-dim whitespace-nowrap" aria-live="polite">
          {index + 1} / {items.length}
        </span>
      }
    >
      <div className="flex flex-col gap-4 max-w-lg mx-auto pb-32">
        <div className="flex items-center gap-3">
          <MentorAvatar size={40} />
          <p className="flex-1 text-lg font-bold">
            {items.length === 1 ? 'One new thing' : `${items.length} new things`} on this drive. Learn them, then use them!
          </p>
        </div>
        <Swiper
          index={index}
          onIndex={setIndex}
          label="Intel cards"
          slides={items.map((it, i) => (
            <IntelCard key={it.id} item={it} active={i === index} />
          ))}
        />
        <button onClick={startDrive} className="self-center text-dim font-bold min-h-11 px-4 hover:text-text">
          Skip to the drive
        </button>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-ink via-ink/95 to-transparent pt-6 px-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <div className="max-w-lg mx-auto">
          <Button variant="primary" size="lg" className="w-full" onClick={() => (last ? startDrive() : setIndex(index + 1))}>
            {last ? 'START DRIVE ▶' : 'NEXT CARD →'}
          </Button>
        </div>
      </div>
    </Screen>
  )
}

const KIND_ICON: Record<Item['kind'], string> = { sign: '🛑', rule: '📘', number: '🔢' }
const KIND_LABEL: Record<Item['kind'], string> = { sign: 'Sign', rule: 'Rule', number: 'Number to know' }

function IntelCard({ item, active }: { item: Item; active: boolean }) {
  const speech = [item.title, item.simple, item.mnemonic ? `Memory trick: ${item.mnemonic}` : ''].filter(Boolean).join('. ')
  useAutoRead(active ? speech : undefined)
  return (
    <article className="bg-panel border-2 border-line rounded-3xl p-5 flex flex-col gap-3 select-none h-full">
      {item.image ? (
        <div className="flex items-center justify-center rounded-2xl bg-ink/60 border border-line min-h-44 py-4">
          <SignImage id={item.image} size={168} />
        </div>
      ) : null}
      <div className="flex items-center gap-2 text-sm font-extrabold tracking-widest uppercase text-info">
        {!item.image && (
          <span className="text-4xl leading-none" aria-hidden>
            {KIND_ICON[item.kind]}
          </span>
        )}
        {KIND_LABEL[item.kind]}
      </div>
      <div className="flex items-start gap-2">
        <h2 className="flex-1 text-3xl font-extrabold leading-tight">{item.title}</h2>
        <ReadAloudButton text={speech} />
      </div>
      <p className="text-xl leading-snug">{item.simple}</p>
      {item.mnemonic && (
        <div className="rounded-2xl bg-gold/10 border-2 border-gold/50 px-4 py-3">
          <div className="text-xs font-extrabold tracking-widest uppercase text-gold">Memory trick</div>
          <p className="text-lg font-bold mt-0.5">{item.mnemonic}</p>
        </div>
      )}
    </article>
  )
}
