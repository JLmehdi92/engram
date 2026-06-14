// state.mjs — états persistants d'Engram.
//
// Deux états distincts :
//  - État de SAUVEGARDE (.engram/.state.json) : lastSaveCommit/lastSaveTime/lastSaveSession.
//    Écrit par mark-saved (quand .engram existe forcément). Lu par git-context & sessionend.
//  - État ÉPHÉMÈRE PreCompact (os.tmpdir) : compteur de blocages par session, pour le
//    filet anti-deadlock. Stocké hors de .engram pour NE PAS créer une fausse "mémoire".
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { engramDir, exists, ensureDir } from './paths.mjs';

function savePath(cwd, cfg) {
  return path.join(engramDir(cwd, cfg.outputDir), '.state.json');
}

export function readState(cwd, cfg) {
  const p = savePath(cwd, cfg);
  if (!exists(p)) return {};
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; }
}

export function writeState(cwd, cfg, state) {
  const dir = engramDir(cwd, cfg.outputDir);
  try { ensureDir(dir); } catch { return false; }
  try { fs.writeFileSync(savePath(cwd, cfg), JSON.stringify(state, null, 2)); return true; }
  catch { return false; }
}

// --- état éphémère PreCompact (tmp) ---
function tmpPath(cwd) {
  const h = crypto.createHash('sha1').update(cwd).digest('hex').slice(0, 12);
  return path.join(os.tmpdir(), `engram-precompact-${h}.json`);
}

export function readTmpState(cwd) {
  const p = tmpPath(cwd);
  if (!exists(p)) return {};
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; }
}

export function writeTmpState(cwd, state) {
  try { fs.writeFileSync(tmpPath(cwd), JSON.stringify(state)); return true; }
  catch { return false; }
}
