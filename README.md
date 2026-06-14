# 🧠 Engram — mémoire de fin de session pour Claude Code

> Un *engram* est la trace physique d'un souvenir dans le cerveau.

Engram sauvegarde **tout le contexte d'une session Claude Code** — le code du projet, le déroulé de
la session (ce qui a été fait + le chat), et les problèmes rencontrés avec leurs solutions — dans
des fichiers Markdown compatibles **Obsidian**, puis les **recharge automatiquement** aux sessions
suivantes. Aucune mémoire perdue entre les sessions, ni après un auto-compact.

Ce n'est **pas** un outil de démarrage : c'est un outil de **fin de session** + un **filet
anti-compaction**. Tu codes normalement, et à la fin (ou quand le contexte sature) tu lances **une**
commande.

---

## Installation en une ligne

Engram est un **plugin Claude Code**. Installe-le globalement → il marche sur **n'importe quel
projet**, et écrit dans le `.engram/` du repo courant.

Depuis un dépôt distant (GitHub) :

```
/plugin marketplace add <ton-org>/engram
/plugin install engram@engram
```

Ou en local (le dossier de ce repo EST une marketplace) :

```
/plugin marketplace add C:\Users\mehdi\Desktop\engram
/plugin install engram@engram
```

Pré-requis : **Node.js** disponible dans le PATH (les petits scripts déterministes sont en Node,
zéro dépendance npm). Claude Code tourne déjà sur Node, c'est en général le cas.

Pour tester sans installer :

```
claude --plugin-dir C:\Users\mehdi\Desktop\engram
```

---

## Utilisation

| Commande | Quand | Ce que ça fait |
|---|---|---|
| `/engram-save` | fin de session **ou** avant compaction | Scan exhaustif du projet + capture de la session + extraction des leçons → écrit/MAJ `.engram/` |
| `/engram-save --precompact` | contexte saturé | Mode urgence : priorise session + leçons + index + MEMORY, puis le scan |
| `/engram-save --full` | rare | Régénère toutes les notes (ignore l'incrémental) |
| `/engram-load` | reprise / après compaction | Recharge MEMORY + lessons + dernières sessions et résume « où on en est » |

Tu n'as **rien à lancer au début** : le rechargement est automatique (hook SessionStart).

---

## Automatismes (hooks)

Activés dès que le plugin est activé :

- **SessionStart** — réinjecte la mémoire (MEMORY + `lessons.md` entier + 1-3 dernières sessions)
  dans toute nouvelle session, **y compris après une compaction**. Respecte un **budget de tokens**
  avec repli dégressif (réduit le nombre de sessions, puis bascule sur l'index seul si nécessaire ;
  ne coupe jamais un fichier en plein milieu).
- **PreCompact** — quand Claude va compacter le contexte, Engram **bloque une fois** la compaction
  automatique et prévient : « contexte bientôt plein, lance `/engram-save` ». Au 2e déclenchement il
  laisse passer (pas de blocage infini). Comportement réglable (voir config).
- **SessionEnd** — rappelle de sauvegarder si la session se termine sans `/engram-save`.

> Note technique : un hook ne peut pas exécuter Claude. Le hook PreCompact **avertit** (et tente de
> bloquer) ; la sauvegarde intelligente est faite par `/engram-save`. Le blocage PreCompact est émis
> de façon défensive (message + tentative de blocage) car son support peut varier selon la version
> de Claude Code.

---

## Ce qui est généré dans `.engram/`

```
.engram/
├── MEMORY.md            # index court (< ~1500 tokens), rechargé à chaque session
├── 00-overview.md       # projet, but, stack, build/run/test
├── architecture.md      # structure, flux, points d'entrée, patterns
├── module-*.md          # une note par module majeur (détaillée)
├── data-and-apis.md     # endpoints, schémas DB, contrats, clés de storage
├── decisions.md         # décisions d'architecture (style ADR)  ── durable
├── lessons.md           # bugs/pannes résolus (Symptôme→Solution→Règle) ── durable
├── glossary.md
├── conventions.md       # style, commandes, workflow, préférences
├── file-map.md          # 1 ligne par fichier source = PREUVE DE COUVERTURE
├── sessions/
│   ├── INDEX.md         # 1 ligne par session, plus récent en haut
│   └── AAAA-MM-JJ-*.md  # log daté : résumé, décisions, problèmes, reprise
├── .gitignore           # géré par Engram (ignore sessions/ par défaut)
└── config.json          # (facultatif)
```

Toutes les notes ont un frontmatter YAML (`title`, `type`, `updated`, `source_commit`) et des liens
`[[wikilink]]` → ouvrir `.engram/` comme **vault Obsidian** donne une vue graphe cohérente.

### `decisions.md` vs `lessons.md` vs `sessions/`
- `decisions.md` = décisions d'architecture + pourquoi (durable).
- `lessons.md` = bugs/pannes résolus, **consulté avant de proposer une solution** (durable).
- `sessions/` = logs datés de chaque session (par défaut **non versionnés**).

---

## Garanties de qualité

- **Aucune troncature** : pas de `// reste identique`, pas de listes coupées. Un fichier trop gros
  est **découpé**, pas tronqué.
- **Couverture vérifiable** : tout fichier source apparaît dans `file-map.md` ; les manquants sont
  signalés (`## ⚠️ Fichiers non couverts`).
- **Daté + versionné** : `updated` + `source_commit` sur chaque note pour détecter le périmé.
- **Incrémental & idempotent** : si `.engram/` existe, seul ce qui a changé (diff git) est mis à
  jour ; relancer ne crée pas de doublons. Les fichiers **supprimés** sont purgés de `file-map.md`
  et les modules disparus marqués `stale: true`.
- **Sécurité** : les secrets (clés API, tokens, mots de passe, clés privées, URLs avec
  credentials…) sont **masqués** dans la capture de session.

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
  "redactSecrets": true
}
```

- `outputDir` — dossier de sortie (`.engram` ou `memory`…).
- `precompactMode` — `block-once` (défaut, bloque 1× + avertit), `warn` (avertit sans bloquer),
  `auto` (avertit sans bloquer, zéro friction).
- `autoLoad` — rechargement auto au démarrage (défaut `true`).
- `maxSessionsOnLoad` — nb de sessions rechargées (défaut 3).
- `sessionStartTokenBudget` — plafond de tokens de l'injection SessionStart (défaut 12000).
- `gitignoreSessions` — ignore `sessions/` dans git (défaut `true`, garde `INDEX.md`).
- `redactSecrets` — masque les secrets dans la capture (défaut `true`).

---

## Activer / désactiver

- Désactiver temporairement les hooks : `/plugin` → désactive `engram`, ou `precompactMode: "warn"`.
- Désactiver le rechargement auto : `autoLoad: false`.
- Désinstaller : `/plugin uninstall engram@engram`.

---

## Tests

Suite de tests des libs déterministes (redaction, gitignore, frontmatter, transcript, budget
mémoire, chemins), **sans dépendance** (runner intégré de Node) :

```
npm test          # ou : node --test
```

27 tests, tous verts.

## Architecture interne

L'**intelligence** (résumés, structuration, extraction des leçons) est faite par **Claude** via les
slash-commands (qui lancent des sous-agents parallèles pour le scan). Les **scripts Node** ne font
que du **déterministe** : énumération des fichiers (`enumerate-files.mjs`), contexte git
(`git-context.mjs`), localisation + parsing du transcript `.jsonl` (`find-transcript.mjs`,
`parse-transcript.mjs`), agrégation (`collect.mjs`), et les hooks. Voir `docs/superpowers/specs/`
pour le design complet.
