import { useEffect, useState } from 'react';
import { ArrowRight, Mic, Stethoscope } from 'lucide-react';
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
import { pipeline } from '@/lib/transcription/pipeline';
import type { Session } from '@/lib/db';
import { deleteSession } from '@/lib/generate';
import { sessionTitle } from '@/features/sessions/useSessions';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';

/**
 * Home = "what do you want to do", said once, plainly.
 *
 * The two features get visibly different treatments here on purpose — the
 * complaint against the last version was that they felt identical. Termin is
 * the daylight feature (it runs during a conversation); Diktat is the focus
 * feature (dark, full-screen when recording), and its card hints at that.
 */
export function StartScreen() {
  const startRecording = useAppStore((s) => s.startRecording);
  const openSession = useAppStore((s) => s.openSession);
  const touchSessions = useAppStore((s) => s.touchSessions);
  const [recoverable, setRecoverable] = useState<Session[]>([]);

  useEffect(() => {
    void findRecoverableSessions().then(setRecoverable);
  }, []);

  return (
    <div className="space-y-12">
      <div className="space-y-2 pt-4">
        <h1 className="text-3xl font-semibold tracking-tight">Guten Tag, Herr Professor.</h1>
        <p className="max-w-[56ch] text-lg text-muted-foreground">
          Alles bleibt auf diesem Computer — kein Server, kein Konto.
        </p>
      </div>

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
                          setRecoverable(await findRecoverableSessions());
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

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Termin: the daylight card. */}
        <button
          type="button"
          onClick={() => startRecording('gespraech')}
          className={cn(
            'btn-liquid group flex flex-col items-start gap-4 rounded-2xl border border-white/80 p-7 text-left',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          )}
        >
          {/* A key on a key: the icon tile is its own small piece of glass. */}
          <span className="grid size-14 place-items-center rounded-2xl border border-white/80 bg-gradient-to-b from-white/90 to-neutral-100/70 shadow-[inset_0_1px_1px_rgba(255,255,255,1),inset_0_-1px_1px_rgba(12,12,13,0.08),inset_0_0_10px_rgba(255,255,255,0.5),0_0_0_1px_rgba(12,12,13,0.06),0_2px_6px_rgba(12,12,13,0.1)]">
            <Stethoscope className="size-7" strokeWidth={1.75} aria-hidden />
          </span>
          <span className="flex items-center gap-1.5 text-xl font-semibold tracking-tight">
            Termin aufnehmen
            <ArrowRight
              className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
          <span className="text-base leading-relaxed text-muted-foreground">
            Läuft während des Patientengesprächs mit. Danach: Transkript nach Sprechern getrennt,
            die Aufnahme zum Nachhören und fertige Notizen.
          </span>
        </button>

        {/* Diktat: the dark card is the feature's signature on this page —
            the recorder itself runs in the normal light frame. */}
        <button
          type="button"
          onClick={() => startRecording('beurteilung')}
          className={cn(
            'btn-gloss group flex flex-col items-start gap-4 rounded-2xl border border-neutral-800 bg-neutral-950 p-7 text-left text-neutral-50',
            'transition-colors hover:border-neutral-600 hover:bg-neutral-900',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          )}
        >
          <span className="grid size-14 place-items-center rounded-2xl border border-white/10 bg-gradient-to-b from-neutral-800 to-neutral-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_2px_6px_rgba(0,0,0,0.5)]">
            <Mic className="size-7" strokeWidth={1.75} aria-hidden />
          </span>
          <span className="flex items-center gap-1.5 text-xl font-semibold tracking-tight">
            Diktat starten
            <ArrowRight
              className="size-5 text-neutral-400 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
          <span className="text-base leading-relaxed text-neutral-400">
            Sprechen Sie frei, wie zu einem Kollegen. Daraus entsteht die Zusammenfassende
            Beurteilung — mit der Aufnahme zum Mitlesen und Nachhören.
          </span>
        </button>
      </div>

      <p className="max-w-[60ch] text-sm text-muted-foreground">
        Jede Aufnahme wird hier gespeichert — mit Notizen, Transkript und Ton zum
        Nachhören.
      </p>
    </div>
  );
}
