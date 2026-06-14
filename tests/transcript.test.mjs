import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDigest } from '../scripts/lib/transcript.mjs';

// Mini-transcript reproduisant le schéma réel observé.
const objs = [
  { type: 'user', timestamp: '2026-06-14T10:00:00Z', cwd: '/p', gitBranch: 'main',
    message: { role: 'user', content: 'Corrige le bug de parsing' } },
  { type: 'assistant', timestamp: '2026-06-14T10:00:05Z',
    message: { role: 'assistant', model: 'claude-opus-4-8',
      usage: { input_tokens: 10, cache_read_input_tokens: 1000, cache_creation_input_tokens: 200 },
      content: [
        { type: 'thinking', thinking: 'réflexion' },
        { type: 'text', text: 'Je vais lancer une commande.' },
        { type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'npm test', description: 'tests' } },
        { type: 'tool_use', id: 't2', name: 'Write', input: { file_path: 'src/a.js' } },
      ] } },
  { type: 'user', timestamp: '2026-06-14T10:00:08Z',
    message: { role: 'user', content: [
      { type: 'tool_result', tool_use_id: 't1', is_error: true, content: 'Error: exit code 1' },
      { type: 'tool_result', tool_use_id: 't2', content: 'ok' },
    ] } },
];

test('extrait prompts, notes, tool calls, fichiers, commandes', () => {
  const d = buildDigest(objs);
  assert.equal(d.userPrompts.length, 1);
  assert.match(d.userPrompts[0].text, /Corrige le bug/);
  assert.equal(d.assistantNotes.length, 1);
  assert.equal(d.toolCalls.length, 2);
  assert.deepEqual(d.filesTouched, ['src/a.js']);
  assert.equal(d.commands[0].command, 'npm test');
});

test('détecte les erreurs depuis les tool_result', () => {
  const d = buildDigest(objs);
  assert.equal(d.errors.length, 1);
  assert.equal(d.errors[0].tool, 'Bash');
  assert.equal(d.errors[0].command, 'npm test');
});

test('estime les tokens de contexte depuis usage', () => {
  const d = buildDigest(objs);
  assert.equal(d.meta.estimatedContextTokens, 1210); // 10 + 1000 + 200
  assert.equal(d.meta.model, 'claude-opus-4-8');
});

test('le filtre sinceTs exclut les lignes trop anciennes', () => {
  const d = buildDigest(objs, { sinceTs: '2026-06-14T10:00:06Z' });
  assert.equal(d.userPrompts.length, 0);       // prompt à 10:00:00 exclu
  assert.equal(d.toolCalls.length, 0);          // assistant à 10:00:05 exclu
});
