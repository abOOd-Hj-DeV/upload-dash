import { useState } from 'react'
import { ApiClient, apiId } from './api'
import { useApiResource, useApiUser } from './api-hooks'
import { DesignIcon, Workspace } from './Workspace'
import { CareAvatar } from './api-sessions-and-clinical-support'
import './visual-clients.css'

type Client = {
  id: string
  full_name: string
  status: 'active' | 'past'
  completed_sessions_count: number
  next_session_date: string | null
  age?: number
}
export function Clients({ api, navigate }: { api: ApiClient; navigate: (path: string) => void }) {
  const user = useApiUser(api)
  return user ? (
    <ClientList key={api.getSessionKey()} api={api} navigate={navigate} />
  ) : (
    <p role="alert">Your session has ended. Please sign in again.</p>
  )
}

function ClientList({ api, navigate }: { api: ApiClient; navigate: (path: string) => void }) {
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<'all' | 'active' | 'past'>('all')
  const [sort, setSort] = useState<'name' | 'recent'>('name')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const resource = useApiResource<{
    data: Client[]
    pagination: { current_page: number; last_page: number; total: number }
  }>(api, `/therapists/clients?search=${encodeURIComponent(search)}&page=${page}${status === 'all' ? '' : `&status=${status}`}${sort === 'name' ? '' : '&sort=recent'}`)
  return (
    <Workspace
      api={api}
      title="Manage Clients"
      active="Clients"
      navigate={navigate}
      onSearch={(value) => {
        const nextQuery = value.slice(0, 100)
        setQuery(nextQuery)
        setSearch(nextQuery.trim())
        setPage(1)
      }}
    >
      <section className="clients-page" aria-label="Manage clients">
        <div className="clients-toolbar">
          <div className="clients-filters" role="group" aria-label="Filter clients">
            {([['all', 'All'], ['active', 'Active'], ['past', 'Past']] as const).map(([value, label]) => (
              <button key={value} className={status === value ? 'selected' : ''} aria-pressed={status === value} onClick={() => { setStatus(value); setPage(1) }}>
                {label}{status === value && resource.data ? ` (${resource.data.pagination.total})` : ''}
              </button>
            ))}
          </div>
          <button className="clients-filter-toggle" aria-label="Client filter options" aria-expanded={filtersOpen} aria-controls="client-filter-options" onClick={() => setFiltersOpen(!filtersOpen)}>
            <DesignIcon name="client-6934-imgIcon1.svg" />
          </button>
        </div>
        <div id="client-filter-options" className="clients-filter-options" hidden={!filtersOpen}>
        <form
          className="part2-form"
          onSubmit={(event) => {
            event.preventDefault()
            setPage(1)
            setSearch(query.trim())
          }}
        >
          <label>
            Search clients
            <input
              value={query}
              maxLength={100}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button className="remaining-primary">Search</button>
          <label>Sort clients<select value={sort} onChange={(event) => { setSort(event.target.value as 'name' | 'recent'); setPage(1) }}><option value="name">Name</option><option value="recent">Recent activity</option></select></label>
        </form>
        </div>
        {resource.loading && <p role="status">Loading clients…</p>}
        {resource.error && (
          <p role="alert">
            {resource.error.message}
            <button onClick={resource.reload}>Retry</button>
          </p>
        )}
        {resource.data && (
          <>
            {resource.data.data.length === 0 && <p>No clients found.</p>}
            <div className="clients-grid">
                  {resource.data.data.map((client) => (
                    <article className="client-card" key={client.id}>
                      <header>
                        <button className="client-card-identity" onClick={() => navigate(`/clients/profile?id=${apiId(client.id)}`)}>
                          <CareAvatar name={client.full_name} />
                          <span><strong>{client.full_name}</strong>{client.age != null && <small>{client.age} yrs</small>}</span>
                        </button>
                        <span className={`client-card-status ${client.status}`}>{client.status}</span>
                      </header>
                      <div className="client-card-activity"><span>Activity · past month</span><small>Not supplied by the API</small></div>
                      <div className="client-card-metrics"><span>Completed sessions</span><strong>{client.completed_sessions_count}</strong></div>
                      <div className="client-card-next"><DesignIcon name="part2-07-imgCalendarAlt.svg" /><span>{client.next_session_date ? `Next · ${client.next_session_date}` : 'None scheduled'}</span></div>
                      <footer>
                        <button
                          onClick={() => navigate(`/sessions/upcoming?client=${apiId(client.id)}`)}
                        >
                          Clinical record
                        </button>
                        {client.status === 'active' && (
                          <button onClick={() => navigate(`/chats?client=${apiId(client.id)}`)}>
                            Message
                          </button>
                        )}
                      </footer>
                    </article>
                  ))}
            </div>
            <nav aria-label="Client pages">
              <button disabled={page <= 1 || resource.loading} onClick={() => setPage(page - 1)}>
                Previous
              </button>
              <span>
                Page {page} of {resource.data.pagination.last_page}
              </span>
              <button
                disabled={page >= resource.data.pagination.last_page || resource.loading}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </nav>
          </>
        )}
      </section>
    </Workspace>
  )
}
