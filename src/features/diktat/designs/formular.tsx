import { ArrowLeft, Check, ClipboardCopy, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { RecordingWave } from '@/features/record/RecordingWave';
import { RegenerateControls } from '@/features/session/RegenerateControls';
import { SyncedPlayback } from '@/features/session/SyncedPlayback';
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
 * BEFUNDBOGEN — the clinical form. One hairline frame, and inside it the page
 * is nothing but labelled rows: Bezeichnung, Datum, Beurteilung, Aufnahme,
 * Aktionen. The sectioning IS the design — a fixed label column against a
 * content column, separated by the same quiet rule everywhere. What a
 * Formulardruck looks like when someone typesets it with care.
 */

function Row({
  label,
  children,
  actions,
}: {
  label: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="grid gap-2 px-6 py-5 sm:grid-cols-[10.5rem_1fr] sm:gap-8">
      <div className="flex items-start justify-between gap-2 sm:block">
        <div className="pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="sm:mt-3">{actions}</div>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Editor({ resultId, initial }: { resultId: string; initial: string }) {
  const { text, update, copy, copied, areaRef } = useDiktatText(resultId, initial);
  return (
    <Row
      label="Beurteilung"
      actions={
        <Button size="sm" variant={copied ? 'secondary' : 'outline'} onClick={() => void copy()}>
          {copied ? <Check aria-hidden /> : <ClipboardCopy aria-hidden />}
          {copied ? 'Kopiert' : 'Kopieren'}
        </Button>
      }
    >
      <Textarea
        ref={areaRef}
        value={text}
        onChange={(e) => update(e.target.value)}
        aria-label="Zusammenfassende Beurteilung"
        placeholder="Hier wurde nichts eingetragen — Sie können selbst ergänzen."
        className="min-h-40 rounded-none border-transparent bg-transparent p-0 leading-[1.85] shadow-none focus-visible:border-transparent focus-visible:ring-0 md:text-base"
      />
    </Row>
  );
}

function Session({ ctx }: { ctx: DiktatCtx }) {
  const blocked = ctx.state === 'live' || ctx.state === 'interrupted';
  return (
    <div className="space-y-6 pb-16">
      {ctx.state !== 'ready' ? <DiktatStatus ctx={ctx} /> : null}

      {!blocked ? (
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          <Row label="Bezeichnung">
            <DiktatTitle ctx={ctx} className="text-xl md:text-xl" />
          </Row>
          <Row label="Datum">
            <p className="pt-1 text-base">
              {ctx.dateLine}
              {ctx.durationLine ? (
                <span className="text-muted-foreground"> · {ctx.durationLine}</span>
              ) : null}
            </p>
          </Row>

          {ctx.result ? (
            <Editor resultId={ctx.result.id} initial={ctx.result.sections.beurteilung ?? ''} />
          ) : (
            <Row label="Beurteilung">
              <DiktatEmptyText ctx={ctx} />
            </Row>
          )}

          <Row label="Aufnahme">
            <SyncedPlayback
              sessionId={ctx.session.id}
              words={ctx.transcription?.words ?? []}
              fallbackText={ctx.transcription?.text ?? ''}
            />
          </Row>

          <Row label="Aktionen">
            <div className="flex flex-wrap items-center gap-3">
              {ctx.result ? (
                <RegenerateControls
                  session={ctx.session}
                  result={ctx.result}
                  running={ctx.running}
                  onChanged={ctx.reload}
                />
              ) : null}
              <DeleteRecordingButton
                ctx={ctx}
                trigger={
                  <Button variant="ghost" className="text-muted-foreground">
                    <Trash2 aria-hidden />
                    Löschen
                  </Button>
                }
              />
            </div>
          </Row>
        </div>
      ) : null}
    </div>
  );
}

function Record() {
  const r = useDiktatRecorder();
  return (
    <div className="space-y-6">
      <Button variant="ghost" size="lg" onClick={r.goHome} disabled={r.isRecording}>
        <ArrowLeft aria-hidden />
        Zurück
      </Button>

      <div className="divide-y divide-border rounded-lg border border-border bg-card">
        <Row label="Vorgang">
          <p className="pt-1 text-xl font-semibold tracking-tight">Diktat aufnehmen</p>
        </Row>
        <Row label="Aufnahme">
          <div className="flex flex-col items-start gap-5">
            <div className="text-6xl font-semibold tabular-nums tracking-tight">{r.elapsed}</div>
            <RecordingWave level={r.recording.level} state={r.orbState} className="h-24 w-full" />
            <RecorderNotices recording={r.recording} />
            <Button
              size="lg"
              disabled={r.isBusy}
              onClick={() => void r.toggle()}
              className={
                r.isRecording
                  ? 'btn-gloss h-13 bg-destructive px-8 text-lg text-white hover:bg-destructive/90'
                  : 'h-13 px-8 text-lg'
              }
            >
              {r.isBusy ? <Spinner /> : null}
              {r.isRecording ? 'Diktat beenden' : 'Aufnahme starten'}
            </Button>
          </div>
        </Row>
        <Row label="Hinweis">
          <p className="max-w-[56ch] pt-1 text-sm text-muted-foreground">
            {r.isRecording
              ? 'Die Aufnahme wird laufend auf diesem Computer gesichert.'
              : 'Sprechen Sie frei, wie zu einem Kollegen. Nach dem Diktat entsteht die Zusammenfassende Beurteilung — fertig zum Einfügen in Word.'}
          </p>
        </Row>
      </div>
    </div>
  );
}

export const formular: DiktatDesign = { Record, Session };
