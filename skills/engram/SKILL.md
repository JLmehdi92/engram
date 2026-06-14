---
name: engram
description: Mémoire persistante de session pour ce projet. À utiliser (1) quand un projet contient un dossier .engram/ — charger sa mémoire pour comprendre l'état ; (2) AVANT de proposer une solution à un bug/problème/erreur — consulter d'abord .engram/lessons.md pour voir si le problème a déjà été résolu ; (3) quand l'utilisateur parle de sauvegarder/recharger le contexte, la mémoire, ou la fin de session. Déclencheurs : "engram", "sauvegarde la session", "recharge la mémoire", "où on en était", debugging d'un problème déjà vu.
---

# Engram — mémoire de session

Engram persiste tout le contexte d'une session Claude Code dans `.engram/` (Markdown Obsidian) et
le recharge automatiquement. C'est un outil de **fin de session** + **filet anti-compaction**.

## Règle durable (la plus importante)

**Avant de proposer une solution à un problème, une erreur ou un bug, consulte d'abord
`.engram/lessons.md`.** Ce fichier contient les problèmes déjà rencontrés et résolus
(Symptôme / Contexte / Cause racine / Solution / Règle). Si le problème courant y figure :
- applique/adapte la solution connue,
- si c'est une récurrence, signale-le (le problème est marqué récurrent/prioritaire).

Si `.engram/lessons.md` n'existe pas encore, ce n'est pas grave : continue normalement.

## Commandes

- **`/engram-save`** — en fin de session ou avant une compaction : scan exhaustif du projet
  (couverture vérifiable dans `file-map.md`), capture de la session (code + chat + problèmes),
  mise à jour des notes mémoire et de `lessons.md`. Variante `--precompact` pour le mode urgence,
  `--full` pour tout régénérer.
- **`/engram-load`** — recharge `MEMORY.md` + `lessons.md` (entier) + les dernières sessions et
  résume « voilà où on en est ». Surtout utile en reprise ou après compaction.

## Fonctionnement automatique (hooks)

- **SessionStart** : la mémoire (MEMORY + lessons + 1-3 dernières sessions) est réinjectée
  automatiquement, dans la limite d'un budget de tokens (fallback dégressif vers l'index si trop
  gros). Cela inclut la reprise **après compaction** (`source=compact`).
- **PreCompact** : quand le contexte va saturer, Engram bloque une fois la compaction et avertit
  « lance `/engram-save` maintenant » pour ne rien perdre. Configurable (`block-once`/`warn`/`auto`).
- **SessionEnd** : rappel de sauvegarder si la session se termine sans `/engram-save`.

## Structure de `.engram/`

`MEMORY.md` (index court), `00-overview.md`, `architecture.md`, `module-*.md`, `data-and-apis.md`,
`decisions.md` (ADR), `lessons.md` (bugs résolus, durable), `glossary.md`, `conventions.md`,
`file-map.md` (couverture exhaustive), `sessions/AAAA-MM-JJ-*.md` + `sessions/INDEX.md`.

`decisions.md` = décisions d'architecture ; `lessons.md` = bugs/pannes résolus ; `sessions/` = logs
datés. Les trois sont distincts ; `decisions.md` et `lessons.md` sont durables.

## Configuration (`.engram/config.json`, facultatif)

`outputDir`, `precompactMode` (`block-once`|`warn`|`auto`), `autoLoad`, `maxSessionsOnLoad`,
`sessionStartTokenBudget`, `gitignoreSessions`, `redactSecrets`.
