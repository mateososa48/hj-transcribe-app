import { Check, ClipboardCopy, FilePlus2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Result, Session, Transcription } from '@/lib/db';
import { pipeline } from '@/lib/transcription/pipeline';
import { cn } from '@/lib/utils';
import { BeurteilungText } from './BeurteilungText';
import { RegenerateControls } from './RegenerateControls';
import { SyncedPlayback } from './SyncedPlayback';
import { useBeurteilung, type Beurteilung } from './useBeurteilung';

/**
 * Four treatments of the SAME two-column Diktat page, on one behaviour
 * (useBeurteilung + SyncedPlayback + RegenerateControls). Under evaluation
 * via the floating pill; once one wins, the losers and the pill go.
 */
export interface DiktatVariantProps {
  session: Session;
  transcription: Transcription | null;
  result: Result | null;
  canGenerate: boolean;
  running: boolean;
  onChanged: () => void;
}

function CopyButton({ b, inverted }: { b: Beurteilung; inverted?: boolean }) {
  return (
    <Button
      size="lg"
      variant={b.copied ? 'secondary' : 'default'}
      onClick={() => void b.copy()}
      className={cn(
        inverted && !b.copied && 'btn-gloss bg-background text-foreground hover:bg-background/90',
      )}
    >
      {b.copied ? <Check aria-hidden /> : <ClipboardCopy aria-hidden />}
      {b.copied ? 'Kopiert' : 'Kopieren'}
    </Button>
  );
}

function CopiedBadge({ b, inverted }: { b: Beurteilung; inverted?: boolean }) {
  if (!b.copiedOnce) return null;
  return (
    <Badge
      variant={inverted ? 'outline' : 'secondary'}
      className={cn(inverted && 'border-background/40 text-background')}
    >
      <Check aria-hidden />
      Kopiert
    </Badge>
  );
}

/** The letter body when there is no text yet. */
function EmptyBody({ session, canGenerate }: { session: Session; canGenerate: boolean }) {
  return (
    <div className="space-y-4">
      {canGenerate ? (
        <>
          <p className="max-w-[56ch] text-muted-foreground">
            Die Aufnahme ist erkannt, der Text wurde noch nicht erstellt.
          </p>
          <Button size="lg" onClick={() => void pipeline.process(session.id)}>
            <FilePlus2 aria-hidden />
            Text erstellen
          </Button>
        </>
      ) : (
        <p className="text-muted-foreground">Noch kein Text zu dieser Aufnahme.</p>
      )}
    </div>
  );
}

/* ── AKTUELL: framed panels with tinted header strips ─────────────────────── */
export function PanelsVariant(props: DiktatVariantProps) {
  const { session, transcription, result, canGenerate, running, onChanged } = props;
  const b = useBeurteilung(result);
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:gap-8">
      <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-5 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-semibold tracking-tight">Zusammenfassende Beurteilung</h2>
            <CopiedBadge b={b} />
          </div>
          {result ? <CopyButton b={b} /> : null}
        </header>
        {result ? (
          <>
            <BeurteilungText b={b} className="px-5 py-5 sm:px-6" />
            <footer className="border-t border-border px-2.5 py-1.5">
              <RegenerateControls session={session} result={result} running={running} onChanged={onChanged} />
            </footer>
          </>
        ) : (
          <div className="px-5 py-6 sm:px-6">
            <EmptyBody session={session} canGenerate={canGenerate} />
          </div>
        )}
      </section>

      <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card xl:sticky xl:top-8 xl:self-start">
        <header className="border-b border-border bg-muted/40 px-5 py-3.5 sm:px-6">
          <h2 className="text-lg font-semibold tracking-tight">Aufnahme</h2>
        </header>
        <SyncedPlayback
          sessionId={session.id}
          words={transcription?.words ?? []}
          fallbackText={transcription?.text ?? ''}
        />
      </section>
    </div>
  );
}

/* ── BLATT: the letter as a paper sheet — elevation instead of borders ────── */
export function BlattVariant(props: DiktatVariantProps) {
  const { session, transcription, result, canGenerate, running, onChanged } = props;
  const b = useBeurteilung(result);
  const paper =
    'rounded-lg bg-card shadow-[0_1px_2px_rgba(0,0,0,0.07),0_12px_32px_-12px_rgba(0,0,0,0.18)]';
  return (
    <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:gap-10">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-semibold tracking-tight">Zusammenfassende Beurteilung</h2>
            <CopiedBadge b={b} />
          </div>
          {result ? <CopyButton b={b} /> : null}
        </div>
        <div className={paper}>
          {result ? (
            <BeurteilungText b={b} className="rounded-lg px-6 py-6 sm:px-8 sm:py-7" />
          ) : (
            <div className="px-6 py-6 sm:px-8">
              <EmptyBody session={session} canGenerate={canGenerate} />
            </div>
          )}
        </div>
        {result ? (
          <RegenerateControls session={session} result={result} running={running} onChanged={onChanged} />
        ) : null}
      </div>

      <div className="min-w-0 space-y-4 xl:sticky xl:top-8 xl:self-start">
        <h2 className="text-lg font-semibold tracking-tight">Aufnahme</h2>
        <div className={cn(paper, 'overflow-hidden')}>
          <SyncedPlayback
            sessionId={session.id}
            words={transcription?.words ?? []}
            fallbackText={transcription?.text ?? ''}
          />
        </div>
      </div>
    </div>
  );
}

/* ── LEISTE: one command bar on top, quiet captioned columns below ────────── */
export function LeisteVariant(props: DiktatVariantProps) {
  const { session, transcription, result, canGenerate, running, onChanged } = props;
  const b = useBeurteilung(result);
  return (
    <div className="space-y-8">
      {result ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <CopyButton b={b} />
          <CopiedBadge b={b} />
          <div className="ms-auto">
            <RegenerateControls session={session} result={result} running={running} onChanged={onChanged} />
          </div>
        </div>
      ) : null}

      <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="min-w-0 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Zusammenfassende Beurteilung
          </h2>
          {result ? (
            <BeurteilungText b={b} className="rounded-lg" />
          ) : (
            <EmptyBody session={session} canGenerate={canGenerate} />
          )}
        </section>

        <section className="min-w-0 space-y-3 xl:sticky xl:top-8 xl:self-start">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Aufnahme
          </h2>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <SyncedPlayback
              sessionId={session.id}
              words={transcription?.words ?? []}
              fallbackText={transcription?.text ?? ''}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

/* ── KONTRAST: black header bands — sections you cannot miss ──────────────── */
export function KontrastVariant(props: DiktatVariantProps) {
  const { session, transcription, result, canGenerate, running, onChanged } = props;
  const b = useBeurteilung(result);
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:gap-8">
      <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 bg-foreground px-5 py-3 text-background sm:px-6">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-semibold tracking-tight">Zusammenfassende Beurteilung</h2>
            <CopiedBadge b={b} inverted />
          </div>
          {result ? <CopyButton b={b} inverted /> : null}
        </header>
        {result ? (
          <>
            <BeurteilungText b={b} className="px-5 py-5 sm:px-6" />
            <footer className="border-t border-border px-2.5 py-1.5">
              <RegenerateControls session={session} result={result} running={running} onChanged={onChanged} />
            </footer>
          </>
        ) : (
          <div className="px-5 py-6 sm:px-6">
            <EmptyBody session={session} canGenerate={canGenerate} />
          </div>
        )}
      </section>

      <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card xl:sticky xl:top-8 xl:self-start">
        <header className="bg-foreground px-5 py-3 text-background sm:px-6">
          <h2 className="text-lg font-semibold tracking-tight">Aufnahme</h2>
        </header>
        <SyncedPlayback
          sessionId={session.id}
          words={transcription?.words ?? []}
          fallbackText={transcription?.text ?? ''}
        />
      </section>
    </div>
  );
}
