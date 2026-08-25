import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Gauge, Pause, Play, RefreshCw, Sparkles } from 'lucide-react';

import {
  getLabStage,
  getMotionClassName,
  LAB_STAGES,
  nextPlaybackSpeed,
  type PlaybackSpeed,
} from './model';

const CYCLE_MS = 9_000;

type MotionVars = CSSProperties & Record<`--${string}`, string | number>;

const CONCEPTS: readonly {
  number: string;
  name: string;
  thesis: string;
  tag: string;
  visual: ReactNode;
}[] = [
  {
    number: '01',
    name: 'Signal → Satz',
    thesis: 'Die Stimme richtet sich sichtbar zu lesbarem Text aus.',
    tag: 'Transformation',
    visual: <SignalToSentence />,
  },
  {
    number: '02',
    name: 'Klinischer Setzer',
    thesis: 'Ein präziser Satzspiegel entsteht Zeile für Zeile.',
    tag: 'Typografie',
    visual: <ClinicalTypesetter />,
  },
  {
    number: '03',
    name: 'Übergabe',
    thesis: 'Die Aufnahme wandert kontrolliert in das Dokument.',
    tag: 'Pipeline',
    visual: <EvidenceHandoff />,
  },
  {
    number: '04',
    name: 'Fokus-Scan',
    thesis: 'Unscharfe Rohdaten werden in einem ruhigen Durchlauf klar.',
    tag: 'Auflösung',
    visual: <FocusScan />,
  },
  {
    number: '05',
    name: 'Prozesslinie',
    thesis: 'Drei explizite Stationen machen den Fortschritt unmissverständlich.',
    tag: 'Orientierung',
    visual: <PipelineRail />,
  },
  {
    number: '06',
    name: 'Transkript-Montage',
    thesis: 'Gesprächsfragmente finden ihre Stelle im klinischen Bericht.',
    tag: 'Struktur',
    visual: <TranscriptAssembly />,
  },
  {
    number: '07',
    name: 'Sprecher-Gewebe',
    thesis: 'Zwei Gesprächsfäden werden zu einer gemeinsamen Dokumentation.',
    tag: 'Diarisierung',
    visual: <SpeakerWeave />,
  },
  {
    number: '08',
    name: 'Korrekturlauf',
    thesis: 'Eine leise redaktionelle Prüfung bestätigt Abschnitt für Abschnitt.',
    tag: 'Sorgfalt',
    visual: <ProofreaderPass />,
  },
  {
    number: '09',
    name: 'Dokument-Puls',
    thesis: 'Das Dokument bleibt als ruhiger, lebendiger Arbeitskörper präsent.',
    tag: 'Präsenz',
    visual: <DocumentPulse />,
  },
  {
    number: '10',
    name: 'Randfortschritt',
    thesis: 'Der Fortschritt lebt dort, wo er später im Dokument gebraucht wird.',
    tag: 'Editorial',
    visual: <MarginProgress />,
  },
];

export function MotionLab() {
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [elapsed, setElapsed] = useState(0);
  const [runId, setRunId] = useState(0);
  const lastFrame = useRef<number | null>(null);

  useEffect(() => {
    let frame = 0;
    const tick = (now: number) => {
      if (lastFrame.current === null) lastFrame.current = now;
      const delta = now - lastFrame.current;
      lastFrame.current = now;
      if (!paused) setElapsed((value) => (value + delta * speed) % CYCLE_MS);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [paused, speed, runId]);

  const progress = elapsed / CYCLE_MS;
  const stage = getLabStage(progress);
  const stageNumber = LAB_STAGES.findIndex((item) => item.id === stage.id) + 1;
  const fieldClassName = useMemo(
    () => getMotionClassName({ paused, speed, reduced }),
    [paused, speed, reduced],
  );

  function replay() {
    setElapsed(0);
    lastFrame.current = null;
    setRunId((value) => value + 1);
  }

  return (
    <div className="lab-shell">
      <div className="ambient ambient-one" aria-hidden />
      <div className="ambient ambient-two" aria-hidden />

      <header className="lab-header">
        <div className="eyebrow"><span /> Processing / Motion Lab</div>
        <div className="header-grid">
          <div>
            <h1>Zehn Arten,<br />Warten sichtbar zu machen.</h1>
            <p className="intro">
              Ein lokales Versuchsfeld für den Moment zwischen gesprochener Aufnahme und fertigem
              klinischen Text. Keine API, keine Patientendaten — nur Motion.
            </p>
          </div>

          <section className="master-status" aria-label="Aktueller simulierter Verarbeitungsschritt">
            <div className="status-index">0{stageNumber}<span>/04</span></div>
            <div className="status-copy">
              <span>Aktueller Schritt</span>
              <strong aria-live="polite">{stage.label}</strong>
            </div>
            <div className="master-track" aria-hidden>
              <span style={{ transform: `scaleX(${progress})` }} />
            </div>
          </section>
        </div>

        <div className="control-deck" aria-label="Animationssteuerung">
          <div className="control-cluster">
            <button type="button" onClick={replay}>
              <RefreshCw aria-hidden />
              Neu starten
            </button>
            <button type="button" onClick={() => setPaused((value) => !value)} aria-pressed={paused}>
              {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
              {paused ? 'Fortsetzen' : 'Pausieren'}
            </button>
          </div>
          <div className="control-cluster control-cluster-right">
            <button
              type="button"
              onClick={() => setSpeed(nextPlaybackSpeed(speed))}
              aria-label={`Geschwindigkeit ändern, aktuell ${String(speed).replace('.', ',')}fach`}
            >
              <Gauge aria-hidden />
              {String(speed).replace('.', ',')}×
            </button>
            <button
              type="button"
              onClick={() => setReduced((value) => !value)}
              aria-pressed={reduced}
              className={reduced ? 'is-active' : undefined}
            >
              <Sparkles aria-hidden />
              Reduzierte Bewegung
            </button>
          </div>
        </div>
      </header>

      <main key={runId} className={`motion-field ${fieldClassName}`}>
        {CONCEPTS.map((concept) => (
          <ConceptCard key={concept.number} {...concept} />
        ))}
      </main>

      <footer className="lab-footer">
        <span>Arztbrief-Assistent / lokale Studie</span>
        <p>Glas ist hier Versuchsmaterial. Die Produktoberfläche bleibt eine eigene Entscheidung.</p>
      </footer>
    </div>
  );
}

function ConceptCard({
  number,
  name,
  thesis,
  tag,
  visual,
}: {
  number: string;
  name: string;
  thesis: string;
  tag: string;
  visual: ReactNode;
}) {
  return (
    <article className="concept-card">
      <div className="card-topline">
        <span className="concept-number">{number}</span>
        <span className="concept-tag">{tag}</span>
      </div>
      <div className="card-copy">
        <h2>{name}</h2>
        <p>{thesis}</p>
      </div>
      <div className="motion-stage">{visual}</div>
      <div className="card-foot">
        <span className="live-dot" aria-hidden />
        Synchronisierter Ablauf · 9 Sekunden
      </div>
    </article>
  );
}

function SignalToSentence() {
  const segments = [
    ['-88px', '0.45', '-42px', '1.1'], ['-62px', '0.82', '-14px', '1.65'],
    ['-36px', '0.58', '14px', '1.35'], ['-10px', '1', '42px', '1.8'],
    ['16px', '0.72', '-42px', '1.35'], ['42px', '0.5', '-14px', '1.5'],
    ['68px', '0.88', '14px', '1.12'], ['94px', '0.6', '42px', '1.55'],
  ];
  return (
    <div className="signal-sentence">
      <div className="signal-baseline" />
      {segments.map(([x, h, y, w], index) => (
        <span
          key={index}
          className="signal-segment moving"
          style={{ '--x': x, '--h': h, '--y': y, '--w': w, '--i': index } as MotionVars}
        />
      ))}
      <span className="signal-caption moving">AUFNAHME</span>
      <span className="sentence-caption moving">ZUSAMMENFASSUNG</span>
    </div>
  );
}

function ClinicalTypesetter() {
  return (
    <div className="typesetter">
      <div className="type-page">
        <span className="page-rule" />
        {[88, 72, 92, 64, 80].map((width, index) => (
          <span key={width} className="type-line moving" style={{ '--w': `${width}%`, '--i': index } as MotionVars} />
        ))}
        <span className="type-caret moving" />
      </div>
      <div className="page-folio">BEURTEILUNG · 01</div>
    </div>
  );
}

function EvidenceHandoff() {
  return (
    <div className="handoff">
      <div className="handoff-source">
        <span className="source-ring moving" />
        <div className="source-bars">{[1, 2, 3, 4, 5].map((item) => <i key={item} className="moving" />)}</div>
      </div>
      <div className="handoff-path">
        {[0, 1, 2, 3].map((item) => <span key={item} className="handoff-particle moving" style={{ '--i': item } as MotionVars} />)}
      </div>
      <div className="handoff-document">
        <span className="doc-fold" />
        {[74, 88, 58].map((width, index) => <i key={width} className="moving" style={{ '--w': `${width}%`, '--i': index } as MotionVars} />)}
      </div>
      <span className="handoff-label source-label">TON</span>
      <span className="handoff-label document-label">TEXT</span>
    </div>
  );
}

function FocusScan() {
  return (
    <div className="focus-scan">
      <div className="scan-copy scan-copy-muted">
        {[83, 92, 68, 88, 54].map((width) => <span key={width} style={{ width: `${width}%` }} />)}
      </div>
      <div className="scan-copy scan-copy-sharp">
        {[83, 92, 68, 88, 54].map((width, index) => <span key={width} className="moving" style={{ '--w': `${width}%`, '--i': index } as MotionVars} />)}
      </div>
      <span className="scan-beam moving" />
      <div className="scan-marks"><span>ROH</span><span>KLAR</span></div>
    </div>
  );
}

function PipelineRail() {
  const nodes = ['TON', 'TEXT', 'NOTIZ'];
  return (
    <div className="pipeline-rail">
      <div className="rail-line"><span className="rail-fill moving" /></div>
      <span className="rail-pulse moving" />
      <div className="rail-nodes">
        {nodes.map((node, index) => (
          <div key={node} className="rail-node">
            <span className="node-ring" style={{ '--i': index } as MotionVars}><i className="moving" /></span>
            <strong>{node}</strong>
            <small>0{index + 1}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function TranscriptAssembly() {
  const pieces = [
    ['-88px', '-58px', '52%'], ['42px', '-42px', '72%'], ['-66px', '18px', '84%'],
    ['54px', '34px', '60%'], ['-18px', '64px', '76%'],
  ];
  return (
    <div className="transcript-assembly">
      <div className="assembly-page" />
      {pieces.map(([x, y, w], index) => (
        <span key={index} className="assembly-piece moving" style={{ '--x': x, '--y': y, '--w': w, '--i': index } as MotionVars}>
          <i />
        </span>
      ))}
      <span className="assembly-title moving">ANAMNESE</span>
    </div>
  );
}

function SpeakerWeave() {
  return (
    <div className="speaker-weave">
      <div className="speaker-column speaker-a">
        <strong>A</strong>
        {[64, 48, 70].map((width, index) => <span key={width} className="moving" style={{ '--w': `${width}px`, '--i': index } as MotionVars} />)}
      </div>
      <div className="weave-core">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <i
            key={item}
            className="weave-thread moving"
            style={{ '--i': item, '--from': item % 2 === 0 ? '-85px' : '85px' } as MotionVars}
          />
        ))}
      </div>
      <div className="speaker-column speaker-b">
        <strong>B</strong>
        {[54, 72, 44].map((width, index) => <span key={width} className="moving" style={{ '--w': `${width}px`, '--i': index } as MotionVars} />)}
      </div>
      <div className="woven-document moving"><span /><span /><span /></div>
    </div>
  );
}

function ProofreaderPass() {
  return (
    <div className="proofreader">
      <div className="proof-page">
        {['Zusammenfassung', 'Diagnosen', 'Medikation'].map((label, index) => (
          <div key={label} className="proof-row">
            <span className="proof-check moving" style={{ '--i': index } as MotionVars}>✓</span>
            <div><strong>{label}</strong><i className="moving" style={{ '--i': index } as MotionVars} /></div>
          </div>
        ))}
      </div>
      <span className="proof-sweep moving" />
      <span className="proof-note moving">GEPRÜFT</span>
    </div>
  );
}

function DocumentPulse() {
  return (
    <div className="document-pulse">
      <span className="pulse-halo moving" />
      <div className="pulse-sheet pulse-sheet-back moving" />
      <div className="pulse-sheet pulse-sheet-mid moving" />
      <div className="pulse-sheet pulse-sheet-front moving">
        <span className="pulse-title" />
        {[82, 90, 64, 76].map((width, index) => <i key={width} className="moving" style={{ '--w': `${width}%`, '--i': index } as MotionVars} />)}
      </div>
      <span className="pulse-status moving">IN ARBEIT</span>
    </div>
  );
}

function MarginProgress() {
  const rows = ['Transkript', 'Gliederung', 'Notizen'];
  return (
    <div className="margin-progress">
      <div className="margin-track"><span className="margin-dot moving" /></div>
      <div className="margin-rows">
        {rows.map((row, index) => (
          <div key={row} className="margin-row">
            <span>0{index + 1}</span>
            <div><strong>{row}</strong><i className="moving" style={{ '--i': index } as MotionVars} /></div>
          </div>
        ))}
      </div>
      <span className="margin-finish moving">BEREIT</span>
    </div>
  );
}
