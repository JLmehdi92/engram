import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isIgnored, isBinaryPath, loadGitignore } from '../scripts/lib/gitignore.mjs';

// On teste le matcher directement avec des règles construites via loadGitignore
// (qui inclut DEFAULT_EXCLUDES) sur un dossier sans .gitignore.
const rules = loadGitignore('.__inexistant__');

test('exclut les dossiers par défaut', () => {
  assert.equal(isIgnored('node_modules/lib/index.js', rules), true);
  assert.equal(isIgnored('.git/config', rules), true);
  assert.equal(isIgnored('.engram/MEMORY.md', rules), true);
  assert.equal(isIgnored('dist/bundle.js', rules), true);
});

test('garde les fichiers source', () => {
  assert.equal(isIgnored('src/index.js', rules), false);
  assert.equal(isIgnored('scripts/lib/redact.mjs', rules), false);
});

test('détecte les binaires par extension', () => {
  assert.equal(isBinaryPath('logo.png'), true);
  assert.equal(isBinaryPath('archive.zip'), true);
  assert.equal(isBinaryPath('app.exe'), true);
  assert.equal(isBinaryPath('main.mjs'), false);
  assert.equal(isBinaryPath('README.md'), false);
});
