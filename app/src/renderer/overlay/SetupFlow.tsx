import { useState } from 'react';
import { safeAsync } from '../lib/async';
import { AnimatePresence, motion, ploverDuration, ploverEasing } from '../lib/motion';
import { Stepper } from './steps/Stepper';
import { StepName } from './steps/StepName';
import { StepBreakdown } from './steps/StepBreakdown';
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

  const close = () => {
    if (onClose) {
      onClose();
    } else {
      const closeOverlay = safeAsync(() => window.api.closeOverlay());
      closeOverlay();
    }
  };

  return (
    <div className={`plover-setup plover-setup--${variant}`}>
      {variant === 'window' && <div className="plover-setup__chrome">Plover</div>}
      <AnimatePresence mode="wait">
        {step === 'name' && (
          <motion.div key="name" {...slide()}>
            <StepName
              value={draft}
              onChange={setDraft}
              onNext={() => setStep('breakdown')}
              variant={variant}
            />
          </motion.div>
        )}
        {step === 'breakdown' && (
          <motion.div key="breakdown" {...slide()}>
            <StepBreakdown
              draft={draft}
              variant={variant}
              onBack={() => setStep('name')}
              onNext={async (p) => {
                try {
                  await window.api.commitGoal(p);
                  setStep('committed');
                  setTimeout(close, 800);
                } catch (err) {
                  console.error('Failed to commit goal:', err);
                }
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
