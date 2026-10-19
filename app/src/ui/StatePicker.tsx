// Pick the US state whose DMV test you are studying for.
import { useMemo, useState } from 'react'
import { states, type StateInfo } from '../engine/states'
import { Pill } from './kit'

export function StatePicker({ current, onPick }: { current?: string; onPick: (s: StateInfo) => void }) {
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t ? states.filter((s) => s.name.toLowerCase().includes(t) || s.code === t) : states
  }, [q])

  return (
    <div className="flex flex-col gap-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Type your state"
        aria-label="Search for your state"
        autoComplete="address-level1"
        className="w-full px-5 py-4 text-xl font-bold rounded-2xl bg-panel2 border-2 border-line focus:border-gold outline-none placeholder:text-dim/60"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[50dvh] overflow-y-auto pr-1" role="listbox" aria-label="States">
        {list.map((s) => (
          <button
            key={s.code}
            type="button"
            role="option"
            aria-selected={current === s.code}
            onClick={() => onPick(s)}
            className={`min-h-14 px-4 rounded-2xl border-2 text-left flex items-center gap-2 ${current === s.code ? 'bg-info/25 border-info' : 'bg-panel2 border-line hover:border-dim'}`}
          >
            <span className="flex-1 text-lg font-extrabold">{s.name}</span>
            {s.status === 'ready' ? <Pill className="text-good border-good/50">Full course</Pill> : <Pill>Signs for now</Pill>}
          </button>
        ))}
        {list.length === 0 && <p className="text-dim text-lg p-2">No state matches that.</p>}
      </div>
    </div>
  )
}

