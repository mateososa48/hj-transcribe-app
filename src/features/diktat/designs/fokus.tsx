import { Check, ClipboardCopy } from 'lucide-react';

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
 * FOKUS — the opposite pole of every bordered design here: no frames, no
 * cards, no bands. A large clock, one round key, and afterwards the text
 * alone on the page at a generous size. Hierarchy comes from whitespace and
 * scale only; actions stand quietly underneath as text.
 */

function Editor({ resultId, initial }: { resultId: string; initial: string }) {
  const { text, update, copy, copied, areaRef } = useDiktatText(resultId, initial);
  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
          Zusammenfassende Beurteilung
        </p>
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
        className="min-h-48 rounded-none border-transparent bg-transparent p-0 text-lg leading-[2] shadow-none focus-visible:border-transparent focus-visible:ring-0 md:text-lg"
      />
    </section>
  );
}

function Session({ ctx }: { ctx: DiktatCtx }) {
  const blocked = ctx.state === 'live' || ctx.state === 'interrupted';
  return (
    <div className="mx-auto max-w-[56rem] space-y-10 pb-16">
      <header className="space-y-1.5 pt-4">
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
          {ctx.dateLine}
          {ctx.durationLine ? ` · ${ctx.durationLine}` : ''}
        </p>
        <DiktatTitle ctx={ctx} className="text-3xl font-medium md:text-3xl" />
      </header>

      {ctx.state !== 'ready' ? <DiktatStatus ctx={ctx} /> : null}

      {!blocked ? (
        <>
          {ctx.result ? (
            <Editor resultId={ctx.result.id} initial={ctx.result.sections.beurteilung ?? ''} />
          ) : (
            <DiktatEmptyText ctx={ctx} />
          )}

          <section className="space-y-4 pt-6">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Aufnahme</p>
            <SyncedPlayback
              sessionId={ctx.session.id}
              words={ctx.transcription?.words ?? []}
              fallbackText={ctx.transcription?.text ?? ''}
            />
          </section>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            {ctx.result ? (
              <RegenerateControls
                session={ctx.session}
                result={ctx.result}
                running={ctx.running}
                onChanged={ctx.reload}
              />
            ) : null}
            <DeleteRecordingButton ctx={ctx} />
          </div>
        </>
      ) : null}
    </div>
  );
}

export const fokus: DiktatDesign = Session;
