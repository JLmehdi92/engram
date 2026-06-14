#!/usr/bin/env node
// parse-transcript.mjs — transforme un transcript .jsonl en digest structuré,
// avec REDACTION des secrets (ajout 11.2 du spec).
// Usage : node parse-transcript.mjs [--file <path>] [--since <iso>] [--today]
// Sans --file, localise automatiquement la session courante.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib/config.mjs';
import { readTranscript, buildDigest } from './lib/transcript.mjs';
import { redactDeep } from './lib/redact.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cwd = process.cwd();
const cfg = loadConfig(cwd);
const args = process.argv.slice(2);

function arg(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}

let file = arg('--file');
if (!file) {
  try {
    const found = JSON.parse(execFileSync('node',
      [path.join(__dirname, 'find-transcript.mjs')],
      { cwd, encoding: 'utf8' }));
    if (found.found) file = found.path;
  } catch { /* */ }
}

if (!file) {
  process.stdout.write(JSON.stringify({ found: false, reason: 'transcript introuvable' }, null, 2));
  process.exit(0);
}

let sinceTs = arg('--since');
if (!sinceTs && args.includes('--today')) {
  const now = new Date();
  sinceTs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

const objs = readTranscript(file);
let digest = buildDigest(objs, { sinceTs });
if (cfg.redactSecrets) digest = redactDeep(digest);

process.stdout.write(JSON.stringify({ found: true, file, redacted: cfg.redactSecrets, digest }, null, 2));
