import { Textarea } from '@/components/ui/textarea';
import { bulletsToHtml } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Beurteilung } from './useBeurteilung';

/**
 * The Beurteilung as he should see it: a REAL bulleted list — proper discs,
 * hanging indents, air between the points — not asterisk soup in a text box.
 * Clicking anywhere turns it into the editor; leaving saves and turns it
 * back. What is rendered here is bulletsToHtml, the exact HTML the copy
 * button puts on the clipboard — screen and Word paste can never disagree.
 */
export function BeurteilungText({
  b,
  className,
}: {
  b: Beurteilung;
  className?: string;
}) {
  if (b.editing) {
    return (
      <Textarea
        ref={b.areaRef}
        value={b.text}
        autoFocus
        onChange={(e) => b.update(e.target.value)}
        onBlur={b.finishEditing}
        aria-label="Zusammenfassende Beurteilung bearbeiten"
        placeholder="Hier wurde nichts eingetragen — Sie können selbst ergänzen."
        className={cn(
          'min-h-64 rounded-none border-transparent bg-muted/30 text-base leading-[1.85] shadow-none focus-visible:border-transparent focus-visible:ring-0 md:text-base',
          className,
        )}
      />
    );
  }

  const isBullets = /^\s*[•-]\s/m.test(b.text);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Text bearbeiten — klicken, um zu ändern"
      title="Klicken, um den Text zu bearbeiten"
      onClick={() => b.setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          b.setEditing(true);
        }
      }}
      className={cn(
        'min-h-40 cursor-text text-left text-base leading-[1.85] transition-colors',
        'hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none',
        className,
      )}
    >
      {!b.text.trim() ? (
        <p className="text-muted-foreground">
          Hier wurde nichts eingetragen — klicken Sie, um selbst zu ergänzen.
        </p>
      ) : isBullets ? (
        <div
          className="beurteilung-list"
          // Our own escaped HTML from bulletsToHtml — the same string the
          // clipboard receives.
          dangerouslySetInnerHTML={{ __html: bulletsToHtml(b.text) }}
        />
      ) : (
        <p className="whitespace-pre-wrap">{b.text}</p>
      )}
    </div>
  );
}
