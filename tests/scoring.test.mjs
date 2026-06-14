import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recencyScore, normalize, rrf, combine } from '../scripts/lib/scoring.mjs';

test('recencyScore: décroît avec le temps, ~1 si récent', () => {
  const now = Date.parse('2026-06-14T00:00:00Z');
  const fresh = recencyScore('2026-06-14T00:00:00Z', now);
  const old = recencyScore('2025-06-14T00:00:00Z', now);
  assert.ok(fresh > 0.99);
  assert.ok(old < fresh);
  assert.equal(recencyScore(null, now), 0);
});

test('normalize: min-max vers [0,1]', () => {
  const n = normalize({ a: 10, b: 20, c: 30 });
  assert.equal(n.a, 0);
  assert.equal(n.c, 1);
  assert.equal(n.b, 0.5);
});

test('rrf: fusionne les classements (présent dans les deux = mieux)', () => {
  const r = rrf([['a', 'b', 'c'], ['b', 'a', 'd']]);
  assert.ok(r.b >= r.a);            // b est 1er puis 2e
  assert.ok(r.a > r.c);
});

test('combine: pondère les composantes + ajustement leçon', () => {
  const ids = ['x', 'y'];
  const parts = { relevance: { x: 1, y: 0 }, importance: { x: 0, y: 1 }, recency: { x: 0, y: 0 } };
  const s = combine(ids, parts, { relevance: 2, importance: 1, recency: 1 });
  assert.ok(s.x > s.y);             // relevance pondérée x2
  const adj = combine(ids, parts, { relevance: 1, importance: 1, recency: 1 }, (id) => id === 'x' ? 0.5 : 1);
  assert.equal(adj.x, 0.5);
});
