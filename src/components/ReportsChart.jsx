export default function ReportsChart({ data, type = 'feedback' }) {
  const maxValue = Math.max(...data.map((d) => d.value))

  return (
    <div className="reports-chart card">
      <h3 className="card__title">
        {type === 'feedback' ? 'Feedback by Day' : 'Report Overview'}
      </h3>
      <div className="reports-chart__bars">
        {data.map((item) => (
          <div key={item.label} className="reports-chart__row">
            <span className="reports-chart__label">{item.label}</span>
            <div className="reports-chart__track">
              <div
                className="reports-chart__fill"
                style={{ width: maxValue ? `${(item.value / maxValue) * 100}%` : '0%' }}
              />
            </div>
            <span className="reports-chart__value">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
