// memory.mjs — logique de chargement de la mémoire Engram, partagée par le hook
// SessionStart (injection déterministe) et /engram-load.
//
// Applique le PLAFOND DE TOKENS avec fallback dégressif (ajout 11.1 du spec) :
//   1. MEMORY.md + lessons.md (entiers) + N dernières sessions
//   2. si dépassement -> réduire N jusqu'à 0
//   3. si MEMORY+lessons dépassent encore -> fallback index (MEMORY seul + note)
//   4. si MEMORY seul dépasse -> note pointant vers le fichier
import fs from 'node:fs';
import path from 'node:path';
import { engramDir, exists } from './paths.mjs';
import { estimateTokens } from './tokens.mjs';

function readIf(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

// Renvoie les N derniers fichiers de session (plus récent d'abord) d'après le nom
// AAAA-MM-JJ-*.md, en se basant sur l'INDEX si présent sinon sur le tri du nom.
function lastSessionFiles(sessionsDir, n) {
  if (!exists(sessionsDir)) return [];
  let files;
  try {
    files = fs.readdirSync(sessionsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}.*\.md$/.test(f))
      .sort()
      .reverse();
  } catch { return []; }
  return files.slice(0, n).map((f) => path.join(sessionsDir, f));
}

export function loadMemory(cwd, cfg) {
  const dir = engramDir(cwd, cfg.outputDir);
  if (!exists(dir)) return { available: false, context: '', summary: '', level: 'none' };

  const budget = cfg.sessionStartTokenBudget;
  const memory = readIf(path.join(dir, 'MEMORY.md'));
  const lessons = readIf(path.join(dir, 'lessons.md'));
  const index = readIf(path.join(dir, 'sessions', 'INDEX.md'));

  // Le dossier .engram peut exister sans vraie mémoire (ex. juste .state.json).
  // On ne considère la mémoire disponible que s'il y a au moins un contenu réel.
  if (!memory && !lessons && !index) {
    return { available: false, context: '', summary: '', level: 'empty' };
  }

  const header = '# Mémoire Engram (rechargée automatiquement)\n\n'
    + 'Contexte restauré depuis `' + path.join(cfg.outputDir) + '/`. '
    + 'Consulte `lessons.md` AVANT de proposer une solution à un problème.\n';

  const memBlock = memory ? `\n## MEMORY.md (index)\n\n${memory}\n` : '';
  const lessonsBlock = lessons ? `\n## lessons.md (toutes les leçons)\n\n${lessons}\n` : '';
  const indexBlock = index ? `\n## sessions/INDEX.md\n\n${index}\n` : '';

  const sessionFiles = lastSessionFiles(path.join(dir, 'sessions'), cfg.maxSessionsOnLoad);
  const sessionBlocks = sessionFiles.map((p) => {
    const c = readIf(p);
    return c ? `\n## ${path.basename(p)}\n\n${c}\n` : '';
  }).filter(Boolean);

  const baseAlways = header + memBlock + lessonsBlock + indexBlock;

  // Niveau 1 -> sessions complètes, on réduit N tant qu'on dépasse.
  for (let n = sessionBlocks.length; n >= 0; n--) {
    const ctx = baseAlways + sessionBlocks.slice(0, n).join('');
    if (estimateTokens(ctx) <= budget) {
      return {
        available: true,
        context: ctx,
        level: n === sessionBlocks.length ? 'full' : 'reduced-sessions',
        sessionsIncluded: n,
        summary: summarize(memory, lessons, n),
      };
    }
  }

  // Niveau 3 -> MEMORY + lessons dépassent : fallback index (MEMORY seul + note).
  const note = '\n> ⚠️ `lessons.md` trop volumineux pour l\'injection automatique '
    + '(budget ' + budget + ' tokens). Ouvre-le via `/engram-load` ou lis `'
    + path.join(cfg.outputDir, 'lessons.md') + '`.\n';
  const idxOnly = header + memBlock + indexBlock + note;
  if (estimateTokens(idxOnly) <= budget || !memory) {
    return { available: true, context: idxOnly, level: 'index-fallback', sessionsIncluded: 0,
      summary: summarize(memory, null, 0) };
  }

  // Niveau 4 -> MEMORY seul dépasse (anormal) : pointeur fichier.
  const pointer = header + '\n> ⚠️ Mémoire trop volumineuse pour l\'injection automatique. '
    + 'Lis `' + path.join(cfg.outputDir, 'MEMORY.md') + '` et `'
    + path.join(cfg.outputDir, 'lessons.md') + '` directement, ou lance `/engram-load`.\n';
  return { available: true, context: pointer, level: 'pointer-only', sessionsIncluded: 0,
    summary: 'Mémoire Engram présente mais trop grosse pour l\'injection auto.' };
}

function summarize(memory, lessons, nSessions) {
  const lines = [];
  if (memory) lines.push('Index mémoire chargé.');
  if (lessons) lines.push('Leçons chargées.');
  if (nSessions) lines.push(`${nSessions} dernière(s) session(s) chargée(s).`);
  return lines.join(' ') || 'Mémoire Engram disponible.';
}
