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
 * Bullet text -> HTML: bullet runs become nested <ul> (two levels, matching
 * his letters), and non-bullet lines OUTSIDE any item become <p> paragraphs.
 * A non-bullet line directly after an item is a hand-wrapped continuation and
 * folds into it — but a line before the first bullet (or between runs) must
 * never be dropped: what he sees and what Word pastes has to be everything
 * he wrote.
 */
export function bulletsToHtml(text: string): string {
  const lines = text.split('\n');
  let html = '';
  let inUl = false;
  let openLi = false;
  let inNested = false;

  const closeList = () => {
    if (inNested) {
      html += '</li></ul>';
      inNested = false;
    }
    if (openLi) {
      html += '</li>';
      openLi = false;
    }
    if (inUl) {
      html += '</ul>';
      inUl = false;
    }
  };

  for (const raw of lines) {
    if (!raw.trim()) continue;
    const m = raw.match(/^(\s*)[•-]\s+(.*)$/);
    if (!m) {
      if (openLi) {
        // Continuation of the previous item.
        html += ' ' + escapeHtml(raw.trim());
      } else {
        // Free-standing prose — a paragraph, never silently dropped.
        closeList();
        html += '<p>' + escapeHtml(raw.trim()) + '</p>';
      }
      continue;
    }
    const nested = (m[1] ?? '').length >= 2;
    const content = escapeHtml(m[2] ?? '');
    if (!inUl) {
      html += '<ul>';
      inUl = true;
    }
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
  closeList();
  return html;
}

/** Plain-text flavour for the same copy: bullets as "• ", indentation kept. */
export function bulletsToPlain(text: string): string {
  return toBulletText(text);
}
