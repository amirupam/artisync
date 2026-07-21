import { TextareaHTMLAttributes, forwardRef, useId } from "react";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
  error?: string;
  optional?: boolean;
};

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, optional, className = "", id, rows = 4, ...rest },
  ref
) {
  const autoId = useId();
  const textareaId = id ?? autoId;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={textareaId} className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
          {label} {optional && <span className="text-[var(--color-text-secondary)] font-normal">(optional)</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        aria-invalid={!!error}
        aria-describedby={error ? `${textareaId}-error` : hint ? `${textareaId}-hint` : undefined}
        className={`w-full rounded-[var(--radius-md)] border bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)]
          placeholder-[var(--color-text-secondary)] transition-colors resize-none
          focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]
          ${error ? "border-[var(--color-error)]" : "border-[var(--color-border)] focus:border-[var(--color-accent)]"}
          ${className}`}
        {...rest}
      />
      {error ? (
        <p id={`${textareaId}-error`} className="mt-1.5 text-xs text-[var(--color-error)]">{error}</p>
      ) : hint ? (
        <p id={`${textareaId}-hint`} className="mt-1.5 text-xs text-[var(--color-text-secondary)]">{hint}</p>
      ) : null}
    </div>
  );
});

export default Textarea;
