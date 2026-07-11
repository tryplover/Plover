interface Step1UsecaseProps {
  usecases: { label: string; icon: string }[];
  selectedUsecases: string[];
  onToggleUsecase: (label: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export function Step1Usecase({
  usecases,
  selectedUsecases,
  onToggleUsecase,
  onBack,
  onNext,
}: Step1UsecaseProps) {
  return (
    <section className="plover-onboarding__slide" data-testid="step-usecase">
      <div className="plover-onboarding__centered">
        <div className="plover-onboarding__center-glow" />
        <div className="plover-onboarding__centered-content">
          <h1 className="plover-onboarding__title--center">
            What tasks can Plover help you track?
          </h1>
          <p className="plover-onboarding__desc--center">
            Help Plover understand your tasks better.
          </p>

          <div className="plover-onboarding__chips-grid">
            {usecases.map((usecase) => {
              const isSelected = selectedUsecases.includes(usecase.label);
              return (
                <div
                  key={usecase.label}
                  className={`plover-onboarding__usecase-chip ${
                    isSelected ? 'plover-onboarding__usecase-chip--selected' : ''
                  }`}
                  onClick={() => onToggleUsecase(usecase.label)}
                >
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span className="plover-onboarding__chip-icon" aria-hidden="true">
                      {usecase.icon}
                    </span>
                    <span>{usecase.label}</span>
                  </div>
                  {isSelected && (
                    <span className="plover-onboarding__chip-check" aria-label="selected">
                      ✓
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="plover-onboarding__btn-row" style={{ justifyContent: 'center' }}>
            <button className="plover-onboarding__btn-back" onClick={onBack}>
              Back
            </button>
            <button
              className="plover-onboarding__btn"
              onClick={onNext}
              data-testid="btn-usecase-continue"
            >
              Continue →
            </button>
          </div>
          <p className="plover-onboarding__disclaimer">You can change this anytime.</p>
        </div>
      </div>
    </section>
  );
}
