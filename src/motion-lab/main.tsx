import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { MotionLab } from './MotionLab';
import './motion-lab.css';

const root = document.getElementById('motion-lab-root');

if (!root) throw new Error('Motion lab root element is missing.');

createRoot(root).render(
  <StrictMode>
    <MotionLab />
  </StrictMode>,
);

