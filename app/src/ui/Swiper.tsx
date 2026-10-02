// Swipeable card deck: drag / swipe, arrow keys, or the dot buttons.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useReducedMotion } from '../app/effects'

export function Swiper({
  index,
  onIndex,
  slides,
  label = 'Cards',
  keyboard = true,
}: {
  index: number
  onIndex: (i: number) => void
  slides: ReactNode[]
  label?: string
  keyboard?: boolean
}) {
  const reduced = useReducedMotion()
  const [drag, setDrag] = useState(0)
  const start = useRef<{ x: number; y: number; id: number } | null>(null)
  const width = useRef(1)
  const count = slides.length

  const go = (i: number) => onIndex(Math.max(0, Math.min(count - 1, i)))

  useEffect(() => {
    if (!keyboard) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      if (e.key === 'ArrowRight') onIndex(Math.min(count - 1, index + 1))
      if (e.key === 'ArrowLeft') onIndex(Math.max(0, index - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [keyboard, index, count, onIndex])

  return (
    <div className="w-full" role="region" aria-roledescription="carousel" aria-label={label}>
      <div
        className="overflow-hidden rounded-3xl"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return
          start.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
          width.current = e.currentTarget.clientWidth || 1
        }}
        onPointerMove={(e) => {
          const s = start.current
          if (!s || s.id !== e.pointerId) return
          const dx = e.clientX - s.x
          const dy = e.clientY - s.y
          if (Math.abs(dx) > Math.abs(dy)) {
            if (Math.abs(dx) > 10 && !e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.setPointerCapture(e.pointerId)
            }
            // Resist at the ends.
            const atEdge = (index === 0 && dx > 0) || (index === count - 1 && dx < 0)
            setDrag(atEdge ? dx * 0.3 : dx)
          }
        }}
        onPointerUp={(e) => {
          const s = start.current
          start.current = null
          if (!s) return
          const dx = e.clientX - s.x
          setDrag(0)
          const threshold = Math.min(70, width.current * 0.18)
          if (dx < -threshold) go(index + 1)
          else if (dx > threshold) go(index - 1)
        }}
        onPointerCancel={() => {
          start.current = null
          setDrag(0)
        }}
      >
        <div
          className="flex items-stretch"
          style={{
            transform: `translateX(calc(${-index * 100}% + ${drag}px))`,
            transition: drag || reduced ? 'none' : 'transform 320ms cubic-bezier(.2,.8,.2,1)',
          }}
        >
          {slides.map((s, i) => (
            <div key={i} className="w-full shrink-0 px-1" aria-hidden={i !== index} role="group" aria-label={`${i + 1} of ${count}`}>
              {s}
            </div>
          ))}
        </div>
      </div>
      {count > 1 && (
        <div className="flex items-center justify-center gap-1 mt-3">
          {slides.map((_, i) => (
            <button
              key={i}
              aria-label={`Card ${i + 1}`}
              aria-current={i === index}
              onClick={() => go(i)}
              className="w-11 h-11 flex items-center justify-center"
            >
              <span className={`block rounded-full transition-all ${i === index ? 'w-6 h-3 bg-gold' : 'w-3 h-3 bg-line'}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
