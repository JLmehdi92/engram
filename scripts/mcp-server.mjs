#!/usr/bin/env node
// mcp-server.mjs — serveur MCP (Model Context Protocol) pour Engram.
// JSON-RPC 2.0 sur stdio, messages délimités par des sauts de ligne. Zéro dépendance.
// Expose à Claude des outils pour interroger/écrire la mémoire EN PLEIN TRAVAIL :
//   - engram_recall(query, topK?, type?)  : rappel hybride
//   - engram_lessons(situation)           : leçons pertinentes (apprentissage des erreurs)
//   - engram_save_note(title, content, type?) : ajoute une note durable
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { engramDir, exists, ensureDir } from './lib/paths.mjs';
import { loadItems } from './lib/notes.mjs';
import { recall } from './lib/recall.mjs';
import { maybeSemanticRanks } from './lib/embeddings.mjs';

const SERVER = { name: 'engram', version: '0.2.0' };
const cwd = process.env.ENGRAM_CWD || process.cwd();

function cfgDir() {
  const cfg = loadConfig(cwd);
  return { cfg, dir: engramDir(cwd, cfg.outputDir) };
}

const TOOLS = [
  {
    name: 'engram_recall',
    description: 'Rappelle de la mémoire Engram les notes/leçons/sessions les plus pertinentes pour une requête (rappel hybride mots-clés + graphe + sémantique). À utiliser pour retrouver le contexte d\'un projet, une décision passée, où on en était.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'La question ou le sujet à retrouver en mémoire.' },
        topK: { type: 'number', description: 'Nombre de résultats (défaut 5).' },
        type: { type: 'string', description: 'Filtrer par type: note|lesson|session|module|architecture|decisions...' },
      },
      required: ['query'],
    },
  },
  {
    name: 'engram_lessons',
    description: 'Récupère les LEÇONS pertinentes (problèmes déjà rencontrés et résolus) pour la situation courante. À appeler AVANT de proposer une solution à un bug/erreur, pour ne pas répéter une erreur passée.',
    inputSchema: {
      type: 'object',
      properties: { situation: { type: 'string', description: 'Le problème/erreur/contexte courant.' } },
      required: ['situation'],
    },
  },
  {
    name: 'engram_save_note',
    description: 'Ajoute (ou met à jour) une note durable dans la mémoire Engram du projet.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        content: { type: 'string' },
        type: { type: 'string', description: 'overview|architecture|module|reference|decisions|glossary (défaut reference)' },
      },
      required: ['title', 'content'],
    },
  },
];

function slug(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'note';
}

async function getItems(dir) {
  if (!exists(dir)) return [];
  const itemsFile = path.join(dir, '.index', 'items.json');
  if (exists(itemsFile)) {
    try { return JSON.parse(fs.readFileSync(itemsFile, 'utf8')).items || []; } catch { /* */ }
  }
  return loadItems(dir);
}

function fmtResults(results) {
  if (!results.length) return 'Aucun souvenir pertinent trouvé.';
  return results.map((r) =>
    `• [score ${r.score}] (${r.type}) ${r.title} — ${r.path}\n  ${r.snippet}`).join('\n\n');
}

async function doRecall(query, { topK, type } = {}) {
  const { cfg, dir } = cfgDir();
  if (!exists(dir)) return 'Aucune mémoire Engram pour ce projet (.engram absent). Lance /engram-save.';
  const items = await getItems(dir);
  const rc = cfg.recall || {};
  const semantic = await maybeSemanticRanks(cfg, dir, items, query).catch(() => null);
  const results = recall(items, query, {
    topK: topK || rc.topK || 5, minScore: rc.minScore ?? 0,
    budgetTokens: rc.budgetTokens ?? 4000, weights: rc.weights, nowMs: Date.now(),
    type: type || null, semantic,
  });
  return fmtResults(results);
}

async function callTool(name, args) {
  if (name === 'engram_recall') return doRecall(args.query, { topK: args.topK, type: args.type });
  if (name === 'engram_lessons') return doRecall(args.situation, { type: 'lesson', topK: args.topK || 5 });
  if (name === 'engram_save_note') {
    const { cfg, dir } = cfgDir();
    ensureDir(dir);
    const type = args.type || 'reference';
    const file = path.join(dir, `${slug(args.title)}.md`);
    const today = new Date().toISOString().slice(0, 10);
    const fm = `---\ntitle: ${args.title}\ntype: ${type}\nupdated: ${today}\n---\n\n`;
    fs.writeFileSync(file, fm + args.content + '\n');
    return `Note enregistrée : ${path.relative(cwd, file)}`;
  }
  throw new Error(`Outil inconnu: ${name}`);
}

// --- JSON-RPC ---
function send(msg) { process.stdout.write(JSON.stringify(msg) + '\n'); }
function ok(id, result) { send({ jsonrpc: '2.0', id, result }); }
function err(id, code, message) { send({ jsonrpc: '2.0', id, error: { code, message } }); }

async function handle(msg) {
  const { id, method, params } = msg;
  if (method === 'initialize') {
    return ok(id, {
      protocolVersion: (params && params.protocolVersion) || '2025-06-18',
      capabilities: { tools: {} },
      serverInfo: SERVER,
    });
  }
  if (method === 'notifications/initialized' || method === 'initialized') return; // notif
  if (method === 'ping') return ok(id, {});
  if (method === 'tools/list') return ok(id, { tools: TOOLS });
  if (method === 'tools/call') {
    try {
      const text = await callTool(params.name, params.arguments || {});
      return ok(id, { content: [{ type: 'text', text }] });
    } catch (e) {
      return ok(id, { content: [{ type: 'text', text: `Erreur: ${e.message}` }], isError: true });
    }
  }
  if (id !== undefined) err(id, -32601, `Méthode non supportée: ${method}`);
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    Promise.resolve(handle(msg)).catch((e) => { if (msg && msg.id !== undefined) err(msg.id, -32603, String(e)); });
  }
});
process.stdin.on('end', () => process.exit(0));
