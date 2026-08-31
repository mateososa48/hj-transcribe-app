# Testskript: Termin (Arzt–Patient)

A read-aloud script for testing the **Termin** feature end to end: recording →
diarization → transcript → the four note sections.

Everything here is invented — patient, dates, values (SPEC constraint 7:
synthetic data only).

---

## How to run it

1. **Two voices if you can.** Diarization is the thing this feature does that a
   Diktat doesn't, and one person doing both voices gives it nothing to
   separate. If you're alone, read the Patient lines in a noticeably different
   pitch and pace — it will usually still split them, but that's the part most
   likely to look wrong.
2. **Leave a beat between turns.** Half a second of silence at each speaker
   change. Talking over each other is realistic but it's not what you're
   testing today.
3. **Say the numbers the way a person says them** — the script is written that
   way on purpose. Turning *"vier Komma sieben"* into `4,7 cm` is the app's
   job, not yours.
4. Sit about arm's length from the mic. Don't hold it.
5. Runtime is roughly **3 minutes**.

---

## Das Skript

> **Herr Vollmer, 68 Jahre.** Verlaufskontrolle nach Stentimplantation.

**Arzt:** Guten Tag, Herr Vollmer, schön Sie zu sehen. Setzen Sie sich. Wie ist
es Ihnen denn ergangen seit unserem letzten Termin im Februar?

**Patient:** Guten Tag, Herr Professor. Insgesamt ganz gut, muss ich sagen. Ich
bin wieder viel unterwegs, ich gehe jeden Tag spazieren mit dem Hund.

**Arzt:** Das freut mich. Und Brustschmerzen? Dieses Engegefühl, das Sie damals
hatten — ist das noch einmal aufgetreten?

**Patient:** Nein, überhaupt nicht mehr. Seit dem Eingriff hatte ich keine
Beschwerden mehr in der Brust. Das ist wirklich weg.

**Arzt:** Sehr gut. Also keine Angina pectoris mehr. Und Schwindel, Herzstolpern,
irgendwelche Aussetzer?

**Patient:** Nein, kein Schwindel. Herzstolpern auch nicht.

**Arzt:** Und wie sieht es aus, wenn Sie sich belasten? Treppen zum Beispiel.

**Patient:** Da muss ich ehrlich sein, Herr Professor. Wenn ich in den zweiten
Stock hochgehe, dann komme ich schon aus der Puste. Das war letztes Jahr noch
nicht so. In der Ebene merke ich nichts, nur bei den Treppen.

**Arzt:** Seit wann ungefähr fällt Ihnen das auf?

**Patient:** So seit drei Monaten etwa. Es ist langsam gekommen, nicht plötzlich.

**Arzt:** Gut, das schauen wir uns an. Schlafen Sie gut? Ihre Frau hatte beim
letzten Mal das Schnarchen erwähnt.

**Patient:** Das sagt sie immer noch, ja. Und ich bin tagsüber oft müde,
besonders nach dem Mittagessen.

**Arzt:** Gut, das merke ich mir. Dann schauen wir auf die Untersuchungen von
heute. Der Blutdruck war bei Ihnen einhundertfünfundvierzig zu neunzig, das ist
etwas zu hoch. Messen Sie zu Hause?

**Patient:** Ab und zu. Meistens ist er so um die einhundertvierzig.

**Arzt:** Dann sollten wir das etwas engmaschiger beobachten. Das EKG war
unauffällig, normaler Sinusrhythmus. Im Echo zeigt sich eine gute
Pumpfunktion, die Auswurfleistung liegt bei fünfundfünfzig Prozent.

**Patient:** Das heißt, das Herz arbeitet normal?

**Arzt:** Die Pumpleistung ist gut, ja. Was ich weiter beobachten möchte, ist
die Hauptschlagader. Die ist im CT auf vier Komma sieben Zentimeter erweitert.
Das ist noch kein Operationsgrund, aber es ist etwas mehr als beim letzten Mal.

**Patient:** Ist das gefährlich?

**Arzt:** In dieser Größe nicht akut. Aber Sie sollten schwere Gewichte meiden,
also kein Pressen beim Heben, und Kontaktsportarten ebenfalls. Wir kontrollieren
das in sechs Monaten noch einmal mit einem CT.

**Patient:** Verstanden.

**Arzt:** Dann gehen wir die Medikamente durch. Nehmen Sie alles so weiter wie
besprochen?

**Patient:** Ich glaube schon. Ich habe die Liste dabei. ASS hundert am Morgen.
Clopidogrel fünfundsiebzig, auch morgens. Pantoprazol vierzig, morgens.
Sevikar vierzig fünf, morgens. Und Rosuvastatin zwanzig, das nehme ich abends.

**Arzt:** Das ist genau richtig. Das Clopidogrel nehmen Sie noch bis Mai
sechsundzwanzig, dann können wir es absetzen. Das ASS bleibt auf Dauer.

**Patient:** Und das Pantoprazol?

**Arzt:** Das solange wie das Clopidogrel, zum Schutz des Magens. Ein
Betablocker wäre bei Ihnen eigentlich wünschenswert, aber Ihr Puls ist mit
zweiundfünfzig zu langsam, das geht nicht.

**Patient:** Gut.

**Arzt:** Dann machen wir Folgendes: ein Langzeit-EKG, damit wir die
Belastungsluftnot einordnen können. Eine Laborkontrolle mit proBNP und den
Nierenwerten. Und bei der Müdigkeit und dem Schnarchen würde ich Ihnen ein
Schlafapnoescreening empfehlen.

**Patient:** Das mit dem Schlafen macht meine Frau sicher gerne mit.

**Arzt:** Sehr gut. Und die Blutdruckkontrolle machen wir über den Hausarzt.
Wir sehen uns dann in sechs Monaten wieder, mit dem CT und einem neuen Echo.

**Patient:** Alles klar, Herr Professor. Vielen Dank.

**Arzt:** Gerne, Herr Vollmer. Kommen Sie gut nach Hause.

---

## Was danach stimmen muss

Open the finished Termin and check these. The first group is what would matter
clinically; the second is house style.

### Darf nicht falsch sein

- [ ] **Zwei Sprecher** getrennt, und die Zuordnung stimmt — der Arzt sagt die
      Befunde, nicht der Patient.
- [ ] **„keine Angina pectoris"** und **„kein Schwindel"** stehen MIT ihrer
      Verneinung in den Notizen. Ein verlorenes „kein" ist der schlimmste
      Fehler, den dieses Produkt machen kann.
- [ ] **4,7 cm** — Komma, nicht Punkt, und nicht „47".
- [ ] **145/90**, **55 %**, **Puls 52** korrekt übernommen.
- [ ] Alle fünf Präparate mit ihrer Stärke: **ASS 100, Clopidogrel 75,
      Pantoprazol 40, Sevikar 40/5, Rosuvastatin 20**. Keins fehlt, keins
      erfunden.
- [ ] **Nichts erfunden.** Kein Datum, kein Wert, keine Diagnose, die oben nicht
      gesagt wurde. Was fehlt, fehlt.

### Hausstil

- [ ] Dosierungen als **1-0-0** bzw. **0-0-1** (Rosuvastatin abends).
- [ ] **bis 5/26** für das Clopidogrel.
- [ ] Die vier Abschnitte sind sinnvoll gefüllt:
      - **Zusammenfassung** — beschwerdefrei bis auf Belastungsdyspnoe, Plan.
      - **Diagnosen** — KHK nach Stent, arterielle Hypertonie, Aortenektasie,
        V. a. Schlafapnoe.
      - **Anamnese** — Belastungsdyspnoe seit drei Monaten, Schnarchen,
        Tagesmüdigkeit.
      - **Medikation** — die fünf Präparate mit Dosierung.
- [ ] Sie-Form durchgehend, klinischer Ton, keine Chatbot-Sprache.

### Was das Skript absichtlich NICHT enthält

Nothing here says when the stent was implanted, and no referring doctor is
named. If either appears in the notes, the model invented it — that's the
failure mode the whole product is built to prevent, and it's worth a bug report
rather than a shrug.

---

## Kurzfassung (ca. 45 Sekunden)

For a quick smoke test when you only want to see that recording, diarization
and the sections work at all.

**Arzt:** Guten Tag, Herr Vollmer. Wie geht es Ihnen seit dem Eingriff?

**Patient:** Gut, Herr Professor. Ich habe keine Brustschmerzen mehr. Nur beim
Treppensteigen komme ich aus der Puste, seit ungefähr drei Monaten.

**Arzt:** Der Blutdruck war heute einhundertfünfundvierzig zu neunzig, das Echo
zeigt eine gute Pumpfunktion. Nehmen Sie ASS hundert und Clopidogrel
fünfundsiebzig weiter, beides morgens, das Clopidogrel bis Mai sechsundzwanzig.

**Patient:** Mache ich.

**Arzt:** Dann sehen wir uns in sechs Monaten wieder.
