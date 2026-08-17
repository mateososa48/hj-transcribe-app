import { useState } from 'react';
import { AlertTriangle, ArrowLeft, HardDrive, KeyRound, ShieldCheck } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ASR_PROVIDER_META, LLM_PROVIDER_META } from '@/lib/providers';
import { clearAllData } from '@/lib/settings';
import { formatBytes } from '@/lib/storage';
import { useSettingsStore } from '@/store/settings-store';

/**
 * Almost nothing, on purpose.
 *
 * The provider pickers, retention policies and key fields are gone: he has one
 * machine, one microphone and one key pair, and every setting was a way to
 * break the app by accident. What is left is what he might act on — whether the
 * browser has promised to keep his recordings — plus an honest statement of
 * where his audio and text are sent.
 */
export function SettingsPage({ onBack }: { onBack: () => void }) {
  const { settings, apiKeys, storage } = useSettingsStore();
  const enablePersistence = useSettingsStore((s) => s.enablePersistence);
  const hydrate = useSettingsStore((s) => s.hydrate);
  const [confirmText, setConfirmText] = useState('');

  const asr = ASR_PROVIDER_META[settings.asrProviderId];
  const llm = LLM_PROVIDER_META[settings.llmProviderId];
  const keysPresent = Boolean(apiKeys[settings.asrProviderId]) && Boolean(apiKeys[settings.llmProviderId]);

  return (
    <div className="space-y-12 pb-16">
      <Button variant="ghost" size="lg" onClick={onBack}>
        <ArrowLeft aria-hidden />
        Zurück
      </Button>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Einstellungen</h1>
        <p className="max-w-[68ch] text-muted-foreground">
          Alle Aufnahmen und Texte bleiben auf diesem Computer. Es gibt keinen Server und kein
          Konto.
        </p>
      </div>

      <section className="space-y-5">
        <div className="space-y-1.5">
          <h2 className="flex items-center gap-2.5 text-lg font-semibold">
            <HardDrive className="size-5 text-muted-foreground" aria-hidden />
            Speicher
          </h2>
          <p className="max-w-[68ch] text-sm text-muted-foreground">
            Aufnahmen und Texte liegen im Speicher dieses Browsers. Mit der dauerhaften Speicherung
            darf der Browser sie nicht selbstständig löschen.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Dauerhafte Speicherung</div>
            <div className="flex items-center gap-3">
              {storage?.persisted ? (
                <Badge variant="secondary">
                  <ShieldCheck className="size-4" aria-hidden />
                  Aktiv
                </Badge>
              ) : (
                <>
                  <Badge variant="outline">Nicht aktiv</Badge>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={async () => {
                      const granted = await enablePersistence();
                      if (granted) toast.success('Dauerhafte Speicherung ist aktiv.');
                      else toast.error('Der Browser hat die dauerhafte Speicherung nicht gewährt.');
                    }}
                  >
                    Jetzt aktivieren
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Belegt</div>
            <div className="text-base tabular-nums">
              {formatBytes(storage?.usage)}
              {storage?.quota ? (
                <span className="text-muted-foreground"> von {formatBytes(storage.quota)}</span>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <Separator />

      <section className="space-y-5">
        <div className="space-y-1.5">
          <h2 className="flex items-center gap-2.5 text-lg font-semibold">
            <KeyRound className="size-5 text-muted-foreground" aria-hidden />
            Verbindungen
          </h2>
          <p className="max-w-[68ch] text-sm text-muted-foreground">
            Wohin die Aufnahme geht, um in Text umgewandelt zu werden, und wohin der Text geht, um
            in Ihre Briefform gebracht zu werden. Der Zugang ist fest hinterlegt — Sie müssen nichts
            eingeben.
          </p>
        </div>

        <dl className="grid gap-3 sm:max-w-[46rem] sm:grid-cols-[10rem_1fr]">
          <dt className="text-sm text-muted-foreground">Spracherkennung</dt>
          <dd className="flex flex-wrap items-center gap-2.5 text-base">
            {asr.label}
            {asr.euHosted ? (
              <Badge variant="secondary">EU-Server</Badge>
            ) : (
              <Badge variant="outline">Server außerhalb der EU</Badge>
            )}
          </dd>

          <dt className="text-sm text-muted-foreground">Texterstellung</dt>
          <dd className="flex flex-wrap items-center gap-2.5 text-base">
            {llm.label}
            {llm.euHosted ? (
              <Badge variant="secondary">EU-Server</Badge>
            ) : (
              <Badge variant="outline">Server außerhalb der EU</Badge>
            )}
          </dd>

          <dt className="text-sm text-muted-foreground">Zugang</dt>
          <dd className="text-base">
            {keysPresent ? (
              <Badge variant="secondary">Hinterlegt</Badge>
            ) : (
              <Badge variant="outline" className="text-destructive">
                Fehlt — bitte Bescheid geben
              </Badge>
            )}
          </dd>
        </dl>
      </section>

      <Separator />

      <section className="space-y-5">
        <div className="space-y-1.5">
          <h2 className="flex items-center gap-2.5 text-lg font-semibold">
            <AlertTriangle className="size-5 text-muted-foreground" aria-hidden />
            Alle Daten löschen
          </h2>
          <p className="max-w-[68ch] text-sm text-muted-foreground">
            Entfernt alle Aufnahmen, erkannten Texte und erstellten Brieftexte unwiderruflich von
            diesem Computer.
          </p>
        </div>

        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button variant="destructive" size="lg">
                Alle Daten löschen
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Wirklich alle Daten löschen?</AlertDialogTitle>
              <AlertDialogDescription>
                Alle Aufnahmen und alle erstellten Texte werden entfernt. Das lässt sich nicht
                rückgängig machen. Tippen Sie zur Bestätigung{' '}
                <span className="font-semibold text-foreground">LÖSCHEN</span> ein.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="LÖSCHEN"
              aria-label="Bestätigung eingeben"
              className="h-10"
            />

            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmText('')}>Abbrechen</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={confirmText !== 'LÖSCHEN'}
                onClick={async () => {
                  await clearAllData();
                  await hydrate();
                  setConfirmText('');
                  toast.success('Alle Daten wurden gelöscht.');
                  onBack();
                }}
              >
                Endgültig löschen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  );
}
