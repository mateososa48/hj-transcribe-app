import type { Fixture } from './types.ts';

/**
 * Five synthetic cases. All names, dates and values invented.
 *
 * Each is written the way a cardiologist actually dictates: continuous prose,
 * spoken numbers, no punctuation commands (SPEC: spoken punctuation must be
 * TOLERATED, never REQUIRED — so most fixtures omit it, and case 3 includes it
 * to prove it is tolerated).
 */
export const FIXTURES: Fixture[] = [
  {
    id: '01-khk-nstemi',
    title: 'KHK, Z.n. NSTEMI mit PCI der RIVA — Verlaufskontrolle',
    voice: 'Anna',
    rant: `Der Patient stellte sich zur Verlaufskontrolle nach Myokardinfarkt vor.
Seit dem Ereignis im März zweitausendfünfundzwanzig berichtet er über eine
deutliche Besserung der Belastbarkeit. Aktuell bestehen keine Angina pectoris
und keine Dyspnoe in Ruhe. Unter Belastung gibt er eine leichte Luftnot ab etwa
zweihundert Metern an, entsprechend NYHA zwei. Es besteht Zustand nach NSTEMI
mit Implantation eines medikamentenfreisetzenden Stents in die RIVA. Die duale
Thrombozytenaggregationshemmung mit Acetylsalicylsäure einhundert Milligramm
und Ticagrelor neunzig Milligramm zweimal täglich führen wir bis März
zweitausendsechsundzwanzig fort. Zusätzlich erhält der Patient Bisoprolol fünf
Milligramm eins null null sowie Atorvastatin achtzig Milligramm null null eins.
Es zeigten sich keine Blutungskomplikationen. Die Medikation wird unverändert
fortgeführt.`,
    messwerte: `Echokardiographie. LVEF fünfundfünfzig Prozent. LVEDD
zweiundfünfzig Millimeter. Septumdicke elf Millimeter. Keine relevante
Mitralklappeninsuffizienz. LDL-Cholesterin einundfünfzig Milligramm pro
Deziliter. Blutdruck einhundertachtundzwanzig zu achtundsiebzig. Herzfrequenz
achtundfünfzig pro Minute.`,
    vorbrief: `Diagnosen:
- Koronare Eindgefäßerkrankung
- Z.n. NSTEMI 03/25, PCI mit DES der RIVA
- Arterielle Hypertonie
Aktuelle Therapie: ASS 100 mg 1-0-0, Ticagrelor 90 mg 1-0-1,
Bisoprolol 2,5 mg 1-0-0, Atorvastatin 40 mg 0-0-1`,
    deliberateOmissions: ['Geburtsdatum des Patienten', 'Name des überweisenden Kollegen'],
    rantTraps: [
      { kind: 'negation', severity: 'safety', label: 'keine Angina pectoris', accept: ['keine Angina pectoris'] },
      { kind: 'negation', severity: 'safety', label: 'keine Dyspnoe', accept: ['keine Dyspnoe'] },
      { kind: 'negation', severity: 'safety', label: 'keine Blutungskomplikationen', accept: ['keine Blutungskomplikationen'] },
      { kind: 'drug', severity: 'safety', label: 'Acetylsalicylsäure 100 mg', accept: ['Acetylsalicylsäure einhundert Milligramm', 'ASS 100 mg'] },
      { kind: 'drug', severity: 'safety', label: 'Ticagrelor 90 mg', accept: ['Ticagrelor neunzig Milligramm'] },
      { kind: 'drug', severity: 'safety', label: 'Bisoprolol 5 mg', accept: ['Bisoprolol fünf Milligramm'] },
      { kind: 'drug', severity: 'safety', label: 'Atorvastatin 80 mg', accept: ['Atorvastatin achtzig Milligramm'] },
      { kind: 'dosing', severity: 'safety', label: 'Schema 1-0-0', accept: ['eins null null', '1-0-0', '1 0 0'] },
      { kind: 'dosing', severity: 'safety', label: 'Schema 0-0-1', accept: ['null null eins', '0-0-1', '0 0 1'] },
      { kind: 'number', severity: 'safety', label: 'Gehstrecke 200 m', accept: ['zweihundert Metern', '200 m', '200 Metern'] },
      { kind: 'term', severity: 'safety', label: 'NSTEMI', accept: ['NSTEMI'] },
      { kind: 'term', severity: 'safety', label: 'RIVA', accept: ['RIVA'] },
      { kind: 'term', severity: 'style', label: 'NYHA II', accept: ['NYHA zwei', 'NYHA II', 'NYHA 2'] },
      { kind: 'date', severity: 'style', label: 'März 2025', accept: ['März zweitausendfünfundzwanzig', 'März 2025', '03/25', '3/25'] },
      { kind: 'date', severity: 'style', label: 'März 2026', accept: ['März zweitausendsechsundzwanzig', 'März 2026', '03/26', '3/26'] },
    ],
    messwerteTraps: [
      { kind: 'number', severity: 'safety', label: 'LVEF 55 %', accept: ['LVEF fünfundfünfzig Prozent', 'LVEF 55 %'] },
      { kind: 'number', severity: 'safety', label: 'LVEDD 52 mm', accept: ['LVEDD zweiundfünfzig Millimeter', 'LVEDD 52 mm'] },
      { kind: 'number', severity: 'safety', label: 'Septum 11 mm', accept: ['elf Millimeter', '11 mm'] },
      { kind: 'number', severity: 'safety', label: 'LDL 51 mg/dl', accept: ['einundfünfzig Milligramm pro Deziliter', '51 mg/dl'] },
      { kind: 'number', severity: 'safety', label: 'RR 128/78', accept: ['einhundertachtundzwanzig zu achtundsiebzig', '128/78'] },
      { kind: 'number', severity: 'safety', label: 'HF 58/min', accept: ['achtundfünfzig pro Minute', '58/min'] },
      { kind: 'negation', severity: 'safety', label: 'keine relevante Mitralklappeninsuffizienz', accept: ['keine relevante Mitralklappeninsuffizienz'] },
    ],
  },

  {
    id: '02-herzinsuffizienz',
    title: 'Herzinsuffizienz mit reduzierter Ejektionsfraktion (HFrEF)',
    voice: 'Anna',
    rant: `Die Patientin kommt zur Kontrolle der bekannten Herzinsuffizienz.
Die Beschwerden haben sich unter der optimierten Medikation gebessert. Sie
berichtet über Luftnot beim Treppensteigen ab dem ersten Stock, entsprechend
NYHA zwei bis drei. Beinödeme bestehen nicht mehr. Es besteht keine Orthopnoe
und keine nächtliche Dyspnoe. Das Gewicht ist seit der letzten Vorstellung
stabil bei einundachtzig Kilogramm. Die Herzinsuffizienztherapie haben wir
weiter aufdosiert. Sie erhält nun Sacubitril Valsartan siebenundneunzig zu
einhundertdrei Milligramm zweimal täglich, Bisoprolol sieben Komma fünf
Milligramm eins null null, Spironolacton fünfundzwanzig Milligramm eins null
null und Empagliflozin zehn Milligramm eins null null. Torasemid haben wir auf
zehn Milligramm reduziert. Die Nierenwerte sind stabil, eine
Hyperkaliämie besteht nicht.`,
    messwerte: `Echokardiographie. LVEF zweiunddreißig Prozent. LVEDD
sechsundsechzig Millimeter. Linker Vorhof vier Komma acht Zentimeter.
Mittelgradige Mitralklappeninsuffizienz. Keine Aortenklappenstenose.
Systolischer Pulmonalarteriendruck achtunddreißig Millimeter
Quecksilbersäule. NT-proBNP achthundertvierzig.`,
    deliberateOmissions: ['Datum der letzten Vorstellung', 'Kreatininwert'],
    rantTraps: [
      { kind: 'negation', severity: 'safety', label: 'keine Orthopnoe', accept: ['keine Orthopnoe'] },
      { kind: 'negation', severity: 'safety', label: 'keine nächtliche Dyspnoe', accept: ['keine nächtliche Dyspnoe'] },
      { kind: 'negation', severity: 'safety', label: 'Beinödeme bestehen nicht mehr', accept: ['bestehen nicht mehr'] },
      { kind: 'negation', severity: 'safety', label: 'keine Hyperkaliämie', accept: ['Hyperkaliämie besteht nicht'] },
      { kind: 'drug', severity: 'safety', label: 'Sacubitril/Valsartan 97/103 mg', accept: ['siebenundneunzig zu einhundertdrei Milligramm', '97/103 mg'] },
      { kind: 'drug', severity: 'safety', label: 'Bisoprolol 7,5 mg', accept: ['Bisoprolol sieben Komma fünf Milligramm', 'Bisoprolol 7,5 mg'] },
      { kind: 'drug', severity: 'safety', label: 'Spironolacton 25 mg', accept: ['Spironolacton fünfundzwanzig Milligramm'] },
      { kind: 'drug', severity: 'safety', label: 'Empagliflozin 10 mg', accept: ['Empagliflozin zehn Milligramm'] },
      { kind: 'drug', severity: 'safety', label: 'Torasemid 10 mg', accept: ['Torasemid', 'zehn Milligramm reduziert'] },
      { kind: 'number', severity: 'safety', label: 'Gewicht 81 kg', accept: ['einundachtzig Kilogramm', '81 kg'] },
      { kind: 'term', severity: 'style', label: 'NYHA II-III', accept: ['NYHA zwei bis drei', 'NYHA II bis III', 'NYHA 2 bis 3'] },
    ],
    messwerteTraps: [
      { kind: 'number', severity: 'safety', label: 'LVEF 32 %', accept: ['LVEF zweiunddreißig Prozent', 'LVEF 32 %'] },
      { kind: 'number', severity: 'safety', label: 'LVEDD 66 mm', accept: ['sechsundsechzig Millimeter', '66 mm'] },
      { kind: 'number', severity: 'safety', label: 'LA 4,8 cm (Dezimalkomma)', accept: ['vier Komma acht Zentimeter', '4,8 cm'] },
      { kind: 'number', severity: 'safety', label: 'sPAP 38 mmHg', accept: ['achtunddreißig Millimeter Quecksilbersäule', '38 mmHg'] },
      { kind: 'number', severity: 'safety', label: 'NT-proBNP 840', accept: ['achthundertvierzig', '840'] },
      { kind: 'negation', severity: 'safety', label: 'keine Aortenklappenstenose', accept: ['keine Aortenklappenstenose'] },
    ],
  },

  {
    id: '03-vorhofflimmern',
    title: 'Vorhofflimmern nach Pulmonalvenenisolation (mit gesprochener Interpunktion)',
    voice: 'Anna',
    // Deliberately includes spoken punctuation: SPEC requires it be tolerated.
    rant: `Der Patient stellt sich drei Monate nach Pulmonalvenenisolation vor Komma
er ist beschwerdefrei Punkt neuer Absatz Seit dem Eingriff im Januar
zweitausendfünfundzwanzig sind keine Palpitationen mehr aufgetreten Punkt Der
Patient führt regelmäßig Selbstmessungen durch Komma dabei zeigte sich
durchgehend Sinusrhythmus Punkt Es besteht keine Belastungsdyspnoe Punkt neuer
Absatz Die orale Antikoagulation mit Apixaban fünf Milligramm zweimal täglich
setzen wir bei einem CHA2DS2-VASc-Score von drei unverändert fort Punkt
Metoprololsuccinat siebenundvierzig Komma fünf Milligramm eins null null
belassen wir ebenfalls Punkt Eine Blutungsanamnese ist unauffällig Punkt`,
    messwerte: `Langzeit-EKG über zweiundsiebzig Stunden. Durchgehend
Sinusrhythmus. Mittlere Herzfrequenz vierundsechzig pro Minute. Keine Pausen
über zwei Komma fünf Sekunden. Kein Vorhofflimmern dokumentiert. Echokardiographie.
LVEF sechzig Prozent. Linker Vorhof vier Komma zwei Zentimeter.`,
    deliberateOmissions: ['Name des zuweisenden Elektrophysiologen'],
    rantTraps: [
      { kind: 'negation', severity: 'safety', label: 'keine Palpitationen', accept: ['keine Palpitationen'] },
      { kind: 'negation', severity: 'safety', label: 'keine Belastungsdyspnoe', accept: ['keine Belastungsdyspnoe'] },
      { kind: 'drug', severity: 'safety', label: 'Apixaban 5 mg', accept: ['Apixaban fünf Milligramm'] },
      { kind: 'drug', severity: 'safety', label: 'Metoprololsuccinat 47,5 mg', accept: ['siebenundvierzig Komma fünf Milligramm', '47,5 mg'] },
      { kind: 'dosing', severity: 'safety', label: 'Schema 1-0-0', accept: ['eins null null', '1-0-0', '1 0 0'] },
      { kind: 'number', severity: 'safety', label: 'CHA2DS2-VASc 3', accept: ['Score von drei', 'Score von 3'] },
      { kind: 'term', severity: 'safety', label: 'Pulmonalvenenisolation', accept: ['Pulmonalvenenisolation'] },
      { kind: 'date', severity: 'style', label: 'Januar 2025', accept: ['Januar zweitausendfünfundzwanzig', 'Januar 2025', '01/25', '1/25'] },
    ],
    messwerteTraps: [
      { kind: 'number', severity: 'safety', label: 'LZ-EKG 72 h', accept: ['zweiundsiebzig Stunden', '72 Stunden', '72 h'] },
      { kind: 'number', severity: 'safety', label: 'mittlere HF 64/min', accept: ['vierundsechzig pro Minute', '64/min'] },
      { kind: 'number', severity: 'safety', label: 'Pausen 2,5 s', accept: ['zwei Komma fünf Sekunden', '2,5 Sekunden'] },
      { kind: 'number', severity: 'safety', label: 'LVEF 60 %', accept: ['LVEF sechzig Prozent', 'LVEF 60 %'] },
      { kind: 'number', severity: 'safety', label: 'LA 4,2 cm', accept: ['vier Komma zwei Zentimeter', '4,2 cm'] },
      { kind: 'negation', severity: 'safety', label: 'kein Vorhofflimmern dokumentiert', accept: ['Kein Vorhofflimmern'] },
    ],
  },

  {
    id: '04-aortenklappenstenose',
    title: 'Mittelgradige Aortenklappenstenose — Verlaufskontrolle',
    voice: 'Anna',
    rant: `Die Patientin kommt zur jährlichen Verlaufskontrolle der bekannten
Aortenklappenstenose. Sie ist im Alltag uneingeschränkt belastbar und verneint
Synkopen. Es besteht keine Angina pectoris und keine Belastungsdyspnoe. Im
Vergleich zur Voruntersuchung zeigt sich eine leichte Progredienz des
Klappengradienten. Eine Operationsindikation besteht derzeit nicht. Wir haben
eine erneute Kontrolle in zwölf Monaten vereinbart. Die Medikation mit Ramipril
fünf Milligramm eins null null und Amlodipin fünf Milligramm null null eins
bleibt unverändert. Bei Auftreten von Synkopen, Angina pectoris oder Dyspnoe
soll sich die Patientin umgehend vorstellen.`,
    messwerte: `Echokardiographie. Aortenklappe mittelgradig stenosiert.
Maximaler Gradient achtundvierzig Millimeter Quecksilbersäule. Mittlerer
Gradient neunundzwanzig Millimeter Quecksilbersäule. Klappenöffnungsfläche
eins Komma eins Quadratzentimeter. LVEF sechsundsechzig Prozent. Septumdicke
dreizehn Millimeter. Keine Aortenklappeninsuffizienz.`,
    vorbrief: `Diagnosen:
- Mittelgradige Aortenklappenstenose, EOA 1,3 cm², dP max 41 mmHg (Vorbefund 05/24)
- Arterielle Hypertonie
Aktuelle Therapie: Ramipril 5 mg 1-0-0, Amlodipin 5 mg 0-0-1`,
    deliberateOmissions: ['Datum der Voruntersuchung im Diktat'],
    rantTraps: [
      { kind: 'negation', severity: 'safety', label: 'verneint Synkopen', accept: ['verneint Synkopen'] },
      { kind: 'negation', severity: 'safety', label: 'keine Angina pectoris', accept: ['keine Angina pectoris'] },
      { kind: 'negation', severity: 'safety', label: 'keine Belastungsdyspnoe', accept: ['keine Belastungsdyspnoe'] },
      { kind: 'negation', severity: 'safety', label: 'Operationsindikation besteht nicht', accept: ['besteht derzeit nicht'] },
      { kind: 'drug', severity: 'safety', label: 'Ramipril 5 mg', accept: ['Ramipril fünf Milligramm'] },
      { kind: 'drug', severity: 'safety', label: 'Amlodipin 5 mg', accept: ['Amlodipin fünf Milligramm'] },
      { kind: 'dosing', severity: 'safety', label: 'Schema 1-0-0', accept: ['eins null null', '1-0-0', '1 0 0'] },
      { kind: 'dosing', severity: 'safety', label: 'Schema 0-0-1', accept: ['null null eins', '0-0-1', '0 0 1'] },
      { kind: 'number', severity: 'style', label: 'Kontrolle in 12 Monaten', accept: ['zwölf Monaten', '12 Monaten'] },
    ],
    messwerteTraps: [
      { kind: 'number', severity: 'safety', label: 'dP max 48 mmHg', accept: ['achtundvierzig Millimeter Quecksilbersäule', '48 mmHg'] },
      { kind: 'number', severity: 'safety', label: 'dP mittel 29 mmHg', accept: ['neunundzwanzig Millimeter Quecksilbersäule', '29 mmHg'] },
      { kind: 'number', severity: 'safety', label: 'KÖF 1,1 cm²', accept: ['eins Komma eins Quadratzentimeter', '1,1 cm²'] },
      { kind: 'number', severity: 'safety', label: 'LVEF 66 %', accept: ['LVEF sechsundsechzig Prozent', 'LVEF 66 %'] },
      { kind: 'number', severity: 'safety', label: 'Septum 13 mm', accept: ['dreizehn Millimeter', '13 mm'] },
      { kind: 'negation', severity: 'safety', label: 'keine Aortenklappeninsuffizienz', accept: ['Keine Aortenklappeninsuffizienz'] },
    ],
  },

  {
    id: '05-hypertonie-luecken',
    title: 'Arterielle Hypertonie — Kontrolle mit bewussten Informationslücken',
    voice: 'Anna',
    // Short and underspecified ON PURPOSE. The drafting stage must emit
    // [FEHLT: ...] for everything missing and must not invent a single value.
    rant: `Kurze Vorstellung zur Blutdruckkontrolle. Der Patient fühlt sich wohl
und berichtet über keine Beschwerden. Die häuslichen Messwerte seien gut
gewesen, genaue Zahlen liegen mir nicht vor. Keine Angina pectoris, keine
Dyspnoe. Wir belassen die Therapie mit Candesartan sechzehn Milligramm eins
null null. Eine Wiedervorstellung in sechs Monaten ist vereinbart.`,
    messwerte: `Blutdruck einhundertzweiunddreißig zu vierundachtzig.
Herzfrequenz zweiundsiebzig pro Minute.`,
    deliberateOmissions: [
      'Echokardiographie-Befund (nicht erhoben)',
      'LVEF (nicht erhoben)',
      'Häusliche Blutdruckwerte (Patient konnte keine nennen)',
      'Laborwerte (nicht erhoben)',
      'Geburtsdatum des Patienten',
      'Empfänger / überweisender Kollege',
    ],
    rantTraps: [
      { kind: 'negation', severity: 'safety', label: 'keine Beschwerden', accept: ['keine Beschwerden'] },
      { kind: 'negation', severity: 'safety', label: 'keine Angina pectoris', accept: ['Keine Angina pectoris'] },
      { kind: 'negation', severity: 'safety', label: 'keine Dyspnoe', accept: ['keine Dyspnoe'] },
      { kind: 'drug', severity: 'safety', label: 'Candesartan 16 mg', accept: ['Candesartan sechzehn Milligramm'] },
      { kind: 'dosing', severity: 'safety', label: 'Schema 1-0-0', accept: ['eins null null', '1-0-0', '1 0 0'] },
      { kind: 'number', severity: 'style', label: 'Wiedervorstellung 6 Monate', accept: ['sechs Monaten', '6 Monaten'] },
    ],
    messwerteTraps: [
      { kind: 'number', severity: 'safety', label: 'RR 132/84', accept: ['einhundertzweiunddreißig zu vierundachtzig', '132/84'] },
      { kind: 'number', severity: 'safety', label: 'HF 72/min', accept: ['zweiundsiebzig pro Minute', '72/min'] },
    ],
  },
];

export function getFixture(id: string): Fixture | undefined {
  return FIXTURES.find((f) => f.id === id);
}
