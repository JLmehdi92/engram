#!/usr/bin/env node
// hook-stop.mjs — déclenché à la fin de chaque réponse de Claude (hook Stop).
// Avertit PROACTIVEMENT quand le contexte approche la saturation (~70%) pour lancer
// /engram-save AVANT la compaction. Ne bloque jamais (pas de decision:block).
import { readStdinJson } from './lib/stdin.mjs';
import { loadConfig } from './lib/config.mjs';
import { lastContextTokens } from './lib/transcript.mjs';
import { readTmpState, writeTmpState } from './lib/state.mjs';

const payload = await readStdinJson();
const cwd = payload.cwd || process.cwd();
const cfg = loadConfig(cwd);
const cap = cfg.capture || {};

if (cap.autoWarn === false) process.exit(0);

const tp = payload.transcript_path;
if (!tp) process.exit(0);

const tokens = lastContextTokens(tp);
if (!tokens) process.exit(0);

const windowTokens = cap.contextWindow || 200000;
const pct = cap.contextThresholdPct || 70;
const threshold = cap.contextThresholdTokens || Math.round(windowTokens * pct / 100);
if (tokens < threshold) process.exit(0);

// Anti-spam : ne ré-avertit que si le contexte a notablement grossi depuis la dernière alerte.
const sid = payload.session_id || 'unknown';
// Ré-avertit seulement après une croissance notable (≈10% de la fenêtre) → pas de spam.
const minReWarn = cap.minReWarnTokens || Math.round(windowTokens * 0.1);
const st = readTmpState(cwd);
st.warns = st.warns || {};
if (st.warns[sid] && tokens - st.warns[sid] < minReWarn) process.exit(0);
st.warns[sid] = tokens;
writeTmpState(cwd, st);

const pctNow = Math.round((tokens / windowTokens) * 100);
const msg = `⚠️ Engram : contexte ~${pctNow}% (${tokens} tokens). Lance \`/engram-save\` `
  + 'maintenant pour persister la mémoire avant la compaction.';

process.stdout.write(JSON.stringify({
  systemMessage: msg,
  hookSpecificOutput: {
    hookEventName: 'Stop',
    additionalContext: '[Engram] Le contexte approche la saturation (~' + pctNow + '%). '
      + 'Propose à l\'utilisateur de lancer /engram-save pour ne rien perdre avant la compaction.',
  },
}));
process.exit(0);
