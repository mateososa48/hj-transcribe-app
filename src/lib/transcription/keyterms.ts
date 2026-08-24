/**
 * Words the recogniser is told to expect.
 *
 * AssemblyAI's `word_boost` raises the prior on these, which matters because
 * the terms that decide whether a letter is right — drug names, German
 * cardiology vocabulary — are exactly the ones a general German model has
 * barely seen. "Ticagrelor" and "Ejektionsfraktion" are not in ordinary speech.
 *
 * This replaced a user-managed glossary table. He was never going to maintain a
 * word list, and an empty one boosted nothing; a fixed list of what a
 * cardiologist actually says every day does the job without asking him for
 * anything. Add to it when a real recording gets something wrong.
 *
 * Kept well under AssemblyAI's boost limit, and deliberately not padded with
 * words the base model already gets right ("Herz", "Blutdruck").
 */

const DRUGS = [
  // Antiplatelet / anticoagulant
  'ASS', 'Clopidogrel', 'Ticagrelor', 'Prasugrel', 'Efient', 'Brilique',
  'Apixaban', 'Eliquis', 'Rivaroxaban', 'Xarelto', 'Edoxaban', 'Lixiana',
  'Dabigatran', 'Pradaxa', 'Marcumar', 'Phenprocoumon',
  // Beta blockers
  'Bisoprolol', 'Metoprolol', 'Nebivolol', 'Carvedilol',
  // RAAS
  'Ramipril', 'Enalapril', 'Lisinopril', 'Candesartan', 'Valsartan',
  'Olmesartan', 'Sevikar', 'Entresto', 'Sacubitril', 'Spironolacton',
  'Eplerenon', 'Torasemid', 'Furosemid', 'Hydrochlorothiazid',
  // Calcium antagonists / antianginal
  'Amlodipin', 'Lercanidipin', 'Molsidomin', 'Ivabradin', 'Ranolazin',
  // Lipids
  'Atorvastatin', 'Rosuvastatin', 'Simvastatin', 'Pravastatin', 'Ezetimib',
  'Nustendi', 'Bempedoinsäure', 'Inclisiran', 'Leqvio', 'Repatha', 'Praluent',
  // Diabetes / other
  'Metformin', 'Empagliflozin', 'Jardiance', 'Dapagliflozin', 'Forxiga',
  'Semaglutid', 'Ozempic', 'Pantoprazol', 'Amiodaron', 'Digitoxin',
  'Allopurinol', 'Levothyroxin', 'L-Thyroxin',
];

const TERMS = [
  // Diagnoses and events
  'Myokardinfarkt', 'Vorderwandinfarkt', 'Hinterwandinfarkt', 'NSTEMI', 'STEMI',
  'Angina pectoris', 'Koronare Herzkrankheit', 'Herzinsuffizienz',
  'Vorhofflimmern', 'Vorhofflattern', 'Sinusrhythmus', 'Sinusbradykardie',
  'Tachykardie', 'Extrasystolen', 'Synkope', 'Aortenklappenstenose',
  'Aortenklappeninsuffizienz', 'Mitralklappeninsuffizienz',
  'Trikuspidalklappeninsuffizienz', 'Aneurysma', 'Hypertonie',
  'Hypercholesterinämie', 'Hyperlipoproteinämie', 'Kardiomyopathie',
  'Perikarderguss', 'Lungenembolie', 'Pulmonale Hypertonie',
  // Procedures and devices
  'PTCA', 'Stentimplantation', 'Bifurkations-Stenting', 'Bypass-Operation',
  'Koronarangiographie', 'Herzkatheter', 'Ablation', 'Kardioversion',
  'Schrittmacher', 'Defibrillator', 'RIVA', 'LAD', 'RCA', 'RCX',
  'Ramus interventricularis anterior', 'Ramus circumflexus',
  // Investigations and measures
  'Echokardiographie', 'Ejektionsfraktion', 'LVEF', 'TAPSE', 'Ergometrie',
  'Belastungs-EKG', 'Langzeit-EKG', 'Szintigraphie', 'Myokardszintigraphie',
  'Regadenoson', 'Ischämie', 'Ischämienachweis', 'Erregungsrückbildungsstörung',
  'Vena cava', 'Septum', 'Perfusion', 'Auswurffraktion', 'proBNP', 'Troponin',
  'HbA1c', 'Kreatinin', 'LDL-Cholesterin',
  // Words that shape the letter
  'Zustand nach', 'Verdacht auf', 'beschwerdefrei', 'Belastungsdyspnoe',
  'Ödeme', 'Beinödeme', 'Palpitationen', 'Nikotinabusus', 'Dyspnoe',
  'Verlaufskontrolle', 'Erstvorstellung', 'Wiedervorstellung',
  // Everyday history words the recogniser gets wrong in ways that read as
  // clinical findings. "Blinddarm" came back as "Der Patient ist blind" in a
  // real test on 2026-08-23.
  'Blinddarm', 'Blinddarmoperation', 'Appendektomie', 'Gallenblase',
  'Cholezystektomie', 'Kaiserschnitt', 'Bandscheibe', 'Hüftoperation',
  'Knie-TEP', 'Schilddrüse', 'Schilddrüsenunterfunktion', 'Pollinosis',
  'Penicillin', 'Unverträglichkeit',
];

/**
 * Boosted terms for every transcription request.
 *
 * Multi-word entries are kept whole: the boost applies to the phrase, and
 * "Angina pectoris" is far more useful boosted together than apart.
 */
export const CARDIOLOGY_KEYTERMS: string[] = [...DRUGS, ...TERMS];
