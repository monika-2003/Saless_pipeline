import { Check, Minus } from 'lucide-react'
import { cx } from '../../utils/cx.js'

export function Checkbox({ label, checked, onChange, indeterminate = false, id, disabled = false, ...props }) {
  return (
    <label
      className={cx(
        'check-wrap',
        checked && 'is-checked',
        indeterminate && 'is-partial',
        disabled && 'is-disabled',
      )}
      htmlFor={id}
      onClick={(event) => event.stopPropagation()}
    >
      <input
        id={id}
        type="checkbox"
        className="check-input"
        checked={checked}
        disabled={disabled}
        ref={(node) => {
          if (node) node.indeterminate = indeterminate
        }}
        onChange={(event) => onChange(event.target.checked, event)}
        onClick={(event) => event.stopPropagation()}
        {...props}
      />
      <span className="check-box" aria-hidden="true">
        {indeterminate ? <Minus size={11} strokeWidth={3} /> : null}
        {!indeterminate && checked ? <Check size={11} strokeWidth={3} /> : null}
      </span>
      {label ? <span>{label}</span> : <span className="sr-only">Select</span>}
    </label>
  )
}
