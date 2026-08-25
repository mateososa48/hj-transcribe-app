import { useEffect, useState } from 'react';
import { Check, LayoutPanelLeft } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DIKTAT_DESIGN_META } from '@/features/diktat/design-meta';
import { useAppStore, type DiktatDesignId } from '@/store/app-store';
import { hasDemoData, removeDemoData, seedDemoData } from './demo-data';

/**
 * The evaluation harness for the Diktat design experiments: a floating pill
 * that switches the finished-Diktat page between eleven treatments in place,
 * on the same data — the only honest way to compare design languages. Ships
 * nowhere by itself; once a winner is chosen the losers and this switcher are
 * deleted together.
 */
export function DesignSwitcher() {
  const diktatDesign = useAppStore((s) => s.diktatDesign);
  const setDiktatDesign = useAppStore((s) => s.setDiktatDesign);
  const touchSessions = useAppStore((s) => s.touchSessions);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    void hasDemoData().then(setDemo);
  }, []);

  return (
    <div className="fixed right-4 bottom-4 z-50">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button size="lg" className="shadow-lg">
              <LayoutPanelLeft aria-hidden />
              Diktat-Design: {DIKTAT_DESIGN_META[diktatDesign].label}
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="max-h-[80vh] w-80 overflow-y-auto">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Diktat-Design (nur die fertige Diktat-Seite)</DropdownMenuLabel>
            {(Object.keys(DIKTAT_DESIGN_META) as DiktatDesignId[]).map((id) => (
              <DropdownMenuItem
                key={id}
                onClick={() => setDiktatDesign(id)}
                className="items-start gap-2 py-2"
              >
                <Check
                  className={id === diktatDesign ? 'mt-0.5 size-4' : 'mt-0.5 size-4 opacity-0'}
                  aria-hidden
                />
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">{DIKTAT_DESIGN_META[id].label}</span>
                  <span className="text-xs text-muted-foreground">{DIKTAT_DESIGN_META[id].blurb}</span>
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          {import.meta.env.DEV ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  if (demo) {
                    await removeDemoData();
                    setDemo(false);
                    toast.success('Beispieldaten entfernt.');
                  } else {
                    await seedDemoData();
                    setDemo(true);
                    toast.success('Beispieldaten eingefügt.');
                  }
                  touchSessions();
                }}
              >
                {demo ? 'Beispieldaten entfernen' : 'Beispieldaten einfügen'}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
