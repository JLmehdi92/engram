#!/usr/bin/env node
// collect.mjs — agrège tout le contexte déterministe pour /engram-save en UN seul JSON :
// config, contexte git (incl. fichiers supprimés), liste exhaustive des fichiers,
// digest de la session (redacté). Une seule commande à lancer côté Claude.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib/config.mjs';
import { engramDir, exists } from './lib/paths.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cwd = process.cwd();
const cfg = loadConfig(cwd);

function runJson(script, extra = []) {
  try {
    const out = execFileSync('node', [path.join(__dirname, script), ...extra],
      { cwd, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
    return JSON.parse(out);
  } catch (e) {
    return { error: String(e && e.message || e), script };
  }
}

const git = runJson('git-context.mjs');
const files = runJson('enumerate-files.mjs');
const transcript = runJson('parse-transcript.mjs');

const dir = engramDir(cwd, cfg.outputDir);
const result = {
  generatedAt: new Date().toISOString(),
  cwd,
  config: cfg,
  engramDir: dir,
  engramExists: exists(dir),
  incremental: exists(dir) && git.isGit && Boolean(git.lastSaveCommit),
  git,
  files,
  transcript,
};

process.stdout.write(JSON.stringify(result, null, 2));
