import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { BULLET_SECTIONS, bulletsToHtml, bulletsToPlain } from '@/lib/format';
import type { Result } from '@/lib/db';
import { saveSection } from '@/lib/generate';

const AUTOSAVE_MS = 800;

/**
 * Everything the Beurteilung text DOES — debounced autosave, the rich copy
 * (text/html so Word pastes real bullets), the copied feedback, and the
 * read/edit switch — with no opinion about presentation. The page variants
 * all sit on this one hook, so switching looks never changes behaviour.
 */
export function useBeurteilung(result: Result | null) {
  const initialText = result?.sections.beurteilung ?? '';
  const [text, setText] = useState(initialText);
  const [editing, setEditing] = useState(false);
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
    setEditing(false);
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

  /** Leaving the editor: flush the pending save, return to the read view. */
  const finishEditing = useCallback(() => {
    setEditing(false);
    if (!result) return;
    if (timer.current) clearTimeout(timer.current);
    void saveSection(result.id, 'beurteilung', text);
  }, [result, text]);

  const copy = useCallback(async () => {
    if (!result) return;
    if (timer.current) clearTimeout(timer.current);
    await saveSection(result.id, 'beurteilung', text);
    try {
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
      setEditing(true);
      setTimeout(() => areaRef.current?.select(), 50);
      toast.error('Kopieren war nicht möglich. Der Text ist markiert — bitte Strg+C drücken.');
      return;
    }
    setCopied(true);
    setCopiedOnce(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2200);
  }, [result, text]);

  return { text, update, editing, setEditing, finishEditing, copy, copied, copiedOnce, areaRef };
}

export type Beurteilung = ReturnType<typeof useBeurteilung>;
