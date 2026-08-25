import { Check, ClipboardCopy, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RegenerateControls } from '@/features/session/RegenerateControls';
import { SyncedPlayback } from '@/features/session/SyncedPlayback';
import type { DiktatCtx, DiktatDesign } from '../design-context';
import {
  DeleteRecordingButton,
  DiktatEmptyText,
  DiktatStatus,
  DiktatTitle,
} from '../design-shared';
import { useDiktatText } from '../useDiktatText';

/**
 * KARTEIKARTE — the patient index card. One hard-edged card, 2-px rules,
 * zero corner radius, content organised into stamped section bands the way a
 * paper Karteikarte separates Befund from Verlauf. The design language is
 * borders: everything the eye needs is drawn, nothing is implied by shadow.
 */

/** The section band: a labelled rule, exactly like a printed card divider. */
function Band({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-y-2 border-foreground bg-muted px-5 py-2">
      <h2 className="text-xs font-bold uppercase tracking-[0.16em]">{children}</h2>
      {actions}
    </div>
  );
}

const squareBtn =
  'h-8 rounded-none border-2 border-foreground bg-background px-3 text-xs font-bold uppercase tracking-wider text-foreground shadow-none hover:bg-foreground hover:text-background';

function Editor({ resultId, initial }: { resultId: string; initial: string }) {
  const { text, update, copy, copied, areaRef } = useDiktatText(resultId, initial);
  return (
    <>
      <Band
        actions={
          <Button size="sm" className={squareBtn} onClick={() => void copy()}>
            {copied ? <Check aria-hidden /> : <ClipboardCopy aria-hidden />}
            {copied ? 'Kopiert' : 'Kopieren'}
          </Button>
        }
      >
        Zusammenfassende Beurteilung
      </Band>
      <Textarea
        ref={areaRef}
        value={text}
        onChange={(e) => update(e.target.value)}
        aria-label="Zusammenfassende Beurteilung"
        placeholder="Hier wurde nichts eingetragen — Sie können selbst ergänzen."
        className="min-h-40 rounded-none border-transparent bg-transparent px-5 py-4 leading-[1.85] shadow-none focus-visible:border-transparent focus-visible:ring-0 md:text-base"
      />
    </>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="border-2 border-foreground bg-background">{children}</div>;
}

function Session({ ctx }: { ctx: DiktatCtx }) {
  const blocked = ctx.state === 'live' || ctx.state === 'interrupted';
  return (
    <div className="space-y-6 pb-16">
      <Frame>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
          <span className="border-2 border-foreground px-2 py-0.5 text-xs font-bold uppercase tracking-[0.2em]">
            Diktat
          </span>
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {ctx.dateLine}
            {ctx.durationLine ? ` · ${ctx.durationLine}` : ''}
          </p>
        </div>
        <div className="border-t-2 border-foreground px-5 py-3">
          <DiktatTitle ctx={ctx} className="rounded-none" />
        </div>

        {blocked ? (
          <div className="border-t-2 border-foreground p-5">
            <DiktatStatus ctx={ctx} />
          </div>
        ) : (
          <>
            {ctx.state !== 'ready' ? (
              <div className="border-t-2 border-foreground p-5">
                <DiktatStatus ctx={ctx} />
              </div>
            ) : null}

            <div className="xl:grid xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <div className="min-w-0">
                {ctx.result ? (
                  <Editor resultId={ctx.result.id} initial={ctx.result.sections.beurteilung ?? ''} />
                ) : (
                  <>
                    <Band>Zusammenfassende Beurteilung</Band>
                    <div className="px-5 py-4">
                      <DiktatEmptyText ctx={ctx} />
                    </div>
                  </>
                )}
              </div>

              <div className="min-w-0 xl:border-l-2 xl:border-foreground">
                <Band>Aufnahme</Band>
                <div className="px-5 py-4">
                  <div className="[&_.rounded-lg]:rounded-none [&_.rounded-xl]:rounded-none">
                    <SyncedPlayback
                      sessionId={ctx.session.id}
                      words={ctx.transcription?.words ?? []}
                      fallbackText={ctx.transcription?.text ?? ''}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-foreground px-3 py-2">
              {ctx.result ? (
                <RegenerateControls
                  session={ctx.session}
                  result={ctx.result}
                  running={ctx.running}
                  onChanged={ctx.reload}
                />
              ) : (
                <span />
              )}
              <DeleteRecordingButton
                ctx={ctx}
                trigger={
                  <Button variant="ghost" className="rounded-none text-muted-foreground">
                    <Trash2 aria-hidden />
                    Löschen
                  </Button>
                }
              />
            </div>
          </>
        )}
      </Frame>
    </div>
  );
}

export const karteikarte: DiktatDesign = Session;
