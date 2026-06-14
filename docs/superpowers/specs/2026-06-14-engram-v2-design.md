# Engram v2 — Design Spec « la mémoire qui n'oublie jamais »

- **Date** : 2026-06-14
- **Statut** : Approuvé (design validé)
- **Base** : étend Engram v1 (capture, markdown+wikilinks, hooks PreCompact/SessionStart/SessionEnd, lessons.md)

## 1. Objectif

Faire qu'un projet Claude Code ne perde **jamais** ni mémoire ni contexte : rien n'est perdu, le
bon souvenir revient au bon moment, Claude sait toujours où on s'est arrêté (même après 3 mois), et
il **n'oublie plus ses erreurs** (il les réapplique pour se gérer seul).

La fenêtre de contexte étant finie, on ne « garde pas tout en tête » : on garantit **capture sans
perte + rappel par pertinence + état de reprise + apprentissage des erreurs**.

## 2. Décisions (validées par l'utilisateur)

- **Rappel hybride auto** : BM25 (mots-clés) + graphe `[[wikilinks]]` + scoring, **embeddings en
  bonus si Ollama détecté** (sinon on s'en passe). Marche sans rien installer.
- **Capture auto aux moments clés** : PreCompact + SessionEnd + seuil de contexte ~70%.
- **100% local, jamais de cloud** : fichiers markdown + index local + Ollama local optionnel.
- **Tout construit, niveau « masterclass », avec tests.**

## 3. Principes volés à l'état de l'art (sources dans les notes de session)

- **Mémoire 2 étages** (Letta, Cline Memory Bank) : état actif court toujours chargé + archive
  cherchable à la demande.
- **Rappel borné & scoré** (Generative Agents, Mem0, Voyager) :
  `score = α·récence(0.995^Δj) + β·importance + γ·pertinence`, top-k, seuil, budget tokens.
- **Écriture ADD/UPDATE/DELETE/NOOP** (Mem0) + **bi-temporel non destructif** (Zep : `valid_to`,
  `superseded_by`).
- **Apprentissage des erreurs** (Reflexion, Voyager, ACE) : leçon enregistrée **après vérification**
  du fix ; on stocke la **règle généralisable + cause racine** ; compteurs **helpful/harmful** ;
  récupération en matchant le **déclencheur** à la situation courante.
- **Consolidation « sleep-time »** (Letta, A-MEM) : fusion/dédup/archivage périodiques.
- **Delta updates, jamais réécriture totale** (ACE « context collapse ») ; **vérifier l'écriture**
  (bug Cline) ; fichiers auto-chargés courts (< ~200 lignes) (anti-bloat CLAUDE.md).
- **Auto-liage des notes** (A-MEM) : embeddings filtrent les candidats, le LLM décide les `[[liens]]`.

## 4. Architecture — mémoire à 2 étages

**Étage 1 — État actif (toujours chargé, court)**
- `STATE.md` : reprise (focus, prochaines étapes, décisions actives, bugs connus). Chargé en 1er.
- `MEMORY.md` (index) + **top 3-5 leçons pertinentes** (pas toutes).

**Étage 2 — Archive cherchable (à la demande, rappel scoré)**
- Toutes les notes + leçons + sessions, indexées.

## 5. Composants

### 5.1 Moteur d'index + rappel
- `scripts/lib/notes.mjs` — énumère les **memory items** (note entière, bloc de leçon, session) avec
  `{id, type, path, title, text, tags, keywords, importance, created, updated, last_used, helpful,
  harmful, valid_to, links}`.
- `scripts/lib/textsearch.mjs` — tokenizer + **BM25** (k1=1.5, b=0.75) sur les items.
- `scripts/lib/graph.mjs` — parse `[[wikilinks]]` → adjacence ; traversée 1-2 sauts.
- `scripts/lib/scoring.mjs` — récence (`0.995^Δj`), importance (norm), pertinence ; **RRF** (fusion
  des classements keyword/sémantique/graphe) ; ajustement helpful/harmful pour les leçons ;
  normalisation min-max.
- `scripts/engram-index.mjs` — construit l'index dans `.engram/.index/` (`bm25.json`, `graph.json`,
  `items.json`, `embeddings.json`), reconstructible, gitignoré.
- `scripts/engram-recall.mjs` — `recall(query, {topK, budget, type})` → items classés + extraits.
  Filtre `valid_to` (bi-temporel « now »), seuil, top-k, budget tokens.

### 5.2 Embeddings optionnels (Ollama) — RETIRÉ en v0.3
> ⚠️ Cette section reflète le design initial. Les embeddings/Ollama ont été **retirés en v0.3** :
> le rappel reste BM25 + graphe (100% local, zéro dépendance). Conservé ici pour l'historique.

- `scripts/lib/embeddings.mjs` — détecte Ollama (`OLLAMA_HOST` ou `http://127.0.0.1:11434`),
  modèle par défaut `nomic-embed-text`. Embedde le « matching text » des items, cache dans
  `.index/embeddings.json` (clé = hash du texte → ne ré-embedde que ce qui change). Cosine.
  Fallback total si Ollama absent (le rappel marche en BM25+graphe seul).

### 5.3 Serveur MCP (zéro dépendance)
- `scripts/mcp-server.mjs` — JSON-RPC 2.0 sur stdio : `initialize`, `tools/list`, `tools/call`.
  Outils : `engram_recall(query, topK?)`, `engram_lessons(situation)`, `engram_save_note(title,
  content, type?)`. Permet à Claude d'interroger la mémoire **en plein travail**.
- `.mcp.json` (racine plugin) : `{ "mcpServers": { "engram": { "command": "node", "args":
  ["${CLAUDE_PLUGIN_ROOT}/scripts/mcp-server.mjs"] } } }`.

### 5.4 Leçons v2 — apprentissage des erreurs
- `scripts/lib/lessons.mjs` — parse/écrit `lessons.md` en **blocs structurés** :
  ```markdown
  ### [L-001] Titre court
  - trigger: quand … (clé de récupération)
  - symptom: message/erreur observé
  - root_cause: le pourquoi réel
  - fix: le correctif exact (code/commande)
  - rule: la règle généralisable
  - meta: importance=8 · helpful=0 · harmful=0 · status=active · created=2026-06-14 · last_used= · refs=[…]
  ```
- **Écriture par delta** (append/merge d'un bloc, jamais réécriture du fichier).
- **Dédup ADD/UPDATE/DELETE/NOOP** : nouvelle leçon comparée aux plus proches (recall) ; le LLM (via
  `/engram-save`) décide ; doublon → enrichit ; contredit → `status=superseded` + `superseded_by`.
- **Vérification** : une leçon n'est enregistrée que si le fix a réellement résolu (échec→résolution
  dans le transcript / test repassé vert).
- **Compteurs** : `helpful++` quand une leçon est rappelée et utile ; `harmful++` sinon → archivage
  si `harmful` domine.

### 5.5 État actif & SessionStart
- `STATE.md` régénéré à chaque save. `hook-sessionstart` charge : `STATE.md` + `MEMORY.md` +
  **top-k leçons pertinentes** (via recall sur le contexte) + résumé, sous budget tokens (fallback
  dégressif v1 conservé).

### 5.6 Capture auto & consolidation
- `scripts/hook-stop.mjs` (hook `Stop`) : lit `estimatedContextTokens` du transcript ; si ≥ seuil
  (défaut 70% d'une fenêtre estimée) et pas de save récent → `systemMessage` « lance /engram-save ».
  (Un hook ne peut pas lancer Claude ; il déclenche.)
- `commands/engram-consolidate.md` (`/engram-consolidate`) + `scripts/engram-consolidate.mjs` :
  reconstruit l'index ; repère doublons/leçons périmées (`valid_to` passé, `harmful>helpful`,
  récence faible) → propose archivage vers `archive/` (jamais delete) ; clusters de wikilinks →
  notes-index (MOC) ; rafraîchit `STATE.md`. Delta-only, git pour rollback.

## 6. Arborescence v2

```
.engram/
  STATE.md                 # reprise (chargé en 1er)
  MEMORY.md
  00-overview.md … file-map.md
  lessons.md               # leçons structurées [L-xxx]
  sessions/INDEX.md + AAAA-MM-JJ-*.md
  archive/                 # retirés, jamais supprimés
  .index/                  # bm25.json, graph.json, items.json, embeddings.json (gitignoré)
  .state.json, config.json, .gitignore
```

## 7. Config v2 (ajouts)

```json
{
  "recall": { "topK": 5, "minScore": 0.05, "budgetTokens": 4000,
              "weights": { "recency": 1, "importance": 1, "relevance": 1 } },
  "embeddings": { "enabled": "auto", "provider": "ollama",
                  "host": "http://127.0.0.1:11434", "model": "nomic-embed-text" },
  "capture": { "contextThresholdPct": 70, "autoWarn": true },
  "lessons": { "archiveWhenHarmfulExceedsHelpful": true }
}
```
Tous avec défauts intégrés ; rétrocompatible avec la config v1.

## 8. Qualité / tests

- Tests `node:test` zéro dépendance pour : BM25, graphe/traversée, scoring/RRF, parsing leçons,
  dédup ADD/UPDATE/DELETE, recall bout-en-bout (fixtures temp), protocole MCP (JSON-RPC),
  embeddings (mock du client Ollama).
- Idempotence, delta-only, vérif d'écriture, aucune troncature, redaction conservée.

## 9. Plan de construction (7 phases, chacune testée + commit/push)

1. Socle rappel (notes/textsearch/graph/scoring/index/recall).
2. Embeddings Ollama optionnels + RRF.
3. Serveur MCP + `.mcp.json`.
4. Leçons v2 (format/delta/dédup/vérif/compteurs).
5. `STATE.md` + intégration SessionStart.
6. Capture auto (seuil) + consolidation.
7. Intégration `/engram-save` & `/engram-load`, README/spec, démo, push.

## 10. Compatibilité

v2 lit la mémoire v1 (mêmes fichiers). `engram-index` traite l'existant. Aucune migration
destructive. Les nouveaux fichiers (`STATE.md`, `.index/`, `archive/`) sont créés à la demande.
