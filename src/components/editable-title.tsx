import { useRef } from 'react';
import { Pencil } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * A title he can rename, that says so.
 *
 * Every page here opens with a name he is free to change — click it and type —
 * and until now nothing on screen admitted that. A heading that looks exactly
 * like a heading IS a heading; there was no reason for him to try clicking one,
 * so every Diktat, Termin and Bericht kept the timestamp it was born with.
 *
 * The pencil is always visible rather than appearing on hover. An affordance he
 * has to discover by moving the mouse to the right place is one he never
 * discovers — the same reasoning that retired the hover-only "+" in the margin
 * of a Bericht.
 *
 * The field sizes to its own text, so the pencil sits just after the last
 * letter and reads as belonging to this title rather than floating at the end
 * of the row.
 */
export function EditableTitle({
  value,
  onChange,
  onCommit,
  label,
  className,
  inputClassName,
}: {
  value: string;
  onChange: (next: string) => void;
  /** Persist. Fires on blur and on Enter. */
  onCommit: () => void;
  /** What the field is, for the screen reader and the pencil's tooltip. */
  label: string;
  className?: string;
  inputClassName?: string;
}) {
  const ref = useRef<HTMLInputElement | null>(null);

  const edit = () => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    // Selected, so the first keystroke replaces a name he never chose.
    el.select();
  };

  return (
    <span className={cn('flex min-w-0 items-center gap-0.5', className)}>
      <Input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        aria-label={label}
        className={cn('w-auto max-w-full min-w-0 [field-sizing:content]', inputClassName)}
      />
      <button
        type="button"
        onClick={edit}
        aria-label={`${label} ändern`}
        title={`${label} ändern`}
        // 36px of ink, 44px of target.
        className="relative grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors after:absolute after:-inset-1 after:content-[''] hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Pencil className="size-4" aria-hidden />
      </button>
    </span>
  );
}
