import { db, type Session, type TimedWord, type Utterance } from '@/lib/db';

/**
 * Demo data for judging the layout experiments — DEV ONLY, wired into the
 * layout switcher, never into a shipped screen.
 *
 * Everything is synthetic and marked with the `demo-` id prefix so it can be
 * removed as one unit. One Termin and one Diktat are "complete" — audio,
 * diarized transcript, word timings — so playback, follow-along and the
 * transcript views render; the rest fill the lists so grouping, truncation
 * and expansion behaviour are visible.
 */

const DEMO = 'demo-';

/** A quiet 220 Hz tone as a valid WAV blob — enough for the player to play. */
function toneWav(seconds: number): Blob {
  const rate = 22050;
  const frames = Math.floor(seconds * rate);
  const buf = new ArrayBuffer(44 + frames * 2);
  const view = new DataView(buf);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + frames * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, frames * 2, true);
  for (let i = 0; i < frames; i++) {
    const fade = Math.min(1, i / 2000, (frames - i) / 2000);
    view.setInt16(44 + i * 2, Math.sin((i / rate) * 220 * 2 * Math.PI) * 4000 * fade, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}

/** Word timings spread evenly over a stretch of audio. */
function timeWords(text: string, startMs: number, endMs: number): TimedWord[] {
  const words = text.split(/\s+/).filter(Boolean);
  const step = (endMs - startMs) / words.length;
  return words.map((w, i) => ({
    text: w,
    startMs: Math.round(startMs + i * step),
    endMs: Math.round(startMs + (i + 1) * step - 40),
  }));
}

const TERMIN_DIALOG: Array<[speaker: string, text: string]> = [
  ['A', 'Guten Tag, Herr Brandner. Wie ist es Ihnen ergangen seit dem letzten Mal?'],
  ['B', 'Ganz gut, Herr Professor. Seit dem Infarkt im März ist eigentlich Ruhe.'],
  ['A', 'Haben Sie Druck auf der Brust bei Anstrengung? Oder Luftnot?'],
  ['B', 'Nein, gar nichts mehr. Ich gehe jeden Tag drei Kilometer mit dem Hund.'],
  ['A', 'Sehr gut. Welche Medikamente nehmen Sie zurzeit?'],
  ['B', 'ASS hundert, eins null null. Und Bisoprolol fünf, eins null null.'],
  ['A', 'Vertragen Sie das Statin? Keine Muskelschmerzen?'],
  ['B', 'Nein, keine Beschwerden. Geraucht habe ich vor zehn Jahren zuletzt.'],
];

export async function seedDemoData(): Promise<void> {
  const now = Date.now();
  const hour = 3_600_000;
  const day = 24 * hour;

  const sessions: Session[] = [];
  const put: Promise<unknown>[] = [];

  // ── the complete Termin: audio + diarized transcript + notes ─────────────
  const terminId = `${DEMO}termin-voll`;
  const terminAudioS = 40;
  sessions.push({
    id: terminId,
    kind: 'gespraech',
    startedAt: now - 2 * hour,
    endedAt: now - 2 * hour + terminAudioS * 1000,
    status: 'stopped',
    durationMs: terminAudioS * 1000,
    mimeType: 'audio/wav',
    label: 'Verlaufskontrolle Herr Brandner',
    speakerNames: { A: 'Arzt', B: 'Patient' },
  });
  put.push(
    db.chunks.put({
      id: `${DEMO}chunk-termin`,
      sessionId: terminId,
      index: 0,
      blob: toneWav(terminAudioS),
      createdAt: now - 2 * hour,
    }),
  );
  const slice = (terminAudioS * 1000) / TERMIN_DIALOG.length;
  const utterances: Utterance[] = TERMIN_DIALOG.map(([speaker, text], i) => ({
    speaker,
    text,
    startMs: Math.round(i * slice),
    endMs: Math.round((i + 1) * slice - 150),
  }));
  put.push(
    db.transcriptions.put({
      id: `${DEMO}tr-termin`,
      sessionId: terminId,
      status: 'done',
      providerId: 'assemblyai-eu',
      text: TERMIN_DIALOG.map(([, t]) => t).join(' '),
      utterances,
      createdAt: now - 2 * hour,
      updatedAt: now - 2 * hour,
    }),
  );
  put.push(
    db.results.put({
      id: `${DEMO}res-termin`,
      sessionId: terminId,
      kind: 'gespraech',
      createdAt: now - 2 * hour,
      updatedAt: now - 2 * hour,
      sections: {
        zusammenfassung:
          '• Verlaufskontrolle nach Infarkt im März, beschwerdefrei.\n• Keine Angina pectoris, keine Luftnot.\n• Tägliche Spaziergänge über drei Kilometer.\n• Medikation unverändert, gut vertragen.',
        diagnosen: '• Z.n. Infarkt 3/26\n• Kardiovaskuläre Risikofaktoren mit\n  • Nikotinabusus, sistiert vor 10 Jahren',
        anamnese:
          'Seit dem Infarkt im März beschwerdefrei. Druck auf der Brust und Luftnot werden verneint. Täglich drei Kilometer Spaziergang. Keine Muskelschmerzen unter Statin. Nikotinkarenz seit zehn Jahren.',
        medikation: 'ASS 100\t1-0-0\nBisoprolol 5\t1-0-0',
      },
      original: {},
      model: 'demo',
      promptVersion: 'demo',
      wellFormed: true,
    }),
  );

  // ── the complete Diktat: audio + words for the follow-along ──────────────
  const diktatId = `${DEMO}diktat-voll`;
  const diktatText =
    'Bezüglich der koronaren Herzkrankheit ist der Patient beschwerdefrei. Eine Angina pectoris wird verneint. Die Ejektionsfraktion liegt bei 55 %. Sicherheitshalber würde ich eine Kontrolle in 6 Monaten empfehlen.';
  const diktatAudioS = 20;
  sessions.push({
    id: diktatId,
    kind: 'beurteilung',
    startedAt: now - 5 * hour,
    endedAt: now - 5 * hour + diktatAudioS * 1000,
    status: 'stopped',
    durationMs: diktatAudioS * 1000,
    mimeType: 'audio/wav',
  });
  put.push(
    db.chunks.put({
      id: `${DEMO}chunk-diktat`,
      sessionId: diktatId,
      index: 0,
      blob: toneWav(diktatAudioS),
      createdAt: now - 5 * hour,
    }),
  );
  put.push(
    db.transcriptions.put({
      id: `${DEMO}tr-diktat`,
      sessionId: diktatId,
      status: 'done',
      providerId: 'assemblyai-eu',
      text: diktatText,
      utterances: [],
      words: timeWords(diktatText, 300, diktatAudioS * 1000 - 500),
      createdAt: now - 5 * hour,
      updatedAt: now - 5 * hour,
    }),
  );
  put.push(
    db.results.put({
      id: `${DEMO}res-diktat`,
      sessionId: diktatId,
      kind: 'beurteilung',
      createdAt: now - 5 * hour,
      updatedAt: now - 5 * hour,
      sections: {
        beurteilung:
          '• Bezüglich der koronaren Herzkrankheit ist der Patient beschwerdefrei. Eine Angina pectoris wird verneint.\n• Die Ejektionsfraktion liegt bei 55 %.\n• Sicherheitshalber würde ich eine Kontrolle in 6 Monaten empfehlen.',
      },
      original: {},
      model: 'demo',
      promptVersion: 'demo',
      wellFormed: true,
    }),
  );

  // ── filler rows so lists truncate, group and expand visibly ─────────────
  const fillers: Array<[kind: Session['kind'], label: string | undefined, age: number]> = [
    ['gespraech', 'Erstvorstellung Frau Keller', 8 * hour],
    ['gespraech', undefined, day + 3 * hour],
    ['gespraech', 'Kontrolle Herr Özdemir', day + 7 * hour],
    ['gespraech', undefined, 2 * day + 4 * hour],
    ['gespraech', undefined, 3 * day + 2 * hour],
    ['gespraech', 'Frau Dr. Sander, Zuweisung', 4 * day],
    ['beurteilung', undefined, 9 * hour],
    ['beurteilung', undefined, day + hour],
    ['beurteilung', undefined, day + 9 * hour],
    ['beurteilung', undefined, 2 * day + hour],
    ['beurteilung', undefined, 5 * day],
  ];
  fillers.forEach(([kind, label, age], i) => {
    const id = `${DEMO}fill-${i}`;
    sessions.push({
      id,
      kind,
      startedAt: now - age,
      endedAt: now - age + 600_000,
      status: 'stopped',
      durationMs: 600_000,
      mimeType: 'audio/wav',
      ...(label ? { label } : {}),
    });
    put.push(
      db.results.put({
        id: `${DEMO}res-fill-${i}`,
        sessionId: id,
        kind,
        createdAt: now - age,
        updatedAt: now - age,
        sections:
          kind === 'gespraech'
            ? { zusammenfassung: '• Verlaufskontrolle, stabiler Befund.\n• Medikation unverändert.' }
            : { beurteilung: '• Bezüglich der Herzinsuffizienz stabiler Verlauf unter Therapie.' },
        original: {},
        model: 'demo',
        promptVersion: 'demo',
        wellFormed: true,
      }),
    );
  });

  await Promise.all([...sessions.map((s) => db.sessions.put(s)), ...put]);
}

export async function removeDemoData(): Promise<void> {
  const strip = async (table: { toArray: () => Promise<Array<{ id: string }>>; delete: (id: string) => Promise<void> }) => {
    const rows = await table.toArray();
    await Promise.all(rows.filter((r) => r.id.startsWith(DEMO)).map((r) => table.delete(r.id)));
  };
  await Promise.all([
    strip(db.sessions),
    strip(db.chunks),
    strip(db.transcriptions),
    strip(db.results),
  ]);
}

export async function hasDemoData(): Promise<boolean> {
  const rows = await db.sessions.toArray();
  return rows.some((r) => r.id.startsWith(DEMO));
}
