// config.mjs — chargement de la configuration Engram avec valeurs par défaut.
import fs from 'node:fs';
import path from 'node:path';
import { engramDir, exists } from './paths.mjs';

export const DEFAULTS = {
  outputDir: '.engram',
  precompactMode: 'block-once',      // 'block-once' | 'warn' | 'auto'
  autoLoad: true,
  maxSessionsOnLoad: 3,
  sessionStartTokenBudget: 12000,
  gitignoreSessions: true,
  redactSecrets: true,
};

// La config peut vivre dans <cwd>/.engram/config.json. Le outputDir lui-même
// peut être surchargé, donc on cherche d'abord dans le défaut puis on relit.
export function loadConfig(cwd) {
  let cfg = { ...DEFAULTS };
  // 1er passage : chercher dans le dossier par défaut.
  const candidates = [
    path.join(engramDir(cwd, DEFAULTS.outputDir), 'config.json'),
  ];
  for (const c of candidates) {
    if (exists(c)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(c, 'utf8'));
        cfg = { ...cfg, ...parsed };
      } catch { /* config invalide : on garde les défauts */ }
      break;
    }
  }
  // 2e passage : si outputDir surchargé, relire la config là-bas.
  if (cfg.outputDir !== DEFAULTS.outputDir) {
    const c2 = path.join(engramDir(cwd, cfg.outputDir), 'config.json');
    if (exists(c2)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(c2, 'utf8'));
        cfg = { ...cfg, ...parsed };
      } catch { /* ignore */ }
    }
  }
  return cfg;
}
