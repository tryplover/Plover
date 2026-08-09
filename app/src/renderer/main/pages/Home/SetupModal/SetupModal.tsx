import { SetupFlow } from '../../../../overlay/SetupFlow/SetupFlow';

interface SetupModalProps {
  // The empty state puts the ✕ inside the modal card; the populated Home puts
  // it on the backdrop so it clears the taller card.
  closeButtonPlacement: 'content' | 'backdrop';
  onDismiss: () => void;
  onFlowClose: () => void;
}

export function SetupModal({ closeButtonPlacement, onDismiss, onFlowClose }: SetupModalProps) {
  return (
    <div className="plover-modal-backdrop">
      {closeButtonPlacement === 'backdrop' && (
        <button
          className="plover-modal-backdrop-close"
          onClick={onDismiss}
          aria-label="Close modal"
        >
          ✕
        </button>
      )}
      <div className="plover-modal-content">
        {closeButtonPlacement === 'content' && (
          <button className="plover-modal-close" onClick={onDismiss} aria-label="Close modal">
            ✕
          </button>
        )}
        <SetupFlow variant="window" onClose={onFlowClose} />
      </div>
    </div>
  );
}
