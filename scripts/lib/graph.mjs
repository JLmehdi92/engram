// graph.mjs — graphe des [[wikilinks]] entre memory items + traversée.

// Extrait les cibles de [[lien]] / [[lien|alias]] / [[dossier/lien]] d'un texte.
export function parseWikilinks(text) {
  if (!text) return [];
  const out = [];
  const re = /\[\[([^\]]+?)\]\]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    let target = m[1].split('|')[0].trim();        // retire l'alias
    target = target.split('#')[0].trim();           // retire l'ancre
    if (target) out.push(normalizeLinkKey(target));
  }
  return out;
}

// Clé de lien normalisée : basename sans extension, en minuscules.
export function normalizeLinkKey(name) {
  let s = String(name).trim();
  s = s.replace(/\\/g, '/');
  const base = s.includes('/') ? s.slice(s.lastIndexOf('/') + 1) : s;
  return base.replace(/\.md$/i, '').toLowerCase();
}

// items : [{ id, title, links: [normalizedKeys], path }]
// Construit l'adjacence id -> Set(idVoisins) en résolvant les clés vers des items.
export function buildGraph(items) {
  const keyToId = new Map();
  for (const it of items) {
    if (it.title) keyToId.set(normalizeLinkKey(it.title), it.id);
    if (it.path) keyToId.set(normalizeLinkKey(it.path), it.id);
    // les leçons sont liables par leur id [L-001]
    keyToId.set(normalizeLinkKey(it.id.replace(/^.*?:/, '')), it.id);
  }
  const adj = new Map();
  for (const it of items) adj.set(it.id, new Set());
  for (const it of items) {
    for (const key of it.links || []) {
      const target = keyToId.get(key);
      if (target && target !== it.id) {
        adj.get(it.id).add(target);
        adj.get(target).add(it.id);   // graphe non orienté pour la traversée de rappel
      }
    }
  }
  return adj;
}

// BFS depuis des seeds, jusqu'à `hops` sauts. Retourne Map(id -> distance>=1).
export function expand(adj, seedIds, hops = 2) {
  const dist = new Map();
  let frontier = new Set(seedIds);
  for (let d = 1; d <= hops; d++) {
    const next = new Set();
    for (const id of frontier) {
      for (const nb of adj.get(id) || []) {
        if (!dist.has(nb) && !seedIds.includes(nb)) {
          dist.set(nb, d);
          next.add(nb);
        }
      }
    }
    frontier = next;
    if (!frontier.size) break;
  }
  return dist;
}
