import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ClipboardCopy, FilePlus2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { BULLET_SECTIONS, bulletsToHtml, bulletsToPlain } from '@/lib/format';
import type { Result, Session, Transcription } from '@/lib/db';
import { saveSection } from '@/lib/generate';
import { pipeline } from '@/lib/transcription/pipeline';
import { cn } from '@/lib/utils';
import type { ActiveProcessingPhase } from './processing-handoff-model';
import { ProcessingHandoff } from './ProcessingHandoff';
import { RegenerateControls } from './RegenerateControls';
import { SyncedPlayback } from './SyncedPlayback';

const AUTOSAVE_MS = 800;

/**
 * The finished Diktat page: two clearly framed panels — the Beurteilung on
 * the left as the star, the Aufnahme (player + follow-along) on the right as
 * evidence. While the pipeline runs, the page shows ONLY the handoff
 * animation; when the text arrives, the animation resolves into a check mark
 * that fades, and then the panels appear. He pressed one button and waited —
 * the page should read like an answer, not like a form assembling itself.
 */
export function DiktatContent({
  session,
  transcription,
  result,
  phase,
  failed,
  errorText,
  canGenerate,
  running,
  onChanged,
}: {
  session: Session;
  transcription: Transcription | null;
  result: Result | null;
  phase: ActiveProcessingPhase | null;
  failed: boolean;
  errorText: string;
  canGenerate: boolean;
  running: boolean;
  onChanged: () => void;
}) {
  /**
   * The arrival sequence. 'success' and 'closing' only ever happen when this
   * mounted page WATCHED the pipeline finish — reopening an old Diktat goes
   * straight to the panels, no ceremony.
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

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:gap-8">
        <BeurteilungPanel
          session={session}
          result={result}
          canGenerate={canGenerate}
          running={running}
          onChanged={onChanged}
        />

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
    </div>
  );
}

/**
 * The letter panel: a real, visibly framed section. The header names it and
 * carries the ONE action that matters — Kopieren, in the primary finish. The
 * body is the editable sheet; the footer holds the quieter regenerate tools.
 */
function BeurteilungPanel({
  session,
  result,
  canGenerate,
  running,
  onChanged,
}: {
  session: Session;
  result: Result | null;
  canGenerate: boolean;
  running: boolean;
  onChanged: () => void;
}) {
  const initialText = result?.sections.beurteilung ?? '';
  const [text, setText] = useState(initialText);
  const [copied, setCopied] = useState(false);
  /** Survives the 2-second button flip: he pastes in Word, comes back, and
   *  this is what still says the text was already transferred. */
  const [copiedOnce, setCopiedOnce] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setText(initialText);
    setCopiedOnce(false);
  }, [initialText]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );

  const update = useCallback(
    (next: string) => {
      if (!result) return;
      setText(next);
      setCopiedOnce(false);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(
        () => void saveSection(result.id, 'beurteilung', next),
        AUTOSAVE_MS,
      );
    },
    [result],
  );

  async function handleCopy() {
    if (!result) return;
    if (timer.current) clearTimeout(timer.current);
    await saveSection(result.id, 'beurteilung', text);
    try {
      // text/html alongside plain — that flavour is what makes Word and
      // Google Docs paste a REAL bulleted list instead of dash characters.
      if (BULLET_SECTIONS.has('beurteilung') && /^\s*[•-]\s/m.test(text)) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([bulletsToHtml(text)], { type: 'text/html' }),
            'text/plain': new Blob([bulletsToPlain(text)], { type: 'text/plain' }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      areaRef.current?.select();
      toast.error('Kopieren war nicht möglich. Der Text ist markiert — bitte Strg+C drücken.');
      return;
    }
    setCopied(true);
    setCopiedOnce(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2200);
  }

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-5 py-3.5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg font-semibold tracking-tight">Zusammenfassende Beurteilung</h2>
          {copiedOnce ? (
            <Badge variant="secondary">
              <Check aria-hidden />
              Kopiert
            </Badge>
          ) : null}
        </div>
        {result ? (
          <Button size="lg" variant={copied ? 'secondary' : 'default'} onClick={() => void handleCopy()}>
            {copied ? <Check aria-hidden /> : <ClipboardCopy aria-hidden />}
            {copied ? 'Kopiert' : 'Kopieren'}
          </Button>
        ) : null}
      </header>

      {result ? (
        <>
          <Textarea
            ref={areaRef}
            value={text}
            onChange={(e) => update(e.target.value)}
            aria-label="Zusammenfassende Beurteilung"
            placeholder="Hier wurde nichts eingetragen — Sie können selbst ergänzen."
            className="min-h-64 rounded-none border-transparent bg-transparent px-5 py-5 text-base leading-[1.85] shadow-none focus-visible:border-transparent focus-visible:ring-0 sm:px-6 md:text-base"
          />
          <footer className="border-t border-border px-2.5 py-1.5">
            <RegenerateControls
              session={session}
              result={result}
              running={running}
              onChanged={onChanged}
            />
          </footer>
        </>
      ) : (
        <div className="space-y-4 px-5 py-6 sm:px-6">
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
      )}
    </section>
  );
}
