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
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg font-semibold tracking-tight">
            {SECTION_LABELS[section] ?? section}
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
        aria-label={SECTION_LABELS[section] ?? section}
        placeholder="Hier wurde nichts eingetragen — Sie können selbst ergänzen."
        // Styled as a letter sheet, not a form field: the border only announces
        // itself on hover/focus, the padding is a page margin, and the leading
        // is reading rhythm. field-sizing:content still grows it with the text.
        className={cn(
          'min-h-32 rounded-xl border-transparent bg-card px-6 py-5 text-base leading-[1.85] shadow-none',
          'transition-colors hover:border-border focus-visible:border-border',
          columnar && !empty && 'font-mono text-[0.95rem] leading-[1.9] [tab-size:18]',
        )}
      />
    </section>
  );
}
