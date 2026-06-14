import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLessons, lessonMatchText, nextLessonId } from '../scripts/lib/lessons.mjs';

const md = `---
title: Lessons
type: lessons
---

# Leçons

### [L-001] Faux contexte PreCompact
- trigger: premier usage du hook precompact
- symptom: SessionStart annonce mémoire restaurée à tort
- root_cause: writeState créait .engram prématurément
- fix: état éphémère en tmpdir + loadMemory teste le contenu
- rule: un état éphémère ne vit pas dans le dossier-signal
- meta: importance=8 · helpful=2 · harmful=0 · status=active · created=2026-06-14 · refs=[state.mjs,memory.mjs]

### [L-002] Bash plante sur chemins Windows
- trigger: outil Bash avec chemin C:\\Users
- symptom: syntax error near unexpected token
- root_cause: bash interprète le backslash
- fix: utiliser PowerShell
- rule: sous Windows, PowerShell pour le FS
- meta: importance=6 · helpful=1 · harmful=0
`;

test('parseLessons: extrait blocs, champs et meta', () => {
  const ls = parseLessons(md);
  assert.equal(ls.length, 2);
  const l1 = ls[0];
  assert.equal(l1.id, 'L-001');
  assert.match(l1.title, /Faux contexte/);
  assert.equal(l1.fields.trigger, 'premier usage du hook precompact');
  assert.equal(l1.meta.importance, 8);
  assert.equal(l1.meta.helpful, 2);
  assert.deepEqual(l1.meta.refs, ['state.mjs', 'memory.mjs']);
});

test('lessonMatchText: concatène les champs de matching', () => {
  const [l1] = parseLessons(md);
  const t = lessonMatchText(l1);
  assert.match(t, /precompact/i);
  assert.match(t, /tmpdir|éphémère/i);
});

test('nextLessonId: incrémente le max', () => {
  assert.equal(nextLessonId(parseLessons(md)), 'L-003');
  assert.equal(nextLessonId([]), 'L-001');
});
