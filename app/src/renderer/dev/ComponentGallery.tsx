import { StatusIndicator } from '../components/StatusIndicator';
import { ProgressLine } from '../components/ProgressLine';
import { Button } from '../components/Button';
import { StepRow } from '../components/StepRow';
import { Chip } from '../components/Chip';
import './ComponentGallery.css';

export function ComponentGallery() {
  return (
    <div className="gallery-container">
      <h1>Component Gallery</h1>

      <section className="gallery-section">
        <h2>StatusIndicator</h2>
        <div className="gallery-grid">
          <div>
            <StatusIndicator kind="observing" label="observing" />
          </div>
          <div>
            <StatusIndicator kind="paused" label="paused" />
          </div>
          <div>
            <StatusIndicator kind="done" label="done" />
          </div>
          <div>
            <StatusIndicator kind="not-sure" label="not-sure" />
          </div>
        </div>
      </section>

      <section className="gallery-section">
        <h2>ProgressLine</h2>
        <div className="gallery-grid">
          <div>
            <label>50% solid</label>
            <ProgressLine value={0.5} tone="solid" />
          </div>
          <div>
            <label>50% lighter</label>
            <ProgressLine value={0.5} tone="solid" />
          </div>
          <div>
            <label>70% mint</label>
            <ProgressLine value={0.7} tone="mint" />
          </div>
          <div>
            <label>50% lighter</label>
            <ProgressLine value={0.5} tone="solid" />
          </div>
        </div>
      </section>

      <section className="gallery-section">
        <h2>Button</h2>
        <div className="gallery-grid">
          <div>
            <Button variant="primary">Primary</Button>
          </div>
          <div>
            <Button variant="secondary">Secondary</Button>
          </div>
        </div>
      </section>

      <section className="gallery-section">
        <h2>StepRow</h2>
        <div className="gallery-grid">
          <div>
            <StepRow index={1} label="Step 1" state="done" />
          </div>
          <div>
            <StepRow index={2} label="Current step" state="current" trailing={<span>now</span>} />
          </div>
          <div>
            <StepRow index={3} label="Pending step" state="pending" />
          </div>
        </div>
      </section>

      <section className="gallery-section">
        <h2>Chip</h2>
        <div className="gallery-grid">
          <div>
            <Chip selected={false}>One-off</Chip>
          </div>
          <div>
            <Chip selected>Daily</Chip>
          </div>
          <div>
            <Chip selected={false}>Weekly</Chip>
          </div>
        </div>
      </section>
    </div>
  );
}
