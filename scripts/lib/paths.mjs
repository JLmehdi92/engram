// paths.mjs — résolution déterministe des chemins Engram & Claude Code.
// Aucune dépendance externe.
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

export function homeDir() {
  return os.homedir();
}

export function claudeDir() {
  return path.join(homeDir(), '.claude');
}

export function projectsDir() {
  return path.join(claudeDir(), 'projects');
}

// Claude Code encode le cwd en nom de dossier en remplaçant \ / : par '-'.
//   C:\Users\mehdi\Desktop\engram  ->  C--Users-mehdi-Desktop-engram
//   /home/user/proj                ->  -home-user-proj
export function encodeProjectPath(cwd) {
  return cwd.replace(/[\\/:]/g, '-');
}

// Dossier des transcripts pour un cwd donné. Peut ne pas exister.
export function transcriptDirFor(cwd) {
  return path.join(projectsDir(), encodeProjectPath(cwd));
}

// Dossier de sortie Engram dans le repo courant.
export function engramDir(cwd, outputDir = '.engram') {
  return path.isAbsolute(outputDir) ? outputDir : path.join(cwd, outputDir);
}

export function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

export function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
  return p;
}
