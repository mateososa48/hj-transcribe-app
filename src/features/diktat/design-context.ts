import type * as React from 'react';

import type { Result, Session, Transcription } from '@/lib/db';

/**
 * Everything a Diktat result page knows and can do, computed once by
 * SessionView. The ten design experiments are pure looks over this one
 * contract — none of them owns data loading, pipeline state or persistence.
 */
export interface DiktatCtx {
  session: Session;
  transcription: Transcription | null;
  result: Result | null;

  title: string;
  setTitle: (value: string) => void;
  saveTitle: () => Promise<void>;

  /** "Montag, 24. August" */
  dateLine: string;
  /** "4:03 min" or '' */
  durationLine: string;

  state: 'live' | 'interrupted' | 'processing' | 'failed' | 'ready';
  phase: 'transcribing' | 'notes' | null;
  errorText: string;
  /** Transcript exists but no text yet — offer the Erstellen button. */
  canGenerate: boolean;
  /** Pipeline busy — disable regenerate etc. */
  running: boolean;

  retry: () => void;
  recover: () => Promise<void>;
  reload: () => void;
}

/**
 * One design experiment: the finished-Diktat page. Only the result page is
 * under experiment — the recorder and the sidebar are settled and shipped.
 */
export type DiktatDesign = React.FC<{ ctx: DiktatCtx }>;
