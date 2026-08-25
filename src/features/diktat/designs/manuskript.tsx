import '@fontsource-variable/source-serif-4';

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
 * MANUSKRIPT — the letter as a piece of writing. Serif text on a bare page,
 * a centred narrow measure, and horizontal rules instead of boxes: a double
 * rule under the head, a single rule before the apparatus. Closer to a set
 * galley proof than to an app — because what he reads here IS a letter.
 */

const serif = "[font-family:'Source_Serif_4_Variable',ui-serif,Georgia,Cambria,serif]";

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
    <div className="mx-auto max-w-[44rem] space-y-8 pb-16 xl:max-w-[76rem]">
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
          <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_24rem] xl:gap-12">
            <div className="min-w-0 xl:mx-auto xl:w-full xl:max-w-[46rem]">
              {ctx.result ? (
                <Editor resultId={ctx.result.id} initial={ctx.result.sections.beurteilung ?? ''} />
              ) : (
                <DiktatEmptyText ctx={ctx} />
              )}
            </div>

            <aside className="mt-8 min-w-0 xl:mt-0 xl:border-l xl:border-foreground/20 xl:pl-8">
              <div className="space-y-4">
                <div className="xl:hidden">
                  <Rules />
                </div>
                <section className="space-y-4 xl:pt-1">
                  <h2 className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
                    Aufnahme
                  </h2>
                  <SyncedPlayback
                    sessionId={ctx.session.id}
                    words={ctx.transcription?.words ?? []}
                    fallbackText={ctx.transcription?.text ?? ''}
                  />
                </section>
              </div>
            </aside>
          </div>

          <div className="space-y-8">
            <Rules />
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

export const manuskript: DiktatDesign = Session;
