// transcript.mjs — lecture & digest des transcripts .jsonl de Claude Code.
//
// Schéma observé (vérifié sur un transcript réel) :
//  - chaque ligne = un objet JSON avec { type, timestamp, cwd, sessionId, gitBranch, ... }
//  - type 'user'      : message.content = String (vrai prompt) OU Array (tool_result/text)
//  - type 'assistant' : message.content = Array de blocs { type: thinking|text|tool_use }
//                       message.usage = { input_tokens, cache_read_input_tokens,
//                                         cache_creation_input_tokens, output_tokens, ... }
//  - tool_result revient comme une ligne 'user' avec content = [{type:'tool_result', ...}]
import fs from 'node:fs';

export function readTranscript(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const out = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* ligne corrompue : ignorée */ }
  }
  return out;
}

function asText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text)
      .join('\n');
  }
  return '';
}

// Résumé court d'un appel d'outil (sans le payload complet).
function summarizeToolUse(block) {
  const input = block.input || {};
  const name = block.name || 'tool';
  switch (name) {
    case 'Bash':
    case 'PowerShell':
      return { name, command: input.command, description: input.description };
    case 'Edit':
    case 'Write':
    case 'NotebookEdit':
      return { name, file: input.file_path || input.notebook_path };
    case 'Read':
      return { name, file: input.file_path };
    case 'Glob':
      return { name, pattern: input.pattern };
    case 'Grep':
      return { name, pattern: input.pattern };
    case 'Agent':
    case 'Task':
      return { name, description: input.description, agentType: input.subagent_type };
    case 'Skill':
      return { name, skill: input.skill };
    default:
      return { name };
  }
}

function resultIsError(block) {
  if (!block) return false;
  if (block.is_error) return true;
  const c = block.content;
  const text = typeof c === 'string' ? c
    : Array.isArray(c) ? c.map((x) => (x && x.text) || '').join('\n') : '';
  return /(^|\n)\s*(error|exception|traceback|exit code [1-9]|failed|fatal)\b/i.test(text)
    ? text.slice(0, 400)
    : false;
}

// Construit un digest structuré, prêt à être passé à Claude.
// opts.sinceTs : ISO string optionnelle pour ne garder que les lignes >= sinceTs.
export function buildDigest(objs, opts = {}) {
  const since = opts.sinceTs ? new Date(opts.sinceTs).getTime() : null;
  const inWindow = (o) => {
    if (!since) return true;
    const t = o.timestamp ? new Date(o.timestamp).getTime() : null;
    return t == null || t >= since;
  };

  const userPrompts = [];
  const assistantNotes = [];
  const toolCalls = [];
  const filesTouched = new Set();
  const commands = [];
  const errors = [];
  const resultsById = new Map();

  // 1er passage : indexer les tool_result par id.
  for (const o of objs) {
    if (o.type === 'user' && Array.isArray(o.message?.content)) {
      for (const b of o.message.content) {
        if (b && b.type === 'tool_result') resultsById.set(b.tool_use_id, b);
      }
    }
  }

  let firstTs = null;
  let lastTs = null;
  let contextTokens = null;
  let model = null;
  let gitBranch = null;
  let cwd = null;

  for (const o of objs) {
    if (o.timestamp) {
      firstTs = firstTs || o.timestamp;
      lastTs = o.timestamp;
    }
    if (o.cwd) cwd = o.cwd;
    if (o.gitBranch) gitBranch = o.gitBranch;
    if (!inWindow(o)) continue;

    if (o.type === 'user') {
      const c = o.message?.content;
      if (typeof c === 'string' && c.trim() && o.userType !== 'meta') {
        userPrompts.push({ ts: o.timestamp, text: c.trim() });
      }
    } else if (o.type === 'assistant') {
      model = o.message?.model || model;
      const u = o.message?.usage;
      if (u) {
        const total = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0)
          + (u.cache_creation_input_tokens || 0);
        if (total) contextTokens = total;
      }
      for (const b of o.message?.content || []) {
        if (b.type === 'text' && b.text?.trim()) {
          assistantNotes.push({ ts: o.timestamp, text: b.text.trim() });
        } else if (b.type === 'tool_use') {
          const s = summarizeToolUse(b);
          toolCalls.push({ ts: o.timestamp, ...s });
          if (s.file) filesTouched.add(s.file);
          if (s.command) commands.push({ ts: o.timestamp, command: s.command, description: s.description });
          const res = resultsById.get(b.id);
          const err = resultIsError(res);
          if (err) errors.push({ ts: o.timestamp, tool: s.name, detail: err, command: s.command, file: s.file });
        }
      }
    }
  }

  return {
    meta: {
      firstTs, lastTs, model, gitBranch, cwd,
      estimatedContextTokens: contextTokens,
      userPromptCount: userPrompts.length,
      assistantTurnCount: assistantNotes.length,
      toolCallCount: toolCalls.length,
    },
    userPrompts,
    assistantNotes,
    toolCalls,
    commands,
    filesTouched: [...filesTouched],
    errors,
  };
}
