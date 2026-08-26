import { useEffect, useRef, useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { pipeline } from '@/lib/transcription/pipeline';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';
import {
  BlattVariant,
  KontrastVariant,
  LeisteVariant,
  PanelsVariant,
  type DiktatVariantProps,
} from './DiktatVariants';
import type { ActiveProcessingPhase } from './processing-handoff-model';
import { ProcessingHandoff } from './ProcessingHandoff';

/**
 * The finished Diktat page. While the pipeline runs, the page shows ONLY the
 * handoff animation; when the text arrives, the animation resolves into a
 * check mark that fades, and then the content appears. He pressed one button
 * and waited — the page should read like an answer, not like a form
 * assembling itself. Which treatment renders below is the variant experiment.
 */
export function DiktatContent({
  phase,
  failed,
  errorText,
  ...variantProps
}: DiktatVariantProps & {
  phase: ActiveProcessingPhase | null;
  failed: boolean;
  errorText: string;
}) {
  const variant = useAppStore((s) => s.diktatVariant);
  const { session, result } = variantProps;

  /**
   * The arrival sequence. 'success' and 'closing' only ever happen when this
   * mounted page WATCHED the pipeline finish — reopening an old Diktat goes
   * straight to the content, no ceremony.
   */
  const [arrival, setArrival] = useState<'none' | 'success' | 'closing' | 'entered'>('none');
  const sawRunning = useRef(false);
  // The sequence timers must survive re-renders: the result object changes
  // identity when the page reloads it from the DB, and a per-run effect
  // cleanup would cancel the check mark mid-flight. Cleared on unmount only.
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (phase) {
      sawRunning.current = true;
      return;
    }
    if (sawRunning.current && result && !failed) {
      sawRunning.current = false;
      setArrival('success');
      timersRef.current.push(setTimeout(() => setArrival('closing'), 1100));
      timersRef.current.push(setTimeout(() => setArrival('entered'), 1450));
    }
    if (sawRunning.current && failed) sawRunning.current = false;
  }, [phase, result, failed]);

  if (phase) {
    return <ProcessingHandoff kind="beurteilung" phase={phase} />;
  }

  if (arrival === 'success' || arrival === 'closing') {
    return (
      <div role="status" aria-label="Fertig" className="flex min-h-56 items-center justify-center py-12">
        <div
          className={cn(
            'flex size-16 items-center justify-center rounded-full bg-foreground text-background shadow-lg',
            arrival === 'success'
              ? 'motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-300'
              : 'motion-safe:animate-out motion-safe:fade-out motion-safe:zoom-out-95 motion-safe:duration-300 motion-safe:fill-mode-forwards',
          )}
        >
          <Check className="size-8" strokeWidth={2.5} aria-hidden />
        </div>
      </div>
    );
  }

  const Variant =
    variant === 'blatt'
      ? BlattVariant
      : variant === 'leiste'
        ? LeisteVariant
        : variant === 'kontrast'
          ? KontrastVariant
          : PanelsVariant;

  return (
    <div
      className={cn(
        'space-y-8',
        arrival === 'entered' && 'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500',
      )}
    >
      {failed ? (
        <div className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/10 px-5 py-4">
          <p className="font-medium text-destructive">{errorText}</p>
          <Button size="lg" variant="outline" onClick={() => void pipeline.process(session.id)}>
            <RotateCcw aria-hidden />
            Erneut versuchen
          </Button>
        </div>
      ) : null}

      <Variant {...variantProps} />
    </div>
  );
}
