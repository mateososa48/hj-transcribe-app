import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, ClipboardCopy, Lock, RefreshCw } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { db, SECTION_LABELS, type LetterDocument } from '@/lib/db.ts';
import { extractFehltMarkers } from '../../../prompts/beurteilung.ts';
import { applyApprovalRetention, approveDocument, saveSection } from '@/lib/draft/generate.ts';
import { logAudit } from '@/lib/db.ts';
import { TranslationPanel } from './TranslationPanel';

const AUTOSAVE_MS = 800;

export interface LetterEditorProps {
  documentId: string;
  onRegenerate: () => void;
  regenerating: boolean;
}

export function LetterEditor({ documentId, onRegenerate, regenerating }: LetterEditorProps) {
  const [doc, setDoc] = useState<LetterDocument | null>(null);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void db.documents.get(documentId).then((d) => {
      if (!d) return;
      setDoc(d);
      setText(d.sections.beurteilung);
    });
  }, [documentId]);

  /**
   * Debounced autosave. He types slowly and reviews carefully; losing four
   * minutes of edits to a stray reload once would end adoption, so the working
   * copy is written continuously rather than on an explicit save.
   */
  const scheduleSave = useCallback(
    (next: string) => {
      if (timer.current) clearTimeout(timer.current);
      setSaving(true);
      timer.current = setTimeout(async () => {
        await saveSection(documentId, 'beurteilung', next);
        setSaving(false);
      }, AUTOSAVE_MS);
    },
    [documentId],
  );

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  if (!doc) {
    return (
      <div className="flex items-center gap-3 text-muted-foreground">
        <Spinner /> Entwurf wird geladen …
      </div>
    );
  }

  const approved = doc.status !== 'entwurf';
  const fehlt = extractFehltMarkers(text);
  const edited = doc.originalDraft ? text.trim() !== doc.originalDraft.beurteilung.trim() : false;

  async function handleApprove() {
    // Flush any pending keystrokes before freezing the document.
    if (timer.current) clearTimeout(timer.current);
    await saveSection(documentId, 'beurteilung', text);
    await approveDocument(documentId);
    const cleared = await applyApprovalRetention(documentId);
    const updated = await db.documents.get(documentId);
    if (updated) setDoc(updated);
    toast.success(
      cleared > 0
        ? `Freigegeben. ${cleared} Tonaufnahme${cleared === 1 ? '' : 'n'} wurde${cleared === 1 ? '' : 'n'} gelöscht.`
        : 'Freigegeben. Sie können den Text jetzt kopieren.',
    );
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    await logAudit('draft.copied', { documentId, detail: 'beurteilung' });
    toast.success('Text in die Zwischenablage kopiert.');
  }

  return (
    <div className="space-y-6">
      {/* Status sits beside the title, not under the description — it is a
          property of the document, not a footnote to the instructions. */}
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{SECTION_LABELS.beurteilung}</h1>
          {approved ? (
            <Badge variant="secondary" className="text-base">
              <Check className="size-4" aria-hidden />
              Freigegeben
            </Badge>
          ) : (
            <Badge variant="outline" className="text-base">
              Entwurf
            </Badge>
          )}
        </div>
        <p className="max-w-[68ch] text-muted-foreground">
          Bitte lesen und korrigieren Sie den Entwurf. Erst nach der Freigabe kann er kopiert
          werden.
        </p>
      </div>

      {/* Gaps are surfaced as a checklist, not left for him to spot in prose.
          They are the model correctly refusing to guess — the one thing he
          must resolve himself before this goes out. */}
      {fehlt.length > 0 ? (
        <div className="space-y-2 rounded-lg bg-muted px-4 py-3">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="size-5" aria-hidden />
            {fehlt.length} fehlende Angabe{fehlt.length === 1 ? '' : 'n'}
          </p>
          <ul className="ml-7 list-disc space-y-1 text-base">
            {fehlt.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            Diese Angaben standen nicht im Diktat. Bitte ergänzen Sie sie oder entfernen Sie die
            Markierung.
          </p>
        </div>
      ) : null}

      <Textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          scheduleSave(e.target.value);
        }}
        readOnly={approved}
        aria-label="Zusammenfassende Beurteilung"
        // The base textarea already sets field-sizing:content, so it grows with
        // the text. A tall min-height would defeat that and leave a large empty
        // box under a two-line draft.
        className="min-h-56 text-base leading-relaxed"
      />

      <div className="flex flex-wrap items-center gap-3">
        {!approved ? (
          <Button size="lg" onClick={() => void handleApprove()}>
            <Check aria-hidden />
            Freigeben
          </Button>
        ) : null}

        <Button
          size="lg"
          variant={approved ? 'default' : 'outline'}
          disabled={!approved}
          onClick={() => void handleCopy()}
        >
          {approved ? <ClipboardCopy aria-hidden /> : <Lock aria-hidden />}
          Kopieren
        </Button>

        {/* Regenerating throws away his edits, so it asks first — and only when
            there is something to lose. */}
        {edited && !approved ? (
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button size="lg" variant="ghost" disabled={regenerating}>
                  {regenerating ? <Spinner /> : <RefreshCw aria-hidden />}
                  Neu erstellen
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Ihre Änderungen verwerfen?</AlertDialogTitle>
                <AlertDialogDescription>
                  Sie haben den Entwurf bearbeitet. Wenn Sie ihn neu erstellen lassen, gehen Ihre
                  Änderungen verloren.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={onRegenerate}>
                  Verwerfen und neu erstellen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : !approved ? (
          <Button size="lg" variant="ghost" disabled={regenerating} onClick={onRegenerate}>
            {regenerating ? <Spinner /> : <RefreshCw aria-hidden />}
            Neu erstellen
          </Button>
        ) : null}

        <span className="text-sm text-muted-foreground" aria-live="polite">
          {saving ? 'Wird gespeichert …' : approved ? '' : 'Automatisch gespeichert'}
        </span>
      </div>

      {approved ? (
        <p className="text-sm text-muted-foreground">
          Der Brief ist freigegeben und wird nicht mehr verändert. Für Korrekturen erstellen Sie
          bitte einen neuen Entwurf.
        </p>
      ) : null}

      <Separator />

      <TranslationPanel
        documentId={documentId}
        approved={approved}
        {...(doc.translations ? { translations: doc.translations } : { translations: undefined })}
        onTranslated={async () => {
          const updated = await db.documents.get(documentId);
          if (updated) setDoc(updated);
        }}
      />
    </div>
  );
}
