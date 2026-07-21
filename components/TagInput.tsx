import { useId, useMemo, useState } from "react";

export default function TagInput({
  label,
  hint,
  values,
  onChange,
  suggestions = [],
  placeholder = "Type and press Enter to add",
}: {
  label?: string;
  hint?: string;
  values: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const inputId = useId();

  const filteredSuggestions = useMemo(() => {
    const q = text.trim().toLowerCase();
    return suggestions
      .filter((s) => !values.includes(s))
      .filter((s) => !q || s.toLowerCase().includes(q))
      .slice(0, 8);
  }, [suggestions, text, values]);

  function addTag(raw: string) {
    const v = raw.trim();
    if (!v || values.includes(v)) return;
    onChange([...values, v]);
    setText("");
    setOpen(false);
  }

  function removeTag(v: string) {
    onChange(values.filter((x) => x !== v));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(text);
    } else if (e.key === "Backspace" && !text && values.length > 0) {
      removeTag(values[values.length - 1]);
    }
  }

  return (
    <div className="w-full">
      {label && <label htmlFor={inputId} className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{label}</label>}

      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {values.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary-soft)] pl-3 pr-1.5 py-1 text-xs font-medium text-[var(--color-primary)]">
              {v}
              <button
                type="button"
                onClick={() => removeTag(v)}
                aria-label={`Remove ${v}`}
                className="rounded-full p-0.5 hover:bg-[var(--color-primary)]/15 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-accent)]"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          id={inputId}
          type="text"
          value={text}
          placeholder={placeholder}
          onChange={(e) => { setText(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={handleKeyDown}
          className="w-full min-h-[44px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm text-[var(--color-text)]
            placeholder-[var(--color-text-secondary)] focus:border-[var(--color-accent)]
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        />
        {open && filteredSuggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-md)] max-h-52 overflow-auto">
            {filteredSuggestions.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addTag(s)}
                  className="w-full text-left px-4 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-primary-soft)]"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {hint && <p className="mt-1.5 text-xs text-[var(--color-text-secondary)]">{hint}</p>}
    </div>
  );
}
