import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ClipboardCopy } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { SECTION_LABELS } from '@/lib/db';
import { saveSection } from '@/lib/generate';
import { BULLET_SECTIONS, bulletsToHtml, bulletsToPlain } from '@/lib/format';

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
  label,
  initialText,
}: {
  resultId: string;
  section: string;
  /** The heading the model chose. Falls back to the old fixed labels. */
  label?: string;
  initialText: string;
}) {
  /**
   * The medication list is two tab-separated columns. The tab is what makes it
   * land on his Word tab stop correctly — but in a proportional face the
   * columns come out ragged on screen, which reads as sloppy even though the
   * paste is right. A monospace stack plus a wide tab-size aligns what he sees
   * without changing a byte of what he copies.
   */
  // Medication is two tab-separated columns wherever it lands — detected by
  // the tabs themselves now, since the section is no longer always called
  // "medikation".
  const columnar = section === 'medikation' || /\t/.test(initialText);
  const heading = label ?? SECTION_LABELS[section] ?? section;
  const [text, setText] = useState(initialText);
  const [copied, setCopied] = useState(false);
  /**
   * Stays on the heading until the text changes: he clicks Kopieren, turns to
   * Word, pastes, comes back — the 2-second button flip is long gone, and this
   * is what still tells him the section was already transferred.
   */
  const [copiedOnce, setCopiedOnce] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setText(initialText);
    setCopiedOnce(false);
  }, [initialText]);

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


  async function handleCopy() {
    // Flush pending keystrokes so what he copies is what he sees.
    if (timer.current) clearTimeout(timer.current);
    await saveSection(resultId, section, text);

    try {
      // Bullet sections go onto the clipboard as text/html too — that flavour
      // is what makes Word and Google Docs paste a REAL bulleted list instead
      // of literal dash characters. Everything else stays plain (the
      // medication tabs must survive byte-for-byte).
      if (BULLET_SECTIONS.has(section) && /^\s*[•-]\s/m.test(text)) {
        const html = bulletsToHtml(text);
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([bulletsToPlain(text)], { type: 'text/plain' }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      // The Clipboard API is refused often enough to plan for — an older Edge,
      // a hardened policy, a page that lost user activation. Selecting the text
      // leaves him one keystroke from the same result instead of a dead button.
      areaRef.current?.select();
      toast.error('Kopieren war nicht möglich. Der Text ist markiert — bitte Strg+C drücken.');
      return;
    }

    setCopied(true);
    setCopiedOnce(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2200);

  }

  const empty = !text.trim();

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg font-semibold tracking-tight">
            {heading}
          </h2>
          {copiedOnce ? (
            <Badge variant="secondary">
              <Check aria-hidden />
              Kopiert
            </Badge>
          ) : null}
        </div>
        {!empty ? (
          <Button size="lg" variant={copied ? 'secondary' : 'outline'} onClick={() => void handleCopy()}>
            {copied ? <Check aria-hidden /> : <ClipboardCopy aria-hidden />}
            {copied ? 'Kopiert' : 'Kopieren'}
          </Button>
        ) : null}
      </div>

      {/* Always editable — when the notes omitted something that WAS said, he
          must be able to write it in himself rather than being locked out. */}
      <Textarea
        ref={areaRef}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setCopiedOnce(false);
          scheduleSave(e.target.value);
        }}
        aria-label={heading}
        placeholder="Hier wurde nichts eingetragen — Sie können selbst ergänzen."
        // The section IS the box now — the card draws the border, so the field
        // inside it draws none. It used to be a borderless field on white that
        // only outlined itself under the cursor, which left the notes floating
        // in open space with nothing saying where one section ended.
        className={cn(
          'min-h-24 rounded-none border-0 bg-transparent px-5 py-4 text-base leading-[1.8] shadow-none',
          'focus-visible:ring-0 focus-visible:outline-none',
          columnar && !empty && 'font-mono text-[0.95rem] leading-[1.9] [tab-size:18]',
        )}
      />
    </section>
  );
}
