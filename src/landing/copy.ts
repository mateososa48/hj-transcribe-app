/**
 * Every word on the landing page, in German and in English.
 *
 * The English is written, not translated: the letter is an English clinic
 * letter, the doses use English conventions, the templates are the reports
 * an English-speaking practice writes. Anything that is not text (camera
 * positions, timings, hues) stays in the components.
 *
 * House rules for the writing, both languages: plain sentences with verbs;
 * say the specific thing; no "not X but Y" constructions, no lists of three
 * for rhythm, no fragment pairs as headlines, no colon summaries. The page
 * should read like a careful colleague wrote it.
 */

export type Lang = 'de' | 'en';

export type Kind = 'term' | 'value' | 'dose' | 'gap';

const de = {
  meta: {
    title: 'Arzt-Assistent · Sie sprechen. Der Brief schreibt sich.',
    description:
      'Arzt-Assistent nimmt Diktate und Sprechstunden auf und schreibt daraus den Arztbrief in Ihrem Stil, als Word-Datei. Alle Daten bleiben auf Ihrem Rechner.',
  },
  nav: {
    tools: 'Die Werkzeuge',
    templates: 'Vorlagen',
    cta: 'Früher Zugang',
    toTop: 'Arzt-Assistent, zum Seitenanfang',
    sections: 'Abschnitte',
    language: 'Sprache',
  },
  hero: {
    lines: [
      ['Sie', 'sprechen.'],
      ['Der', 'Brief', 'schreibt', 'sich.'],
    ],
    sub: 'Sie diktieren oder lassen die Sprechstunde mitlaufen. Daraus schreibt der Assistent den Arztbrief in Ihrem Stil und exportiert ihn als Word-Datei. Alles bleibt auf Ihrem Rechner.',
    primary: 'Früher Zugang',
    secondary: 'Die Werkzeuge',
  },
  demo: {
    spoken: 'Aktuelle Therapie: ASS hundert eins null null, Clopidogrel fünfundsiebzig eins null null bis Mai sechsundzwanzig.',
    letterLines: ['ASS 100   1-0-0', 'Clopidogrel 75  1-0-0 bis 5/26'],
    heading: 'Aktuelle Therapie',
    done: 'Fertig',
    busy: 'Wird eingefügt …',
    filed: 'In „Aktuelle Therapie" eingefügt',
    letter: {
      to: ['An', 'Dres. med. Weber / Kaufmann', 'Rheinallee 12, 55118 Mainz'],
      date: 'Mainz, 31.08.2026',
      salutation: 'Sehr geehrte Frau Kollegin, sehr geehrter Herr Kollege,',
      intro: 'ich darf nachfolgend über die letzten Untersuchungen, Herrn Vollmer betreffend, zusammenfassend berichten.',
      diagnosesHeading: 'Diagnosen',
      diagnoses: ['1. Koronare Herzkrankheit, Z. n. PCI/Stent RIVA 03/2026', '2. Arterielle Hypertonie'],
      summaryHeading: 'Zusammenfassende Beurteilung',
      summary: [
        'Herr Vollmer stellte sich zur Verlaufskontrolle vor. Unter Belastung keine Angina pectoris; die Belastbarkeit ist gut.',
        'Im EKG bestand ein normaler Sinusrhythmus. Echokardiographisch zeigte sich eine gute globale und regionale linksventrikuläre Funktion.',
      ],
    },
  },
  tools: {
    title: 'Was Sie sagen, landet im Brief.',
    titleRest: 'Als Diktat, aus der Sprechstunde oder Abschnitt für Abschnitt im Berichtseditor.',
    chapters: {
      diktat: {
        tool: 'Diktat',
        title: 'Aus dem Diktat wird die Beurteilung.',
        body: 'Sie erzählen den Fall so, wie Sie ihn einer Kollegin erzählen würden. Der Assistent schreibt daraus die Zusammenfassende Beurteilung in ganzen Sätzen und behält Ihre Reihenfolge und Ihre Formulierungen bei.',
        alt: 'Ein Diktat, als fertige Zusammenfassende Beurteilung formuliert',
        callouts: ['Aus 20 Sekunden Diktat', 'Nachdiktieren, wenn noch etwas fehlt'],
      },
      termin: {
        tool: 'Sprechstunde',
        title: 'Das Gespräch wird mitgeschrieben.',
        body: 'Die Aufnahme läuft, während Sie mit dem Patienten sprechen. Danach liegt das Transkript nach Arzt und Patient getrennt vor, dazu Notizen in Abschnitten. Ein Klick auf ein Wort spielt die Stelle ab.',
        alt: 'Ein Sprechstunden-Transkript, nach Arzt und Patient getrennt',
        callouts: ['Nach Arzt und Patient getrennt', 'Ein Klick auf ein Wort spielt die Stelle ab'],
      },
      bericht: {
        tool: 'Bericht',
        title: 'Der Bericht, Abschnitt für Abschnitt diktiert.',
        body: 'Der Editor zeigt eine A4-Seite mit den Abschnitten Ihrer Vorlage. Jeden Abschnitt diktieren Sie einzeln. Am Ende exportieren Sie eine Word-Datei mit richtigen Überschriften und Tabstopps.',
        alt: 'Der Berichtseditor: eine A4-Seite mit diktierbaren Abschnitten',
        callouts: ['Jeder Abschnitt einzeln diktiert', '1:14 min Diktat, als Abschnitt eingefügt'],
      },
    },
  },
  accuracy: {
    title: 'Fachbegriffe, Werte und Dosierungen kommen richtig im Brief an.',
    body: 'Der Assistent ist auf die Sprache der kardiologischen Praxis eingestellt. Was Sie sagen, schreibt er in der Form, in der es im Arztbrief steht. Ein paar Beispiele:',
    examples: 'Beispiele',
    stage: (said: string, written: string) => `Gesagt: ${said}. Im Brief: ${written}.`,
    kinds: { term: 'Fachbegriff', value: 'Messwert', dose: 'Dosierung', gap: 'Nicht genannt' } as Record<Kind, string>,
    entries: [
      { said: 'P C I Stent R I V A', written: 'PCI/Stent RIVA', kind: 'term', note: 'Eingriff und Gefäß, abgekürzt wie im Katheterbericht.' },
      { said: 'L V E F achtundfünfzig Prozent', written: 'LVEF 58 %', kind: 'value', note: 'Ein Messwert, mit Prozentzeichen und dem Leerzeichen davor.' },
      { said: 'Trikuspidalklappeninsuffizienz Grad eins', written: 'Trikuspidalklappeninsuffizienz Grad 1', kind: 'term', note: 'Das zusammengesetzte Wort bleibt ganz, der Grad wird eine Ziffer.' },
      { said: 'N T pro B N P', written: 'NT-proBNP', kind: 'term', note: 'Buchstabiert gesagt und als der Laborwert geschrieben, der gemeint ist.' },
      { said: 'einhundertfünfundvierzig zu neunzig', written: '145/90 mmHg', kind: 'value', note: 'Der Blutdruck bekommt seine Einheit.' },
      { said: 'Bisoprolol zwei komma fünf, eins null null', written: 'Bisoprolol 2,5   1-0-0', kind: 'dose', note: 'Wirkstoff und Stärke vorn, das Einnahmeschema auf dem Tabulator.' },
      { said: 'Apixaban weiter wie bisher', written: 'Apixaban [FEHLT: Dosierung]', kind: 'gap', note: 'Die Dosis wurde nicht genannt, also steht im Brief eine Markierung statt einer Zahl. Sie bleibt, bis Sie sie ausfüllen.' },
    ] as Array<{ said: string; written: string; kind: Kind; note: string }>,
    principles: [
      { t: 'Fachwörter bleiben ganz', d: 'Zusammengesetzte Wörter werden nicht auseinandergerissen, und Abkürzungen wie LVEF oder NT-proBNP stehen so im Brief, wie sie im Befund stehen.' },
      { t: 'Zahlen bekommen ihre Form', d: 'Ein gesprochener Blutdruck steht als 145/90 mmHg im Brief, eine Frequenz als 72/min, eine Dosis als 2,5 mg.' },
      { t: 'Was fehlt, wird markiert', d: 'Was Sie nicht gesagt haben, erfindet der Assistent nicht. Fehlt eine Angabe, steht an der Stelle eine Markierung.' },
    ],
  },
  bento: {
    title: 'Vier Details aus dem Alltag mit dem Assistenten.',
    add: {
      title: 'Nachträge diktieren Sie einfach dazu.',
      body: 'Fällt Ihnen nach dem Diktat noch etwas ein, sprechen Sie es nach. Der Assistent arbeitet den Satz an der passenden Stelle in den bestehenden Text ein.',
      said: 'Eine Kontrolle in sechs Monaten wurde vereinbart.',
      line: 'Eine Kontrolle in 6 Monaten wurde vereinbart.',
      heading: 'Zusammenfassende Beurteilung',
      before: 'Unter Belastung keine Angina pectoris; die Belastbarkeit ist gut.',
      after: ['Die Medikation wurde unverändert fortgeführt.', 'Bei erneuten Beschwerden bitten wir um Wiedervorstellung.'],
      target: 'In „Zusammenfassende Beurteilung"',
      done: 'Fertig',
      busy: 'Wird eingearbeitet …',
      filed: 'Eingearbeitet',
    },
    follow: {
      title: 'Beim Abhören läuft der Text mit.',
      body: 'Beim Abspielen wandert die Markierung durch das Transkript. Klicken Sie auf ein Wort, springt die Wiedergabe dorthin.',
      words: 'Der Blutdruck lag heute bei einhundertfünfundvierzig zu neunzig, das EKG war unauffällig.',
    },
    safe: {
      title: 'Alle fünf Sekunden gesichert.',
      body: 'Die Aufnahme wird während des Gesprächs alle fünf Sekunden auf Ihrem Rechner gespeichert. Stürzt der Browser ab oder schließt sich der Tab, fehlen höchstens die letzten fünf Sekunden.',
      caption: 'Sprechstunde',
      saves: 'Sicherungen',
      saved: 'auf dem Rechner gesichert',
      saving: 'wird gesichert',
    },
    word: {
      title: 'In Word sieht der Brief aus wie im Editor.',
      body: 'Die Word-Datei hat richtige Überschriften und Tabstopps. Die Dosierungsspalten sitzen auf Tabulatoren, deshalb bleiben sie auch nach dem Bearbeiten in Word ausgerichtet.',
      heading: 'Aktuelle Therapie',
      rows: [
        ['ASS 100', '1-0-0'],
        ['Sevikar 40/5', '1-0-0'],
        ['Atorvastatin 40', '0-0-1'],
        ['Bisoprolol 2,5', '1-0-0'],
      ],
      file: 'Vollmer_Kontrolle.docx',
      fileNote: 'Word-Datei, mit Überschriften und Tabstopps',
    },
  },
  templates: {
    title: 'Vorlagen für jede Art von Bericht.',
    body: 'Jede Praxis schreibt ihre Briefe anders. Deshalb legen Sie eigene Vorlagen an und bestimmen selbst, welche Abschnitte ein Bericht hat und in welcher Reihenfolge. Jeder neue Brief beginnt mit dieser Struktur.',
    letterhead: ['Kardiologische Praxis', 'Am Brand 8, 55116 Mainz'],
    date: 'Mainz, 31.08.2026',
    recipient: ['Dres. med. Weber / Kaufmann', 'Rheinallee 12', '55118 Mainz'],
    salutation: 'Sehr geehrte Frau Kollegin, sehr geehrter Herr Kollege,',
    closing: 'Mit freundlichen kollegialen Grüßen',
    template: 'Vorlage',
    own: 'Eigene Vorlage',
    ownAria: 'Ihre eigene Vorlage',
    ownSections: ['Fragestellung', 'Befund', 'Beurteilung', 'Empfehlung'],
    list: [
      { name: 'Kardiologischer Arztbrief', sections: ['Diagnosen', 'Anamnese', 'Zusammenfassende Beurteilung', 'Aktuelle Therapie'] },
      { name: 'Kurzbefund Echo', sections: ['Fragestellung', 'Befund', 'Beurteilung'] },
      { name: 'Reha-Bericht', sections: ['Diagnosen', 'Verlauf', 'Empfehlung', 'Medikation'] },
      { name: 'Gutachten', sections: ['Fragestellung', 'Anamnese', 'Befunde', 'Beurteilung'] },
      { name: 'Überweisung', sections: ['Diagnosen', 'Fragestellung', 'Bisherige Therapie'] },
      { name: 'Herzkatheter-Bericht', sections: ['Indikation', 'Befund', 'Intervention', 'Empfehlung'] },
      { name: 'Belastungs-EKG', sections: ['Fragestellung', 'Belastung', 'Befund', 'Beurteilung'] },
      { name: 'Langzeit-EKG', sections: ['Aufzeichnung', 'Rhythmus', 'Beurteilung'] },
      { name: 'Entlassbrief', sections: ['Diagnosen', 'Verlauf', 'Medikation bei Entlassung', 'Empfehlung'] },
    ],
  },
  trust: {
    title: 'Ihre Daten bleiben bei Ihnen.',
    body: 'So ist der Assistent gebaut.',
    points: [
      { t: 'Lokal gespeichert', b: 'Aufnahmen, Transkripte und Briefe werden auf Ihrem Rechner gespeichert. Es gibt kein Konto und keine Ablage in der Cloud.' },
      { t: 'Sie geben frei', b: 'Sie lesen und korrigieren jeden Text, bevor er in den Brief übernommen wird.' },
      { t: 'Keine Diagnosevorschläge', b: 'Der Assistent schreibt Dokumentation. Diagnosen oder Abrechnungsziffern schlägt er nicht vor. Das ist so gewollt.' },
    ],
  },
  closing: {
    title: 'Probieren Sie es mit Ihrem nächsten Brief.',
    body: 'Arzt-Assistent wird derzeit mit einer kleinen Gruppe von Ärztinnen und Ärzten erprobt. Schreiben Sie uns, wenn Sie dabei sein möchten.',
    cta: 'Früher Zugang',
    tagline: 'Software für die ärztliche Dokumentation.',
    tools: 'Die Werkzeuge',
    templates: 'Vorlagen',
    contact: 'Kontakt',
  },
};

export type Copy = typeof de;

const en: Copy = {
  meta: {
    title: 'Arzt-Assistent · You speak. The letter writes itself.',
    description:
      'Arzt-Assistent records dictations and consultations and writes the clinic letter from them, in your style, as a Word file. All data stays on your computer.',
  },
  nav: {
    tools: 'The tools',
    templates: 'Templates',
    cta: 'Early access',
    toTop: 'Arzt-Assistent, back to the top',
    sections: 'Sections',
    language: 'Language',
  },
  hero: {
    lines: [
      ['You', 'speak.'],
      ['The', 'letter', 'writes', 'itself.'],
    ],
    sub: 'You dictate, or let the consultation record itself. The assistant writes the clinic letter from it in your style and exports it as a Word file. Everything stays on your computer.',
    primary: 'Early access',
    secondary: 'The tools',
  },
  demo: {
    spoken: 'Current medication: aspirin one hundred once daily, clopidogrel seventy-five once daily until May twenty twenty-six.',
    letterLines: ['Aspirin 100 mg   once daily', 'Clopidogrel 75 mg   once daily until 05/2026'],
    heading: 'Current medication',
    done: 'Done',
    busy: 'Filing …',
    filed: 'Filed under “Current medication”',
    letter: {
      to: ['Dr J. Weber', 'Riverside Practice', '8 Station Road, Cambridge CB1 2JB'],
      date: 'Cambridge, 31 August 2026',
      salutation: 'Dear Dr Weber,',
      intro: 'Thank you for referring Mr Vollmer. I saw him in the cardiology clinic today and summarise the findings below.',
      diagnosesHeading: 'Diagnoses',
      diagnoses: ['1. Coronary artery disease, PCI with stent to the LAD, 03/2026', '2. Arterial hypertension'],
      summaryHeading: 'Summary and assessment',
      summary: [
        'Mr Vollmer attended for a follow-up review. He has no angina on exertion and his exercise tolerance is good.',
        'The ECG showed normal sinus rhythm. Echocardiography showed good global and regional left ventricular function.',
      ],
    },
  },
  tools: {
    title: 'What you say ends up in the letter.',
    titleRest: 'As a dictation, from the consultation, or section by section in the report editor.',
    chapters: {
      diktat: {
        tool: 'Dictation',
        title: 'The dictation becomes the assessment.',
        body: 'You describe the case the way you would to a colleague. The assistant writes the summary and assessment from it in full sentences and keeps your order and your wording.',
        alt: 'A dictation, written up as a finished summary and assessment',
        callouts: ['From 20 seconds of dictation', 'Add to it later without rewriting'],
      },
      termin: {
        tool: 'Consultation',
        title: 'The consultation is transcribed.',
        body: 'The recording runs while you talk with the patient. Afterwards you have the transcript split by doctor and patient, plus notes in sections. Click a word to hear that moment.',
        alt: 'A consultation transcript, split by doctor and patient',
        callouts: ['Split by doctor and patient', 'Click a word to play that moment'],
      },
      bericht: {
        tool: 'Report',
        title: 'The report, dictated section by section.',
        body: 'The editor shows an A4 page with the sections from your template. You dictate each section on its own. At the end you export a Word file with proper headings and tab stops.',
        alt: 'The report editor: an A4 page with sections that can be dictated',
        callouts: ['Each section dictated on its own', '1:14 min dictation, inserted as a section'],
      },
    },
  },
  accuracy: {
    title: 'Terms, values and doses arrive in the letter the way you would write them.',
    body: 'The assistant is tuned to the language of a cardiology practice. What you say is written in the form it takes in a clinic letter. A few examples:',
    examples: 'Examples',
    stage: (said: string, written: string) => `Said: ${said}. In the letter: ${written}.`,
    kinds: { term: 'Term', value: 'Value', dose: 'Dose', gap: 'Not stated' },
    entries: [
      { said: 'P C I stent L A D', written: 'PCI/stent LAD', kind: 'term', note: 'Procedure and vessel, abbreviated as in the cath report.' },
      { said: 'L V E F fifty-eight percent', written: 'LVEF 58%', kind: 'value', note: 'A measurement, written as a number with its sign.' },
      { said: 'tricuspid regurgitation grade one', written: 'Tricuspid regurgitation grade 1', kind: 'term', note: 'The term stays as it is, the grade becomes a numeral.' },
      { said: 'N T pro B N P', written: 'NT-proBNP', kind: 'term', note: 'Spelled out letter by letter and written as the lab value you mean.' },
      { said: 'one forty-five over ninety', written: '145/90 mmHg', kind: 'value', note: 'The blood pressure gets its unit.' },
      { said: 'bisoprolol two point five, once daily', written: 'Bisoprolol 2.5 mg   once daily', kind: 'dose', note: 'Drug and strength first, the schedule on the tab stop.' },
      { said: 'apixaban, continue as before', written: 'Apixaban [MISSING: dose]', kind: 'gap', note: 'No dose was given, so the letter shows a marker instead of a number. It stays until you fill it in.' },
    ],
    principles: [
      { t: 'Terms stay whole', d: 'Compound terms are not split up, and abbreviations like LVEF or NT-proBNP are written the way they appear in a report.' },
      { t: 'Numbers get their form', d: 'A spoken blood pressure is written as 145/90 mmHg, a heart rate as 72/min, a dose as 2.5 mg.' },
      { t: 'Gaps are marked', d: 'What you did not say, the assistant does not invent. If something is missing, a marker sits in its place.' },
    ],
  },
  bento: {
    title: 'Four details from everyday use.',
    add: {
      title: 'Additions are dictated on top.',
      body: 'If something comes to mind after the dictation, just say it. The assistant works the sentence into the existing text where it belongs.',
      said: 'A follow-up in six months was arranged.',
      line: 'A follow-up in 6 months was arranged.',
      heading: 'Summary and assessment',
      before: 'No angina on exertion; exercise tolerance is good.',
      after: ['Medication was continued unchanged.', 'We would ask to see him again if symptoms recur.'],
      target: 'In “Summary and assessment”',
      done: 'Done',
      busy: 'Working it in …',
      filed: 'Worked in',
    },
    follow: {
      title: 'The text follows the playback.',
      body: 'While you listen, the highlight moves through the transcript. Click a word and playback jumps to it.',
      words: 'Blood pressure today was one forty-five over ninety, and the ECG was unremarkable.',
    },
    safe: {
      title: 'Saved every five seconds.',
      body: 'During the consultation the recording is saved to your computer every five seconds. If the browser crashes or the tab closes, you lose at most the last five seconds.',
      caption: 'Consultation',
      saves: 'Saves',
      saved: 'saved to this computer',
      saving: 'saving',
    },
    word: {
      title: 'In Word the letter looks like it does in the editor.',
      body: 'The Word file has proper headings and tab stops. The dose columns sit on tab stops, so they stay aligned after editing in Word.',
      heading: 'Current medication',
      rows: [
        ['Aspirin 100 mg', 'once daily'],
        ['Sevikar 40/5 mg', 'once daily'],
        ['Atorvastatin 40 mg', 'at night'],
        ['Bisoprolol 2.5 mg', 'once daily'],
      ],
      file: 'Vollmer_follow-up.docx',
      fileNote: 'Word file, with headings and tab stops',
    },
  },
  templates: {
    title: 'Templates for every kind of report.',
    body: 'Every practice writes its letters differently. So you create your own templates and decide which sections a report has and in what order. Every new letter starts from that structure.',
    letterhead: ['Cardiology Practice', '12 Mill Road, Cambridge'],
    date: 'Cambridge, 31 August 2026',
    recipient: ['Dr J. Weber', 'Riverside Practice', '8 Station Road, Cambridge'],
    salutation: 'Dear Dr Weber,',
    closing: 'Yours sincerely',
    template: 'Template',
    own: 'Your own template',
    ownAria: 'Your own template',
    ownSections: ['Question', 'Findings', 'Assessment', 'Recommendation'],
    list: [
      { name: 'Cardiology clinic letter', sections: ['Diagnoses', 'History', 'Summary and assessment', 'Current medication'] },
      { name: 'Echo report', sections: ['Question', 'Findings', 'Assessment'] },
      { name: 'Rehabilitation summary', sections: ['Diagnoses', 'Course', 'Recommendation', 'Medication'] },
      { name: 'Medical report', sections: ['Question', 'History', 'Findings', 'Assessment'] },
      { name: 'Referral letter', sections: ['Diagnoses', 'Question', 'Treatment to date'] },
      { name: 'Cath lab report', sections: ['Indication', 'Findings', 'Intervention', 'Recommendation'] },
      { name: 'Exercise ECG', sections: ['Question', 'Exercise', 'Findings', 'Assessment'] },
      { name: 'Holter ECG', sections: ['Recording', 'Rhythm', 'Assessment'] },
      { name: 'Discharge summary', sections: ['Diagnoses', 'Course', 'Medication on discharge', 'Recommendation'] },
    ],
  },
  trust: {
    title: 'Your data stays with you.',
    body: 'This is how the assistant is built.',
    points: [
      { t: 'Stored locally', b: 'Recordings, transcripts and letters are saved on your computer. There is no account and no storage in the cloud.' },
      { t: 'You sign off', b: 'You read and correct every text before it goes into the letter.' },
      { t: 'No diagnosis suggestions', b: 'The assistant writes documentation. It does not suggest diagnoses or billing codes. That is deliberate.' },
    ],
  },
  closing: {
    title: 'Try it with your next letter.',
    body: 'Arzt-Assistent is currently being trialled with a small group of doctors. Write to us if you would like to take part.',
    cta: 'Early access',
    tagline: 'Software for clinical documentation.',
    tools: 'The tools',
    templates: 'Templates',
    contact: 'Contact',
  },
};

export const COPY: Record<Lang, Copy> = { de, en };
