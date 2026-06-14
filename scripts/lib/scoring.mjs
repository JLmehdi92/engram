// scoring.mjs — récence / importance / pertinence + fusion RRF + normalisation.

// Récence : décroissance exponentielle (facteur ~0.995/jour, façon Generative Agents).
export function recencyScore(dateISO, nowMs, factor = 0.995) {
  if (!dateISO) return 0;
  const t = new Date(dateISO).getTime();
  if (Number.isNaN(t)) return 0;
  const days = Math.max(0, (nowMs - t) / 86400000);
  return Math.pow(factor, days);
}

// Normalisation min-max d'un objet {id: valeur} vers [0,1].
export function normalize(map) {
  const vals = Object.values(map);
  if (!vals.length) return {};
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min;
  const out = {};
  for (const [id, v] of Object.entries(map)) out[id] = span ? (v - min) / span : (max ? 1 : 0);
  return out;
}

// Reciprocal Rank Fusion : rankLists = [[id,…ordonnés], …]. Retourne {id: scoreRRF}.
export function rrf(rankLists, k = 60) {
  const out = {};
  for (const list of rankLists) {
    for (let rank = 0; rank < list.length; rank++) {
      const id = list[rank];
      out[id] = (out[id] || 0) + 1 / (k + rank + 1);
    }
  }
  return out;
}

// Combine les trois composantes (déjà normalisées [0,1]) avec des poids.
// lessonAdjust(id) optionnel : facteur multiplicatif (compteurs helpful/harmful).
export function combine(ids, { relevance = {}, importance = {}, recency = {} },
  weights = { recency: 1, importance: 1, relevance: 1 }, lessonAdjust = null) {
  const out = {};
  for (const id of ids) {
    let s = weights.relevance * (relevance[id] || 0)
      + weights.importance * (importance[id] || 0)
      + weights.recency * (recency[id] || 0);
    if (lessonAdjust) s *= lessonAdjust(id);
    out[id] = s;
  }
  return out;
}
