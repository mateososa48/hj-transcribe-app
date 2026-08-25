import { Check, ClipboardCopy, Paperclip, Trash2 } from 'lucide-react';

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
 * AKTENMAPPE — folders with tabs. The Beurteilung is the front folder, the
 * recording is filed behind it as ANLAGE with a paperclip. The tab physically
 * grows out of the body (rounded top, shared border, no bottom edge), which is
 * the entire construction: sectioning by document, not by heading.
 */

function Folder({
  tab,
  action,
  children,
}: {
  tab: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-end justify-between gap-3">
        <div className="relative z-10 -mb-px inline-flex items-center gap-2 rounded-t-xl border border-b-0 border-border bg-card px-5 py-2.5 text-sm font-semibold">
          {tab}
        </div>
        {action ? <div className="pb-1.5">{action}</div> : null}
      </div>
      <div className="rounded-xl rounded-tl-none border border-border bg-card p-5 sm:p-6">
        {children}
      </div>
    </section>
  );
}

function Editor({ resultId, initial }: { resultId: string; initial: string }) {
  const { text, update, copy, copied, areaRef } = useDiktatText(resultId, initial);
  return (
    <Folder
      tab="Zusammenfassende Beurteilung"
      action={
        <Button size="lg" variant={copied ? 'secondary' : 'outline'} onClick={() => void copy()}>
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
        className="min-h-44 rounded-none border-transparent bg-transparent p-0 leading-[1.85] shadow-none focus-visible:border-transparent focus-visible:ring-0 md:text-base"
      />
    </Folder>
  );
}

function Session({ ctx }: { ctx: DiktatCtx }) {
  const blocked = ctx.state === 'live' || ctx.state === 'interrupted';
  return (
    <div className="space-y-8 pb-16">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
        <div className="min-w-0 space-y-1 sm:flex-1">
          <DiktatTitle ctx={ctx} />
          <p className="text-sm text-muted-foreground">
            Diktat · {ctx.dateLine}
            {ctx.durationLine ? ` · ${ctx.durationLine}` : ''}
          </p>
        </div>
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

      {ctx.state !== 'ready' ? <DiktatStatus ctx={ctx} /> : null}

      {!blocked ? (
        <>
          {ctx.result ? (
            <Editor resultId={ctx.result.id} initial={ctx.result.sections.beurteilung ?? ''} />
          ) : (
            <Folder tab="Zusammenfassende Beurteilung">
              <DiktatEmptyText ctx={ctx} />
            </Folder>
          )}

          <Folder
            tab={
              <>
                <Paperclip className="size-4 text-muted-foreground" aria-hidden />
                Anlage — Aufnahme
              </>
            }
          >
            <SyncedPlayback
              sessionId={ctx.session.id}
              words={ctx.transcription?.words ?? []}
              fallbackText={ctx.transcription?.text ?? ''}
            />
          </Folder>

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
    </div>
  );
}

export const akte: DiktatDesign = Session;
