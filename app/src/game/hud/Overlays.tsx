// Full-screen HUD layers: countdown, streak banners, edge glows, loading cover.
import type { BannerInfo } from '../protocol'

const TONE: Record<BannerInfo['tone'], string> = {
  streak: 'text-gold',
  nitro: 'text-nitro',
  good: 'text-good',
  info: 'text-info',
  finish: 'text-gold',
}

export function Countdown({ value, reduced }: { value: number | 'GO'; reduced: boolean }) {
  const go = value === 'GO'
  return (
    <div className="absolute inset-0 grid place-items-center pointer-events-none">
      <div className="text-center">
        <div
          key={reduced ? 'cd' : String(value)}
          className={`font-black leading-none drop-shadow-[0_6px_0_rgba(0,0,0,0.6)] ${go ? 'text-good text-8xl sm:text-9xl' : 'text-gold text-9xl'} ${reduced ? '' : 'animate-pop'}`}
        >
          {go ? 'GO!' : value}
        </div>
        {!go && <div className="mt-4 text-base font-bold text-text/90 bg-ink/60 rounded-full px-4 py-1.5">Tap or press any key to start</div>}
      </div>
    </div>
  )
}

/**
 * Streak / reward banner. In slow roll (`calm`) it is smaller and sits lower, over
 * the open road just above the car, so it never covers the gate labels or hazards.
 */
export function Banner({ banner, reduced, calm = false }: { banner: BannerInfo; reduced: boolean; calm?: boolean }) {
  return (
    <div className={`absolute inset-x-0 -translate-y-1/2 flex justify-center pointer-events-none px-4 ${calm ? 'top-[60%]' : 'top-[44%]'}`}>
      <div key={reduced ? 'banner' : banner.id} className={`text-center ${reduced ? '' : 'animate-pop'}`}>
        <div
          className={`font-black italic tracking-wide ${calm ? 'text-3xl sm:text-5xl' : 'text-4xl sm:text-6xl'} ${TONE[banner.tone]} drop-shadow-[0_5px_0_rgba(0,0,0,0.7)]`}
          style={{ WebkitTextStroke: '2px rgba(11,16,32,0.85)' }}
        >
          {banner.text}
        </div>
        {banner.sub && <div className="mt-2 inline-block rounded-full bg-ink/80 px-4 py-1.5 text-base sm:text-lg font-bold text-text">{banner.sub}</div>}
      </div>
    </div>
  )
}

/**
 * Colored edge glows for nitro, sirens and slow-mo. Static when reduced motion is on.
 * `calm` (slow roll) swaps the hard siren strobe for a slow, soft red/blue fade.
 */
export function EdgeFx({ nitro, siren, slowMo, reduced, calm = false }: { nitro: boolean; siren: boolean; slowMo: boolean; reduced: boolean; calm?: boolean }) {
  const sirenAnim = calm ? 'rw-siren-soft 1.8s ease-in-out infinite alternate' : 'rw-siren 0.5s steps(1) infinite'
  const nitroAnim = calm ? 'rw-nitro-soft 2.4s ease-in-out infinite' : 'rw-nitro 0.6s ease-in-out infinite'
  return (
    <>
      <style>{`
        @keyframes rw-siren { 0%,49% { box-shadow: inset 0 0 70px 10px rgba(244,63,94,0.55); } 50%,100% { box-shadow: inset 0 0 70px 10px rgba(59,130,246,0.55); } }
        @keyframes rw-siren-soft { from { box-shadow: inset 0 0 60px 6px rgba(244,63,94,0.38); } to { box-shadow: inset 0 0 60px 6px rgba(59,130,246,0.38); } }
        @keyframes rw-nitro-soft { 0%,100% { box-shadow: inset 0 0 60px 4px rgba(167,139,250,0.28); } 50% { box-shadow: inset 0 0 80px 8px rgba(167,139,250,0.4); } }
        @keyframes rw-nitro { 0%,100% { box-shadow: inset 0 0 80px 14px rgba(167,139,250,0.55); } 50% { box-shadow: inset 0 0 110px 20px rgba(167,139,250,0.75); } }
      `}</style>
      {nitro && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={reduced ? { boxShadow: 'inset 0 0 60px 8px rgba(167,139,250,0.45)' } : { animation: nitroAnim }}
        />
      )}
      {siren && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={
            reduced
              ? { boxShadow: 'inset 40px 0 60px -20px rgba(244,63,94,0.5), inset -40px 0 60px -20px rgba(59,130,246,0.5)' }
              : { animation: sirenAnim }
          }
        />
      )}
      {slowMo && <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 90px 16px rgba(56,189,248,0.45)' }} />}
    </>
  )
}

export function LoadingCover({ title }: { title: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-ink">
      <div className="text-center px-6">
        <div className="text-5xl mb-3" aria-hidden>
          🚗
        </div>
        <div className="text-2xl font-extrabold">{title}</div>
        <div className="mt-2 text-dim font-semibold">Warming up the engine…</div>
      </div>
    </div>
  )
}
