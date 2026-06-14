import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'mcp-server.mjs');

// Lance le serveur, envoie une liste de requêtes JSON-RPC, renvoie une map id->réponse.
function rpc(requests, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER], { env: { ...process.env, ...env } });
    const responses = {};
    let buf = '';
    const wanted = new Set(requests.filter((r) => r.id !== undefined).map((r) => r.id));
    const timer = setTimeout(() => { child.kill(); reject(new Error('timeout MCP')); }, 10000);

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (d) => {
      buf += d;
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let msg; try { msg = JSON.parse(line); } catch { continue; }
        if (msg.id !== undefined) {
          responses[msg.id] = msg;
          wanted.delete(msg.id);
          if (wanted.size === 0) { clearTimeout(timer); child.stdin.end(); resolve(responses); }
        }
      }
    });
    child.on('error', reject);
    for (const r of requests) child.stdin.write(JSON.stringify(r) + '\n');
  });
}

test('MCP: initialize renvoie serverInfo + capabilities tools', async () => {
  const r = await rpc([{ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }]);
  assert.equal(r[1].result.serverInfo.name, 'engram');
  assert.ok(r[1].result.capabilities.tools);
});

test('MCP: tools/list expose engram_recall, engram_lessons, engram_save_note', async () => {
  const r = await rpc([{ jsonrpc: '2.0', id: 2, method: 'tools/list' }]);
  const names = r[2].result.tools.map((t) => t.name);
  assert.deepEqual(names.sort(), ['engram_lessons', 'engram_recall', 'engram_save_note']);
});

test('MCP: tools/call engram_recall renvoie du contenu texte', async () => {
  // cwd du serveur = racine du repo (où .engram existe).
  const r = await rpc([{
    jsonrpc: '2.0', id: 3, method: 'tools/call',
    params: { name: 'engram_recall', arguments: { query: 'precompact compaction', topK: 2 } },
  }], { ENGRAM_CWD: process.cwd() });
  const text = r[3].result.content[0].text;
  assert.equal(typeof text, 'string');
  assert.ok(text.length > 0);
});

test('MCP: engram_save_note écrit une note dans un .engram temporaire', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engram-mcp-'));
  fs.mkdirSync(path.join(dir, '.engram'));
  const r = await rpc([{
    jsonrpc: '2.0', id: 4, method: 'tools/call',
    params: { name: 'engram_save_note', arguments: { title: 'Test Note', content: 'Contenu de test', type: 'reference' } },
  }], { ENGRAM_CWD: dir });
  assert.match(r[4].result.content[0].text, /Note enregistr/);
  const written = fs.readFileSync(path.join(dir, '.engram', 'test-note.md'), 'utf8');
  assert.match(written, /title: Test Note/);
  assert.match(written, /Contenu de test/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('MCP: méthode inconnue -> erreur JSON-RPC', async () => {
  const r = await rpc([{ jsonrpc: '2.0', id: 5, method: 'does/not/exist' }]);
  assert.ok(r[5].error);
  assert.equal(r[5].error.code, -32601);
});
