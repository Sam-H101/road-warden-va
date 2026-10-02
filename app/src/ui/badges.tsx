// Rank badge + small stat chips shared by Home and Debrief.
const TIER_COLORS = ['#38bdf8', '#22c55e', '#a78bfa', '#f97316', '#f43f5e', '#fbbf24', '#14b8a6', '#ec4899', '#eef2ff', '#fbbf24', '#fbbf24']

export function rankColor(rank: number): string {
  return TIER_COLORS[Math.min(TIER_COLORS.length - 1, Math.floor(rank / 10))]
}

/** Shield-shaped rank badge with the rank number. */
export function RankBadge({ rank, size = 56, prestige = 0, className = '' }: { rank: number; size?: number; prestige?: number; className?: string }) {
  const c = rankColor(rank)
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }} aria-label={`Rank ${rank}`} role="img">
      <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
        <path d="M32 3 L57 12 V32 C57 47 46 56 32 61 C18 56 7 47 7 32 V12 Z" fill="#141a2e" stroke={c} strokeWidth="4" strokeLinejoin="round" />
        <path d="M32 9 L51 16 V32 C51 43 43 50 32 54 C21 50 13 43 13 32 V16 Z" fill={c} opacity="0.18" />
        {rank >= 10 && <path d="M20 46 L32 40 L44 46" stroke={c} strokeWidth="3" fill="none" strokeLinecap="round" />}
        {rank >= 30 && <path d="M20 51 L32 45 L44 51" stroke={c} strokeWidth="3" fill="none" strokeLinecap="round" />}
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-extrabold leading-none"
        style={{ fontSize: size * (rank >= 100 ? 0.3 : 0.36), color: '#eef2ff', paddingBottom: size * 0.12 }}
      >
        {rank}
      </span>
      {prestige > 0 && (
        <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-nitro text-ink text-[11px] font-extrabold flex items-center justify-center" title={`Prestige ${prestige}`}>
          P{prestige}
        </span>
      )}
    </div>
  )
}
