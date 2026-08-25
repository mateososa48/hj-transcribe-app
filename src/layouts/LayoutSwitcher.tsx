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
import { useAppStore, type DiktatDesignId, type LayoutId } from '@/store/app-store';
import { hasDemoData, removeDemoData, seedDemoData } from './demo-data';

/**
 * The evaluation harness for the layout experiments: a floating pill that
 * switches between the seven arrangements in place, on the same data — the
 * only honest way to compare structure. Ships nowhere by itself; once a
 * winner is chosen the losers and this switcher are deleted together.
 */

export const LAYOUT_META: Record<LayoutId, { label: string; blurb: string }> = {
  standard: { label: 'Standard', blurb: 'Seitenleiste mit Gruppen — der aktuelle Stand.' },
  leiste: { label: 'Leiste', blurb: 'Schmale Kopfleiste, eine ruhige Spalte, Verlauf auf der Startseite.' },
  posteingang: { label: 'Posteingang', blurb: 'Listenspalte wie in einem Mailprogramm, Inhalt rechts.' },
  galerie: { label: 'Galerie', blurb: 'Karten auf einem Schreibtisch, Aufnahme öffnet als eigene Seite.' },
  blatt: { label: 'Blatt', blurb: 'Ein durchgehendes Blatt — Notizen und Transkript untereinander.' },
  vergleich: { label: 'Vergleich', blurb: 'Notizen links, Transkript rechts — Prüfen ohne Umschalten.' },
  protokoll: { label: 'Protokoll', blurb: 'Chronik: Aufnahmen klappen direkt in der Liste auf.' },
};

export function LayoutSwitcher() {
  const layout = useAppStore((s) => s.layout);
  const setLayout = useAppStore((s) => s.setLayout);
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
              {LAYOUT_META[layout].label} · Diktat: {DIKTAT_DESIGN_META[diktatDesign].label}
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="max-h-[80vh] w-80 overflow-y-auto">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Layout-Experimente</DropdownMenuLabel>
            {(Object.keys(LAYOUT_META) as LayoutId[]).map((id) => (
              <DropdownMenuItem key={id} onClick={() => setLayout(id)} className="items-start gap-2 py-2">
                <Check className={id === layout ? 'mt-0.5 size-4' : 'mt-0.5 size-4 opacity-0'} aria-hidden />
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">{LAYOUT_META[id].label}</span>
                  <span className="text-xs text-muted-foreground">{LAYOUT_META[id].blurb}</span>
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Diktat-Design (nur Diktat-Seiten)</DropdownMenuLabel>
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
