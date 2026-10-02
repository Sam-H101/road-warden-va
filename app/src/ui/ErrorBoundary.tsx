// Catches a crashing screen so the learner never sees a blank page.
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  onHome: () => void
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Screen crashed:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-dvh flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center bg-panel border-2 border-line rounded-3xl p-6">
          <div className="text-6xl mb-3" aria-hidden>
            🚧
          </div>
          <h1 className="text-2xl font-extrabold">Road closed for a sec</h1>
          <p className="text-dim mt-2 text-lg">Something went wrong on this screen. Your progress is safe.</p>
          <button
            onClick={() => {
              this.setState({ error: null })
              this.props.onHome()
            }}
            className="mt-6 w-full px-7 py-4 text-xl rounded-2xl font-extrabold bg-gold text-ink"
          >
            Back to Home
          </button>
        </div>
      </div>
    )
  }
}
