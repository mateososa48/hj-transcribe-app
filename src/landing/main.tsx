import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@/index.css';
import './landing.css';
import { Landing } from './Landing';

const root = document.getElementById('landing-root');
if (!root) throw new Error('#landing-root fehlt in landing.html');

createRoot(root).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
);
