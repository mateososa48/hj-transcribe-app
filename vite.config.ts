import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

import { ALLOWED_CONNECT_ORIGINS } from './src/lib/providers/origins.ts';

// __dirname does not exist in an ESM config file.
const rootDir = dirname(fileURLToPath(import.meta.url));

/**
 * Build-time Content-Security-Policy.
 *
 * Injected on `vite build` only — the dev server needs inline scripts, eval and
 * a websocket for HMR, and weakening the production policy to accommodate that
 * would defeat the purpose. Verify the policy against `npm run preview`, which
 * serves the real build.
 */
/**
 * The policy, shared by the build-time <meta> tag and the deployed HTTP header.
 *
 * `frame-ancestors` is deliberately absent: browsers ignore it when delivered
 * via <meta> and log an error. It is set as a real header in vercel.json
 * instead, alongside a copy of this policy. `csp.test.ts` asserts the two stay
 * in sync.
 */
export function buildCsp(): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    // Tailwind and React inject style tags at runtime. Inline STYLE is a far
    // smaller risk than inline script, which stays forbidden.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    // blob: is required to play back recorded segments from IndexedDB.
    "media-src 'self' blob:",
    "font-src 'self'",
    `connect-src 'self' ${ALLOWED_CONNECT_ORIGINS.join(' ')}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ');
}

function cspPlugin(): Plugin {
  const policy = buildCsp();

  return {
    name: 'arztbrief-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return {
        html,
        tags: [
          {
            tag: 'meta',
            attrs: { 'http-equiv': 'Content-Security-Policy', content: policy },
            injectTo: 'head-prepend',
          },
        ],
      };
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), cspPlugin()],
  // The "@/..." alias shadcn/ui generates in every component it adds.
  resolve: { alias: { '@': resolve(rootDir, './src') } },
  build: {
    // Everything is bundled — no runtime CDN fetches (SPEC constraint 2).
    assetsInlineLimit: 0,
    sourcemap: false,
    rollupOptions: {
      // Without explicit inputs only index.html ships; the landing page is a
      // real production page, not a dev tool like motion-lab/preview.
      input: {
        index: resolve(rootDir, 'index.html'),
        landing: resolve(rootDir, 'landing.html'),
      },
    },
  },
  server: { port: 5173 },
  preview: { port: 4173 },
});
