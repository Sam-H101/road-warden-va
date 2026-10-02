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

export function Banner({ banner, reduced }: { banner: BannerInfo; reduced: boolean }) {
  return (
    <div className="absolute inset-x-0 top-[44%] -translate-y-1/2 flex justify-center pointer-events-none px-4">
      <div key={reduced ? 'banner' : banner.id} className={`text-center ${reduced ? '' : 'animate-pop'}`}>
        <div
          className={`font-black italic tracking-wide text-4xl sm:text-6xl ${TONE[banner.tone]} drop-shadow-[0_5px_0_rgba(0,0,0,0.7)]`}
          style={{ WebkitTextStroke: '2px rgba(11,16,32,0.85)' }}
        >
          {banner.text}
        </div>
        {banner.sub && <div className="mt-2 inline-block rounded-full bg-ink/80 px-4 py-1.5 text-base sm:text-lg font-bold text-text">{banner.sub}</div>}
      </div>
    </div>
  )
}

/** Colored edge glows for nitro, sirens and slow-mo. Static when reduced motion is on. */
export function EdgeFx({ nitro, siren, slowMo, reduced }: { nitro: boolean; siren: boolean; slowMo: boolean; reduced: boolean }) {
  return (
    <>
      <style>{`
        @keyframes rw-siren { 0%,49% { box-shadow: inset 0 0 70px 10px rgba(244,63,94,0.55); } 50%,100% { box-shadow: inset 0 0 70px 10px rgba(59,130,246,0.55); } }
        @keyframes rw-nitro { 0%,100% { box-shadow: inset 0 0 80px 14px rgba(167,139,250,0.55); } 50% { box-shadow: inset 0 0 110px 20px rgba(167,139,250,0.75); } }
      `}</style>
      {nitro && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={reduced ? { boxShadow: 'inset 0 0 60px 8px rgba(167,139,250,0.45)' } : { animation: 'rw-nitro 0.6s ease-in-out infinite' }}
        />
      )}
      {siren && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={
            reduced
              ? { boxShadow: 'inset 40px 0 60px -20px rgba(244,63,94,0.5), inset -40px 0 60px -20px rgba(59,130,246,0.5)' }
              : { animation: 'rw-siren 0.5s steps(1) infinite' }
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
