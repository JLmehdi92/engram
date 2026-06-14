import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cosine, buildEmbeddings, maybeSemanticRanks, loadEmbeddings } from '../scripts/lib/embeddings.mjs';

// Embed déterministe factice : vecteur de présence de mots-clés (pas besoin d'Ollama).
const VOCAB = ['precompact', 'compaction', 'cuisine', 'tomate', 'memoire', 'hook'];
function fakeEmbed(text) {
  const t = String(text).toLowerCase();
  return VOCAB.map((w) => (t.includes(w) ? 1 : 0));
}

test('cosine: identique=1, orthogonal=0', () => {
  assert.ok(Math.abs(cosine([1, 0, 1], [1, 0, 1]) - 1) < 1e-9);
  assert.equal(cosine([1, 0], [0, 1]), 0);
  assert.equal(cosine(null, [1]), 0);
});

test('buildEmbeddings: construit le cache puis réutilise par hash', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engram-emb-'));
  const items = [
    { id: 'a', text: 'precompact compaction hook' },
    { id: 'b', text: 'cuisine tomate' },
  ];
  let calls = 0;
  const embed = (t) => { calls++; return fakeEmbed(t); };
  const cfg = { embeddings: { enabled: 'auto', model: 'fake' } };

  const c1 = await buildEmbeddings(cfg, dir, items, embed);
  assert.equal(c1.count, 2);
  assert.equal(calls, 2);

  // 2e passe : mêmes textes -> réutilisation, 0 nouvel appel.
  const c2 = await buildEmbeddings(cfg, dir, items, embed);
  assert.equal(calls, 2);
  assert.equal(c2.count, 2);

  // cache relisible depuis le disque
  const onDisk = loadEmbeddings(dir);
  assert.equal(onDisk.model, 'fake');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('buildEmbeddings: désactivé -> null', async () => {
  const c = await buildEmbeddings({ embeddings: { enabled: false } }, '/tmp/x', [], (t) => fakeEmbed(t));
  assert.equal(c, null);
});

test('maybeSemanticRanks: classe par cosine via cache + embed injectés', async () => {
  const items = [
    { id: 'a', text: 'precompact compaction hook' },
    { id: 'b', text: 'cuisine tomate' },
    { id: 'c', text: 'memoire hook' },
  ];
  const cache = { model: 'fake', items: Object.fromEntries(items.map((i) => [i.id, { vec: fakeEmbed(i.text) }])) };
  const ranks = await maybeSemanticRanks({ embeddings: { enabled: 'auto' } }, null, items, 'precompact compaction', {
    cache, embed: (t) => fakeEmbed(t),
  });
  assert.equal(ranks[0].id, 'a');                 // meilleur recouvrement
  assert.ok(ranks.find((r) => r.id === 'b').score === 0);
});

test('maybeSemanticRanks: pas de cache -> null', async () => {
  const r = await maybeSemanticRanks({ embeddings: { enabled: 'auto' } }, '/tmp/none', [], 'x', { embed: (t) => fakeEmbed(t) });
  assert.equal(r, null);
});
