import { FEEDBACK_TYPES, DEVICE_STATUS, ALERT_STATUS } from '../../utils/constants'

const STATUS_MAPS = {
  feedback: FEEDBACK_TYPES,
  device: DEVICE_STATUS,
  alert: ALERT_STATUS,
  restroom: {
    good: { label: 'Good', color: '#22c55e' },
    alert: { label: 'Alert', color: '#ef4444' },
    offline: { label: 'Offline', color: '#94a3b8' },
  },
  health: {
    healthy: { label: 'Healthy', color: '#22c55e' },
    warning: { label: 'Warning', color: '#f97316' },
    critical: { label: 'Critical', color: '#ef4444' },
  },
}

export default function StatusBadge({ status, variant = 'feedback' }) {
  const config = STATUS_MAPS[variant]?.[status] ?? { label: status, color: '#94a3b8' }

  return (
    <span
      className="status-badge"
      style={{ '--badge-color': config.color }}
    >
      {config.label}
    </span>
  )
}
