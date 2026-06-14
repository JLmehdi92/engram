import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadMemory } from '../scripts/lib/memory.mjs';
import { DEFAULTS } from '../scripts/lib/config.mjs';

let cwd, eng;

before(() => {
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'engram-test-'));
  eng = path.join(cwd, '.engram');
  fs.mkdirSync(path.join(eng, 'sessions'), { recursive: true });
  fs.writeFileSync(path.join(eng, 'MEMORY.md'), '# MEMORY\n' + 'm'.repeat(400));
  fs.writeFileSync(path.join(eng, 'lessons.md'), '# Lessons\n' + 'l'.repeat(2000));
  fs.writeFileSync(path.join(eng, 'sessions', 'INDEX.md'), '# Index\n' + 'i'.repeat(100));
  fs.writeFileSync(path.join(eng, 'sessions', '2026-06-14-a.md'), 'A' + 's'.repeat(3000));
  fs.writeFileSync(path.join(eng, 'sessions', '2026-06-13-b.md'), 'B' + 's'.repeat(3000));
});

after(() => { fs.rmSync(cwd, { recursive: true, force: true }); });

const cfg = (over) => ({ ...DEFAULTS, ...over });

test('dossier sans contenu réel -> non disponible', () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'engram-empty-'));
  fs.mkdirSync(path.join(empty, '.engram'));
  fs.writeFileSync(path.join(empty, '.engram', '.state.json'), '{}');
  const r = loadMemory(empty, cfg());
  assert.equal(r.available, false);
  fs.rmSync(empty, { recursive: true, force: true });
});

test('budget large -> niveau full avec sessions', () => {
  const r = loadMemory(cwd, cfg({ sessionStartTokenBudget: 100000, maxSessionsOnLoad: 3 }));
  assert.equal(r.available, true);
  assert.equal(r.level, 'full');
  assert.ok(r.context.includes('MEMORY') && r.context.includes('Lessons'));
});

test('budget moyen -> réduit le nombre de sessions, garde lessons', () => {
  // Assez pour MEMORY+lessons+index mais pas pour les grosses sessions.
  const r = loadMemory(cwd, cfg({ sessionStartTokenBudget: 800, maxSessionsOnLoad: 3 }));
  assert.equal(r.available, true);
  assert.equal(r.sessionsIncluded, 0);
  assert.ok(r.context.includes('Lessons'));
});

test('budget trop petit pour lessons -> fallback index', () => {
  const r = loadMemory(cwd, cfg({ sessionStartTokenBudget: 350 }));
  assert.equal(r.available, true);
  assert.equal(r.level, 'index-fallback');
  assert.ok(r.context.includes('trop volumineux'));
});

test('budget minuscule -> pointer-only', () => {
  const r = loadMemory(cwd, cfg({ sessionStartTokenBudget: 20 }));
  assert.equal(r.available, true);
  assert.equal(r.level, 'pointer-only');
});
