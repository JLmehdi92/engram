#!/usr/bin/env node
// mark-saved.mjs — à lancer en FIN de /engram-save.
// 1) enregistre l'état (.engram/.state.json) : commit HEAD + timestamp de sauvegarde
//    (sert de référence au prochain diff incrémental et au rappel SessionEnd).
// 2) crée/complète .engram/.gitignore (politique git, ajout 11.2 du spec) :
//    ignore sessions/ par défaut (gitignoreSessions=true), garde le reste versionné.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { engramDir, exists, ensureDir } from './lib/paths.mjs';
import { readState, writeState } from './lib/state.mjs';

const cwd = process.cwd();
const cfg = loadConfig(cwd);
const dir = engramDir(cwd, cfg.outputDir);
ensureDir(dir);

function git(args) {
  try { return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return null; }
}

const head = git(['rev-parse', '--short', 'HEAD']);
const sessionId = process.argv.includes('--session')
  ? process.argv[process.argv.indexOf('--session') + 1] : null;

const state = readState(cwd, cfg);
state.lastSaveCommit = head || state.lastSaveCommit || null;
state.lastSaveTime = new Date().toISOString();
if (sessionId) state.lastSaveSession = sessionId;
writeState(cwd, cfg, state);

// .gitignore d'Engram.
const giPath = path.join(dir, '.gitignore');
const marker = '# --- géré par Engram ---';
const sessionsRule = cfg.gitignoreSessions
  ? 'sessions/\n!sessions/INDEX.md\n'   // on garde l'index, on ignore les logs datés
  : '';
// .index/ est reconstructible (BM25 + graphe) -> jamais versionné.
const block = `${marker}\n.state.json\n.index/\n${sessionsRule}# --- fin Engram ---\n`;

let current = exists(giPath) ? fs.readFileSync(giPath, 'utf8') : '';
if (current.includes(marker)) {
  current = current.replace(/# --- géré par Engram ---[\s\S]*?# --- fin Engram ---\n?/, block);
} else {
  current = (current ? current.replace(/\s*$/, '\n\n') : '') + block;
}
fs.writeFileSync(giPath, current);

process.stdout.write(JSON.stringify({
  ok: true, head: state.lastSaveCommit, savedAt: state.lastSaveTime,
  gitignore: giPath, gitignoreSessions: cfg.gitignoreSessions,
}, null, 2));
