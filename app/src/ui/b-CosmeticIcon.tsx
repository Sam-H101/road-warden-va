// Small visual for any Garage cosmetic (car, paint, trail, horn, decal).
import type { CosmeticDef } from '../engine/loadout'
import { CarPreview } from './b-CarPreview'

const RAINBOW_BG = 'linear-gradient(90deg,#ef4444,#f97316,#fbbf24,#22c55e,#38bdf8,#8b5cf6)'

export function CosmeticIcon({ c, size = 48, paint = '#38bdf8' }: { c: CosmeticDef; size?: number; paint?: string }) {
  const box = { width: size, height: size }
  switch (c.slot) {
    case 'car':
      return (
        <span className="inline-flex items-center justify-center" style={box} aria-hidden>
          <CarPreview style={c.value} paint={paint} size={size} />
        </span>
      )
    case 'paint':
      return (
        <span className="inline-flex items-center justify-center" style={box} aria-hidden>
          <span
            className="rounded-full border-2 border-white/40 shadow-inner"
            style={{ width: size * 0.7, height: size * 0.7, background: c.value }}
          />
        </span>
      )
    case 'trail':
      return (
        <span className="inline-flex items-center justify-center" style={box} aria-hidden>
          {c.value ? (
            <span
              className="rounded-full"
              style={{
                width: size * 0.85,
                height: size * 0.28,
                background: c.value === 'rainbow' ? RAINBOW_BG : `linear-gradient(90deg, transparent, ${c.value})`,
              }}
            />
          ) : (
            <span className="text-dim font-bold" style={{ fontSize: size * 0.4 }}>
              —
            </span>
          )}
        </span>
      )
    case 'horn':
      return (
        <span className="inline-flex items-center justify-center" style={{ ...box, fontSize: size * 0.55 }} aria-hidden>
          📯
        </span>
      )
    case 'decal':
      return (
        <span className="inline-flex items-center justify-center" style={{ ...box, fontSize: size * 0.55 }} aria-hidden>
          {c.value || <span className="text-dim font-bold">—</span>}
        </span>
      )
  }
}
