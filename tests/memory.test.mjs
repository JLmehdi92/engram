import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadMemory } from '../scripts/lib/memory.mjs';
import { DEFAULTS } from '../scripts/lib/config.mjs';

let cwd, eng;
const now = Date.parse('2026-06-15T00:00:00Z');

before(() => {
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'engram-mem-'));
  eng = path.join(cwd, '.engram');
  fs.mkdirSync(path.join(eng, 'sessions'), { recursive: true });
  fs.writeFileSync(path.join(eng, 'STATE.md'), '# STATE\nOn en est à la phase 5.');
  fs.writeFileSync(path.join(eng, 'MEMORY.md'), '# MEMORY\nindex court.');
  fs.writeFileSync(path.join(eng, 'sessions', 'INDEX.md'), '# Index\n- session a');
  fs.writeFileSync(path.join(eng, 'lessons.md'),
    '---\ntype: lessons\n---\n\n'
    + '### [L-001] Erreur A\n- trigger: cas A\n- rule: faire X\n- meta: importance=9 · helpful=2 · harmful=0 · status=active · created=2026-06-14\n\n'
    + '### [L-002] Erreur B\n- trigger: cas B\n- rule: faire Y\n- meta: importance=3 · status=active · created=2026-05-01\n');
  fs.writeFileSync(path.join(eng, 'sessions', '2026-06-14-a.md'), 'A' + 's'.repeat(3000));
  fs.writeFileSync(path.join(eng, 'sessions', '2026-06-13-b.md'), 'B' + 's'.repeat(3000));
});

after(() => { fs.rmSync(cwd, { recursive: true, force: true }); });

const cfg = (over) => ({ ...DEFAULTS, ...over });

test('dossier sans contenu réel -> non disponible', () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'engram-empty-'));
  fs.mkdirSync(path.join(empty, '.engram'));
  fs.writeFileSync(path.join(empty, '.engram', '.state.json'), '{}');
  assert.equal(loadMemory(empty, cfg(), { nowMs: now }).available, false);
  fs.rmSync(empty, { recursive: true, force: true });
});

test('budget large -> STATE + MEMORY + leçons + sessions', () => {
  const r = loadMemory(cwd, cfg({ sessionStartTokenBudget: 100000 }), { nowMs: now });
  assert.equal(r.available, true);
  assert.equal(r.level, 'full');
  assert.ok(r.context.includes('STATE — où on en est'));
  assert.ok(r.context.includes('phase 5'));
  assert.equal(r.lessonsIncluded, 2);
  assert.equal(r.sessionsIncluded, 2);
});

test('leçons triées par importance×récence (L-001 prioritaire)', () => {
  const r = loadMemory(cwd, cfg({ sessionStartTokenBudget: 100000, recall: { maxLessonsOnStart: 1 } }), { nowMs: now });
  assert.equal(r.lessonsIncluded, 1);
  assert.ok(r.context.includes('[L-001]'));
  assert.ok(!r.context.includes('[L-002]'));     // importance 3, écartée
});

test('budget moyen -> garde STATE+MEMORY+leçons, lâche les grosses sessions', () => {
  const r = loadMemory(cwd, cfg({ sessionStartTokenBudget: 400 }), { nowMs: now });
  assert.equal(r.available, true);
  assert.equal(r.sessionsIncluded, 0);
  assert.ok(r.lessonsIncluded >= 1);
  assert.ok(r.context.includes('STATE'));
});

test('budget minuscule -> pointer-only', () => {
  const r = loadMemory(cwd, cfg({ sessionStartTokenBudget: 10 }), { nowMs: now });
  assert.equal(r.available, true);
  assert.equal(r.level, 'pointer-only');
});
