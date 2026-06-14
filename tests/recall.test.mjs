import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recall } from '../scripts/lib/recall.mjs';

const now = Date.parse('2026-06-14T00:00:00Z');

function item(over) {
  return {
    id: over.id, type: over.type || 'reference', path: over.path || (over.id + '.md'),
    title: over.title || over.id, text: over.text || '', snippet: over.snippet || over.text || '',
    tags: [], keywords: [], importance: over.importance ?? 5,
    created: over.updated || '2026-06-01', updated: over.updated || '2026-06-01',
    last_used: over.last_used || over.updated || '2026-06-01',
    helpful: over.helpful || 0, harmful: over.harmful || 0,
    status: over.status || 'active', valid_to: over.valid_to || null, links: over.links || [],
  };
}

const items = [
  item({ id: 'note:arch', title: 'Architecture', type: 'architecture',
    text: 'hooks precompact sessionstart flux de compaction du contexte', links: ['module-hooks'] }),
  item({ id: 'note:module-hooks', title: 'module-hooks', type: 'module',
    text: 'precompact bloque la compaction sessionstart recharge la mémoire' }),
  item({ id: 'note:cuisine', title: 'Cuisine', text: 'tomates oignons recette légumes' }),
  item({ id: 'lesson:L-001', type: 'lesson', title: 'Faux contexte precompact',
    text: 'precompact créait une fausse mémoire engram dossier', helpful: 5, harmful: 0 }),
];

test('recall: remonte les items pertinents, ignore le hors-sujet', () => {
  const res = recall(items, 'precompact compaction contexte', { nowMs: now, topK: 5 });
  const ids = res.map((r) => r.id);
  assert.ok(ids.includes('note:arch') || ids.includes('note:module-hooks'));
  assert.ok(!ids.includes('note:cuisine'));
});

test('recall: filtre par type', () => {
  const res = recall(items, 'precompact', { nowMs: now, type: 'lesson' });
  assert.ok(res.every((r) => r.type === 'lesson'));
  assert.equal(res[0].id, 'lesson:L-001');
});

test('recall: expansion graphe ramène un voisin lié', () => {
  // requête qui matche surtout "Architecture" ; module-hooks doit suivre via le wikilink.
  const res = recall(items, 'architecture flux', { nowMs: now, topK: 5, graphHops: 2 });
  const ids = res.map((r) => r.id);
  assert.ok(ids.includes('note:module-hooks'));
});

test('recall: item expiré (valid_to passé) exclu', () => {
  const withExpired = [...items, item({ id: 'note:vieux', title: 'Vieux',
    text: 'precompact compaction', valid_to: '2026-01-01' })];
  const res = recall(withExpired, 'precompact compaction', { nowMs: now });
  assert.ok(!res.map((r) => r.id).includes('note:vieux'));
});

test('recall: respecte topK', () => {
  const res = recall(items, 'precompact compaction memoire', { nowMs: now, topK: 1 });
  assert.equal(res.length, 1);
});
