import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { db, type Session, type Utterance } from '@/lib/db';
import { speakerDisplayName, speakerOrder } from '@/lib/speakers';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';

function timestamp(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const SPEAKER_PRESETS = ['Arzt', 'Patient', 'Patientin', 'Angehörige/r'];

/**
 * The conversation, one block per turn — the ground truth the notes were made
 * from. Speaker names are editable: diarization can only ever say "Sprecher 1
 * said this", and he is the one who knows Sprecher 1 was the patient.
 */
export function TranscriptView({
  session,
  utterances,
  text,
  onSessionChanged,
}: {
  session: Session;
  utterances: Utterance[];
  text: string;
  onSessionChanged: () => void;
}) {
  const touchSessions = useAppStore((s) => s.touchSessions);
  const speakers = speakerOrder(utterances);

  async function rename(speaker: string, name: string | null) {
    const next = { ...(session.speakerNames ?? {}) };
    if (name) next[speaker] = name;
    else delete next[speaker];
    await db.sessions.update(session.id, { speakerNames: next });
    onSessionChanged();
    touchSessions();
    if (name) toast.success(`Sprecher umbenannt in „${name}“.`);
  }

  if (utterances.length === 0) {
    return text.trim() ? (
      <p className="max-w-[70ch] whitespace-pre-wrap text-base leading-relaxed">{text}</p>
    ) : (
      <p className="text-muted-foreground">Kein Transkript vorhanden.</p>
    );
  }

  return (
    <div className="space-y-5">
      {speakers.length > 1 ? (
        <p className="text-sm text-muted-foreground">
          {speakers.length} Sprecher erkannt. Klicken Sie auf einen Namen, um ihn zu ändern.
        </p>
      ) : null}

      <ol className="space-y-4">
        {utterances.map((u, i) => {
          const name = speakerDisplayName(u.speaker, session.speakerNames, utterances);
          const speakerIndex = u.speaker ? speakers.indexOf(u.speaker) : 0;
          return (
            <li key={i} className="grid grid-cols-[7.5rem_1fr] gap-3 max-sm:grid-cols-1">
              <div className="flex items-start gap-1 max-sm:items-center">
                {u.speaker ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            'h-7 gap-1 px-1.5 text-sm font-semibold',
                            // Stable per-speaker tint carried by the dot, not the text.
                            speakerIndex % 2 === 0 ? '' : 'text-muted-foreground',
                          )}
                        >
                          {name}
                          <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="start">
                      {SPEAKER_PRESETS.map((preset) => (
                        <DropdownMenuItem key={preset} onClick={() => void rename(u.speaker!, preset)}>
                          {preset}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => void rename(u.speaker!, null)}>
                        Zurücksetzen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <span className="text-sm font-semibold">{name}</span>
                )}
              </div>
              <div className="space-y-0.5">
                <p className="max-w-[62ch] text-base leading-relaxed">{u.text}</p>
                <p className="text-xs tabular-nums text-muted-foreground">{timestamp(u.startMs)}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
