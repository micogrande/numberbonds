import React from 'react'

/**
 * The last line of defence. (PLAN 2.5: "She can never land on a broken screen.")
 *
 * React unmounts the entire tree when a render throws, and an unmounted tree is
 * a white page. A white page to a six-year-old alone with a phone is the app
 * being broken forever, because there is no gesture she knows that fixes it.
 * This turns that into one sentence and one big button.
 *
 * **The realistic failure this catches is a stale chunk.** Activities are loaded
 * with a dynamic import, so a tab left open across a deploy can ask for a file
 * that no longer exists. Reloading is the fix, and reloading is exactly what the
 * button does — after sending her back to `#/`, so the reload does not land on
 * the same broken route a second time.
 *
 * A class, because `getDerivedStateFromError` has no hook equivalent.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
    this.handleReset = this.handleReset.bind(this)
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error, info) {
    // Nobody is watching this console, but the alternative is losing the only
    // description of what happened.
    console.error('Amelia crashed:', error, info?.componentStack)
  }

  handleReset() {
    // Hash first, then reload: a full reload re-imports every chunk, and landing
    // on Home means a broken activity cannot immediately break it again.
    window.location.hash = '#/'
    window.location.reload()
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--spacing-lg)',
          padding: 'var(--spacing-lg)',
          textAlign: 'center',
          background: 'var(--color-bg)',
          color: 'var(--color-text)',
        }}
      >
        <h1 style={{ fontSize: '2rem', fontWeight: 900 }}>Oops!</h1>

        {/* She reads. Say what happened and what to do about it, in her words. */}
        <p style={{ fontSize: '1.25rem', color: 'var(--color-text-light)', maxWidth: '30ch' }}>
          Something went wrong. Press the button and we will start again.
        </p>

        <button
          type="button"
          onClick={this.handleReset}
          style={{
            minHeight: '64px',
            padding: 'var(--spacing-md) var(--spacing-xl)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--color-primary)',
            color: 'white',
            fontSize: '1.5rem',
            fontWeight: 700,
            boxShadow: 'var(--shadow-md)',
          }}
        >
          Start again
        </button>
      </div>
    )
  }
}

export default ErrorBoundary
