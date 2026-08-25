import { ArrowLeft } from 'lucide-react';

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
 * TERMINAL — the protocol machine. Monospace throughout, hairline single-pixel
 * frames, square corners, and a status line on every screen: ● REC 04:03.
 * Buttons read as [ Befehle ]. Dense, nüchtern, everything the same voice —
 * the aesthetic of a device that logs rather than an app that presents.
 */

function TermButton({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-9 items-center gap-2 whitespace-nowrap border border-foreground/40 bg-transparent px-3 font-mono text-sm transition-colors',
        'hover:bg-foreground hover:text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50',
        danger && 'border-destructive/60 text-destructive hover:bg-destructive hover:text-white',
      )}
    >
      {children}
    </button>
  );
}

function StatusLine({ left, right }: { left: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border border-foreground/30 bg-muted/40 px-3 py-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
      <span className="flex items-center gap-2">{left}</span>
      {right ? <span>{right}</span> : null}
    </div>
  );
}

function Editor({ resultId, initial }: { resultId: string; initial: string }) {
  const { text, update, copy, copied, areaRef } = useDiktatText(resultId, initial);
  return (
    <section className="border border-foreground/30">
      <div className="flex items-center justify-between gap-2 border-b border-foreground/30 px-3 py-2">
        <h2 className="min-w-0 truncate font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Zusammenfassende_Beurteilung
        </h2>
        <TermButton onClick={() => void copy()}>{copied ? '[ Kopiert ✓ ]' : '[ Kopieren ]'}</TermButton>
      </div>
      <Textarea
        ref={areaRef}
        value={text}
        onChange={(e) => update(e.target.value)}
        aria-label="Zusammenfassende Beurteilung"
        placeholder="Hier wurde nichts eingetragen — Sie können selbst ergänzen."
        className="min-h-44 rounded-none border-transparent bg-transparent px-4 py-3 font-mono text-[0.95rem] leading-[1.9] shadow-none focus-visible:border-transparent focus-visible:ring-0"
      />
    </section>
  );
}

function Session({ ctx }: { ctx: DiktatCtx }) {
  const blocked = ctx.state === 'live' || ctx.state === 'interrupted';
  return (
    <div className="space-y-4 pb-16 font-mono">
      <StatusLine
        left={
          <>
            <span aria-hidden>●</span> Diktat
          </>
        }
        right={`${ctx.dateLine}${ctx.durationLine ? ` · ${ctx.durationLine}` : ''}`}
      />

      <DiktatTitle ctx={ctx} className="font-mono text-xl font-semibold md:text-xl" />

      {ctx.state !== 'ready' ? <DiktatStatus ctx={ctx} /> : null}

      {!blocked ? (
        <div className="space-y-4">
          {ctx.result ? (
            <Editor resultId={ctx.result.id} initial={ctx.result.sections.beurteilung ?? ''} />
          ) : (
            <div className="border border-foreground/30 px-4 py-3">
              <DiktatEmptyText ctx={ctx} />
            </div>
          )}

          <section className="border border-foreground/30">
            <h2 className="border-b border-foreground/30 px-3 py-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Aufnahme
            </h2>
            <div className="px-4 py-3">
              <div className="[&_.rounded-lg]:rounded-none [&_.rounded-xl]:rounded-none">
                <SyncedPlayback
                  sessionId={ctx.session.id}
                  words={ctx.transcription?.words ?? []}
                  fallbackText={ctx.transcription?.text ?? ''}
                />
              </div>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-2">
            {ctx.result ? (
              <RegenerateControls
                session={ctx.session}
                result={ctx.result}
                running={ctx.running}
                onChanged={ctx.reload}
                className="gap-2 [&_button]:h-9 [&_button]:rounded-none [&_button]:border [&_button]:border-foreground/40 [&_button]:px-3 [&_button]:font-mono [&_button]:text-sm"
              />
            ) : null}
            <DeleteRecordingButton
              ctx={ctx}
              trigger={<TermButton danger>[ Löschen ]</TermButton>}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Record() {
  const r = useDiktatRecorder();
  return (
    <div className="space-y-4 font-mono">
      <button
        type="button"
        onClick={r.goHome}
        disabled={r.isRecording}
        className="inline-flex items-center gap-2 font-mono text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
      >
        <ArrowLeft className="size-4" aria-hidden />
        zurück
      </button>

      <StatusLine
        left={
          <>
            <span className={cn(r.isRecording && 'text-destructive motion-safe:animate-pulse')} aria-hidden>
              ●
            </span>
            {r.isRecording ? 'REC' : 'BEREIT'}
          </>
        }
        right={r.elapsed}
      />

      <div className="border border-foreground/30 px-6 py-10">
        <div className="flex flex-col items-center gap-7">
          <div className="text-7xl font-semibold tabular-nums tracking-tight">{r.elapsed}</div>
          <RecordingWave level={r.recording.level} state={r.orbState} className="h-24" />
          <RecorderNotices recording={r.recording} className="rounded-none" />
          <TermButton onClick={() => void r.toggle()} disabled={r.isBusy} danger={r.isRecording}>
            {r.isBusy ? <Spinner /> : null}
            {r.isRecording ? '[ ■ Diktat beenden ]' : '[ ● Aufnahme starten ]'}
          </TermButton>
          <p className="max-w-[52ch] text-center text-sm text-muted-foreground">
            {r.isRecording
              ? '// Die Aufnahme wird laufend auf diesem Computer gesichert.'
              : '// Sprechen Sie frei, wie zu einem Kollegen. Satzzeichen müssen Sie nicht mitsprechen.'}
          </p>
        </div>
      </div>
    </div>
  );
}

export const terminal: DiktatDesign = { Record, Session };
