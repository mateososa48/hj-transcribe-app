import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Minimal .env.local loader.
 *
 * Deliberately not a dependency: this reads API keys, and a supply-chain
 * compromise in a 12-line convenience package is not a trade worth making on a
 * project whose whole premise is that patient data never leaves the machine.
 *
 * Keys are read here ONLY for the Node-side eval. The deployed app never reads
 * env vars — HJ enters his keys in Einstellungen and they live in IndexedDB.
 */
export function loadEnvLocal(): void {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  for (const name of ['.env.local', '.env']) {
    let raw: string;
    try {
      raw = readFileSync(join(root, name), 'utf8');
    } catch {
      continue;
    }
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      // First file wins; never clobber a real environment variable.
      if (value && process.env[key] === undefined) process.env[key] = value;
    }
  }
}
