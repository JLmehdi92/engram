import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, buildBM25, searchBM25 } from '../scripts/lib/textsearch.mjs';

test('tokenize: minuscule, accents conservés, stopwords retirés', () => {
  const t = tokenize('Le PreCompact déclenche la Compaction du contexte');
  assert.ok(t.includes('precompact'));
  assert.ok(t.includes('déclenche'));
  assert.ok(t.includes('compaction'));
  assert.ok(!t.includes('le'));
  assert.ok(!t.includes('la'));
});

test('BM25: classe le doc le plus pertinent en premier', () => {
  const docs = [
    { id: 'a', text: 'le hook precompact bloque la compaction du contexte' },
    { id: 'b', text: 'recette de cuisine aux légumes et tomates fraîches' },
    { id: 'c', text: 'compaction compaction precompact contexte contexte' },
  ];
  const idx = buildBM25(docs);
  const res = searchBM25(idx, 'precompact compaction contexte');
  assert.equal(res[0].id, 'c');
  assert.ok(res.find((r) => r.id === 'a'));
  assert.ok(!res.find((r) => r.id === 'b'));
});

test('BM25: requête sans terme connu -> aucun résultat', () => {
  const idx = buildBM25([{ id: 'a', text: 'alpha beta gamma' }]);
  assert.equal(searchBM25(idx, 'zzz inexistant').length, 0);
});
