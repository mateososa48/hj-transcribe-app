import type { DiktatDesignId } from '@/store/app-store';
import type { DiktatDesign } from '../design-context';
import { abschnitte } from './abschnitte';
import { karten } from './karten';
import { klappen } from './klappen';
import { mappen } from './mappen';
import { pruefen } from './pruefen';
import { reiter } from './reiter';
import { spalten } from './spalten';
import { tonzuerst } from './tonzuerst';

/**
 * The eight Diktat layout experiments — same design language as the shipped
 * page, different arrangements of title, text, player and transcript.
 * 'standard' is intentionally absent: it is the shipped rendering path in
 * SessionView — the branch simply never fires for it.
 */
export const DIKTAT_DESIGNS: Record<Exclude<DiktatDesignId, 'standard'>, DiktatDesign> = {
  spalten,
  reiter,
  mappen,
  abschnitte,
  karten,
  tonzuerst,
  klappen,
  pruefen,
};
