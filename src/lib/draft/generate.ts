import { loadExamples } from '../../../prompts/examples/dev/index.ts';
import {
  db,
  logAudit,
  newId,
  SECTION_ORDER,
  type LetterDocument,
  type SectionKey,
} from '@/lib/db.ts';
import { DRAFT_PROVIDERS, DraftError, type DraftProvider } from '@/lib/providers/index.ts';
import { loadApiKeys, loadSettings } from '@/lib/settings.ts';
import { assembleTranscript } from '@/lib/transcription/queue.ts';

function emptySections(): Record<SectionKey, string> {
  return Object.fromEntries(SECTION_ORDER.map((k) => [k, ''])) as Record<SectionKey, string>;
}

export async function resolveDraftProvider(): Promise<DraftProvider | null> {
  const [settings, keys] = await Promise.all([loadSettings(), loadApiKeys()]);
  const factory = DRAFT_PROVIDERS[settings.llmProviderId];
  const key = keys[settings.llmProviderId];
  if (!factory || !key) return null;
  // The model argument is only consumed by the gateway; direct providers ignore it.
  return factory(key, settings.llmModel);
}

export interface GenerateResult {
  document: LetterDocument;
  /** Whether the few-shot examples were HJ's real letters or synthetic ones. */
  exampleSource: 'real' | 'dev';
  fehlt: string[];
  wellFormed: boolean;
  model: string;
  latencyMs: number;
}

/**
 * Transcript -> Beurteilung draft -> persisted document.
 *
 * Stores BOTH the model's original output and the working copy. Only the
 * working copy is ever edited, so the (source, draft, approved) triple stays
 * intact — that triple is the only signal we will ever have for how HJ's voice
 * differs from the model's, and it cannot be reconstructed after the fact.
 */
export async function generateBeurteilung(
  sessionId: string,
  options: { vorbrief?: string; signal?: AbortSignal } = {},
): Promise<GenerateResult> {
  const provider = await resolveDraftProvider();
  if (!provider) {
    throw new DraftError(
      'anthropic',
      'Für den Textentwurf ist kein Zugangsschlüssel hinterlegt. Bitte in den Einstellungen ergänzen.',
    );
  }

  const transcript = await assembleTranscript(sessionId);
  if (!transcript.trim()) {
    throw new DraftError(
      provider.id,
      'Es liegt noch kein erkannter Text vor. Bitte warten Sie, bis die Übertragung abgeschlossen ist.',
    );
  }

  const [{ examples, source }, glossaryRows] = await Promise.all([
    loadExamples(),
    db.glossary.toArray(),
  ]);

  const response = await provider.draftBeurteilung({
    transcript,
    glossary: glossaryRows.map((g) => g.preferred ?? g.term),
    examples,
    ...(options.vorbrief ? { vorbrief: options.vorbrief } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  });

  const now = Date.now();
  const sections = emptySections();
  sections.beurteilung = response.text;

  const existing = await db.documents.where('sessionId').equals(sessionId).first();
  const document: LetterDocument = existing
    ? {
        ...existing,
        sections: { ...existing.sections, beurteilung: response.text },
        originalDraft: { ...(existing.originalDraft ?? emptySections()), beurteilung: response.text },
        updatedAt: now,
        status: 'entwurf',
        ...(options.vorbrief ? { vorbrief: options.vorbrief } : {}),
      }
    : {
        id: newId(),
        sessionId,
        createdAt: now,
        updatedAt: now,
        status: 'entwurf',
        sections,
        originalDraft: { ...sections },
        ...(options.vorbrief ? { vorbrief: options.vorbrief } : {}),
      };

  await db.documents.put(document);
  await db.sessions.update(sessionId, { documentId: document.id });
  await logAudit('draft.generated', {
    sessionId,
    documentId: document.id,
    detail: `${provider.id}/${response.model} v${response.promptVersion} ex:${source}`,
  });

  return {
    document,
    exampleSource: source,
    fehlt: response.fehlt,
    wellFormed: response.wellFormed,
    model: response.model,
    latencyMs: response.latencyMs,
  };
}

export async function saveSection(
  documentId: string,
  section: SectionKey,
  text: string,
): Promise<void> {
  const doc = await db.documents.get(documentId);
  if (!doc) return;
  if (doc.sections[section] === text) return;
  await db.documents.update(documentId, {
    sections: { ...doc.sections, [section]: text },
    updatedAt: Date.now(),
  });
  await logAudit('draft.edited', { documentId, detail: section });
}

/**
 * Freigeben. Nothing may be copied or exported before this (SPEC constraint 4),
 * so this is the gate the whole review model hangs on.
 */
export async function approveDocument(documentId: string): Promise<void> {
  await db.documents.update(documentId, {
    status: 'freigegeben',
    approvedAt: Date.now(),
    updatedAt: Date.now(),
  });
  await logAudit('draft.approved', { documentId });
}

/** Audio is dropped here when retention is set to delete on approval. */
export async function applyApprovalRetention(documentId: string): Promise<number> {
  const [{ audioRetention }, doc] = await Promise.all([loadSettings(), db.documents.get(documentId)]);
  if (audioRetention !== 'afterApproval' || !doc?.sessionId) return 0;

  const segments = await db.segments.where('sessionId').equals(doc.sessionId).toArray();
  let cleared = 0;
  for (const segment of segments) {
    if (!segment.blob) continue;
    await db.segments.where('id').equals(segment.id).modify((s) => {
      delete s.blob;
      s.audioDeletedAt = Date.now();
    });
    cleared++;
  }
  if (cleared > 0) {
    await logAudit('audio.deleted', {
      documentId,
      detail: `nach Freigabe (${cleared})`,
    });
  }
  return cleared;
}
