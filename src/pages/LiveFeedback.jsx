import { useEffect, useMemo, useState } from 'react'
import SearchBar from '../components/common/SearchBar'
import Pagination from '../components/common/Pagination'
import api from '../services/api'
import { formatDateTime } from '../utils/formatters'

const PAGE_SIZE = 5

export default function LiveFeedback() {
  const [feedback, setFeedback] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const data = await api.get('/api/feedback')
        if (mounted) setFeedback(data.feedback || [])
      } catch (e) {
        console.error('LiveFeedback load error:', e)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const filtered = useMemo(() => {
    return feedback.filter((entry) => {
      const matchesFilter = filter === 'all' || entry.feedbackType === filter
      const searchLower = search.toLowerCase()
      const matchesSearch =
        !search ||
        (entry.restroom?.name || '').toLowerCase().includes(searchLower) ||
        (entry.device?.badgeId || '').toLowerCase().includes(searchLower)
      return matchesFilter && matchesSearch
    })
  }, [search, filter, feedback])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="page">
      <div className="toolbar">
        <SearchBar
          value={search}
          onChange={(v) => { setSearch(v); setPage(1) }}
          placeholder="Search by restroom or badge..."
        />
        <select
          value={filter}
          onChange={(e) => { setFilter(e.target.value); setPage(1) }}
          className="select"
          aria-label="Filter by feedback type"
        >
          <option value="all">All Feedback</option>
          <option value="happy">Happy</option>
          <option value="average">Average</option>
          <option value="needs_cleaning">Needs Cleaning</option>
          <option value="emergency">Emergency</option>
        </select>
      </div>

      <div className="card">
        {loading ? (
          <div className="loader-wrap"><div className="loader" /></div>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Restroom</th>
                    <th>Badge</th>
                    <th>Feedback</th>
                    <th>Battery</th>
                    <th>Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatDateTime(entry.timestamp)}</td>
                      <td>{entry.restroom?.name || 'Unknown'}</td>
                      <td><code>{entry.device?.badgeId || '—'}</code></td>
                      <td>{entry.feedbackType?.replace(/_/g, ' ')}</td>
                      <td>{entry.battery ?? '—'}%</td>
                      <td>{entry.signalStrength ?? '—'} dBm</td>
                    </tr>
                  ))}
                  {paginated.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', color: '#64748b' }}>
                        No feedback found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  )
}
