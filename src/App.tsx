import type { FC } from 'react';

import { Toaster } from '@/components/ui/sonner';
import { BlattLayout } from '@/layouts/BlattLayout';
import { GalerieLayout } from '@/layouts/GalerieLayout';
import { LayoutSwitcher } from '@/layouts/LayoutSwitcher';
import { LeisteLayout } from '@/layouts/LeisteLayout';
import { PosteingangLayout } from '@/layouts/PosteingangLayout';
import { ProtokollLayout } from '@/layouts/ProtokollLayout';
import { StandardLayout } from '@/layouts/StandardLayout';
import { VergleichLayout } from '@/layouts/VergleichLayout';
import { useAppStore, type LayoutId } from '@/store/app-store';

/**
 * LAYOUT-EXPERIMENT PHASE. Seven arrangements of the same screens, switched
 * live via the floating pill (or ?layout=): the shipped 'standard' plus six
 * alternatives. Same data, same behaviour, different structure — that is the
 * whole point. Once one wins, the losers and the switcher are deleted
 * together; this indirection is scaffolding, not architecture.
 */
const LAYOUTS: Record<LayoutId, FC> = {
  standard: StandardLayout,
  leiste: LeisteLayout,
  posteingang: PosteingangLayout,
  galerie: GalerieLayout,
  blatt: BlattLayout,
  vergleich: VergleichLayout,
  protokoll: ProtokollLayout,
};

export default function App() {
  const layout = useAppStore((s) => s.layout);
  const Layout = LAYOUTS[layout] ?? StandardLayout;

  return (
    <>
      <Layout />
      <LayoutSwitcher />
      <Toaster position="bottom-right" />
    </>
  );
}
