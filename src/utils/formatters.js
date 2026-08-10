export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDateTime(date) {
  return `${formatDate(date)} ${formatTime(date)}`
}

export function formatBattery(level) {
  if (level >= 70) return 'good'
  if (level >= 30) return 'medium'
  return 'low'
}
