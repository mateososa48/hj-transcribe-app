import { BUILT_IN_KEYS } from './config.ts';
import { db } from './db.ts';
import type { DraftProviderId } from './providers/draft-types.ts';
import type { TranscriptionProviderId } from './providers/types.ts';

/**
 * Settings, of which there are now almost none.
 *
 * He has one machine, one microphone and one key pair, and cannot usefully
 * choose between adapters — so the provider pickers, the retention policies and
 * the key fields are gone. What is left is what he might actually act on:
 * whether the browser has promised to keep his recordings, and how much space
 * they take.
 */

export interface AppSettings {
  asrProviderId: TranscriptionProviderId;
  llmProviderId: DraftProviderId;
  /** Result of the last navigator.storage.persist() call, for the UI. */
  storagePersisted: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  asrProviderId: 'assemblyai-eu',
  // Gateway while we are still choosing a model. Switch to `anthropic` before
  // real patient use — see gateway-draft.ts.
  llmProviderId: 'gateway',
  storagePersisted: false,
};

const SETTINGS_KEY = 'app';
/** API keys live under their own row so they are never spread into logs. */
const KEYS_KEY = 'apiKeys';

export async function loadSettings(): Promise<AppSettings> {
  const row = await db.settings.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<AppSettings> | undefined) ?? {}) };
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const next = { ...(await loadSettings()), ...patch };
  await db.settings.put({ key: SETTINGS_KEY, value: next, updatedAt: Date.now() });
  return next;
}

export type ApiKeyMap = Partial<Record<TranscriptionProviderId | DraftProviderId, string>>;

/**
 * Keys in use, with the build-time pair as the base layer.
 *
 * A key stored on this machine still wins, so moving to per-machine keys later
 * needs no code change — see config.ts for why that matters.
 */
export async function loadApiKeys(): Promise<ApiKeyMap> {
  const row = await db.settings.get(KEYS_KEY);
  const stored = (row?.value as ApiKeyMap | undefined) ?? {};
  const merged: ApiKeyMap = { ...(BUILT_IN_KEYS as ApiKeyMap) };
  for (const [provider, key] of Object.entries(stored)) {
    if (key) merged[provider as keyof ApiKeyMap] = key;
  }
  for (const k of Object.keys(merged) as Array<keyof ApiKeyMap>) {
    if (!merged[k]) delete merged[k];
  }
  return merged;
}

/** Wipes everything. */
export async function clearAllData(): Promise<void> {
  await Promise.all([
    db.sessions.clear(),
    db.segments.clear(),
    db.transcripts.clear(),
    db.results.clear(),
    db.settings.clear(),
  ]);
}
