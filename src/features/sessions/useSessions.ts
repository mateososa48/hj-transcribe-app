import { useCallback, useEffect, useState } from 'react';

import { db, type DocumentRecord, type Result, type Session } from '@/lib/db';
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
    const rows = await db.sessions
      .orderBy('startedAt')
      .reverse()
      // Ergänzungen (parentId set) live on their parent's page, not in lists.
      .filter((s) => !s.parentId)
      .limit(limit)
      .toArray();
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
  return relativeDayTime(session.startedAt);
}

/** "Heute, 14:05 Uhr" / "Gestern, …" / "27.08., …" — shared list-row time. */
export function relativeDayTime(ts: number): string {
  const when = new Date(ts);
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const time = when.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (ts >= midnight.getTime()) return `Heute, ${time} Uhr`;
  if (ts >= midnight.getTime() - 86_400_000) return `Gestern, ${time} Uhr`;
  const day = when.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  return `${day}, ${time} Uhr`;
}

/**
 * One compact stamp for every row: "Heute · 14:05", "Gestern · 22:54",
 * "25.08. · 16:31". No "Uhr", no "Bearbeitet" — a 24-hour clock has already
 * said the first, and in a 177px column the second cost more room than it
 * carried. Both were being truncated away anyway.
 */
export function compactDayTime(ts: number): string {
  const when = new Date(ts);
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const time = when.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (ts >= midnight.getTime()) return `Heute · ${time}`;
  if (ts >= midnight.getTime() - 86_400_000) return `Gestern · ${time}`;
  const day = when.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  return `${day} · ${time}`;
}

/**
 * What a row is CALLED.
 *
 * Seven rows reading "Zusammenfassende Beurteilung" under seven timestamps
 * are seven rows he cannot tell apart, and the one he opens by mistake is a
 * patient's letter. So the row leads with the recording's own first line, and
 * names its state only when there is no line yet.
 */
export function sessionRowTitle({ session, preview, hasResult }: SessionSummary): string {
  if (session.label?.trim()) return session.label;
  if (session.status === 'recording') return 'Aufnahme läuft';
  if (preview) return preview;
  if (!hasResult) return 'Noch kein Text';
  return session.kind === 'beurteilung' ? 'Zusammenfassende Beurteilung' : 'Notizen';
}

/** The Berichte, newest edit first. Re-reads on the same library signal. */
export function useDocuments(): { documents: DocumentRecord[]; loading: boolean } {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const version = useAppStore((s) => s.sessionsVersion);

  useEffect(() => {
    let cancelled = false;
    void db.documents
      .orderBy('updatedAt')
      .reverse()
      .toArray()
      .then((rows) => {
        if (cancelled) return;
        setDocuments(rows);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  return { documents, loading };
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
