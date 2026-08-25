import type { DiktatCtx, DiktatDesign } from '../design-context';
import { DiktatEvidence, DiktatHeader, DiktatLetter, DiktatRegen, DiktatStatus } from '../design-shared';

/**
 * Die Prüfansicht: Text und Mitlesetext gleich breit nebeneinander, die
 * Aufnahme bleibt beim Scrollen rechts stehen — Zeile für Zeile vergleichen.
 */
function Session({ ctx }: { ctx: DiktatCtx }) {
  const blocked = ctx.state === 'live' || ctx.state === 'interrupted';
  return (
    <div className="space-y-8 pb-16">
      <DiktatHeader ctx={ctx} />
      {ctx.state !== 'ready' ? <DiktatStatus ctx={ctx} /> : null}
      {!blocked ? (
        <div className="grid gap-10 xl:grid-cols-2 xl:gap-10">
          <div className="min-w-0 space-y-8">
            <DiktatLetter ctx={ctx} />
            <DiktatRegen ctx={ctx} />
          </div>
          <div className="min-w-0 xl:sticky xl:top-10 xl:self-start">
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

export const pruefen: DiktatDesign = Session;
