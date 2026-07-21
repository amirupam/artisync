import { SelectHTMLAttributes, forwardRef, useId } from "react";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  hint?: string;
  error?: string;
  optional?: boolean;
};

const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, optional, className = "", id, children, ...rest },
  ref
) {
  const autoId = useId();
  const selectId = id ?? autoId;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
          {label} {optional && <span className="text-[var(--color-text-secondary)] font-normal">(optional)</span>}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={!!error}
          aria-describedby={error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined}
          className={`w-full min-h-[44px] appearance-none rounded-[var(--radius-md)] border bg-[var(--color-surface)] px-4 py-2.5 pr-10 text-sm text-[var(--color-text)]
            transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]
            ${error ? "border-[var(--color-error)]" : "border-[var(--color-border)] focus:border-[var(--color-accent)]"}
            ${className}`}
          {...rest}
        >
          {children}
        </select>
        <svg className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {error ? (
        <p id={`${selectId}-error`} className="mt-1.5 text-xs text-[var(--color-error)]">{error}</p>
      ) : hint ? (
        <p id={`${selectId}-hint`} className="mt-1.5 text-xs text-[var(--color-text-secondary)]">{hint}</p>
      ) : null}
    </div>
  );
});

export default Select;
