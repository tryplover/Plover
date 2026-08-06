import { SetupFlow } from '../../../../overlay/SetupFlow/SetupFlow';

interface SetupModalProps {
  closeButtonPlacement: 'content' | 'backdrop';
  onDismiss: () => void;
  onFlowClose: () => void;
}

export function SetupModal({ closeButtonPlacement, onDismiss, onFlowClose }: SetupModalProps) {
  const closeButton = (
    <button
      className={
        closeButtonPlacement === 'content' ? 'plover-modal-close' : 'plover-modal-backdrop-close'
      }
      onClick={onDismiss}
      aria-label="Close modal"
    >
      ✕
    </button>
  );

  if (closeButtonPlacement === 'backdrop') {
    return (
      <div className="plover-modal-backdrop">
        {closeButton}
        <div className="plover-modal-content">
          <SetupFlow variant="window" onClose={onFlowClose} />
        </div>
      </div>
    );
  }

  return (
    <div className="plover-modal-backdrop">
      <div className="plover-modal-content">
        {closeButton}
        <SetupFlow variant="window" onClose={onFlowClose} />
      </div>
    </div>
  );
}
