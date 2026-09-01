# État d'avancement — Application d'accompagnement à la perte de poids

> Document de suivi. Mis à jour au fil des phases.
> **Dernière mise à jour :** fin Phase 4 (journal + Open Food Facts), validée sur appareil.

---

## Vue d'ensemble

| Phase | Intitulé                     | État                                              |
| ----- | ---------------------------- | ------------------------------------------------- |
| 0     | Fondations projet            | ✅ Terminée & commitée                            |
| 1     | Domaine nutritionnel         | ✅ Terminée & commitée                            |
| 2     | Data & persistance locale    | ✅ Terminée & commitée                            |
| 3     | Onboarding                   | ✅ Terminée & commitée                            |
| 4     | Journal + Open Food Facts    | ✅ Terminée & commitée                            |
| 5     | Suivi du poids & progression | ⏭️ Prochaine                                      |
| 6     | Moteur de conseils           | ⬜ Contenu prêt (25 briques rédigées)             |
| 7     | Recettes                     | ⬜ Contenu prêt (22 recettes + table ingrédients) |
| 8     | Sport                        | ⬜ Données prêtes (METs + noyau exercices)        |
| 9     | Backend & synchronisation    | ⬜ Groundwork posé (sync_meta, deletedAt)         |
| 10    | Durcissement & mise en prod  | ⬜                                                |

---

## Ce qui est fait en détail

### Phase 0 — Fondations

- Projet Expo SDK 57, TypeScript strict (zéro `any`), Expo Router.
- Arborescence en couches complète (domain / data / hooks / stores / theme / tests).
- Tokens de design (palette sobre light/dark, échelle 4 px, typo tabular-nums).
- Sentry + PostHog câblés à vide (no-op sans clés, aucune donnée de santé ne transite).
- ESLint / Prettier / Husky / CI (format, lint, typecheck, tests + couverture).
- **Architecture vérifiée par le linter** : le domaine ne peut pas importer React/Expo/data ; l'UI ne peut pas importer `@/data`.

### Phase 1 — Domaine nutritionnel

- Formules : BMR (Mifflin-St Jeor), TDEE, objectif calorique, macros, METs.
- **Garde-fous de sécurité** (le cœur sensible) : plancher calorique appliqué en dernier sur tous les chemins, plafond de déficit 750 kcal, plafond de rythme 1 %/semaine.
- Test de balayage sur 14 400 combinaisons : aucune ne franchit un seuil de sécurité, aucun ajustement silencieux.
- 151 tests, 100 % de couverture sur le domaine.

### Phase 2 — Data & persistance locale

- SQLite + Drizzle, repositories par entité, local-first.
- **Snapshot nutritionnel** : valeurs figées à l'ajout, l'historique ne change jamais rétroactivement (ON DELETE SET NULL, name_snapshot, totaux sans jointure).
- `sync_meta` avec `dirty` / `updatedAt` / `syncedAt` / **`deletedAt`** (pierre tombale pour la future synchro).
- Consentement RGPD en table dédiée (avant toute biométrie).

### Phase 3 — Onboarding

- Parcours complet : consentement bloquant → biométrie → objectif → rythme → restitution.
- Validation branchée sur le domaine (jamais dupliquée dans l'UI).
- Restitution pédagogique : chaque garde-fou est expliqué, jamais silencieux (y compris le cas « objectif fixé plus haut que la dépense » au maintien/recomposition).
- Curseur de rythme : écrêtage rendu visible et honnête (perte réellement atteignable affichée en permanence, message explicatif si bornage).
- **Bug corrigé en test réel** : l'écran recalculait la règle métier en dur (`Math.min` sur le déficit) — supprimé, toutes les valeurs viennent de `CalorieTargetResult`.
- Utilitaire de reset dev (`__DEV__` uniquement) pour retester les parcours.

### Phase 4 — Journal + Open Food Facts

- Domaine : normalisation code-barres (GTIN/GS1), budget du jour appliquant le `calorieMode` (deux vues).
- Couche distante isolée derrière `FoodDataSource` : scan (API v2), recherche par nom (Search-a-licious), limiteur à fenêtre glissante, mapper OFF, frontière ODbL.
- Cache write-through : tout produit vu est écrit dans `food.repo` (source de vérité unique).
- Offline-first vérifié sur chaque chemin.
- Caméra confirmée présente dans Expo Go SDK 57 (pas de development build nécessaire).
- **Validé sur appareil** : scan, recherche par nom, ajout au journal, comportement offline.

---

## ⚠️ Actions qui te reviennent (hors code) — à ne pas perdre

1. **`EXPO_PUBLIC_OFF_CONTACT`** doit contenir une **adresse réellement surveillée** avant toute mise en service. C'est le canal par lequel Open Food Facts prévient avant de bloquer. Un placeholder = risque de blocage silencieux en prod. _(En dev, ton email personnel suffit.)_
2. **Validation santé par un professionnel** avant la prod : planchers caloriques, plafond de rythme, seuils d'IMC, et les messages sensibles (plateau, reprise après écart, faim). Rappelé dans le README.
3. **Conseil juridique ODbL** (Open Food Facts, clause share-alike) avant tout usage commercial.
4. **Vérifier les valeurs nutritionnelles** des recettes/ingrédients avec la base Ciqual (France) au moment de la Phase 7.
5. **Nom définitif du produit** (provisoire actuel : FleetWeightEasy) — centralisé, renommage indolore.

---

## Points à surveiller (dette légère, non bloquante)

- **Search-a-licious** : mapping validé sur appareil au premier essai, mais garder un œil si la forme des réponses évolue.
- **Quotas OFF** : calibrés à 80 lectures / 8 recherches par minute (sous les 100/10 documentés). À revérifier contre la politique courante.
- **Signal de fiabilité** : `verified` est toujours `false` pour OFF (choix sémantique assumé). Vérifier que l'utilisateur a _un_ autre signal de fiabilité des données (complétude, mention « données communautaires »).
- **Accessibilité** : les puces de choix de repas utilisent un rôle `checkbox` pour un choix exclusif (devrait être `radio`). À corriger en passe d'accessibilité groupée (Phase 10).

---

## Prochaine étape : Phase 5 — Suivi du poids & progression

**Objectif :** suivre le poids dans le temps, sereinement, et déclencher le recalcul adaptatif des objectifs.

**Points clés de la spec (PHASES_2_A_5.md §Phase 5) :**

- Saisie du poids (une pesée par jour, déjà prévue au schéma).
- **Courbe lissée** (moyenne mobile) en plus des points bruts — santé mentale : montrer la tendance, pas la fluctuation quotidienne anxiogène.
- Indicateurs : variation sur la période, progression vers le cible, rythme réel vs visé.
- **Recalcul adaptatif** (domaine, déjà spécifié Phase 1 §8) : recalcule BMR/TDEE/objectif quand le poids évolue, ne notifie qu'au-delà d'un seuil (éviter les micro-ajustements), explique l'ajustement.
- **Détection de plateau** : prépare le déclenchement de la brique de conseil « plateau » en Phase 6.
- Ton encourageant et factuel, jamais culpabilisant.
- Calculs (moyenne mobile, plateau, rythme réel) dans le domaine, purs et testés.

**Ce qui relie déjà cette phase au reste :** le champ `weight_entry` existe (Phase 2), le recalcul adaptatif est spécifié (Phase 1), et la détection de plateau alimentera le moteur de conseils (Phase 6). C'est une phase de cohérence, pas de nouvelles fondations.

---

## Avant de lancer la Phase 5

- [x] **Commiter la Phase 4** — commitée après passage au vert de la suite complète (666 tests, lint, typecheck).
- [x] Confirmer que la recherche par nom (Search-a-licious) a bien renvoyé des résultats cohérents sur appareil — **confirmé**.

Les deux points sont faits : la Phase 5 peut démarrer.
