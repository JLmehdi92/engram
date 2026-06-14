// config.mjs — configuration Engram avec valeurs par défaut + fusion en couches.
// Ordre de priorité (le dernier gagne) :
//   DEFAULTS  <  config GLOBALE utilisateur (~/.claude/engram.config.json)  <  config PROJET (.engram/config.json)
// La config globale permet de régler une fois pour tous ses projets (ex. contextWindow d'un
// contexte 1M), sans imposer ce choix aux autres utilisateurs (qui gardent les défauts).
import fs from 'node:fs';
import path from 'node:path';
import { engramDir, exists, homeDir } from './paths.mjs';

export const DEFAULTS = {
  outputDir: '.engram',
  precompactMode: 'block-once',      // 'block-once' | 'warn' | 'auto'
  autoLoad: true,
  maxSessionsOnLoad: 3,
  sessionStartTokenBudget: 12000,
  gitignoreSessions: true,
  redactSecrets: true,
};

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

// Fusion profonde (les objets imbriqués comme capture/recall se combinent).
export function deepMerge(base, over) {
  if (!over || typeof over !== 'object') return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object') {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function globalConfigPath() {
  return process.env.ENGRAM_GLOBAL_CONFIG || path.join(homeDir(), '.claude', 'engram.config.json');
}

export function loadConfig(cwd) {
  let cfg = { ...DEFAULTS };

  // 1) config globale utilisateur
  const g = readJson(globalConfigPath());
  if (g) cfg = deepMerge(cfg, g);

  // 2) config projet (peut surcharger outputDir → relire au bon endroit)
  const projPath = path.join(engramDir(cwd, cfg.outputDir), 'config.json');
  const p = exists(projPath) ? readJson(projPath) : null;
  if (p) {
    cfg = deepMerge(cfg, p);
    if (p.outputDir && p.outputDir !== DEFAULTS.outputDir) {
      const p2 = readJson(path.join(engramDir(cwd, p.outputDir), 'config.json'));
      if (p2) cfg = deepMerge(cfg, p2);
    }
  }
  return cfg;
}
