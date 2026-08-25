import { useCallback, useEffect, useState } from 'react';

import { db, type Result, type Session } from '@/lib/db';
import { useAppStore } from '@/store/app-store';

export interface SessionSummary {
  session: Session;
  /** First real line of the produced text, for the list. */
  preview: string;
  hasResult: boolean;
}

const PREVIEW_LIMIT = 90;

function previewOf(result: Result | undefined): string {
  if (!result) return '';
  for (const text of Object.values(result.sections)) {
    const line = text
      .split('\n')
      .map((l) => l.replace(/^[\s\-–—•]+/, '').trim())
      .find((l) => l.length > 0);
    if (line) return line.length > PREVIEW_LIMIT ? `${line.slice(0, PREVIEW_LIMIT)}…` : line;
  }
  return '';
}

/** Recent recordings, newest first. Re-reads whenever sessions are touched. */
export function useSessions(limit = 50): {
  sessions: SessionSummary[];
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const version = useAppStore((s) => s.sessionsVersion);

  const refresh = useCallback(async () => {
    const rows = await db.sessions.orderBy('startedAt').reverse().limit(limit).toArray();
    const summaries = await Promise.all(
      rows.map(async (session) => {
        const result = await db.results.where('sessionId').equals(session.id).first();
        return { session, preview: previewOf(result), hasResult: Boolean(result) };
      }),
    );
    setSessions(summaries);
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    void refresh();
  }, [refresh, version]);

  return { sessions, loading, refresh };
}

/** Default display title for a session. */
export function sessionTitle(session: Session): string {
  if (session.label?.trim()) return session.label;
  const when = new Date(session.startedAt);
  const day = when.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  const time = when.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${session.kind === 'gespraech' ? 'Termin' : 'Diktat'} ${day}, ${time} Uhr`;
}

/**
 * Title without the kind prefix, for lists already grouped by kind — "Diktat"
 * on every row under a "Diktate" heading is noise.
 */
export function sessionTimeTitle(session: Session): string {
  if (session.label?.trim()) return session.label;
  const when = new Date(session.startedAt);
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const time = when.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (session.startedAt >= midnight.getTime()) return `Heute, ${time} Uhr`;
  if (session.startedAt >= midnight.getTime() - 86_400_000) return `Gestern, ${time} Uhr`;
  const day = when.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  return `${day}, ${time} Uhr`;
}

/** What came out of a recording, one line — shared by every list layout. */
export function sessionSubtitle({ session, preview, hasResult }: SessionSummary): string {
  if (session.status === 'recording') return 'Aufnahme läuft …';
  if (session.kind === 'beurteilung') {
    return hasResult ? 'Zusammenfassende Beurteilung' : 'Noch kein Text';
  }
  return preview || (hasResult ? 'Notizen' : 'Noch keine Notizen');
}

export function formatDuration(ms: number | undefined): string {
  if (!ms || ms <= 0) return '';
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')} min`;
}
