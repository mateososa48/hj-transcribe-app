import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { BULLET_SECTIONS, bulletsToHtml, bulletsToPlain } from '@/lib/format';
import { saveSection } from '@/lib/generate';

const AUTOSAVE_MS = 800;

/**
 * The Beurteilung text as behaviour: debounced autosave and the rich-clipboard
 * copy (text/html so Word pastes real bullets). Designs supply the frame.
 */
export function useDiktatText(resultId: string, initialText: string) {
  const [text, setText] = useState(initialText);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => setText(initialText), [initialText]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );

  const update = useCallback(
    (next: string) => {
      setText(next);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void saveSection(resultId, 'beurteilung', next), AUTOSAVE_MS);
    },
    [resultId],
  );

  const copy = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    await saveSection(resultId, 'beurteilung', text);
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
      areaRef.current?.select();
      toast.error('Kopieren war nicht möglich. Der Text ist markiert — bitte Strg+C drücken.');
      return;
    }
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2200);
  }, [resultId, text]);

  return { text, update, copy, copied, areaRef };
}
