export function ProgressBar({ value, max }) {
  const percent = max === 0 ? 0 : Math.min(100, Math.round((value / max) * 100))
  return (
    <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className="progress-bar" style={{ width: `${percent}%` }} />
    </div>
  )
}
