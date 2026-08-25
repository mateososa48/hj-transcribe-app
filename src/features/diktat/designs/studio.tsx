import { Check, ClipboardCopy, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RegenerateControls } from '@/features/session/RegenerateControls';
import { SyncedPlayback } from '@/features/session/SyncedPlayback';
import { cn } from '@/lib/utils';
import type { DiktatCtx, DiktatDesign } from '../design-context';
import {
  DeleteRecordingButton,
  DiktatEmptyText,
  DiktatStatus,
  DiktatTitle,
} from '../design-shared';
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
    <section className="min-w-0 space-y-3">
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
              <div className="grid gap-7 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start">
                {ctx.result ? (
                  <Editor resultId={ctx.result.id} initial={ctx.result.sections.beurteilung ?? ''} />
                ) : (
                  <section className="min-w-0 space-y-3">
                    <StageLabel>Zusammenfassende Beurteilung</StageLabel>
                    <Paper>
                      <DiktatEmptyText ctx={ctx} />
                    </Paper>
                  </section>
                )}

                <section className="min-w-0 space-y-3">
                  <StageLabel>Aufnahme</StageLabel>
                  <Paper>
                    <SyncedPlayback
                      sessionId={ctx.session.id}
                      words={ctx.transcription?.words ?? []}
                      fallbackText={ctx.transcription?.text ?? ''}
                    />
                  </Paper>
                </section>
              </div>

              {ctx.result ? (
                <div className="[&_button]:text-neutral-300 [&_button:hover]:bg-neutral-800 [&_button:hover]:text-white">
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

export const studio: DiktatDesign = Session;
