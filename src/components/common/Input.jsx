import { Search } from 'lucide-react'

export function Input({ icon, className, ...props }) {
  if (!icon) return <input className={className ? `input ${className}` : 'input'} {...props} />

  return (
    <div className="input-wrap">
      <span className="input-icon">{icon === 'search' ? <Search size={15} /> : icon}</span>
      <input className="input" {...props} />
    </div>
  )
}
