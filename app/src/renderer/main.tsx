import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Overlay } from './overlay/Overlay';

const container = document.getElementById('root');
if (!container) throw new Error('root element missing');

const isOverlay =
  window.location.search.includes('overlay') || window.location.hash.includes('overlay');

createRoot(container).render(<StrictMode>{isOverlay ? <Overlay /> : <App />}</StrictMode>);
