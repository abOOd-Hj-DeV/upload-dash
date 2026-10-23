import { useEffect, useState } from 'react'
import './visual-r4-network-toggle.css'

const OFFLINE = 'offline'
const PREVIOUS_STATE_KEY = 'demoNetworkPreviousState'

function isDemoNetworkToggleEnabled() {
  return import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === 'true'
}

// Returns the next ?query with only the design-preview `state` parameter changed.
// A non-offline state (e.g. `collapsed`) is handed back so it can be restored later.
export function nextOfflineSearch(search: string, simulate: boolean, previousState?: string | null) {
  const params = new URLSearchParams(search)
  const current = params.get('state')
  if (simulate) params.set('state', OFFLINE)
  else if (current === OFFLINE) {
    if (previousState && previousState !== OFFLINE) params.set('state', previousState)
    else params.delete('state')
  }
  const query = params.toString()
  return {
    search: query ? `?${query}` : '',
    previousState: simulate && current && current !== OFFLINE ? current : null,
  }
}

function readSimulated() {
  return new URLSearchParams(window.location.search).get('state') === OFFLINE
}

function setDemoOfflineSimulation(simulate: boolean) {
  const historyState = (window.history.state ?? {}) as Record<string, unknown>
  const stored = historyState[PREVIOUS_STATE_KEY]
  const next = nextOfflineSearch(
    window.location.search,
    simulate,
    typeof stored === 'string' ? stored : null,
  )
  const url = `${window.location.pathname}${next.search}${window.location.hash}`
  if (url === `${window.location.pathname}${window.location.search}${window.location.hash}`) return
  window.history.pushState(
    next.previousState ? { [PREVIOUS_STATE_KEY]: next.previousState } : {},
    '',
    url,
  )
  // App.tsx re-reads pathname + search on popstate; pushState alone does not notify it.
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function useDemoOfflineSimulation() {
  const [simulated, setSimulated] = useState(readSimulated)
  const [browserOnline, setBrowserOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const syncLocation = () => setSimulated(readSimulated())
    const syncNetwork = () => setBrowserOnline(navigator.onLine)
    window.addEventListener('popstate', syncLocation)
    window.addEventListener('online', syncNetwork)
    window.addEventListener('offline', syncNetwork)
    return () => {
      window.removeEventListener('popstate', syncLocation)
      window.removeEventListener('online', syncNetwork)
      window.removeEventListener('offline', syncNetwork)
    }
  }, [])
  return { simulated, browserOnline, setSimulated: setDemoOfflineSimulation }
}

export function DemoNetworkToggle() {
  return isDemoNetworkToggleEnabled() ? <NetworkToggleControl /> : null
}

function NetworkToggleControl() {
  const { simulated, browserOnline, setSimulated } = useDemoOfflineSimulation()
  if (!browserOnline)
    return (
      <div className="demo-network-toggle is-browser-offline" role="status">
        <span className="demo-network-toggle__dot" aria-hidden="true" />
        Browser is offline
      </div>
    )
  return (
    <>
      <button
        type="button"
        className={`demo-network-toggle ${simulated ? 'is-simulated' : ''}`}
        aria-pressed={simulated}
        aria-describedby="demo-network-toggle-hint"
        onClick={() => setSimulated(!simulated)}
      >
        <span className="demo-network-toggle__dot" aria-hidden="true" />
        {simulated ? 'Back online' : 'Simulate offline'}
      </button>
      <span id="demo-network-toggle-hint" className="demo-network-toggle__hint">
        Demo only: switches the offline design preview. Network requests are not changed.
      </span>
    </>
  )
}

