import { ArrowLeft, Check, ClipboardCopy } from 'lucide-react';

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
 * GLAS — the glossy pole. The button finish he kept asking for, promoted to a
 * whole surface: soft ambient light behind frosted panels, deep corner radii,
 * floating shadows. Everything sits on layered Milchglas; the one saturated
 * note is a cool sky haze in the stage lighting.
 */

function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/70 bg-gradient-to-b from-sky-50 via-neutral-100 to-neutral-200 p-5 sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-16 size-72 rounded-full bg-sky-200/50 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 top-40 size-80 rounded-full bg-white/70 blur-3xl"
      />
      <div className="relative space-y-6">{children}</div>
    </div>
  );
}

function Glass({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-white/80 bg-white/60 p-5 shadow-lg shadow-neutral-900/5 backdrop-blur-xl sm:p-6',
        className,
      )}
    >
      {children}
    </div>
  );
}

function Editor({ resultId, initial }: { resultId: string; initial: string }) {
  const { text, update, copy, copied, areaRef } = useDiktatText(resultId, initial);
  return (
    <Glass>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Zusammenfassende Beurteilung</h2>
        <Button size="lg" variant={copied ? 'secondary' : 'default'} onClick={() => void copy()}>
          {copied ? <Check aria-hidden /> : <ClipboardCopy aria-hidden />}
          {copied ? 'Kopiert' : 'Kopieren'}
        </Button>
      </div>
      <Textarea
        ref={areaRef}
        value={text}
        onChange={(e) => update(e.target.value)}
        aria-label="Zusammenfassende Beurteilung"
        placeholder="Hier wurde nichts eingetragen — Sie können selbst ergänzen."
        className="min-h-44 rounded-none border-transparent bg-transparent p-0 leading-[1.85] shadow-none focus-visible:border-transparent focus-visible:ring-0 md:text-base"
      />
    </Glass>
  );
}

function Session({ ctx }: { ctx: DiktatCtx }) {
  const blocked = ctx.state === 'live' || ctx.state === 'interrupted';
  return (
    <div className="pb-16">
      <Stage>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
          <div className="min-w-0 space-y-1 sm:flex-1">
            <DiktatTitle ctx={ctx} />
            <p className="text-sm text-muted-foreground">
              Diktat · {ctx.dateLine}
              {ctx.durationLine ? ` · ${ctx.durationLine}` : ''}
            </p>
          </div>
          <DeleteRecordingButton ctx={ctx} />
        </div>

        {ctx.state !== 'ready' ? (
          <Glass>
            <DiktatStatus ctx={ctx} />
          </Glass>
        ) : null}

        {!blocked ? (
          <>
            {ctx.result ? (
              <Editor resultId={ctx.result.id} initial={ctx.result.sections.beurteilung ?? ''} />
            ) : (
              <Glass>
                <DiktatEmptyText ctx={ctx} />
              </Glass>
            )}

            <Glass>
              <h2 className="mb-3 text-lg font-semibold tracking-tight">Aufnahme</h2>
              <SyncedPlayback
                sessionId={ctx.session.id}
                words={ctx.transcription?.words ?? []}
                fallbackText={ctx.transcription?.text ?? ''}
              />
            </Glass>

            {ctx.result ? (
              <RegenerateControls
                session={ctx.session}
                result={ctx.result}
                running={ctx.running}
                onChanged={ctx.reload}
              />
            ) : null}
          </>
        ) : null}
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
        <Glass className="flex flex-col items-center gap-7 py-8 sm:py-10">
          <p className="text-sm font-medium text-muted-foreground">
            {r.isRecording ? 'Ihr Diktat wird aufgenommen' : 'Neues Diktat'}
          </p>
          <div className="text-7xl font-semibold tabular-nums tracking-tight">{r.elapsed}</div>
          <div className="w-full max-w-xl overflow-hidden rounded-2xl">
            <RecordingWave level={r.recording.level} state={r.orbState} className="h-28" />
          </div>
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
          <p className="max-w-[48ch] text-center text-sm text-muted-foreground">
            {r.isRecording
              ? 'Die Aufnahme wird laufend auf diesem Computer gesichert.'
              : 'Sprechen Sie frei, wie zu einem Kollegen. Satzzeichen müssen Sie nicht mitsprechen.'}
          </p>
        </Glass>
      </Stage>
    </div>
  );
}

export const glas: DiktatDesign = { Record, Session };
