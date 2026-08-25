import { Toaster } from '@/components/ui/sonner';
import { DesignSwitcher } from '@/layouts/DesignSwitcher';
import { StandardLayout } from '@/layouts/StandardLayout';

/**
 * The shell is settled: the sidebar layout won the layout evaluation and the
 * six alternatives are deleted (git has them). What is still being chosen is
 * the design of the finished-Diktat page — the floating switcher below flips
 * between those candidates and disappears once one wins.
 */
export default function App() {
  return (
    <>
      <StandardLayout />
      <DesignSwitcher />
      <Toaster position="bottom-right" />
    </>
  );
}
