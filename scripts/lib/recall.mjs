// recall.mjs — moteur de rappel : fusionne mots-clés (BM25) + graphe (wikilinks)
// + scoring (récence/importance/pertinence). Le rappel sémantique (embeddings) est
// injecté en option via opts.semantic (Phase 2) sans changer cette logique.
import { buildBM25, searchBM25 } from './textsearch.mjs';
import { buildGraph, expand } from './graph.mjs';
import { recencyScore, normalize, rrf, combine } from './scoring.mjs';
import { estimateTokens } from './tokens.mjs';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// items : sortie de loadItems. opts : { topK, minScore, budgetTokens, weights,
//   nowMs, type, includeExpired, semantic: [{id,score}], graphHops, seedCount }
export function recall(items, query, opts = {}) {
  const {
    topK = 5, minScore = 0.0, budgetTokens = 4000,
    // La pertinence DOIT dominer : un item juste récent/utile mais hors-sujet ne
    // doit pas coiffer une vraie correspondance. récence/importance = tiebreakers.
    weights = { recency: 1, importance: 1, relevance: 3 },
    nowMs = 0, type = null, includeExpired = false,
    semantic = null, graphHops = 2, seedCount = 8,
  } = opts;

  const byId = new Map(items.map((it) => [it.id, it]));

  // 1) mots-clés (BM25)
  const kw = searchBM25(buildBM25(items.map((it) => ({ id: it.id, text: it.text }))), query);
  const kwIds = kw.map((r) => r.id);

  // 2) sémantique (optionnel, Phase 2)
  const semIds = (semantic || []).map((r) => r.id);

  // 3) expansion graphe depuis les meilleurs hits
  const adj = buildGraph(items);
  const seeds = [...new Set([...kwIds.slice(0, seedCount), ...semIds.slice(0, seedCount)])];
  const expanded = expand(adj, seeds, graphHops);                 // Map(id -> distance)
  const graphIds = [...expanded.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);

  // ensemble de candidats
  const candidates = [...new Set([...kwIds, ...semIds, ...graphIds])].filter((id) => byId.has(id));
  if (!candidates.length) return [];

  // 4) pertinence = RRF des trois classements, puis normalisation
  const rankLists = [kwIds, semIds, graphIds].filter((l) => l.length);
  const relevanceRaw = rrf(rankLists);
  const relevance = normalize(Object.fromEntries(candidates.map((id) => [id, relevanceRaw[id] || 0])));

  // 5) importance & récence normalisées sur les candidats
  const importance = normalize(Object.fromEntries(candidates.map((id) => [id, byId.get(id).importance || 0])));
  const recency = normalize(Object.fromEntries(candidates.map((id) => {
    const it = byId.get(id);
    return [id, recencyScore(it.last_used || it.updated, nowMs)];
  })));

  // ajustement leçons via compteurs helpful/harmful
  // Ajustement leçons : léger tiebreaker borné (ne doit pas écraser la pertinence).
  const lessonAdjust = (id) => {
    const it = byId.get(id);
    if (it.type !== 'lesson') return 1;
    return clamp((1 + (it.helpful || 0)) / (1 + (it.harmful || 0)), 0.5, 1.5);
  };

  const scored = combine(candidates, { relevance, importance, recency }, weights, lessonAdjust);

  // 6) filtres + tri + budget
  const now = nowMs || Date.now?.() || 0;
  let ranked = candidates
    .map((id) => ({ item: byId.get(id), score: scored[id] }))
    .filter(({ item, score }) => {
      if (score < minScore) return false;
      if (type && item.type !== type) return false;
      if (item.status === 'superseded') return false;
      if (!includeExpired && item.valid_to) {
        const t = new Date(item.valid_to).getTime();
        if (!Number.isNaN(t) && now && t <= now) return false;
      }
      return true;
    })
    .sort((a, b) => b.score - a.score);

  const out = [];
  let used = 0;
  for (const { item, score } of ranked) {
    const cost = estimateTokens(item.snippet || item.text || '');
    if (out.length >= topK) break;
    if (out.length && used + cost > budgetTokens) continue;
    used += cost;
    out.push({
      id: item.id, type: item.type, title: item.title, path: item.path,
      score: Number(score.toFixed(4)), snippet: item.snippet,
      importance: item.importance, helpful: item.helpful, harmful: item.harmful,
    });
  }
  return out;
}
