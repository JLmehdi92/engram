#!/usr/bin/env node
// engram-index.mjs — (re)construit l'index de rappel dans .engram/.index/.
// Phase 1 : items.json (les memory items). Phase 2 ajoutera embeddings.json.
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { engramDir, exists, ensureDir } from './lib/paths.mjs';
import { loadItems } from './lib/notes.mjs';
import { buildEmbeddings } from './lib/embeddings.mjs';

const cwd = process.cwd();
const cfg = loadConfig(cwd);
const dir = engramDir(cwd, cfg.outputDir);

if (!exists(dir)) {
  process.stdout.write(JSON.stringify({ ok: false, reason: 'pas de dossier .engram' }, null, 2));
  process.exit(0);
}

const items = loadItems(dir);
const indexDir = ensureDir(path.join(dir, '.index'));
fs.writeFileSync(path.join(indexDir, 'items.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), count: items.length, items }, null, 2));

const byType = {};
for (const it of items) byType[it.type] = (byType[it.type] || 0) + 1;

// Embeddings sémantiques si Ollama est disponible (sinon ignoré silencieusement).
let embeddings = null;
try {
  const cache = await buildEmbeddings(cfg, dir, items);
  if (cache) embeddings = { model: cache.model, count: cache.count };
} catch { /* best-effort */ }

process.stdout.write(JSON.stringify({
  ok: true, indexed: items.length, byType, indexDir,
  embeddings: embeddings || 'indisponible (Ollama absent ou désactivé) — rappel BM25+graphe',
}, null, 2));
