// Form controls and small layout pieces for the ui-b screens. Big touch targets.
import { useId, type ReactNode } from 'react'
import { playSfx } from '../services/sfx'
import { Button, ReadAloudButton } from './kit'

/** Section heading with an optional read-aloud button. */
export function SectionTitle({ children, read, right }: { children: ReactNode; read?: string; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 mt-6 mb-2">
      <h2 className="text-lg font-extrabold flex-1">{children}</h2>
      {read && <ReadAloudButton text={read} />}
      {right}
    </div>
  )
}

/** One row in a settings list: label + hint on the left, control on the right (stacks on phones). */
export function SettingRow({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 border-b border-line last:border-b-0">
      <div className="flex-1 min-w-[10rem]">
        <label htmlFor={htmlFor} className="font-bold block">
          {label}
        </label>
        {hint && <p className="text-sm text-dim">{hint}</p>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}

/** On/off switch. */
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        playSfx('click')
        onChange(!checked)
      }}
      className={`relative w-16 h-10 rounded-full border-2 transition-colors shrink-0 ${checked ? 'bg-good border-good' : 'bg-panel2 border-line'}`}
    >
      <span
        className={`absolute top-1 w-7 h-7 rounded-full bg-white shadow transition-[left] ${checked ? 'left-[calc(100%-2rem)]' : 'left-1'}`}
      />
      <span className="sr-only">{checked ? 'On' : 'Off'}</span>
    </button>
  )
}

/** A row of mutually exclusive choices (radio group). */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-xl border-2 border-line bg-panel2 p-1 gap-1">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => {
              playSfx('click')
              onChange(o.value)
            }}
            className={`min-h-11 min-w-11 px-3 rounded-lg font-bold transition-colors ${on ? 'bg-info text-ink' : 'text-dim hover:text-text'}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** Labeled range slider with words at both ends. */
export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  label,
  left,
  right,
  display,
}: {
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  label: string
  left?: string
  right?: string
  display?: string
}) {
  const id = useId()
  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="font-bold">
          {label}
        </label>
        {display && <span className="text-gold font-extrabold tabular-nums">{display}</span>}
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-11 accent-gold cursor-pointer"
      />
      {(left || right) && (
        <div className="flex justify-between text-sm text-dim -mt-1">
          <span>{left}</span>
          <span>{right}</span>
        </div>
      )}
    </div>
  )
}

/**
 * Two-step confirm built into the page (no window.confirm). Shows a message with
 * a safe "keep" action and a risky "confirm" action.
 */
export function InlineConfirm({
  message,
  detail,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  tone = 'danger',
}: {
  message: string
  detail?: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
  tone?: 'danger' | 'calm'
}) {
  return (
    <div
      role="alertdialog"
      aria-label={message}
      className={`rounded-2xl border-2 p-4 animate-rise ${tone === 'danger' ? 'border-bad bg-bad/10' : 'border-line bg-panel'}`}
    >
      <div className="flex items-start gap-2">
        <p className="text-lg font-extrabold flex-1">{message}</p>
        <ReadAloudButton text={`${message} ${detail ?? ''}`} />
      </div>
      {detail && <p className="text-dim mt-1">{detail}</p>}
      <div className="flex flex-wrap gap-3 mt-4">
        <Button variant="secondary" onClick={onCancel} autoFocus className="flex-1 min-w-[8rem]">
          {cancelLabel}
        </Button>
        <Button variant={tone === 'danger' ? 'danger' : 'secondary'} onClick={onConfirm} className="flex-1 min-w-[8rem]">
          {confirmLabel}
        </Button>
      </div>
    </div>
  )
}

/** Sticky bottom bar that holds the screen's single primary button. */
export function BottomAction({ children }: { children: ReactNode }) {
  return (
    <div
      className="sticky bottom-0 z-10 -mx-4 mt-6 px-4 pt-3 bg-linear-to-t from-ink via-ink/95 to-transparent"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      {children}
    </div>
  )
}
