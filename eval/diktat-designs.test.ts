import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DIKTAT_DESIGN_META } from '../src/features/diktat/design-meta.ts';
import { DIKTAT_DESIGN_IDS } from '../src/store/app-store.ts';

/**
 * The Diktat design experiment axis: ten designs plus the shipped standard,
 * every id described for the switcher, no id colliding with the layout axis.
 */

test('exactly ten design experiments plus standard', () => {
  assert.equal(DIKTAT_DESIGN_IDS.length, 11);
  assert.equal(DIKTAT_DESIGN_IDS[0], 'standard');
  assert.equal(new Set(DIKTAT_DESIGN_IDS).size, 11, 'design ids must be unique');
});

test('every design id has switcher metadata, and nothing extra', () => {
  const metaIds = Object.keys(DIKTAT_DESIGN_META).sort();
  assert.deepEqual(metaIds, [...DIKTAT_DESIGN_IDS].sort());
  for (const [id, meta] of Object.entries(DIKTAT_DESIGN_META)) {
    assert.ok(meta.label.trim().length >= 3, `${id}: label too short`);
    assert.ok(meta.blurb.trim().length >= 15, `${id}: blurb should describe the design`);
    assert.ok(meta.blurb.length <= 120, `${id}: blurb too long for the menu`);
  }
});
