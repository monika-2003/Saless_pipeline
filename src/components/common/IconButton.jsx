import { cx } from '../../utils/cx.js'

export function IconButton({ label, children, className, ...props }) {
  return (
    <button type="button" aria-label={label} className={cx('icon-btn', className)} {...props}>
      {children}
    </button>
  )
}
