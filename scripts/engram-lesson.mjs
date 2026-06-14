#!/usr/bin/env node
// engram-lesson.mjs — opérations déterministes sur lessons.md (apprentissage des erreurs).
// Commandes :
//   add --title T --trigger ... --symptom ... --root-cause ... --fix ... --rule ... [--importance N] [--refs a,b]
//   bump <id> <helpful|harmful>
//   supersede <oldId> <newId>
//   find "<texte>"
//   list
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { engramDir, exists, ensureDir } from './lib/paths.mjs';
import {
  parseLessons, addLesson, bumpCounter, supersedeLesson, findSimilarLessons, lessonsScaffold,
} from './lib/lessons.mjs';

const cwd = process.cwd();
const cfg = loadConfig(cwd);
const dir = engramDir(cwd, cfg.outputDir);
const file = path.join(dir, 'lessons.md');
const today = new Date().toISOString().slice(0, 10);
const args = process.argv.slice(2);
const cmd = args[0];

function opt(name, def) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def;
}
function read() { return exists(file) ? fs.readFileSync(file, 'utf8') : lessonsScaffold(today); }
function write(c) { ensureDir(dir); fs.writeFileSync(file, c); }
function out(o) { process.stdout.write(JSON.stringify(o, null, 2)); }

if (cmd === 'add') {
  const fields = {
    trigger: opt('--trigger'), symptom: opt('--symptom'), root_cause: opt('--root-cause'),
    fix: opt('--fix'), rule: opt('--rule'),
  };
  const meta = { importance: Number(opt('--importance', 6)) || 6 };
  const refs = opt('--refs'); if (refs) meta.refs = refs.split(',').map((s) => s.trim());
  const { content, id } = addLesson(read(), { title: opt('--title', 'Leçon'), fields, meta }, today);
  write(content);
  out({ ok: true, op: 'add', id });
} else if (cmd === 'bump') {
  const id = args[1]; const field = args[2];
  if (!['helpful', 'harmful'].includes(field)) { out({ ok: false, reason: 'champ = helpful|harmful' }); process.exit(0); }
  write(bumpCounter(read(), id, field, today));
  out({ ok: true, op: 'bump', id, field });
} else if (cmd === 'supersede') {
  write(supersedeLesson(read(), args[1], args[2], today));
  out({ ok: true, op: 'supersede', oldId: args[1], newId: args[2] });
} else if (cmd === 'find') {
  const text = args.slice(1).filter((a) => !a.startsWith('--')).join(' ');
  const similar = await findSimilarLessons(parseLessons(read()), text, Number(opt('--topn', 3)));
  out({ ok: true, op: 'find', query: text, similar });
} else if (cmd === 'list') {
  out({ ok: true, op: 'list', lessons: parseLessons(read()).map((l) => ({ id: l.id, title: l.title, meta: l.meta })) });
} else {
  out({ ok: false, reason: 'commande inconnue', usage: ['add', 'bump', 'supersede', 'find', 'list'] });
}
