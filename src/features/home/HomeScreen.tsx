import { ChevronRight, MessagesSquare, Mic } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { SESSION_KIND_LABELS, type SessionKind } from '@/lib/db';
import { cn } from '@/lib/utils';
import { formatWhen, useSessions, type SessionSummary } from '@/features/sessions/useSessions';

/**
 * The whole product, on one screen: two things he can do.
 *
 * Deliberately not a dashboard. He opens this between patients, with a waiting
 * room outside, and needs to hit the right one without reading. Hence two
 * targets of the same weight, each with one sentence saying what it is for.
 */

const FEATURES: Array<{
  kind: SessionKind;
  icon: typeof Mic;
  title: string;
  blurb: string;
}> = [
  {
    kind: 'gespraech',
    icon: MessagesSquare,
    title: 'Gespräch aufnehmen',
    blurb:
      'Läuft während Ihres Gesprächs mit dem Patienten mit. Daraus entstehen Diagnosen, Anamnese und Medikation.',
  },
  {
    kind: 'beurteilung',
    icon: Mic,
    title: 'Beurteilung diktieren',
    blurb:
      'Sprechen Sie frei, so wie Sie es einem Kollegen erklären würden. Daraus entsteht die Zusammenfassende Beurteilung.',
  },
];

function FeatureCard({
  feature,
  onStart,
}: {
  feature: (typeof FEATURES)[number];
  onStart: () => void;
}) {
  const Icon = feature.icon;
  return (
    <button
      type="button"
      onClick={onStart}
      className={cn(
        'group flex flex-col items-start gap-4 rounded-xl border border-border bg-card p-7 text-left',
        'transition-colors hover:border-foreground/25 hover:bg-muted/60',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
      )}
    >
      <span className="grid size-12 place-items-center rounded-lg bg-muted text-foreground transition-colors group-hover:bg-background">
        <Icon className="size-6" aria-hidden />
      </span>
      <span className="flex items-center gap-1.5 text-xl font-semibold tracking-tight">
        {feature.title}
        <ChevronRight
          className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </span>
      <span className="text-base leading-relaxed text-muted-foreground">{feature.blurb}</span>
    </button>
  );
}

function RecentRow({ item, onOpen }: { item: SessionSummary; onOpen: () => void }) {
  const { session, preview, hasResult, segmentCount } = item;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'flex w-full items-baseline gap-4 rounded-lg px-3 py-3 text-left transition-colors',
          'hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        )}
      >
        <span className="w-40 shrink-0 text-sm font-medium tabular-nums">
          {formatWhen(session.startedAt)}
        </span>
        <Badge variant="secondary" className="shrink-0">
          {SESSION_KIND_LABELS[session.kind]}
        </Badge>
        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          {preview ||
            (hasResult
              ? 'Kein Text erzeugt'
              : `${segmentCount} Abschnitt${segmentCount === 1 ? '' : 'e'} aufgenommen, noch kein Text`)}
        </span>
      </button>
    </li>
  );
}

export function HomeScreen({
  onStart,
  onOpen,
}: {
  onStart: (kind: SessionKind) => void;
  onOpen: (sessionId: string, kind: SessionKind) => void;
}) {
  const { sessions, loading } = useSessions();

  return (
    <div className="space-y-14">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Guten Tag, Herr Professor.</h1>
        <p className="max-w-[60ch] text-lg text-muted-foreground">
          Was möchten Sie aufnehmen?
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {FEATURES.map((feature) => (
          <FeatureCard
            key={feature.kind}
            feature={feature}
            onStart={() => onStart(feature.kind)}
          />
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Zuletzt aufgenommen
        </h2>
        {loading ? (
          <p className="flex items-center gap-3 px-3 py-4 text-muted-foreground">
            <Spinner /> Wird geladen …
          </p>
        ) : sessions.length === 0 ? (
          <p className="max-w-[60ch] px-3 py-4 text-muted-foreground">
            Noch nichts aufgenommen. Alles bleibt auf diesem Computer — es gibt keinen Server und
            kein Konto.
          </p>
        ) : (
          <ul className="flex flex-col">
            {sessions.map((item) => (
              <RecentRow
                key={item.session.id}
                item={item}
                onOpen={() => onOpen(item.session.id, item.session.kind)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
