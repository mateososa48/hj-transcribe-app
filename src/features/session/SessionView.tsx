import { useCallback, useEffect, useState } from 'react';
import { AudioLines, Check, FileText, ListTree, Loader2, RotateCcw, Trash2 } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  db,
  KIND_SECTIONS,
  SESSION_KIND_LABELS,
  type Result,
  type Session,
  type Transcription,
} from '@/lib/db';
import { deleteSession } from '@/lib/generate';
import { pipeline } from '@/lib/transcription/pipeline';
import { speakerOrder } from '@/lib/speakers';
import { usePipelineState } from '@/features/record/useRecording';
import { formatDuration, sessionTitle } from '@/features/sessions/useSessions';
import { useAppStore } from '@/store/app-store';
import { AudioPlayer } from './AudioPlayer';
import { SyncedPlayback } from './SyncedPlayback';
import { SectionCard } from './SectionCard';
import { TranscriptView } from './TranscriptView';

/**
 * One recording, opened. For a Termin this is a document with three faces —
 * Notizen, Transkript, Audio — because the notes are a summary and the
 * transcript is the ground truth; keeping both visible is what lets the notes
 * stay lossy without being dangerous. A Diktat is simpler: the text, then the
 * evidence underneath.
 */
export function SessionView({ sessionId }: { sessionId: string }) {
  const goHome = useAppStore((s) => s.goHome);
  const touchSessions = useAppStore((s) => s.touchSessions);
  const pipelineState = usePipelineState(sessionId);

  const [session, setSession] = useState<Session | null>(null);
  const [transcription, setTranscription] = useState<Transcription | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');

  const load = useCallback(async () => {
    const [s, t, r] = await Promise.all([
      db.sessions.get(sessionId),
      db.transcriptions.where('sessionId').equals(sessionId).first(),
      db.results.where('sessionId').equals(sessionId).first(),
    ]);
    setSession(s ?? null);
    setTranscription(t ?? null);
    setResult(r ?? null);
    if (s) setTitle(sessionTitle(s));
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  // Pick up each pipeline phase's output as it lands.
  useEffect(() => {
    void load();
  }, [pipelineState.phase, load]);

  async function saveTitle() {
    if (!session) return;
    const trimmed = title.trim();
    await db.sessions
      .where('id')
      .equals(session.id)
      .modify((row) => {
        if (trimmed) row.label = trimmed;
        else delete row.label;
      });
    touchSessions();
  }

  if (loading) {
    return (
      <p className="flex items-center gap-3 text-muted-foreground">
        <Spinner /> Wird geladen …
      </p>
    );
  }
  if (!session) {
    return <p className="text-muted-foreground">Diese Aufnahme gibt es nicht mehr.</p>;
  }

  const running = pipelineState.phase === 'transcribing' || pipelineState.phase === 'notes';
  const failed = pipelineState.phase === 'error' || transcription?.status === 'failed';
  const speakerCount = transcription ? speakerOrder(transcription.utterances).length : 0;
  const isTermin = session.kind === 'gespraech';

  return (
    <div className="space-y-8 pb-16">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Badge variant={isTermin ? 'secondary' : 'outline'}>
            {SESSION_KIND_LABELS[session.kind]}
          </Badge>
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  <Trash2 aria-hidden />
                  Löschen
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Aufnahme wirklich löschen?</AlertDialogTitle>
                <AlertDialogDescription>
                  Ton, Transkript und Notizen werden von diesem Computer entfernt. Das lässt sich
                  nicht rückgängig machen.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={async () => {
                    await deleteSession(session.id);
                    touchSessions();
                    toast.success('Aufnahme gelöscht.');
                    goHome();
                  }}
                >
                  Endgültig löschen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Editable title, Notion-style: looks like a heading, edits in place. */}
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => void saveTitle()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          aria-label="Titel der Aufnahme"
          className="h-auto border-transparent px-0 text-2xl font-semibold tracking-tight shadow-none focus-visible:border-border focus-visible:px-2"
        />

        <p className="text-sm text-muted-foreground">
          {new Date(session.startedAt).toLocaleDateString('de-DE', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
          })}
          {session.durationMs ? ` · ${formatDuration(session.durationMs)}` : ''}
          {speakerCount > 1 ? ` · ${speakerCount} Sprecher` : ''}
        </p>
      </div>

      {running ? (
        <div className="space-y-3 rounded-xl border border-border bg-card px-5 py-4">
          <PipelineStep
            done={pipelineState.phase === 'notes'}
            active={pipelineState.phase === 'transcribing'}
            label="Aufnahme wird in Text umgewandelt"
          />
          <PipelineStep
            done={false}
            active={pipelineState.phase === 'notes'}
            label={isTermin ? 'Notizen werden erstellt' : 'Text wird erstellt'}
          />
          <p className="text-sm text-muted-foreground">
            Das dauert je nach Länge der Aufnahme etwa eine Minute. Sie können das Fenster offen
            lassen.
          </p>
        </div>
      ) : failed ? (
        <div className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/10 px-5 py-4">
          <p className="font-medium text-destructive">
            {pipelineState.error ?? transcription?.error ?? 'Die Verarbeitung ist fehlgeschlagen.'}
          </p>
          <Button size="lg" variant="outline" onClick={() => void pipeline.process(session.id)}>
            <RotateCcw aria-hidden />
            Erneut versuchen
          </Button>
        </div>
      ) : null}

      {isTermin ? (
        <Tabs defaultValue="notizen">
          <TabsList>
            <TabsTrigger value="notizen">
              <FileText aria-hidden /> Notizen
            </TabsTrigger>
            <TabsTrigger value="transkript">
              <ListTree aria-hidden /> Transkript
            </TabsTrigger>
            <TabsTrigger value="audio">
              <AudioLines aria-hidden /> Audio
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notizen" className="pt-6">
            {result ? (
              <div className="space-y-8">
                {KIND_SECTIONS.gespraech.map((section) => (
                  <SectionCard
                    key={section}
                    resultId={result.id}
                    section={section}
                    initialText={result.sections[section] ?? ''}
                  />
                ))}
                <Separator />
                <Button
                  variant="ghost"
                  size="lg"
                  disabled={running}
                  onClick={() => void pipeline.process(session.id)}
                >
                  <RotateCcw aria-hidden />
                  Notizen neu erstellen
                </Button>
              </div>
            ) : running ? (
              <p className="text-muted-foreground">Die Notizen erscheinen hier gleich.</p>
            ) : (
              <p className="text-muted-foreground">Noch keine Notizen zu dieser Aufnahme.</p>
            )}
          </TabsContent>

          <TabsContent value="transkript" className="pt-6">
            {transcription?.status === 'done' ? (
              <TranscriptView
                session={session}
                utterances={transcription.utterances}
                text={transcription.text}
                onSessionChanged={() => void load()}
              />
            ) : (
              <p className="text-muted-foreground">
                {running ? 'Das Transkript erscheint hier gleich.' : 'Noch kein Transkript.'}
              </p>
            )}
          </TabsContent>

          <TabsContent value="audio" className="pt-6">
            <AudioPlayer sessionId={session.id} />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-10">
          {result ? (
            <SectionCard
              resultId={result.id}
              section="beurteilung"
              initialText={result.sections.beurteilung ?? ''}
            />
          ) : running ? (
            <p className="text-muted-foreground">Der Text erscheint hier gleich.</p>
          ) : null}

          {result ? (
            <Button
              variant="ghost"
              size="lg"
              disabled={running}
              onClick={() => void pipeline.process(session.id)}
            >
              <RotateCcw aria-hidden />
              Neu erstellen
            </Button>
          ) : null}

          <Separator />
          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">Aufnahme</h2>
            {/* The evidence under the polished text: playback with the spoken
                word highlighted as it plays. A wrong number is far easier to
                hear-and-see here than to spot inside finished prose. */}
            <SyncedPlayback
              sessionId={session.id}
              words={transcription?.words ?? []}
              fallbackText={transcription?.text ?? ''}
            />
          </section>
        </div>
      )}
    </div>
  );
}

function PipelineStep({
  done,
  active,
  label,
}: {
  done: boolean;
  active: boolean;
  label: string;
}) {
  return (
    <p className="flex items-center gap-3 text-base">
      {done ? (
        <Check className="size-5 text-foreground" aria-hidden />
      ) : active ? (
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
      ) : (
        <span className="grid size-5 place-items-center" aria-hidden>
          <span className="size-1.5 rounded-full bg-border" />
        </span>
      )}
      <span className={done || active ? '' : 'text-muted-foreground'}>{label}</span>
    </p>
  );
}
