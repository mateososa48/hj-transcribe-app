/**
 * SYNTHETIC few-shot examples for development.
 *
 * SPEC constraint 7: dev uses synthetic data only. Every name, date and value
 * here is invented. These exist so the pipeline runs and the eval is
 * reproducible for anyone who clones the repo.
 *
 * THEY ARE NOT A SUBSTITUTE FOR THE REAL THING. The entire premise of the
 * product is that the draft sounds like HJ, and these were written by a model,
 * not by him. Two anonymised real letters go in `prompts/examples/real/`
 * (git-ignored) and are loaded in preference to these — see `loadExamples()`.
 * Until that happens, treat every judgement about "his voice" as unfounded.
 */

export interface BeurteilungExample {
  /** What the doctor said, roughly as ASR would return it. */
  transkript: string;
  /** The Beurteilung he would have written from it. */
  beurteilung: string;
}

export const DEV_BEURTEILUNG_EXAMPLES: BeurteilungExample[] = [
  {
    transkript: `Also der Patient kommt zur Verlaufskontrolle nach dem Hinterwandinfarkt
im Februar. Beschwerdefrei mittlerweile, keine Angina pectoris, keine Luftnot.
Belastbar bis etwa hundert Watt in der Ergometrie ohne Ischämiezeichen. Die
Ejektionsfraktion hat sich erholt auf fünfundfünfzig Prozent, vorher waren es
achtundvierzig. Medikation unverändert weiter, ASS und Ticagrelor bis Februar
zweitausendsechsundzwanzig. Nächste Kontrolle in sechs Monaten.`,
    // Cadence modelled on his own letters: "Bezüglich ..." to open, subjunctive
    // recommendations in the first person, pluperfect for what already happened.
    beurteilung: `- Bezüglich der koronaren Herzkrankheit war im Februar bei Nachweis eines
  Hinterwandinfarktes eine Revaskularisation erfolgt. Der Patient ist
  zwischenzeitlich beschwerdefrei; eine Angina pectoris und eine
  Belastungsdyspnoe werden verneint.
- Die hier durchgeführte Ergometrie war bis 100 Watt ohne Ischämiezeichen
  unauffällig.
- Echokardiographisch hat sich die linksventrikuläre Funktion erholt, die LVEF
  liegt aktuell bei 55 % gegenüber 48 % in der Voruntersuchung.
- Die ASS-Therapie sollte auf Dauer, die Ticagrelor-Therapie bis 2/26 erfolgen.
  In diesem Zeitraum empfiehlt sich auch eine PPI-Therapie.
- Sicherheitshalber würde ich eine Wiedervorstellung mit erneutem Belastungstest
  in 6 Monaten empfehlen.`,
  },
  {
    transkript: `Die Patientin stellt sich vor wegen zunehmender Luftnot. NYHA zwei bis
drei mittlerweile. Beinödeme beidseits. Die Ejektionsfraktion ist auf dreißig
Prozent reduziert. Wir haben Torasemid auf zwanzig Milligramm erhöht und
Sacubitril Valsartan neu angesetzt, neunundvierzig zu einundfünfzig Milligramm
zweimal täglich. Gewicht bitte täglich kontrollieren. Kaliumkontrolle in einer
Woche. Ein aktuelles Labor liegt mir heute nicht vor.`,
    beurteilung: `- Bezüglich der Herzinsuffizienz berichtet die Patientin über eine zunehmende
  Belastungsdyspnoe, aktuell im Stadium NYHA II-III. Klinisch bestehen
  beidseitige Beinödeme.
- Echokardiographisch hatte sich eine hochgradig eingeschränkte
  linksventrikuläre Funktion mit einer LVEF von 30 % gezeigt.
- Die Therapie wurde entsprechend angepasst: Torasemid wurde auf 20 erhöht,
  Sacubitril/Valsartan 49/51 zweimal täglich neu angesetzt. Diesbezüglich
  sollte eine Kaliumkontrolle in einer Woche erfolgen.
- Ich habe die Patientin gebeten, das Gewicht täglich zu kontrollieren und sich
  bei einer Zunahme von mehr als zwei Kilogramm umgehend vorzustellen.
- [FEHLT: aktuelle Laborwerte lagen bei der Vorstellung nicht vor]`,
  },
];

/**
 * Real letters, when Mateo has added them. Loaded via a glob so the file simply
 * not existing is the normal case rather than a build error.
 */
export async function loadRealExamples(): Promise<BeurteilungExample[]> {
  // import.meta.glob is a Vite build-time transform. Under Node (the eval
  // harness) it does not exist, so guard rather than throw — the harness should
  // fall back to the dev examples, not crash.
  if (typeof import.meta.glob !== 'function') return [];

  const modules = import.meta.glob('../real/*.ts', { eager: true }) as Record<
    string,
    { default?: BeurteilungExample[] }
  >;
  return Object.values(modules).flatMap((m) => m.default ?? []);
}

/**
 * Real examples win when present. Falling back silently would be worse than
 * useless — it would let a synthetic-voiced draft look like a tuned one — so
 * the caller is told which set it got.
 */
export async function loadExamples(): Promise<{
  examples: BeurteilungExample[];
  source: 'real' | 'dev';
}> {
  const real = await loadRealExamples();
  return real.length > 0
    ? { examples: real, source: 'real' }
    : { examples: DEV_BEURTEILUNG_EXAMPLES, source: 'dev' };
}
