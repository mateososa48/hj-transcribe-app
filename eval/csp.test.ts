/**
 * The CSP is how SPEC constraint 2 is actually enforced, so it must not drift.
 *
 * There are two copies of the policy by necessity: a <meta> tag injected at
 * build time (covers `npm run preview` and any static host) and an HTTP header
 * in vercel.json (covers production, and is the only place `frame-ancestors`
 * works). These tests assert they agree, and that both permit exactly the
 * origins declared in the provider registry — no more.
 *
 *   npx tsx --test eval/csp.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { ALLOWED_CONNECT_ORIGINS } from '../src/lib/providers/origins.ts';
import { buildCsp } from '../vite.config.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

interface VercelConfig {
  headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
}

function vercelCsp(): string {
  const config = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8')) as VercelConfig;
  const header = config.headers
    .flatMap((h) => h.headers)
    .find((h) => h.key === 'Content-Security-Policy');
  assert.ok(header, 'vercel.json has no Content-Security-Policy header');
  return header.value;
}

function connectSrc(policy: string): string[] {
  const directive = policy.split(';').map((d) => d.trim()).find((d) => d.startsWith('connect-src'));
  assert.ok(directive, `policy has no connect-src: ${policy}`);
  return directive.split(/\s+/).slice(1);
}

test('vercel.json CSP contains every directive from the build-time policy', () => {
  const built = buildCsp();
  const deployed = vercelCsp();
  for (const directive of built.split(';').map((d) => d.trim())) {
    assert.ok(
      deployed.includes(directive),
      `vercel.json is missing directive "${directive}" — the two policies have drifted`,
    );
  }
});

test('vercel.json adds frame-ancestors, which a <meta> CSP cannot express', () => {
  assert.match(vercelCsp(), /frame-ancestors 'none'/);
  assert.ok(
    !buildCsp().includes('frame-ancestors'),
    'frame-ancestors in the meta policy is ignored by browsers and logs a console error',
  );
});

test('connect-src permits exactly the registered provider origins and nothing else', () => {
  const expected = new Set(["'self'", ...ALLOWED_CONNECT_ORIGINS]);
  for (const policy of [buildCsp(), vercelCsp()]) {
    const actual = new Set(connectSrc(policy));
    assert.deepEqual(
      [...actual].sort(),
      [...expected].sort(),
      'connect-src no longer matches src/lib/providers/origins.ts',
    );
  }
});

test('no wildcard or plaintext origin can reach connect-src', () => {
  // A wildcard here would silently undo the whole no-exfiltration guarantee.
  for (const policy of [buildCsp(), vercelCsp()]) {
    for (const origin of connectSrc(policy)) {
      assert.ok(!origin.includes('*'), `wildcard origin in connect-src: ${origin}`);
      assert.ok(
        origin === "'self'" || origin.startsWith('https://'),
        `non-https origin in connect-src: ${origin}`,
      );
    }
  }
});

test('script-src forbids inline and eval', () => {
  for (const policy of [buildCsp(), vercelCsp()]) {
    const directive = policy.split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src'));
    assert.equal(directive, "script-src 'self'");
  }
});
