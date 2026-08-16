import Dexie, { type EntityTable } from 'dexie';

/**
 * All persistence for the app. IndexedDB only — there is no server, by design
 * (SPEC constraint 1). Everything here lives on HJ's machine.
 *
 * Nothing in this file may be transmitted anywhere except to the configured
 * AI endpoints, and only the fields those endpoints need.
 */

export type SessionStatus = 'recording' | 'stopped' | 'abandoned';

/** One recording sitting. Survives a crash so it can be offered for recovery. */
export interface Session {
  id: string;
  startedAt: number;
  endedAt?: number;
  status: SessionStatus;
  /**
   * A local scratch label so HJ can tell unfinished sessions apart on recovery
   * ("Sitzung vom 14:32"). NOT the patient name — the patient identity lives on
   * the document, entered deliberately, not captured incidentally from audio.
   */
  label?: string;
  documentId?: string;
}

export type TranscriptionStatus = 'pending' | 'running' | 'done' | 'failed';

/**
 * One rotated recorder segment: a self-contained, independently playable file.
 * Written the moment it exists, before any network call — SPEC constraint 6
 * ("a recording must be unlosable").
 */
export interface Segment {
  id: string;
  sessionId: string;
  /** Monotonic within a session; defines transcript assembly order. */
  index: number;
  blob?: Blob;
  mimeType: string;
  durationMs: number;
  createdAt: number;
  transcriptionStatus: TranscriptionStatus;
  attempts: number;
  lastError?: string;
  /**
   * Earliest time the queue may retry, for exponential backoff. Not indexed —
   * the queue filters in memory, and the pending set is tiny.
   */
  nextAttemptAt?: number;
  /** Set when the audio blob is dropped under the retention policy. */
  audioDeletedAt?: number;
}

export interface Transcript {
  id: string;
  sessionId: string;
  segmentId: string;
  providerId: string;
  text: string;
  createdAt: number;
}

/** The six sections of HJ's Word template, in his order. */
export type SectionKey =
  | 'kopf'
  | 'diagnosen'
  | 'anamnese'
  | 'befunde'
  | 'beurteilung'
  | 'therapie';

export const SECTION_ORDER: SectionKey[] = [
  'kopf',
  'diagnosen',
  'anamnese',
  'befunde',
  'beurteilung',
  'therapie',
];

export const SECTION_LABELS: Record<SectionKey, string> = {
  kopf: 'Kopf',
  diagnosen: 'Diagnosen',
  anamnese: 'Anamnese / Vorgeschichte',
  befunde: 'Befunde / Messwerte',
  beurteilung: 'Zusammenfassende Beurteilung',
  therapie: 'Aktuelle Therapie',
};

export type DocumentStatus = 'entwurf' | 'freigegeben' | 'exportiert';

export interface LetterDocument {
  id: string;
  sessionId?: string;
  createdAt: number;
  updatedAt: number;
  status: DocumentStatus;
  sections: Record<SectionKey, string>;
  /** Previous letter pasted in as context (SPEC feature C). */
  vorbrief?: string;
  /**
   * The model's own draft, kept alongside the edited text. The
   * (source, draft, approved) triple is the only training signal we will ever
   * get for HJ's voice, and it cannot be reconstructed later — so capture it
   * from day one even though nothing consumes it until the learning loop.
   */
  originalDraft?: Record<SectionKey, string>;
  approvedAt?: number;
  exportedAt?: number;
  /**
   * Translations of the Beurteilung, keyed by language code. Stored rather than
   * regenerated so a translation he has already read cannot silently change
   * underneath him on a re-render.
   */
  translations?: Record<string, TranslationRecord>;
}

export interface TranslationRecord {
  text: string;
  /** Structural check at generation time: what failed to copy across verbatim. */
  missingNumbers: string[];
  missingDosing: string[];
  createdAt: number;
  model: string;
}

export type GlossarySource = 'manual' | 'learned';

export interface GlossaryEntry {
  id: string;
  term: string;
  /** Optional canonical spelling, when HJ always writes it a particular way. */
  preferred?: string;
  category: 'medikament' | 'abkuerzung' | 'arzt' | 'sonstiges';
  source: GlossarySource;
  createdAt: number;
}

/** The doctor's real .docx template. Stored as a blob; never committed. */
export interface TemplateRecord {
  id: string;
  name: string;
  blob: Blob;
  createdAt: number;
  isDefault: boolean;
}

/** Key/value settings, including API keys. Single-user, single machine. */
export interface SettingRecord {
  key: string;
  value: unknown;
  updatedAt: number;
}

export type AuditEventType =
  | 'session.started'
  | 'session.ended'
  | 'session.recovered'
  | 'transcript.created'
  | 'draft.generated'
  | 'draft.edited'
  | 'draft.approved'
  | 'draft.translated'
  | 'draft.exported'
  | 'draft.copied'
  | 'audio.deleted'
  | 'data.cleared'
  | 'settings.changed';

/**
 * Append-only audit trail (SPEC constraint 4). Local only.
 * Must never contain patient content — event types and ids only, so the log
 * itself is not a second copy of the record.
 */
export interface AuditEvent {
  id: string;
  at: number;
  type: AuditEventType;
  documentId?: string;
  sessionId?: string;
  /** Short, non-clinical detail: section key, provider id, count. */
  detail?: string;
}

export class ArztbriefDB extends Dexie {
  sessions!: EntityTable<Session, 'id'>;
  segments!: EntityTable<Segment, 'id'>;
  transcripts!: EntityTable<Transcript, 'id'>;
  documents!: EntityTable<LetterDocument, 'id'>;
  glossary!: EntityTable<GlossaryEntry, 'id'>;
  templates!: EntityTable<TemplateRecord, 'id'>;
  settings!: EntityTable<SettingRecord, 'key'>;
  audit!: EntityTable<AuditEvent, 'id'>;

  constructor() {
    super('arztbrief');
    this.version(1).stores({
      sessions: 'id, startedAt, status',
      // [sessionId+index] keeps segment ordering cheap during assembly.
      segments: 'id, sessionId, transcriptionStatus, [sessionId+index]',
      transcripts: 'id, sessionId, segmentId',
      documents: 'id, sessionId, status, updatedAt',
      glossary: 'id, term, category',
      templates: 'id, isDefault',
      settings: 'key',
      audit: 'id, at, type, documentId',
    });
  }
}

export const db = new ArztbriefDB();

function newId(): string {
  return crypto.randomUUID();
}

/** Append an audit entry. Never throws into the caller's path. */
export async function logAudit(
  type: AuditEventType,
  fields: Omit<Partial<AuditEvent>, 'id' | 'at' | 'type'> = {},
): Promise<void> {
  try {
    await db.audit.add({ id: newId(), at: Date.now(), type, ...fields });
  } catch (err) {
    // An audit write must not break recording or drafting.
    console.error('audit write failed', err);
  }
}

export { newId };
