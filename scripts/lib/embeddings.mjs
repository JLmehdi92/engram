// embeddings.mjs — rappel sémantique optionnel via Ollama (Phase 2).
// Phase 1 : stub neutre. Si Ollama n'est pas dispo ou désactivé, renvoie null
// et le rappel fonctionne en BM25 + graphe seul.

// Retourne soit null (pas de sémantique), soit [{id, score}] classé par cosine.
export async function maybeSemanticRanks(/* cfg, dir, items, query */) {
  return null;
}
