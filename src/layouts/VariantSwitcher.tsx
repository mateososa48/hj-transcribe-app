import { Check, LayoutPanelLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAppStore, type DiktatVariantId } from '@/store/app-store';

const META: Record<DiktatVariantId, { label: string; blurb: string }> = {
  aktuell: { label: 'Aktuell', blurb: 'Zwei gerahmte Felder mit Kopfzeilen — der jetzige Stand.' },
  blatt: { label: 'Blatt', blurb: 'Der Text als aufliegendes Blatt mit Schatten, keine Rahmen.' },
  leiste: { label: 'Leiste', blurb: 'Eine Aktionsleiste oben, darunter ruhige Spalten ohne Kästen.' },
  kontrast: { label: 'Kontrast', blurb: 'Schwarze Kopfbänder — Abschnitte, die man nicht übersehen kann.' },
};

/**
 * Evaluation pill for the Diktat page treatment. Ships nowhere by itself;
 * once a winner is chosen the losers and this switcher are deleted together.
 */
export function VariantSwitcher() {
  const variant = useAppStore((s) => s.diktatVariant);
  const setVariant = useAppStore((s) => s.setDiktatVariant);

  return (
    <div className="fixed right-4 bottom-4 z-50">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button size="lg" className="shadow-lg">
              <LayoutPanelLeft aria-hidden />
              Diktat: {META[variant].label}
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Diktat-Seite (nur Gestaltung, gleiche Anordnung)</DropdownMenuLabel>
            {(Object.keys(META) as DiktatVariantId[]).map((id) => (
              <DropdownMenuItem key={id} onClick={() => setVariant(id)} className="items-start gap-2 py-2">
                <Check className={id === variant ? 'mt-0.5 size-4' : 'mt-0.5 size-4 opacity-0'} aria-hidden />
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">{META[id].label}</span>
                  <span className="text-xs text-muted-foreground">{META[id].blurb}</span>
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
