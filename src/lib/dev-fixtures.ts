import { db, newId } from '@/lib/db.ts';

/**
 * DEV-only: fabricate a finished child recording (tone audio + done
 * transcript) so dictation flows can be exercised without a microphone.
 * Used by the __ergaenzungTest and __berichtTest browser scaffolds.
 */
export async function fabricateChild(parentId: string, text: string): Promise<string> {
  const childId = newId();
  const now = Date.now();
  const seconds = 4;
  const rate = 22050;
  const samples = seconds * rate;
  const buf = new ArrayBuffer(44 + samples * 2);
  const v = new DataView(buf);
  const str = (o: number, t: string) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + samples * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true);
  v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i++) v.setInt16(44 + i * 2, Math.sin(i / 24) * 6000, true);
  await db.sessions.add({
    id: childId, kind: 'beurteilung', startedAt: now - seconds * 1000, endedAt: now,
    status: 'stopped', durationMs: seconds * 1000, mimeType: 'audio/wav', parentId,
  });
  await db.chunks.add({
    id: newId(), sessionId: childId, index: 0,
    blob: new Blob([buf], { type: 'audio/wav' }), createdAt: now,
  });
  await db.transcriptions.add({
    id: newId(), sessionId: childId, status: 'done', providerId: 'assemblyai-eu',
    text, utterances: [], createdAt: now, updatedAt: now,
  });
  return childId;
}
