import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ClipboardCopy } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { extractFehltMarkers } from '../../../prompts/beurteilung.ts';
import { SECTION_LABELS } from '@/lib/db';
import { saveSection } from '@/lib/generate';

const AUTOSAVE_MS = 800;

/**
 * One block of his letter: read it, fix it, copy it.
 *
 * Copy is per section on purpose — the three blocks go to three different
 * places in his Word template, and one Copy button for all of them would just
 * move the splitting work back onto him.
 */
export function SectionCard({
  resultId,
  section,
  initialText,
}: {
  resultId: string;
  section: string;
  initialText: string;
}) {
  /**
   * The medication list is two tab-separated columns. The tab is what makes it
   * land on his Word tab stop correctly — but in a proportional face the
   * columns come out ragged on screen, which reads as sloppy even though the
   * paste is right. A monospace stack plus a wide tab-size aligns what he sees
   * without changing a byte of what he copies.
   */
  const columnar = section === 'medikation';
  const [text, setText] = useState(initialText);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => setText(initialText), [initialText]);

  /**
   * Debounced autosave. He reads and corrects slowly; losing four minutes of
   * edits to a stray reload once would end adoption, so the working copy is
   * written continuously rather than on an explicit save.
   */
  const scheduleSave = useCallback(
    (next: string) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void saveSection(resultId, section, next), AUTOSAVE_MS);
    },
    [resultId, section],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );

  const markers = extractFehltMarkers(text);

  async function handleCopy() {
    // Flush pending keystrokes so what he copies is what he sees.
    if (timer.current) clearTimeout(timer.current);
    await saveSection(resultId, section, text);

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // The Clipboard API is refused often enough to plan for — an older Edge,
      // a hardened policy, a page that lost user activation. Selecting the text
      // leaves him one keystroke from the same result instead of a dead button.
      areaRef.current?.select();
      toast.error('Kopieren war nicht möglich. Der Text ist markiert — bitte Strg+C drücken.');
      return;
    }

    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2200);

    // Not a gate — the markers are visible in the text he is looking at. But
    // pasting "[FEHLT: …]" into a patient's letter is worth one sentence.
    if (markers.length > 0) {
      toast.warning(
        `Kopiert. Achtung: ${markers.length} Markierung${markers.length === 1 ? '' : 'en'} noch im Text.`,
      );
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">
          {SECTION_LABELS[section] ?? section}
        </h2>
        <Button size="lg" variant={copied ? 'secondary' : 'default'} onClick={() => void handleCopy()}>
          {copied ? <Check aria-hidden /> : <ClipboardCopy aria-hidden />}
          {copied ? 'Kopiert' : 'Kopieren'}
        </Button>
      </div>

      <Textarea
        ref={areaRef}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          scheduleSave(e.target.value);
        }}
        aria-label={SECTION_LABELS[section] ?? section}
        // The base textarea sets field-sizing:content, so it grows with the
        // text; a tall min-height would leave a large empty box under a
        // two-line section.
        className={cn(
          'min-h-32 text-base leading-relaxed',
          columnar && 'font-mono text-[0.95rem] [tab-size:18]',
        )}
      />
    </section>
  );
}
