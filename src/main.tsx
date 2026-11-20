import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { registerServiceWorker } from './services/pwa';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Hisaab could not find its root element.');

registerServiceWorker();

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
