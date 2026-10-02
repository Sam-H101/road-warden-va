// App shell: settings side effects + the screen router.
import { useCallback, useEffect, useRef } from 'react'
import { applySettings, useAppEffects } from './app/effects'
import { useNav, type Screen } from './app/nav'
import type { RunPlan, RunResult } from './engine/run'
import { GameView } from './game/GameView'
import { BriefingScreen } from './screens/Briefing'
import { ContractsScreen } from './screens/Contracts'
import { DebriefScreen } from './screens/Debrief'
import { DistrictScreen } from './screens/District'
import { ExamScreen } from './screens/Exam'
import { ExamResultScreen } from './screens/ExamResult'
import { GarageScreen } from './screens/Garage'
import { HomeScreen } from './screens/Home'
import { IntroScreen } from './screens/Intro'
import { LibraryScreen } from './screens/Library'
import { MapScreen } from './screens/MapScreen'
import { ModesScreen } from './screens/Modes'
import { SettingsScreen } from './screens/Settings'
import { StatsScreen } from './screens/Stats'
import { useGame } from './store/gameStore'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { FxStyles } from './ui/fx'

/** First launch (no name yet, or intro never finished) starts at the intro. */
function boot() {
  const s = useGame.getState()
  // Apply accessibility settings before the first paint (no flash of big/small text).
  applySettings(s.settings)
  if (!s.playerName || !s.seenIntro) useNav.getState().replace({ name: 'intro' })
}
boot()

function Drive({ plan }: { plan: RunPlan }) {
  const done = useRef(false)

  const onFinish = useCallback((result: RunResult) => {
    if (done.current) return
    done.current = true
    const summary = useGame.getState().recordRun(result)
    useNav.getState().replace({ name: 'debrief', result, summary })
  }, [])

  // GameView may hand back the partial run; record it if anything was answered.
  const onQuit = useCallback((partial?: RunResult) => {
    if (done.current) return
    done.current = true
    if (partial && partial.outcomes.length > 0) {
      useGame.getState().recordRun({ ...partial, completed: false })
    }
    useNav.getState().back()
  }, [])

  return (
    <div className="fixed inset-0 bg-ink">
      <GameView plan={plan} onFinish={onFinish} onQuit={onQuit} />
    </div>
  )
}

function Router({ screen }: { screen: Screen }) {
  switch (screen.name) {
    case 'home':
      return <HomeScreen />
    case 'intro':
      return <IntroScreen />
    case 'map':
      return <MapScreen />
    case 'district':
      return <DistrictScreen district={screen.district} />
    case 'briefing':
      return <BriefingScreen plan={screen.plan} />
    case 'drive':
      return <Drive plan={screen.plan} />
    case 'debrief':
      return <DebriefScreen result={screen.result} summary={screen.summary} />
    case 'exam':
      return <ExamScreen kind={screen.kind} district={screen.district} />
    case 'exam-result':
      return <ExamResultScreen summary={screen.summary} />
    case 'modes':
      return <ModesScreen />
    case 'garage':
      return <GarageScreen />
    case 'contracts':
      return <ContractsScreen />
    case 'settings':
      return <SettingsScreen />
    case 'stats':
      return <StatsScreen />
    case 'library':
      return <LibraryScreen district={screen.district} />
  }
}

export default function App() {
  useAppEffects()
  const screen = useNav((s) => s.screen)

  // Every new screen starts at the top.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [screen])

  return (
    <>
      <FxStyles />
      <ErrorBoundary key={screen.name} onHome={() => useNav.getState().home()}>
        <Router screen={screen} />
      </ErrorBoundary>
    </>
  )
}
