/**
 * Build-time credentials.
 *
 * ⚠️ THESE ARE PUBLIC. Anything inlined here is compiled into the JS bundle and
 * readable by anyone who can load the page. That is a deliberate trade for the
 * current phase: one shared pair of keys so the app just works, with no key
 * entry to get through while testing.
 *
 * Before HJ uses this with real patients, one of these has to happen:
 *   - put the deployment behind Vercel access protection, or
 *   - go back to per-machine keys in IndexedDB (the settings UI is still there,
 *     and a stored key still overrides these), or
 *   - move to short-lived tokens.
 *
 * SPEC constraint 1 is unaffected — calls still go browser -> provider direct,
 * with no proxy of ours in between.
 */

/**
 * Every read below is a STATIC `import.meta.env.VITE_…` on purpose.
 *
 * Vite substitutes those at build time by matching the exact expression.
 * Indexing the object with a variable (`import.meta.env[name]`) compiles, runs,
 * and silently yields undefined in the built bundle — which shows up as "no key
 * configured" only once it is deployed.
 */
function trim(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export const BUILT_IN_KEYS = {
  'assemblyai-eu': trim(import.meta.env.VITE_ASSEMBLYAI_API_KEY),
  elevenlabs: trim(import.meta.env.VITE_ELEVENLABS_API_KEY),
  voxtral: trim(import.meta.env.VITE_MISTRAL_API_KEY),
  openai: trim(import.meta.env.VITE_OPENAI_API_KEY),
  gateway: trim(import.meta.env.VITE_AI_GATEWAY_API_KEY),
  anthropic: trim(import.meta.env.VITE_ANTHROPIC_API_KEY),
  mistral: trim(import.meta.env.VITE_MISTRAL_API_KEY),
} as const;

export type BuiltInKeyId = keyof typeof BUILT_IN_KEYS;

export function hasBuiltInKey(id: string): boolean {
  return Boolean(BUILT_IN_KEYS[id as BuiltInKeyId]);
}
