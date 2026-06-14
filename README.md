# 🧠 Engram — la mémoire qui n'oublie jamais, pour Claude Code

![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Node](https://img.shields.io/badge/Node-%E2%89%A518-blue.svg)
![Tests](https://img.shields.io/badge/tests-65%20passing-brightgreen.svg)
![deps](https://img.shields.io/badge/dependencies-0-success.svg)
![local](https://img.shields.io/badge/100%25-local-blueviolet.svg)

> Un *engram* est la trace physique d'un souvenir dans le cerveau.

Engram donne à Claude Code une **mémoire persistante** : il **capture sans perte** le contexte d'un
projet (code + déroulé des sessions + erreurs résolues), **retrouve par pertinence** le bon souvenir
au bon moment, sait **toujours où tu t'es arrêté** (même après 3 mois), et **n'oublie plus ses
erreurs** (il les réapplique pour se gérer seul). 100% local, zéro dépendance.

La fenêtre de contexte étant finie, on ne « garde pas tout en tête » : on garantit **capture sans
perte + rappel par pertinence + état de reprise + apprentissage des erreurs**.

**Installation en une ligne** (dans une session Claude Code) :

```
/plugin marketplace add JLmehdi92/engram
/plugin install engram@engram
```

---

## Ce que ça fait

| Capacité | Comment |
|---|---|
| **Capture sans perte** | `/engram-save` + hooks (PreCompact, fin de session, **seuil de contexte ~70%**) |
| **Rappel par pertinence** | hybride **BM25 + graphe `[[wikilinks]]` + embeddings** (Ollama, optionnel), scoré récence×importance×pertinence |
| **Mémoire interrogeable en plein travail** | serveur **MCP** : `engram_recall`, `engram_lessons`, `engram_save_note` |
| **Reprise immédiate** | `STATE.md` (« où on en est ») chargé en premier à chaque session |
| **Apprentissage des erreurs** | `lessons.md` v2 (`[L-xxx]` : trigger/symptom/root_cause/fix/rule), dédup, compteurs helpful/harmful, bi-temporel |
| **Anti-oubli structurel** | consolidation périodique (fusion, archivage non destructif) |

---

## Architecture — mémoire à 2 étages

Inspirée de l'état de l'art (Letta/MemGPT, Mem0, Zep/Graphiti, A-MEM, Reflexion, Voyager, Generative
Agents, ACE — voir `docs/superpowers/specs/`).

- **Étage 1 — état actif (toujours chargé, court)** : `STATE.md` + `MEMORY.md` + leçons prioritaires.
- **Étage 2 — archive cherchable (à la demande)** : toutes les notes/leçons/sessions, indexées et
  récupérées par **rappel scoré borné** (top-k, budget de tokens) — c'est ce qui évite le « context rot ».

Le **rappel** fusionne (RRF) trois signaux : mots-clés (BM25), graphe des `[[wikilinks]]`, et
sémantique (embeddings Ollama si présents). Score final =
`α·récence(0.995^Δj) + β·importance + γ·pertinence`, filtré par fenêtre de validité (bi-temporel).

---

## Commandes

| Commande | Quand | Effet |
|---|---|---|
| `/engram-save` | fin de session / avant compaction | scan exhaustif + capture session + MAJ notes, `STATE.md`, leçons v2, index. `--precompact`, `--full` |
| `/engram-load [sujet]` | reprise / après compaction | recharge STATE + MEMORY + leçons + sessions, rappel ciblé optionnel, résume « où on en est » |
| `/engram-consolidate` | périodiquement (gros projet) | fusionne doublons, archive le périmé, rafraîchit STATE, reconstruit l'index. `--apply` |

Tu n'as **rien à lancer au début** : le rechargement est automatique (hook SessionStart).

## Outils MCP (Claude les appelle en plein travail)

- `engram_recall(query)` — retrouve notes/leçons/sessions pertinentes.
- `engram_lessons(situation)` — leçons pour un bug/erreur courant (**à consulter avant de débugger**).
- `engram_save_note(title, content)` — ajoute une note durable.

## Hooks automatiques

- **SessionStart** — réinjecte STATE + MEMORY + leçons prioritaires + dernières sessions (budget de
  tokens, dégradation propre). Inclut la reprise **après compaction**.
- **Stop** — avertit dès que le contexte approche la saturation (~70%) → propose `/engram-save`.
- **PreCompact** — bloque une fois la compaction et avertit (défensif).
- **SessionEnd** — rappelle de sauvegarder si rien n'a été sauvé.

---

## Structure de `.engram/`

```
.engram/
├── STATE.md            # reprise (chargé en 1er)
├── MEMORY.md           # index court
├── 00-overview · architecture · module-* · data-and-apis · decisions · glossary · conventions · file-map
├── lessons.md          # erreurs résolues [L-xxx] (durable, scoré)
├── sessions/           # INDEX.md + AAAA-MM-JJ-*.md (non versionnés par défaut)
├── archive/            # retirés (jamais supprimés)
├── .index/             # bm25/graphe/embeddings (reconstructible, gitignoré)
└── .state.json · config.json · .gitignore (gérés)
```

Frontmatter YAML + `[[wikilinks]]` → ouvrable comme **vault Obsidian**.

---

## Rappel sémantique (optionnel, 100% local)

Sans rien installer, le rappel marche en **BM25 + graphe**. Si **[Ollama](https://ollama.com)** est
présent (`ollama serve` + `ollama pull nomic-embed-text`), Engram **active automatiquement** la
recherche sémantique (embeddings locaux) en plus — détecté tout seul, jamais requis, aucune donnée
ne sort de la machine.

---

## Garanties de qualité

- **Aucune perte** : capture aux moments clés + index reconstructible + archivage non destructif.
- **Aucune troncature** des notes (découpe si trop gros) ; **budget de tokens** à l'injection.
- **Couverture vérifiable** (`file-map.md`, manquants signalés).
- **Écriture par delta** des leçons (jamais de réécriture globale → pas de « context collapse »).
- **Bi-temporel** : un fait contredit n'est pas supprimé (`superseded_by`/`valid_to`).
- **Secrets masqués** dans la capture de session.
- **65 tests** (`npm test`), **zéro dépendance** npm.

---

## Configuration — `.engram/config.json` (facultatif)

```json
{
  "outputDir": ".engram",
  "precompactMode": "block-once",
  "autoLoad": true,
  "maxSessionsOnLoad": 3,
  "sessionStartTokenBudget": 12000,
  "gitignoreSessions": true,
  "redactSecrets": true,
  "recall": { "topK": 5, "minScore": 0, "budgetTokens": 4000, "maxLessonsOnStart": 8,
              "weights": { "recency": 1, "importance": 1, "relevance": 3 } },
  "embeddings": { "enabled": "auto", "host": "http://127.0.0.1:11434", "model": "nomic-embed-text" },
  "capture": { "autoWarn": true, "contextWindow": 200000, "contextThresholdPct": 70 }
}
```
Tous les champs ont des défauts ; le fichier est facultatif.

---

## Tests

```
npm test          # ou : node --test
```
65 tests, zéro dépendance (runner intégré de Node) : tokenizer/BM25, graphe, scoring/RRF, recall,
embeddings (mock), leçons (parse + delta), protocole MCP, consolidation, hook seuil, redaction,
budget mémoire, etc.

---

## Pré-requis & install locale

Pré-requis : **Node.js** dans le PATH (Claude Code tourne déjà sur Node). Embeddings : **Ollama**
optionnel.

Dev / install locale (dépôt cloné = marketplace locale) :
```
git clone https://github.com/JLmehdi92/engram
/plugin marketplace add ./engram
/plugin install engram@engram
# ou, sans installer : claude --plugin-dir ./engram
```

## Désinstaller
`/plugin uninstall engram@engram`. Pour couper le sémantique : `embeddings.enabled: false`. Pour
couper l'auto-load : `autoLoad: false`.

## Architecture interne
L'**intelligence** (résumés, structuration, extraction de leçons, scan) est faite par **Claude** via
les slash-commands (sous-agents parallèles). Les **scripts Node** ne font que du déterministe
(énumération, git, transcript, **index/rappel BM25+graphe**, embeddings, hooks, serveur MCP). Détails :
`docs/superpowers/specs/2026-06-14-engram-v2-design.md`.
