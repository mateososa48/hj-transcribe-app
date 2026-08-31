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
 * `gespraech` records an appointment and turns it into a speaker-separated
 * transcript plus sectioned notes — a meeting-notes app for the consulting
 * room. `beurteilung` is dictation: he talks, it returns finished text.
 */
export type SessionKind = 'gespraech' | 'beurteilung';

export const SESSION_KIND_LABELS: Record<SessionKind, string> = {
  gespraech: 'Termin',
  beurteilung: 'Diktat',
};

/** The sections each kind produces, in the order they appear on screen. */
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
  /** Editable title, Notion-style. Defaults to kind + time; never required. */
  label?: string;
  /**
   * Set on an Ergänzung — an additional dictation recorded INTO an existing
   * Diktat. Child sessions never appear in lists; their audio and transcript
   * hang off the parent's page. No index needed: the table is small and
   * children are found by filtering.
   */
  parentId?: string;
  /**
   * For a dictation INTO a Bericht: the section of the letter it went to, by
   * his own name for it ("Befunde"). The destination is decided in the editor
   * — chosen before he speaks, or announced while he speaks — and nothing else
   * remembers it afterwards, so the widget beside the letter could not say
   * what a recording was for without this. Optional: rows written before this
   * existed, and Ergänzungen, have none.
   */
  targetSection?: string;
  /** Total recorded audio, from the recorder's own clock. */
  durationMs?: number;
  /** MIME type of the stored audio chunks. */
  mimeType?: string;
  /**
   * Display names for diarized speakers, keyed by the provider's label
   * ("A", "B", …). Unset speakers render as "Sprecher 1/2/…".
   */
  speakerNames?: Record<string, string>;
  resultId?: string;
}

/**
 * One timeslice chunk of the continuous recording, written the moment the
 * recorder hands it over — before any network call (SPEC constraint 6: a
 * recording must be unlosable).
 *
 * Chunks from a single MediaRecorder session are NOT independently playable —
 * only the first carries the container header — but concatenated in order they
 * form one valid file. That property is what this whole table is built on: it
 * gives crash-safety (whatever chunks exist replay as a valid prefix) AND one
 * seekable file for playback and diarization, where the old segment-rotation
 * design gave neither.
 */
export interface AudioChunk {
  id: string;
  sessionId: string;
  /** Monotonic within a session; concatenation order. */
  index: number;
  blob: Blob;
  createdAt: number;
}

export type TranscriptionStatus = 'uploading' | 'processing' | 'done' | 'failed';

/** One recognised word with its position in the recording, for playback sync. */
export interface TimedWord {
  text: string;
  startMs: number;
  endMs: number;
}

/** One diarized utterance: who said what, when (ms from recording start). */
export interface Utterance {
  /** Provider speaker label: "A", "B", … Absent for dictations. */
  speaker?: string;
  text: string;
  startMs: number;
  endMs: number;
}

/** The transcript of one session — one row per session, whole-file. */
export interface Transcription {
  id: string;
  sessionId: string;
  status: TranscriptionStatus;
  providerId: string;
  /** Full text, dosing-repaired. */
  text: string;
  /** Speaker-separated, in time order. Empty for dictations. */
  utterances: Utterance[];
  /**
   * Word-level timings, verbatim as recognised (NOT dosing-repaired — repairs
   * would break the audio alignment). Drives the follow-along highlight during
   * playback. Absent on rows recorded before 2026-08-25.
   */
  words?: TimedWord[];
  error?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * What came out of one recording: text he can read, correct and copy.
 *
 * `sections` is the working copy he edits; `original` is what the model
 * actually returned — the only signal we will ever have for how his voice
 * differs from the model's, unreconstructable once edited over.
 */
export interface Result {
  id: string;
  sessionId: string;
  kind: SessionKind;
  createdAt: number;
  updatedAt: number;
  sections: Record<string, string>;
  /**
   * What a dictation turned out to BE, in the model's judgement — nearly
   * always "Zusammenfassende Beurteilung", but a note or a single finding is
   * not one, and the heading ends up in his letter. Absent on Termine and on
   * rows written before this existed.
   */
  heading?: string;
  /**
   * A Termin's sections are the conversation's own, not a fixed four, so the
   * result carries its own reading order and its own headings. Absent on
   * dictations and on rows drafted before that — those fall back to
   * KIND_SECTIONS.
   */
  sectionOrder?: string[];
  sectionLabels?: Record<string, string>;
  original: Record<string, string>;
  /**
   * The working copy that a regenerate replaced — his corrections may live in
   * it, so one click must be able to bring it back. Cleared on restore; only
   * one level deep.
   */
  previousSections?: Record<string, string>;
  model: string;
  promptVersion: string;
  wellFormed: boolean;
}

/** Key/value settings. Single-user, single machine. */
export interface SettingRecord {
  key: string;
  value: unknown;
  updatedAt: number;
}

/**
 * A Bericht: the Word-like document he assembles from typing, dictation and
 * imported sections. Content is the editor's own JSON — the document IS the
 * working copy; there is no original/derived split like Result has, because
 * here he is the author and the AI only ever inserts.
 */
export interface DocumentRecord {
  id: string;
  title: string;
  /** TipTap JSON document. */
  content: unknown;
  /** Snapshot taken before the last programmatic insert (dictation/import). */
  previousContent?: unknown;
  createdAt: number;
  updatedAt: number;
}

export class ArztbriefDB extends Dexie {
  sessions!: EntityTable<Session, 'id'>;
  chunks!: EntityTable<AudioChunk, 'id'>;
  transcriptions!: EntityTable<Transcription, 'id'>;
  results!: EntityTable<Result, 'id'>;
  settings!: EntityTable<SettingRecord, 'key'>;
  documents!: EntityTable<DocumentRecord, 'id'>;

  constructor() {
    super('arztbrief');

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

    this.version(2).stores({
      sessions: 'id, kind, startedAt, status',
      segments: 'id, sessionId, transcriptionStatus, [sessionId+index]',
      transcripts: 'id, sessionId, segmentId',
      results: 'id, sessionId, kind, updatedAt',
      settings: 'key',
      documents: null,
      glossary: null,
      templates: null,
      audit: null,
    });

    // v3: the segment-rotation design is replaced by one continuous recording
    // persisted as ordered chunks, plus one whole-file diarized transcription
    // per session. Old segments/transcripts are dropped — their audio format
    // cannot be stitched into the new pipeline, and everything recorded so far
    // is test data. Sessions and generated results carry across.
    this.version(3)
      .stores({
        sessions: 'id, kind, startedAt, status',
        chunks: 'id, sessionId, [sessionId+index]',
        transcriptions: 'id, sessionId',
        results: 'id, sessionId, kind, updatedAt',
        settings: 'key',
        segments: null,
        transcripts: null,
      })
      .upgrade(async (tx) => {
        await tx
          .table('sessions')
          .toCollection()
          .modify((s: Partial<Session>) => {
            s.kind ??= 'beurteilung';
          });
      });

    // v4: Berichte — the Word-like documents. NOTE: v1 had an unrelated
    // `documents` table that v2 deleted; reusing the name here creates a
    // fresh table, not a resurrection of the old rows.
    this.version(4).stores({
      sessions: 'id, kind, startedAt, status',
      chunks: 'id, sessionId, [sessionId+index]',
      transcriptions: 'id, sessionId',
      results: 'id, sessionId, kind, updatedAt',
      settings: 'key',
      documents: 'id, updatedAt, createdAt',
    });
  }
}

export const db = new ArztbriefDB();

export function newId(): string {
  return crypto.randomUUID();
}

/** All chunks of a session, concatenated into one playable/uploadable file. */
export async function assembleAudio(sessionId: string): Promise<Blob | null> {
  const [session, chunks] = await Promise.all([
    db.sessions.get(sessionId),
    db.chunks.where('[sessionId+index]').between([sessionId, 0], [sessionId, Infinity]).toArray(),
  ]);
  if (chunks.length === 0) return null;
  chunks.sort((a, b) => a.index - b.index);
  return new Blob(
    chunks.map((c) => c.blob),
    { type: session?.mimeType || 'audio/webm' },
  );
}
