import type { DiktatCtx, DiktatDesign } from '../design-context';
import { DiktatEvidence, DiktatHeader, DiktatLetter, DiktatRegen, DiktatStatus } from '../design-shared';

/**
 * Jeder Teil als eigene Karte auf der Fläche: links der Text in einem Rahmen,
 * rechts Abspieler und Mitlesetext als die Karten, die sie ohnehin sind.
 */
function Session({ ctx }: { ctx: DiktatCtx }) {
  const blocked = ctx.state === 'live' || ctx.state === 'interrupted';
  return (
    <div className="space-y-8 pb-16">
      <DiktatHeader ctx={ctx} />
      {ctx.state !== 'ready' ? <DiktatStatus ctx={ctx} /> : null}
      {!blocked ? (
        <>
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="min-w-0 rounded-xl border border-border bg-card p-5 sm:p-6">
              <DiktatLetter ctx={ctx} />
            </div>
            <section className="min-w-0 space-y-3">
              <h2 className="text-lg font-semibold tracking-tight">Aufnahme</h2>
              <DiktatEvidence ctx={ctx} />
            </section>
          </div>
          <DiktatRegen ctx={ctx} />
        </>
      ) : null}
    </div>
  );
}

export const karten: DiktatDesign = Session;
