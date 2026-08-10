export default function FeedbackChart({ data }) {
  const maxTotal = Math.max(...data.map((d) => d.happy + d.neutral + d.unhappy))

  return (
    <div className="feedback-chart card">
      <h3 className="card__title">Feedback Trend (7 Days)</h3>
      <div className="feedback-chart__bars">
        {data.map((day) => {
          const total = day.happy + day.neutral + day.unhappy
          const height = maxTotal ? (total / maxTotal) * 100 : 0

          return (
            <div key={day.day} className="feedback-chart__column">
              <div className="feedback-chart__stack" style={{ height: `${height}%` }}>
                <div
                  className="feedback-chart__segment feedback-chart__segment--happy"
                  style={{ flex: day.happy }}
                  title={`Happy: ${day.happy}`}
                />
                <div
                  className="feedback-chart__segment feedback-chart__segment--neutral"
                  style={{ flex: day.neutral }}
                  title={`Neutral: ${day.neutral}`}
                />
                <div
                  className="feedback-chart__segment feedback-chart__segment--unhappy"
                  style={{ flex: day.unhappy }}
                  title={`Unhappy: ${day.unhappy}`}
                />
              </div>
              <span className="feedback-chart__label">{day.day}</span>
            </div>
          )
        })}
      </div>
      <div className="feedback-chart__legend">
        <span><i className="dot dot--happy" /> Happy</span>
        <span><i className="dot dot--neutral" /> Neutral</span>
        <span><i className="dot dot--unhappy" /> Unhappy</span>
      </div>
    </div>
  )
}
