/**
 * Synthetic eval fixtures.
 *
 * SPEC constraint 7: dev and testing use SYNTHETIC DATA ONLY. Every name,
 * date and value in these fixtures is invented. Real anonymised letters go in
 * prompts/examples/real/ and are git-ignored — never here.
 */

export type TrapKind =
  | 'negation' // "keine Angina pectoris" must not lose its "keine"
  | 'drug' // drug name + dose, unaltered
  | 'dosing' // 1-0-0 scheme
  | 'number' // measured value + unit
  | 'term' // Z.n., NYHA II, CCS, abbreviations
  | 'date'; // DD.MM.YYYY or M/YY

/**
 * `safety` traps are the ones that could change patient care if they fail: a
 * dropped negation, a wrong dose, a wrong measurement. These must be 100%.
 * `style` traps are formatting/house-style: they get a threshold, not a gate.
 */
export type TrapSeverity = 'safety' | 'style';

export interface Trap {
  kind: TrapKind;
  severity: TrapSeverity;
  /** Shown in the report. Keep short and specific. */
  label: string;
  /**
   * Any ONE of these surface forms counts as a pass, compared after German
   * normalisation. Put genuine wording alternatives here ("NYHA II" vs
   * "NYHA 2"); mechanical variation (number words, units, case) is already
   * handled by the normaliser.
   */
  accept: string[];
}

export interface Fixture {
  id: string;
  title: string;
  /** macOS `say` voice, varied across the set for acoustic diversity. */
  voice: string;
  /** Free-form dictation (SPEC feature A). Rendered to audio. */
  rant: string;
  /** Values read off the machine (SPEC feature B). Rendered to separate audio. */
  messwerte: string;
  /** Previous letter — pasted as text in the app, never spoken. */
  vorbrief?: string;
  /**
   * Facts a complete letter would need but which are absent from the source.
   * The drafting stage (P4) must render these as [FEHLT: ...] and never guess.
   * Not scored at the ASR stage.
   */
  deliberateOmissions?: string[];
  /** Traps applied to the RANT audio transcript. */
  rantTraps: Trap[];
  /** Traps applied to the MESSWERTE audio transcript. */
  messwerteTraps: Trap[];
}

/** Glossary passed to providers as keyterms — SPEC feature E. */
export const GLOSSARY: string[] = [
  // Drugs
  'Bisoprolol', 'Ramipril', 'Atorvastatin', 'Ticagrelor', 'Acetylsalicylsäure',
  'Apixaban', 'Torasemid', 'Spironolacton', 'Sacubitril', 'Valsartan',
  'Empagliflozin', 'Amlodipin', 'Pantoprazol', 'Metoprolol', 'Candesartan',
  // Cardiology terms
  'NSTEMI', 'STEMI', 'RIVA', 'RCA', 'RCX', 'LVEF', 'LVEDD', 'NYHA', 'CCS',
  'Pulmonalvenenisolation', 'Aortenklappenstenose', 'Ergometrie',
  'Echokardiographie', 'Vorhofflimmern', 'Herzinsuffizienz',
  // Referring doctors (synthetic)
  'Dr. Wegener', 'Dr. Brandt', 'Frau Dr. Hoffmann',
];
