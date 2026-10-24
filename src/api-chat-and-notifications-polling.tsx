import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiClient, ApiError } from './api'

export function chatCanRefresh() {
  return navigator.onLine && document.visibilityState !== 'hidden'
}

export function chatRetryDelay(error: unknown) {
  return error instanceof ApiError && (error.status === 429 || error.status === 503)
    ? Math.max(error.retryAfter * 1000, 5000) + Math.floor(Math.random() * 1000)
    : 0
}

// One in-flight GET per resource; nothing is persisted or requested while hidden/offline.
export function useChatPolling<T>(api: ApiClient, path: string | null, interval: number) {
  const [state, setState] = useState<{
    path: string | null
    data: T | null
    error: ApiError | null
    loading: boolean
  }>({ path, data: null, error: null, loading: !!path })
  const refreshRef = useRef<() => void>(() => {})
  const blockedUntil = useRef(0)
  const [retryAt, setRetryAt] = useState(0)
  const defer = useCallback((error: unknown) => {
    const delay = chatRetryDelay(error)
    if (delay) {
      blockedUntil.current = Math.max(blockedUntil.current, Date.now() + delay)
      setRetryAt(blockedUntil.current)
    }
  }, [])
  const reload = useCallback(() => refreshRef.current(), [])

  useEffect(() => {
    let alive = true
    let pending = false
    let again = false
    let controller: AbortController | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    blockedUntil.current = 0
    setRetryAt(0)
    setState({ path, data: null, error: null, loading: !!path })
    const schedule = (delay = interval) => {
      clearTimeout(timer)
      if (alive && path && chatCanRefresh()) timer = setTimeout(() => void run(), delay)
    }
    const run = async () => {
      if (!alive || !path || !chatCanRefresh()) return
      if (pending) {
        again = true
        return
      }
      const remaining = blockedUntil.current - Date.now()
      if (remaining > 0) {
        schedule(remaining)
        return
      }
      setRetryAt(0)
      pending = true
      controller = new AbortController()
      const current = controller
      setState((value) => ({ ...value, loading: true }))
      try {
        const data = await api.get<T>(path, current.signal)
        if (alive && !current.signal.aborted) setState({ path, data, error: null, loading: false })
      } catch (error) {
        if (alive && !current.signal.aborted) {
          defer(error)
          setState({
            path,
            data: null,
            error: error instanceof ApiError ? error : new ApiError(0),
            loading: false,
          })
        }
      } finally {
        pending = false
        if (alive) {
          const delay = Math.max(blockedUntil.current - Date.now(), again ? 0 : interval)
          again = false
          schedule(delay)
        }
      }
    }
    const onAvailability = () => {
      if (!chatCanRefresh()) {
        clearTimeout(timer)
        controller?.abort()
      } else void run()
    }
    refreshRef.current = () => {
      clearTimeout(timer)
      void run()
    }
    window.addEventListener('online', onAvailability)
    window.addEventListener('offline', onAvailability)
    window.addEventListener('focus', onAvailability)
    document.addEventListener('visibilitychange', onAvailability)
    void run()
    return () => {
      alive = false
      refreshRef.current = () => {}
      controller?.abort()
      clearTimeout(timer)
      window.removeEventListener('online', onAvailability)
      window.removeEventListener('offline', onAvailability)
      window.removeEventListener('focus', onAvailability)
      document.removeEventListener('visibilitychange', onAvailability)
    }
  }, [api, path, interval, defer])

  return {
    ...(state.path === path ? state : { data: null, error: null, loading: !!path }),
    reload,
    defer,
    retryAt,
    canRequest: () => Date.now() >= blockedUntil.current && chatCanRefresh(),
  }
}

export function useChatConnectivity() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return online
}

// Actor/thread-keyed children use this for every non-poll async action.
export function useChatLifetime() {
  const lifetime = useRef({ alive: true, controllers: new Set<AbortController>() })
  useEffect(() => {
    const current = lifetime.current
    current.alive = true
    return () => {
      current.alive = false
      current.controllers.forEach((controller) => controller.abort())
      current.controllers.clear()
    }
  }, [])
  return lifetime
}
