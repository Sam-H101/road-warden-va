// DOM/SVG preview of the player's car (back view, like in the game). No Phaser.
import { useId } from 'react'

interface Shape {
  bodyW: number // width of the lower body
  bodyTop: number // y of the top of the lower body (trunk line)
  roofW: number // width of the roof
  roofTop: number // y of the roof
  baseW: number // width of the cabin where it meets the body
  wheelW: number
}

const SHAPES: Record<string, Shape> = {
  compact: { bodyW: 120, bodyTop: 66, roofW: 76, roofTop: 26, baseW: 104, wheelW: 20 },
  sedan: { bodyW: 136, bodyTop: 64, roofW: 80, roofTop: 30, baseW: 112, wheelW: 20 },
  hatch: { bodyW: 132, bodyTop: 68, roofW: 88, roofTop: 26, baseW: 116, wheelW: 22 },
  pickup: { bodyW: 146, bodyTop: 58, roofW: 92, roofTop: 22, baseW: 112, wheelW: 26 },
  muscle: { bodyW: 150, bodyTop: 66, roofW: 78, roofTop: 36, baseW: 116, wheelW: 26 },
  interceptor: { bodyW: 142, bodyTop: 64, roofW: 84, roofTop: 32, baseW: 116, wheelW: 22 },
  rally: { bodyW: 136, bodyTop: 66, roofW: 84, roofTop: 28, baseW: 112, wheelW: 24 },
  hyper: { bodyW: 160, bodyTop: 74, roofW: 64, roofTop: 46, baseW: 112, wheelW: 28 },
  legend: { bodyW: 156, bodyTop: 70, roofW: 72, roofTop: 40, baseW: 116, wheelW: 28 },
}

const BOTTOM = 112 // y of the body bottom
const CX = 100

function isLight(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return false
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return 0.299 * r + 0.587 * g + 0.114 * b > 170
}

const RAINBOW = ['#ef4444', '#f97316', '#fbbf24', '#22c55e', '#38bdf8', '#8b5cf6']

export function CarPreview({
  style,
  paint,
  decal,
  trail,
  size = 240,
  animate = false,
  className = '',
  title,
}: {
  style: string
  paint: string
  decal?: string
  trail?: string
  size?: number
  animate?: boolean
  className?: string
  title?: string
}) {
  const uid = useId().replace(/:/g, '')
  const s = SHAPES[style] ?? SHAPES.compact
  const half = s.bodyW / 2
  const left = CX - half
  const right = CX + half
  const trim = isLight(paint) ? '#334155' : '#f8fafc'
  const trailColors = trail === 'rainbow' ? RAINBOW : trail ? [trail] : []
  const glassTop = s.roofTop + 6
  const glassBottom = s.bodyTop - 4
  const glassTopW = s.roofW - 12
  const glassBottomW = s.baseW - 18

  return (
    <svg
      viewBox="0 0 200 170"
      width={size}
      height={(size * 170) / 200}
      className={className}
      role="img"
      aria-label={title ?? `${style} car`}
      style={{ maxWidth: '100%', height: 'auto' }}
    >
      <defs>
        <linearGradient id={`body-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="0.45" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id={`glass-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#94a3b8" />
          <stop offset="0.5" stopColor="#1e293b" />
          <stop offset="1" stopColor="#0f172a" />
        </linearGradient>
        {trailColors.map((c, i) => (
          <linearGradient key={i} id={`trail-${uid}-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c} stopOpacity="0.95" />
            <stop offset="1" stopColor={c} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>

      {/* Trail: streaks flowing back toward the viewer */}
      {trailColors.length > 0 && (
        <g>
          {trailColors.length === 1 ? (
            <>
              <polygon points={`${CX - 40},${BOTTOM + 4} ${CX - 22},${BOTTOM + 4} ${CX - 52},170 ${CX - 88},170`} fill={`url(#trail-${uid}-0)`} />
              <polygon points={`${CX + 22},${BOTTOM + 4} ${CX + 40},${BOTTOM + 4} ${CX + 88},170 ${CX + 52},170`} fill={`url(#trail-${uid}-0)`} />
            </>
          ) : (
            trailColors.map((_, i) => {
              const x0 = CX - 30 + i * 10
              const x1 = CX - 96 + i * 32
              return <polygon key={i} points={`${x0},${BOTTOM + 4} ${x0 + 10},${BOTTOM + 4} ${x1 + 32},170 ${x1},170`} fill={`url(#trail-${uid}-${i})`} />
            })
          )}
          {animate && (
            <animate attributeName="opacity" values="0.75;1;0.75" dur="0.9s" repeatCount="indefinite" />
          )}
        </g>
      )}

      {/* Ground shadow */}
      <ellipse cx={CX} cy={BOTTOM + 10} rx={half + 8} ry={8} fill="#000" opacity="0.45" />

      <g>
        {animate && (
          <animateTransform attributeName="transform" type="translate" values="0 0; 0 -1.5; 0 0" dur="0.6s" repeatCount="indefinite" />
        )}

        {/* Wheels */}
        <rect x={left + 6} y={BOTTOM - 8} width={s.wheelW} height={20} rx={5} fill="#0f172a" />
        <rect x={right - 6 - s.wheelW} y={BOTTOM - 8} width={s.wheelW} height={20} rx={5} fill="#0f172a" />

        {/* Spoilers / wings behind the cabin */}
        {(style === 'rally' || style === 'legend' || style === 'hyper') && (
          <g>
            <rect x={CX - 6 - (s.bodyW / 2 - 14)} y={s.bodyTop - 16} width={6} height={16} fill="#111827" />
            <rect x={CX + (s.bodyW / 2 - 14)} y={s.bodyTop - 16} width={6} height={16} fill="#111827" />
            <rect x={left + 6} y={s.bodyTop - 22} width={s.bodyW - 12} height={8} rx={3} fill={style === 'legend' ? '#fbbf24' : '#111827'} />
          </g>
        )}

        {/* Cabin */}
        <polygon
          points={`${CX - s.roofW / 2},${s.roofTop} ${CX + s.roofW / 2},${s.roofTop} ${CX + s.baseW / 2},${s.bodyTop + 2} ${CX - s.baseW / 2},${s.bodyTop + 2}`}
          fill={paint}
        />
        <polygon
          points={`${CX - s.roofW / 2},${s.roofTop} ${CX + s.roofW / 2},${s.roofTop} ${CX + s.baseW / 2},${s.bodyTop + 2} ${CX - s.baseW / 2},${s.bodyTop + 2}`}
          fill={`url(#body-${uid})`}
        />
        {/* Rear glass */}
        <polygon
          points={`${CX - glassTopW / 2},${glassTop} ${CX + glassTopW / 2},${glassTop} ${CX + glassBottomW / 2},${glassBottom} ${CX - glassBottomW / 2},${glassBottom}`}
          fill={`url(#glass-${uid})`}
        />

        {/* Interceptor light bar */}
        {style === 'interceptor' && (
          <g>
            <rect x={CX - 26} y={s.roofTop - 8} width={26} height={8} rx={2} fill="#ef4444">
              {animate && <animate attributeName="opacity" values="1;0.3;1" dur="0.8s" repeatCount="indefinite" />}
            </rect>
            <rect x={CX} y={s.roofTop - 8} width={26} height={8} rx={2} fill="#3b82f6">
              {animate && <animate attributeName="opacity" values="0.3;1;0.3" dur="0.8s" repeatCount="indefinite" />}
            </rect>
          </g>
        )}

        {/* Lower body */}
        <rect x={left} y={s.bodyTop} width={s.bodyW} height={BOTTOM - s.bodyTop} rx={12} fill={paint} />
        <rect x={left} y={s.bodyTop} width={s.bodyW} height={BOTTOM - s.bodyTop} rx={12} fill={`url(#body-${uid})`} />

        {/* Pickup bed edge */}
        {style === 'pickup' && <rect x={left + 4} y={s.bodyTop + 2} width={s.bodyW - 8} height={5} rx={2} fill="#000" opacity="0.25" />}

        {/* Muscle stripes */}
        {(style === 'muscle' || style === 'legend') && (
          <g opacity="0.9">
            <rect x={CX - 16} y={s.bodyTop} width={10} height={BOTTOM - s.bodyTop - 14} fill={trim} />
            <rect x={CX + 6} y={s.bodyTop} width={10} height={BOTTOM - s.bodyTop - 14} fill={trim} />
            <rect x={CX - 16} y={s.roofTop} width={10} height={s.bodyTop - s.roofTop} fill={trim} opacity="0.5" />
            <rect x={CX + 6} y={s.roofTop} width={10} height={s.bodyTop - s.roofTop} fill={trim} opacity="0.5" />
          </g>
        )}

        {/* Tail lights */}
        <rect x={left + 6} y={s.bodyTop + 8} width={style === 'hyper' ? s.bodyW - 12 : 26} height={8} rx={3} fill="#ef4444" />
        {style !== 'hyper' && <rect x={right - 32} y={s.bodyTop + 8} width={26} height={8} rx={3} fill="#ef4444" />}
        <rect x={left + 8} y={s.bodyTop + 9} width={8} height={3} rx={1} fill="#fecaca" opacity="0.9" />
        <rect x={right - 16} y={s.bodyTop + 9} width={8} height={3} rx={1} fill="#fecaca" opacity="0.9" />

        {/* License plate */}
        <rect x={CX - 18} y={BOTTOM - 26} width={36} height={14} rx={2} fill="#f8fafc" stroke="#1e3a8a" strokeWidth={1.5} />
        <text x={CX} y={BOTTOM - 15.5} textAnchor="middle" fontSize="8" fontWeight="800" fill="#1e3a8a" fontFamily="ui-sans-serif, system-ui, sans-serif">
          VA
        </text>

        {/* Bumper */}
        <rect x={left + 2} y={BOTTOM - 8} width={s.bodyW - 4} height={8} rx={4} fill="#111827" opacity="0.85" />

        {/* Rally mud flaps */}
        {style === 'rally' && (
          <g fill="#ef4444">
            <rect x={left + 8} y={BOTTOM} width={16} height={12} rx={2} />
            <rect x={right - 24} y={BOTTOM} width={16} height={12} rx={2} />
          </g>
        )}

        {/* Exhausts */}
        {(style === 'muscle' || style === 'hyper' || style === 'legend' || style === 'rally') && (
          <g fill="#94a3b8">
            <circle cx={CX - 34} cy={BOTTOM - 3} r={4} />
            <circle cx={CX + 34} cy={BOTTOM - 3} r={4} />
          </g>
        )}

        {/* Decal */}
        {decal && (
          <text
            x={CX}
            y={(glassTop + glassBottom) / 2 + Math.min(18, glassBottom - glassTop - 2) * 0.36}
            textAnchor="middle"
            fontSize={Math.min(18, glassBottom - glassTop - 2)}
          >
            {decal}
          </text>
        )}
      </g>
    </svg>
  )
}
