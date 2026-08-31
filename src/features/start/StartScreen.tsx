import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, FilePen, FileText, MessagesSquare, Mic, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { findRecoverableSessions, recoverSession } from '@/lib/session/recording-session';
import { useRecordingState } from '@/features/record/useRecording';
import { pipeline } from '@/lib/transcription/pipeline';
import type { Session } from '@/lib/db';
import { createDocument, documentRowTitle } from '@/lib/documents';
import { deleteSession } from '@/lib/generate';
import {
  compactDayTime,
  sessionRowTitle,
  sessionTitle,
  useDocuments,
  useSessions,
} from '@/features/sessions/useSessions';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';

/**
 * The screen he lands on.
 *
 * It used to be two enormous cards restating what the sidebar already offers,
 * in a glass-and-gloss language the rest of the app has since left behind —
 * and it never mentioned Berichte at all. It answers two questions now: what
 * do you want to start, and what were you in the middle of.
 *
 * Starting is ranked rather than offered as equals: he dictates most days,
 * records a consultation often, and writes a letter when one is due. The
 * sidebar keeps all three the same size because it is a permanent instrument
 * panel; here, where he arrives, the common one leads.
 */
export function StartScreen() {
  const startRecording = useAppStore((s) => s.startRecording);
  const openSession = useAppStore((s) => s.openSession);
  const openDocument = useAppStore((s) => s.openDocument);
  const touchSessions = useAppStore((s) => s.touchSessions);
  const [recoverable, setRecoverable] = useState<Session[]>([]);
  // A recording in progress looks exactly like a crashed one in the database.
  const live = useRecordingState();
  const { sessions } = useSessions(12);
  const { documents } = useDocuments();

  useEffect(() => {
    void findRecoverableSessions(live.sessionId).then(setRecoverable);
  }, [live.sessionId]);

  /** The last few things he touched, whatever kind they were. */
  const recent = useMemo(() => {
    const fromSessions = sessions.map((item) => ({
      id: item.session.id,
      at: item.session.startedAt,
      title: sessionRowTitle(item),
      tooltip: sessionTitle(item.session),
      icon: item.session.kind === 'beurteilung' ? Mic : MessagesSquare,
      kind: item.session.kind === 'beurteilung' ? 'Diktat' : 'Termin',
      open: () => openSession(item.session.id),
    }));
    const fromDocuments = documents.map((doc) => ({
      id: doc.id,
      at: doc.updatedAt,
      title: documentRowTitle(doc),
      tooltip: doc.title,
      icon: FileText,
      kind: 'Bericht',
      open: () => openDocument(doc.id),
    }));
    return [...fromSessions, ...fromDocuments].sort((a, b) => b.at - a.at).slice(0, 4);
  }, [sessions, documents, openSession, openDocument]);

  const today = new Date().toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="mx-auto max-w-3xl space-y-10 pt-6 pb-16">
      <header className="space-y-1.5">
        <h1 className="text-3xl font-semibold tracking-tight">Guten Tag, Herr Professor.</h1>
        <p className="text-lg text-muted-foreground">{today}</p>
      </header>

      {recoverable.length > 0 ? (
        <section className="space-y-3">
          {recoverable.map((session) => (
            <Item key={session.id} variant="outline">
              <ItemContent>
                <ItemTitle>Unterbrochene Aufnahme gefunden</ItemTitle>
                <ItemDescription>
                  {sessionTitle(session)} wurde nicht ordentlich beendet. Der Ton ist gespeichert
                  und kann weiterverwendet werden.
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                {/* The one click that can destroy a whole consultation's audio
                    gets the same guard as every other destructive action. */}
                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <Button variant="outline" size="lg">
                        Verwerfen
                      </Button>
                    }
                  />
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Aufnahme wirklich verwerfen?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Der gespeicherte Ton dieser Aufnahme wird endgültig gelöscht. Das lässt
                        sich nicht rückgängig machen.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onClick={async () => {
                          await deleteSession(session.id);
                          setRecoverable(await findRecoverableSessions(live.sessionId));
                          touchSessions();
                          toast.success('Aufnahme verworfen.');
                        }}
                      >
                        Endgültig verwerfen
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button
                  size="lg"
                  onClick={async () => {
                    await recoverSession(session.id);
                    touchSessions();
                    openSession(session.id);
                    void pipeline.process(session.id);
                  }}
                >
                  Weiterverwenden
                </Button>
              </ItemActions>
            </Item>
          ))}
        </section>
      ) : null}

      <section className="space-y-3">
        {/* The one he does most days, at full width and in the app's own
            dark key — the same face the sidebar's pills wear. */}
        <PrimaryStart
          icon={Mic}
          title="Diktat starten"
          hint="Frei sprechen. Daraus entsteht die Zusammenfassende Beurteilung."
          onRun={() => startRecording('beurteilung')}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <SecondaryStart
            icon={Stethoscope}
            title="Termin aufnehmen"
            hint="Läuft im Gespräch mit."
            onRun={() => startRecording('gespraech')}
          />
          <SecondaryStart
            icon={FilePen}
            title="Bericht erstellen"
            hint="Der Brief als Seite."
            onRun={() => {
              void createDocument().then((doc) => {
                touchSessions();
                openDocument(doc.id);
              });
            }}
          />
        </div>
      </section>

      {recent.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold tracking-tight text-muted-foreground">
            Weiter arbeiten
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {recent.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={entry.open}
                  title={entry.tooltip}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-3 text-left',
                    'transition-colors duration-150 hover:bg-muted/60 motion-reduce:transition-none',
                    'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                  )}
                >
                  <entry.icon
                    aria-hidden
                    strokeWidth={1.75}
                    className="size-[18px] shrink-0 text-muted-foreground"
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{entry.title}</span>
                  <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                    {entry.kind} · {compactDayTime(entry.at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-sm text-muted-foreground">
        Alles bleibt auf diesem Computer — kein Server, kein Konto.
      </p>
    </div>
  );
}

/** The lead action: the dark key, full width, with its own reason under it. */
function PrimaryStart({
  icon: Icon,
  title,
  hint,
  onRun,
}: {
  icon: typeof Mic;
  title: string;
  hint: string;
  onRun: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRun}
      className={cn(
        'group flex w-full items-center gap-4 rounded-2xl px-5 py-4 text-left text-white',
        // The sidebar pill's own ramp, at card scale.
        'bg-[linear-gradient(180deg,#313131_0%,#1e1e1e_22%,#171717_42%,#161616_80%,#151515_100%)]',
        'hover:bg-[linear-gradient(180deg,#3d3d3d_0%,#262626_22%,#1e1e1e_42%,#1c1c1c_80%,#1a1a1a_100%)]',
        'transition-[background-image,transform] duration-200 ease-out active:scale-[0.995]',
        'motion-reduce:transition-none',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
      )}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/10">
        <Icon className="size-5" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-semibold tracking-tight">{title}</span>
        <span className="mt-0.5 block truncate text-sm text-white/60">{hint}</span>
      </span>
      <ArrowRight
        aria-hidden
        className="size-5 shrink-0 text-white/50 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
      />
    </button>
  );
}

/** The other two: the flat white key from the Figma frames, at card scale. */
function SecondaryStart({
  icon: Icon,
  title,
  hint,
  onRun,
}: {
  icon: typeof Mic;
  title: string;
  hint: string;
  onRun: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRun}
      className={cn(
        'group flex w-full items-center gap-3 rounded-2xl border border-foreground/15 bg-background px-4 py-3.5 text-left',
        'transition-colors duration-200 ease-out hover:border-foreground/30 hover:bg-muted/50',
        'motion-reduce:transition-none',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted">
        <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold tracking-tight">{title}</span>
        <span className="mt-0.5 block truncate text-sm text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}
