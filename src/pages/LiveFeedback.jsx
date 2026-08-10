import { useMemo, useState } from 'react'
import LiveFeedbackTable from '../components/LiveFeedbackTable'
import PageHeader from '../components/common/PageHeader'
import SearchBar from '../components/common/SearchBar'
import Pagination from '../components/common/Pagination'
import { feedbackEntries, getRestroomName } from '../services/mockData'

const PAGE_SIZE = 5

export default function LiveFeedback() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    return feedbackEntries.filter((entry) => {
      const matchesFilter = filter === 'all' || entry.type === filter
      const searchLower = search.toLowerCase()
      const matchesSearch =
        !search ||
        getRestroomName(entry.restroomId).toLowerCase().includes(searchLower) ||
        entry.badgeId.toLowerCase().includes(searchLower)
      return matchesFilter && matchesSearch
    })
  }, [search, filter])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="page">
      <PageHeader
        title="Live Feedback"
        subtitle="Real-time feedback from restroom devices"
      />

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
          <option value="neutral">Neutral</option>
          <option value="unhappy">Unhappy</option>
        </select>
      </div>

      <div className="card">
        <LiveFeedbackTable entries={paginated} />
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </div>
  )
}
