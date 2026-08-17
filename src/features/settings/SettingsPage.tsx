import { useState } from 'react';
import { AlertTriangle, HardDrive, KeyRound, Languages, ShieldCheck, Sparkles } from 'lucide-react';
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  ASR_PROVIDER_META,
  LLM_PROVIDER_META,
  type TranscriptionProviderId,
} from '@/lib/providers';
import { clearAllData, type AudioRetention, type LlmProviderId } from '@/lib/settings';
import { formatBytes } from '@/lib/storage';
import { useSettingsStore } from '@/store/settings-store';

type AsrId = Exclude<TranscriptionProviderId, 'corti'>;

const ASR_ITEMS: Record<string, string> = Object.fromEntries(
  Object.entries(ASR_PROVIDER_META).map(([id, m]) => [id, m.label]),
);
const LLM_ITEMS: Record<string, string> = Object.fromEntries(
  Object.entries(LLM_PROVIDER_META).map(([id, m]) => [id, m.label]),
);

const RETENTION_ITEMS: Record<AudioRetention, string> = {
  keep: 'Aufbewahren, bis ich sie lösche',
  afterApproval: 'Nach der Freigabe löschen',
  afterTranscription: 'Direkt nach der Übertragung löschen',
};

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof HardDrive;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div className="space-y-1.5">
        <h2 className="flex items-center gap-2.5 text-lg font-semibold">
          <Icon className="size-5 text-muted-foreground" aria-hidden />
          {title}
        </h2>
        <p className="max-w-[68ch] text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

/**
 * Access status, replacing the old "enter your own key" field.
 *
 * The keys now ship with the app, so there is nothing for HJ to type — but
 * "where does my access come from" still has to be answerable on screen, and a
 * missing key at build time has to be visible rather than showing up later as a
 * failed transcription.
 */
function KeyStatus({ present, label }: { present: boolean; label: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border px-4 py-3">
      <KeyRound className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-medium">{label}</span>
          {present ? (
            <Badge variant="secondary">Hinterlegt</Badge>
          ) : (
            <Badge variant="outline" className="text-destructive">
              Fehlt
            </Badge>
          )}
        </div>
        <p className="max-w-[68ch] text-sm text-muted-foreground">
          {present
            ? 'Der Zugang ist in der Anwendung fest hinterlegt. Sie müssen nichts eingeben.'
            : 'Für diesen Anbieter ist kein Zugang hinterlegt. Bitte geben Sie Bescheid — das lässt sich nur beim Erstellen der Anwendung ändern.'}
        </p>
      </div>
    </div>
  );
}

/** EU / non-EU is a decision HJ has to be able to see, not one buried in a doc. */
function RegionBadge({ euHosted }: { euHosted: boolean }) {
  return euHosted ? (
    <Badge variant="secondary">EU-Server</Badge>
  ) : (
    <Badge variant="outline">Server außerhalb der EU</Badge>
  );
}

export function SettingsPage() {
  const { settings, apiKeys, storage } = useSettingsStore();
  const update = useSettingsStore((s) => s.update);
  const enablePersistence = useSettingsStore((s) => s.enablePersistence);
  const hydrate = useSettingsStore((s) => s.hydrate);

  const [confirmText, setConfirmText] = useState('');

  const asrMeta = ASR_PROVIDER_META[settings.asrProviderId as AsrId];
  const llmMeta = LLM_PROVIDER_META[settings.llmProviderId];

  async function handlePersist() {
    const granted = await enablePersistence();
    if (granted) toast.success('Dauerhafte Speicherung ist aktiv.');
    else toast.error('Der Browser hat die dauerhafte Speicherung nicht gewährt.');
  }

  async function handleClearAll() {
    await clearAllData();
    await hydrate();
    setConfirmText('');
    toast.success('Alle Daten wurden gelöscht.');
  }

  return (
    <div className="space-y-12 pb-16">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Einstellungen</h1>
        <p className="max-w-[68ch] text-muted-foreground">
          Alle Angaben bleiben auf diesem Computer. Es gibt keinen Server und kein Konto.
        </p>
      </div>

      <Section
        icon={Languages}
        title="Spracherkennung"
        description="Wandelt Ihre Aufnahme in Text um. Der Zugang ist bereits eingerichtet."
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="asr-provider">Anbieter</FieldLabel>
            <div className="flex items-center gap-3">
              <Select
                items={ASR_ITEMS}
                value={settings.asrProviderId}
                onValueChange={(value) => void update({ asrProviderId: value as AsrId })}
              >
                <SelectTrigger id="asr-provider" className="h-10 w-[22rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ASR_PROVIDER_META).map(([id, meta]) => (
                    <SelectItem key={id} value={id}>
                      {meta.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <RegionBadge euHosted={asrMeta?.euHosted ?? false} />
            </div>
            {asrMeta && !asrMeta.euHosted ? (
              <FieldDescription>
                Bei diesem Anbieter verlassen die Audiodaten die EU. Für Patientendaten ist ein
                EU-Anbieter vorzuziehen.
              </FieldDescription>
            ) : null}
          </Field>

          <KeyStatus
            label="Zugang Spracherkennung"
            present={Boolean(apiKeys[settings.asrProviderId])}
          />
        </FieldGroup>
      </Section>

      <Separator />

      <Section
        icon={Sparkles}
        title="Textentwurf"
        description="Formuliert aus dem Transkript einen Entwurf in Ihrem Briefformat. Der Entwurf wird Ihnen immer zuerst zur Prüfung vorgelegt."
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="llm-provider">Anbieter</FieldLabel>
            <div className="flex items-center gap-3">
              <Select
                items={LLM_ITEMS}
                value={settings.llmProviderId}
                onValueChange={(value) => void update({ llmProviderId: value as LlmProviderId })}
              >
                <SelectTrigger id="llm-provider" className="h-10 w-[22rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LLM_PROVIDER_META).map(([id, meta]) => (
                    <SelectItem key={id} value={id}>
                      {meta.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <RegionBadge euHosted={llmMeta.euHosted} />
            </div>
          </Field>

          <KeyStatus
            label="Zugang Textentwurf"
            present={Boolean(apiKeys[settings.llmProviderId])}
          />
        </FieldGroup>
      </Section>

      <Separator />

      <Section
        icon={HardDrive}
        title="Speicher"
        description="Aufnahmen und Entwürfe liegen im Speicher dieses Browsers. Mit der dauerhaften Speicherung darf der Browser sie nicht selbstständig löschen."
      >
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
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
                  <Button size="lg" variant="outline" onClick={() => void handlePersist()}>
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
      </Section>

      <Separator />

      <Section
        icon={ShieldCheck}
        title="Aufbewahrung"
        description="Wie lange Tonaufnahmen und Entwürfe auf diesem Computer bleiben."
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="audio-retention">Tonaufnahmen</FieldLabel>
            <Select
              items={RETENTION_ITEMS}
              value={settings.audioRetention}
              onValueChange={(value) => void update({ audioRetention: value as AudioRetention })}
            >
              <SelectTrigger id="audio-retention" className="h-10 w-[26rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(RETENTION_ITEMS).map(([id, label]) => (
                  <SelectItem key={id} value={id}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>
              Solange die Aufnahme vorhanden ist, können Sie den erkannten Text mit dem Gesagten
              vergleichen.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="draft-retention">Entwürfe löschen nach</FieldLabel>
            <div className="flex items-center gap-3">
              <Input
                id="draft-retention"
                type="number"
                min={1}
                max={365}
                value={settings.draftRetentionDays}
                onChange={(e) => {
                  const days = Number(e.target.value);
                  if (Number.isFinite(days) && days >= 1 && days <= 365) {
                    void update({ draftRetentionDays: days });
                  }
                }}
                className="h-10 w-28 tabular-nums"
              />
              <span className="text-muted-foreground">Tagen nach dem Export</span>
            </div>
          </Field>
        </FieldGroup>
      </Section>

      <Separator />

      <Section
        icon={AlertTriangle}
        title="Alle Daten löschen"
        description="Entfernt alle Aufnahmen, Transkripte, Entwürfe und Begriffe unwiderruflich von diesem Computer."
      >
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
                Alle Aufnahmen, Transkripte und Entwürfe werden entfernt. Das
                lässt sich nicht rückgängig machen. Tippen Sie zur Bestätigung{' '}
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
              {/* Destructive variant: the confirm for an irreversible wipe
                  should not look like an ordinary primary action. */}
              <AlertDialogAction
                variant="destructive"
                disabled={confirmText !== 'LÖSCHEN'}
                onClick={() => void handleClearAll()}
              >
                Endgültig löschen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Section>
    </div>
  );
}
