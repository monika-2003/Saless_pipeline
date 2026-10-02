import { cx } from '../../utils/cx.js'

export function Badge({ children, tone = 'default', className }) {
  return (
    <span className={cx('badge', tone !== 'default' && `badge-${tone}`, className)}>
      {tone !== 'default' ? <span className="badge-dot" aria-hidden="true" /> : null}
      {children}
    </span>
  )
}
