import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ProcessingHandoff } from '@/features/session/ProcessingHandoff';
import {
  estimatePhaseMs,
  isOverrunning,
  type ActiveProcessingPhase,
} from '@/features/session/processing-handoff-model';
import type { SessionKind } from '@/lib/db';
import { cn } from '@/lib/utils';

/**
 * A bench for the processing screen — the wait between "stop" and "here is
 * your letter" — without recording anything.
 *
 * The point of scrubbing rather than only playing: the interesting moment is
 * the overrun, when the estimate turns out to be wrong and the screen has to
 * admit it. Waiting that out in real time takes longer than anyone will sit
 * through, so the clock is a slider.
 */

const LENGTHS: Array<{ label: string; ms: number }> = [
  { label: '0:30 min', ms: 30_000 },
  { label: '3:30 min', ms: 210_000 },
  { label: '12:34 min', ms: 754_000 },
  { label: '45:00 min', ms: 2_700_000 },
];

export function ProcessingPreview() {
  const [kind, setKind] = useState<SessionKind>('beurteilung');
  const [phase, setPhase] = useState<ActiveProcessingPhase>('transcribing');
  const [durationMs, setDurationMs] = useState(210_000);
  const [elapsedMs, setElapsedMs] = useState(8_000);
  const [playing, setPlaying] = useState(false);

  const estimateMs = estimatePhaseMs(phase, durationMs);
  const maxMs = Math.round(estimateMs * 1.8);
  const overrunning = isOverrunning(elapsedMs, estimateMs);

  // "Live mitlaufen": advance the clock in real time, then stop at the end of
  // the scrub range so it parks in the overrun state rather than running off.
  const raf = useRef(0);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = t - last;
      last = t;
      setElapsedMs((prev) => {
        const next = prev + dt;
        if (next >= maxMs) {
          setPlaying(false);
          return maxMs;
        }
        return next;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, maxMs]);

  // The component counts up from a start time, so scrubbing means moving the
  // start backwards from now.
  const startedAt = Date.now() - elapsedMs;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:px-10">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Verarbeitung — Vorschau</h1>
          <p className="max-w-[68ch] text-base text-muted-foreground">
            Der Bildschirm zwischen „Aufnahme beenden“ und dem fertigen Text. Nichts hier ist
            aufgenommen — die Uhr ist ein Regler, damit auch der Fall sichtbar wird, in dem die
            Verarbeitung länger dauert als geschätzt.
          </p>
        </header>

        <div className="mt-8 space-y-5 rounded-xl border border-border bg-muted/30 px-5 py-5 sm:px-6">
          <Choice
            label="Was wurde aufgenommen"
            options={[
              { value: 'beurteilung', label: 'Diktat' },
              { value: 'gespraech', label: 'Termin' },
            ]}
            value={kind}
            onChange={(v) => setKind(v as SessionKind)}
          />
          <Choice
            label="Schritt"
            options={[
              { value: 'transcribing', label: '1 — Aufnahme wird übertragen' },
              { value: 'notes', label: '2 — Text entsteht' },
            ]}
            value={phase}
            onChange={(v) => setPhase(v as ActiveProcessingPhase)}
          />
          <Choice
            label="Länge der Aufnahme"
            options={LENGTHS.map((l) => ({ value: String(l.ms), label: l.label }))}
            value={String(durationMs)}
            onChange={(v) => setDurationMs(Number(v))}
          />

          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-sm font-medium">Seit Beginn des Schritts</span>
              <span className="text-sm tabular-nums text-muted-foreground">
                {(elapsedMs / 1000).toFixed(0)} s von geschätzten {(estimateMs / 1000).toFixed(0)} s
                {overrunning ? ' — länger als geschätzt' : ''}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={maxMs}
              step={250}
              value={Math.min(elapsedMs, maxMs)}
              onChange={(e) => {
                setPlaying(false);
                setElapsedMs(Number(e.target.value));
              }}
              aria-label="Seit Beginn des Schritts"
              className="h-8 w-full accent-foreground"
            />
            <div className="flex flex-wrap gap-2">
              <Button size="lg" variant="outline" onClick={() => setPlaying((p) => !p)}>
                {playing ? 'Anhalten' : 'Live mitlaufen'}
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => {
                  setPlaying(false);
                  setElapsedMs(0);
                }}
              >
                Von vorn
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => {
                  setPlaying(false);
                  setElapsedMs(Math.round(estimateMs * 1.4));
                }}
              >
                Zum Überlauf springen
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-10">
          <p className="mb-3 text-sm text-muted-foreground">So sieht er es:</p>
          <ProcessingHandoff
            kind={kind}
            phase={phase}
            audioDurationMs={durationMs}
            startedAt={startedAt}
          />
        </div>

        <p className="mt-10 max-w-[68ch] text-sm text-muted-foreground">
          Der Balken hält bewusst vor dem Ende an und zeigt nie „fertig“, solange es nicht fertig
          ist. Läuft ein Schritt länger als geschätzt, sagt der Text das — statt bei 100 % zu
          stehen. Auf diesem Bildschirm gibt es keine Animation: was sich bewegt, ist die
          tatsächlich vergangene Zeit.
        </p>
      </div>
    </div>
  );
}

function Choice({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="w-48 shrink-0 text-sm font-medium">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={cn(
              'h-10 rounded-lg border px-3.5 text-sm transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              value === option.value
                ? 'border-foreground bg-foreground text-background'
                : 'border-border bg-background hover:bg-muted',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
