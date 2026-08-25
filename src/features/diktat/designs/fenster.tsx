import { ArrowLeft, Check, ClipboardCopy, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { RecordingWave } from '@/features/record/RecordingWave';
import { RegenerateControls } from '@/features/session/RegenerateControls';
import { SyncedPlayback } from '@/features/session/SyncedPlayback';
import { cn } from '@/lib/utils';
import type { DiktatCtx, DiktatDesign } from '../design-context';
import {
  DeleteRecordingButton,
  DiktatEmptyText,
  DiktatStatus,
  DiktatTitle,
  RecorderNotices,
} from '../design-shared';
import { useDiktatRecorder } from '../useDiktatRecorder';
import { useDiktatText } from '../useDiktatText';

/**
 * FENSTERRAHMEN — fieldset panels. Every section is a drawn frame whose label
 * sits IN the border line, the way classic print forms and old instrument
 * faceplates label their windows. No fills, no shadows: the page is white,
 * the frames carry everything, and actions dock into the frame itself.
 */

function Panel({
  legend,
  children,
  action,
  className,
}: {
  legend: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('relative rounded-xl border border-border p-5 pt-7 sm:p-6 sm:pt-8', className)}>
      <h2 className="absolute -top-2.5 left-4 bg-background px-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {legend}
      </h2>
      {action ? <div className="absolute -top-4 right-4 bg-background px-1">{action}</div> : null}
      {children}
    </section>
  );
}

function Editor({ resultId, initial }: { resultId: string; initial: string }) {
  const { text, update, copy, copied, areaRef } = useDiktatText(resultId, initial);
  return (
    <Panel
      legend="Beurteilung"
      action={
        <Button size="sm" variant={copied ? 'secondary' : 'outline'} onClick={() => void copy()}>
          {copied ? <Check aria-hidden /> : <ClipboardCopy aria-hidden />}
          {copied ? 'Kopiert' : 'Kopieren'}
        </Button>
      }
    >
      <Textarea
        ref={areaRef}
        value={text}
        onChange={(e) => update(e.target.value)}
        aria-label="Zusammenfassende Beurteilung"
        placeholder="Hier wurde nichts eingetragen — Sie können selbst ergänzen."
        className="min-h-48 rounded-none border-transparent bg-transparent p-0 leading-[1.85] shadow-none focus-visible:border-transparent focus-visible:ring-0 md:text-base"
      />
    </Panel>
  );
}

function Session({ ctx }: { ctx: DiktatCtx }) {
  const blocked = ctx.state === 'live' || ctx.state === 'interrupted';
  return (
    <div className="space-y-7 pb-16">
      <div className="space-y-1">
        <DiktatTitle ctx={ctx} />
        <p className="text-sm text-muted-foreground">
          Diktat · {ctx.dateLine}
          {ctx.durationLine ? ` · ${ctx.durationLine}` : ''}
        </p>
      </div>

      {ctx.state !== 'ready' ? <DiktatStatus ctx={ctx} /> : null}

      {!blocked ? (
        <div className="grid items-start gap-7 xl:grid-cols-[7fr_5fr]">
          {ctx.result ? (
            <Editor resultId={ctx.result.id} initial={ctx.result.sections.beurteilung ?? ''} />
          ) : (
            <Panel legend="Beurteilung">
              <DiktatEmptyText ctx={ctx} />
            </Panel>
          )}

          <div className="grid gap-7">
            <Panel legend="Aufnahme">
              <SyncedPlayback
                sessionId={ctx.session.id}
                words={ctx.transcription?.words ?? []}
                fallbackText={ctx.transcription?.text ?? ''}
              />
            </Panel>
            <Panel legend="Verwaltung">
              <div className="flex flex-wrap items-center gap-3">
                {ctx.result ? (
                  <RegenerateControls
                    session={ctx.session}
                    result={ctx.result}
                    running={ctx.running}
                    onChanged={ctx.reload}
                  />
                ) : null}
                <DeleteRecordingButton
                  ctx={ctx}
                  trigger={
                    <Button variant="ghost" className="text-muted-foreground">
                      <Trash2 aria-hidden />
                      Löschen
                    </Button>
                  }
                />
              </div>
            </Panel>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Record() {
  const r = useDiktatRecorder();
  return (
    <div className="space-y-7">
      <Button variant="ghost" size="lg" onClick={r.goHome} disabled={r.isRecording}>
        <ArrowLeft aria-hidden />
        Zurück
      </Button>

      <Panel legend="Diktat aufnehmen">
        <div className="flex flex-col items-center gap-6 py-4">
          <div className="text-6xl font-semibold tabular-nums tracking-tight sm:text-7xl">
            {r.elapsed}
          </div>
          <RecordingWave level={r.recording.level} state={r.orbState} className="h-32" />
          <RecorderNotices recording={r.recording} />
          <Button
            size="lg"
            disabled={r.isBusy}
            onClick={() => void r.toggle()}
            className={cn(
              'h-14 px-10 text-lg',
              r.isRecording && 'btn-gloss bg-destructive text-white hover:bg-destructive/90',
            )}
          >
            {r.isBusy ? <Spinner /> : null}
            {r.isRecording ? 'Diktat beenden' : 'Aufnahme starten'}
          </Button>
        </div>
      </Panel>

      <Panel legend="Hinweis">
        <p className="max-w-[56ch] text-sm text-muted-foreground">
          {r.isRecording
            ? 'Die Aufnahme wird laufend auf diesem Computer gesichert.'
            : 'Sprechen Sie frei, wie zu einem Kollegen. Nach dem Diktat entsteht die Zusammenfassende Beurteilung — fertig zum Einfügen in Word.'}
        </p>
      </Panel>
    </div>
  );
}

export const fenster: DiktatDesign = { Record, Session };
