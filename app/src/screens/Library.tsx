// Study guide: every fact from the manual, in plain words, searchable.
import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react'
import { districtById, districts, isSignItem, itemsIn, signRegistry } from '../engine/content'
import { isMastered, type ItemState } from '../engine/scheduler'
import type { DistrictId, Item } from '../engine/types'
import { useNav } from '../app/nav'
import { playSfx } from '../services/sfx'
import { unlockedDistricts, useGame } from '../store/gameStore'
import { Button, Panel, Pill, ReadAloudButton, Screen, SignImage } from '../ui/kit'
import { BottomAction } from '../ui/b-controls'
import { startQuickPlay } from '../ui/b-util'

type Status = 'new' | 'learning' | 'mastered'
type StatusFilter = Status | 'all'

const PAGE = 20

const signName = new Map(signRegistry.map((s) => [s.id, s.name]))

function statusOf(item: Item, st: ItemState | undefined): Status {
  if (isMastered(st, isSignItem(item))) return 'mastered'
  if (st && st.seen > 0) return 'learning'
  return 'new'
}

const STATUS_STYLE: Record<Status, { label: string; cls: string; icon: string }> = {
  mastered: { label: 'Mastered', cls: 'text-good border-good/50 bg-good/10', icon: '✓' },
  learning: { label: 'Learning', cls: 'text-gold border-gold/50 bg-gold/10', icon: '↻' },
  new: { label: 'New', cls: 'text-info border-info/50 bg-info/10', icon: '•' },
}

export function LibraryScreen({ district }: { district?: DistrictId }) {
  const nav = useNav()
  const states = useGame((s) => s.items)
  const missionsCleared = useGame((s) => s.missionsCleared)
  const unlocked = useMemo(() => unlockedDistricts({ missionsCleared }), [missionsCleared])

  const withContent = useMemo(() => districts.filter((d) => itemsIn(d.id).length > 0), [])
  const requestedLocked = !!district && !unlocked.includes(district)
  const [filter, setFilter] = useState<DistrictId | 'all'>(district && !requestedLocked ? district : 'all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [query, setQuery] = useState('')
  const q = useDeferredValue(query.trim().toLowerCase())
  const [limit, setLimit] = useState(PAGE)

  useEffect(() => setLimit(PAGE), [filter, status, q])

  const pool = useMemo(() => {
    const ds = filter === 'all' ? unlocked : [filter]
    return ds.flatMap((d) => itemsIn(d))
  }, [filter, unlocked])

  const searched = useMemo(() => {
    if (!q) return pool
    return pool.filter((i) =>
      [i.title, i.simple, i.official, i.mnemonic ?? '', i.manualRef, i.image ? (signName.get(i.image) ?? '') : '']
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [pool, q])

  const counts = useMemo(() => {
    const c: Record<Status, number> = { new: 0, learning: 0, mastered: 0 }
    for (const i of searched) c[statusOf(i, states[i.id])]++
    return c
  }, [searched, states])

  const list = status === 'all' ? searched : searched.filter((i) => statusOf(i, states[i.id]) === status)
  const shown = list.slice(0, limit)
  const fd = filter === 'all' ? undefined : districtById.get(filter)

  return (
    <Screen title="Study guide" onBack={() => nav.back()}>
      {requestedLocked && district && (
        <Panel className="mb-4 flex items-center gap-3 !border-gold/50">
          <span className="text-3xl" aria-hidden>
            🔒
          </span>
          <p className="flex-1">
            <strong>{districtById.get(district)?.name ?? 'That district'}</strong> is still locked. Clear the districts before it to open its study cards.
          </p>
        </Panel>
      )}

      {/* Search */}
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-dim" aria-hidden>
          🔍
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search: stop, school bus, BAC…"
          aria-label="Search the study guide"
          className="w-full min-h-12 pl-11 pr-4 rounded-2xl bg-panel2 border-2 border-line text-lg focus:border-info outline-none"
        />
      </div>

      {/* District chips */}
      <div className="mt-3 -mx-4 px-4 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Districts">
        <Chip on={filter === 'all'} onClick={() => setFilter('all')}>
          All open
        </Chip>
        {withContent.map((d) => {
          const open = unlocked.includes(d.id)
          return (
            <Chip key={d.id} on={filter === d.id} disabled={!open} onClick={() => setFilter(d.id)} color={d.color}>
              {!open && <span aria-label="Locked">🔒</span>}
              {d.short}
            </Chip>
          )
        })}
      </div>

      {/* Status filter */}
      <div className="mt-1 flex flex-wrap gap-2" role="radiogroup" aria-label="Show">
        {(['all', 'new', 'learning', 'mastered'] as StatusFilter[]).map((s) => {
          const on = status === s
          const n = s === 'all' ? searched.length : counts[s]
          return (
            <button
              key={s}
              role="radio"
              aria-checked={on}
              onClick={() => {
                playSfx('click')
                setStatus(s)
              }}
              className={`min-h-11 px-3 rounded-xl border-2 text-sm font-bold transition-colors ${
                on ? 'bg-text text-ink border-text' : 'bg-panel border-line text-dim hover:text-text'
              }`}
            >
              {s === 'all' ? 'All' : STATUS_STYLE[s].label} <span className="tabular-nums opacity-70">{n}</span>
            </button>
          )
        })}
      </div>

      {fd && <p className="mt-3 text-dim">{fd.blurb}</p>}

      {/* Cards */}
      <div className="mt-4 space-y-3">
        {shown.map((item) => (
          <ItemCard key={item.id} item={item} status={statusOf(item, states[item.id])} showDistrict={filter === 'all'} />
        ))}
      </div>

      {list.length === 0 && (
        <Panel className="text-center py-8">
          <div className="text-4xl" aria-hidden>
            {pool.length ? '🔍' : '📚'}
          </div>
          <p className="text-lg font-bold mt-2">{pool.length ? 'Nothing matches.' : 'No study cards here yet.'}</p>
          <p className="text-dim mt-1">{pool.length ? 'Try a shorter word, or pick All.' : 'Cards appear as districts open up.'}</p>
          {(q || status !== 'all') && pool.length > 0 && (
            <Button
              className="mt-4 min-h-11"
              onClick={() => {
                setQuery('')
                setStatus('all')
              }}
            >
              Clear search
            </Button>
          )}
        </Panel>
      )}

      {list.length > shown.length && (
        <Button variant="secondary" className="w-full mt-4 min-h-12" onClick={() => setLimit((n) => n + PAGE)}>
          Show more ({list.length - shown.length} left)
        </Button>
      )}

      <BottomAction>
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={() => (filter === 'all' ? startQuickPlay() : nav.go({ name: 'district', district: filter }))}
        >
          {filter === 'all' ? 'Practice on the road' : `Drive ${fd?.short ?? 'this district'}`}
        </Button>
      </BottomAction>
    </Screen>
  )
}

function Chip({
  on,
  disabled,
  onClick,
  color,
  children,
}: {
  on: boolean
  disabled?: boolean
  onClick: () => void
  color?: string
  children: ReactNode
}) {
  return (
    <button
      role="tab"
      aria-selected={on}
      disabled={disabled}
      onClick={() => {
        playSfx('click')
        onClick()
      }}
      className={`shrink-0 min-h-11 px-4 rounded-full border-2 font-bold flex items-center gap-1.5 transition-colors disabled:opacity-40 ${
        on ? 'bg-info text-ink border-info' : 'bg-panel2 border-line text-dim hover:text-text'
      }`}
      style={on && color ? { background: color, borderColor: color, color: '#0b1020' } : undefined}
    >
      {children}
    </button>
  )
}

function ItemCard({ item, status, showDistrict }: { item: Item; status: Status; showDistrict: boolean }) {
  const [official, setOfficial] = useState(false)
  const st = STATUS_STYLE[status]
  const d = districtById.get(item.district)
  const text = `${item.title}. ${item.simple}${item.mnemonic ? ` Memory trick: ${item.mnemonic}` : ''}`
  return (
    <article className="bg-panel border-2 border-line rounded-2xl p-4">
      <div className="flex gap-3">
        {item.image && (
          <div className="shrink-0 w-20 h-20 rounded-xl bg-panel2 flex items-center justify-center">
            <SignImage id={item.image} size={68} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <h3 className="text-lg font-extrabold leading-snug flex-1">{item.title}</h3>
            <ReadAloudButton text={text} />
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1">
            <Pill className={st.cls}>
              <span aria-hidden>{st.icon}</span> {st.label}
            </Pill>
            {showDistrict && d && (
              <Pill>
                <span className="w-2 h-2 rounded-full" style={{ background: d.color }} aria-hidden />
                {d.short}
              </Pill>
            )}
          </div>
        </div>
      </div>
      <p className="mt-3 text-lg leading-relaxed">{item.simple}</p>
      {item.mnemonic && (
        <p className="mt-2 rounded-xl bg-gold/10 border border-gold/30 px-3 py-2">
          <span aria-hidden>💡 </span>
          <span className="font-bold">{item.mnemonic}</span>
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setOfficial((v) => !v)}
          aria-expanded={official}
          className="min-h-11 px-3 rounded-xl border-2 border-line bg-panel2 text-sm font-bold text-dim hover:text-text"
        >
          {official ? 'Hide official wording' : 'Show official wording'}
        </button>
        <span className="text-sm text-dim ml-auto">📖 {item.manualRef}</span>
      </div>
      {official && (
        <blockquote className="mt-3 border-l-4 border-info pl-3 text-dim italic flex gap-2">
          <span className="flex-1">“{item.official}”</span>
          <ReadAloudButton text={item.official} label="Read official wording" />
        </blockquote>
      )}
    </article>
  )
}
