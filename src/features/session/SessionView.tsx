import { useCallback, useEffect, useRef, useState } from 'react';
import { FilePlus2, FileText, ListTree, RotateCcw, Trash2 } from 'lucide-react';
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
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
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
import { recoverSession } from '@/lib/session/recording-session';
import { pipeline } from '@/lib/transcription/pipeline';
import { speakerOrder } from '@/lib/speakers';
import { usePipelineState, useRecordingState } from '@/features/record/useRecording';
import { formatDuration, sessionTitle } from '@/features/sessions/useSessions';
import { useAppStore } from '@/store/app-store';
import { DiktatContent } from './DiktatContent';
import { ProcessingHandoff } from './ProcessingHandoff';
import { RegenerateControls } from './RegenerateControls';
import { getProcessingPreviewPhase } from './processing-handoff-model';
import { SectionCard } from './SectionCard';
import { TranscriptView } from './TranscriptView';

/**
 * One recording, opened. For a Termin this is a document with two faces —
 * Notizen and Transkript — because the notes are a summary and the transcript
 * is the ground truth; keeping both visible is what lets the notes stay lossy
 * without being dangerous. The recording is docked inside the transcript,
 * where hearing and reading belong together. A Diktat is simpler: the text,
 * then the evidence underneath.
 */
export function SessionView({ sessionId }: { sessionId: string }) {
  const goHome = useAppStore((s) => s.goHome);
  const startRecording = useAppStore((s) => s.startRecording);
  const touchSessions = useAppStore((s) => s.touchSessions);
  const pipelineState = usePipelineState(sessionId);
  const recording = useRecordingState();

  const [session, setSession] = useState<Session | null>(null);
  const [transcription, setTranscription] = useState<Transcription | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const autoResumedFor = useRef<string | null>(null);

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

  const running = pipelineState.phase === 'transcribing' || pipelineState.phase === 'notes';
  const failed = pipelineState.phase === 'error' || transcription?.status === 'failed';

  /**
   * Resume an interrupted pipeline. The pipeline lives in memory, so a closed
   * tab between transcript and notes used to leave a finished transcript with
   * no notes and no way to ask for them — the missing step now runs itself the
   * moment the session is opened.
   */
  useEffect(() => {
    if (loading || !session || result || running || failed) return;
    if (session.status !== 'stopped') return;
    if (transcription?.status !== 'done' || !transcription.text.trim()) return;
    if (autoResumedFor.current === sessionId) return;
    autoResumedFor.current = sessionId;
    void pipeline.process(sessionId);
  }, [loading, session, transcription, result, running, failed, sessionId]);

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

  const previewPhase = getProcessingPreviewPhase(window.location.search, import.meta.env.DEV);
  const activePhase =
    previewPhase ??
    (pipelineState.phase === 'transcribing' || pipelineState.phase === 'notes'
      ? pipelineState.phase
      : null);
  const showRunning = activePhase !== null;
  const showFailed = !previewPhase && failed;
  const speakerCount = transcription ? speakerOrder(transcription.utterances).length : 0;
  const isTermin = session.kind === 'gespraech';
  // A session still marked "recording" is either the one running right now or
  // one that a crash left behind — two very different pages.
  const isLive =
    session.status === 'recording' &&
    recording.sessionId === session.id &&
    (recording.status === 'recording' ||
      recording.status === 'requesting-mic' ||
      recording.status === 'stopping');
  const interrupted = session.status === 'recording' && !isLive;
  const canGenerate =
    !showRunning && transcription?.status === 'done' && Boolean(transcription.text.trim());

  async function recoverNow() {
    if (!session) return;
    await recoverSession(session.id);
    touchSessions();
    await load();
    void pipeline.process(session.id);
  }

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
                <Button variant="ghost" className="text-muted-foreground" disabled={isLive}>
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

        {/* Editable title, Notion-style: looks like a heading, edits in place.
            The explicit md:text-2xl matters — the input base carries md:text-sm,
            which would otherwise shrink the title back to body size on desktop. */}
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => void saveTitle()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          aria-label="Titel der Aufnahme"
          className="h-auto border-transparent px-0 text-2xl font-semibold tracking-tight shadow-none focus-visible:border-border focus-visible:px-2 md:text-2xl"
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

      {isLive ? (
        <Item variant="outline">
          <ItemContent>
            <ItemTitle>Diese Aufnahme läuft gerade</ItemTitle>
            <ItemDescription>
              Transkript und Notizen entstehen, sobald Sie die Aufnahme beenden.
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button size="lg" onClick={() => startRecording(session.kind)}>
              Zur Aufnahme
            </Button>
          </ItemActions>
        </Item>
      ) : interrupted ? (
        /* The same offer the start screen makes — reachable from the sidebar
           too, so the newest list entry never reads as a lost recording. */
        <Item variant="outline">
          <ItemContent>
            <ItemTitle>Unterbrochene Aufnahme gefunden</ItemTitle>
            <ItemDescription>
              Diese Aufnahme wurde nicht ordentlich beendet. Der Ton ist gespeichert und kann
              weiterverwendet werden.
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button variant="outline" size="lg">
                    Verwerfen
                  </Button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Aufnahme wirklich verwerfen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Der gespeicherte Ton dieser Aufnahme wird endgültig gelöscht. Das lässt sich
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
                      toast.success('Aufnahme verworfen.');
                      goHome();
                    }}
                  >
                    Endgültig verwerfen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button size="lg" onClick={() => void recoverNow()}>
              Weiterverwenden
            </Button>
          </ItemActions>
        </Item>
      ) : (
        <>
          {isTermin && activePhase ? (
            <ProcessingHandoff
              kind={session.kind}
              phase={activePhase}
              sessionId={session.id}
              audioDurationMs={session.durationMs}
            />
          ) : isTermin && showFailed ? (
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
            (() => {
              const notesBlock = result ? (
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
                  <RegenerateControls
                    session={session}
                    result={result}
                    running={showRunning}
                    onChanged={() => void load()}
                  />
                </div>
              ) : showRunning ? (
                <p className="text-muted-foreground">Die Notizen erscheinen hier gleich.</p>
              ) : canGenerate ? (
                <div className="space-y-4">
                  <p className="max-w-[56ch] text-muted-foreground">
                    Das Transkript ist fertig, die Notizen wurden noch nicht erstellt.
                  </p>
                  <Button size="lg" onClick={() => void pipeline.process(session.id)}>
                    <FilePlus2 aria-hidden />
                    Notizen erstellen
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground">Noch keine Notizen zu dieser Aufnahme.</p>
              );

              const transcriptBlock =
                transcription?.status === 'done' ? (
                  <TranscriptView
                    session={session}
                    utterances={transcription.utterances}
                    text={transcription.text}
                    onSessionChanged={() => void load()}
                  />
                ) : (
                  <p className="text-muted-foreground">
                    {showRunning ? 'Das Transkript erscheint hier gleich.' : 'Noch kein Transkript.'}
                  </p>
                );

              return (
                <Tabs defaultValue="notizen">
                  <TabsList className="group-data-horizontal/tabs:h-11">
                    <TabsTrigger value="notizen" className="px-3 text-base">
                      <FileText aria-hidden /> Notizen
                    </TabsTrigger>
                    <TabsTrigger value="transkript" className="px-3 text-base">
                      <ListTree aria-hidden /> Transkript
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="notizen" className="pt-6 text-base">
                    {notesBlock}
                  </TabsContent>
                  <TabsContent value="transkript" className="pt-6 text-base">
                    {transcriptBlock}
                  </TabsContent>
                </Tabs>
              );
            })()
          ) : (
            <DiktatContent
              session={session}
              transcription={transcription}
              result={result}
              phase={activePhase}
              failed={showFailed}
              errorText={
                pipelineState.error ?? transcription?.error ?? 'Die Verarbeitung ist fehlgeschlagen.'
              }
              canGenerate={canGenerate}
              running={showRunning}
              onChanged={() => void load()}
            />
          )}
        </>
      )}
    </div>
  );
}
