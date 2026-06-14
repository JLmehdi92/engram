#!/usr/bin/env node
// hook-sessionstart.mjs — recharge la mémoire Engram au démarrage de session,
// y compris APRÈS une compaction (source='compact') : c'est la récupération mémoire.
// Respecte le plafond de tokens (lib/memory.mjs) avec fallback dégressif.
import { readStdinJson } from './lib/stdin.mjs';
import { loadConfig } from './lib/config.mjs';
import { loadMemory } from './lib/memory.mjs';

const payload = await readStdinJson();
const cwd = payload.cwd || process.cwd();
const source = payload.source || 'startup';
const cfg = loadConfig(cwd);

if (!cfg.autoLoad) { process.exit(0); }

const mem = loadMemory(cwd, cfg);

if (!mem.available) {
  // Aucune mémoire pour ce projet : petit rappel discret au tout premier démarrage.
  if (source === 'startup') {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: '[Engram] Aucune mémoire .engram/ pour ce projet. '
          + 'En fin de session, lance `/engram-save` pour la créer.',
      },
    }));
  }
  process.exit(0);
}

const banner = source === 'compact'
  ? '🧠 Engram : mémoire restaurée après compaction.'
  : '🧠 Engram : mémoire du projet rechargée (' + mem.summary + ')';

process.stdout.write(JSON.stringify({
  systemMessage: banner,
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: mem.context,
  },
}));
process.exit(0);
