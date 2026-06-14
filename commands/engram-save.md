---
description: Sauvegarde TOUT le contexte de la session (scan exhaustif du projet + capture de la session + problèmes/solutions) dans .engram/ (Markdown Obsidian), met à jour STATE.md, les leçons et l'index de rappel. À lancer en fin de session ou avant une compaction.
argument-hint: "[--precompact] [--full]"
---

# /engram-save — Mémoriser toute la session

Tu es l'orchestrateur d'Engram. Objectif : **ne jamais rien perdre**. Tu produis/mets à jour une
mémoire Markdown durable dans `.engram/`. **Aucune troncature** : un fichier trop gros se découpe,
jamais de `// reste identique` ni de liste coupée. Détail maximal : c'est pour Claude.

Arguments : `$ARGUMENTS`
- `--precompact` → **mode urgence** (compaction imminente) : priorise **STATE → session (B) →
  leçons (D) → INDEX → MEMORY**, PUIS le scan (A) si le temps le permet.
- `--full` → ignore l'incrémental, régénère toutes les notes.

## Étape 0 — Collecte déterministe (une commande)

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/collect.mjs"
```
Parse le JSON : `config`, `git` (head/branch/lastSaveCommit/diff incl. **deleted**/renamed),
`files` (liste exhaustive + binaires), `transcript.digest` (userPrompts, toolCalls, commands,
filesTouched, **errors**, estimatedContextTokens), `engramExists`, `incremental`.
`OUT` = `config.outputDir` (défaut `.engram`). Crée `OUT/` si absent. En incrémental, ne régénère
que ce qui a changé d'après `git.diff` (sauf `--full`).

## Étape A — Scan exhaustif (AUCUN fichier oublié)

1. Référence = `files.files[]` (déjà .gitignore-aware, binaires exclus).
2. Découpe par zones ; pour un gros codebase, **dispatche des sous-agents EN PARALLÈLE** (1 par
   zone) qui renvoient **1 ligne descriptive par fichier**. Petit repo (≤ ~30) : lis toi-même.
3. Écris `OUT/file-map.md` (frontmatter `type: reference`) : 1 ligne par fichier = **preuve de
   couverture**. Section `## ⚠️ Fichiers non couverts` (idéalement vide).
4. **Supprimés** (`git.diff.deleted`/`renamed`) : retire/àjour leurs lignes ; marque `stale: true`
   les notes de module disparu (ne les supprime pas).

## Étape B — Capture de la session

`OUT/sessions/AAAA-MM-JJ-<slug>.md` (frontmatter `type: session`, `updated`, `source_commit`) :
résumé exécutif, décisions+pourquoi, problèmes+solutions, fichiers créés/modifiés/supprimés,
commandes+résultats, extraits clés du dialogue (contexte durable, pas le verbatim), section
**Reprise**. MAJ `OUT/sessions/INDEX.md` (plus récent en haut). Secrets déjà masqués par le
collecteur ; reste vigilant.

## Étape C — Mémoire durable (notes .md Obsidian)

Crée/MAJ avec frontmatter (`title`, `type`, `updated`, `source_commit`) + `[[wikilinks]]` :
`MEMORY.md` (index court, < ~1500 tokens, référence **toujours** `[[lessons]]` et `[[STATE]]`),
`00-overview.md`, `architecture.md`, `module-<nom>.md`, `data-and-apis.md`, `decisions.md`,
`glossary.md`, `conventions.md`, `file-map.md`. **Incrémental** (ne réécris que les zones changées),
**idempotent**, **aucune troncature**.

## Étape C-bis — `STATE.md` (où on en est) — TOUJOURS

Régénère `OUT/STATE.md` (frontmatter `type: state`) — c'est le fichier chargé EN PREMIER à la
reprise. Contenu court et à jour : **En cours**, **Avancement**, **Prochaine étape**, **Décisions
actives**, **Bugs connus / à surveiller**. Termine par un rappel de consulter les leçons.

## Étape D — Leçons v2 (apprentissage des erreurs)

Pour chaque couple **problème→solution VÉRIFIÉE** de la session (depuis `errors`, les commandes qui
ont échoué puis réussi, et les corrections de l'utilisateur) — n'enregistre QUE si le correctif a
réellement résolu (test repassé vert / comportement corrigé) :

1. **Cherche un doublon** avant d'écrire :
   ```
   node "${CLAUDE_PLUGIN_ROOT}/scripts/engram-lesson.mjs" find "<symptôme + cause>"
   ```
2. **Décide** : si une leçon proche existe → **enrichis-la** (édite son bloc) et
   `engram-lesson.mjs bump <id> helpful` si elle a resservi ; si elle est contredite →
   `engram-lesson.mjs supersede <ancienne> <nouvelle>` ; sinon **ajoute** :
   ```
   node "${CLAUDE_PLUGIN_ROOT}/scripts/engram-lesson.mjs" add --title "..." \
     --trigger "quand ça arrive (clé de récupération)" --symptom "message/erreur exact" \
     --root-cause "le pourquoi réel" --fix "le correctif exact" --rule "la règle généralisable" \
     --importance 7 --refs fichier.mjs,commit
   ```
   Le format `[L-xxx]` (trigger/symptom/root_cause/fix/rule/meta) est géré par le script — **écriture
   par delta**, jamais de réécriture globale de `lessons.md`. `lessons.md` est référencé dans
   `MEMORY.md` → rechargé/rappelé à chaque session. (≠ `decisions.md` qui = architecture.)

## Étape E — Finalisation

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/mark-saved.mjs"
node "${CLAUDE_PLUGIN_ROOT}/scripts/engram-index.mjs"
```
`mark-saved` enregistre le commit/horodatage + `.engram/.gitignore`. `engram-index` reconstruit
l'index de rappel (BM25 + graphe + embeddings si Ollama), pour que `engram_recall`/`engram_lessons`
et le SessionStart soient à jour.

## Rapport final

Récap concis : arbo `OUT/`, **couverture** X/Y (+ manquants), STATE.md rafraîchi, leçons
ajoutées/enrichies/remplacées, items indexés. En `--precompact` : confirme que STATE + session +
leçons + index sont écrits AVANT la compaction.
