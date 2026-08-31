/**
 * The door key — the parts that run without a browser.
 *
 * The real password's hash is compared in the browser; these tests pin the
 * hashing primitive to a known vector and the fail-closed default, without
 * ever writing the password itself into the repo.
 *
 *   npx tsx --test eval/auth.test.ts
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isUnlocked, sha256Hex, tryUnlock } from '../src/lib/auth.ts';

test('sha256Hex matches the published test vector', async () => {
  // FIPS 180-2 appendix B.1: SHA-256("abc").
  assert.equal(
    await sha256Hex('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
});

test('an environment without stored access starts locked', () => {
  // Node has no localStorage at all — the gate must fail closed, not throw.
  assert.equal(isUnlocked(), false);
});

test('a wrong password does not unlock', async () => {
  assert.equal(await tryUnlock('falsches-kennwort'), false);
  assert.equal(isUnlocked(), false);
});
