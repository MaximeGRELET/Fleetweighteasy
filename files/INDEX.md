# Index de la planification — Application d'accompagnement à la perte de poids

Ce dossier contient la planification technique complète du projet, destinée à être exécutée par Claude Code.

## Point d'entrée

- **`POUR_CLAUDE_CODE.md`** — **À lire en tout premier par Claude Code.** Explique comment aborder le dossier, les règles non négociables, l'ordre d'exécution.

## Documents de spécification (dans l'ordre de lecture)

1. **`PLAN_IMPLEMENTATION.md`** — Document maître.
   Vision produit, stack, architecture en couches, modèle de données, science, moteur de conseils, parcours utilisateur, sécurité/RGPD, tests, plan phasé (vue d'ensemble des 11 phases).

2. **`PHASE_1_DOMAINE_NUTRITIONNEL.md`** — Spécification détaillée de la Phase 1.
   Domaine nutritionnel pur : formules (Mifflin-St Jeor, TDEE, macros, METs) et **garde-fous de sécurité sourcés** (planchers caloriques, plafond de rythme, IMC, signaux à risque). La partie la plus sensible.

3. **`PHASES_2_A_5.md`** — Phases 2 (data & persistance locale), 3 (onboarding), 4 (journal + Open Food Facts), 5 (poids & progression).

4. **`PHASES_6_A_10.md`** — Phases 6 (moteur de conseils), 7 (recettes), 8 (sport), 9 (backend & synchro), 10 (durcissement & prod).

## Documents de contenu et de données (à intégrer à la phase concernée)

5. **`BRIEF_BRIQUES_CONSEIL.md`** — Ossature du moteur de conseils (types, tags, conditions, grille). → Phase 6.

6. **`BRIQUES_CONSEIL_REDIGEES.md`** — Les 25 briques de conseil rédigées, prêtes à intégrer. → Phase 6.

7. **`BRIEF_RECETTES.md`** — Ossature du catalogue (types, filtrage, table d'ingrédients, grille de couverture). → Phase 7.

8. **`RECETTES_REDIGEES.md`** — Table d'ingrédients + 22 recettes complètes. → Phase 7.

9. **`DONNEES_SPORT.md`** — Table METs sourcée (cardio) + noyau de ~30 exercices + structures de programmes. → Phase 8 (et §7 METs pour Phase 1).

## Ordre d'exécution

Strictement séquentiel, de la Phase 0 (fondations projet, document maître §13) à la Phase 10. Chaque phase est livrable et testée avant la suivante. La « Définition de terminé » de chaque phase sert de checklist de sortie.

## État du dossier

**Planification : complète.** Tout le contenu et toutes les données de référence du V1 sont produits (conseils, recettes, sport). Il reste des chantiers de contenu non bloquants (instructions d'exercices, démos vidéo, enrichissements progressifs) qui s'ajoutent sans refonte.

**Prêt pour le développement.** Claude Code peut démarrer par les Phases 0 et 1.

## Principes non négociables (rappel transverse)

- **Architecture en couches** : UI → hooks → domaine → data. Aucune logique métier hors du domaine.
- **Local-first** : l'app fonctionne sans réseau ; la synchro est une couche par-dessus.
- **Sécurité de l'utilisateur** : garde-fous de santé prouvés par les tests ; ton bienveillant ; validation santé externe avant prod.
- **Séparation chiffres / texte** : les nombres viennent des formules, jamais du contenu rédigé.
- **Tests en même temps que le code** : domaine visé à ~100 % de couverture.

## Points à trancher avant la prod

- Nom du produit et identité visuelle.
- Revalidation des seuils de sécurité et messages sensibles par un professionnel de santé.
- Conseil juridique sur la licence ODbL d'Open Food Facts (share-alike) au regard d'un futur usage commercial.
- Vérification des valeurs nutritionnelles (recettes/ingrédients) avec la base Ciqual (France).
