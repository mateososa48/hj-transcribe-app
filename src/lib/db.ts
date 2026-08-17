import Dexie, { type EntityTable } from 'dexie';

import { GESPRAECH_SECTIONS, GESPRAECH_SECTION_LABELS } from '../../prompts/gespraech.ts';

/**
 * All persistence for the app. IndexedDB only — there is no server, by design
 * (SPEC constraint 1). Everything here lives on HJ's machine.
 *
 * Nothing in this file may be transmitted anywhere except to the configured
 * AI endpoints, and only the fields those endpoints need.
 */

/**
 * The two things the app does.
 *
 * `gespraech` records the consultation and produces the sections he currently
 * types off a paper note. `beurteilung` replaces the dictation machine for the
 * summary. Everything downstream of the microphone is shared; only the prompt
 * and the shape of the result differ.
 */
export type SessionKind = 'gespraech' | 'beurteilung';

export const SESSION_KIND_LABELS: Record<SessionKind, string> = {
  gespraech: 'Gespräch',
  beurteilung: 'Beurteilung',
};

/** The sections each kind produces, in the order they appear in his letter. */
export const KIND_SECTIONS: Record<SessionKind, readonly string[]> = {
  gespraech: GESPRAECH_SECTIONS,
  beurteilung: ['beurteilung'],
};

export const SECTION_LABELS: Record<string, string> = {
  ...GESPRAECH_SECTION_LABELS,
  beurteilung: 'Zusammenfassende Beurteilung',
};

export type SessionStatus = 'recording' | 'stopped' | 'abandoned';

/** One recording sitting. Survives a crash so it can be offered for recovery. */
export interface Session {
  id: string;
  kind: SessionKind;
  startedAt: number;
  endedAt?: number;
  status: SessionStatus;
  /**
   * A local scratch label so HJ can tell recordings apart in the list
   * ("Gespräch, 14:32"). NOT the patient name — no patient identity is ever
   * captured incidentally from audio.
   */
  label?: string;
  resultId?: string;
}

export type TranscriptionStatus = 'pending' | 'running' | 'done' | 'failed';

/**
 * One rotated recorder segment: a self-contained, independently playable file.
 * Written the moment it exists, before any network call — SPEC constraint 6
 * ("a recording must be unlosable"). A 30-minute consultation is a lot to lose.
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
  /** Set when the audio blob is dropped after he deletes the recording. */
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

/**
 * What came out of one recording: text he can read, correct and copy.
 *
 * `sections` is the working copy he edits; `original` is what the model
 * actually returned. Keeping both costs nothing and is the only signal we will
 * ever have for how his voice differs from the model's — it cannot be
 * reconstructed after he has edited over it.
 */
export interface Result {
  id: string;
  sessionId: string;
  kind: SessionKind;
  createdAt: number;
  updatedAt: number;
  sections: Record<string, string>;
  original: Record<string, string>;
  model: string;
  promptVersion: string;
  wellFormed: boolean;
  /** Previous letter he pasted in, used for carrying diagnoses forward. */
  vorbrief?: string;
}

/** Key/value settings. Single-user, single machine. */
export interface SettingRecord {
  key: string;
  value: unknown;
  updatedAt: number;
}

export class ArztbriefDB extends Dexie {
  sessions!: EntityTable<Session, 'id'>;
  segments!: EntityTable<Segment, 'id'>;
  transcripts!: EntityTable<Transcript, 'id'>;
  results!: EntityTable<Result, 'id'>;
  settings!: EntityTable<SettingRecord, 'key'>;

  constructor() {
    super('arztbrief');

    // v1 modelled a whole six-section letter with an approval state machine.
    // The app no longer owns the letter — he does, in Word — so v2 drops the
    // document, glossary, template and audit stores and replaces them with a
    // flat result per recording. Recordings and their audio carry across
    // untouched; that is the data worth keeping.
    this.version(1).stores({
      sessions: 'id, startedAt, status',
      segments: 'id, sessionId, transcriptionStatus, [sessionId+index]',
      transcripts: 'id, sessionId, segmentId',
      documents: 'id, sessionId, status, updatedAt',
      glossary: 'id, term, category',
      templates: 'id, isDefault',
      settings: 'key',
      audit: 'id, at, type, documentId',
    });

    this.version(2)
      .stores({
        sessions: 'id, kind, startedAt, status',
        segments: 'id, sessionId, transcriptionStatus, [sessionId+index]',
        transcripts: 'id, sessionId, segmentId',
        results: 'id, sessionId, kind, updatedAt',
        settings: 'key',
        documents: null,
        glossary: null,
        templates: null,
        audit: null,
      })
      .upgrade(async (tx) => {
        // Sessions predate `kind`; everything recorded before this release was
        // a dictated summary.
        await tx
          .table('sessions')
          .toCollection()
          .modify((s: Partial<Session>) => {
            s.kind ??= 'beurteilung';
          });
      });
  }
}

export const db = new ArztbriefDB();

export function newId(): string {
  return crypto.randomUUID();
}
