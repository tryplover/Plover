import { CarouselMockup } from './CarouselMockup';

const LAST_SLIDE_INDEX = 3;

const slideLabels = [
  '• Name the main goal you want to accomplish.',
  '• Plover automatically breaks down your goal into clear, trackable steps.',
  '• Connect the documents and applications you want Plover to watch.',
  "✓ You're all set — Plover automatically fills the progress bar as you work.",
];

interface StepTaskCarouselProps {
  slideIndex: number;
  onSlideIndexChange: (next: number) => void;
  onBack: () => void;
  onNext: () => void;
}

export function StepTaskCarousel({
  slideIndex,
  onSlideIndexChange,
  onBack,
  onNext,
}: StepTaskCarouselProps) {
  const label = slideLabels[slideIndex];

  return (
    <section className="plover-onboarding__slide" data-testid="step-guided-carousel">
      <div className="plover-onboarding__centered">
        <div className="plover-onboarding__center-glow" />
        <div className="plover-onboarding__centered-content">
          {label && (
            <span
              className="plover-onboarding__label-capsule"
              style={{
                backgroundColor: 'white',
                border: '1px solid rgba(24,25,26,0.08)',
                marginBottom: '32px',
              }}
            >
              {label}
            </span>
          )}

          <div className="plover-onboarding__carousel-wrapper">
            <button
              type="button"
              className="plover-onboarding__carousel-arrow plover-onboarding__carousel-arrow--left"
              onClick={() => onSlideIndexChange(Math.max(0, slideIndex - 1))}
              disabled={slideIndex === 0}
              data-testid="carousel-arrow-left"
              aria-label="Previous slide"
            >
              ←
            </button>

            <CarouselMockup slideIndex={slideIndex} />

            <button
              type="button"
              className="plover-onboarding__carousel-arrow plover-onboarding__carousel-arrow--right"
              onClick={() => onSlideIndexChange(Math.min(LAST_SLIDE_INDEX, slideIndex + 1))}
              disabled={slideIndex === LAST_SLIDE_INDEX}
              data-testid="carousel-arrow-right"
              aria-label="Next slide"
            >
              →
            </button>
          </div>

          <div
            className="plover-onboarding__carousel-dots"
            style={{ marginTop: '24px', marginBottom: '32px' }}
          >
            {[0, 1, 2, 3].map((idx) => (
              <button
                key={idx}
                type="button"
                className={`plover-onboarding__carousel-dot${idx === slideIndex ? ' plover-onboarding__carousel-dot--active' : ''}`}
                onClick={() => onSlideIndexChange(idx)}
                data-testid={`carousel-indicator-${idx}`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

          <div className="plover-onboarding__btn-row" style={{ justifyContent: 'center' }}>
            {slideIndex < LAST_SLIDE_INDEX ? (
              <button className="plover-onboarding__btn-back" onClick={onBack}>
                Back
              </button>
            ) : (
              <button
                className="plover-onboarding__btn"
                onClick={onNext}
                data-testid="btn-carousel-continue"
              >
                Continue →
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
