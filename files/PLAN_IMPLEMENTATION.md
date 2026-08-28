# Plan d'implémentation — Application mobile d'accompagnement à la perte de poids

> **Nom de code du projet :** *(à définir)*
> **Document destiné à :** Claude Code (implémentation phasée)
> **Version du plan :** 1.0
> **Nature :** Application mobile iOS + Android, greenfield.

---

## 0. Comment utiliser ce document

Ce document est le cahier de référence unique pour l'implémentation. Il est organisé pour être exécuté **de haut en bas, phase par phase**. Chaque phase est livrable et testable indépendamment.

Règles pour l'agent d'implémentation :

1. **Ne pas sauter de phase.** Chaque phase pose des fondations utilisées par les suivantes.
2. **Écrire les tests en même temps que le code**, pas après. Aucune phase n'est "terminée" sans ses tests verts.
3. **Respecter l'architecture en couches** décrite en section 3. Aucune logique métier dans les composants d'UI, aucun appel réseau direct depuis l'UI.
4. En cas d'ambiguïté, privilégier la **simplicité et la lisibilité** sur l'astuce technique. Ce code sera maintenu et étendu.
5. **Aucune donnée de santé ne quitte l'appareil sans consentement explicite.** Voir section 11.

---

## 1. Vision produit

### 1.1 Le problème

La plupart des applications de suivi (type MyFitnessPal) se contentent de **compter** : elles enregistrent ce que l'utilisateur mange et brûle, mais ne lui disent pas **comment atteindre son objectif**. L'utilisateur reste seul face à ses données.

### 1.2 La proposition de valeur

Une application qui **accompagne et conseille** : suivi calorique rigoureux **+** conseils personnalisés fondés sur la science **+** idées de recettes adaptées aux goûts et régimes **+** cadre d'entraînement adapté au sport et aux moyens de chacun.

Positionnement : **sobre, efficace, personnalisé, scientifiquement défendable.** Pas un coach bavard, pas un gadget ludique — un outil sérieux qui respecte l'intelligence de l'utilisateur.

### 1.3 Utilisateurs cibles

Personnes actives cherchant à perdre du poids et/ou à faire une recomposition corporelle, avec des moyens et objectifs variés :
- Certains vont en salle, d'autres s'entraînent à la maison.
- Certains font du cardio (marche, course, vélo), d'autres de la musculation, souvent un mix.
- Chacun a ses préférences alimentaires et ses contraintes (régime, allergies, temps de préparation).

L'app doit **s'adapter à la personne**, jamais imposer un modèle unique.

### 1.4 Périmètre du V1 (ce qu'on construit maintenant)

- Onboarding avec questionnaire de profilage.
- Calcul scientifique des besoins (métabolisme, TDEE, objectif calorique, macros).
- Journal alimentaire avec BDD produits (Open Food Facts) + repas prédéfinis + aliments/recettes maison.
- Suivi du poids et de la progression.
- Moteur de conseils personnalisés (briques modulaires assemblées selon le profil).
- Idées de recettes filtrées par goûts et régime.
- Suivi sportif : musculation (salle + maison) et cardio (marche, course, vélo) avec estimation de dépense.
- Deux modes de gestion des calories sport (fixe / recrédité), défaut = fixe.

### 1.5 Hors périmètre V1 (prévu plus tard, l'architecture doit l'anticiper)

- Paiement / abonnement (freemium à concevoir plus tard).
- Synchronisation avec objets connectés (montres, balances Bluetooth).
- Fonctions sociales / communauté.
- Génération de contenu par IA (le V1 est 100 % déterministe et pré-rédigé).
- Bibliothèque d'exercices salle exhaustive (V1 = noyau solide, extension progressive).

### 1.6 Principes directeurs

- **Rigueur scientifique** : chaque chiffre vient d'une formule référencée, chaque conseil est validé.
- **Personnalisation sans complexité** : beaucoup de logique cachée, peu de friction visible.
- **Sobriété** : interface claire, pas de sur-gamification.
- **Sécurité de l'utilisateur** : garde-fous sur les objectifs dangereux (voir section 11).

---

## 2. Stack technique

### 2.1 Choix retenus

| Domaine | Choix | Justification |
|---|---|---|
| Framework mobile | **React Native + Expo** (SDK récent, workflow managed) | Une seule codebase iOS/Android, écosystème mature, OTA updates, time-to-market rapide. |
| Langage | **TypeScript** (strict) | Sûreté de type indispensable sur une app à logique métier dense. |
| Navigation | **Expo Router** (file-based) | Standard actuel, deep-linking natif, structure claire. |
| État serveur / cache | **TanStack Query** | Cache, invalidation, retry, offline — parfait pour l'API produits. |
| État client | **Zustand** | Léger, simple, sans boilerplate, pour l'état UI et session. |
| Base de données locale | **SQLite via `expo-sqlite` + Drizzle ORM** | Le journal doit fonctionner **offline**. Drizzle = typage fort et migrations. |
| Formulaires | **React Hook Form + Zod** | Validation typée, réutilisée côté logique métier. |
| Backend | **Supabase** (Postgres + Auth + Storage) | Auth clé en main, Postgres managé, RLS pour la sécurité, généreux en gratuit. À isoler derrière une couche d'accès (section 3) pour rester remplaçable. |
| Source données aliments | **Open Food Facts API** | Base ouverte, gratuite, large couverture des produits industriels. |
| Tests | **Jest + React Native Testing Library** ; **Maestro** pour l'E2E | Unitaire + intégration + parcours. |
| Qualité | **ESLint + Prettier + TypeScript strict + Husky** (pre-commit) | Garde-fous automatiques. |
| CI/CD | **EAS Build + EAS Submit** ; **GitHub Actions** pour lint/test | Build et soumission stores automatisés. |
| Suivi d'erreurs | **Sentry** | Indispensable en prod dès le lancement. |
| Analytics produit | **PostHog** (respectueux vie privée, self-host possible) | Comprendre l'usage sans compromettre la confidentialité. |

### 2.2 Notes d'architecture sur ces choix

- **Supabase est un détail d'implémentation, pas le cœur.** Tout accès passe par une couche `data/` abstraite (repositories). Si on change de backend un jour, on ne touche qu'à cette couche.
- **Le local-first est un principe, pas une option.** Le journal, le poids et le profil vivent d'abord en SQLite local ; la synchro serveur est une couche par-dessus. L'app doit être pleinement utilisable sans réseau.
- **Le moteur de conseils et les formules sont du code pur TypeScript**, sans dépendance à React ni au réseau : testables en isolation, réutilisables.

---

## 3. Architecture logicielle

### 3.1 Principe : architecture en couches

```
┌─────────────────────────────────────────────┐
│  UI (screens, components)                     │  ← présentation uniquement
├─────────────────────────────────────────────┤
│  Hooks / ViewModels (état, orchestration)     │  ← relie l'UI au domaine
├─────────────────────────────────────────────┤
│  Domain (logique métier pure, sans I/O)       │  ← formules, moteur de conseils, règles
├─────────────────────────────────────────────┤
│  Data (repositories, SQLite, API, Supabase)   │  ← accès aux données, abstrait
└─────────────────────────────────────────────┘
```

**Règle d'or : les dépendances pointent vers le bas.** Le domaine ne connaît ni React, ni SQLite, ni le réseau. L'UI ne parle jamais directement à la data — toujours via un hook.

### 3.2 Arborescence cible

```
src/
  app/                      # Expo Router : écrans et navigation
    (onboarding)/
    (tabs)/
      journal/
      recipes/
      training/
      progress/
      profile/
  components/               # composants d'UI réutilisables, "bêtes"
    ui/                     # design system (Button, Card, Input…)
    charts/
  domain/                   # LOGIQUE MÉTIER PURE — testée à 100 %
    nutrition/
      energy.ts             # Mifflin-St Jeor, TDEE, objectif calorique
      macros.ts             # répartition protéines/lipides/glucides
      calories-sport.ts     # modes fixe / recrédité, METs
    advice/
      engine.ts             # assemblage des briques de conseil
      rules.ts              # règles de sélection
      content/              # briques de contenu (voir section 7)
    training/
      programs.ts           # génération/sélection de programmes
      progression.ts        # règles de progression de charge
    recipes/
      filter.ts             # filtrage par goûts/régime/contraintes
    profile/
      types.ts              # le modèle utilisateur central
  data/                     # ACCÈS AUX DONNÉES — abstrait
    db/                     # SQLite + Drizzle (schémas, migrations)
    repositories/           # interface unique par entité
      profile.repo.ts
      food-log.repo.ts
      weight.repo.ts
      food.repo.ts
    remote/                 # Open Food Facts, Supabase
      openfoodfacts.ts
      supabase.ts
    sync/                   # logique de synchronisation local↔serveur
  hooks/                    # hooks qui relient UI et domaine/data
  lib/                      # utilitaires transverses (dates, formats, i18n)
  stores/                   # Zustand (session, préférences UI)
  theme/                    # tokens de design (couleurs, typo, espacements)
tests/
  unit/                     # domaine
  integration/              # repositories, hooks
  e2e/                      # Maestro
```

### 3.3 Conventions

- **Pas de logique métier hors de `domain/`.** Si un composant calcule des calories, c'est un bug d'architecture.
- **Un repository = une source de vérité pour une entité.** L'UI ne sait pas si la donnée vient du cache, de SQLite ou du réseau.
- **Types partagés** : le modèle `UserProfile` (section 4) est la colonne vertébrale, défini une seule fois dans `domain/profile/types.ts`.
- **Nommage explicite** en anglais dans le code ; le contenu utilisateur (conseils, recettes) est en français, séparé dans des fichiers de contenu.
- **Fonctions pures privilégiées** dans le domaine : entrée → sortie, pas d'effet de bord, faciles à tester.

---

## 4. Modèle de données

> Détaillé ici au niveau conceptuel. Les schémas Drizzle et les tables Supabase en découlent directement.

### 4.1 UserProfile (le cœur)

Le profil est l'entrée de presque tous les calculs. Champs :

- **Identité / biométrie** : `sex` (homme/femme — nécessaire pour Mifflin-St Jeor), `birthDate` (→ âge), `heightCm`, `currentWeightKg`.
- **Objectif** : `goalType` (perte de poids / recomposition / maintien), `targetWeightKg` (optionnel), `weeklyRateKg` (rythme visé, **borné** — voir section 11).
- **Activité** : `activityLevel` (sédentaire → très actif, mappé sur un facteur), `trainingDaysPerWeek`.
- **Sport pratiqué** : `sportProfile` (voir 4.4).
- **Alimentation** : `dietType` (omnivore, végétarien, végétalien, etc.), `allergies[]`, `dislikes[]`, `preferences[]`, `maxPrepTimeMin`, `cookingSkill`.
- **Réglages** : `calorieMode` (`fixed` par défaut | `credited`), `units` (métrique par défaut), `locale`.
- **Métadonnées** : `createdAt`, `updatedAt`, `onboardingCompleted`.

> ⚠️ `sex` et `birthDate` sont des données sensibles biométriques : voir section 11 pour le consentement et le stockage.

### 4.2 FoodItem (aliment)

- `id`, `source` (`off` = Open Food Facts | `custom` = maison), `barcode?`, `name`, `brand?`.
- Valeurs pour 100 g/ml : `kcal`, `proteinG`, `carbsG`, `fatG`, `fiberG?`, `sugarG?`, `saturatedFatG?`, `sodiumMg?`.
- `servingSizes[]` : portions usuelles (ex. "1 tranche = 30 g").
- `verified` : indicateur de fiabilité de la donnée (OFF est collaboratif — voir section 6).

### 4.3 Journal

- **FoodLogEntry** : `id`, `date`, `mealType` (petit-déj / déjeuner / dîner / collation), `foodItemId` ou `mealId`, `quantityG`, calculs figés au moment de l'ajout (pour l'historique).
- **Meal (repas prédéfini)** : `id`, `name`, `items[]` (aliment + quantité), totaux calculés.
- **WeightEntry** : `id`, `date`, `weightKg`, `note?`.
- **WorkoutLogEntry** : `id`, `date`, `type` (voir 4.4), détails, `estimatedKcalBurned`.

### 4.4 Sport — deux natures distinctes

C'est un point d'architecture important : **cardio et musculation ne se modélisent pas pareil.**

**A. Endurance / cardio** (marche, course, vélo) → on n'a pas de "séries". On a :
- `activity` (walking / running / cycling), `durationMin`, `intensity` ou `distanceKm`/`avgSpeed`.
- Dépense estimée via **METs** : `kcal = MET × poidsKg × durée(h)`. Table de METs référencée (Compendium of Physical Activities).
- Recommandations de progression : volume hebdo, zones d'intensité.

**B. Musculation / recomposition** (salle ou maison) → contenu structuré :
- `Exercise` : `id`, `name`, `muscleGroups[]`, `equipment` (`none`/`gym`), `difficulty`, `mediaUrl`, `instructions`.
- `Program` : découpage (full-body, split), fréquence, durée.
- `ProgramSession` → `ExerciseSet[]` : séries × répétitions × charge, règles de progression.

Les deux se rejoignent dans `WorkoutLogEntry` et alimentent le bilan énergétique du jour.

### 4.5 Contenu (conseils & recettes)

- **AdviceBlock** (brique de conseil) : `id`, `topic`, `tags` (critères de sélection), `title`, `body` (FR), `sources[]`. Voir section 7.
- **Recipe** : `id`, `name`, `tags` (régime, goûts, temps, difficulté), `ingredients[]`, `steps[]`, valeurs nutritionnelles calculées, `imageUrl`.

---

## 5. Science : formules et calculs

> Tout ce qui suit vit dans `domain/nutrition/`. **Aucun de ces chiffres n'est rédigé à la main : ils sont calculés.** Chaque formule est référencée pour la traçabilité "vraie science".

### 5.1 Métabolisme de base (BMR) — Mifflin-St Jeor

- Homme : `BMR = 10×poidsKg + 6.25×tailleCm − 5×âge + 5`
- Femme : `BMR = 10×poidsKg + 6.25×tailleCm − 5×âge − 161`

Choisie pour sa précision reconnue sur population générale.

### 5.2 Dépense énergétique totale (TDEE)

`TDEE = BMR × facteur d'activité`

Facteurs (à ajuster finement, valeurs de référence) :
- Sédentaire : 1.2
- Légèrement actif : 1.375
- Modérément actif : 1.55
- Très actif : 1.725
- Extrêmement actif : 1.9

> Le facteur d'activité **intègre déjà l'activité habituelle**. C'est la base du mode "objectif fixe" (le sport n'est pas re-crédité par défaut).

### 5.3 Objectif calorique

- Déficit pour perte de poids : `1 kg de graisse ≈ 7700 kcal`. Pour perdre `X kg/semaine` → déficit quotidien `= X × 7700 / 7`.
- **Bornes de sécurité impératives** (section 11) : ne jamais descendre sous un plancher (≈ 1200 kcal femme / 1500 kcal homme, à affiner), et plafonner le rythme à ~1 % du poids corporel par semaine.
- Recomposition : objectif proche du maintien, priorité aux protéines et à l'entraînement en résistance.

### 5.4 Répartition des macros

- **Protéines** : cible par kg de poids (ou de masse maigre estimée), typiquement 1.6–2.2 g/kg selon objectif — élevée en déficit pour préserver le muscle.
- **Lipides** : plancher santé (~0.6–0.8 g/kg) puis ajustement.
- **Glucides** : le reste des calories.
- Toujours produire un résultat cohérent (somme des macros = objectif calorique).

### 5.5 Dépense sportive — METs

Table de METs pour les activités cardio (marche selon allure, course selon allure, vélo selon intensité). `kcal = MET × poidsKg × durée_heures`.

> Ces estimations sont **affichées comme indicatives** et **surestiment souvent la réalité** : c'est précisément pourquoi le mode par défaut ne les recrédite pas.

### 5.6 Les deux modes de calories sport

- **Mode `fixed` (défaut)** : l'objectif calorique est fixe (issu du TDEE). Le sport est enregistré et affiché pour information/motivation mais **n'augmente pas le budget** du jour. Message pédagogique à l'appui.
- **Mode `credited`** : les calories estimées du sport **s'ajoutent** au budget du jour (modèle MyFitnessPal).
- L'utilisateur choisit dans les réglages ; l'app explique clairement les conséquences de chaque mode. L'UI affiche les deux vues (avec/sans crédit) pour transparence.

### 5.7 Recalcul adaptatif

Le TDEE et l'objectif se **recalculent** quand le poids évolue significativement, avec des messages qui expliquent l'ajustement (éviter l'effet "l'app a changé mes chiffres sans raison").

---

## 6. Intégration Open Food Facts

### 6.1 Usages

- **Recherche par nom** et **scan de code-barres** (via `expo-camera`).
- Récupération des valeurs nutritionnelles pour 100 g + portions.

### 6.2 Points de vigilance (traités dès la conception)

- **Qualité variable** : OFF est collaboratif ; données parfois incomplètes ou erronées, surtout hors produits industriels. → Afficher un indicateur de fiabilité ; permettre à l'utilisateur de **corriger/compléter** localement.
- **Complétude géographique** : forte sur l'Europe, plus faible ailleurs. → La couche "aliments maison" comble les trous.
- **Disponibilité réseau** : l'app doit marcher offline. → **Cache local systématique** de tout produit consulté (SQLite) via TanStack Query + persistance.
- **Respect des conditions d'usage** d'OFF (attribution, rate limits raisonnables). → Throttling et cache pour limiter les appels.

### 6.3 Couche d'abstraction

Toute la logique OFF est isolée dans `data/remote/openfoodfacts.ts` derrière une interface `FoodDataSource`. Si on ajoute une autre source (USDA, base maison) plus tard, on implémente la même interface.

---

## 7. Moteur de conseils personnalisés (le cœur de la valeur)

### 7.1 Principe : briques modulaires, pas combinaisons entières

Rédiger un texte par combinaison de réponses = explosion combinatoire ingérable. À la place :

1. Le **calcul chiffré** (calories, macros, rythme) vient des **formules** (section 5).
2. Le **contenu textuel** est découpé en **briques indépendantes** (`AdviceBlock`), chacune **taggée** par les critères où elle s'applique.
3. Le **moteur** (`domain/advice/engine.ts`) sélectionne et **assemble** les briques pertinentes selon le profil.

Résultat : exhaustivité perçue, volume de rédaction gérable, ajout d'un critère = ajout de briques sans rien casser.

### 7.2 Modèle d'une brique

```
AdviceBlock {
  id
  topic          # ex: "deficit", "proteines", "plateau", "sommeil", "hydratation"…
  tags           # critères de sélection (goalType, dietType, activityLevel, niveau, etc.)
  priority       # ordre d'affichage
  title
  body           # texte FR, pédagogique, sobre
  sources[]      # références scientifiques
  conditions     # règles logiques d'affichage (ex: afficher si plateau détecté)
}
```

### 7.3 Le moteur de sélection

- Entrée : `UserProfile` + état courant (progression, détection de plateau, etc.).
- Sortie : liste ordonnée de briques à afficher.
- Logique dans `rules.ts` : match des tags, résolution des conflits par priorité, dé-duplication par topic.
- **Déterministe et testable** : mêmes entrées → mêmes conseils, couvert par des tests.

### 7.4 Périmètre de contenu à rédiger (itératif)

Topics prioritaires : comprendre son déficit, l'importance des protéines, gérer un plateau, la faim et la satiété, l'hydratation, le sommeil et le poids, l'alcool, les week-ends/imprévus, la différence perte de poids vs perte de graisse, la reprise après écart. Chaque topic → plusieurs briques variées selon profil.

> Ce contenu se construit **progressivement**. L'architecture permet d'en ajouter en continu sans refonte.

---

## 8. Recettes

- Chaque `Recipe` est **taggée** (régime, goûts, temps de prépa, difficulté, macros dominantes).
- Le filtrage (`domain/recipes/filter.ts`) croise les tags avec le `UserProfile` : exclut allergènes et aliments détestés, respecte le `dietType`, ordonne par pertinence (préférences, temps dispo).
- Valeurs nutritionnelles calculées à partir des ingrédients, cohérentes avec le journal (on peut logger une recette directement).
- V1 : catalogue de recettes **pré-rédigées et validées** (pas de génération IA).

---

## 9. Suivi sportif

### 9.1 Cardio (marche, course, vélo)

- Saisie simple : activité + durée (+ distance/allure optionnelles).
- Estimation kcal via METs (section 5.5).
- Cadres de progression (volume hebdo, intensité) issus de briques de conseil dédiées.

### 9.2 Musculation (salle + maison)

- **V1 = noyau solide**, pas exhaustif : bibliothèque d'exercices couvrant les grands patterns (poussée, tirage, jambes, gainage) en versions `none` (maison) et `gym` (salle).
- Programmes structurés (full-body pour débutants, split pour intermédiaires) avec règles de progression (`progression.ts`).
- Journalisation des séances (séries/reps/charge), historique, progression visible.

### 9.3 Extension future

L'ajout d'exercices salle, de nouveaux sports ou d'équipements = **nouvelles données taggées**, sans changement d'architecture.

---

## 10. Parcours utilisateur

### 10.1 Onboarding (premier lancement)

Objectif : profiler suffisamment pour personnaliser, **sans lasser**. Progression par étapes courtes, une idée par écran.

1. Accueil + promesse de valeur (1 écran).
2. **Consentement données de santé** (section 11) — transparent, avant toute collecte biométrique.
3. Objectif (perte / recomposition / maintien).
4. Biométrie (sexe, âge, taille, poids) + poids cible optionnel.
5. Niveau d'activité + jours d'entraînement.
6. Sport(s) pratiqué(s) et moyens (salle/maison, cardio).
7. Alimentation (régime, allergies, aliments détestés, temps de prépa).
8. **Restitution** : l'app présente l'objectif calorique + macros calculés, **explique le pourquoi** (pédagogie), propose d'ajuster le rythme (dans les bornes de sécurité).
9. Entrée dans l'app.

### 10.2 Usage quotidien (le chemin critique)

- **Ouvrir → voir le tableau du jour** : budget calorique, consommé, restant, macros, poids du jour, conseil du moment.
- **Logger un repas** : recherche/scan → quantité → ajout (offline OK). Repas prédéfinis en 1 tap.
- **Logger le sport** (si pratiqué).
- **Consulter un conseil** contextualisé.
- **Peser** (suivi hebdo recommandé, courbe lissée pour éviter l'anxiété des fluctuations).

### 10.3 Boucles d'engagement (sobres, non manipulatrices)

- Courbe de progression lissée et encourageante.
- Conseils qui évoluent avec la situation (plateau détecté → brique dédiée).
- Recalcul adaptatif expliqué.
- **Pas** de streaks culpabilisants ni de notifications intrusives. Respect de l'utilisateur.

---

## 11. Sécurité, éthique et conformité

> Section non négociable. Une app de perte de poids touche à la santé mentale et physique.

### 11.1 Garde-fous sur les objectifs

- **Plancher calorique** : jamais d'objectif sous un seuil de sécurité (≈ 1200 kcal femme / 1500 kcal homme, à affiner avec sources).
- **Rythme plafonné** : ~1 % du poids corporel/semaine max ; bloquer les objectifs plus agressifs avec explication.
- **IMC** : si le calcul mène à un objectif menant vers l'insuffisance pondérale, **ne pas encourager**, afficher un message et rediriger vers un professionnel.
- **Détection de signaux de trouble alimentaire** (objectifs répétés extrêmes, poids cible très bas) → message bienveillant, ressources d'aide, jamais de renforcement.

### 11.2 Données de santé (RGPD — utilisateur en France/UE)

- Données biométriques = **données sensibles**. Consentement **explicite** avant collecte, base légale claire.
- **Local-first** : minimiser ce qui part sur le serveur ; chiffrer au repos les données sensibles locales.
- Droit à l'export et à la suppression (effacement complet du compte et des données).
- Politique de confidentialité claire, en français.
- RLS strict côté Supabase : un utilisateur n'accède qu'à ses données.

### 11.3 Positionnement légal

- L'app **ne fait pas de diagnostic médical** et l'affiche clairement (disclaimer). Elle informe et accompagne, elle ne remplace pas un professionnel de santé.
- Conformité aux règles des stores (Apple/Google ont des politiques spécifiques santé/fitness).

---

## 12. Tests et qualité

- **Domaine (formules, moteur de conseils, filtres) : couverture proche de 100 %.** C'est là qu'est le risque métier.
- **Repositories** : tests d'intégration (SQLite en mémoire, mocks réseau).
- **Hooks** : tests avec React Native Testing Library.
- **Parcours critiques** (onboarding, logger un repas, peser) : E2E Maestro.
- **Snapshot** raisonné sur le design system.
- Pre-commit : lint + typecheck + tests unitaires du domaine.
- CI (GitHub Actions) : lint + typecheck + tests sur chaque PR.

---

## 13. Plan d'implémentation phasé (l'ordre d'exécution)

> Chaque phase est un incrément livrable et testé. **Ne pas avancer tant que la phase n'est pas verte.**

### Phase 0 — Fondations projet
- Init Expo + TypeScript strict + Expo Router.
- ESLint/Prettier/Husky, structure de dossiers (section 3.2), theme/design tokens.
- CI GitHub Actions (lint + typecheck + test).
- Sentry + PostHog câblés (sans encore d'événements métier).
- **Livrable :** app vide qui build sur iOS + Android, pipeline vert.

### Phase 1 — Domaine nutritionnel (pur, sans UI)
- `domain/profile/types.ts` (le `UserProfile`).
- `domain/nutrition/` : BMR, TDEE, objectif, macros, METs, modes fixe/credité.
- **Garde-fous de sécurité** (section 11.1) codés et testés ici.
- Tests unitaires exhaustifs.
- **Livrable :** moteur de calcul fiable, prouvé par les tests. Aucune UI.

### Phase 2 — Couche data & persistance locale
- SQLite + Drizzle : schémas (profil, aliments, journal, poids, séances).
- Repositories avec interfaces claires.
- Store de session (Zustand).
- **Livrable :** on peut créer/lire un profil et des entrées en local, testé.

### Phase 3 — Onboarding
- Écrans d'onboarding (section 10.1), consentement inclus.
- Restitution pédagogique de l'objectif calculé.
- Persistance du profil.
- **Livrable :** un nouvel utilisateur crée son profil et obtient ses chiffres.

### Phase 4 — Journal alimentaire + Open Food Facts
- Intégration OFF (recherche + scan), cache local, indicateur de fiabilité.
- Aliments/recettes maison, repas prédéfinis.
- Écran journal + tableau du jour (budget/consommé/restant/macros).
- Offline-first vérifié.
- **Livrable :** le chemin critique quotidien fonctionne.

### Phase 5 — Suivi du poids & progression
- Saisie du poids, courbe lissée, recalcul adaptatif expliqué.
- **Livrable :** l'utilisateur suit sa progression sereinement.

### Phase 6 — Moteur de conseils
- `domain/advice/` : moteur + règles, premières briques de contenu (topics prioritaires §7.4).
- Affichage du conseil du jour + section conseils.
- **Livrable :** l'app conseille, pas seulement compte. (Le contenu s'enrichit ensuite en continu.)

### Phase 7 — Recettes
- Catalogue tagué + filtrage par profil, log direct d'une recette.
- **Livrable :** idées de recettes personnalisées.

### Phase 8 — Sport
- Cardio (saisie + METs) et musculation (bibliothèque noyau + programmes + journal de séance).
- Intégration au bilan énergétique selon le mode choisi.
- **Livrable :** accompagnement sportif adapté au profil.

### Phase 9 — Backend & synchronisation
- Supabase Auth + Postgres + RLS.
- Sync local↔serveur (résolution de conflits), sauvegarde/restauration.
- Export et suppression des données (RGPD).
- **Livrable :** comptes, multi-appareils, conformité.

### Phase 10 — Durcissement & mise en prod
- E2E Maestro sur les parcours critiques.
- Passe accessibilité, perf, revue sécurité/RGPD.
- Écrans légaux (confidentialité, disclaimer santé).
- EAS Build/Submit, préparation des fiches stores.
- **Livrable :** app prête pour les stores.

### Post-V1 (préparé par l'architecture, non implémenté maintenant)
Freemium/paiement, objets connectés, bibliothèque salle étendue, social, personnalisation IA.

---

## 14. Décisions actées (récapitulatif)

| Sujet | Décision |
|---|---|
| Plateformes | iOS + Android, une codebase |
| Stack | React Native + Expo + TypeScript |
| Données aliments | Open Food Facts (abstrait derrière une interface) |
| Conseils | Briques modulaires assemblées, 100 % pré-rédigées/déterministes (pas d'IA en V1) |
| Calculs | Formules scientifiques référencées (Mifflin-St Jeor, TDEE, METs) |
| Calories sport | Deux modes (fixe/recrédité), **défaut = fixe**, choix utilisateur |
| Sport V1 | Cardio (marche/course/vélo) + muscu (salle + maison), noyau extensible |
| Paiement | Hors V1 |
| Approche données | Local-first, RGPD, garde-fous de sécurité |

---

## 15. Points à préciser au fil de l'eau

- Nom du produit et identité visuelle.
- Valeurs exactes des planchers de sécurité (avec sources cliniques).
- Liste initiale précise des exercices du noyau muscu.
- Volume de recettes au lancement.
- Rédaction progressive des briques de conseil (chantier continu).

*Fin du document — v1.0*
