/**
 * Bullet formatting for the sections that are lists.
 *
 * The model emits "- " lines (easy to prompt, easy to parse). On screen and in
 * storage they become "• " — what a letter actually looks like. On copy, the
 * clipboard gets BOTH text/html (a real <ul>, which Word and Google Docs paste
 * as a native bulleted list) and a plain-text fallback. Plain "- " pasted into
 * Word is just a dash; the HTML flavour is what makes the paste land as real
 * formatting.
 */

/** Sections whose content is a bullet list. Medikation (tabs) and Anamnese (prose) are not. */
export const BULLET_SECTIONS = new Set(['beurteilung', 'zusammenfassung', 'diagnosen']);

/** "- foo" -> "• foo", preserving indentation for nested items. */
export function toBulletText(text: string): string {
  return text.replace(/^(\s*)-\s+/gm, '$1• ');
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Bullet lines -> nested <ul>. Two levels, matching his letters: a top-level
 * item, and indented detail items beneath it. Non-bullet lines (rare — a
 * continuation wrapped by hand) are folded into the previous item.
 */
export function bulletsToHtml(text: string): string {
  const lines = text.split('\n');
  let html = '<ul>';
  let openLi = false;
  let inNested = false;

  for (const raw of lines) {
    if (!raw.trim()) continue;
    const m = raw.match(/^(\s*)[•-]\s+(.*)$/);
    if (!m) {
      // Continuation of the previous item.
      if (openLi) html += ' ' + escapeHtml(raw.trim());
      continue;
    }
    const nested = (m[1] ?? '').length >= 2;
    const content = escapeHtml(m[2] ?? '');
    if (nested) {
      if (!inNested) {
        html += '<ul>';
        inNested = true;
      } else {
        html += '</li>';
      }
      html += '<li>' + content;
      openLi = true;
    } else {
      if (inNested) {
        html += '</li></ul>';
        inNested = false;
      }
      if (openLi) html += '</li>';
      html += '<li>' + content;
      openLi = true;
    }
  }
  if (inNested) html += '</li></ul>';
  if (openLi) html += '</li>';
  return html + '</ul>';
}

/** Plain-text flavour for the same copy: bullets as "• ", indentation kept. */
export function bulletsToPlain(text: string): string {
  return toBulletText(text);
}
