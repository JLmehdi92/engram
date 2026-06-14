import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { deepMerge, loadConfig, DEFAULTS } from '../scripts/lib/config.mjs';

test('deepMerge: fusionne en profondeur sans écraser les clés sœurs', () => {
  const base = { a: 1, capture: { autoWarn: true, contextWindow: 200000 }, recall: { topK: 5 } };
  const over = { capture: { contextWindow: 1000000 } };
  const m = deepMerge(base, over);
  assert.equal(m.capture.contextWindow, 1000000);
  assert.equal(m.capture.autoWarn, true);          // pas écrasé
  assert.equal(m.recall.topK, 5);                   // intact
});

test('loadConfig: couche GLOBALE puis PROJET (projet gagne)', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'engram-cfg-'));
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'engram-proj-'));
  fs.writeFileSync(path.join(home, 'global.json'), JSON.stringify({ capture: { contextWindow: 1000000 }, maxSessionsOnLoad: 9 }));
  fs.mkdirSync(path.join(cwd, '.engram'));
  fs.writeFileSync(path.join(cwd, '.engram', 'config.json'), JSON.stringify({ maxSessionsOnLoad: 2 }));

  const prev = process.env.ENGRAM_GLOBAL_CONFIG;
  process.env.ENGRAM_GLOBAL_CONFIG = path.join(home, 'global.json');
  try {
    const cfg = loadConfig(cwd);
    assert.equal(cfg.capture.contextWindow, 1000000);   // vient du global
    assert.equal(cfg.maxSessionsOnLoad, 2);             // projet gagne sur global
    assert.equal(cfg.precompactMode, DEFAULTS.precompactMode); // défaut conservé
  } finally {
    if (prev === undefined) delete process.env.ENGRAM_GLOBAL_CONFIG; else process.env.ENGRAM_GLOBAL_CONFIG = prev;
  }
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(cwd, { recursive: true, force: true });
});
