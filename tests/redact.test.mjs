import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactText, redactDeep } from '../scripts/lib/redact.mjs';

test('masque les clés OpenAI/Anthropic', () => {
  assert.match(redactText('key=sk-abcdEFGH1234567890xyz'), /«REDACTED:openai-key»/);
  assert.match(redactText('sk-ant-abcdEFGH1234567890xyz'), /«REDACTED:anthropic-key»/);
});

test('masque les tokens GitHub et clés AWS', () => {
  assert.match(redactText('ghp_0123456789abcdefABCDEF0123456789ab'), /«REDACTED:github-token»/);
  assert.match(redactText('AKIAIOSFODNN7EXAMPLE'), /«REDACTED:aws-access-key»/);
});

test('masque les JWT et Bearer', () => {
  assert.match(redactText('eyJhbGciOiJIUzI1.eyJzdWIiOiIxMjM0.SflKxwRJSMeKKF2QT4'), /«REDACTED:jwt»/);
  assert.match(redactText('Authorization: Bearer abcdef0123456789ghij'), /«REDACTED:bearer»/);
});

test('masque les blocs de clé privée PEM', () => {
  const pem = '-----BEGIN RSA PRIVATE KEY-----\nMIIEabc\n-----END RSA PRIVATE KEY-----';
  assert.match(redactText(pem), /«REDACTED:private-key»/);
});

test('masque les credentials dans une URL en gardant le schéma', () => {
  const out = redactText('clone https://alice:s3cr3t@github.com/x.git');
  assert.match(out, /https:\/\/«REDACTED:url-credentials»@github\.com/);
});

test('masque les affectations sensibles en gardant la clé', () => {
  assert.match(redactText('API_KEY=supersecretvalue123'), /API_KEY=«REDACTED:secret»/);
  assert.match(redactText('DB_PASSWORD: hunter2hunter2'), /DB_PASSWORD=«REDACTED:secret»/);
});

test('laisse le texte normal intact', () => {
  const s = 'const x = 42; // rien de secret ici';
  assert.equal(redactText(s), s);
});

test('redactDeep traverse les structures', () => {
  const out = redactDeep({ a: 'sk-abcdEFGH1234567890xyz', b: [{ c: 'ok' }] });
  assert.match(out.a, /REDACTED/);
  assert.equal(out.b[0].c, 'ok');
});
