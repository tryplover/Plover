import { useRef, useState } from 'react';
import { AnimatePresence, motion, ploverDuration, ploverEasing } from '../../lib/motion';
import { Stepper } from '../steps/Stepper/Stepper';
import { StepName } from '../steps/StepName/StepName';
import { StepBreakdown } from '../steps/StepBreakdown/StepBreakdown';
import type { ProposedPlan } from '../../../preload';
import './SetupFlow.css';

type Step = 'name' | 'breakdown' | 'committed';

export function SetupFlow({
  variant = 'overlay' as const,
  onClose,
}: {
  variant?: 'overlay' | 'window';
  onClose?: () => void;
}) {
  const [step, setStep] = useState<Step>('name');
  const [draft, setDraft] = useState<{ text: string; frequency: 'one-off' | 'daily' | 'weekly' }>({
    text: '',
    frequency: 'one-off',
  });
  const [plan, setPlan] = useState<ProposedPlan | null>(null);
  const committingRef = useRef(false);

  const close = () => {
    if (onClose) {
      onClose();
    } else {
      window.api.closeOverlay().catch((err) => {
        console.error('Unhandled promise rejection:', err);
      });
    }
  };

  const handleDraftChange = (nextDraft: typeof draft) => {
    setDraft(nextDraft);
    setPlan(null);
  };

  return (
    <div className={`plover-setup plover-setup--${variant}`}>
      {variant === 'window' && (
        <div className="plover-setup__chrome">
          <div className="plover-setup__chrome-left">
            <svg
              className="plover-setup__chrome-logo"
              width="13"
              height="13"
              viewBox="0 0 13 13"
              fill="currentColor"
            >
              <rect x="1.5" y="4.5" width="2" height="6.5" rx="0.75" />
              <rect x="5.5" y="1.5" width="2" height="9.5" rx="0.75" />
              <rect x="9.5" y="4.5" width="2" height="6.5" rx="0.75" />
            </svg>
            <span className="plover-setup__chrome-title">Plover</span>
          </div>
          <button className="plover-setup__chrome-close" onClick={close} aria-label="Close modal">
            ✕
          </button>
        </div>
      )}
      <AnimatePresence mode="wait">
        {step === 'name' && (
          <motion.div key="name" {...slide()}>
            <StepName
              value={draft}
              onChange={handleDraftChange}
              onNext={() => setStep('breakdown')}
              variant={variant}
            />
          </motion.div>
        )}
        {step === 'breakdown' && (
          <motion.div key="breakdown" {...slide()}>
            <StepBreakdown
              draft={draft}
              plan={plan}
              variant={variant}
              onBack={() => setStep('name')}
              onNext={(p) => {
                if (committingRef.current) return;
                committingRef.current = true;
                window.api
                  .commitGoal(p)
                  .then(() => {
                    setPlan(p);
                    setStep('committed');
                    setTimeout(close, 800);
                  })
                  .catch((err) => {
                    committingRef.current = false;
                    console.error('Failed to commit goal:', err);
                  });
              }}
            />
          </motion.div>
        )}
        {step === 'committed' && (
          <motion.div key="committed" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p>Tracking started.</p>
          </motion.div>
        )}
      </AnimatePresence>
      <Stepper current={step === 'name' ? 1 : 2} />
    </div>
  );
}

function slide() {
  return {
    initial: { opacity: 0, x: 18 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -18 },
    transition: { duration: ploverDuration.normal, ease: ploverEasing.soft },
  };
}
