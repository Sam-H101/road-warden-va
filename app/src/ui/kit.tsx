// Shared UI building blocks. Big targets, one primary action per screen.
import { useEffect, type ReactNode, type ButtonHTMLAttributes } from 'react'
import { imageUrl } from '../engine/content'
import { playSfx } from '../services/sfx'
import { speak } from '../services/speech'
import { useGame } from '../store/gameStore'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'good'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-gold text-ink hover:brightness-110 shadow-[0_6px_0_#b45309] active:translate-y-[3px] active:shadow-[0_3px_0_#b45309]',
  secondary: 'bg-panel2 text-text border-2 border-line hover:border-info',
  ghost: 'bg-transparent text-dim hover:text-text',
  danger: 'bg-bad text-white shadow-[0_6px_0_#9f1239] active:translate-y-[3px] active:shadow-[0_3px_0_#9f1239]',
  good: 'bg-good text-ink shadow-[0_6px_0_#15803d] active:translate-y-[3px] active:shadow-[0_3px_0_#15803d]',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  onClick,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sizes = {
    sm: 'px-3 py-1.5 text-sm rounded-lg',
    md: 'px-5 py-3 text-base rounded-xl',
    lg: 'px-7 py-4 text-xl rounded-2xl',
    xl: 'px-10 py-5 text-3xl rounded-3xl tracking-wide',
  }
  return (
    <button
      {...rest}
      onClick={(e) => {
        playSfx('click')
        onClick?.(e)
      }}
      className={`font-extrabold transition select-none disabled:opacity-40 disabled:pointer-events-none ${sizes[size]} ${VARIANT[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-panel border-2 border-line rounded-2xl p-4 ${className}`}>{children}</div>
}

/** A road sign / diagram image from content/signs by id. */
export function SignImage({ id, size = 96, className = '', alt }: { id?: string; size?: number; className?: string; alt?: string }) {
  const url = imageUrl(id)
  if (!url) return null
  return (
    <img
      src={url}
      alt={alt ?? id?.replace(/^(sign|signal|mark|curb|hand|diagram)-/, '').replace(/-/g, ' ') ?? ''}
      style={{ width: size, height: size }}
      className={`object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] ${className}`}
      draggable={false}
    />
  )
}

/** Speaker button. Reads text aloud. Respects the read-aloud setting (off hides it). */
export function ReadAloudButton({ text, className = '', label = 'Read aloud' }: { text: string; className?: string; label?: string }) {
  const mode = useGame((s) => s.settings.readAloud)
  if (mode === 'off') return null
  return (
    <button
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation()
        speak(text, { force: true })
      }}
      className={`inline-flex items-center justify-center w-11 h-11 rounded-full bg-info/20 text-info hover:bg-info/30 text-xl shrink-0 ${className}`}
    >
      🔊
    </button>
  )
}

/** Auto-reads text once when it appears if read-aloud is set to auto. */
export function useAutoRead(text: string | undefined, deps: unknown[] = []) {
  const mode = useGame((s) => s.settings.readAloud)
  useEffect(() => {
    if (mode === 'auto' && text) speak(text)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, text, ...deps])
}

export function ProgressBar({ value, max = 1, color = 'bg-gold', className = '', label }: { value: number; max?: number; color?: string; className?: string; label?: string }) {
  const pct = Math.max(0, Math.min(1, max ? value / max : 0))
  return (
    <div className={`w-full ${className}`} aria-label={label} role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-3 rounded-full bg-panel2 border border-line overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-[width] duration-700`} style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  )
}

export function Stars({ count, max = 5, size = 'text-xl' }: { count: number; max?: number; size?: string }) {
  return (
    <span className={`${size} tracking-tight`} aria-label={`${count} of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < count ? 'text-gold' : 'text-line'}>
          ★
        </span>
      ))}
    </span>
  )
}

/** Full-screen page wrapper with a top bar and a back button. */
export function Screen({ title, onBack, right, children, className = '' }: { title?: ReactNode; onBack?: () => void; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`min-h-dvh flex flex-col ${className}`}>
      {(title || onBack || right) && (
        <header className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 bg-ink/90 backdrop-blur border-b border-line" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
          {onBack && (
            <button onClick={onBack} aria-label="Back" className="w-11 h-11 rounded-full bg-panel2 border-2 border-line text-xl font-bold">
              ←
            </button>
          )}
          <h1 className="text-xl font-extrabold flex-1 truncate">{title}</h1>
          {right}
        </header>
      )}
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-4">{children}</main>
    </div>
  )
}

export function Pill({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-panel2 border border-line ${className}`}>{children}</span>
}
