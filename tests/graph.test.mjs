import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWikilinks, normalizeLinkKey, buildGraph, expand } from '../scripts/lib/graph.mjs';

test('parseWikilinks: alias, ancre, chemin', () => {
  const links = parseWikilinks('voir [[architecture]], [[sessions/INDEX|Index]] et [[module-lib#x]]');
  assert.deepEqual(links, ['architecture', 'index', 'module-lib']);
});

test('normalizeLinkKey: basename sans extension, minuscule', () => {
  assert.equal(normalizeLinkKey('Module-Hooks.md'), 'module-hooks');
  assert.equal(normalizeLinkKey('sessions/2026-06-14-X'), '2026-06-14-x');
});

test('buildGraph + expand: traversée non orientée multi-sauts', () => {
  const items = [
    { id: 'note:a.md', title: 'A', path: 'a.md', links: ['b'] },
    { id: 'note:b.md', title: 'B', path: 'b.md', links: ['c'] },
    { id: 'note:c.md', title: 'C', path: 'c.md', links: [] },
    { id: 'note:z.md', title: 'Z', path: 'z.md', links: [] },
  ];
  const adj = buildGraph(items);
  const dist = expand(adj, ['note:a.md'], 2);
  assert.equal(dist.get('note:b.md'), 1);
  assert.equal(dist.get('note:c.md'), 2);
  assert.equal(dist.has('note:z.md'), false);
});
