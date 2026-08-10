import { useState } from 'react'
import ReportsChart from '../components/ReportsChart'
import PageHeader from '../components/common/PageHeader'
import { feedbackTrend, devices, alerts } from '../services/mockData'

export default function Reports() {
  const [dateRange, setDateRange] = useState('weekly')
  const [reportType, setReportType] = useState('feedback')

  const chartData = feedbackTrend.map((d) => ({
    label: d.day,
    value: d.happy + d.neutral + d.unhappy,
  }))

  const summary = [
    { label: 'Total Feedback', value: chartData.reduce((s, d) => s + d.value, 0) },
    { label: 'Unhappy Reports', value: feedbackTrend.reduce((s, d) => s + d.unhappy, 0) },
    { label: 'Device Health Issues', value: devices.filter((d) => d.health !== 'healthy').length },
    { label: 'Alerts Generated', value: alerts.length },
  ]

  return (
    <div className="page">
      <PageHeader
        title="Reports"
        subtitle="Generate and export feedback and device reports"
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

      <div className="report-summary">
        {summary.map((item) => (
          <div key={item.label} className="report-summary__item card">
            <span className="report-summary__value">{item.value}</span>
            <span className="report-summary__label">{item.label}</span>
          </div>
        ))}
      </div>

      <ReportsChart data={chartData} type={reportType} />
    </div>
  )
}
