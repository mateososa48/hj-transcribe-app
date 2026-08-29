/**
 * Where a dictation is going. Chosen before he speaks — either a section of
 * the letter by name, or the place the caret is standing.
 */
export type DictateTarget = { kind: 'cursor' } | { kind: 'section'; title: string };
