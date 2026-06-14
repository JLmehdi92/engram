---
description: Recharge la mémoire Engram du projet (MEMORY + lessons + dernières sessions) et résume « voilà où on en est ». Utile en reprise ou après une compaction.
argument-hint: "[--all]"
---

# /engram-load — Recharger la mémoire

Recharge le contexte sauvegardé par Engram et fais une synthèse de reprise.

Arguments : `$ARGUMENTS` — si `--all`, charge toutes les sessions, pas seulement les dernières.

## Procédure

1. Localise le dossier mémoire (défaut `.engram/` ; lis `.engram/config.json` s'il existe pour
   `outputDir` et `maxSessionsOnLoad`). S'il n'existe pas → dis-le et propose `/engram-save`.
2. Lis **`MEMORY.md`** (l'index) et **`sessions/INDEX.md`**.
3. Charge :
   - `00-overview.md` + `architecture.md`,
   - les **1 à 3 dernières sessions** (ou toutes si `--all`),
   - **`lessons.md` EN ENTIER** (mémoire des erreurs déjà résolues) — toujours, même si on ne
     charge que les dernières sessions.
   - Suis les `[[wikilinks]]` pertinents depuis `MEMORY.md` selon la tâche annoncée.
4. **Vérifie la fraîcheur** : compare le `source_commit` des notes au `HEAD` git courant
   (`git rev-parse --short HEAD`). Signale les notes potentiellement périmées (commit différent) ou
   marquées `stale: true`.

## Synthèse de reprise (à afficher)

En quelques lignes : **« Voilà où on en est »** —
- but du projet + stack (1-2 lignes),
- état actuel et ce qui restait à faire (section *Reprise* de la dernière session),
- prochaines étapes proposées,
- rappel s'il y a des leçons récurrentes/prioritaires à garder en tête.

> Règle durable : **avant de proposer une solution à un problème, consulte d'abord `lessons.md`.**
