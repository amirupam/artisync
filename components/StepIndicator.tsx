export default function StepIndicator({
  steps,
  currentStep,
  furthestStep,
  onStepClick,
}: {
  steps: string[];
  currentStep: number;
  furthestStep: number;
  onStepClick: (step: number) => void;
}) {
  return (
    <>
      {/* Desktop step indicator */}
      <ol className="hidden md:flex items-center gap-2" aria-label="Profile setup steps">
        {steps.map((label, i) => {
          const step = i + 1;
          const reachable = step <= furthestStep;
          const active = step === currentStep;
          const done = step < currentStep;
          return (
            <li key={label} className="flex items-center gap-2 flex-1">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => onStepClick(step)}
                aria-current={active ? "step" : undefined}
                className={`flex items-center gap-2 w-full rounded-[var(--radius-md)] px-3 py-2 text-left transition-colors
                  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]
                  ${active ? "bg-[var(--color-primary)] text-white" : reachable ? "text-[var(--color-text)] hover:bg-[var(--color-primary-soft)]" : "text-[var(--color-text-secondary)] cursor-not-allowed opacity-60"}`}
              >
                <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold
                  ${active ? "bg-white text-[var(--color-primary)]" : done ? "bg-[var(--color-accent)] text-white" : "bg-[var(--color-primary-soft)] text-[var(--color-primary)]"}`}>
                  {done ? "✓" : step}
                </span>
                <span className="text-xs font-semibold truncate">{label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Mobile progress indicator */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-[var(--color-text)]">
            Step {currentStep} of {steps.length}: {steps[currentStep - 1]}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-[var(--color-primary-soft)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-300"
            style={{ width: `${(currentStep / steps.length) * 100}%` }}
            role="progressbar"
            aria-valuenow={currentStep}
            aria-valuemin={1}
            aria-valuemax={steps.length}
          />
        </div>
      </div>
    </>
  );
}
