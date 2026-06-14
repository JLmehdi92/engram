# Engram — Design Spec

- **Date**: 2026-06-14
- **Status**: Approved (design validated by user, including 3 additions below)
- **Author**: Engram build session

## 1. But

Engram est un **plugin Claude Code portable** qui sauvegarde tout le contexte d'une session
(code du projet + déroulé de la session + problèmes/solutions) dans des fichiers Markdown
compatibles Obsidian, et le recharge automatiquement aux sessions suivantes.

C'est un outil de **fin de session** + **filet anti-compaction**, pas un outil de démarrage.
L'utilisateur ne lance rien au début ; il lance `/engram-save` à la fin (ou quand le contexte
sature), et la mémoire revient toute seule à la session suivante.

Un "engram" = la trace physique d'un souvenir dans le cerveau.

## 2. Réalité technique structurante

Un hook Claude Code **ne peut pas exécuter Claude ni lancer de sous-agents**. Il exécute un
script et peut seulement *injecter du texte* dans le contexte (via `hookSpecificOutput.additionalContext`)
ou afficher un `systemMessage`. Conséquences :

- **L'intelligence** (scan, résumé, structuration, extraction de leçons) est faite par **Claude**
  via les slash-commands `/engram-save` et `/engram-load`, qui peuvent lancer des sous-agents.
- **Les hooks** sont de simples scripts Node déterministes :
  - `PreCompact` : bloque **une fois** la compaction auto + injecte l'avertissement « lance `/engram-save` ».
  - `SessionStart` : injecte directement le contenu mémoire (déterministe, pas besoin de Claude).
  - `SessionEnd` : rappel de sauvegarde.

### Incertitude documentée
Le `decision: "block"` sur `PreCompact` n'est pas garanti à 100 % par la doc publique. Engram
l'implémente **défensivement** : on tente le blocage **et** on émet un `systemMessage` +
`additionalContext` très visibles, pour que l'avertissement passe même si le blocage n'est pas
honoré. Les scripts doivent lire le **vrai payload** sur stdin et gérer les variantes de noms de
champs (`trigger` vs `compaction_trigger`, etc.) sans planter.

## 3. Réglages par défaut

- Nom : **Engram**. Commandes : `/engram-save`, `/engram-load`.
- Dossier de sortie : `.engram/` à la racine du repo courant (configurable → `memory/`).
- PreCompact : **bloque 1× + avertit** par défaut (`block-once`), configurable en `warn` ou `auto`.
- SessionStart auto-load : **ON** par défaut.
- Distribution : **plugin + marketplace local** (cross-platform, inclut Windows).
- Scripts déterministes : **Node.js** (`.mjs`, zéro dépendance).
- Langue des fichiers `.md` générés : **français**.

## 4. Arborescence du plugin

```
engram/
├── .claude-plugin/
│   ├── plugin.json              # manifeste plugin
│   └── marketplace.json         # rend le dossier installable en marketplace local
├── commands/
│   ├── engram-save.md           # /engram-save  (orchestration par Claude)
│   └── engram-load.md           # /engram-load
├── skills/engram/SKILL.md       # règle durable : consulter lessons.md avant de résoudre
├── hooks/hooks.json             # PreCompact / SessionEnd / SessionStart
├── scripts/                     # Node .mjs — DÉTERMINISTE uniquement
│   ├── lib/
│   │   ├── paths.mjs            # résolution des chemins (.engram, projects/<encoded cwd>)
│   │   ├── gitignore.mjs        # matcher .gitignore + exclusions par défaut
│   │   ├── transcript.mjs       # lecture/parsing .jsonl
│   │   ├── redact.mjs           # redaction des secrets
│   │   ├── frontmatter.mjs      # lecture/écriture frontmatter YAML
│   │   ├── tokens.mjs           # estimation tokens + budget
│   │   └── memory.mjs           # logique de chargement mémoire partagée (hook + /engram-load)
│   ├── enumerate-files.mjs      # liste .gitignore-aware + comparaison de couverture
│   ├── find-transcript.mjs      # localise le .jsonl de la session courante
│   ├── parse-transcript.mjs     # .jsonl → digest (chat / outils / erreurs) + redaction
│   ├── git-context.mjs          # HEAD court, branche, diff (incl. supprimés) depuis source_commit
│   ├── collect.mjs              # agrège git+enumerate+transcript → un seul JSON pour /engram-save
│   ├── hook-precompact.mjs      # bloque 1× + avertit
│   ├── hook-sessionstart.mjs    # injecte la mémoire (avec plafond de tokens)
│   └── hook-sessionend.mjs      # rappel de sauvegarde
└── README.md
```

## 5. Installation en une ligne

```
claude plugin marketplace add <dossier-local-ou-repo-github>
claude plugin install engram@engram
```

Installé **globalement** → fonctionne sur n'importe quel projet, sortie dans `.engram/` du repo
courant. Hooks activés par le plugin (opt-in via activation du plugin), documentés on/off dans le
README.

## 6. `/engram-save` — déroulé complet

0. (Optionnel) lit `.engram/config.json`.
1. **Scripts déterministes** via `collect.mjs` :
   - `git-context` : is-git-repo, HEAD court, branche, dernier `source_commit` connu, diff
     `--name-status` (Added/Modified/**Deleted**/Renamed) depuis ce commit.
   - `enumerate-files` : liste exhaustive. Si git → `git ls-files` + untracked non-ignorés ;
     sinon walk respectant `.gitignore` + exclusions par défaut (`node_modules`, `dist`, build,
     binaires, `.git`, `.engram`). Sortie JSON `{path, size}`.
   - `find-transcript` + `parse-transcript` : localise le `.jsonl` de la session courante et
     produit un digest (messages user condensés, actions assistant, outils Bash/Edit/Write avec
     fichiers touchés et commandes+exit, erreurs détectées) — **avec redaction des secrets**.
2. **A — Scan exhaustif** : découpe la liste de fichiers par zones/dossiers, dispatch de
   **sous-agents parallèles** (1 par zone) qui lisent et résument → **1 ligne descriptive par
   fichier source** dans `file-map.md`. Compare liste réelle vs couverte → **signale tout fichier
   manquant** (preuve de couverture).
3. **B — Session du jour** : `sessions/AAAA-MM-JJ-<slug>.md` (résumé exécutif, décisions + pourquoi,
   problèmes + solutions, fichiers créés/modifiés/supprimés + pourquoi, commandes + résultats,
   extraits clés du dialogue, section **Reprise**). MAJ `sessions/INDEX.md` (plus récent en haut).
4. **C — Mémoire** : `MEMORY.md` (index court < ~1500 tokens, jamais tronqué), `00-overview.md`,
   `architecture.md`, `module-<nom>.md`, `data-and-apis.md`, `decisions.md`, `glossary.md`,
   `conventions.md`, `file-map.md`. Frontmatter YAML (`title`, `type`, `updated`, `source_commit`)
   + `[[wikilinks]]`. **Incrémental** (diff depuis `source_commit`, MAJ ciblée), **idempotent**,
   **aucune troncature** (un fichier trop gros se découpe).
5. **D — Leçons** : `lessons.md`, extrait chaque problème→solution
   (Symptôme / Contexte / Cause racine / Solution / Règle / Réfs), **déduplique** (enrichit si
   similaire, marque récurrent/prioritaire si réapparaît). Référencé dans `MEMORY.md`. Distinct de
   `decisions.md` (architecture) et des `sessions/` (logs datés).
6. **Robustesse timing** : si appelé avec `--precompact` (ou si l'orchestrateur détecte l'urgence) →
   priorise B + D + INDEX + MEMORY, puis complète le scan A.

## 7. `/engram-load`

Lit `MEMORY.md` + `sessions/INDEX.md`, charge `00-overview.md` + `architecture.md` + les **1-3
dernières sessions** + **`lessons.md` en entier**, puis résume « voilà où on en est ».

## 8. Hooks (`hooks.json`)

- **PreCompact** (`auto`) → `hook-precompact.mjs` : bloque 1× (état dans `.engram/.state.json`
  par `session_id`) + `systemMessage` « Contexte bientôt plein — lance `/engram-save` ». 2e
  déclenchement dans la même session → laisse compacter (pas de deadlock). `manual` → avertit sans
  bloquer.
- **SessionStart** (`startup`/`resume`/`compact`) → `hook-sessionstart.mjs` : injecte
  `additionalContext`. Le cas `compact` est la **récupération post-compaction**.
- **SessionEnd** → `hook-sessionend.mjs` : `systemMessage` de rappel si pas de sauvegarde récente.

## 9. Skill `SKILL.md`

Règle durable auto-invocable : **« Avant de proposer une solution à un problème, consulte
`.engram/lessons.md` »**, + documentation du workflow save/load.

## 10. Config (optionnelle) `.engram/config.json`

```json
{
  "outputDir": ".engram",
  "precompactMode": "block-once",
  "autoLoad": true,
  "maxSessionsOnLoad": 3,
  "sessionStartTokenBudget": 12000,
  "gitignoreSessions": true,
  "redactSecrets": true
}
```

Défauts intégrés ; le fichier est facultatif.

---

## 11. AJOUTS demandés (intégrés au design)

### 11.1 Plafond de tokens sur l'injection SessionStart
`hook-sessionstart.mjs` estime les tokens (`lib/tokens.mjs`, heuristique ~chars/4) et applique un
**budget** (`sessionStartTokenBudget`, défaut 12000). Chaîne de **fallback dégressive**, jamais de
troncature en milieu de fichier :

1. `MEMORY.md` + `lessons.md` (entiers) + N dernières sessions (N = `maxSessionsOnLoad`).
2. Si dépassement → réduire N (sessions) une par une jusqu'à 0.
3. Si `MEMORY.md` + `lessons.md` dépassent encore → **fallback index** : n'injecter que `MEMORY.md`
   + une note « lessons.md trop volumineux pour l'injection auto — ouvre-le via `/engram-load` ».
4. Si `MEMORY.md` seul dépasse (anormal) → injecter une note pointant vers `.engram/MEMORY.md`.

Le budget est configurable. `MEMORY.md` et `lessons.md` ne sont jamais coupés en plein milieu :
on inclut le fichier entier ou pas du tout (sauf MEMORY.md qui est par construction court).

### 11.2 Politique git (gitignore + redaction)
- **`.gitignore` automatique** : au premier `/engram-save`, Engram crée/complète un
  `.engram/.gitignore` qui **ignore `sessions/` par défaut** (les logs datés contiennent du
  dialogue brut), tout en gardant versionnés `MEMORY.md`, `lessons.md`, `decisions.md`,
  `architecture.md`, etc. Comportement contrôlé par `gitignoreSessions` (défaut `true`). Si l'utilisateur
  veut versionner les sessions, il met `false`.
- **Redaction des secrets** (`lib/redact.mjs`, utilisé par `parse-transcript.mjs`) : avant
  d'écrire la capture de session, masquer les secrets courants — clés API (`sk-...`, `ghp_...`,
  `AKIA...`, tokens Bearer, JWT), variables d'env sensibles (`*_KEY`, `*_SECRET`, `*_TOKEN`,
  `PASSWORD`, `*_PWD`), URLs avec credentials (`https://user:pass@`), `.env` lines, blocs de clé
  privée (`-----BEGIN ... PRIVATE KEY-----`). Remplacement par `«REDACTED:<type>»`. Contrôlé par
  `redactSecrets` (défaut `true`). La redaction s'applique à la capture de session ET aux extraits
  de dialogue.

### 11.3 Fichiers supprimés en mode incrémental
Le diff `git-context` expose les fichiers **Deleted** (et `Renamed` old→new). Au `/engram-save`
incrémental :
- **`file-map.md`** : retirer les lignes des fichiers supprimés ; pour les renommés, mettre à jour
  le chemin. La comparaison de couverture se fait toujours contre la liste **réelle** courante.
- **Notes `module-*.md`** : si une note décrit un module dont tous les fichiers ont disparu, la
  **marquer périmée** (ajouter `stale: true` au frontmatter + une note « module supprimé le
  <date> ») plutôt que de la supprimer silencieusement, et la signaler dans le résumé de fin.
- **Entrées orphelines** : toute note référençant un fichier supprimé est signalée comme à revoir.
- Aucune suppression destructive automatique des notes ; Engram **marque** et **signale**, l'humain
  tranche.

## 12. Démo de fin

1. `git init` du repo Engram (nécessaire pour le mode git + distribution GitHub + demo).
2. Installer Engram (ou pointer `--plugin-dir`), lancer `/engram-save` **sur ce repo lui-même**.
3. Montrer l'arbre `.engram/` + manifeste de couverture (`file-map.md`) + fichier de session +
   `lessons.md`.
4. Simuler le déclenchement `PreCompact` (avertissement « contexte bientôt plein »).

## 13. Notes d'implémentation / risques

- Le repo courant n'est pas (encore) un dépôt git → `git init` au début de l'implémentation.
- Les scripts doivent dégrader proprement hors git (walk + .gitignore maison).
- Les champs exacts des payloads de hooks seront vérifiés en lisant un transcript réel et en
  loggant le stdin reçu ; les scripts tolèrent les variantes de noms.
- Tout en Node sans dépendance npm → pas de `node_modules`, install instantanée.
