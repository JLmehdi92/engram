import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseLessons, renderLesson, addLesson, bumpCounter, supersedeLesson,
  findSimilarLessons, lessonsScaffold,
} from '../scripts/lib/lessons.mjs';

test('renderLesson -> parseLessons round-trip', () => {
  const l = {
    id: 'L-007', title: 'Titre test',
    fields: { trigger: 't', symptom: 's', root_cause: 'rc', fix: 'f', rule: 'r' },
    meta: { importance: 7, helpful: 2, harmful: 1, status: 'active', created: '2026-06-15', refs: ['a.mjs', 'b.mjs'] },
  };
  const parsed = parseLessons(renderLesson(l))[0];
  assert.equal(parsed.id, 'L-007');
  assert.equal(parsed.fields.root_cause, 'rc');
  assert.equal(parsed.meta.importance, 7);
  assert.equal(parsed.meta.helpful, 2);
  assert.deepEqual(parsed.meta.refs, ['a.mjs', 'b.mjs']);
});

test('addLesson: append delta + id incrémenté', () => {
  let c = lessonsScaffold('2026-06-15');
  const r1 = addLesson(c, { title: 'Un', fields: { trigger: 'x' }, meta: { importance: 5 } }, '2026-06-15');
  assert.equal(r1.id, 'L-001');
  const r2 = addLesson(r1.content, { title: 'Deux', fields: { trigger: 'y' }, meta: {} }, '2026-06-15');
  assert.equal(r2.id, 'L-002');
  const ls = parseLessons(r2.content);
  assert.equal(ls.length, 2);
  assert.equal(ls[0].title, 'Un');
  assert.equal(ls[1].title, 'Deux');
});

test('bumpCounter: incrémente sans toucher les autres blocs', () => {
  let c = lessonsScaffold('2026-06-15');
  c = addLesson(c, { title: 'A', fields: { trigger: 'a' }, meta: { importance: 5 } }, '2026-06-15').content;
  c = addLesson(c, { title: 'B', fields: { trigger: 'b' }, meta: { importance: 5 } }, '2026-06-15').content;
  const before = parseLessons(c);
  const bBlockRaw = before[1].raw;
  c = bumpCounter(c, 'L-001', 'helpful', '2026-06-16');
  const after = parseLessons(c);
  assert.equal(after[0].meta.helpful, 1);
  assert.equal(after[0].meta.last_used, '2026-06-16');
  assert.equal(after[1].raw, bBlockRaw);          // B inchangé (delta)
});

test('supersedeLesson: marque remplacé, non destructif', () => {
  let c = lessonsScaffold('2026-06-15');
  c = addLesson(c, { title: 'Vieux', fields: { trigger: 'old' }, meta: {} }, '2026-06-15').content;
  c = addLesson(c, { title: 'Neuf', fields: { trigger: 'new' }, meta: {} }, '2026-06-15').content;
  c = supersedeLesson(c, 'L-001', 'L-002', '2026-06-16');
  const l1 = parseLessons(c).find((l) => l.id === 'L-001');
  assert.equal(l1.meta.status, 'superseded');
  assert.equal(l1.meta.superseded_by, 'L-002');
  assert.equal(l1.meta.valid_to, '2026-06-16');
  assert.ok(c.includes('Vieux'));                 // pas supprimé
});

test('findSimilarLessons: retrouve la leçon proche', async () => {
  let c = lessonsScaffold('2026-06-15');
  c = addLesson(c, { title: 'Bash Windows', fields: { trigger: 'bash chemin windows', symptom: 'syntax error backslash' }, meta: {} }, '2026-06-15').content;
  c = addLesson(c, { title: 'Cuisine', fields: { trigger: 'tomates oignons recette' }, meta: {} }, '2026-06-15').content;
  const sim = await findSimilarLessons(parseLessons(c), 'erreur bash backslash chemin windows', 2);
  assert.equal(sim[0].id, 'L-001');
});
