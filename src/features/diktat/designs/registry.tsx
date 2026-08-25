import type { DiktatDesignId } from '@/store/app-store';
import type { DiktatDesign } from '../design-context';
import { akte } from './akte';
import { fenster } from './fenster';
import { fokus } from './fokus';
import { formular } from './formular';
import { glas } from './glas';
import { karteikarte } from './karteikarte';
import { manuskript } from './manuskript';
import { plakat } from './plakat';
import { studio } from './studio';
import { terminal } from './terminal';

/**
 * The ten finished-Diktat-page design experiments. 'standard' is intentionally
 * absent: it is not a component here but the shipped rendering path in
 * SessionView — the branch simply never fires for it.
 */
export const DIKTAT_DESIGNS: Record<Exclude<DiktatDesignId, 'standard'>, DiktatDesign> = {
  karteikarte,
  formular,
  fenster,
  studio,
  manuskript,
  terminal,
  akte,
  fokus,
  plakat,
  glas,
};
