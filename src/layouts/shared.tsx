import { FileText, Mic, Settings2 } from 'lucide-react';

import { AnimatedBadge } from '@/components/motion/animated-badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { LetterSummary } from '@/features/letters/useLetters';
import { LAYOUTS, useAppStore, type LayoutId, type View } from '@/store/app-store';

export const NAV: Array<{ id: View; label: string; icon: typeof Mic }> = [
  { id: 'aufnahme', label: 'Aufnahme', icon: Mic },
  { id: 'brief', label: 'Brief', icon: FileText },
  { id: 'einstellungen', label: 'Einstellungen', icon: Settings2 },
];

export const BRAND = 'Arztbrief-Assistent';

/**
 * Status chip for a letter.
 *
 * Uses beUI's AnimatedBadge for the state transition (the icon morphs when the
 * status changes, which is genuinely informative here), but pinned to our own
 * palette: only neutral, loading and danger. The library's emerald/amber
 * variants would introduce two hues the product does not otherwise have.
 */
export function LetterStatusBadge({ status }: { status: LetterSummary['status'] }) {
  const map: Record<
    LetterSummary['status'],
    { tone: 'neutral' | 'loading' | 'danger'; label: string; pulse?: boolean }
  > = {
    aufnahme: { tone: 'danger', label: 'Aufnahme läuft', pulse: true },
    'ohne-entwurf': { tone: 'neutral', label: 'Kein Entwurf' },
    entwurf: { tone: 'loading', label: 'Entwurf' },
    freigegeben: { tone: 'neutral', label: 'Freigegeben' },
    exportiert: { tone: 'neutral', label: 'Exportiert' },
  };
  const { tone, label, pulse } = map[status];
  return (
    <AnimatedBadge status={tone} size="sm" contentKey={status} pulse={pulse ?? false}>
      {label}
    </AnimatedBadge>
  );
}

const LAYOUT_ITEMS: Record<string, string> = Object.fromEntries(
  LAYOUTS.map((l) => [l.id, l.label]),
);

/**
 * Evaluation-only control for comparing the three layouts.
 *
 * This is scaffolding for choosing a layout, not a product feature — HJ should
 * never see a control that rearranges his app. Remove it once one wins.
 */
export function LayoutSwitcher({ compact = false }: { compact?: boolean }) {
  const layout = useAppStore((s) => s.layout);
  const setLayout = useAppStore((s) => s.setLayout);
  const active = LAYOUTS.find((l) => l.id === layout);

  return (
    <div className="flex items-center gap-2">
      {!compact ? (
        <span className="text-xs tracking-wide text-muted-foreground uppercase">Layout</span>
      ) : null}
      <Select
        items={LAYOUT_ITEMS}
        value={layout}
        onValueChange={(value) => setLayout(value as LayoutId)}
      >
        <SelectTrigger
          size="sm"
          aria-label={`Layout wählen. Aktuell: ${active?.label ?? layout}`}
          className="h-8 w-[13rem]"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LAYOUTS.map((l) => (
            <SelectItem key={l.id} value={l.id}>
              {l.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Human time for a letter row. */
export function formatWhen(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? `Heute, ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`
    : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
