import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { BrandWave } from '@/components/brand-wave';
import { Input } from '@/components/ui/input';
import { tryUnlock } from '@/lib/auth';
import { cn } from '@/lib/utils';

/**
 * The front door.
 *
 * Everything the app owns sits behind this one screen, so it borrows the
 * app's own identity rather than inventing a new one: the living wave mark,
 * the same type, the same black gloss key. One field, one action, nothing to
 * decide. A wrong password shakes the field once and selects the text so the
 * next attempt starts by typing, not by deleting.
 */
export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // Remounts the field wrapper so a second wrong attempt shakes again.
  const [attempt, setAttempt] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // The screen has exactly one thing to do, so the cursor starts there.
  // (autoFocus does not survive the Base UI input's mounting order.)
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (checking || leaving) return;
    // An empty submit is not an error, just an unfinished thought: the key
    // stays black (a grey door key reads as broken) and the field takes focus.
    if (!value) {
      inputRef.current?.focus();
      return;
    }
    setChecking(true);
    const ok = await tryUnlock(value);
    setChecking(false);
    if (!ok) {
      setError(true);
      setAttempt((n) => n + 1);
      inputRef.current?.select();
      return;
    }
    // Let the door swing before it disappears; reduced motion skips the swing
    // (motion-safe) and simply waits out the beat.
    setLeaving(true);
    window.setTimeout(onUnlock, 260);
  }

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex min-h-svh flex-col items-center justify-center bg-background px-6',
        leaving &&
          'motion-safe:animate-out motion-safe:fade-out motion-safe:zoom-out-[0.985] motion-safe:duration-300 motion-safe:ease-out motion-safe:fill-mode-forwards',
      )}
    >
      <div className="w-full max-w-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]">
        <div className="flex flex-col items-center text-center">
          <BrandWave className="-my-3 h-32 w-44" />
          <h1 className="mt-5 text-[1.75rem] font-semibold tracking-tight">Arzt-Assistent</h1>
          <p className="mt-1.5 text-muted-foreground">Bitte geben Sie das Kennwort ein.</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8">
          {/* Anchors password managers to an account name; never shown. */}
          <input type="text" name="username" autoComplete="username" value="arzt-assistent" readOnly hidden />
          <label htmlFor="lock-password" className="sr-only">
            Kennwort
          </label>
          <div key={attempt} className={cn(error && 'lock-shake')}>
            <div className="relative">
              <Input
                ref={inputRef}
                id="lock-password"
                type={show ? 'text' : 'password'}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError(false);
                }}
                autoFocus
                autoComplete="current-password"
                aria-invalid={error || undefined}
                placeholder="Kennwort"
                className="h-12 rounded-2xl bg-card ps-4 pe-12 text-base"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? 'Kennwort verbergen' : 'Kennwort anzeigen'}
                className="absolute inset-y-0 end-0 flex w-12 items-center justify-center rounded-e-2xl text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
              >
                {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
          </div>

          <div aria-live="polite" className="min-h-6 pt-2 text-center">
            {error ? (
              <p className="text-sm text-destructive">Falsches Kennwort. Bitte versuchen Sie es erneut.</p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={checking}
            className={cn(
              'btn-liquid-dark mt-2 flex h-12 w-full items-center justify-center rounded-full',
              'text-base font-medium text-white',
              'disabled:pointer-events-none disabled:opacity-55',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            )}
          >
            {checking ? 'Wird geprüft …' : 'Entsperren'}
          </button>
        </form>
      </div>

      <p className="absolute inset-x-6 bottom-8 text-center text-sm text-muted-foreground">
        Alle Daten bleiben auf diesem Computer — kein Server, kein Konto.
      </p>
    </div>
  );
}
