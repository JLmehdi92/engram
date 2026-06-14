import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter, buildFrontmatter } from '../scripts/lib/frontmatter.mjs';

test('parse un frontmatter simple + corps', () => {
  const md = '---\ntitle: Test\ntype: module\nstale: true\n---\nCorps ici.';
  const { data, body } = parseFrontmatter(md);
  assert.equal(data.title, 'Test');
  assert.equal(data.type, 'module');
  assert.equal(data.stale, true);
  assert.equal(body.trim(), 'Corps ici.');
});

test('retire les guillemets et gère false', () => {
  const { data } = parseFrontmatter('---\ntitle: "Avec espaces"\nstale: false\n---\nx');
  assert.equal(data.title, 'Avec espaces');
  assert.equal(data.stale, false);
});

test('sans frontmatter -> data vide, corps intact', () => {
  const { data, body } = parseFrontmatter('Pas de frontmatter');
  assert.deepEqual(data, {});
  assert.equal(body, 'Pas de frontmatter');
});

test('buildFrontmatter ignore null/undefined et est relisible', () => {
  const fm = buildFrontmatter({ title: 'X', type: 'lessons', skip: null, updated: '2026-06-14' });
  assert.match(fm, /title: X/);
  assert.doesNotMatch(fm, /skip/);
  const { data } = parseFrontmatter(fm + '\ncorps');
  assert.equal(data.type, 'lessons');
  assert.equal(data.updated, '2026-06-14');
});
