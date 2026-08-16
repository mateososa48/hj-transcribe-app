import { useEffect, useState } from 'react';
import { FileText, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { db } from '@/lib/db.ts';
import { generateBeurteilung } from '@/lib/draft/generate.ts';
import { DraftError } from '@/lib/providers/index.ts';
import { LetterEditor } from './LetterEditor';

export interface LetterViewProps {
  sessionId: string | null;
  onOpenSettings: () => void;
}

export function LetterView({ sessionId, onOpenSettings }: LetterViewProps) {
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [vorbrief, setVorbrief] = useState('');
  const [warning, setWarning] = useState<string | null>(null);

  // Reattach to an existing document for this session, so switching tabs or
  // reloading does not look like the draft was lost.
  useEffect(() => {
    if (!sessionId) {
      setDocumentId(null);
      return;
    }
    void db.documents
      .where('sessionId')
      .equals(sessionId)
      .first()
      .then((d) => setDocumentId(d?.id ?? null));
  }, [sessionId]);

  async function generate() {
    if (!sessionId) return;
    setBusy(true);
    setWarning(null);
    try {
      const result = await generateBeurteilung(sessionId, {
        ...(vorbrief.trim() ? { vorbrief } : {}),
      });
      setDocumentId(result.document.id);

      if (result.exampleSource === 'dev') {
        // Say this out loud. A draft built on synthetic examples is not "his
        // voice", and silently implying otherwise is the worst failure here.
        setWarning(
          'Hinweis: Es liegen noch keine echten Musterbriefe vor. Der Entwurf orientiert sich an synthetischen Beispielen und trifft Ihren Stil daher noch nicht.',
        );
      }
      if (!result.wellFormed) {
        toast.warning('Das Ergebnis war unvollständig formatiert. Bitte prüfen Sie den Text genau.');
      }
      toast.success(`Entwurf erstellt (${Math.round(result.latencyMs / 100) / 10} s).`);
    } catch (error) {
      const message =
        error instanceof DraftError ? error.message : 'Der Entwurf konnte nicht erstellt werden.';
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  if (!sessionId) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileText aria-hidden />
          </EmptyMedia>
          <EmptyTitle className="text-lg">Noch kein Brief begonnen</EmptyTitle>
          <EmptyDescription>
            Nehmen Sie zuerst ein Diktat auf. Aus dem erkannten Text wird anschließend die
            Zusammenfassende Beurteilung erstellt.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (documentId) {
    return (
      <div className="space-y-6">
        {warning ? (
          <p className="rounded-lg bg-muted px-4 py-3 text-base">{warning}</p>
        ) : null}
        <LetterEditor
          documentId={documentId}
          regenerating={busy}
          onRegenerate={() => void generate()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Beurteilung erstellen</h1>
        <p className="max-w-[68ch] text-muted-foreground">
          Aus dem erkannten Text wird ein Entwurf der Zusammenfassenden Beurteilung erstellt. Sie
          prüfen und geben ihn anschließend frei.
        </p>
      </div>

      <Field>
        <FieldLabel htmlFor="vorbrief">Vorbrief einfügen (optional)</FieldLabel>
        <Textarea
          id="vorbrief"
          value={vorbrief}
          onChange={(e) => setVorbrief(e.target.value)}
          placeholder="Vorherigen Brief dieses Patienten hier einfügen …"
          className="min-h-40 text-base"
        />
        <FieldDescription>
          Wird nur als Zusammenhang verwendet — für Vergleiche mit Vorwerten und zur
          Fortschreibung von Diagnosen. Es wird nichts daraus übernommen, was das aktuelle Diktat
          nicht bestätigt.
        </FieldDescription>
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" disabled={busy} onClick={() => void generate()}>
          {busy ? <Spinner /> : <Sparkles aria-hidden />}
          {busy ? 'Entwurf wird erstellt …' : 'Entwurf erstellen'}
        </Button>
        <Button size="lg" variant="ghost" onClick={onOpenSettings}>
          Einstellungen
        </Button>
      </div>
    </div>
  );
}
