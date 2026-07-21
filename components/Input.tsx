import { InputHTMLAttributes, forwardRef, useId } from "react";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  optional?: boolean;
};

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, optional, className = "", id, ...rest },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
          {label} {optional && <span className="text-[var(--color-text-secondary)] font-normal">(optional)</span>}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={`w-full min-h-[44px] rounded-[var(--radius-md)] border bg-[var(--color-surface)] px-4 py-2.5 text-sm text-[var(--color-text)]
          placeholder-[var(--color-text-secondary)] transition-colors
          focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]
          ${error ? "border-[var(--color-error)]" : "border-[var(--color-border)] focus:border-[var(--color-accent)]"}
          ${className}`}
        {...rest}
      />
      {error ? (
        <p id={`${inputId}-error`} className="mt-1.5 text-xs text-[var(--color-error)]">{error}</p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-[var(--color-text-secondary)]">{hint}</p>
      ) : null}
    </div>
  );
});

export default Input;
