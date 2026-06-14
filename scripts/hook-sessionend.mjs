#!/usr/bin/env node
// hook-sessionend.mjs — rappel de sauvegarde quand la session se termine.
// Ne peut pas bloquer ni lancer Claude : se contente d'un systemMessage.
import { readStdinJson } from './lib/stdin.mjs';
import { loadConfig } from './lib/config.mjs';
import { readState } from './lib/state.mjs';
import { engramDir, exists } from './lib/paths.mjs';

const payload = await readStdinJson();
const cwd = payload.cwd || process.cwd();
const reason = payload.reason || 'other';
const sessionId = payload.session_id || null;
const cfg = loadConfig(cwd);

// Pas de bruit pour les fins « techniques ».
if (reason === 'resume') process.exit(0);

const dir = engramDir(cwd, cfg.outputDir);
const state = readState(cwd, cfg);

const savedThisSession = sessionId && state.lastSaveSession === sessionId;

let msg;
if (!exists(dir)) {
  msg = '💾 Engram : session terminée sans mémoire sauvegardée. Pense à lancer '
      + '`/engram-save` la prochaine fois pour ne rien perdre.';
} else if (!savedThisSession) {
  const last = state.lastSaveTime ? ' (dernière sauvegarde : ' + state.lastSaveTime + ')' : '';
  msg = '💾 Engram : la session se termine sans nouvelle sauvegarde' + last
      + '. Lance `/engram-save` pour persister le travail de cette session.';
} else {
  process.exit(0); // déjà sauvegardé : rien à dire.
}

process.stdout.write(JSON.stringify({ systemMessage: msg }));
process.exit(0);
