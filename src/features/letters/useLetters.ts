import { useCallback, useEffect, useState } from 'react';

import { db, type DocumentStatus, type LetterDocument, type Session } from '@/lib/db.ts';

/**
 * The list of letters, for layouts that show continuity rather than one screen
 * at a time. A letter is a session plus whatever document came out of it — a
 * session with no document yet is still worth showing, because an unfinished
 * recording is exactly the thing he must not lose track of.
 */

export interface LetterSummary {
  sessionId: string;
  documentId: string | null;
  startedAt: number;
  status: DocumentStatus | 'aufnahme' | 'ohne-entwurf';
  /** First meaningful line of the Beurteilung, used as a title. */
  preview: string;
  segmentCount: number;
}

function previewOf(doc: LetterDocument | undefined): string {
  if (!doc) return '';
  const line = doc.sections.beurteilung
    .split('\n')
    .map((l) => l.replace(/^\s*[-•▪*]\s*/, '').trim())
    .find((l) => l.length > 0);
  return line ? (line.length > 90 ? `${line.slice(0, 90)}…` : line) : '';
}

export function useLetters(): { letters: LetterSummary[]; refresh: () => Promise<void> } {
  const [letters, setLetters] = useState<LetterSummary[]>([]);

  const refresh = useCallback(async () => {
    const [sessions, documents, segments] = await Promise.all([
      db.sessions.toArray(),
      db.documents.toArray(),
      db.segments.toArray(),
    ]);
    const bySession = new Map(documents.map((d) => [d.sessionId, d]));

    const counts = new Map<string, number>();
    for (const s of segments) counts.set(s.sessionId, (counts.get(s.sessionId) ?? 0) + 1);

    setLetters(
      sessions
        .sort((a: Session, b: Session) => b.startedAt - a.startedAt)
        .map<LetterSummary>((session) => {
          const doc = bySession.get(session.id);
          return {
            sessionId: session.id,
            documentId: doc?.id ?? null,
            startedAt: session.startedAt,
            status:
              session.status === 'recording' ? 'aufnahme' : doc ? doc.status : 'ohne-entwurf',
            preview: previewOf(doc),
            segmentCount: counts.get(session.id) ?? 0,
          };
        }),
    );
  }, []);

  useEffect(() => {
    void refresh();
    // Cheap poll: the recorder and the transcription queue both write outside
    // React, and a stale list here would misrepresent what is actually saved.
    const timer = setInterval(() => void refresh(), 3000);
    return () => clearInterval(timer);
  }, [refresh]);

  return { letters, refresh };
}

export const STATUS_LABEL: Record<LetterSummary['status'], string> = {
  aufnahme: 'Aufnahme läuft',
  'ohne-entwurf': 'Kein Entwurf',
  entwurf: 'Entwurf',
  freigegeben: 'Freigegeben',
  exportiert: 'Exportiert',
};
