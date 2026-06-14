// tokens.mjs — estimation grossière du nombre de tokens.
// Heuristique simple et portable : ~4 caractères par token.
export function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(String(text).length / 4);
}
