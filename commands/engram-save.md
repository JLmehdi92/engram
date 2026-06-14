---
description: Sauvegarde TOUT le contexte de la session (scan exhaustif du projet + capture de la session + problèmes/solutions) dans .engram/ (Markdown Obsidian). À lancer en fin de session ou avant une compaction.
argument-hint: "[--precompact] [--full]"
---

# /engram-save — Mémoriser toute la session

Tu es l'orchestrateur d'Engram. Objectif : **ne jamais rien perdre**. Tu produis/mets à jour une
mémoire Markdown durable dans `.engram/` à la racine du repo courant. **Aucune troncature** : un
fichier trop gros se découpe, jamais de `// reste identique` ni de liste coupée. Détail maximal :
c'est pour Claude, pas pour un humain pressé.

Arguments reçus : `$ARGUMENTS`
- Si `--precompact` est présent → **mode urgence** (contexte sur le point d'être compacté) :
  priorise dans l'ordre **B (session) → D (leçons) → INDEX → MEMORY**, PUIS fais A (scan) si le
  temps le permet. Sois rapide mais complet sur la session et les leçons.
- Si `--full` est présent → ignore l'incrémental, régénère toutes les notes.

## Étape 0 — Collecte déterministe (une seule commande)

Lance le collecteur (il agrège git + liste exhaustive des fichiers + digest de session redacté) :

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/collect.mjs"
```

Si `${CLAUDE_PLUGIN_ROOT}` n'est pas résolu (commande lancée hors plugin), trouve le dossier des
scripts Engram (cherche `scripts/collect.mjs` à côté de cette commande, ou dans le repo Engram) et
lance-le avec `node`. Parse le JSON renvoyé. Il contient :
- `config` (outputDir, redactSecrets, gitignoreSessions, maxSessionsOnLoad, budget…)
- `git` : `isGit`, `head`, `branch`, `lastSaveCommit`, `diff.{added,modified,deleted,renamed}`
- `files` : `mode`, `count`, `files[]` (la **liste exhaustive** à couvrir), `binaries[]`
- `transcript.digest` : `meta` (tokens contexte, compteurs), `userPrompts`, `assistantNotes`,
  `toolCalls`, `commands`, `filesTouched`, `errors`
- `engramExists`, `incremental`

Détermine `OUT` = `config.outputDir` (défaut `.engram`). Crée `OUT/` s'il n'existe pas.

**Mode incrémental** : si `incremental` est vrai, ne régénère QUE ce qui a changé d'après
`git.diff` (sauf `--full`). Sinon, génération complète.

## Étape A — Scan exhaustif du projet (AUCUN fichier oublié)

1. Prends `files.files[]` = la liste de référence (déjà .gitignore-aware, binaires exclus).
2. **Découpe par zones** (un groupe par dossier de premier/second niveau, ~15-40 fichiers par
   groupe). Pour un gros codebase, **dispatche des sous-agents EN PARALLÈLE** (un `Task`/`Agent`
   par zone) : chaque sous-agent lit ses fichiers et renvoie, pour CHAQUE fichier, **une ligne
   descriptive** `chemin — rôle/responsabilité (exports clés, dépendances notables)`, plus un
   mini-résumé du module. Lance les sous-agents d'une même vague dans un seul message.
   - Pour un petit repo (≤ ~30 fichiers), tu peux lire toi-même sans sous-agents.
3. **Construis `OUT/file-map.md`** : frontmatter (`type: reference`) + une ligne par fichier source.
   C'est la **preuve de couverture**.
4. **Vérifie la couverture** : compare l'ensemble des chemins de `files.files[]` à l'ensemble des
   chemins réellement décrits dans `file-map.md`. Liste explicitement tout fichier **manquant** dans
   une section `## ⚠️ Fichiers non couverts` (vide = parfait). Les binaires (`files.binaries[]`)
   sont listés à part sans résumé de contenu.
5. **Fichiers supprimés** (`git.diff.deleted` / `renamed`) : retire leurs lignes de `file-map.md`
   (ou met à jour le chemin pour un renommage). Ne laisse aucune entrée orpheline.

## Étape B — Capture de la session du jour

À partir de `transcript.digest`, écris `OUT/sessions/AAAA-MM-JJ-<slug>.md` (slug court tiré du
thème de la session). Frontmatter (`type: session`, `updated`, `source_commit: git.head`). Sections :
- **Résumé exécutif** — ce qui a été fait aujourd'hui.
- **Décisions prises + pourquoi**.
- **Problèmes rencontrés + solutions** (alimente aussi l'étape D).
- **Fichiers créés / modifiés / supprimés** (+ pourquoi) — recoupe `filesTouched` et `git.diff`.
- **Commandes importantes + résultats** (depuis `commands` et `errors`).
- **Extraits clés du dialogue** utilisateur↔assistant porteurs de contexte durable (exigences,
  préférences, arbitrages) — l'essentiel utile, **pas** le verbatim intégral.
- **Reprise** — état actuel, ce qui reste à faire, prochaines étapes.

Les secrets sont déjà masqués par le collecteur (`redacted: true`) ; reste vigilant et n'introduis
aucun secret venu d'ailleurs. Mets à jour `OUT/sessions/INDEX.md` (1 ligne par session, **plus
récent en haut**) ; crée-le avec frontmatter si absent.

## Étape C — Mémoire durable (plusieurs notes .md)

Crée/mets à jour, compatibles Obsidian (frontmatter YAML + `[[wikilinks]]`) :
- `OUT/MEMORY.md` — **index court** (< ~1500 tokens, jamais tronqué) : 1 ligne par note avec lien
  `[[...]]`. Doit **toujours** référencer `[[lessons]]`.
- `OUT/00-overview.md` — projet, but, stack, comment build/run/test.
- `OUT/architecture.md` — structure des dossiers, flux d'exécution, points d'entrée, patterns clés.
- `OUT/module-<nom>.md` — un par module majeur, détaillé au maximum.
- `OUT/data-and-apis.md` — endpoints, schémas DB, contrats, formats de messages, clés de storage.
- `OUT/decisions.md` — décisions techniques + pourquoi (style ADR), contraintes. (≠ leçons)
- `OUT/glossary.md`, `OUT/conventions.md` (style de code, commandes, workflow, préférences user).
- `OUT/file-map.md` — déjà produit en A.

Frontmatter de CHAQUE note :
```yaml
---
title: <titre>
type: overview | architecture | module | reference | decisions | glossary | lessons | session
updated: <date ISO>
source_commit: <git.head court>
---
```

**Incrémental** : ne réécris une note que si sa zone a changé (`git.diff`). **Idempotent** :
relancer ne crée pas de doublons et ne casse pas les liens. **Fichiers supprimés** : si une note
`module-*.md` décrit un module dont tous les fichiers ont disparu, **marque-la périmée**
(`stale: true` dans le frontmatter + une ligne « module supprimé le <date> »), ne la supprime pas
silencieusement, et signale-la dans le résumé final. Toute note référençant un fichier supprimé est
à revoir.

## Étape D — Leçons & dépannage (`lessons.md`, durable)

Crée/maintiens `OUT/lessons.md` (frontmatter `type: lessons`), **séparé** des sessions datées et de
`decisions.md`. Pour chaque couple problème→solution de la session (depuis `errors`, les commandes
qui ont échoué puis réussi, et le dialogue) :

```
## <Titre court du problème>
- **Symptôme** : ce qu'on observait (erreur, comportement, message exact).
- **Contexte** : où/quand ça arrive (fichier, module, condition).
- **Cause racine** : pourquoi ça arrivait vraiment.
- **Solution** : ce qui a corrigé, avec le code/commande exact.
- **Comment éviter / règle** : la leçon généralisable.
- **Réfs** : [[module-x]], fichier:ligne, date, commit.
```

**Déduplique** : si un problème similaire existe déjà, **enrichis** l'entrée au lieu d'en créer une
nouvelle ; si le même problème revient, marque-le **récurrent/prioritaire**. `lessons.md` est
référencé dans `MEMORY.md` → rechargé à chaque session.

## Étape E — Finalisation

Lance :
```
node "${CLAUDE_PLUGIN_ROOT}/scripts/mark-saved.mjs"
```
(enregistre le commit/horodatage de référence pour le prochain diff incrémental + crée/MAJ
`OUT/.gitignore` selon `gitignoreSessions`).

## Rapport final à l'utilisateur

Affiche un récap concis :
- arborescence de `OUT/` (notes créées/mises à jour),
- **couverture** : X/Y fichiers couverts, et la liste des manquants (idéalement aucun),
- nombre de leçons ajoutées/enrichies,
- notes marquées périmées (le cas échéant),
- en mode `--precompact` : confirme que session + leçons + index + MEMORY sont bien écrits AVANT la
  compaction.
