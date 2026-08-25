import { ArrowLeft, Check, ClipboardCopy, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { RecordingWave } from '@/features/record/RecordingWave';
import { RegenerateControls } from '@/features/session/RegenerateControls';
import { SyncedPlayback } from '@/features/session/SyncedPlayback';
import { cn } from '@/lib/utils';
import type { DiktatCtx, DiktatDesign } from '../design-context';
import {
  DeleteRecordingButton,
  DiktatEmptyText,
  DiktatStatus,
  DiktatTitle,
  RecorderNotices,
} from '../design-shared';
import { useDiktatRecorder } from '../useDiktatRecorder';
import { useDiktatText } from '../useDiktatText';

/**
 * KARTEIKARTE — the patient index card. One hard-edged card, 2-px rules,
 * zero corner radius, content organised into stamped section bands the way a
 * paper Karteikarte separates Befund from Verlauf. The design language is
 * borders: everything the eye needs is drawn, nothing is implied by shadow.
 */

/** The section band: a labelled rule, exactly like a printed card divider. */
function Band({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-y-2 border-foreground bg-muted px-5 py-2">
      <h2 className="text-xs font-bold uppercase tracking-[0.16em]">{children}</h2>
      {actions}
    </div>
  );
}

const squareBtn =
  'h-8 rounded-none border-2 border-foreground bg-background px-3 text-xs font-bold uppercase tracking-wider text-foreground shadow-none hover:bg-foreground hover:text-background';

function Editor({ resultId, initial }: { resultId: string; initial: string }) {
  const { text, update, copy, copied, areaRef } = useDiktatText(resultId, initial);
  return (
    <>
      <Band
        actions={
          <Button size="sm" className={squareBtn} onClick={() => void copy()}>
            {copied ? <Check aria-hidden /> : <ClipboardCopy aria-hidden />}
            {copied ? 'Kopiert' : 'Kopieren'}
          </Button>
        }
      >
        Zusammenfassende Beurteilung
      </Band>
      <Textarea
        ref={areaRef}
        value={text}
        onChange={(e) => update(e.target.value)}
        aria-label="Zusammenfassende Beurteilung"
        placeholder="Hier wurde nichts eingetragen — Sie können selbst ergänzen."
        className="min-h-40 rounded-none border-transparent bg-transparent px-5 py-4 leading-[1.85] shadow-none focus-visible:border-transparent focus-visible:ring-0 md:text-base"
      />
    </>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="border-2 border-foreground bg-background">{children}</div>;
}

function Session({ ctx }: { ctx: DiktatCtx }) {
  const blocked = ctx.state === 'live' || ctx.state === 'interrupted';
  return (
    <div className="space-y-6 pb-16">
      <Frame>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
          <span className="border-2 border-foreground px-2 py-0.5 text-xs font-bold uppercase tracking-[0.2em]">
            Diktat
          </span>
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {ctx.dateLine}
            {ctx.durationLine ? ` · ${ctx.durationLine}` : ''}
          </p>
        </div>
        <div className="border-t-2 border-foreground px-5 py-3">
          <DiktatTitle ctx={ctx} className="rounded-none" />
        </div>

        {blocked ? (
          <div className="border-t-2 border-foreground p-5">
            <DiktatStatus ctx={ctx} />
          </div>
        ) : (
          <>
            {ctx.state !== 'ready' ? (
              <div className="border-t-2 border-foreground p-5">
                <DiktatStatus ctx={ctx} />
              </div>
            ) : null}

            {ctx.result ? (
              <Editor resultId={ctx.result.id} initial={ctx.result.sections.beurteilung ?? ''} />
            ) : (
              <>
                <Band>Zusammenfassende Beurteilung</Band>
                <div className="px-5 py-4">
                  <DiktatEmptyText ctx={ctx} />
                </div>
              </>
            )}

            <Band>Aufnahme</Band>
            <div className="px-5 py-4">
              <div className="[&_.rounded-lg]:rounded-none [&_.rounded-xl]:rounded-none">
                <SyncedPlayback
                  sessionId={ctx.session.id}
                  words={ctx.transcription?.words ?? []}
                  fallbackText={ctx.transcription?.text ?? ''}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-foreground px-3 py-2">
              {ctx.result ? (
                <RegenerateControls
                  session={ctx.session}
                  result={ctx.result}
                  running={ctx.running}
                  onChanged={ctx.reload}
                />
              ) : (
                <span />
              )}
              <DeleteRecordingButton
                ctx={ctx}
                trigger={
                  <Button variant="ghost" className="rounded-none text-muted-foreground">
                    <Trash2 aria-hidden />
                    Löschen
                  </Button>
                }
              />
            </div>
          </>
        )}
      </Frame>
    </div>
  );
}

function Record() {
  const r = useDiktatRecorder();
  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="lg"
        className="rounded-none"
        onClick={r.goHome}
        disabled={r.isRecording}
      >
        <ArrowLeft aria-hidden />
        Zurück
      </Button>

      <Frame>
        <div className="flex items-center justify-between gap-3 border-b-2 border-foreground bg-muted px-5 py-2">
          <h1 className="text-xs font-bold uppercase tracking-[0.16em]">Diktat — Aufnahme</h1>
          {r.isRecording ? (
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-destructive">
              <span className="size-2.5 bg-destructive motion-safe:animate-pulse" aria-hidden />
              Läuft
            </span>
          ) : null}
        </div>

        <div className="flex flex-col items-center gap-6 px-6 py-10">
          <div className="font-mono text-6xl font-semibold tabular-nums tracking-tight sm:text-7xl">
            {r.elapsed}
          </div>
          <RecordingWave level={r.recording.level} state={r.orbState} className="h-28" />
          <RecorderNotices recording={r.recording} className="rounded-none" />
          <Button
            size="lg"
            disabled={r.isBusy}
            onClick={() => void r.toggle()}
            className={cn(
              'h-13 rounded-none border-2 border-foreground bg-foreground px-8 text-base font-bold uppercase tracking-wider text-background shadow-none hover:bg-background hover:text-foreground',
              r.isRecording &&
                'border-destructive bg-destructive text-white hover:bg-background hover:text-destructive',
            )}
          >
            {r.isBusy ? <Spinner /> : null}
            {r.isRecording ? 'Diktat beenden' : 'Aufnahme starten'}
          </Button>
        </div>

        <p className="border-t-2 border-foreground px-5 py-3 text-sm text-muted-foreground">
          {r.isRecording
            ? 'Die Aufnahme wird laufend auf diesem Computer gesichert.'
            : 'Sprechen Sie frei, wie zu einem Kollegen. Satzzeichen müssen Sie nicht mitsprechen.'}
        </p>
      </Frame>
    </div>
  );
}

export const karteikarte: DiktatDesign = { Record, Session };
