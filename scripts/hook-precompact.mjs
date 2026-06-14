#!/usr/bin/env node
// hook-precompact.mjs — déclenché AVANT la compaction du contexte.
// Comportement (ajustable via config.precompactMode) :
//   'block-once' (défaut) : bloque UNE fois la compaction auto + avertit -> laisse le
//                           temps de lancer /engram-save ; 2e fois -> laisse passer.
//   'warn'                : avertit sans bloquer.
//   'auto'                : avertit sans bloquer (la sauvegarde best-effort se fait via
//                           le message ; pas de blocage).
// Émet à la fois `decision:block` ET un systemMessage/additionalContext : défensif,
// car le support du blocage PreCompact n'est pas garanti selon la version.
import { readStdinJson } from './lib/stdin.mjs';
import { loadConfig } from './lib/config.mjs';
import { readTmpState, writeTmpState } from './lib/state.mjs';

const payload = await readStdinJson();
const cwd = payload.cwd || process.cwd();
const cfg = loadConfig(cwd);

// Le déclencheur peut s'appeler trigger / compaction_trigger selon la version.
const trigger = payload.trigger || payload.compaction_trigger || payload.matcher || 'auto';
const sessionId = payload.session_id || 'unknown';

const saveMsg = 'Engram : le contexte va être compacté. Pour ne RIEN perdre, lance '
  + '`/engram-save` MAINTENANT (capture session + leçons + mémoire), puis laisse la '
  + 'compaction se faire.';

const additionalContext =
  '[Engram] Compaction imminente du contexte (trigger=' + trigger + '). '
  + 'AVANT toute compaction, exécute la commande /engram-save pour persister la mémoire '
  + '(session du jour, lessons.md, MEMORY.md). Si l\'utilisateur préfère ne pas sauvegarder, '
  + 'il peut ignorer ce message. La mémoire sera rechargée automatiquement après la compaction.';

// État anti-deadlock (éphémère, hors .engram) : on ne bloque qu'une fois par session.
const state = readTmpState(cwd);
state.precompactBlocks = state.precompactBlocks || {};
const alreadyBlocked = state.precompactBlocks[sessionId] || 0;

let shouldBlock = false;
if (cfg.precompactMode === 'block-once' && trigger === 'auto' && alreadyBlocked < 1) {
  shouldBlock = true;
}

const out = {
  systemMessage: '⚠️ ' + saveMsg,
  hookSpecificOutput: { hookEventName: 'PreCompact', additionalContext },
};

if (shouldBlock) {
  out.decision = 'block';
  out.reason = saveMsg;
  state.precompactBlocks[sessionId] = alreadyBlocked + 1;
  writeTmpState(cwd, state);
}

process.stdout.write(JSON.stringify(out));
process.exit(0);
