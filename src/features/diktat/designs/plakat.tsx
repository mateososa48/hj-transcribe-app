import { Check, ClipboardCopy } from 'lucide-react';

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
 * PLAKAT — print-shop contrast. Section titles are white type on full black
 * bars, rules are four pixels thick, corners do not exist, and the clock is
 * set at poster size. The page reads from across the room; nothing is subtle
 * and nothing is decorated — black, white, one red word when it matters.
 */

function Bar({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-stretch justify-between gap-3">
      <h2 className="inline-flex items-center bg-foreground px-4 py-2 text-sm font-bold uppercase tracking-[0.18em] text-background">
        {children}
      </h2>
      {action}
    </div>
  );
}

function PlakatButton({
  children,
  onClick,
  disabled,
  danger,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-12 items-center gap-2 border-2 border-foreground bg-foreground px-6 text-sm font-bold uppercase tracking-[0.14em] text-background transition-colors',
        'hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50',
        danger &&
          'border-destructive bg-destructive text-white hover:bg-background hover:text-destructive',
        className,
      )}
    >
      {children}
    </button>
  );
}

function Editor({ resultId, initial }: { resultId: string; initial: string }) {
  const { text, update, copy, copied, areaRef } = useDiktatText(resultId, initial);
  return (
    <section className="space-y-5">
      <Bar
        action={
          <PlakatButton onClick={() => void copy()} className="h-auto">
            {copied ? <Check className="size-4" aria-hidden /> : <ClipboardCopy className="size-4" aria-hidden />}
            {copied ? 'Kopiert' : 'Kopieren'}
          </PlakatButton>
        }
      >
        Zusammenfassende Beurteilung
      </Bar>
      <Textarea
        ref={areaRef}
        value={text}
        onChange={(e) => update(e.target.value)}
        aria-label="Zusammenfassende Beurteilung"
        placeholder="Hier wurde nichts eingetragen — Sie können selbst ergänzen."
        className="min-h-44 rounded-none border-transparent bg-transparent p-0 leading-[1.85] shadow-none focus-visible:border-transparent focus-visible:ring-0 md:text-base"
      />
    </section>
  );
}

function Session({ ctx }: { ctx: DiktatCtx }) {
  const blocked = ctx.state === 'live' || ctx.state === 'interrupted';
  return (
    <div className="space-y-8 pb-16">
      <header className="space-y-4 border-t-4 border-foreground pt-5">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">
          Diktat · {ctx.dateLine}
          {ctx.durationLine ? ` · ${ctx.durationLine}` : ''}
        </p>
        <DiktatTitle ctx={ctx} className="text-2xl font-bold uppercase tracking-tight md:text-3xl" />
      </header>

      {ctx.state !== 'ready' ? <DiktatStatus ctx={ctx} /> : null}

      {!blocked ? (
        <>
          <div className="xl:grid xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:gap-10">
            <div className="min-w-0">
              {ctx.result ? (
                <Editor resultId={ctx.result.id} initial={ctx.result.sections.beurteilung ?? ''} />
              ) : (
                <section className="space-y-5">
                  <Bar>Zusammenfassende Beurteilung</Bar>
                  <DiktatEmptyText ctx={ctx} />
                </section>
              )}
            </div>

            <section className="min-w-0 mt-8 space-y-5 border-t-4 border-foreground pt-5 xl:mt-0 xl:border-t-0 xl:border-l-4 xl:pt-0 xl:pl-8">
              <Bar>Aufnahme</Bar>
              <div className="[&_.rounded-lg]:rounded-none [&_.rounded-xl]:rounded-none">
                <SyncedPlayback
                  sessionId={ctx.session.id}
                  words={ctx.transcription?.words ?? []}
                  fallbackText={ctx.transcription?.text ?? ''}
                />
              </div>
            </section>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t-4 border-foreground pt-5">
            {ctx.result ? (
              <RegenerateControls
                session={ctx.session}
                result={ctx.result}
                running={ctx.running}
                onChanged={ctx.reload}
                className="[&_button]:rounded-none [&_button]:font-bold [&_button]:uppercase [&_button]:tracking-wider"
              />
            ) : null}
            <DeleteRecordingButton
              ctx={ctx}
              trigger={
                <button
                  type="button"
                  className="inline-flex h-10 items-center gap-2 px-3 text-sm font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:text-destructive"
                >
                  Löschen
                </button>
              }
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

export const plakat: DiktatDesign = Session;
