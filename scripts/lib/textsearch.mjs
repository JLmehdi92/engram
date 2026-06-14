// textsearch.mjs — tokenizer + index BM25 (Okapi). Pur, sans dépendance, testable.

// Stopwords minimaux FR + EN (on reste léger pour ne pas écraser de vrais termes).
const STOP = new Set([
  // FR
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'ou', 'à', 'au', 'aux', 'en', 'dans',
  'sur', 'sous', 'pour', 'par', 'avec', 'sans', 'que', 'qui', 'quoi', 'dont', 'où', 'ce', 'ces',
  'cet', 'cette', 'se', 'sa', 'son', 'ses', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'leur', 'leurs',
  'notre', 'nos', 'votre', 'vos', 'est', 'sont', 'être', 'été', 'fait', 'faire', 'pas', 'ne', 'ni',
  'on', 'il', 'elle', 'ils', 'elles', 'je', 'tu', 'nous', 'vous', 'me', 'te', 'lui', 'leur',
  'comme', 'mais', 'donc', 'car', 'or', 'si', 'plus', 'moins', 'très', 'tout', 'tous', 'toute',
  'toutes', 'cela', 'ça', 'y', 'aussi', 'alors', 'quand', 'déjà', 'entre', 'vers', 'chez',
  // EN
  'the', 'a', 'an', 'of', 'to', 'in', 'on', 'for', 'and', 'or', 'is', 'are', 'be', 'it', 'this',
  'that', 'with', 'as', 'at', 'by', 'from', 'we', 'you', 'i', 'he', 'she', 'they', 'was', 'were',
  'but', 'not', 'no', 'so', 'if', 'then', 'than', 'when', 'where', 'which', 'into', 'out', 'up',
]);

export function tokenize(text) {
  if (!text) return [];
  const raw = String(text).toLowerCase().match(/[\p{L}\p{N}_]+/gu) || [];
  return raw.filter((t) => t.length >= 2 && !STOP.has(t));
}

// docs : [{ id, text }]. Retourne un index sérialisable.
export function buildBM25(docs) {
  const postings = {};        // term -> { docId: tf }
  const df = {};              // term -> nb de docs
  const docLen = {};          // docId -> longueur
  let totalLen = 0;
  const N = docs.length;

  for (const { id, text } of docs) {
    const toks = tokenize(text);
    docLen[id] = toks.length;
    totalLen += toks.length;
    const tf = {};
    for (const t of toks) tf[t] = (tf[t] || 0) + 1;
    for (const [t, c] of Object.entries(tf)) {
      (postings[t] ||= {})[id] = c;
      df[t] = (df[t] || 0) + 1;
    }
  }
  return { postings, df, docLen, avgdl: N ? totalLen / N : 0, N };
}

// Renvoie [{ id, score }] trié décroissant. k1/b paramètres BM25 standard.
export function searchBM25(index, query, { k1 = 1.5, b = 0.75 } = {}) {
  const { postings, df, docLen, avgdl, N } = index;
  const qToks = Array.isArray(query) ? query : tokenize(query);
  const scores = {};
  for (const t of new Set(qToks)) {
    const post = postings[t];
    if (!post) continue;
    const n = df[t] || 0;
    const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
    for (const [id, tf] of Object.entries(post)) {
      const dl = docLen[id] || 0;
      const denom = tf + k1 * (1 - b + (avgdl ? b * dl / avgdl : 0));
      scores[id] = (scores[id] || 0) + idf * (tf * (k1 + 1)) / (denom || 1);
    }
  }
  return Object.entries(scores)
    .map(([id, score]) => ({ id, score }))
    .sort((a, b2) => b2.score - a.score);
}
