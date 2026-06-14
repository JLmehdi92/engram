---
description: Recharge la mémoire Engram du projet (STATE + MEMORY + leçons prioritaires + dernières sessions), peut faire un rappel ciblé, et résume « voilà où on en est ». Utile en reprise ou après une compaction.
argument-hint: "[sujet de rappel] [--all]"
---

# /engram-load — Recharger la mémoire

Recharge le contexte sauvegardé par Engram et fais une synthèse de reprise.

Arguments : `$ARGUMENTS` — si un **sujet** est donné, fais un rappel ciblé dessus ; `--all` charge
toutes les sessions.

## Procédure

1. Localise `OUT` (défaut `.engram/` ; lis `OUT/config.json` si présent). Absent → propose `/engram-save`.
2. Lis **`STATE.md` EN PREMIER** (où on en est), puis `MEMORY.md` (index) et `sessions/INDEX.md`.
3. Charge :
   - `00-overview.md` + `architecture.md`,
   - les **1 à 3 dernières sessions** (toutes si `--all`),
   - les **leçons prioritaires** (ou toutes si peu nombreuses).
   - Suis les `[[wikilinks]]` pertinents.
4. **Rappel ciblé** (si un sujet est passé en argument, ou pour préparer une tâche) :
   ```
   node "${CLAUDE_PLUGIN_ROOT}/scripts/engram-recall.mjs" "<sujet>" --topk 6
   ```
   Lis les notes/leçons remontées. (En cours de travail, tu peux aussi utiliser les outils MCP
   `engram_recall` / `engram_lessons`.)
5. **Fraîcheur** : compare les `source_commit` des notes au `HEAD` git. Signale les notes périmées
   (commit différent) ou `stale: true`.

## Synthèse de reprise (à afficher)

**« Voilà où on en est »** en quelques lignes : but + stack ; état actuel et reste à faire (depuis
`STATE.md`) ; prochaines étapes ; leçons récurrentes/prioritaires à garder en tête.

> Règle durable : **avant de proposer une solution à un problème, consulte les leçons** (fichier
> `lessons.md` ou outil MCP `engram_lessons`).
