/**
 * Every origin this app is permitted to talk to.
 *
 * This is the single source of truth for the Content-Security-Policy
 * `connect-src` allowlist, which vite.config.ts injects at build time. That
 * turns SPEC constraint 2 ("no patient data leaves the browser except to the
 * configured EU AI endpoints") from a rule someone has to remember into one the
 * browser enforces.
 *
 * Consequence, and it is the point: adding a provider requires editing this
 * file and rebuilding. There is no runtime path that can widen the allowlist,
 * so every possible exfiltration destination is visible in one diff.
 *
 * No analytics, no error reporting, no fonts, no CDNs — deliberately.
 */

export const ASR_ORIGINS = {
  'assemblyai-eu': 'https://api.eu.assemblyai.com',
  elevenlabs: 'https://api.elevenlabs.io',
  voxtral: 'https://api.mistral.ai',
  openai: 'https://api.openai.com',
} as const;

export const LLM_ORIGINS = {
  anthropic: 'https://api.anthropic.com',
  mistral: 'https://api.mistral.ai',
  /**
   * Vercel AI Gateway. A PROXY — allowed here only so models can be compared
   * during development. Remove this entry before HJ uses the app with real
   * patients; see src/lib/providers/gateway-draft.ts.
   */
  gateway: 'https://ai-gateway.vercel.sh',
} as const;

/** Deduplicated origin list for the CSP. */
export const ALLOWED_CONNECT_ORIGINS: string[] = [
  ...new Set([...Object.values(ASR_ORIGINS), ...Object.values(LLM_ORIGINS)]),
];
