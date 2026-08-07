import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/instrument-serif/400.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Companion } from './Companion';
import { ErrorBoundary } from '../components/ErrorBoundary';
import '../index.css';

const container = document.getElementById('root');
if (!container) throw new Error('root element missing');

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <Companion />
    </ErrorBoundary>
  </StrictMode>,
);
