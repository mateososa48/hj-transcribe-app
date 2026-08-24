import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, FileText, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { extractFehltMarkers } from '../../../prompts/beurteilung.ts';
import { db, KIND_SECTIONS, SESSION_KIND_LABELS, type Result, type SessionKind } from '@/lib/db';
import { DraftError } from '@/lib/providers';
import { deleteSession, generate } from '@/lib/generate';
import { assembleTranscript } from '@/lib/transcription/queue';
import { useQueueState } from '@/features/record/useRecording';
import { SectionCard } from './SectionCard';

/**
 * What came out of one recording.
 *
 * Three states, in the order he meets them: the recording is still being
 * transcribed; the text is ready to be written; the text exists and he is
 * reading it.
 */
export function ResultScreen({
  sessionId,
  kind,
  onBack,
}: {
  sessionId: string | null;
  kind: SessionKind;
  onBack: () => void;
}) {
  const [result, setResult] = useState<Result | null>(null);
  const [transcript, setTranscript] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [vorbrief, setVorbrief] = useState('');
  const [showVorbrief, setShowVorbrief] = useState(false);
  /**
   * Segments of THIS recording that are not transcribed yet.
   *
   * Deliberately read from the segment rows rather than the queue's counters:
   * the counters are refreshed on a tick, so a segment written a moment ago can
   * be invisible to them. That window let the button enable while the tail of a
   * recording was still pending, and the draft was then built from half a
   * dictation — which is exactly what happened on 2026-08-23.
   */
  const [outstanding, setOutstanding] = useState<number | null>(null);
  const queue = useQueueState();

  const load = useCallback(async () => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    const [existing, text, segments] = await Promise.all([
      db.results.where('sessionId').equals(sessionId).first(),
      assembleTranscript(sessionId),
      db.segments.where('sessionId').equals(sessionId).toArray(),
    ]);
    setResult(existing ?? null);
    setTranscript(text);
    setOutstanding(segments.filter((seg) => seg.transcriptionStatus !== 'done').length);
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Once the queue drains, the transcript is complete — pick it up without
  // making him press anything.
  useEffect(() => {
    if (queue.pending === 0 && queue.running === 0) void load();
  }, [queue.pending, queue.running, load]);

  // The queue can be idle while a segment is still marked pending (it retries on
  // a backoff). Poll until this recording is genuinely complete.
  useEffect(() => {
    if ((outstanding ?? 0) === 0) return;
    const timer = setInterval(() => void load(), 1500);
    return () => clearInterval(timer);
  }, [outstanding, load]);

  async function handleGenerate() {
    if (!sessionId) return;
    setBusy(true);
    try {
      const out = await generate(sessionId, kind, vorbrief.trim() ? { vorbrief } : {});
      setResult(out.result);
      if (!out.wellFormed) {
        toast.warning('Das Ergebnis war unvollständig formatiert. Bitte prüfen Sie den Text genau.');
      }
      if (out.exampleSource === 'dev') {
        toast.info('Hinweis: Es liegen noch keine echten Musterbriefe vor — der Stil ist noch nicht Ihrer.');
      }
      toast.success(`Text erstellt (${Math.round(out.latencyMs / 100) / 10} s).`);
    } catch (error) {
      toast.error(
        error instanceof DraftError ? error.message : 'Der Text konnte nicht erstellt werden.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-3 text-muted-foreground">
        <Spinner /> Wird geladen …
      </p>
    );
  }

  // Either signal saying "not finished" is enough to hold the button.
  const waiting = queue.pending > 0 || queue.running > 0 || (outstanding ?? 0) > 0;
  const sections = KIND_SECTIONS[kind];
  const allMarkers = result
    ? extractFehltMarkers(Object.values(result.sections).join('\n'))
    : [];

  return (
    <div className="space-y-8 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="lg" onClick={onBack}>
          <ArrowLeft aria-hidden />
          Zurück
        </Button>
        {sessionId ? (
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button variant="ghost" size="lg" className="text-muted-foreground">
                  <Trash2 aria-hidden />
                  Aufnahme löschen
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Aufnahme wirklich löschen?</AlertDialogTitle>
                <AlertDialogDescription>
                  Die Tonaufnahme, der erkannte Text und der erstellte Brieftext werden von diesem
                  Computer entfernt. Das lässt sich nicht rückgängig machen.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={async () => {
                    await deleteSession(sessionId);
                    toast.success('Aufnahme gelöscht.');
                    onBack();
                  }}
                >
                  Endgültig löschen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>

      <div className="space-y-2">
        <Badge variant="secondary">{SESSION_KIND_LABELS[kind]}</Badge>
        <h1 className="text-2xl font-semibold tracking-tight">
          {result ? 'Für Ihren Brief' : 'Text erstellen'}
        </h1>
        <p className="max-w-[68ch] text-muted-foreground">
          {result
            ? 'Bitte lesen und korrigieren Sie den Text. Mit „Kopieren“ fügen Sie ihn an der passenden Stelle in Ihr Word-Dokument ein.'
            : 'Aus der Aufnahme wird jetzt der Text für Ihren Brief erstellt.'}
        </p>
      </div>

      {waiting ? (
        <div className="flex items-center gap-3 rounded-lg bg-muted px-4 py-3">
          <Spinner />
          <p className="text-base">
            Die Aufnahme wird noch in Text umgewandelt (
            {Math.max(queue.pending + queue.running, outstanding ?? 0)} offen). Bitte warten Sie
            — sonst entsteht der Text nur aus dem ersten Teil.
          </p>
        </div>
      ) : null}

      {allMarkers.length > 0 ? (
        <div className="space-y-2 rounded-lg bg-muted px-4 py-3">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="size-5" aria-hidden />
            {allMarkers.length} offene Stelle{allMarkers.length === 1 ? '' : 'n'}
          </p>
          <ul className="ml-7 list-disc space-y-1 text-base">
            {allMarkers.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            Diese Angaben standen nicht in der Aufnahme. Bitte ergänzen Sie sie oder entfernen Sie
            die Markierung, bevor Sie den Text übernehmen.
          </p>
        </div>
      ) : null}

      {result ? (
        <div className="space-y-8">
          {sections.map((section) => (
            <SectionCard
              key={section}
              resultId={result.id}
              section={section}
              initialText={result.sections[section] ?? ''}
            />
          ))}

          <Separator />
          <Button variant="ghost" size="lg" disabled={busy} onClick={() => void handleGenerate()}>
            {busy ? <Spinner /> : <RefreshCw aria-hidden />}
            Neu erstellen
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {kind === 'gespraech' ? (
            <div className="space-y-2">
              {showVorbrief ? (
                <>
                  <label htmlFor="vorbrief" className="text-sm font-medium">
                    Vorheriger Brief dieses Patienten
                  </label>
                  <Textarea
                    id="vorbrief"
                    value={vorbrief}
                    onChange={(e) => setVorbrief(e.target.value)}
                    placeholder="Text aus dem letzten Brief hier einfügen …"
                    className="min-h-32 text-base"
                  />
                  <p className="max-w-[68ch] text-sm text-muted-foreground">
                    Die dortigen Diagnosen werden übernommen und um das ergänzt, was im Gespräch neu
                    dazugekommen ist.
                  </p>
                </>
              ) : (
                <Button variant="ghost" size="lg" onClick={() => setShowVorbrief(true)}>
                  <FileText aria-hidden />
                  Vorherigen Brief einfügen (optional)
                </Button>
              )}
            </div>
          ) : null}

          <Button
            size="lg"
            className="h-14 px-10 text-lg"
            disabled={busy || waiting || !transcript.trim()}
            onClick={() => void handleGenerate()}
          >
            {busy ? <Spinner /> : <Sparkles aria-hidden />}
            Text erstellen
          </Button>

          {transcript ? (
            <div className="space-y-3">
              <Separator />
              <h2 className="text-lg font-semibold">Erkannter Text</h2>
              {/* Shown so he can sanity-check the recognition before text is
                  built on top of it — a bad transcript is far easier to spot
                  here than inside finished prose. */}
              <p className="max-w-[80ch] whitespace-pre-wrap text-base leading-relaxed text-muted-foreground">
                {transcript}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
