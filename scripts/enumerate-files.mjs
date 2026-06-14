#!/usr/bin/env node
// enumerate-files.mjs — liste exhaustive des fichiers source du repo, .gitignore-aware.
// En mode git : git ls-files (suivis) + untracked non-ignorés.
// Hors git : walk récursif en appliquant .gitignore + exclusions par défaut.
// Sortie JSON : { mode, count, files: [{path, size}], excludedSamples }.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { loadGitignore, isIgnored, isBinaryPath } from './lib/gitignore.mjs';
import { engramDir } from './lib/paths.mjs';

const cwd = process.cwd();
const cfg = loadConfig(cwd);
const outputDirName = path.basename(cfg.outputDir);

function git(args) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
  } catch { return null; }
}

function sizeOf(rel) {
  try { return fs.statSync(path.join(cwd, rel)).size; } catch { return null; }
}

function alwaysExclude(rel) {
  // Ne jamais inclure la sortie Engram elle-même ni .git.
  return rel === outputDirName
    || rel.startsWith(outputDirName + '/')
    || rel.startsWith('.git/');
}

let files = [];
let mode = 'walk';

const isGit = git(['rev-parse', '--is-inside-work-tree']) === 'true';
if (isGit) {
  mode = 'git';
  const tracked = git(['ls-files']) || '';
  const untracked = git(['ls-files', '--others', '--exclude-standard']) || '';
  const set = new Set();
  for (const block of [tracked, untracked]) {
    for (const line of block.split(/\r?\n/)) {
      const rel = line.trim().replace(/^"|"$/g, '');
      if (rel && !alwaysExclude(rel)) set.add(rel);
    }
  }
  files = [...set];
} else {
  const rules = loadGitignore(cwd);
  const walk = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const abs = path.join(dir, e.name);
      let rel = path.relative(cwd, abs).split(path.sep).join('/');
      if (alwaysExclude(rel)) continue;
      const testPath = e.isDirectory() ? rel + '/' : rel;
      if (isIgnored(testPath, rules)) continue;
      if (e.isDirectory()) walk(abs);
      else if (e.isFile()) files.push(rel);
    }
  };
  walk(cwd);
}

// On garde tout, mais on marque les binaires (le scan de contenu les ignorera).
const result = files
  .filter((f) => !isBinaryPath(f))
  .sort()
  .map((f) => ({ path: f, size: sizeOf(f) }));

const binaries = files.filter(isBinaryPath).sort();

process.stdout.write(JSON.stringify({
  mode,
  cwd,
  count: result.length,
  files: result,
  binaryCount: binaries.length,
  binaries,
}, null, 2));
