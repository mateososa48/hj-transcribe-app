import { useEffect, useState } from 'react';
import { AlertTriangle, KeyRound, RotateCcw, Settings2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { discardSession, markSessionRecovered } from '@/lib/session/recording-session.ts';
import { assembleTranscript } from '@/lib/transcription/queue.ts';
import { useSettingsStore } from '@/store/settings-store';
import { RecordingOrb, type OrbState } from './RecordingOrb';
import {
  recordingSession,
  transcriptionQueue,
  useElapsed,
  useQueueState,
  useRecordingState,
  useRecoverableSessions,
} from './useRecording';

function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function RecordScreen({
  onOpenSettings,
  onSessionReady,
}: {
  onOpenSettings: () => void;
  onSessionReady: (sessionId: string) => void;
}) {
  const settings = useSettingsStore((s) => s.settings);
  const apiKeys = useSettingsStore((s) => s.apiKeys);
  const recording = useRecordingState();
  const queue = useQueueState();
  const { sessions: recoverable, refresh } = useRecoverableSessions();
  const [transcript, setTranscript] = useState('');

  const elapsed = useElapsed(recording.startedAt, recording.status === 'recording');
  const asrKeyMissing = !apiKeys[settings.asrProviderId];

  // The queue runs whenever the app is open, not only while recording — that is
  // what lets a failed segment from an earlier session catch up by itself.
  useEffect(() => {
    transcriptionQueue.start();
    return () => transcriptionQueue.stop();
  }, []);

  // Once everything has been transcribed, show the assembled text.
  useEffect(() => {
    if (recording.status !== 'stopped' || !recording.sessionId) return;
    if (queue.pending > 0 || queue.running > 0) return;
    void assembleTranscript(recording.sessionId).then(setTranscript);
  }, [recording.status, recording.sessionId, queue.pending, queue.running]);

  if (asrKeyMissing) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <KeyRound aria-hidden />
          </EmptyMedia>
          <EmptyTitle className="text-lg">Noch kein Zugangsschlüssel hinterlegt</EmptyTitle>
          <EmptyDescription>
            Für die Spracherkennung fehlt der Zugangsschlüssel. Ohne ihn kann eine Aufnahme zwar
            gespeichert, aber nicht in Text umgewandelt werden.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button size="lg" onClick={onOpenSettings}>
            <Settings2 aria-hidden />
            Zu den Einstellungen
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  if (recoverable.length > 0 && recording.status === 'idle') {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Unterbrochene Aufnahme gefunden</h1>
          <p className="max-w-[68ch] text-muted-foreground">
            Eine frühere Aufnahme wurde nicht ordentlich beendet. Der Ton ist vollständig
            gespeichert und kann weiterverwendet werden.
          </p>
        </div>
        {recoverable.map((session) => (
          <Item key={session.id} variant="outline">
            <ItemContent>
              <ItemTitle>Sitzung vom {formatClock(session.startedAt)} Uhr</ItemTitle>
              <ItemDescription>
                Begonnen am{' '}
                {new Date(session.startedAt).toLocaleDateString('de-DE', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button
                variant="outline"
                size="lg"
                onClick={async () => {
                  await discardSession(session.id);
                  await refresh();
                  toast.success('Sitzung verworfen.');
                }}
              >
                <Trash2 aria-hidden />
                Verwerfen
              </Button>
              <Button
                size="lg"
                onClick={async () => {
                  await markSessionRecovered(session.id);
                  await refresh();
                  toast.success('Sitzung übernommen. Die Übertragung wird fortgesetzt.');
                }}
              >
                Fortsetzen
              </Button>
            </ItemActions>
          </Item>
        ))}
      </div>
    );
  }

  const orbState: OrbState =
    recording.status === 'error'
      ? 'error'
      : recording.inputWarning
        ? 'warning'
        : recording.status === 'recording'
          ? 'recording'
          : 'idle';

  const isRecording = recording.status === 'recording';
  const isBusy = recording.status === 'requesting-mic' || recording.status === 'stopping';

  return (
    <div className="flex flex-col items-center gap-8 py-4">
      {/* Timer first in the DOM and largest on screen: from two metres away this
          is the thing that answers "is it running?". */}
      <div className="text-center">
        {/* tabular-nums, not font-mono: no mono family is bundled, so font-mono
            falls back to a system face that fights the rest of the type.
            Geist's tabular figures stop the digits jittering just as well. */}
        <div className="text-6xl font-semibold tabular-nums tracking-tight">{elapsed}</div>
        <p className="mt-2 text-lg text-muted-foreground">
          {isRecording
            ? recording.inputWarning
              ? 'Aufnahme läuft — kein Ton!'
              : 'Aufnahme läuft'
            : recording.status === 'stopped'
              ? 'Aufnahme beendet'
              : recording.status === 'requesting-mic'
                ? 'Mikrofon wird angefragt …'
                : 'Bereit zur Aufnahme'}
        </p>
      </div>

      <RecordingOrb level={recording.level} state={orbState} />

      {recording.inputWarning ? (
        <div
          role="alert"
          className="flex max-w-[60ch] items-start gap-3 rounded-lg bg-destructive/10 px-4 py-3 text-destructive"
        >
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p className="text-base">{recording.inputWarning}</p>
        </div>
      ) : null}

      {recording.error ? (
        <div
          role="alert"
          className="flex max-w-[60ch] items-start gap-3 rounded-lg bg-destructive/10 px-4 py-3 text-destructive"
        >
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p className="text-base">{recording.error}</p>
        </div>
      ) : null}

      <Button
        size="lg"
        variant={isRecording ? 'destructive' : 'default'}
        disabled={isBusy}
        className="h-14 px-10 text-lg"
        onClick={async () => {
          if (isRecording) {
            await recordingSession.stop();
            toast.success('Aufnahme gespeichert.');
          } else {
            setTranscript('');
            await recordingSession.start();
          }
        }}
      >
        {isBusy ? <Spinner /> : null}
        {isRecording ? 'Aufnahme beenden' : 'Aufnahme starten'}
      </Button>

      {/* Pipeline status. Deliberately plain language: "wird nachgeholt" tells
          him nothing is lost, which is the only thing he needs to know. */}
      {/* Outstanding transcription work is worth showing even on an idle
          screen — it is how he knows nothing has been lost. */}
      {recording.segmentCount > 0 || queue.pending > 0 || queue.running > 0 || queue.failed > 0 ? (
        <>
          <Separator className="max-w-md" />
          <div className="flex flex-wrap items-center justify-center gap-3">
            {/* Session counters only once this session has produced something —
                "0 Abschnitte aufgenommen" on a fresh screen is noise, and the
                cumulative "übertragen" count belongs to the session in hand,
                not to every letter ever recorded. */}
            {recording.segmentCount > 0 ? (
              <>
                <Badge variant="secondary">
                  {recording.segmentCount} Abschnitt{recording.segmentCount === 1 ? '' : 'e'}{' '}
                  aufgenommen
                </Badge>
                {queue.done > 0 ? <Badge variant="secondary">{queue.done} übertragen</Badge> : null}
              </>
            ) : null}
            {queue.pending > 0 || queue.running > 0 ? (
              <Badge variant="outline">
                <Spinner className="size-3.5" />
                {queue.pending + queue.running} in Arbeit
              </Badge>
            ) : null}
            {queue.failed > 0 ? (
              <>
                <Badge variant="outline" className="text-destructive">
                  {queue.failed} wird nachgeholt
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void transcriptionQueue.retryFailed()}
                >
                  <RotateCcw aria-hidden />
                  Jetzt erneut versuchen
                </Button>
              </>
            ) : null}
          </div>
        </>
      ) : null}

      {transcript ? (
        <div className="w-full max-w-[68ch] space-y-4">
          <Separator />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Erkannter Text</h2>
            <Button
              size="lg"
              onClick={() => recording.sessionId && onSessionReady(recording.sessionId)}
            >
              Beurteilung erstellen
            </Button>
          </div>
          {/* Shown so he can sanity-check the recognition before a draft is
              built on top of it — a bad transcript is much easier to spot here
              than inside finished prose. */}
          <p className="whitespace-pre-wrap text-base leading-relaxed">{transcript}</p>
        </div>
      ) : null}
    </div>
  );
}
