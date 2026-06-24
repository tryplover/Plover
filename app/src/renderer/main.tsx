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

const isOverlay =
  window.location.search.includes('overlay') || window.location.hash.includes('overlay');

createRoot(container).render(<StrictMode>{isOverlay ? <Overlay /> : <App />}</StrictMode>);
