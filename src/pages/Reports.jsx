import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../components/common/PageHeader'
import ReportsChart from '../components/ReportsChart'
import api from '../services/api'

export default function Reports() {
  const [dateRange, setDateRange] = useState('weekly')
  const [reportType, setReportType] = useState('feedback')
  const [summary, setSummary] = useState([
    { label: 'Total Feedback', value: 0 },
    { label: 'Unhappy Reports', value: 0 },
    { label: 'Device Health Issues', value: 0 },
    { label: 'Alerts Generated', value: 0 },
  ])
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const [reportsRes, devicesRes, alertsRes] = await Promise.all([
          api.get('/api/reports/daily'),
          api.get('/api/devices'),
          api.get('/api/alerts'),
        ])

        if (!mounted) return

        const reports = reportsRes.data || []
        const devices = devicesRes.devices || []
        const alerts = alertsRes.alerts || []

        const totalFeedback = reports.length
        const unhappyReports = reports.filter((r) => r.feedbackType === 'needs_cleaning' || r.feedbackType === 'emergency').length
        const deviceHealthIssues = devices.filter((d) => d.status !== 'healthy').length

        setSummary([
          { label: 'Total Feedback', value: totalFeedback },
          { label: 'Unhappy Reports', value: unhappyReports },
          { label: 'Device Health Issues', value: deviceHealthIssues },
          { label: 'Alerts Generated', value: alerts.length },
        ])

        const trendMap = new Map()
        reports.forEach((r) => {
          const day = new Date(r.timestamp).toLocaleDateString('en-US', { weekday: 'short' })
          if (!trendMap.has(day)) trendMap.set(day, { day, value: 0 })
          trendMap.get(day).value += 1
        })
        setChartData(Array.from(trendMap.values()))
      } catch (e) {
        console.error('Reports load error:', e)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [dateRange])

  return (
    <div className="page">
      <PageHeader
        action={
          <div className="btn-group">
            <button type="button" className="btn btn--secondary">Export CSV</button>
            <button type="button" className="btn btn--secondary">Export Excel</button>
            <button type="button" className="btn btn--secondary">Print</button>
          </div>
        }
      />

      <div className="filters card">
        <label>
          Date Range
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="select">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
        <label>
          Report Type
          <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="select">
            <option value="feedback">Feedback Trends</option>
            <option value="device">Device Health</option>
            <option value="battery">Battery Status</option>
            <option value="alerts">Alerts</option>
          </select>
        </label>
        <label>
          Floor
          <select className="select">
            <option value="">All Floors</option>
            <option value="1">Floor 1</option>
            <option value="2">Floor 2</option>
            <option value="3">Floor 3</option>
          </select>
        </label>
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

          <ReportsChart data={chartData} type={reportType} />
        </>
      )}
    </div>
  )
}
