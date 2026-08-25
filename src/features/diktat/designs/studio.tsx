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
 * STUDIO — the dictation booth. The Diktat pages sit on a near-black console;
 * the medical text itself lies INSIDE it as a bright paper sheet, the way a
 * printout rests on a mixing desk. Dark is chrome, light is content — the
 * document never goes dark, because the document is what gets proofread.
 */

function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-neutral-950 p-5 text-neutral-100 shadow-2xl sm:p-8">
      {children}
    </div>
  );
}

function StageLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-mono text-xs font-medium uppercase tracking-[0.22em] text-neutral-500">
      {children}
    </h2>
  );
}

/** Bright paper inside the dark console — normal light-theme tokens apply. */
function Paper({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-lg bg-neutral-50 p-5 text-neutral-950 sm:p-6', className)}>
      {children}
    </div>
  );
}

function Editor({ resultId, initial }: { resultId: string; initial: string }) {
  const { text, update, copy, copied, areaRef } = useDiktatText(resultId, initial);
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <StageLabel>Zusammenfassende Beurteilung</StageLabel>
        <Button
          size="sm"
          onClick={() => void copy()}
          className="btn-gloss bg-neutral-100 text-neutral-900 hover:bg-white"
        >
          {copied ? <Check aria-hidden /> : <ClipboardCopy aria-hidden />}
          {copied ? 'Kopiert' : 'Kopieren'}
        </Button>
      </div>
      <Paper>
        <Textarea
          ref={areaRef}
          value={text}
          onChange={(e) => update(e.target.value)}
          aria-label="Zusammenfassende Beurteilung"
          placeholder="Hier wurde nichts eingetragen — Sie können selbst ergänzen."
          className="min-h-40 rounded-none border-transparent bg-transparent p-0 leading-[1.85] text-neutral-950 shadow-none focus-visible:border-transparent focus-visible:ring-0 md:text-base"
        />
      </Paper>
    </section>
  );
}

function Session({ ctx }: { ctx: DiktatCtx }) {
  const blocked = ctx.state === 'live' || ctx.state === 'interrupted';
  return (
    <div className="pb-16">
      <Stage>
        <div className="space-y-7">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
            <div className="min-w-0 space-y-1 sm:flex-1">
              <DiktatTitle
                ctx={ctx}
                className="text-neutral-50 selection:bg-neutral-700 focus-visible:border-neutral-700"
              />
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-neutral-500">
                Diktat · {ctx.dateLine}
                {ctx.durationLine ? ` · ${ctx.durationLine}` : ''}
              </p>
            </div>
            <DeleteRecordingButton
              ctx={ctx}
              trigger={
                <Button variant="ghost" className="text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100">
                  <Trash2 aria-hidden />
                  Löschen
                </Button>
              }
            />
          </div>

          {ctx.state !== 'ready' ? (
            <Paper>
              <DiktatStatus ctx={ctx} />
            </Paper>
          ) : null}

          {!blocked ? (
            <>
              {ctx.result ? (
                <Editor resultId={ctx.result.id} initial={ctx.result.sections.beurteilung ?? ''} />
              ) : (
                <section className="space-y-3">
                  <StageLabel>Zusammenfassende Beurteilung</StageLabel>
                  <Paper>
                    <DiktatEmptyText ctx={ctx} />
                  </Paper>
                </section>
              )}

              <section className="space-y-3">
                <StageLabel>Aufnahme</StageLabel>
                <Paper>
                  <SyncedPlayback
                    sessionId={ctx.session.id}
                    words={ctx.transcription?.words ?? []}
                    fallbackText={ctx.transcription?.text ?? ''}
                  />
                </Paper>
              </section>

              {ctx.result ? (
                <div className="[&_button]:text-neutral-400 [&_button:hover]:bg-neutral-800 [&_button:hover]:text-neutral-100">
                  <RegenerateControls
                    session={ctx.session}
                    result={ctx.result}
                    running={ctx.running}
                    onChanged={ctx.reload}
                  />
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </Stage>
    </div>
  );
}

function Record() {
  const r = useDiktatRecorder();
  return (
    <div className="space-y-6">
      <Button variant="ghost" size="lg" onClick={r.goHome} disabled={r.isRecording}>
        <ArrowLeft aria-hidden />
        Zurück
      </Button>

      <Stage>
        <div className="flex flex-col items-center gap-8 py-6">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'size-3 rounded-full',
                r.isRecording ? 'bg-red-500 motion-safe:animate-pulse' : 'bg-neutral-700',
              )}
              aria-hidden
            />
            <StageLabel>{r.isRecording ? 'Aufnahme läuft' : 'Aufnahmebereit'}</StageLabel>
          </div>

          <div
            className={cn(
              'font-mono text-7xl font-semibold tabular-nums tracking-tight sm:text-8xl',
              r.isRecording ? 'text-red-400' : 'text-neutral-200',
            )}
          >
            {r.elapsed}
          </div>

          <RecordingWave level={r.recording.level} state={r.orbState} dark className="h-28" />
          <RecorderNotices recording={r.recording} className="bg-red-500/15 text-red-300" />

          <Button
            size="lg"
            disabled={r.isBusy}
            onClick={() => void r.toggle()}
            className={cn(
              'h-14 px-10 text-lg',
              r.isRecording
                ? 'btn-gloss bg-red-600 text-white hover:bg-red-600/90'
                : 'btn-gloss bg-neutral-100 text-neutral-900 hover:bg-white',
            )}
          >
            {r.isBusy ? <Spinner /> : null}
            {r.isRecording ? 'Diktat beenden' : 'Aufnahme starten'}
          </Button>

          <p className="max-w-[48ch] text-center text-sm text-neutral-500">
            {r.isRecording
              ? 'Die Aufnahme wird laufend auf diesem Computer gesichert.'
              : 'Sprechen Sie frei, wie zu einem Kollegen. Satzzeichen müssen Sie nicht mitsprechen.'}
          </p>
        </div>
      </Stage>
    </div>
  );
}

export const studio: DiktatDesign = { Record, Session };
