import { ChevronDown } from 'lucide-react';

import type { DiktatCtx, DiktatDesign } from '../design-context';
import { DiktatEvidence, DiktatHeader, DiktatLetter, DiktatRegen, DiktatStatus } from '../design-shared';

/**
 * Nur der Text steht offen auf der Seite. Die Aufnahme liegt eingeklappt
 * darunter und öffnet sich erst, wenn man sie braucht.
 */
function Session({ ctx }: { ctx: DiktatCtx }) {
  const blocked = ctx.state === 'live' || ctx.state === 'interrupted';
  return (
    <div className="space-y-8 pb-16">
      <DiktatHeader ctx={ctx} />
      {ctx.state !== 'ready' ? <DiktatStatus ctx={ctx} /> : null}
      {!blocked ? (
        <>
          <DiktatLetter ctx={ctx} />
          <DiktatRegen ctx={ctx} />

          <details className="group rounded-xl border border-border">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 sm:px-6 [&::-webkit-details-marker]:hidden">
              <h2 className="text-lg font-semibold tracking-tight">Aufnahme anhören</h2>
              <ChevronDown
                className="size-5 text-muted-foreground transition-transform group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <div className="border-t border-border px-5 py-5 sm:px-6">
              <DiktatEvidence ctx={ctx} />
            </div>
          </details>
        </>
      ) : null}
    </div>
  );
}

export const klappen: DiktatDesign = Session;
