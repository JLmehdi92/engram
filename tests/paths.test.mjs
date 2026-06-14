import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { encodeProjectPath, engramDir } from '../scripts/lib/paths.mjs';

test('encode un cwd Windows en nom de dossier projects', () => {
  assert.equal(encodeProjectPath('C:\\Users\\you\\Desktop\\engram'),
    'C--Users-you-Desktop-engram');
});

test('encode un cwd POSIX', () => {
  assert.equal(encodeProjectPath('/home/user/proj'), '-home-user-proj');
});

test('engramDir respecte outputDir relatif et absolu', () => {
  assert.equal(engramDir('/repo', '.engram'), path.join('/repo', '.engram'));
  assert.equal(engramDir('/repo', 'memory'), path.join('/repo', 'memory'));
  assert.equal(engramDir('/repo', path.resolve('/abs/out')), path.resolve('/abs/out'));
});
