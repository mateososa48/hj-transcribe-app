import type { DiktatCtx, DiktatDesign } from '../design-context';
import { DiktatEvidence, DiktatHeader, DiktatLetter, DiktatRegen, DiktatStatus } from '../design-shared';

/**
 * Ein Rahmen, innen durch Linien geteilt: Text, Aufnahme und Aktionen als
 * übereinanderliegende Abschnitte desselben Blatts.
 */
function Session({ ctx }: { ctx: DiktatCtx }) {
  const blocked = ctx.state === 'live' || ctx.state === 'interrupted';
  return (
    <div className="space-y-8 pb-16">
      <DiktatHeader ctx={ctx} />
      {ctx.state !== 'ready' ? <DiktatStatus ctx={ctx} /> : null}
      {!blocked ? (
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          <div className="p-5 sm:p-6">
            <DiktatLetter ctx={ctx} />
          </div>
          <section className="space-y-3 p-5 sm:p-6">
            <h2 className="text-lg font-semibold tracking-tight">Aufnahme</h2>
            <DiktatEvidence ctx={ctx} />
          </section>
          <div className="px-3 py-2">
            <DiktatRegen ctx={ctx} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export const abschnitte: DiktatDesign = Session;
