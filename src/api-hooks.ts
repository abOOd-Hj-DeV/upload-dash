import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { ApiClient, ApiError } from './api'

export function useApiUser(client: ApiClient) {
  return useSyncExternalStore(client.subscribe, client.getUser, () => null)
}

const noSubscribe = () => () => undefined
const noUser = () => null

export function useApiResource<T>(client: ApiClient | undefined, path: string | null) {
  const user = useSyncExternalStore(
    client?.subscribe ?? noSubscribe,
    client?.getUser ?? noUser,
    noUser,
  )
  const actor = user ? client?.getSessionKey() : null
  const enabled = !!client && !!path && !!user
  const [state, setState] = useState<{
    client: ApiClient | undefined
    actor: number | null | undefined
    path: string | null
    data: T | null
    error: ApiError | null
    loading: boolean
  }>({ client, actor, path, data: null, error: null, loading: enabled })
  const [revision, setRevision] = useState(0)
  const reload = useCallback(() => setRevision((value) => value + 1), [])
  useEffect(() => {
    if (!enabled || !client || !path) return
    const controller = new AbortController()
    let active = true
    setState({ client, actor, path, data: null, error: null, loading: true })
    client
      .get<T>(path, controller.signal)
      .then((data) => {
        if (active && client.getUser() && client.getSessionKey() === actor)
          setState({ client, actor, path, data, error: null, loading: false })
      })
      .catch((error) => {
        if (
          active &&
          !controller.signal.aborted &&
          client.getUser() &&
          client.getSessionKey() === actor
        )
          setState({
            client,
            actor,
            path,
            data: null,
            error: error instanceof ApiError ? error : new ApiError(0),
            loading: false,
          })
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [client, actor, enabled, path, revision])
  return {
    ...(state.path === path && state.client === client && state.actor === actor
      ? state
      : { data: null, error: null, loading: enabled }),
    reload,
  }
}
