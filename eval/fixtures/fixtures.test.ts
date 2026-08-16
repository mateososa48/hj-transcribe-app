/**
 * Fixture self-consistency.
 *
 * The failure this prevents: a typo in a trap's `accept` array makes that trap
 * impossible to pass. It then shows up in the report as "every provider missed
 * this drug name", and we go hunting for an ASR problem that does not exist.
 *
 * So: feed each fixture's own source text in as a hypothetical PERFECT
 * transcript. Every trap must pass. Anything that fails here is a bug in the
 * fixture, not in a provider.
 *
 *   npx tsx --test eval/fixtures/fixtures.test.ts
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { scoreTraps } from '../score/traps.ts';
import { FIXTURES } from './cases.ts';

for (const fixture of FIXTURES) {
  test(`${fixture.id}: rant traps are satisfiable by the source`, () => {
    const failed = scoreTraps(fixture.rant, fixture.rantTraps)
      .filter((r) => !r.passed)
      .map((r) => `[${r.trap.kind}] ${r.trap.label} — accept: ${JSON.stringify(r.trap.accept)}`);
    assert.deepEqual(failed, [], `unsatisfiable rant traps in ${fixture.id}:\n  ${failed.join('\n  ')}`);
  });

  test(`${fixture.id}: messwerte traps are satisfiable by the source`, () => {
    const failed = scoreTraps(fixture.messwerte, fixture.messwerteTraps)
      .filter((r) => !r.passed)
      .map((r) => `[${r.trap.kind}] ${r.trap.label} — accept: ${JSON.stringify(r.trap.accept)}`);
    assert.deepEqual(failed, [], `unsatisfiable messwerte traps in ${fixture.id}:\n  ${failed.join('\n  ')}`);
  });
}

test('every fixture carries at least one negation and one drug safety trap', () => {
  // Negations and doses are the two failure classes that can change care.
  // A fixture without them is not pulling its weight.
  for (const f of FIXTURES) {
    const all = [...f.rantTraps, ...f.messwerteTraps].filter((t) => t.severity === 'safety');
    assert.ok(
      all.some((t) => t.kind === 'negation'),
      `${f.id} has no negation safety trap`,
    );
    assert.ok(
      all.some((t) => t.kind === 'drug' || t.kind === 'number'),
      `${f.id} has no drug/number safety trap`,
    );
  }
});

test('fixture ids are unique', () => {
  const ids = FIXTURES.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
});
