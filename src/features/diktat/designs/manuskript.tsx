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
 * MANUSKRIPT — the letter as a piece of writing. Serif text on a bare page,
 * a centred narrow measure, and horizontal rules instead of boxes: a double
 * rule under the head, a single rule before the apparatus. Closer to a set
 * galley proof than to an app — because what he reads here IS a letter.
 */

const serif = "[font-family:ui-serif,Georgia,Cambria,'Times_New_Roman',Times,serif]";

function Rules({ double }: { double?: boolean }) {
  return (
    <div aria-hidden className="space-y-[3px]">
      <div className="h-px bg-foreground" />
      {double ? <div className="h-px bg-foreground/40" /> : null}
    </div>
  );
}

function Editor({ resultId, initial }: { resultId: string; initial: string }) {
  const { text, update, copy, copied, areaRef } = useDiktatText(resultId, initial);
  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
          Zusammenfassende Beurteilung
        </h2>
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          {copied ? <Check className="size-4" aria-hidden /> : <ClipboardCopy className="size-4" aria-hidden />}
          {copied ? 'Kopiert' : 'Kopieren'}
        </button>
      </div>
      <Textarea
        ref={areaRef}
        value={text}
        onChange={(e) => update(e.target.value)}
        aria-label="Zusammenfassende Beurteilung"
        placeholder="Hier wurde nichts eingetragen — Sie können selbst ergänzen."
        className={cn(
          serif,
          'min-h-48 rounded-none border-transparent bg-transparent p-0 text-lg leading-[2] shadow-none focus-visible:border-transparent focus-visible:ring-0 md:text-lg',
        )}
      />
    </section>
  );
}

function Session({ ctx }: { ctx: DiktatCtx }) {
  const blocked = ctx.state === 'live' || ctx.state === 'interrupted';
  return (
    <div className="mx-auto max-w-[44rem] space-y-8 pb-16">
      <header className="space-y-4 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
          Diktat · {ctx.dateLine}
          {ctx.durationLine ? ` · ${ctx.durationLine}` : ''}
        </p>
        <DiktatTitle
          ctx={ctx}
          className={cn(serif, 'text-center text-3xl font-medium tracking-normal md:text-3xl')}
        />
        <Rules double />
      </header>

      {ctx.state !== 'ready' ? <DiktatStatus ctx={ctx} /> : null}

      {!blocked ? (
        <>
          {ctx.result ? (
            <Editor resultId={ctx.result.id} initial={ctx.result.sections.beurteilung ?? ''} />
          ) : (
            <DiktatEmptyText ctx={ctx} />
          )}

          <div className="space-y-8">
            <Rules />
            <section className="space-y-4">
              <h2 className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Aufnahme
              </h2>
              <SyncedPlayback
                sessionId={ctx.session.id}
                words={ctx.transcription?.words ?? []}
                fallbackText={ctx.transcription?.text ?? ''}
              />
            </section>

            <div className="flex flex-wrap items-center justify-center gap-3">
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
          </div>
        </>
      ) : null}
    </div>
  );
}

function Record() {
  const r = useDiktatRecorder();
  return (
    <div className="mx-auto max-w-[44rem] space-y-8">
      <Button variant="ghost" size="lg" onClick={r.goHome} disabled={r.isRecording}>
        <ArrowLeft aria-hidden />
        Zurück
      </Button>

      <header className="space-y-4 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
          {r.isRecording ? 'Die Aufnahme läuft' : 'Neues Diktat'}
        </p>
        <h1 className={cn(serif, 'text-3xl font-medium')}>Diktat aufnehmen</h1>
        <Rules double />
      </header>

      <div className="flex flex-col items-center gap-7 py-4">
        <div className={cn(serif, 'text-7xl tabular-nums tracking-tight')}>{r.elapsed}</div>
        <RecordingWave level={r.recording.level} state={r.orbState} className="h-24" />
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
        <p className={cn(serif, 'max-w-[48ch] text-center text-base italic text-muted-foreground')}>
          {r.isRecording
            ? 'Die Aufnahme wird laufend auf diesem Computer gesichert.'
            : 'Sprechen Sie frei, wie zu einem Kollegen — Satzzeichen müssen Sie nicht mitsprechen.'}
        </p>
      </div>
    </div>
  );
}

export const manuskript: DiktatDesign = { Record, Session };
