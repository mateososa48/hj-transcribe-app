/**
 * The merge input for an Ergänzung, pure and node-testable: the standing
 * Beurteilung plus the fresh dictation, labelled so the model extends
 * instead of rewriting.
 */
export function buildErgaenzungTranscript(existingText: string, additionTranscript: string): string {
  return [
    'Dies ist eine ERGÄNZUNG zu einer bereits erstellten Zusammenfassenden Beurteilung.',
    '',
    'BEREITS ERSTELLTE BEURTEILUNG (Wortlaut so weit wie möglich beibehalten; nichts weglassen, nichts umformulieren):',
    existingText.trim(),
    '',
    'ERGÄNZENDES DIKTAT (neu — an passender Stelle in die Beurteilung einarbeiten, sonst ans Ende anfügen; alle bestehenden Regeln gelten auch für die Ergänzung):',
    additionTranscript.trim(),
    '',
    'Gib die vollständige aktualisierte Zusammenfassende Beurteilung aus.',
  ].join('\n');
}
