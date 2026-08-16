import { useEffect, useState } from 'react';
import { FileText, Mic } from 'lucide-react';

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { ScrollArea } from '@/components/ui/scroll-area';
import { db } from '@/lib/db.ts';
import { assembleTranscript } from '@/lib/transcription/queue.ts';
import { LetterEditor } from './LetterEditor';
import { LetterView } from './LetterView';

/**
 * Review screen for the "Gegenüberstellung" layout: dictation on the left,
 * draft on the right.
 *
 * The source pane is deliberately read-only and plainly styled — it is
 * evidence, not another thing to edit. Its only job is to let him answer "did
 * I actually say that?" without holding the recording in his head.
 */
export function SplitLetterView({
  sessionId,
  onOpenSettings,
}: {
  sessionId: string | null;
  onOpenSettings: () => void;
}) {
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');

  useEffect(() => {
    if (!sessionId) {
      setDocumentId(null);
      setTranscript('');
      return;
    }
    void db.documents
      .where('sessionId')
      .equals(sessionId)
      .first()
      .then((d) => setDocumentId(d?.id ?? null));
    void assembleTranscript(sessionId).then(setTranscript);
  }, [sessionId]);

  // Before a draft exists there is nothing to compare, so fall back to the
  // ordinary single-column flow rather than showing an empty second pane.
  if (!sessionId || !documentId) {
    return (
      <div className="mx-auto h-full max-w-3xl overflow-y-auto px-6 py-10">
        <LetterView sessionId={sessionId} onOpenSettings={onOpenSettings} />
      </div>
    );
  }

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full">
      {/* Sizes are STRINGS on purpose: react-resizable-panels reads a bare
          number as pixels and a string as a percentage. */}
      <ResizablePanel defaultSize="38" minSize="22">
        <div className="flex h-full flex-col">
          <div className="flex shrink-0 items-center gap-2.5 border-b border-border px-6 py-3">
            <Mic className="size-4 text-muted-foreground" aria-hidden />
            <h2 className="text-sm font-semibold">Ihr Diktat</h2>
            <span className="ml-auto text-xs text-muted-foreground">unverändert</span>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="px-6 py-6">
              {transcript ? (
                <p className="max-w-[62ch] text-base leading-relaxed whitespace-pre-wrap text-muted-foreground">
                  {transcript}
                </p>
              ) : (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <FileText aria-hidden />
                    </EmptyMedia>
                    <EmptyTitle className="text-base">Kein erkannter Text</EmptyTitle>
                    <EmptyDescription>
                      Sobald die Übertragung abgeschlossen ist, erscheint hier Ihr Diktat.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </div>
          </ScrollArea>
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel defaultSize="62" minSize="35">
        <ScrollArea className="h-full">
          <div className="px-8 py-8">
            <LetterEditor
              documentId={documentId}
              regenerating={false}
              onRegenerate={() => {
                // Regeneration lives in the single-column flow, where the
                // Vorbrief field and the provider choice are also visible.
                setDocumentId(null);
              }}
            />
          </div>
        </ScrollArea>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
