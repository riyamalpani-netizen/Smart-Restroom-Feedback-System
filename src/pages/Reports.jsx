import { useEffect, useMemo, useState, useCallback } from 'react'
import PageHeader from '../components/common/PageHeader'
import ReportsChart from '../components/ReportsChart'
import StatusBadge from '../components/common/StatusBadge'
import api from '../services/api'
import { formatDateTime } from '../utils/formatters'

const REPORT_TYPES = [
  { value: 'feedback', label: 'Feedback Trends' },
  { value: 'device', label: 'Device Health' },
  { value: 'battery', label: 'Battery Status' },
  { value: 'alerts', label: 'Alerts' },
]

const DATE_RANGES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

export default function Reports() {
  const [reportType, setReportType] = useState('feedback')
  const [dateRange, setDateRange] = useState('weekly')
  const [locations, setLocations] = useState([])
  const [floors, setFloors] = useState([])
  const [restrooms, setRestrooms] = useState([])
  const [summary, setSummary] = useState([])
  const [chartData, setChartData] = useState([])
  const [tableData, setTableData] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    locationId: '',
    floorId: '',
    restroomId: '',
    feedbackType: '',
  })

  const loadFilters = useCallback(async () => {
    try {
      const [locRes, floorRes, restRes] = await Promise.all([
        api.get('/api/locations'),
        api.get('/api/floors'),
        api.get('/api/restrooms'),
      ])
      setLocations(locRes.locations || [])
      setFloors(floorRes.floors || [])
      setRestrooms(restRes.restrooms || [])
    } catch (e) {
      console.error('Load filters error:', e)
    }
  }, [])

  const loadReport = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('type', dateRange)
      params.set('reportType', reportType)
      if (filters.locationId) params.set('locationId', filters.locationId)
      if (filters.floorId) params.set('floorId', filters.floorId)
      if (filters.restroomId) params.set('restroomId', filters.restroomId)
      if (filters.feedbackType) params.set('feedbackType', filters.feedbackType)

      const endpoint = `/api/reports/${dateRange}?${params.toString()}`
      const res = await api.get(endpoint)

      const report = res.data || res
      const summaryData = report.summary || {}
      const data = report.data || []

      setTableData(data)

      if (reportType === 'feedback') {
        setSummary([
          { label: 'Total Feedback', value: summaryData.total || 0 },
          { label: 'Happy', value: summaryData.byType?.happy || 0 },
          { label: 'Average', value: summaryData.byType?.average || 0 },
          { label: 'Needs Cleaning', value: summaryData.byType?.needs_cleaning || 0 },
          { label: 'Emergency', value: summaryData.byType?.emergency || 0 },
        ])

        const trendMap = new Map()
        data.forEach((r) => {
          const key = dateRange === 'daily' ? new Date(r.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : new Date(r.timestamp).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
          if (!trendMap.has(key)) trendMap.set(key, { label: key, value: 0 })
          trendMap.get(key).value += 1
        })
        setChartData(Array.from(trendMap.values()))
      } else if (reportType === 'device') {
        setSummary([
          { label: 'Total Devices', value: summaryData.total || 0 },
          { label: 'Healthy', value: summaryData.healthy || 0 },
          { label: 'Warning', value: summaryData.warning || 0 },
          { label: 'Critical', value: summaryData.critical || 0 },
        ])
        setChartData([])
      } else if (reportType === 'battery') {
        setSummary([
          { label: 'Total Devices', value: summaryData.total || 0 },
          { label: 'Low Battery', value: summaryData.low || 0 },
          { label: 'Medium', value: summaryData.medium || 0 },
          { label: 'High', value: summaryData.high || 0 },
          { label: 'Average', value: `${summaryData.average || 0}%` },
        ])
        setChartData([])
      } else if (reportType === 'alerts') {
        setSummary([
          { label: 'Total Alerts', value: summaryData.total || 0 },
          { label: 'Open', value: summaryData.byStatus?.open || 0 },
          { label: 'Assigned', value: summaryData.byStatus?.assigned || 0 },
          { label: 'Resolved', value: summaryData.byStatus?.resolved || 0 },
        ])
        setChartData([])
      }
    } catch (e) {
      console.error('Reports load error:', e)
    } finally {
      setLoading(false)
    }
  }, [dateRange, reportType, filters])

  useEffect(() => {
    loadFilters()
  }, [loadFilters])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  useEffect(() => {
    setFilters((f) => ({ ...f, floorId: '', restroomId: '' }))
  }, [filters.locationId])

  useEffect(() => {
    setFilters((f) => ({ ...f, restroomId: '' }))
  }, [filters.floorId])

  const handleFilterChange = useCallback((field) => (e) => {
    setFilters((f) => ({ ...f, [field]: e.target.value }))
  }, [])

  const handleExportCsv = useCallback(() => {
    if (!tableData.length) return
    const headers = Object.keys(tableData[0]).join(',')
    const rows = tableData.map((r) => Object.values(r).join(','))
    const csv = [headers, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report-${reportType}-${dateRange}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [tableData, reportType, dateRange])

  const handleExportExcel = useCallback(() => {
    if (!tableData.length) return
    const headers = Object.keys(tableData[0]).join('\t')
    const rows = tableData.map((r) => Object.values(r).join('\t'))
    const content = [headers, ...rows].join('\n')
    const blob = new Blob([content], { type: 'application/vnd.ms-excel' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report-${reportType}-${dateRange}.xls`
    a.click()
    URL.revokeObjectURL(url)
  }, [tableData, reportType, dateRange])

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  const filteredFloors = useMemo(() => {
    if (!filters.locationId) return floors
    return floors.filter((f) => f.locationId === filters.locationId)
  }, [floors, filters.locationId])

  const filteredRestrooms = useMemo(() => {
    if (!filters.floorId) return restrooms
    return restrooms.filter((r) => r.floorId === filters.floorId)
  }, [restrooms, filters.floorId])

  const renderTable = () => {
    if (!tableData.length) return <p style={{ color: 'var(--text)', padding: 16 }}>No data available</p>

    const columns = Object.keys(tableData[0])

    return (
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col}>{col.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.map((row, idx) => (
              <tr key={row.id || idx}>
                {columns.map((col) => (
                  <td key={col}>
                    {col === 'feedbackType' ? (
                      <StatusBadge status={row[col]} variant="feedback" />
                    ) : col === 'health' || col === 'status' ? (
                      <StatusBadge status={row[col]} variant={col === 'health' ? 'health' : 'device'} />
                    ) : col === 'timestamp' || col === 'lastSeen' ? (
                      formatDateTime(row[col])
                    ) : col === 'battery' && row[col] != null ? (
                      `${row[col]}%`
                    ) : (
                      row[col] ?? '—'
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        action={
          <div className="btn-group">
            <button type="button" className="btn btn--secondary" onClick={handleExportCsv}>Export CSV</button>
            <button type="button" className="btn btn--secondary" onClick={handleExportExcel}>Export Excel</button>
            <button type="button" className="btn btn--secondary" onClick={handlePrint}>Print</button>
          </div>
        }
      />

      <div className="filters card">
        <label>
          Date Range
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="select">
            {DATE_RANGES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </label>
        <label>
          Report Type
          <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="select">
            {REPORT_TYPES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </label>
        <label>
          Office
          <select value={filters.locationId} onChange={handleFilterChange('locationId')} className="select">
            <option value="">All Offices</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.officeName}</option>
            ))}
          </select>
        </label>
        <label>
          Floor
          <select value={filters.floorId} onChange={handleFilterChange('floorId')} className="select" disabled={!filters.locationId}>
            <option value="">All Floors</option>
            {filteredFloors.map((floor) => (
              <option key={floor.id} value={floor.id}>{floor.floorName}</option>
            ))}
          </select>
        </label>
        <label>
          Restroom
          <select value={filters.restroomId} onChange={handleFilterChange('restroomId')} className="select" disabled={!filters.floorId}>
            <option value="">All Restrooms</option>
            {filteredRestrooms.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </label>
        {reportType === 'feedback' && (
          <label>
            Feedback Type
            <select value={filters.feedbackType} onChange={handleFilterChange('feedbackType')} className="select">
              <option value="">All Types</option>
              <option value="happy">Happy</option>
              <option value="average">Average</option>
              <option value="needs_cleaning">Needs Cleaning</option>
              <option value="emergency">Emergency</option>
            </select>
          </label>
        )}
      </div>

      {loading ? (
        <div className="loader-wrap"><div className="loader" /></div>
      ) : (
        <>
          <div className="report-summary">
            {summary.map((item) => (
              <div key={item.label} className="report-summary__item card">
                <span className="report-summary__value">{item.value}</span>
                <span className="report-summary__label">{item.label}</span>
              </div>
            ))}
          </div>

          {chartData.length > 0 && <ReportsChart data={chartData} type={reportType} />}

          <div className="card" style={{ marginTop: 16 }}>
            <h3 className="card__title">Report Data</h3>
            {renderTable()}
          </div>
        </>
      )}
    </div>
  )
}
