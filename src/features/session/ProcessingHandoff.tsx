import { Check } from 'lucide-react';
import type { CSSProperties } from 'react';

import type { SessionKind } from '@/lib/db';
import {
  getProcessingHandoffCopy,
  type ActiveProcessingPhase,
} from './processing-handoff-model';
import styles from './ProcessingHandoff.module.css';

type MotionProperties = CSSProperties & Record<`--${string}`, string | number>;

const AUDIO_BAR_INDICES = [0, 1, 2, 3, 4] as const;
const PACKET_INDICES = [0, 1, 2] as const;
const DOCUMENT_LINE_WIDTHS = [88, 72, 92, 62, 78] as const;

export function ProcessingHandoff({
  kind,
  phase,
}: {
  kind: SessionKind;
  phase: ActiveProcessingPhase;
}) {
  const copy = getProcessingHandoffCopy(kind, phase);

  return (
    <section
      role="status"
      aria-live="polite"
      aria-label={copy.title}
      className={styles.shell}
    >
      <HandoffDiagram phase={phase} />
    </section>
  );
}

function HandoffDiagram({ phase }: { phase: ActiveProcessingPhase }) {
  return (
    <div className={styles.diagram} data-phase={phase} aria-hidden>
      <div className={styles.source}>
        <div className={styles.audioGlyph}>
          {AUDIO_BAR_INDICES.map((index) => (
            <span key={index} style={{ '--index': index } as MotionProperties} />
          ))}
        </div>
        <div className={styles.transcriptGlyph}>
          <span />
          <span />
          <span />
          <Check />
        </div>
      </div>

      <div className={styles.rail}>
        {PACKET_INDICES.map((index) => (
          <span
            key={index}
            className={styles.packet}
            style={{ '--index': index } as MotionProperties}
          />
        ))}
      </div>

      <div className={styles.document}>
        <span className={styles.documentHeading} />
        {DOCUMENT_LINE_WIDTHS.map((width, index) => (
          <span
            key={`${width}-${index}`}
            className={styles.documentLine}
            style={{ '--line-width': `${width}%`, '--index': index } as MotionProperties}
          />
        ))}
      </div>

    </div>
  );
}
