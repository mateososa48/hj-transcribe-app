import { useEffect, useRef, useState } from 'react';

import { bulletsToHtml } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Beurteilung } from './useBeurteilung';

/**
 * The Beurteilung as one surface that is ALWAYS the finished letter: a real
 * bulleted list — proper discs, hanging indents — that he can click into and
 * edit in place. No mode switch, no formatting jump: the list stays a list
 * while the caret is in it. What is rendered is bulletsToHtml, the exact
 * HTML the copy button puts on the clipboard — screen and Word paste can
 * never disagree.
 *
 * The element is uncontrolled while focused (rewriting innerHTML would throw
 * the caret); every input is serialized back to the stored "• " line format,
 * and on blur the markup is re-rendered clean.
 */
export function BeurteilungText({ b, className }: { b: Beurteilung; className?: string }) {
  const [focused, setFocused] = useState(false);
  const focusedRef = useRef(false);

  // Paint from state only while NOT being edited.
  useEffect(() => {
    const el = b.areaRef.current;
    if (!el || focusedRef.current) return;
    el.innerHTML = b.text.trim() ? bulletsToHtml(b.text) : '';
  }, [b.text, b.areaRef, focused]);

  return (
    <div
      ref={b.areaRef}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label="Zusammenfassende Beurteilung"
      data-placeholder="Hier wurde nichts eingetragen — klicken Sie, um selbst zu ergänzen."
      spellCheck={false}
      onFocus={() => {
        focusedRef.current = true;
        setFocused(true);
      }}
      onBlur={() => {
        focusedRef.current = false;
        setFocused(false);
        b.flushSave();
      }}
      onInput={(e) => b.update(serializeEditable(e.currentTarget))}
      onPaste={(e) => {
        // Pasted content enters as plain text — outside markup must never
        // smuggle formatting into the letter.
        e.preventDefault();
        const plain = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, plain);
      }}
      className={cn(
        'beurteilung-list min-h-40 cursor-text text-base leading-[1.85] outline-none transition-colors',
        'hover:bg-muted/30 focus:bg-muted/20',
        'empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]',
        className,
      )}
    />
  );
}

/**
 * DOM -> the stored line format ("• " items, two-space indent for nested,
 * bare lines for prose). The inverse of bulletsToHtml, tolerant of whatever
 * structure the browser's editing produces.
 */
function serializeEditable(root: HTMLElement): string {
  const lines: string[] = [];

  const pushItem = (li: Element, depth: number) => {
    const clone = li.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('ul, ol').forEach((nested) => nested.remove());
    const text = (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (text) lines.push(`${'  '.repeat(depth)}• ${text}`);
    li.querySelectorAll(':scope > ul > li, :scope > ol > li').forEach((child) =>
      pushItem(child, depth + 1),
    );
  };

  root.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (text) lines.push(text);
      return;
    }
    if (!(node instanceof Element)) return;
    if (node.tagName === 'UL' || node.tagName === 'OL') {
      node.querySelectorAll(':scope > li').forEach((li) => pushItem(li, 0));
    } else {
      const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (text) lines.push(text);
    }
  });

  return lines.join('\n');
}
