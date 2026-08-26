import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '../index.css';
import { ProcessingPreview } from './ProcessingPreview';

/**
 * Dev-only entry. Vite serves any root-level .html in dev; the production
 * build has a single input (index.html), so this never ships — same
 * arrangement as motion-lab.html.
 */
createRoot(document.getElementById('preview-root')!).render(
  <StrictMode>
    <ProcessingPreview />
  </StrictMode>,
);
