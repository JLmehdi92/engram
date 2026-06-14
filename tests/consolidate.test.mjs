import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { removeLesson, parseLessons, addLesson, lessonsScaffold } from '../scripts/lib/lessons.mjs';

const SCRIPTS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts');

function runNode(script, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(SCRIPTS, script), ...args], { cwd });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.on('error', reject);
    child.on('close', () => { try { resolve(JSON.parse(out)); } catch { resolve({ raw: out }); } });
  });
}

test('removeLesson: retire le bloc, garde le reste', () => {
  let c = lessonsScaffold('2026-06-15');
  c = addLesson(c, { title: 'A', fields: { trigger: 'a' }, meta: {} }, '2026-06-15').content;
  c = addLesson(c, { title: 'B', fields: { trigger: 'b' }, meta: {} }, '2026-06-15').content;
  const { content, removed } = removeLesson(c, 'L-001');
  assert.match(removed, /\[L-001\]/);
  const ls = parseLessons(content);
  assert.equal(ls.length, 1);
  assert.equal(ls[0].id, 'L-002');
});

test('consolidate: rapporte et archive les leçons remplacées (--apply)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engram-cons-'));
  const eng = path.join(dir, '.engram');
  fs.mkdirSync(eng, { recursive: true });
  let c = lessonsScaffold('2026-06-15');
  c = addLesson(c, { title: 'Active', fields: { trigger: 'x' }, meta: { status: 'active' } }, '2026-06-15').content;
  c = addLesson(c, { title: 'Remplacée', fields: { trigger: 'y' }, meta: { status: 'superseded', superseded_by: 'L-001' } }, '2026-06-15').content;
  fs.writeFileSync(path.join(eng, 'lessons.md'), c);

  const report = await runNode('engram-consolidate.mjs', [], dir);
  assert.ok(report.archivable.find((a) => a.id === 'L-002'));

  const applied = await runNode('engram-consolidate.mjs', ['--apply'], dir);
  assert.ok(applied.actions.some((a) => /L-002/.test(a)));
  // L-002 retirée du fichier principal, présente dans archive/
  const main = fs.readFileSync(path.join(eng, 'lessons.md'), 'utf8');
  assert.ok(!main.includes('[L-002]'));
  assert.ok(main.includes('[L-001]'));
  const arch = fs.readFileSync(path.join(eng, 'archive', 'lessons.md'), 'utf8');
  assert.ok(arch.includes('[L-002]'));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('hook-stop: avertit au-dessus du seuil, silencieux en-dessous', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engram-stop-'));
  fs.mkdirSync(path.join(dir, '.engram'), { recursive: true });
  // config: fenêtre 1000, seuil 70% -> 700 tokens
  fs.writeFileSync(path.join(dir, '.engram', 'config.json'),
    JSON.stringify({ capture: { contextWindow: 1000, contextThresholdPct: 70 } }));
  const tpath = path.join(dir, 't.jsonl');
  const mkLine = (ctx) => JSON.stringify({ type: 'assistant', message: { usage: { input_tokens: ctx, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } });

  function runStop(ctx, sid) {
    fs.writeFileSync(tpath, mkLine(ctx) + '\n');
    return new Promise((resolve) => {
      const child = spawn(process.execPath, [path.join(SCRIPTS, 'hook-stop.mjs')], { cwd: dir });
      let out = '';
      child.stdout.on('data', (d) => { out += d; });
      child.on('close', () => resolve(out.trim()));
      child.stdin.write(JSON.stringify({ cwd: dir, session_id: sid, transcript_path: tpath }));
      child.stdin.end();
    });
  }

  const under = await runStop(500, 's1');
  assert.equal(under, '');                          // sous le seuil -> rien
  const over = await runStop(800, 's2');
  assert.ok(over.includes('contexte'));             // au-dessus -> avertit
  fs.rmSync(dir, { recursive: true, force: true });
});
