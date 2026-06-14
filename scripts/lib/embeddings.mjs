// embeddings.mjs — rappel sémantique optionnel via Ollama (100% local).
// Si Ollama est absent / désactivé, tout renvoie null et le rappel marche en BM25+graphe.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

function hostOf(cfg) {
  const e = cfg.embeddings || {};
  return process.env.OLLAMA_HOST || e.host || 'http://127.0.0.1:11434';
}
function modelOf(cfg) {
  return (cfg.embeddings || {}).model || 'nomic-embed-text';
}
function enabled(cfg) {
  const v = (cfg.embeddings || {}).enabled;
  return v === undefined ? 'auto' : v;
}

async function withTimeout(promiseFn, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await promiseFn(ctrl.signal); }
  finally { clearTimeout(t); }
}

export async function detectOllama(cfg, ms = 800) {
  try {
    const res = await withTimeout((signal) => fetch(hostOf(cfg) + '/api/tags', { signal }), ms);
    return res.ok;
  } catch { return false; }
}

// Embedde un texte via Ollama. Retourne un vecteur (number[]) ou null.
export async function embedOne(cfg, text, ms = 15000) {
  try {
    const res = await withTimeout((signal) => fetch(hostOf(cfg) + '/api/embeddings', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelOf(cfg), prompt: String(text).slice(0, 4000) }),
    }), ms);
    if (!res.ok) return null;
    const json = await res.json();
    return Array.isArray(json.embedding) ? json.embedding : null;
  } catch { return null; }
}

export function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return (na && nb) ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

function hashText(text) {
  return crypto.createHash('sha1').update(String(text).slice(0, 4000)).digest('hex').slice(0, 16);
}

function embPath(dir) { return path.join(dir, '.index', 'embeddings.json'); }

export function loadEmbeddings(dir) {
  try { return JSON.parse(fs.readFileSync(embPath(dir), 'utf8')); } catch { return null; }
}

// Construit/actualise le cache d'embeddings pour les items (réutilise par hash).
// embed: fonction async (text)->vec (injectable pour les tests). Retourne le cache, ou null.
export async function buildEmbeddings(cfg, dir, items, embed = null) {
  if (enabled(cfg) === false) return null;
  const fn = embed || ((t) => embedOne(cfg, t));
  if (!embed) {
    const ok = await detectOllama(cfg);
    if (!ok) return null;
  }
  const prev = loadEmbeddings(dir);
  const model = modelOf(cfg);
  const prevById = (prev && prev.model === model) ? prev.items || {} : {};
  const out = {};
  for (const it of items) {
    const h = hashText(it.text);
    if (prevById[it.id] && prevById[it.id].hash === h) { out[it.id] = prevById[it.id]; continue; }
    const vec = await fn(it.text);
    if (vec) out[it.id] = { hash: h, vec };
  }
  const cache = { model, generatedAt: new Date().toISOString(), count: Object.keys(out).length, items: out };
  try {
    fs.mkdirSync(path.join(dir, '.index'), { recursive: true });
    fs.writeFileSync(embPath(dir), JSON.stringify(cache));
  } catch { /* cache best-effort */ }
  return cache;
}

// Rangs sémantiques pour une requête : [{id,score}] décroissant, ou null si indispo.
// opts.embed : fonction async (text)->vec, injectable pour les tests.
export async function maybeSemanticRanks(cfg, dir, items, query, opts = {}) {
  if (enabled(cfg) === false) return null;
  const cache = opts.cache || loadEmbeddings(dir);
  if (!cache || !cache.items || !Object.keys(cache.items).length) return null;

  let qvec;
  if (opts.embed) qvec = await opts.embed(query);
  else {
    if (!(await detectOllama(cfg))) return null;
    qvec = await embedOne(cfg, query);
  }
  if (!qvec) return null;

  const ranks = [];
  for (const it of items) {
    const entry = cache.items[it.id];
    if (!entry || !entry.vec) continue;
    ranks.push({ id: it.id, score: cosine(qvec, entry.vec) });
  }
  ranks.sort((a, b) => b.score - a.score);
  return ranks;
}
