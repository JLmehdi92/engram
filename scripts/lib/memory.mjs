// memory.mjs — chargement de la mémoire pour le hook SessionStart et /engram-load.
//
// v2 : étage actif chargé en priorité, sous PLAFOND DE TOKENS, avec dégradation propre :
//   1. STATE.md      (où on en est — toujours, en premier)
//   2. MEMORY.md     (index — toujours)
//   3. Leçons PRIORITAIRES (top-N par importance×récence, pas toutes)
//   4. sessions/INDEX.md
//   5. 1-3 dernières sessions
// Si le budget est dépassé, on retire d'abord les sessions, puis on réduit les leçons,
// puis l'index, et en dernier recours on ne garde que STATE+MEMORY (ou un pointeur).
import fs from 'node:fs';
import path from 'node:path';
import { engramDir, exists } from './paths.mjs';
import { estimateTokens } from './tokens.mjs';
import { recencyScore, normalize } from './scoring.mjs';
import { parseLessons } from './lessons.mjs';

function readIf(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }

function lastSessionFiles(sessionsDir, n) {
  if (!exists(sessionsDir)) return [];
  let files;
  try {
    files = fs.readdirSync(sessionsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}.*\.md$/.test(f)).sort().reverse();
  } catch { return []; }
  return files.slice(0, n).map((f) => path.join(sessionsDir, f));
}

// Sélectionne les leçons prioritaires (actives), triées importance×récence.
function topLessons(lessonsContent, nowMs, maxN) {
  const all = parseLessons(lessonsContent).filter((l) => (l.meta.status || 'active') !== 'superseded');
  if (!all.length) return [];
  const imp = normalize(Object.fromEntries(all.map((l) => [l.id, Number(l.meta.importance) || 6])));
  const rec = normalize(Object.fromEntries(all.map((l) => [l.id, recencyScore(l.meta.last_used || l.meta.created, nowMs)])));
  return all
    .map((l) => ({ l, score: (imp[l.id] || 0) + (rec[l.id] || 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxN)
    .map(({ l }) => l);
}

export function loadMemory(cwd, cfg, opts = {}) {
  const dir = engramDir(cwd, cfg.outputDir);
  if (!exists(dir)) return { available: false, context: '', summary: '', level: 'none' };

  const nowMs = opts.nowMs || Date.now();
  const budget = cfg.sessionStartTokenBudget || 12000;
  const maxLessons = (cfg.recall && cfg.recall.maxLessonsOnStart) || 8;
  const maxSessions = cfg.maxSessionsOnLoad || 3;

  const state = readIf(path.join(dir, 'STATE.md'));
  const memory = readIf(path.join(dir, 'MEMORY.md'));
  const index = readIf(path.join(dir, 'sessions', 'INDEX.md'));
  const lessonsRaw = readIf(path.join(dir, 'lessons.md'));

  if (!state && !memory && !lessonsRaw && !index) {
    return { available: false, context: '', summary: '', level: 'empty' };
  }

  const header = '# Mémoire Engram (rechargée automatiquement)\n\n'
    + 'Reprends le travail à partir de l\'état ci-dessous. Avant de proposer une solution à un '
    + 'problème, consulte les leçons (ou appelle l\'outil MCP `engram_lessons`). Pour retrouver '
    + 'd\'autres détails, utilise `engram_recall`.\n';

  const stateBlock = state ? `\n## STATE — où on en est\n\n${state}\n` : '';
  const memBlock = memory ? `\n## MEMORY.md (index)\n\n${memory}\n` : '';

  // Toujours : header + STATE + MEMORY. Si ça ne tient pas → pointeur.
  const base = header + stateBlock + memBlock;
  if (estimateTokens(base) > budget && (state || memory)) {
    const pointer = header + '\n> ⚠️ Mémoire trop volumineuse pour l\'injection auto. Lis `'
      + path.join(cfg.outputDir, 'STATE.md') + '` et `' + path.join(cfg.outputDir, 'MEMORY.md')
      + '` directement, ou lance `/engram-load`.\n';
    return { available: true, context: pointer, level: 'pointer-only', summary: 'Mémoire présente (trop grosse pour injection auto).' };
  }

  let context = base;
  let used = estimateTokens(base);
  const add = (chunk) => {
    const c = estimateTokens(chunk);
    if (used + c > budget) return false;
    context += chunk; used += c; return true;
  };

  // Leçons prioritaires (chacune ajoutée tant que ça tient).
  let lessonsIncluded = 0;
  if (lessonsRaw) {
    const top = topLessons(lessonsRaw, nowMs, maxLessons);
    if (top.length) {
      let block = '\n## Leçons prioritaires (déjà résolues — ne pas refaire ces erreurs)\n';
      if (add(block)) {
        for (const l of top) { if (add('\n' + l.raw + '\n')) lessonsIncluded++; else break; }
      }
    }
  }

  // Index des sessions.
  if (index) add(`\n## sessions/INDEX.md\n\n${index}\n`);

  // Dernières sessions.
  let sessionsIncluded = 0;
  for (const p of lastSessionFiles(path.join(dir, 'sessions'), maxSessions)) {
    const c = readIf(p);
    if (c && add(`\n## ${path.basename(p)}\n\n${c}\n`)) sessionsIncluded++; else break;
  }

  const parts = [];
  if (state) parts.push('état de reprise');
  if (memory) parts.push('index');
  if (lessonsIncluded) parts.push(`${lessonsIncluded} leçon(s)`);
  if (sessionsIncluded) parts.push(`${sessionsIncluded} session(s)`);
  return {
    available: true, context,
    level: 'full', lessonsIncluded, sessionsIncluded,
    summary: parts.join(', ') || 'mémoire chargée',
  };
}
