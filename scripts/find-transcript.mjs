#!/usr/bin/env node
// find-transcript.mjs — localise le .jsonl de la session courante.
// Stratégie : dossier projects/<cwd encodé> -> le .jsonl le plus récemment modifié
// (= session en cours). Option --session <id> pour cibler une session précise.
// Fallback : scanner tous les dossiers projects pour un transcript dont le cwd
// correspond, au cas où l'encodage du nom de dossier diffère selon la version.
import fs from 'node:fs';
import path from 'node:path';
import { transcriptDirFor, projectsDir, exists } from './lib/paths.mjs';

const cwd = process.cwd();
const args = process.argv.slice(2);
const sessionArg = (() => {
  const i = args.indexOf('--session');
  return i >= 0 ? args[i + 1] : null;
})();

function jsonlIn(dir) {
  try {
    return fs.readdirSync(dir)
      .filter((f) => f.endsWith('.jsonl'))
      .map((f) => {
        const p = path.join(dir, f);
        let mtime = 0;
        try { mtime = fs.statSync(p).mtimeMs; } catch { /* */ }
        return { file: f, path: p, sessionId: f.replace(/\.jsonl$/, ''), mtime };
      });
  } catch { return []; }
}

function pick(list) {
  if (sessionArg) {
    const hit = list.find((x) => x.sessionId === sessionArg);
    if (hit) return hit;
  }
  return list.sort((a, b) => b.mtime - a.mtime)[0] || null;
}

// 1) Dossier attendu.
let candidates = [];
const expected = transcriptDirFor(cwd);
if (exists(expected)) candidates = jsonlIn(expected);

let chosen = pick(candidates);

// 2) Fallback : balayer tous les projets et vérifier le cwd à l'intérieur du .jsonl.
if (!chosen && exists(projectsDir())) {
  let all = [];
  for (const d of fs.readdirSync(projectsDir())) {
    all = all.concat(jsonlIn(path.join(projectsDir(), d)));
  }
  all.sort((a, b) => b.mtime - a.mtime);
  for (const c of all.slice(0, 20)) {
    try {
      const firstLines = fs.readFileSync(c.path, 'utf8').split(/\r?\n/).slice(0, 5);
      if (firstLines.some((l) => l.includes(JSON.stringify(cwd)) || l.includes(cwd))) {
        chosen = c; break;
      }
    } catch { /* */ }
  }
  if (!chosen) chosen = all[0] || null;
}

process.stdout.write(JSON.stringify(
  chosen
    ? { found: true, path: chosen.path, sessionId: chosen.sessionId, dir: expected }
    : { found: false, dir: expected },
  null, 2,
));
