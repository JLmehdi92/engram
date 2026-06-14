#!/usr/bin/env node
// git-context.mjs — contexte git pour /engram-save.
// Sortie JSON sur stdout : repo git ?, HEAD court, branche, et diff (incl. fichiers
// SUPPRIMÉS et RENOMMÉS) depuis la dernière sauvegarde Engram.
import { execFileSync } from 'node:child_process';
import { loadConfig } from './lib/config.mjs';
import { readState } from './lib/state.mjs';

const cwd = process.cwd();
const cfg = loadConfig(cwd);

function git(args) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

const isGit = git(['rev-parse', '--is-inside-work-tree']) === 'true';
const out = { isGit, head: null, branch: null, lastSaveCommit: null, diff: null };

if (isGit) {
  out.head = git(['rev-parse', '--short', 'HEAD']);   // null si aucun commit
  out.branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  const state = readState(cwd, cfg);
  out.lastSaveCommit = state.lastSaveCommit || null;

  const added = [], modified = [], deleted = [], renamed = [];
  const classify = (status, file, file2) => {
    const code = status[0];
    if (code === 'A') added.push(file);
    else if (code === 'M') modified.push(file);
    else if (code === 'D') deleted.push(file);
    else if (code === 'R') renamed.push({ from: file, to: file2 });
    else if (code === 'C') added.push(file2 || file);
    else modified.push(file);
  };

  // Diff committé depuis la dernière sauvegarde (si on a un commit de référence).
  if (out.lastSaveCommit && out.head) {
    const raw = git(['diff', '--name-status', '-M', `${out.lastSaveCommit}..HEAD`]);
    if (raw) {
      for (const line of raw.split(/\r?\n/)) {
        if (!line.trim()) continue;
        const parts = line.split(/\t/);
        classify(parts[0], parts[1], parts[2]);
      }
    }
  }

  // Changements non committés (toujours utiles : Engram tourne souvent avant commit).
  const porcelain = git(['status', '--porcelain']);
  if (porcelain) {
    for (const line of porcelain.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const x = line[0], y = line[1];
      const file = line.slice(3).trim();
      if (x === 'D' || y === 'D') deleted.push(file);
      else if (x === 'A' || x === '?') added.push(file.replace(/^"|"$/g, ''));
      else modified.push(file);
    }
  }

  const uniq = (a) => [...new Set(a)];
  out.diff = {
    added: uniq(added),
    modified: uniq(modified),
    deleted: uniq(deleted),
    renamed,
    hasReference: Boolean(out.lastSaveCommit),
  };
}

process.stdout.write(JSON.stringify(out, null, 2));
