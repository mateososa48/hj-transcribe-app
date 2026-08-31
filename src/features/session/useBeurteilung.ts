import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { clipboardPayload } from '@/lib/format';
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
  const [copied, setCopied] = useState(false);
  /** Survives the 2-second button flip: he pastes in Word, comes back, and
   *  this is what still says the text was already transferred. */
  const [copiedOnce, setCopiedOnce] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const areaRef = useRef<HTMLDivElement | null>(null);

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

  /** Leaving the text: flush the pending save immediately. */
  const flushSave = useCallback(() => {
    if (!result) return;
    if (timer.current) clearTimeout(timer.current);
    void saveSection(result.id, 'beurteilung', text);
  }, [result, text]);

  const copy = useCallback(async () => {
    if (!result) return;
    if (timer.current) clearTimeout(timer.current);
    await saveSection(result.id, 'beurteilung', text);
    try {
      const payload = clipboardPayload(text);
      if (payload.html) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([payload.html], { type: 'text/html' }),
            'text/plain': new Blob([payload.plain], { type: 'text/plain' }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(payload.plain);
      }
    } catch {
      // Select the rendered text so one keystroke still finishes the job.
      const el = areaRef.current;
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      toast.error('Kopieren war nicht möglich. Der Text ist markiert — bitte Strg+C drücken.');
      return;
    }
    setCopied(true);
    setCopiedOnce(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2200);
  }, [result, text]);

  return { text, update, flushSave, copy, copied, copiedOnce, areaRef };
}

export type Beurteilung = ReturnType<typeof useBeurteilung>;
