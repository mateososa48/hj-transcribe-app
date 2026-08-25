import { Toaster } from '@/components/ui/sonner';
import { StandardLayout } from '@/layouts/StandardLayout';

/**
 * The shell and the Diktat page are both settled now: the sidebar layout and
 * the two-panel Diktat arrangement won their evaluations, and the losing
 * candidates plus the switcher are deleted — git history has all of them.
 */
export default function App() {
  return (
    <>
      <StandardLayout />
      <Toaster position="bottom-right" />
    </>
  );
}
