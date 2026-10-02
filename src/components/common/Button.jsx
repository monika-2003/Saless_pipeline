import { cx } from '../../utils/cx.js'

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  className,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      className={cx('btn', `btn-${variant}`, `btn-${size}`, className)}
      {...props}
    >
      {children}
    </button>
  )
}
