import { useState } from 'react';
import { AlertTriangle, ClipboardCopy, Check, Languages, Lock } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { logAudit, type TranslationRecord } from '@/lib/db.ts';
import { TARGET_LANGUAGES, translateBeurteilung } from '@/lib/draft/translate.ts';
import { DraftError } from '@/lib/providers/index.ts';

const LANGUAGE_ITEMS: Record<string, string> = Object.fromEntries(
  TARGET_LANGUAGES.map((l) => [l.code, l.label]),
);

export interface TranslationPanelProps {
  documentId: string;
  /** Copying is gated on Freigeben, exactly like the German text. */
  approved: boolean;
  translations: Record<string, TranslationRecord> | undefined;
  onTranslated: () => void | Promise<void>;
}

export function TranslationPanel({
  documentId,
  approved,
  translations,
  onTranslated,
}: TranslationPanelProps) {
  const [language, setLanguage] = useState('en');
  const [busy, setBusy] = useState(false);

  const current = translations?.[language];
  const languageLabel = LANGUAGE_ITEMS[language] ?? language;
  const problems = current
    ? [...current.missingNumbers, ...current.missingDosing]
    : [];

  async function handleTranslate() {
    setBusy(true);
    try {
      const { verified } = await translateBeurteilung(documentId, language);
      await onTranslated();
      toast[verified ? 'success' : 'warning'](
        verified
          ? `Übersetzung (${languageLabel}) erstellt.`
          : `Übersetzung erstellt — bitte die markierten Werte prüfen.`,
      );
    } catch (error) {
      toast.error(
        error instanceof DraftError ? error.message : 'Die Übersetzung ist fehlgeschlagen.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    if (!current) return;
    await navigator.clipboard.writeText(current.text);
    await logAudit('draft.copied', { documentId, detail: `uebersetzung:${language}` });
    toast.success('Übersetzung kopiert.');
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="flex items-center gap-2.5 text-lg font-semibold">
          <Languages className="size-5 text-muted-foreground" aria-hidden />
          Übersetzung
        </h2>

        <Select
          items={LANGUAGE_ITEMS}
          value={language}
          onValueChange={(value) => setLanguage(value as string)}
        >
          <SelectTrigger id="translate-language" className="h-10 w-52" aria-label="Zielsprache">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TARGET_LANGUAGES.map((l) => (
              <SelectItem key={l.code} value={l.code}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button size="lg" variant="outline" disabled={busy} onClick={() => void handleTranslate()}>
          {busy ? <Spinner /> : <Languages aria-hidden />}
          {current ? 'Neu übersetzen' : 'Übersetzen'}
        </Button>
      </div>

      {!current ? (
        <p className="max-w-[68ch] text-sm text-muted-foreground">
          Übersetzt die Zusammenfassende Beurteilung. Zahlen, Dosierungen und Präparatenamen
          werden unverändert übernommen und anschließend automatisch gegengeprüft.
        </p>
      ) : (
        <div className="space-y-3">
          {/* The check is the point of this feature. A translation that quietly
              dropped a dose reads fluently, so the discrepancy is surfaced
              above the text rather than left to be spotted. */}
          {problems.length > 0 ? (
            <div
              role="alert"
              className="space-y-1.5 rounded-lg bg-destructive/10 px-4 py-3 text-destructive"
            >
              <p className="flex items-center gap-2 font-medium">
                <AlertTriangle className="size-5 shrink-0" aria-hidden />
                {problems.length} Wert{problems.length === 1 ? '' : 'e'} nicht wiedergefunden
              </p>
              <p className="text-sm">
                Diese Angaben stehen im deutschen Text, aber nicht in der Übersetzung:{' '}
                <span className="font-medium">{problems.join(', ')}</span>. Bitte vergleichen Sie
                die beiden Fassungen, bevor Sie die Übersetzung verwenden.
              </p>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="size-4" aria-hidden />
              Alle Zahlen und Dosierungen wurden unverändert übernommen.
            </p>
          )}

          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
            <p className="whitespace-pre-wrap text-base leading-relaxed">{current.text}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              variant={approved ? 'default' : 'outline'}
              disabled={!approved}
              onClick={() => void handleCopy()}
            >
              {approved ? <ClipboardCopy aria-hidden /> : <Lock aria-hidden />}
              Übersetzung kopieren
            </Button>
            {!approved ? (
              <span className="text-sm text-muted-foreground">
                Erst nach der Freigabe des deutschen Textes kopierbar.
              </span>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
