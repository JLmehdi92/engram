---
name: engram
description: Mémoire persistante de session pour ce projet. À utiliser (1) quand un projet contient un dossier .engram/ — charger sa mémoire pour comprendre l'état ; (2) AVANT de proposer une solution à un bug/problème/erreur — consulter d'abord .engram/lessons.md pour voir si le problème a déjà été résolu ; (3) quand l'utilisateur parle de sauvegarder/recharger le contexte, la mémoire, ou la fin de session. Déclencheurs : "engram", "sauvegarde la session", "recharge la mémoire", "où on en était", debugging d'un problème déjà vu.
---

# Engram — mémoire de session

Engram persiste tout le contexte d'une session Claude Code dans `.engram/` (Markdown Obsidian) et
le recharge automatiquement. C'est un outil de **fin de session** + **filet anti-compaction**.

## Règle durable (la plus importante)

**Avant de proposer une solution à un problème, une erreur ou un bug, consulte d'abord les
leçons** — soit l'outil MCP **`engram_lessons("<le problème courant>")`**, soit `.engram/lessons.md`.
Ces leçons (format `[L-xxx]` : trigger / symptom / root_cause / fix / rule) sont les problèmes déjà
rencontrés et résolus. Si le problème courant y figure :
- applique/adapte la solution connue,
- si elle a resservi, c'est une récurrence (compteur `helpful`).

De même, pour retrouver n'importe quel contexte du projet (décision passée, où on en était, un
module), utilise **`engram_recall("<sujet>")`** au lieu de tout relire. Si `.engram/` n'existe pas
encore, continue normalement.

## Commandes

- **`/engram-save`** — fin de session / avant compaction : scan exhaustif (couverture dans
  `file-map.md`), capture de session, MAJ des notes, de `STATE.md`, des leçons v2 et de l'index de
  rappel. `--precompact` (urgence), `--full` (tout régénérer).
- **`/engram-load`** — recharge `STATE.md` + `MEMORY.md` + leçons prioritaires + dernières sessions,
  fait un rappel ciblé optionnel, et résume « voilà où on en est ».
- **`/engram-consolidate`** — range la mémoire : fusionne les doublons, archive le périmé
  (vers `archive/`, non destructif), rafraîchit `STATE.md`, reconstruit l'index.

## Outils MCP (utilisables EN PLEIN TRAVAIL)

- **`engram_recall(query)`** — retrouve les notes/leçons/sessions pertinentes.
- **`engram_lessons(situation)`** — leçons pertinentes pour un bug/erreur courant.
- **`engram_save_note(title, content)`** — ajoute une note durable à la volée.

## Fonctionnement automatique (hooks)

- **SessionStart** : réinjecte `STATE.md` + `MEMORY.md` + leçons prioritaires + 1-3 dernières
  sessions, sous budget de tokens (dégradation propre). Inclut la reprise **après compaction**.
- **Stop** : avertit proactivement quand le contexte approche la saturation (~70%) → propose
  `/engram-save` avant la compaction.
- **PreCompact** : bloque une fois la compaction et avertit. Configurable (`block-once`/`warn`/`auto`).
- **SessionEnd** : rappel de sauvegarder si la session se termine sans `/engram-save`.

## Structure de `.engram/`

`STATE.md` (reprise, chargé en 1er), `MEMORY.md` (index), `00-overview.md`, `architecture.md`,
`module-*.md`, `data-and-apis.md`, `decisions.md` (ADR), `lessons.md` (erreurs résolues `[L-xxx]`,
durable), `glossary.md`, `conventions.md`, `file-map.md` (couverture), `sessions/` (+ `INDEX.md`),
`archive/` (retirés, non supprimés), `.index/` (index de rappel, reconstructible).

`decisions.md` = décisions d'architecture ; `lessons.md` = bugs/pannes résolus ; `sessions/` = logs
datés. Les trois sont distincts ; `decisions.md` et `lessons.md` sont durables.

## Configuration (`.engram/config.json`, facultatif)

`outputDir`, `precompactMode` (`block-once`|`warn`|`auto`), `autoLoad`, `maxSessionsOnLoad`,
`sessionStartTokenBudget`, `gitignoreSessions`, `redactSecrets`.
