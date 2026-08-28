# Prompt de démarrage — Pour Claude Code

> **À lire en premier par Claude Code.** Ce document explique comment aborder le dossier de planification et construire l'application. Il ne remplace pas les specs : il dit comment les utiliser.

---

## 1. Ce que tu construis

Une application mobile (iOS + Android) d'accompagnement à la perte de poids et à la recomposition corporelle. Elle combine suivi calorique, conseils personnalisés fondés sur la science, recettes adaptées et accompagnement sportif. Le détail est dans les documents de spécification (voir §3).

Positionnement : **sobre, personnalisé, scientifiquement défendable, respectueux de l'utilisateur.**

## 2. Règles non négociables

Avant d'écrire la moindre ligne, intègre ces principes. Ils priment sur la vitesse de livraison.

1. **Architecture en couches.** UI → hooks → domaine → data. Les dépendances pointent vers le bas. Aucune logique métier hors de `src/domain/`. Aucun appel réseau ou SQLite depuis l'UI.
2. **Local-first.** L'app fonctionne sans réseau. La synchro serveur (Phase 9) est une couche par-dessus, jamais un prérequis à l'usage.
3. **Sécurité de l'utilisateur.** Les garde-fous de santé (planchers caloriques, plafond de rythme, IMC, détection de signaux à risque) sont dans le domaine, prouvés par des tests, et ne peuvent jamais être contournés. C'est la partie la plus sensible de l'app.
4. **Séparation chiffres / texte.** Les nombres (calories, macros, dépense) viennent des formules. Le contenu rédigé (conseils, recettes) ne contient jamais de chiffre calculé en dur.
5. **Tests en même temps que le code.** Le domaine vise ~100 % de couverture. Une phase n'est pas terminée sans ses tests verts.
6. **TypeScript strict, zéro `any`.** Types partagés définis une seule fois (le `UserProfile` est la colonne vertébrale).

## 3. Ordre de lecture des documents

1. `INDEX.md` — la carte du dossier.
2. `PLAN_IMPLEMENTATION.md` — vision, stack, architecture, modèle de données, plan phasé. **Le document maître.**
3. `PHASE_1_DOMAINE_NUTRITIONNEL.md` — la spec la plus détaillée, à traiter en premier après les fondations.
4. `PHASES_2_A_5.md` et `PHASES_6_A_10.md` — les phases suivantes.
5. Documents de contenu et de données (à intégrer quand la phase concernée arrive) :
   - `BRIEF_BRIQUES_CONSEIL.md` + `BRIQUES_CONSEIL_REDIGEES.md` → Phase 6.
   - `BRIEF_RECETTES.md` + `RECETTES_REDIGEES.md` → Phase 7.
   - `DONNEES_SPORT.md` → Phase 8 (et §7 METs pour la Phase 1).

## 4. Comment exécuter

- **Suis les phases dans l'ordre**, de la Phase 0 à la Phase 10. Chaque phase a une « Définition de terminé » : traite-la comme une checklist de sortie.
- **Ne saute pas de phase.** Chacune pose des fondations utilisées par les suivantes.
- Au début de chaque phase, relis sa spec en entier avant de coder.
- **Commence par la Phase 0** (init Expo, TypeScript strict, Expo Router, structure de dossiers, ESLint/Prettier/Husky, CI, Sentry/PostHog câblés à vide). Puis **Phase 1** (domaine nutritionnel pur — c'est là que se joue la sécurité).

## 5. Ce qui est déjà fourni (ne pas réinventer)

- **Formules et seuils de sécurité** : dans `PHASE_1_...md`, sourcés. Utilise ces valeurs exactes.
- **Structure du moteur de conseils** (types, tags, conditions) + **25 briques rédigées** : prêtes à intégrer en Phase 6.
- **Catalogue de 22 recettes** + table d'ingrédients : prêts en Phase 7. Respecte l'état cru/cuit des ingrédients dans le calcul nutritionnel.
- **Table METs** (sourcée) + **noyau de ~30 exercices** + structures de programmes : prêts en Phase 8.

## 6. Ce qui reste à produire (chantiers de contenu, non bloquants)

- Instructions d'exécution (`instructions[]`) de chaque exercice.
- Démos vidéo des exercices (`mediaUrl`).
- Extension progressive des briques, recettes et exercices.

Ces éléments s'ajoutent sans refonte grâce à l'architecture par données taggées. N'attends pas qu'ils soient complets pour avancer : utilise ce qui est fourni comme socle.

## 7. Points de vigilance signalés dans les specs

- **Open Food Facts** : User-Agent obligatoire, rate-limits, licence ODbL (attribution + share-alike), pas de full-text en API v2 (passer par Search-a-licious). Détail en Phase 4.
- **Valeurs nutritionnelles** des recettes/ingrédients : à revérifier avec une base officielle (Ciqual pour la France) à l'intégration.
- **Validation santé** : les seuils de sécurité et les messages sensibles doivent être revalidés par un professionnel de santé avant la prod (hors de ton périmètre de code, mais à ne pas oublier — signale-le comme prérequis de mise en production).

## 8. Quand tu bloques ou hésites

- Privilégie **la simplicité et la lisibilité** sur l'astuce. Ce code sera maintenu et étendu.
- En cas d'ambiguïté dans une spec, choisis l'option la plus sûre pour l'utilisateur et la plus cohérente avec l'architecture, et signale ton hypothèse.
- Ne prends jamais de raccourci sur les garde-fous de sécurité ou la séparation des couches, même « temporairement ».

*Bon build.*
