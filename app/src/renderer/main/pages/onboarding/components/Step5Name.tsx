import React from 'react';
import { MockupWindow } from './MockupWindow';

interface Step5NameProps {
  onBack: () => void;
  onNext: () => void;
  appName: string;
  setAppName: (name: string) => void;
}

export const Step5Name: React.FC<Step5NameProps> = ({ onBack, onNext, appName, setAppName }) => {
  return (
    <section className="plover-onboarding__slide" data-testid="step-guided-name">
      <div className="plover-onboarding__centered">
        <div className="plover-onboarding__center-glow" />
        <div className="plover-onboarding__centered-content">
          <span
            className="plover-onboarding__label-capsule"
            style={{ backgroundColor: 'white', border: '1px solid rgba(24,25,26,0.08)' }}
          >
            • Type whatever you're actually working on right now.
          </span>

          <MockupWindow brand="Plover" style={{ marginBottom: '32px' }}>
            <div className="plover-onboarding__mockup-content">
              <div className="plover-onboarding__mockup-label">
                <span className="plover-onboarding__mockup-label-dot" />
                <span>new task</span>
              </div>

              <h2 className="plover-onboarding__mockup-h1">What are you working on?</h2>

              <input
                type="text"
                className="plover-onboarding__mockup-input"
                aria-label="Task name"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
              />

              <h4 className="plover-onboarding__mockup-label-small">How often is this?</h4>
              <div className="plover-onboarding__mockup-pills">
                <span className="plover-onboarding__mockup-pill plover-onboarding__mockup-pill--active">
                  One-off
                </span>
                <span className="plover-onboarding__mockup-pill">Daily</span>
                <span className="plover-onboarding__mockup-pill">Weekly</span>
              </div>

              <div className="plover-onboarding__mockup-footer">
                <span />
                <button
                  className="plover-onboarding__mockup-btn-primary"
                  onClick={onNext}
                  disabled={!appName.trim()}
                  data-testid="btn-break-steps"
                >
                  Break into steps →
                </button>
              </div>
            </div>
          </MockupWindow>

          <button className="plover-onboarding__btn-back" onClick={onBack}>
            Back
          </button>
        </div>
      </div>
    </section>
  );
};
