import { useElapsed, useRecordingState } from '@/features/record/useRecording';
import { useStopRecording } from '@/features/record/useStopRecording';
import { useAppStore } from '@/store/app-store';
import { RecordingIndicatorBar, isRecordingVisible } from './recording-indicator-bar';

export { RecordingIndicatorBar, isRecordingVisible };

/** Wires the strip to the live recorder. Renders nothing when idle. */
export function RecordingIndicator() {
  const recording = useRecordingState();
  const view = useAppStore((s) => s.view);
  const startRecording = useAppStore((s) => s.startRecording);
  const { stop, stopping } = useStopRecording();
  const paused = recording.status === 'paused';
  const elapsed = useElapsed(
    recording.startedAt,
    recording.status === 'recording',
    // Freeze at the pause, not at endedAt — the strip's clock must agree with
    // the recorder screen's to the second.
    recording.pausedAt ?? recording.endedAt,
    recording.pausedMs,
  );

  if (!isRecordingVisible(recording.status)) return null;
  // The recorder screen already carries a clock and a stop button of its own;
  // a second one directly above it would be two controls for one action.
  if (view.name === 'record') return null;

  return (
    <RecordingIndicatorBar
      elapsed={elapsed}
      stopping={stopping}
      paused={paused}
      onOpen={() => startRecording(recording.kind ?? 'beurteilung')}
      onStop={() => void stop()}
    />
  );
}
