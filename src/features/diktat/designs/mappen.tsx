import { Paperclip } from 'lucide-react';

import type { DiktatCtx, DiktatDesign } from '../design-context';
import { DiktatEvidence, DiktatHeader, DiktatLetter, DiktatRegen, DiktatStatus } from '../design-shared';

/**
 * Mappen mit Reitern: der Text als vordere Mappe, die Aufnahme dahinter als
 * Anlage mit Büroklammer. Der Reiter wächst aus dem Deckel (gemeinsame Kante,
 * keine Unterkante) — dieselbe Sprache wie überall, nur anders gefaltet.
 */
function Folder({ tab, children }: { tab: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="relative z-10 -mb-px inline-flex items-center gap-2 rounded-t-xl border border-b-0 border-border bg-card px-5 py-2.5 text-sm font-semibold">
        {tab}
      </div>
      <div className="rounded-xl rounded-tl-none border border-border bg-card p-5 sm:p-6">
        {children}
      </div>
    </section>
  );
}

function Session({ ctx }: { ctx: DiktatCtx }) {
  const blocked = ctx.state === 'live' || ctx.state === 'interrupted';
  return (
    <div className="space-y-8 pb-16">
      <DiktatHeader ctx={ctx} />
      {ctx.state !== 'ready' ? <DiktatStatus ctx={ctx} /> : null}
      {!blocked ? (
        <>
          <Folder tab="Zusammenfassende Beurteilung">
            <DiktatLetter ctx={ctx} hideTitle />
          </Folder>

          <Folder
            tab={
              <>
                <Paperclip className="size-4 text-muted-foreground" aria-hidden />
                Anlage — Aufnahme
              </>
            }
          >
            <DiktatEvidence ctx={ctx} />
          </Folder>

          <DiktatRegen ctx={ctx} />
        </>
      ) : null}
    </div>
  );
}

export const mappen: DiktatDesign = Session;
