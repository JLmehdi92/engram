---
description: Consolidation "sleep-time" de la mémoire Engram : fusionne les doublons, archive le périmé, rafraîchit STATE.md et reconstruit l'index. À lancer périodiquement sur un gros projet.
argument-hint: "[--apply]"
---

# /engram-consolidate — ranger la mémoire

La mémoire doit se ranger elle-même, sinon elle pourrit. Cette commande consolide `.engram/`.

## Procédure

1. Lance la passe déterministe :
   ```
   node "${CLAUDE_PLUGIN_ROOT}/scripts/engram-consolidate.mjs"
   ```
   Elle renvoie un rapport : `archivable` (leçons remplacées/périmées/nuisibles), `duplicates`
   (paires de leçons quasi identiques à fusionner), `staleNotes` (notes périmées).

2. **Fusionne les doublons** (`duplicates`) : pour chaque paire, lis les deux leçons, garde la plus
   complète, enrichis-la des infos de l'autre, puis marque l'autre comme remplacée
   (`node engram-lesson.mjs supersede <ancienne> <gardée>`). Ne réécris jamais tout le fichier :
   édite bloc par bloc.

3. **Refais `STATE.md`** : relis l'état du projet (dernière session, avancement, prochaines étapes)
   et mets `STATE.md` à jour pour qu'il reflète exactement « où on en est » aujourd'hui.

4. **Archive en sécurité** (si tu confirmes) :
   ```
   node "${CLAUDE_PLUGIN_ROOT}/scripts/engram-consolidate.mjs" --apply
   ```
   Déplace les leçons archivables vers `archive/lessons.md` et les notes périmées vers `archive/`
   (jamais de suppression destructive), puis reconstruit l'index.

5. **(Optionnel) Notes-index (MOC)** : si plusieurs notes forment un cluster thématique fortement
   lié par `[[wikilinks]]`, crée une note d'index qui les résume et les relie.

## Rapport final
Indique : doublons fusionnés, leçons/notes archivées, STATE.md rafraîchi, taille de l'index.
