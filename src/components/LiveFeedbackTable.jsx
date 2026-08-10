import StatusBadge from './common/StatusBadge'
import { formatDateTime } from '../utils/formatters'
import { getRestroomName } from '../services/mockData'

export default function LiveFeedbackTable({ entries }) {
  if (!entries.length) {
    return <p className="table-empty">No feedback entries found.</p>
  }

  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Restroom</th>
            <th>Feedback</th>
            <th>Badge ID</th>
            <th>Battery</th>
            <th>Device Status</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td>{formatDateTime(entry.time)}</td>
              <td>{getRestroomName(entry.restroomId)}</td>
              <td><StatusBadge status={entry.type} variant="feedback" /></td>
              <td><code>{entry.badgeId}</code></td>
              <td>
                <span className={`battery battery--${entry.battery >= 30 ? 'ok' : 'low'}`}>
                  {entry.battery}%
                </span>
              </td>
              <td><StatusBadge status={entry.deviceStatus} variant="device" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
