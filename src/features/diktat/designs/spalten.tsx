import type { DiktatCtx, DiktatDesign } from '../design-context';
import { DiktatEvidence, DiktatHeader, DiktatLetter, DiktatRegen, DiktatStatus } from '../design-shared';

/** Text links, Aufnahme rechts — eine Trennlinie dazwischen, sonst nichts. */
function Session({ ctx }: { ctx: DiktatCtx }) {
  const blocked = ctx.state === 'live' || ctx.state === 'interrupted';
  return (
    <div className="space-y-8 pb-16">
      <DiktatHeader ctx={ctx} />
      {ctx.state !== 'ready' ? <DiktatStatus ctx={ctx} /> : null}
      {!blocked ? (
        <div className="grid gap-10 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:gap-8">
          <div className="min-w-0 space-y-8">
            <DiktatLetter ctx={ctx} />
            <DiktatRegen ctx={ctx} />
          </div>
          <div className="min-w-0 xl:border-l xl:border-border xl:pl-8">
            <section className="space-y-3">
              <h2 className="text-lg font-semibold tracking-tight">Aufnahme</h2>
              <DiktatEvidence ctx={ctx} />
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export const spalten: DiktatDesign = Session;
