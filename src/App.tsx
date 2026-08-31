import { useState } from 'react';

import { Toaster } from '@/components/ui/sonner';
import { LockScreen } from '@/features/auth/LockScreen';
import { isUnlocked } from '@/lib/auth';
import { StandardLayout } from '@/layouts/StandardLayout';

/**
 * The shell and the Diktat page are both settled now: the sidebar layout and
 * the two-panel Diktat arrangement won their evaluations, and the losing
 * candidates plus the switcher are deleted — git history has all of them.
 */
export default function App() {
  // The door: the deployed URL is public, so nothing of the app renders until
  // the password has been given once on this browser (src/lib/auth.ts).
  const [unlocked, setUnlocked] = useState(isUnlocked);

  if (!unlocked) return <LockScreen onUnlock={() => setUnlocked(true)} />;

  return (
    <>
      <StandardLayout />
      {/* Top right, opposite the dictation cards: those own the bottom-right
          corner now, and two stacks growing into the same corner would sooner
          or later cover each other. */}
      <Toaster position="top-right" />
    </>
  );
}
