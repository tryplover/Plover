import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/instrument-serif/400.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Overlay } from './overlay/Overlay';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('root element missing');

const params = new URLSearchParams(window.location.search);
const variant = params.get('variant');
const isOverlay =
  variant === 'overlay' ||
  window.location.search.includes('overlay') ||
  window.location.hash.includes('overlay');

const showGallery =
  import.meta.env.DEV && new URLSearchParams(window.location.search).get('gallery') === '1';

if (showGallery) {
  import('./dev/ComponentGallery').then(({ ComponentGallery }) => {
    createRoot(container).render(
      <StrictMode>
        <ComponentGallery />
      </StrictMode>,
    );
  });
} else {
  createRoot(container).render(<StrictMode>{isOverlay ? <Overlay /> : <App />}</StrictMode>);
}
