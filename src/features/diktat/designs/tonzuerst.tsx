import { Separator } from '@/components/ui/separator';
import type { DiktatCtx, DiktatDesign } from '../design-context';
import { DiktatEvidence, DiktatHeader, DiktatLetter, DiktatRegen, DiktatStatus } from '../design-shared';

/**
 * Die Aufnahme zuerst: Abspieler und Mitlesetext direkt unter dem Titel,
 * der fertige Text folgt darunter — hören, dann lesen.
 */
function Session({ ctx }: { ctx: DiktatCtx }) {
  const blocked = ctx.state === 'live' || ctx.state === 'interrupted';
  return (
    <div className="space-y-8 pb-16">
      <DiktatHeader ctx={ctx} />
      {ctx.state !== 'ready' ? <DiktatStatus ctx={ctx} /> : null}
      {!blocked ? (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">Aufnahme</h2>
            <DiktatEvidence ctx={ctx} />
          </section>
          <Separator />
          <div className="space-y-8">
            <DiktatLetter ctx={ctx} />
            <DiktatRegen ctx={ctx} />
          </div>
        </>
      ) : null}
    </div>
  );
}

export const tonzuerst: DiktatDesign = Session;
