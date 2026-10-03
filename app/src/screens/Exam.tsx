// Exam Day, district bosses and the sign test. One question per screen.
// Exam and sign test look like a calm DMV computer test (light, plain, no juice,
// no feedback per question). Bosses get mild game styling and instant feedback.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { districtById, story, storyFor } from '../engine/content'
import {
  BOSS_PASS_PCT,
  EXAM_PART1_PASS,
  EXAM_PART2_PASS,
  buildBoss,
  buildExam,
  shuffleChoices,
  type ExamAnswer,
  type ExamPaper,
} from '../engine/exam'
import type { DistrictId, Question } from '../engine/types'
import { useNav } from '../app/nav'
import { playSfx, vibrate } from '../services/sfx'
import { stopSpeaking } from '../services/speech'
import { useGame } from '../store/gameStore'
import { Button, ProgressBar, ReadAloudButton, SignImage, useAutoRead } from '../ui/kit'
import { InlineConfirm } from '../ui/b-controls'
import { useReducedMotion } from '../ui/b-util'

type Kind = 'exam' | 'boss' | 'signs'
type Phase = 'intro' | 'test' | 'break'

const LETTERS = ['A', 'B', 'C', 'D'] as const

function makePaper(kind: Kind, district?: DistrictId): ExamPaper {
  if (kind === 'boss' && district) return buildBoss(district)
  const full = buildExam()
  // The sign test is Part 1 only. It is graded as a district-less boss paper so
  // it passes on 10/10 and does not add a fake row to the Exam Day history.
  if (kind === 'signs') return { kind: 'boss', part1: full.part1, part2: [] }
  return full
}

function readText(q: Question, choices: string[]): string {
  return `${q.prompt} ${choices.map((c, i) => `${LETTERS[i]}: ${c}.`).join(' ')}`
}

export function ExamScreen({ kind: kindProp, district }: { kind: Kind; district?: DistrictId }) {
  const kind: Kind = kindProp === 'boss' && !district ? 'exam' : kindProp
  const nav = useNav()
  const recordExam = useGame((s) => s.recordExam)
  const haptics = useGame((s) => s.settings.haptics)

  const [paper] = useState(() => makePaper(kind, district))
  const all = useMemo(() => [...paper.part1, ...paper.part2], [paper])
  const [shuffled] = useState(() => all.map((q) => shuffleChoices(q)))

  const [phase, setPhase] = useState<Phase>('intro')
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<ExamAnswer[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false) // boss only
  const [confirmQuit, setConfirmQuit] = useState(false)
  const finished = useRef(false)

  const isBoss = kind === 'boss'
  const calm = !isBoss

  useEffect(() => () => stopSpeaking(), [])
  // Each new question (or part) starts at the top of the page.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [index, phase])

  const finish = useCallback(
    (final: ExamAnswer[]) => {
      if (finished.current) return
      finished.current = true
      stopSpeaking()
      const summary = recordExam(paper, final)
      nav.replace({ name: 'exam-result', summary })
    },
    [nav, paper, recordExam],
  )

  /** Move on after an answer is locked in. */
  const advance = useCallback(
    (final: ExamAnswer[]) => {
      const p1 = paper.part1.length
      const atEndOfPart1 = index === p1 - 1 && paper.part2.length > 0
      if (atEndOfPart1 && kind === 'exam') {
        // Like the real DMV: any missed sign ends the test after Part 1.
        if (final.some((a) => a.part === 1 && !a.correct)) return finish(final)
        setPhase('break')
        setIndex(index + 1)
        setSelected(null)
        return
      }
      if (index >= all.length - 1) return finish(final)
      setIndex(index + 1)
      setSelected(null)
      setRevealed(false)
    },
    [all.length, finish, index, kind, paper],
  )

  const lockIn = useCallback(
    (choice: number) => {
      const q = all[index]
      const sh = shuffled[index]
      if (!q || !sh) return
      const original = q.choices.indexOf(sh.choices[choice])
      const answer: ExamAnswer = {
        questionId: q.id,
        chosen: original >= 0 ? original : choice,
        correct: choice === sh.answer,
        part: q.part,
      }
      const final = [...answers.filter((a) => a.questionId !== q.id), answer]
      setAnswers(final)
      return final
    },
    [all, answers, index, shuffled],
  )

  /** Exam / signs: confirm the highlighted answer and go on. */
  const confirmAnswer = useCallback(() => {
    if (selected === null) return
    const final = lockIn(selected)
    if (final) advance(final)
  }, [advance, lockIn, selected])

  /** Boss: tapping an answer locks it in and shows feedback. */
  const bossAnswer = useCallback(
    (choice: number) => {
      if (revealed) return
      setSelected(choice)
      setRevealed(true)
      const final = lockIn(choice)
      const ok = choice === shuffled[index]?.answer
      playSfx(ok ? 'correct' : 'miss')
      vibrate(ok ? 20 : [30, 40, 30], haptics)
      return final
    },
    [haptics, index, lockIn, revealed, shuffled],
  )

  const choose = useCallback(
    (choice: number) => {
      if (isBoss) bossAnswer(choice)
      else setSelected(choice)
    },
    [bossAnswer, isBoss],
  )

  const next = useCallback(() => {
    if (isBoss) {
      if (revealed) advance(answers)
    } else confirmAnswer()
  }, [advance, answers, confirmAnswer, isBoss, revealed])

  // Keyboard: 1-4 / A-D pick, Enter goes on, Esc asks to quit.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      // A focused ordinary button handles its own Enter (answer buttons do not).
      const onPlainButton = !!t && t.tagName === 'BUTTON' && !t.dataset.answer
      if (e.key === 'Enter' && onPlainButton) return
      if (e.key === 'Escape') {
        if (phase === 'test') setConfirmQuit((v) => !v)
        return
      }
      if (confirmQuit) return
      if (phase === 'intro' || phase === 'break') {
        // Intro buttons are focused and handle Enter themselves.
        if (e.key === 'Enter' && phase === 'break' && all.length) {
          e.preventDefault()
          setPhase('test')
        }
        return
      }
      const n = shuffled[index]?.choices.length ?? 4
      const k = e.key.toLowerCase()
      let pick = -1
      if (k >= '1' && k <= '4') pick = Number(k) - 1
      else if (k >= 'a' && k <= 'd' && k.length === 1) pick = k.charCodeAt(0) - 97
      if (pick >= 0 && pick < n) {
        e.preventDefault()
        choose(pick)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [all.length, choose, confirmQuit, index, next, phase, shuffled])

  const quit = () => {
    stopSpeaking()
    nav.back()
  }

  // ---------- nothing to test yet ----------
  if (!all.length) {
    return (
      <Shell calm={calm} title={titleFor(kind, district)} onQuit={quit}>
        <div className="max-w-xl mx-auto text-center py-10">
          <div className="text-5xl mb-3" aria-hidden>
            🚧
          </div>
          <p className="text-xl font-bold">This test is still being built.</p>
          <p className={`mt-2 ${calm ? 'text-slate-600' : 'text-dim'}`}>There are no questions here yet. Drive some missions and check back soon.</p>
          <Button variant="primary" size="lg" className="mt-6 w-full" onClick={quit}>
            Go back
          </Button>
        </div>
      </Shell>
    )
  }

  // ---------- intro ----------
  if (phase === 'intro') {
    return (
      <Shell calm={calm} title={titleFor(kind, district)} onQuit={quit}>
        <Intro kind={kind} district={district} paper={paper} onStart={() => setPhase('test')} onBack={quit} />
      </Shell>
    )
  }

  // ---------- between Part 1 and Part 2 (exam only) ----------
  if (phase === 'break') {
    const p1 = answers.filter((a) => a.part === 1 && a.correct).length
    const text = `Part 1 is done. You got ${p1} of ${paper.part1.length} signs right. Now Part 2: ${paper.part2.length} questions about driving rules. You need ${EXAM_PART2_PASS} right to pass.`
    return (
      <Shell calm title={titleFor(kind, district)} onQuit={() => setConfirmQuit(true)}>
        <BreakCard text={text} p1={p1} total={paper.part1.length} part2={paper.part2.length} onGo={() => setPhase('test')} />
        {confirmQuit && (
          <div className="max-w-xl mx-auto mt-4">
            <QuitConfirm calm onKeep={() => setConfirmQuit(false)} onQuit={quit} />
          </div>
        )}
      </Shell>
    )
  }

  // ---------- one question ----------
  const q = all[index]
  const sh = shuffled[index]
  const part = q.part
  const inPart = part === 1 ? index : index - paper.part1.length
  const partTotal = part === 1 ? paper.part1.length : paper.part2.length

  return (
    <Shell calm={calm} title={titleFor(kind, district)} onQuit={() => setConfirmQuit(true)} quitLabel={isBoss ? 'Leave' : 'Quit test'}>
      {confirmQuit && (
        <div className="max-w-2xl mx-auto mb-4">
          <QuitConfirm calm={calm} onKeep={() => setConfirmQuit(false)} onQuit={quit} />
        </div>
      )}
      {isBoss ? (
        <BossHud paper={paper} answers={answers} index={index} district={district} />
      ) : (
        <div className="max-w-2xl mx-auto mb-4">
          <div className="flex items-center justify-between text-sm font-semibold text-slate-600">
            <span>{kind === 'signs' ? 'Sign Test' : part === 1 ? 'Part 1: Road Signs' : 'Part 2: General Knowledge'}</span>
            <span>
              Question {inPart + 1} of {partTotal}
            </span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-300 overflow-hidden" aria-hidden>
            <div className="h-full bg-[#1f4e8c] transition-[width] duration-300" style={{ width: `${((inPart + 1) / Math.max(1, partTotal)) * 100}%` }} />
          </div>
        </div>
      )}
      <QuestionCard
        key={q.id}
        q={q}
        number={inPart + 1}
        choices={sh.choices}
        answer={sh.answer}
        selected={selected}
        revealed={isBoss && revealed}
        calm={calm}
        disabled={confirmQuit}
        onChoose={choose}
      />
      <div className="max-w-2xl mx-auto mt-5" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        {isBoss && revealed && <BossFeedback q={q} correct={selected === sh.answer} rightText={sh.choices[sh.answer]} />}
        {(!isBoss || revealed) && (
          <Button variant="primary" size="lg" className="w-full mt-4" disabled={(!isBoss && selected === null) || confirmQuit} onClick={next}>
            {nextLabel(kind, index, all.length, paper.part1.length, paper.part2.length)}
          </Button>
        )}
        {!isBoss && (
          <p className="text-center text-sm text-slate-500 mt-3 hidden sm:block">Tip: press 1-4 or A-D to pick, then Enter.</p>
        )}
      </div>
    </Shell>
  )
}

function titleFor(kind: Kind, district?: DistrictId): string {
  if (kind === 'boss') return district ? `Boss: ${districtById.get(district)?.boss ?? 'District Boss'}` : 'Boss'
  if (kind === 'signs') return 'Sign Test'
  return 'Exam Day'
}

function nextLabel(kind: Kind, index: number, total: number, p1: number, p2: number): string {
  const last = index >= total - 1
  if (kind === 'exam' && index === p1 - 1 && p2 > 0) return 'Finish Part 1'
  if (last) return kind === 'boss' ? 'See my result' : 'Finish test'
  return kind === 'boss' ? 'Next question' : 'Next'
}

// ---------- layout shell ----------

function Shell({
  calm,
  title,
  onQuit,
  quitLabel = 'Back',
  children,
}: {
  calm: boolean
  title: string
  onQuit: () => void
  quitLabel?: string
  children: ReactNode
}) {
  if (calm) {
    // Plain, light "computer test" look, on purpose: no game juice.
    return (
      <div className="min-h-dvh flex flex-col bg-[#eef1f5] text-slate-900">
        <header
          className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 bg-[#1f3a5f] text-white"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wider text-white/70">Knowledge Exam Practice</div>
            <h1 className="text-lg font-bold truncate">{title}</h1>
          </div>
          <button
            onClick={onQuit}
            className="min-h-11 px-4 rounded-lg border border-white/40 text-white font-semibold hover:bg-white/10"
          >
            {quitLabel}
          </button>
        </header>
        <main className="flex-1 w-full px-4 py-5">{children}</main>
      </div>
    )
  }
  return (
    <div className="min-h-dvh flex flex-col">
      <header
        className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 bg-ink/90 backdrop-blur border-b border-line"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <h1 className="text-xl font-extrabold flex-1 truncate">{title}</h1>
        <button onClick={onQuit} className="min-h-11 px-4 rounded-xl bg-panel2 border-2 border-line font-bold text-dim hover:text-text">
          {quitLabel}
        </button>
      </header>
      <main className="flex-1 w-full px-4 py-4">{children}</main>
    </div>
  )
}

// ---------- intro ----------

function Intro({
  kind,
  district,
  paper,
  onStart,
  onBack,
}: {
  kind: Kind
  district?: DistrictId
  paper: ExamPaper
  onStart: () => void
  onBack: () => void
}) {
  const p1 = paper.part1.length
  const p2 = paper.part2.length
  const total = p1 + p2
  const need = Math.ceil(total * BOSS_PASS_PCT)

  if (kind === 'boss' && district) {
    const d = districtById.get(district)
    const line = storyFor(district)?.bossIntro ?? 'Show what you know!'
    const rules = `${total} questions. Get ${need} right to win.${p1 ? ' Every sign question must be right.' : ''} You see the answer after each one.`
    const text = `${d?.boss ?? 'The boss'}. ${line} ${rules}`
    return <BossIntro color={d?.color ?? '#fbbf24'} name={d?.boss ?? 'District Boss'} districtName={d?.name ?? ''} line={line} rules={rules} text={text} onStart={onStart} />
  }

  const pep = kind === 'exam' ? story.examDayPepTalk : []
  const rules =
    kind === 'signs'
      ? [`${p1} road sign questions.`, `You must get all ${p1} right, just like Part 1 of the real test.`, 'No hints. No perks. Take your time.']
      : [
          `Part 1: ${p1} road sign questions. You must get all ${EXAM_PART1_PASS} right.`,
          `If you miss a sign, the test stops after Part 1. That is how the real DMV does it.`,
          `Part 2: ${p2} questions. You need ${EXAM_PART2_PASS} right to pass.`,
          'No perks at the DMV. You will see your results at the end.',
        ]
  return <CalmIntro pep={pep} rules={rules} onStart={onStart} onBack={onBack} kind={kind} />
}

function CalmIntro({ pep, rules, onStart, onBack, kind }: { pep: string[]; rules: string[]; onStart: () => void; onBack: () => void; kind: Kind }) {
  // One idea per screen: the mentor's pep talk first, then the rules.
  const [step, setStep] = useState<'pep' | 'rules'>(pep.length ? 'pep' : 'rules')
  const text = step === 'pep' ? pep.join(' ') : rules.join(' ')
  useAutoRead(text, [step])
  const speaker = <ReadAloudButton text={text} className="!bg-[#1f3a5f]/10 !text-[#1f3a5f]" />

  if (step === 'pep') {
    return (
      <div className="max-w-xl mx-auto">
        <section className="bg-white rounded-xl border border-slate-300 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="text-3xl" aria-hidden>
              🧑‍✈️
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-500">{story.mentorName}</p>
              <ul className="mt-1 space-y-2 text-lg leading-snug">
                {pep.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </div>
            {speaker}
          </div>
        </section>
        <Button variant="primary" size="lg" className="w-full mt-6" onClick={() => setStep('rules')} autoFocus>
          See how the test works
        </Button>
        <button onClick={onBack} className="w-full min-h-11 mt-3 text-slate-600 font-semibold hover:text-slate-900">
          Not today
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto">
      <section className="bg-white rounded-xl border border-slate-300 p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold flex-1">{kind === 'signs' ? 'How the sign test works' : 'How the test works'}</h2>
          {speaker}
        </div>
        <ol className="mt-3 space-y-3 text-lg leading-snug">
          {rules.map((r, i) => (
            <li key={i} className="flex gap-3">
              <span className="shrink-0 w-8 h-8 rounded-full bg-[#1f3a5f] text-white font-bold flex items-center justify-center text-base">{i + 1}</span>
              <span>{r}</span>
            </li>
          ))}
        </ol>
      </section>
      <Button key="start" variant="primary" size="lg" className="w-full mt-6" onClick={onStart} autoFocus>
        Start the test
      </Button>
      <button onClick={pep.length ? () => setStep('pep') : onBack} className="w-full min-h-11 mt-3 text-slate-600 font-semibold hover:text-slate-900">
        {pep.length ? 'Back' : 'Not today'}
      </button>
    </div>
  )
}

function BossIntro({
  color,
  name,
  districtName,
  line,
  rules,
  text,
  onStart,
}: {
  color: string
  name: string
  districtName: string
  line: string
  rules: string
  text: string
  onStart: () => void
}) {
  const reduced = useReducedMotion()
  useAutoRead(text)
  return (
    <div className="max-w-xl mx-auto text-center pt-4">
      <p className="text-sm font-bold uppercase tracking-widest text-dim">{districtName} boss</p>
      <div
        className={`mx-auto mt-4 w-28 h-28 rounded-full flex items-center justify-center text-6xl border-4 ${reduced ? '' : 'animate-pop'}`}
        style={{ borderColor: color, background: `${color}22`, boxShadow: `0 0 40px ${color}55` }}
        aria-hidden
      >
        👹
      </div>
      <h2 className="text-3xl font-extrabold mt-4" style={{ color }}>
        {name}
      </h2>
      <div className="flex items-start gap-2 mt-4 bg-panel border-2 border-line rounded-2xl p-4 text-left">
        <p className="text-lg flex-1">{line}</p>
        <ReadAloudButton text={text} />
      </div>
      <p className="text-dim mt-4">{rules}</p>
      <Button variant="primary" size="xl" className="w-full mt-6" onClick={onStart} autoFocus>
        Fight!
      </Button>
    </div>
  )
}

function BreakCard({ text, p1, total, part2, onGo }: { text: string; p1: number; total: number; part2: number; onGo: () => void }) {
  useAutoRead(text)
  return (
    <div className="max-w-xl mx-auto">
      <section className="bg-white rounded-xl border border-slate-300 p-6 shadow-sm text-center">
        <div className="flex justify-end -mt-2 -mr-2">
          <ReadAloudButton text={text} className="!bg-[#1f3a5f]/10 !text-[#1f3a5f]" />
        </div>
        <p className="text-sm font-semibold text-slate-500">Part 1 complete</p>
        <p className="text-4xl font-bold mt-1 text-[#166534]">
          {p1} / {total}
        </p>
        <p className="text-lg mt-2">All signs correct. Nice and steady.</p>
        <hr className="my-5 border-slate-200" />
        <p className="text-xl font-bold">Part 2: General Knowledge</p>
        <p className="text-lg mt-2">
          {part2} questions. You need {EXAM_PART2_PASS} right to pass.
        </p>
      </section>
      <Button variant="primary" size="lg" className="w-full mt-6" onClick={onGo} autoFocus>
        Start Part 2
      </Button>
    </div>
  )
}

function QuitConfirm({ calm, onKeep, onQuit }: { calm: boolean; onKeep: () => void; onQuit: () => void }) {
  if (!calm) {
    return (
      <InlineConfirm
        message="Leave the boss fight?"
        detail="Your answers will not count. You can fight again any time."
        cancelLabel="Keep going"
        confirmLabel="Leave"
        onCancel={onKeep}
        onConfirm={onQuit}
        tone="calm"
      />
    )
  }
  return (
    <div role="alertdialog" aria-label="Quit the test?" className="bg-white rounded-xl border-2 border-[#1f3a5f] p-4 shadow-sm">
      <p className="text-lg font-bold">Quit the test?</p>
      <p className="text-slate-600 mt-1">Your answers will not count. You can take it again any time.</p>
      <div className="flex flex-wrap gap-3 mt-4">
        <button onClick={onKeep} autoFocus className="flex-1 min-w-[8rem] min-h-12 rounded-lg bg-[#1f3a5f] text-white font-bold">
          Keep going
        </button>
        <button onClick={onQuit} className="flex-1 min-w-[8rem] min-h-12 rounded-lg border-2 border-slate-400 text-slate-700 font-bold">
          Quit
        </button>
      </div>
    </div>
  )
}

// ---------- question ----------

function QuestionCard({
  q,
  number,
  choices,
  answer,
  selected,
  revealed,
  calm,
  disabled,
  onChoose,
}: {
  q: Question
  number: number
  choices: string[]
  answer: number
  selected: number | null
  revealed: boolean
  calm: boolean
  disabled: boolean
  onChoose: (i: number) => void
}) {
  const text = readText(q, choices)
  useAutoRead(text, [q.id])
  const imgSize = q.part === 1 ? 180 : 120

  return (
    <div className="max-w-2xl mx-auto">
      <section className={calm ? 'bg-white rounded-xl border border-slate-300 p-4 sm:p-6 shadow-sm' : 'bg-panel border-2 border-line rounded-2xl p-4 sm:p-6'}>
        {q.image && (
          <div className={`flex justify-center mb-4 rounded-lg py-3 ${calm ? 'bg-slate-100' : 'bg-panel2'}`}>
            <SignImage id={q.image} size={imgSize} className={calm ? '!drop-shadow-none' : ''} />
          </div>
        )}
        <div className="flex items-start gap-3">
          <span className={`text-lg font-bold shrink-0 ${calm ? 'text-slate-500' : 'text-dim'}`}>{number}.</span>
          <h2 className="text-xl sm:text-2xl font-semibold leading-snug flex-1">{q.prompt}</h2>
          <ReadAloudButton text={text} label="Read question and answers" className={calm ? '!bg-[#1f3a5f]/10 !text-[#1f3a5f]' : ''} />
        </div>
      </section>

      <ul className="mt-4 space-y-3" role="radiogroup" aria-label="Answers">
        {choices.map((c, i) => {
          const isSel = selected === i
          const isRight = i === answer
          let cls: string
          let badge: string
          if (calm) {
            cls = isSel ? 'bg-[#e8f0fb] border-[#1f4e8c] ring-2 ring-[#1f4e8c]/30' : 'bg-white border-slate-300 hover:border-[#1f4e8c]'
            badge = isSel ? 'bg-[#1f4e8c] text-white border-[#1f4e8c]' : 'bg-white text-slate-700 border-slate-400'
          } else if (revealed) {
            cls = isRight ? 'bg-good/15 border-good' : isSel ? 'bg-bad/15 border-bad' : 'bg-panel2 border-line opacity-60'
            badge = isRight ? 'bg-good text-ink border-good' : isSel ? 'bg-bad text-white border-bad' : 'bg-panel text-dim border-line'
          } else {
            cls = 'bg-panel2 border-line hover:border-info'
            badge = 'bg-panel text-text border-line'
          }
          return (
            <li key={i} className="flex items-stretch gap-2">
              <button
                role="radio"
                data-answer={i}
                aria-checked={isSel}
                disabled={disabled || revealed}
                onClick={() => onChoose(i)}
                className={`flex-1 flex items-center gap-3 text-left min-h-14 px-3 py-3 rounded-xl border-2 transition-colors disabled:cursor-default ${cls}`}
              >
                <span className={`shrink-0 w-9 h-9 rounded-full border-2 font-bold flex items-center justify-center ${badge}`}>
                  {revealed && isRight ? '✓' : revealed && isSel ? '✗' : LETTERS[i]}
                </span>
                <span className="text-lg leading-snug">{c}</span>
              </button>
              <ReadAloudButton
                text={`${LETTERS[i]}: ${c}`}
                label={`Read answer ${LETTERS[i]}`}
                className={`self-center ${calm ? '!bg-transparent !text-[#1f3a5f] hover:!bg-slate-200' : '!bg-transparent'}`}
              />
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ---------- boss extras ----------

function BossHud({ paper, answers, index, district }: { paper: ExamPaper; answers: ExamAnswer[]; index: number; district?: DistrictId }) {
  const total = paper.part1.length + paper.part2.length
  const need = Math.ceil(total * BOSS_PASS_PCT)
  const hits = answers.filter((a) => a.correct).length
  const color = (district && districtById.get(district)?.color) || '#fbbf24'
  // Like the DMV: every sign question must be right, whatever the score.
  const hasSigns = paper.part1.length > 0
  const signMiss = answers.some((a) => a.part === 1 && !a.correct)
  const broken = hits >= need && !signMiss
  return (
    <div className="max-w-2xl mx-auto mb-4">
      <div className="flex items-center justify-between text-sm font-bold">
        <span className="text-dim">
          Question {index + 1} of {total}
        </span>
        <span className={broken ? 'text-good' : 'text-text'}>
          {broken ? 'Shield broken!' : hits >= need ? 'Shield holds: a sign was missed' : `Shield: ${need - hits} hits left`}
        </span>
      </div>
      {hasSigns && (
        <div className={`mt-1 text-sm font-bold ${signMiss ? 'text-bad' : 'text-good'}`}>
          {signMiss ? 'One sign missed. Every sign must be right to win.' : 'Signs: all right so far ✓ (every sign must be right)'}
        </div>
      )}
      <div className="mt-2 flex gap-1" aria-hidden>
        {Array.from({ length: need }, (_, i) => (
          <div
            key={i}
            className="h-3 flex-1 rounded-full border border-line transition-colors"
            style={{ background: i < need - hits ? color : 'transparent' }}
          />
        ))}
      </div>
      <ProgressBar value={index + 1} max={total} color="bg-info" className="mt-2 opacity-60" label="Questions done" />
    </div>
  )
}

function BossFeedback({ q, correct, rightText }: { q: Question; correct: boolean; rightText: string }) {
  const reduced = useReducedMotion()
  const text = correct ? `Direct hit! ${q.explain}` : `Not quite. The answer is: ${rightText}. ${q.explain}`
  useAutoRead(text, [q.id])
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const box = ref.current?.parentElement ?? ref.current
    box?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
  }, [q.id, reduced])
  return (
    <div
      ref={ref}
      role="status"
      className={`rounded-2xl border-2 p-4 ${correct ? 'border-good bg-good/10' : 'border-bad bg-bad/10'} ${reduced ? '' : 'animate-rise'}`}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <p className={`text-xl font-extrabold ${correct ? 'text-good' : 'text-bad'}`}>{correct ? 'Direct hit!' : 'Not quite.'}</p>
          {!correct && (
            <p className="mt-1 text-lg">
              Answer: <strong>{rightText}</strong>
            </p>
          )}
          <p className="mt-1 text-dim">{q.explain}</p>
        </div>
        <ReadAloudButton text={text} />
      </div>
    </div>
  )
}
