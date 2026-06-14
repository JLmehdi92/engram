#!/usr/bin/env node
// engram-consolidate.mjs — passe de consolidation « sleep-time » (partie déterministe).
// Rapporte : leçons archivables (remplacées/périmées/nuisibles), paires de leçons quasi
// dupliquées, notes périmées. Avec --apply : archive en sécurité (déplace vers archive/,
// JAMAIS de suppression destructive) puis reconstruit l'index.
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { engramDir, exists, ensureDir } from './lib/paths.mjs';
import { loadItems } from './lib/notes.mjs';
import { parseLessons, removeLesson, lessonMatchText } from './lib/lessons.mjs';
import { buildBM25, searchBM25 } from './lib/textsearch.mjs';

const cwd = process.cwd();
const cfg = loadConfig(cwd);
const dir = engramDir(cwd, cfg.outputDir);
const apply = process.argv.includes('--apply');
const today = new Date().toISOString().slice(0, 10);

function out(o) { process.stdout.write(JSON.stringify(o, null, 2)); }
if (!exists(dir)) { out({ ok: false, reason: 'pas de .engram' }); process.exit(0); }

const lessonsFile = path.join(dir, 'lessons.md');
let lessonsContent = exists(lessonsFile) ? fs.readFileSync(lessonsFile, 'utf8') : '';
const lessons = parseLessons(lessonsContent);

// 1) Leçons archivables : remplacées, périmées (valid_to passé), ou nuisibles.
const nowMs = Date.now();
const archivable = lessons.filter((l) => {
  const st = l.meta.status || 'active';
  if (st === 'superseded' || st === 'archived') return true;
  if (l.meta.valid_to) { const t = new Date(l.meta.valid_to).getTime(); if (!Number.isNaN(t) && t <= nowMs) return true; }
  const h = Number(l.meta.harmful) || 0, hp = Number(l.meta.helpful) || 0;
  if (cfg.lessons && cfg.lessons.archiveWhenHarmfulExceedsHelpful !== false && h >= 2 && h > hp) return true;
  return false;
}).map((l) => ({ id: l.id, title: l.title, status: l.meta.status, valid_to: l.meta.valid_to }));

// 2) Paires de leçons quasi dupliquées (à fusionner par Claude).
const active = lessons.filter((l) => (l.meta.status || 'active') === 'active');
const idx = buildBM25(active.map((l) => ({ id: l.id, text: lessonMatchText(l) })));
const seen = new Set();
const duplicates = [];
for (const l of active) {
  const hits = searchBM25(idx, lessonMatchText(l)).filter((r) => r.id !== l.id);
  if (hits.length && hits[0].score >= 4) {
    const key = [l.id, hits[0].id].sort().join('|');
    if (!seen.has(key)) { seen.add(key); duplicates.push({ a: l.id, b: hits[0].id, score: Number(hits[0].score.toFixed(2)) }); }
  }
}

// 3) Notes périmées.
const staleNotes = loadItems(dir).filter((it) => it.type !== 'lesson' && (it.status === 'stale' || it.status === 'superseded'))
  .map((it) => ({ id: it.id, path: it.path, status: it.status }));

const report = { ok: true, applied: apply, archivable, duplicates, staleNotes, actions: [] };

if (apply) {
  const archiveDir = ensureDir(path.join(dir, 'archive'));
  // Archive des leçons -> archive/lessons.md (append), retrait du fichier principal (delta).
  if (archivable.length && lessonsContent) {
    const archFile = path.join(archiveDir, 'lessons.md');
    let archContent = exists(archFile) ? fs.readFileSync(archFile, 'utf8')
      : `---\ntitle: Leçons archivées\ntype: lessons\nupdated: ${today}\n---\n\n# Leçons archivées\n`;
    for (const a of archivable) {
      const { content, removed } = removeLesson(lessonsContent, a.id);
      if (removed) {
        lessonsContent = content;
        archContent += `\n${removed}\n`;
        report.actions.push(`leçon ${a.id} archivée`);
      }
    }
    fs.writeFileSync(lessonsFile, lessonsContent);
    fs.writeFileSync(archFile, archContent);
  }
  // Notes périmées -> archive/ (déplacement de fichier, non destructif).
  for (const n of staleNotes) {
    const src = path.join(dir, n.path);
    const dest = path.join(archiveDir, path.basename(n.path));
    try { fs.renameSync(src, dest); report.actions.push(`note ${n.path} -> archive/`); } catch { /* */ }
  }
}

// Reconstruit l'index après consolidation.
try {
  const items = loadItems(dir);
  ensureDir(path.join(dir, '.index'));
  fs.writeFileSync(path.join(dir, '.index', 'items.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), count: items.length, items }, null, 2));
  report.reindexed = items.length;
} catch { /* */ }

out(report);
