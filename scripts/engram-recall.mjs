#!/usr/bin/env node
// engram-recall.mjs — interroge la mémoire et renvoie les items les plus pertinents.
// Usage : node engram-recall.mjs "ma requête" [--type lesson] [--topk 5] [--json]
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { engramDir, exists } from './lib/paths.mjs';
import { loadItems } from './lib/notes.mjs';
import { recall } from './lib/recall.mjs';

const cwd = process.cwd();
const cfg = loadConfig(cwd);
const dir = engramDir(cwd, cfg.outputDir);
const args = process.argv.slice(2);

function flag(name, def) {
  const i = args.indexOf(name);
  if (i < 0) return def;
  const v = args[i + 1];
  return v && !v.startsWith('--') ? v : true;
}
const asJson = args.includes('--json');
const query = args.filter((a, i) => !a.startsWith('--')
  && !(i > 0 && ['--type', '--topk'].includes(args[i - 1]))).join(' ').trim();

if (!query) {
  process.stdout.write(JSON.stringify({ ok: false, reason: 'requête vide' }));
  process.exit(0);
}

// items depuis l'index si présent, sinon à la volée.
let items = [];
const itemsFile = path.join(dir, '.index', 'items.json');
if (exists(itemsFile)) {
  try { items = JSON.parse(fs.readFileSync(itemsFile, 'utf8')).items || []; } catch { items = []; }
}
if (!items.length) items = loadItems(dir);

const rc = cfg.recall || {};

const results = recall(items, query, {
  topK: Number(flag('--topk', rc.topK ?? 5)),
  minScore: rc.minScore ?? 0,
  budgetTokens: rc.budgetTokens ?? 4000,
  weights: rc.weights,
  nowMs: Date.now(),
  type: flag('--type', null) || null,
});

if (asJson) {
  process.stdout.write(JSON.stringify({ ok: true, query, count: results.length, results }, null, 2));
} else {
  let out = `Rappel pour « ${query} » (${results.length}) :\n`;
  for (const r of results) out += `\n• [${r.score}] (${r.type}) ${r.title} — ${r.path}\n  ${r.snippet}\n`;
  process.stdout.write(out);
}
