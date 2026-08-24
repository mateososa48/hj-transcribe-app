import type { Utterance } from '@/lib/db.ts';

/**
 * Display name for a diarized speaker.
 *
 * Providers label speakers "A", "B", … in order of first appearance. Unnamed
 * speakers render as "Sprecher 1/2/…" (numbered by first appearance, which
 * matches how a reader counts them); renamed ones use whatever he typed —
 * typically "Arzt" and the patient's role.
 */
export function speakerOrder(utterances: Utterance[]): string[] {
  const order: string[] = [];
  for (const u of utterances) {
    if (u.speaker && !order.includes(u.speaker)) order.push(u.speaker);
  }
  return order;
}

export function speakerDisplayName(
  speaker: string | undefined,
  names: Record<string, string> | undefined,
  utterances: Utterance[],
): string {
  if (!speaker) return 'Sprecher';
  const named = names?.[speaker]?.trim();
  if (named) return named;
  const index = speakerOrder(utterances).indexOf(speaker);
  return `Sprecher ${index === -1 ? speaker : index + 1}`;
}
