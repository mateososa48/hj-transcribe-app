import type { TranscriptionProviderId } from './providers/index.ts';
import { db, logAudit } from './db.ts';

/**
 * When the audio blob for a segment may be discarded.
 *
 * SPEC says "deleted automatically after successful transcription
 * (configurable off)" — that is the default here, unchanged.
 *
 * `afterApproval` is offered because a transcript HJ cannot re-listen to is a
 * transcript he cannot actually proofread, and deleting at transcription time
 * also destroys any chance of re-running a bad segment on a better model.
 * Freigeben is the natural boundary and is still tight. Flagged for HJ's call;
 * not made the default unilaterally.
 */
export type AudioRetention = 'afterTranscription' | 'afterApproval' | 'keep';

export type LlmProviderId = 'anthropic' | 'mistral' | 'gateway';

export interface AppSettings {
  asrProviderId: TranscriptionProviderId;
  llmProviderId: LlmProviderId;
  /**
   * Only used by the AI Gateway, which fronts many models. Ignored by the
   * direct providers, which each pin their own model.
   */
  llmModel: string;
  audioRetention: AudioRetention;
  /** Drafts are removed this many days after export. */
  draftRetentionDays: number;
  /** Result of the last navigator.storage.persist() call, for the UI. */
  storagePersisted: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  asrProviderId: 'assemblyai-eu',
  // Gateway by default while we are still choosing a model. Switch to a direct
  // provider before real patient use — see gateway-draft.ts.
  llmProviderId: 'gateway',
  llmModel: 'anthropic/claude-sonnet-5',
  // Pilot default, chosen deliberately over the SPEC value: keeping the audio
  // until HJ deletes it makes a bad transcript diagnosable while we are still
  // tuning. Revisit before real patient use — 'afterApproval' is the intended
  // shipping default.
  audioRetention: 'keep',
  draftRetentionDays: 14,
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
  // Log WHICH setting changed, never the value — values include provider ids
  // and retention choices, and this table must stay non-clinical.
  await logAudit('settings.changed', { detail: Object.keys(patch).join(',') });
  return next;
}

/**
 * API keys, stored in IndexedDB on HJ's machine.
 *
 * They are not encrypted at rest, and encrypting them here would be theatre:
 * any key the app can use, code running in the app can read, and the wrapping
 * key would have to sit beside them. The real controls are the machine's own
 * disk encryption and account login, plus the CSP that stops any script from
 * shipping them somewhere unexpected.
 */
export type ApiKeyMap = Partial<Record<TranscriptionProviderId | LlmProviderId, string>>;

export async function loadApiKeys(): Promise<ApiKeyMap> {
  const row = await db.settings.get(KEYS_KEY);
  return (row?.value as ApiKeyMap | undefined) ?? {};
}

export async function saveApiKey(
  provider: TranscriptionProviderId | LlmProviderId,
  key: string,
): Promise<void> {
  const keys = await loadApiKeys();
  const trimmed = key.trim();
  if (trimmed) keys[provider] = trimmed;
  else delete keys[provider];
  await db.settings.put({ key: KEYS_KEY, value: keys, updatedAt: Date.now() });
  await logAudit('settings.changed', { detail: `apiKey:${provider}` });
}

/** Show only enough to confirm the right key is stored. Never the whole value. */
export function maskKey(key: string | undefined): string {
  if (!key) return 'nicht hinterlegt';
  if (key.length <= 8) return '••••••••';
  return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
}

/** Wipes everything. Used by "Alle Daten löschen" (SPEC feature F). */
export async function clearAllData(): Promise<void> {
  await Promise.all([
    db.sessions.clear(),
    db.segments.clear(),
    db.transcripts.clear(),
    db.documents.clear(),
    db.glossary.clear(),
    db.templates.clear(),
    db.settings.clear(),
  ]);
  // Audit is cleared last and re-seeded, so the deletion itself stays on record.
  await db.audit.clear();
  await logAudit('data.cleared');
}
