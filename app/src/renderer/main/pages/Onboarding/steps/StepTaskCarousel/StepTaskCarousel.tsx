import type { Dispatch, SetStateAction } from 'react';
import { GuidedSlideContent } from './GuidedSlideContent';

interface StepTaskCarouselProps {
  appName: string;
  guidedSlideIndex: number;
  setGuidedSlideIndex: Dispatch<SetStateAction<number>>;
  onBack: () => void;
  onNext: () => void;
}

export function StepTaskCarousel({
  appName,
  guidedSlideIndex,
  setGuidedSlideIndex,
  onBack,
  onNext,
}: StepTaskCarouselProps) {
  return (
    <section className="plover-onboarding__slide" data-testid="step-guided-carousel">
      <div className="plover-onboarding__centered">
        <div className="plover-onboarding__center-glow" />
        <div className="plover-onboarding__centered-content">
          {guidedSlideIndex === 0 && (
            <span
              className="plover-onboarding__label-capsule"
              style={{
                backgroundColor: 'white',
                border: '1px solid rgba(24,25,26,0.08)',
                marginBottom: '32px',
              }}
            >
              • Name the main goal you want to accomplish.
            </span>
          )}
          {guidedSlideIndex === 1 && (
            <span
              className="plover-onboarding__label-capsule"
              style={{
                backgroundColor: 'white',
                border: '1px solid rgba(24,25,26,0.08)',
                marginBottom: '32px',
              }}
            >
              • Plover automatically breaks down your goal into clear, trackable steps.
            </span>
          )}
          {guidedSlideIndex === 2 && (
            <span
              className="plover-onboarding__label-capsule"
              style={{
                backgroundColor: 'white',
                border: '1px solid rgba(24,25,26,0.08)',
                marginBottom: '32px',
              }}
            >
              • Connect the documents and applications you want Plover to watch.
            </span>
          )}
          {guidedSlideIndex === 3 && (
            <span
              className="plover-onboarding__label-capsule"
              style={{
                backgroundColor: 'white',
                border: '1px solid rgba(24,25,26,0.08)',
                marginBottom: '32px',
              }}
            >
              ✓ You're all set — Plover automatically fills the progress bar as you work.
            </span>
          )}

          <div className="plover-onboarding__carousel-wrapper">
            <button
              type="button"
              className="plover-onboarding__carousel-arrow plover-onboarding__carousel-arrow--left"
              onClick={() => setGuidedSlideIndex((prev) => Math.max(0, prev - 1))}
              disabled={guidedSlideIndex === 0}
              data-testid="carousel-arrow-left"
              aria-label="Previous slide"
            >
              ←
            </button>

            <div
              className="plover-onboarding__mockup-window"
              style={{ marginBottom: '0' }}
              data-testid={`guided-slide-${guidedSlideIndex}`}
            >
              <div className="plover-onboarding__mockup-titlebar">
                <div className="plover-onboarding__mockup-dots">
                  <span className="plover-onboarding__mockup-dot" />
                  <span className="plover-onboarding__mockup-dot" />
                  <span className="plover-onboarding__mockup-dot" />
                </div>
                <span className="plover-onboarding__mockup-brand">Plover</span>
                <div className="plover-onboarding__mockup-right-dots" />
              </div>

              <GuidedSlideContent guidedSlideIndex={guidedSlideIndex} appName={appName} />
            </div>

            <button
              type="button"
              className="plover-onboarding__carousel-arrow plover-onboarding__carousel-arrow--right"
              onClick={() => setGuidedSlideIndex((prev) => Math.min(3, prev + 1))}
              disabled={guidedSlideIndex === 3}
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
                className={`plover-onboarding__carousel-dot${idx === guidedSlideIndex ? ' plover-onboarding__carousel-dot--active' : ''}`}
                onClick={() => setGuidedSlideIndex(idx)}
                data-testid={`carousel-indicator-${idx}`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

          <div className="plover-onboarding__btn-row" style={{ justifyContent: 'center' }}>
            {guidedSlideIndex < 3 ? (
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
