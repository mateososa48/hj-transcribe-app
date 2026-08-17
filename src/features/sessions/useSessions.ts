import { useCallback, useEffect, useState } from 'react';

import { db, type Result, type Session } from '@/lib/db';

export interface SessionSummary {
  session: Session;
  /** First line or so of the produced text, for the list. */
  preview: string;
  hasResult: boolean;
  segmentCount: number;
}

const PREVIEW_LIMIT = 130;

function previewOf(result: Result | undefined): string {
  if (!result) return '';
  for (const text of Object.values(result.sections)) {
    const line = text
      .replace(/\[FEHLT:[^\]]*\]/gi, '')
      .split('\n')
      .map((l) => l.replace(/^[\s\-–—•]+/, '').trim())
      .find((l) => l.length > 0);
    if (line) return line.length > PREVIEW_LIMIT ? `${line.slice(0, PREVIEW_LIMIT)}…` : line;
  }
  return '';
}

/**
 * Recent recordings, newest first.
 *
 * Re-read on demand rather than through a live query: the list changes only
 * when he records, deletes or generates, and those are all moments the caller
 * already knows about.
 */
export function useSessions(limit = 20): {
  sessions: SessionSummary[];
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const rows = await db.sessions.orderBy('startedAt').reverse().limit(limit).toArray();
    const summaries = await Promise.all(
      rows.map(async (session) => {
        const [result, segmentCount] = await Promise.all([
          db.results.where('sessionId').equals(session.id).first(),
          db.segments.where('sessionId').equals(session.id).count(),
        ]);
        return {
          session,
          preview: previewOf(result),
          hasResult: Boolean(result),
          segmentCount,
        };
      }),
    );
    setSessions(summaries);
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { sessions, loading, refresh };
}

/** Human date for the list: today and yesterday get named, older gets a date. */
export function formatWhen(ts: number): string {
  const then = new Date(ts);
  const time = then.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const dayMs = 86_400_000;

  if (ts >= midnight.getTime()) return `Heute, ${time} Uhr`;
  if (ts >= midnight.getTime() - dayMs) return `Gestern, ${time} Uhr`;
  return then.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
