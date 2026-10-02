// First launch: name, then three swipeable "how to play" cards, then mission 1.
import { useState, type ReactNode } from 'react'
import { useNav } from '../app/nav'
import { storyFor } from '../engine/content'
import { useGame } from '../store/gameStore'
import { Button, ReadAloudButton, useAutoRead } from '../ui/kit'
import { MentorAvatar, MentorLine } from '../ui/Mentor'
import { missionPlan, startPlan } from '../ui/play'
import { Swiper } from '../ui/Swiper'

interface HowCard {
  title: string
  body: string
  keys: string
  art: ReactNode
}

const CARDS: HowCard[] = [
  {
    title: 'Steer into the right answer',
    body: 'A question pops up. Three gates show three answers. Take your time. Press the green GO when you are ready, then drive through the right one.',
    keys: 'Keys: ← →   Phone: swipe or tap a side',
    art: <GatesArt />,
  },
  {
    title: 'Hold the brake to stop',
    body: 'Red light? School bus? Hold BRAKE until you stop. Let go to drive again.',
    keys: 'Keys: ↓ or Space   Phone: hold BRAKE',
    art: <BrakeArt />,
  },
  {
    title: 'Misses show a replay',
    body: 'Missed one? You see the right answer and the rule. It comes back later so you can nail it.',
    keys: 'Misses never cost XP.',
    art: <ReplayArt />,
  },
]

export function IntroScreen() {
  const savedName = useGame((s) => s.playerName)
  const setName = useGame((s) => s.setName)
  const setSeenIntro = useGame((s) => s.setSeenIntro)
  const [step, setStep] = useState<'name' | 'cards'>('name')
  const [name, setLocalName] = useState(savedName)
  const [card, setCard] = useState(0)
  const welcome = storyFor('d01-rookie')?.intro[0] ?? "Welcome to the squad, rookie! I'm Captain Rae."

  const trimmed = name.trim()

  const finish = () => {
    setName(trimmed || 'Rookie')
    setSeenIntro()
    if (!startPlan(missionPlan('d01-rookie', 0), 'replace')) useNav.getState().home()
  }

  if (step === 'name') {
    return (
      <div className="min-h-dvh flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <main className="flex-1 w-full max-w-lg mx-auto px-4 py-8 flex flex-col gap-6 justify-center">
          <div className="text-center">
            <div className="text-sm font-extrabold tracking-[0.3em] text-info uppercase">Virginia</div>
            <h1 className="text-5xl font-extrabold glow leading-none mt-1">ROAD WARDEN</h1>
            <p className="text-dim mt-2 text-lg">Drive. Learn the rules. Pass the DMV test.</p>
          </div>
          <MentorLine text={welcome} auto />
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (trimmed) setStep('cards')
            }}
          >
            <label htmlFor="rw-name" className="text-xl font-extrabold">
              What should I call you?
            </label>
            <input
              id="rw-name"
              value={name}
              onChange={(e) => setLocalName(e.target.value.slice(0, 24))}
              placeholder="Your name"
              autoComplete="given-name"
              autoFocus
              maxLength={24}
              className="w-full px-5 py-4 text-2xl font-bold rounded-2xl bg-panel2 border-2 border-line focus:border-gold outline-none placeholder:text-dim/60"
            />
            <Button type="submit" variant="primary" size="lg" disabled={!trimmed} className="w-full mt-2">
              NEXT →
            </Button>
          </form>
        </main>
      </div>
    )
  }

  const last = card === CARDS.length - 1
  return (
    <div className="min-h-dvh flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <main className="flex-1 w-full max-w-lg mx-auto px-4 py-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <MentorAvatar size={44} />
          <div className="flex-1 text-lg font-bold">How to play, {trimmed || 'rookie'}</div>
          <button onClick={finish} className="text-dim font-bold min-h-11 px-2 hover:text-text">
            Skip
          </button>
        </div>
        <Swiper
          index={card}
          onIndex={setCard}
          label="How to play"
          slides={CARDS.map((c, i) => (
            <HowToCard key={i} card={c} active={i === card} n={i + 1} />
          ))}
        />
        <div className="mt-auto pt-2" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <Button variant="primary" size="lg" className="w-full" onClick={() => (last ? finish() : setCard(card + 1))}>
            {last ? 'START MISSION 1 ▶' : 'NEXT →'}
          </Button>
        </div>
      </main>
    </div>
  )
}

function HowToCard({ card, active, n }: { card: HowCard; active: boolean; n: number }) {
  const speech = `${card.title}. ${card.body}`
  useAutoRead(active ? speech : undefined)
  return (
    <div className="bg-panel border-2 border-line rounded-3xl p-5 flex flex-col gap-3 h-full select-none">
      <div className="rounded-2xl bg-ink border border-line overflow-hidden aspect-[16/10] flex items-center justify-center">{card.art}</div>
      <div className="text-xs font-extrabold text-dim tracking-widest">STEP {n} OF 3</div>
      <div className="flex items-start gap-2">
        <h2 className="flex-1 text-2xl font-extrabold leading-tight">{card.title}</h2>
        <ReadAloudButton text={speech} />
      </div>
      <p className="text-lg leading-snug">{card.body}</p>
      <p className="text-info font-bold">{card.keys}</p>
    </div>
  )
}

// ---------- tiny illustrations ----------

function Road({ children }: { children?: ReactNode }) {
  return (
    <svg viewBox="0 0 320 200" className="w-full h-full" aria-hidden>
      <rect width="320" height="200" fill="#0b1020" />
      <rect y="70" width="320" height="130" fill="#14532d" />
      <path d="M130 70 L190 70 L300 200 L20 200 Z" fill="#334155" />
      <path d="M150 70 L130 200" stroke="#eef2ff" strokeWidth="3" strokeDasharray="14 12" />
      <path d="M170 70 L190 200" stroke="#eef2ff" strokeWidth="3" strokeDasharray="14 12" />
      {children}
    </svg>
  )
}

function Car({ x = 160, y = 172 }: { x?: number; y?: number }) {
  return (
    <g transform={`translate(${x - 22} ${y - 18})`}>
      <rect x="2" y="6" width="40" height="26" rx="7" fill="#38bdf8" />
      <rect x="9" y="0" width="26" height="14" rx="5" fill="#0ea5e9" />
      <rect x="11" y="3" width="22" height="8" rx="3" fill="#0b1020" opacity="0.6" />
      <rect x="5" y="24" width="8" height="4" rx="1" fill="#f43f5e" />
      <rect x="31" y="24" width="8" height="4" rx="1" fill="#f43f5e" />
    </g>
  )
}

function GatesArt() {
  return (
    <Road>
      <rect x="40" y="86" width="240" height="6" fill="#a5b0d0" />
      <rect x="40" y="86" width="6" height="40" fill="#a5b0d0" />
      <rect x="274" y="86" width="6" height="40" fill="#a5b0d0" />
      {[
        { x: 50, t: 'Speed up', c: '#1c2440' },
        { x: 124, t: 'Stop', c: '#15803d' },
        { x: 198, t: 'Honk', c: '#1c2440' },
      ].map((g) => (
        <g key={g.t}>
          <rect x={g.x} y="96" width="70" height="28" rx="6" fill={g.c} stroke="#eef2ff" strokeWidth="2" />
          <text x={g.x + 35} y="115" textAnchor="middle" fontSize="14" fontWeight="800" fill="#eef2ff" fontFamily="Lexend, sans-serif">
            {g.t}
          </text>
        </g>
      ))}
      <g transform="translate(18 18)">
        <polygon points="14,0 30,0 44,14 44,30 30,44 14,44 0,30 0,14" fill="#dc2626" stroke="#fff" strokeWidth="2" />
        <text x="22" y="27" textAnchor="middle" fontSize="10" fontWeight="800" fill="#fff" fontFamily="Lexend, sans-serif">
          STOP
        </text>
      </g>
      <path d="M160 150 L160 134" stroke="#22c55e" strokeWidth="5" strokeLinecap="round" />
      <path d="M152 140 L160 130 L168 140" stroke="#22c55e" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Car />
    </Road>
  )
}

function BrakeArt() {
  return (
    <Road>
      <g transform="translate(150 20)">
        <rect x="0" y="0" width="22" height="54" rx="6" fill="#111827" stroke="#a5b0d0" strokeWidth="2" />
        <circle cx="11" cy="13" r="7" fill="#ef4444" />
        <circle cx="11" cy="28" r="7" fill="#3f3f46" />
        <circle cx="11" cy="43" r="7" fill="#3f3f46" />
      </g>
      <rect x="110" y="128" width="100" height="6" fill="#eef2ff" />
      <Car y={164} />
      <g transform="translate(236 128)">
        <circle cx="34" cy="34" r="32" fill="#f43f5e" stroke="#9f1239" strokeWidth="4" />
        <text x="34" y="40" textAnchor="middle" fontSize="15" fontWeight="800" fill="#fff" fontFamily="Lexend, sans-serif">
          BRAKE
        </text>
      </g>
      <text x="270" y="122" textAnchor="middle" fontSize="12" fontWeight="800" fill="#fbbf24" fontFamily="Lexend, sans-serif">
        HOLD
      </text>
    </Road>
  )
}

function ReplayArt() {
  return (
    <svg viewBox="0 0 320 200" className="w-full h-full" aria-hidden>
      <rect width="320" height="200" fill="#0b1020" />
      <rect x="40" y="22" width="240" height="156" rx="16" fill="#141a2e" stroke="#2a3558" strokeWidth="3" />
      <rect x="40" y="22" width="240" height="34" rx="16" fill="#f43f5e" />
      <rect x="40" y="44" width="240" height="12" fill="#f43f5e" />
      <text x="160" y="46" textAnchor="middle" fontSize="16" fontWeight="800" fill="#fff" fontFamily="Lexend, sans-serif" letterSpacing="4">
        ⟲ REPLAY
      </text>
      <g transform="translate(62 72)">
        <polygon points="30,0 60,52 0,52" fill="#fff" stroke="#dc2626" strokeWidth="6" strokeLinejoin="round" />
      </g>
      <text x="140" y="94" fontSize="13" fontWeight="800" fill="#22c55e" fontFamily="Lexend, sans-serif">
        ✓ YIELD
      </text>
      <rect x="140" y="104" width="118" height="8" rx="4" fill="#a5b0d0" opacity="0.6" />
      <rect x="140" y="118" width="96" height="8" rx="4" fill="#a5b0d0" opacity="0.6" />
      <rect x="92" y="142" width="136" height="26" rx="10" fill="#fbbf24" />
      <text x="160" y="160" textAnchor="middle" fontSize="13" fontWeight="800" fill="#0b1020" fontFamily="Lexend, sans-serif">
        Got it
      </text>
    </svg>
  )
}
