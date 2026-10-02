export function EmptyState({ icon, title, message, action }) {
  return (
    <div className="empty-state">
      {icon ? <div className="empty-icon">{icon}</div> : null}
      <h3>{title}</h3>
      {message ? <p>{message}</p> : null}
      {action}
    </div>
  )
}
