import { AudioLines, FileText } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { DiktatCtx, DiktatDesign } from '../design-context';
import { DiktatEvidence, DiktatHeader, DiktatLetter, DiktatRegen, DiktatStatus } from '../design-shared';

/** Zwei Reiter wie beim Termin: der Text vorn, die Aufnahme dahinter. */
function Session({ ctx }: { ctx: DiktatCtx }) {
  const blocked = ctx.state === 'live' || ctx.state === 'interrupted';
  return (
    <div className="space-y-8 pb-16">
      <DiktatHeader ctx={ctx} />
      {ctx.state !== 'ready' ? <DiktatStatus ctx={ctx} /> : null}
      {!blocked ? (
        <Tabs defaultValue="text">
          <TabsList className="group-data-horizontal/tabs:h-11">
            <TabsTrigger value="text" className="px-3 text-base">
              <FileText aria-hidden /> Text
            </TabsTrigger>
            <TabsTrigger value="aufnahme" className="px-3 text-base">
              <AudioLines aria-hidden /> Aufnahme
            </TabsTrigger>
          </TabsList>
          <TabsContent value="text" className="space-y-8 pt-6 text-base">
            <DiktatLetter ctx={ctx} />
            <DiktatRegen ctx={ctx} />
          </TabsContent>
          <TabsContent value="aufnahme" className="pt-6 text-base">
            <DiktatEvidence ctx={ctx} />
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}

export const reiter: DiktatDesign = Session;
