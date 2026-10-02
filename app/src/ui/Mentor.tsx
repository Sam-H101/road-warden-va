// Captain Rae, the mentor. A friendly face and a speech bubble with read-aloud.
import { story } from '../engine/content'
import { ReadAloudButton, useAutoRead } from './kit'

export function MentorAvatar({ size = 56, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={`shrink-0 ${className}`} role="img" aria-label={story.mentorName}>
      <circle cx="32" cy="32" r="30.5" fill="#1c2440" stroke="#fbbf24" strokeWidth="3" />
      <clipPath id="rw-mentor-clip">
        <circle cx="32" cy="32" r="29" />
      </clipPath>
      <g clipPath="url(#rw-mentor-clip)">
        <path d="M14 66 Q32 46 50 66 Z" fill="#1e3a8a" />
        <path d="M27 50 L32 56 L37 50 Z" fill="#fbbf24" />
        <path d="M17 40 Q16 22 32 22 Q48 22 47 40 Q45 47 42 48 L42 34 L22 34 L22 48 Q19 47 17 40 Z" fill="#3b2314" />
        <circle cx="32" cy="38" r="11.5" fill="#c68642" />
        <circle cx="27.5" cy="37" r="1.7" fill="#0b1020" />
        <circle cx="36.5" cy="37" r="1.7" fill="#0b1020" />
        <path d="M27.5 42.5 Q32 46.5 36.5 42.5" stroke="#0b1020" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <path d="M15 29 Q32 12 49 29 Z" fill="#1e3a8a" />
        <rect x="13" y="27.5" width="38" height="5" rx="2.5" fill="#0f172a" />
        <circle cx="32" cy="22" r="3.6" fill="#fbbf24" />
      </g>
    </svg>
  )
}

/** Mentor says a line. `auto` reads it aloud when read-aloud is set to auto. */
export function MentorLine({ text, auto = false, size = 52, className = '' }: { text: string; auto?: boolean; size?: number; className?: string }) {
  useAutoRead(auto ? text : undefined)
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <MentorAvatar size={size} />
      <div className="relative flex-1 min-w-0 bg-panel2 border-2 border-line rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="text-xs font-extrabold uppercase tracking-wider text-gold">{story.mentorName}</div>
        <div className="flex items-start gap-2">
          <p className="flex-1 text-lg leading-snug">{text}</p>
          <ReadAloudButton text={text} />
        </div>
      </div>
    </div>
  )
}
