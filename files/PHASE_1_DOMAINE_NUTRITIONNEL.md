# Phase 1 — Domaine nutritionnel (spécification détaillée)

> **Complément du document `PLAN_IMPLEMENTATION.md`, section 13, Phase 1.**
> **Destiné à :** Claude Code.
> **Nature :** Code TypeScript pur, sans React, sans réseau, sans SQLite. 100 % testable en isolation.
> **Objectif :** produire un moteur de calcul nutritionnel fiable, sûr et prouvé par les tests, sur lequel toutes les phases suivantes s'appuieront.

---

## 1. Périmètre et principes

### 1.1 Ce que fait cette phase

Implémenter, dans `src/domain/`, toute la logique de calcul liée à la nutrition :
- le modèle `UserProfile` (types partagés) ;
- le calcul du métabolisme de base (BMR) ;
- le calcul de la dépense énergétique totale (TDEE) ;
- le calcul de l'objectif calorique selon l'objectif de l'utilisateur ;
- la répartition des macronutriments ;
- l'estimation de la dépense sportive (METs) ;
- les deux modes de gestion des calories sport ;
- **et surtout les garde-fous de sécurité** qui encadrent tout ce qui précède.

### 1.2 Ce qu'elle ne fait pas

Aucune UI, aucune persistance, aucun appel réseau. Ces fonctions reçoivent des données en entrée et renvoient des résultats. Elles ne savent pas d'où viennent les données ni où vont les résultats.

### 1.3 Principes de code

- **Fonctions pures** : mêmes entrées → mêmes sorties, aucun effet de bord.
- **Immutabilité** : ne jamais muter les entrées.
- **Types stricts** : `strict: true` dans TypeScript. Pas de `any`.
- **Unités explicites dans les noms** : `weightKg`, `heightCm`, `durationMin`, `energyKcal`. Jamais de nombre "nu" ambigu.
- **Toute valeur de référence est une constante nommée et commentée avec sa source**, jamais un nombre magique inséré dans une formule.
- **Chaque fonction publique a un bloc de tests** couvrant cas nominaux, cas limites et déclenchement des garde-fous.

---

## 2. Le modèle UserProfile

Fichier : `src/domain/profile/types.ts`. C'est la colonne vertébrale de l'app. Défini une seule fois, importé partout.

### 2.1 Types de base

```
type Sex = 'male' | 'female';
// Nécessaire à Mifflin-St Jeor. Voir note d'éthique en §7 : ce champ
// modélise la biologie pour le calcul métabolique, distincte de l'identité de genre.

type GoalType = 'weight_loss' | 'recomposition' | 'maintenance';

type ActivityLevel =
  | 'sedentary'
  | 'lightly_active'
  | 'moderately_active'
  | 'very_active'
  | 'extremely_active';

type CalorieMode = 'fixed' | 'credited'; // défaut: 'fixed'

type DietType =
  | 'omnivore'
  | 'flexitarian'
  | 'pescatarian'
  | 'vegetarian'
  | 'vegan';
```

### 2.2 UserProfile

```
interface UserProfile {
  // Biométrie
  sex: Sex;
  birthDate: string;          // ISO 8601 ; l'âge est dérivé, jamais stocké figé
  heightCm: number;
  currentWeightKg: number;

  // Objectif
  goalType: GoalType;
  targetWeightKg?: number;
  weeklyRateKg?: number;      // rythme visé ; BORNÉ par les garde-fous (§5)

  // Activité & sport
  activityLevel: ActivityLevel;
  trainingDaysPerWeek: number;

  // Alimentation (utilisé surtout en phases ultérieures ; présent ici pour cohérence)
  dietType: DietType;
  allergies: string[];
  dislikes: string[];

  // Réglages
  calorieMode: CalorieMode;   // défaut 'fixed'

  // Métadonnées
  onboardingCompleted: boolean;
}
```

> **Note :** l'âge se calcule à partir de `birthDate` via une fonction utilitaire `getAge(birthDate, now)`. Ne jamais stocker l'âge comme un nombre figé (il devient faux avec le temps).

---

## 3. Calcul du métabolisme de base (BMR)

Fichier : `src/domain/nutrition/energy.ts`.

### 3.1 Formule — Mifflin-St Jeor

Formule retenue pour sa précision reconnue sur la population générale.

```
BMR (homme)  = 10 × poidsKg + 6.25 × tailleCm − 5 × âge + 5
BMR (femme)  = 10 × poidsKg + 6.25 × tailleCm − 5 × âge − 161
```

### 3.2 Implémentation attendue

```
function calculateBmr(input: {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  ageYears: number;
}): number
```

- Valide les entrées (poids/taille/âge strictement positifs et dans des plages physiologiques plausibles — sinon lève une erreur typée `InvalidBiometricsError`).
- Renvoie le BMR en kcal/jour, arrondi à l'entier.

### 3.3 Cas de test

- Valeurs de référence connues (ex. homme 80 kg / 180 cm / 30 ans → vérifier le résultat exact).
- Femme équivalente (écart de 166 kcal attendu par construction de la formule).
- Entrées invalides (poids négatif, taille nulle) → erreur.

---

## 4. Dépense énergétique totale (TDEE)

Fichier : `src/domain/nutrition/energy.ts`.

### 4.1 Facteurs d'activité

Constantes nommées, valeurs de référence standard :

```
const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary:          1.2,
  lightly_active:     1.375,
  moderately_active:  1.55,
  very_active:        1.725,
  extremely_active:   1.9,
};
```

> Ces facteurs **intègrent déjà l'activité physique habituelle**, y compris l'entraînement régulier. C'est le fondement du mode `fixed` : le sport ponctuel n'a pas à être re-crédité puisqu'il est déjà pris en compte dans le facteur.

### 4.2 Implémentation

```
function calculateTdee(bmr: number, activityLevel: ActivityLevel): number
```

Renvoie `bmr × facteur`, arrondi à l'entier.

---

## 5. Objectif calorique — LE CŒUR DES GARDE-FOUS

Fichier : `src/domain/nutrition/energy.ts` (calcul) + `src/domain/nutrition/safety.ts` (garde-fous).

> ⚠️ **C'est la partie la plus sensible de toute l'application.** Un objectif calorique dangereux peut nuire à la santé de l'utilisateur. Les garde-fous ci-dessous ne sont pas optionnels et doivent être couverts par des tests exhaustifs. Ils s'appliquent **avant** tout affichage à l'utilisateur.

### 5.1 Constantes de sécurité (sourcées)

```
// Planchers caloriques absolus, hors supervision médicale.
// Source : guidelines cliniques obésité (protocoles reprenant les
// 2013 Obesity Guidelines) — minimum prescrit 1200 kcal/j (femmes),
// 1500 kcal/j (hommes). En dessous = diète très basses calories (VLCD),
// réservée au cadre médical supervisé.
const MIN_DAILY_KCAL_FEMALE = 1200;
const MIN_DAILY_KCAL_MALE   = 1500;

// Déficit quotidien : plage sûre reconnue.
// Source : Harvard Health (500–750 kcal/j) et consensus clinique
// (300–500 kcal/j pour un déficit modéré préservant la masse maigre).
const MAX_DAILY_DEFICIT_KCAL = 750;

// Rythme de perte : plafond de sécurité.
// Source : littérature composition corporelle (MacroFactor / Murphy &
// Koehler 2021 ; études athlètes) — au-delà de ~1 %/semaine du poids
// corporel, la perte de masse maigre s'accélère nettement.
// 0,5–1 %/semaine est la fourchette recommandée par défaut.
const MAX_WEEKLY_RATE_FRACTION = 0.01;   // 1 % du poids corporel / semaine
const DEFAULT_WEEKLY_RATE_FRACTION = 0.0075; // 0,75 %/sem, bon compromis fat loss / muscle

// Équivalence énergétique : 1 kg de masse grasse ≈ 7700 kcal.
const KCAL_PER_KG_FAT = 7700;

// Seuils d'IMC pour les garde-fous de poids cible.
const BMI_UNDERWEIGHT_THRESHOLD = 18.5;
```

### 5.2 Logique de calcul de l'objectif

```
function calculateCalorieTarget(profile: UserProfile): CalorieTargetResult
```

Étapes, dans l'ordre :

1. Calculer l'âge, le BMR, le TDEE.
2. Si `goalType === 'maintenance'` → objectif = TDEE. Fin.
3. Si `goalType === 'recomposition'` → objectif ≈ TDEE (déficit léger optionnel, 0 à −200 kcal). Priorité mise sur les protéines et l'entraînement (voir §6). Fin.
4. Si `goalType === 'weight_loss'` :
   a. Déterminer le rythme visé : `weeklyRateKg` s'il est fourni, sinon défaut = `currentWeightKg × DEFAULT_WEEKLY_RATE_FRACTION`.
   b. **Plafonner** le rythme à `currentWeightKg × MAX_WEEKLY_RATE_FRACTION`.
   c. Traduire en déficit quotidien : `deficit = rythmeKg × KCAL_PER_KG_FAT / 7`.
   d. **Plafonner** le déficit à `MAX_DAILY_DEFICIT_KCAL`.
   e. Objectif brut = `TDEE − deficit`.
   f. **Appliquer le plancher calorique** selon le sexe : si l'objectif brut passe sous le plancher, l'objectif est ramené au plancher (et le rythme réel affiché est recalculé en conséquence, plus lent).

### 5.3 Type de retour (transparent et pédagogique)

Le résultat ne doit jamais être un simple nombre : il doit porter l'information nécessaire pour **expliquer** à l'utilisateur, et signaler tout garde-fou déclenché.

```
interface CalorieTargetResult {
  targetKcal: number;
  tdeeKcal: number;
  bmrKcal: number;
  appliedDeficitKcal: number;
  effectiveWeeklyRateKg: number;   // rythme réel après application des bornes
  adjustments: SafetyAdjustment[]; // liste des garde-fous déclenchés
  warnings: SafetyWarning[];       // messages à remonter à l'utilisateur
}

type SafetyAdjustment =
  | 'rate_capped'          // rythme demandé trop rapide, plafonné
  | 'deficit_capped'       // déficit plafonné
  | 'floor_applied';       // plancher calorique appliqué

type SafetyWarning =
  | 'target_below_healthy_floor'   // l'objectif souhaité était sous le plancher
  | 'goal_leads_to_underweight'    // le poids cible mène à un IMC < 18.5
  | 'aggressive_rate_requested';   // rythme > 1 %/sem demandé
```

> **Règle d'UI (pour les phases suivantes, à documenter ici) :** chaque `adjustment` et `warning` doit se traduire par un message clair et bienveillant à l'écran. Jamais un ajustement silencieux — l'utilisateur doit comprendre pourquoi ses chiffres ont été bornés.

### 5.4 Garde-fou sur le poids cible

```
function checkTargetWeightSafety(profile: UserProfile): SafetyWarning[]
```

- Calculer l'IMC correspondant au `targetWeightKg`.
- Si cet IMC est `< BMI_UNDERWEIGHT_THRESHOLD` → renvoyer `goal_leads_to_underweight`.
- Dans ce cas, la couche UI (phase ultérieure) **ne doit pas encourager** l'objectif : afficher un message bienveillant, ne pas gamifier, et orienter vers un professionnel de santé. Le moteur se contente de lever le drapeau ; il ne bloque pas brutalement mais signale.

### 5.5 Détection de signaux à risque

```
function detectRiskSignals(history: GoalChangeEvent[]): RiskSignal[]
```

- Entrée : historique des objectifs définis par l'utilisateur (fourni par les phases ultérieures ; ici on définit la fonction et ses types).
- Signale les schémas préoccupants : objectifs répétés sous le plancher, poids cible très bas révisé à la baisse plusieurs fois, rythme systématiquement poussé au maximum.
- Sortie : signaux qui déclencheront, en UI, un message bienveillant et des ressources d'aide — **jamais** un renforcement de l'objectif.
- En Phase 1, implémenter la logique pure et ses tests ; le branchement UI viendra plus tard.

### 5.6 Cas de test impératifs

- Utilisateur demandant 2 kg/semaine → `rate_capped` + `deficit_capped`, rythme effectif ramené sous la borne.
- Petite femme sédentaire dont le calcul tombe sous 1200 kcal → `floor_applied`, objectif = 1200, rythme effectif recalculé.
- Homme dont le calcul tombe sous 1500 → `floor_applied` à 1500.
- Poids cible menant à IMC 17 → `goal_leads_to_underweight`.
- Objectif maintenance → objectif = TDEE, aucun ajustement.
- Recomposition → objectif proche du TDEE, protéines élevées (vérifié via §6).
- Vérifier qu'**aucun** chemin de calcul ne peut produire un objectif sous le plancher.

---

## 6. Répartition des macronutriments

Fichier : `src/domain/nutrition/macros.ts`.

### 6.1 Principes (sourcés)

- **Protéines** : élevées en déficit et en recomposition pour préserver la masse maigre. Fourchette 1.6–2.2 g/kg de poids corporel. Source : littérature sur la préservation de la masse maigre en déficit (apport protéique élevé + entraînement en résistance préservent le muscle). Défaut retenu : **1.8 g/kg** en perte de poids, **2.0 g/kg** en recomposition.
- **Lipides** : plancher santé ~0.8 g/kg (jamais en dessous, rôle hormonal et vitamines liposolubles).
- **Glucides** : le reste des calories disponibles après protéines et lipides.

### 6.2 Implémentation

```
function calculateMacros(input: {
  targetKcal: number;
  weightKg: number;
  goalType: GoalType;
}): MacroResult

interface MacroResult {
  proteinG: number;
  fatG: number;
  carbsG: number;
  // cohérence garantie : 4×prot + 9×lip + 4×gluc ≈ targetKcal (± arrondi)
}
```

- Densités énergétiques : protéines 4 kcal/g, glucides 4 kcal/g, lipides 9 kcal/g.
- Ordre de calcul : protéines (par g/kg) → lipides (plancher puis ajustement) → glucides (reste).
- **Garde-fou de cohérence** : si après protéines + lipides plancher il ne reste pas assez pour des glucides positifs (cas d'objectif calorique très bas), réduire proportionnellement sans jamais passer sous le plancher lipidique santé, et signaler. Aucun macro ne peut être négatif.

### 6.3 Cas de test

- Somme des macros reconvertie en kcal = objectif (à l'arrondi près).
- Protéines conformes au g/kg attendu selon l'objectif.
- Lipides jamais sous le plancher.
- Objectif calorique très bas → répartition cohérente, aucun macro négatif, drapeau levé.

---

## 7. Dépense sportive (METs) et modes de calories

Fichier : `src/domain/nutrition/calories-sport.ts`.

### 7.1 Estimation par METs

```
kcal = MET × poidsKg × duréeHeures
```

Table de METs (constantes nommées, valeurs de référence type Compendium of Physical Activities) pour marche (selon allure), course (selon allure), vélo (selon intensité).

```
function estimateCardioKcal(input: {
  activity: 'walking' | 'running' | 'cycling';
  metValue: number;      // résolu depuis la table selon allure/intensité
  weightKg: number;
  durationMin: number;
}): number
```

> Ces estimations sont **indicatives et tendent à surestimer** la dépense réelle. C'est précisément la justification du mode par défaut `fixed`.

### 7.2 Les deux modes

```
function applyCalorieMode(input: {
  mode: CalorieMode;
  targetKcal: number;
  exerciseKcal: number;
}): { effectiveBudgetKcal: number; explanation: ExplanationKey }
```

- **`fixed` (défaut)** : `effectiveBudgetKcal = targetKcal`. Le sport est enregistré/affiché mais n'augmente pas le budget. `explanation = 'fixed_mode'`.
- **`credited`** : `effectiveBudgetKcal = targetKcal + exerciseKcal`. `explanation = 'credited_mode'`.
- Les deux vues (avec/sans crédit) doivent rester calculables simultanément pour l'affichage transparent prévu en UI.

### 7.3 Cas de test

- Mode `fixed` : budget inchangé quel que soit `exerciseKcal`.
- Mode `credited` : budget augmenté du montant exact.
- METs : valeurs de référence (ex. course à allure modérée, poids donné, durée donnée → résultat attendu).

---

## 8. Recalcul adaptatif

Fichier : `src/domain/nutrition/energy.ts`.

- Fonction pure qui, à partir d'un nouveau poids, recalcule BMR/TDEE/objectif.
- Renvoie l'ancien et le nouveau jeu de valeurs + un indicateur `shouldNotifyUser` (déclenché seulement si l'écart dépasse un seuil significatif, pour éviter les micro-ajustements anxiogènes).
- La couche UI (plus tard) expliquera l'ajustement ; le domaine fournit les données du message.

---

## 9. Note d'éthique sur le champ `sex`

Le champ `sex` sert **exclusivement** au calcul métabolique (Mifflin-St Jeor et facteurs biologiques sont établis sur le sexe biologique). Il modélise la biologie, distincte de l'identité de genre. À documenter clairement côté UI le moment venu, avec une formulation respectueuse. En Phase 1, on se limite au type et à son usage dans les formules.

---

## 10. Structure de fichiers livrée par la Phase 1

```
src/domain/
  profile/
    types.ts              # UserProfile, enums, types partagés
    age.ts                # getAge(birthDate, now)
    bmi.ts                # calcul IMC + classification
  nutrition/
    energy.ts             # BMR, TDEE, objectif, recalcul adaptatif
    macros.ts             # répartition macronutriments
    calories-sport.ts     # METs + modes fixed/credited
    safety.ts             # constantes de sécurité + garde-fous
    mets-table.ts         # table de référence METs
tests/unit/
  nutrition/
    energy.test.ts
    macros.test.ts
    calories-sport.test.ts
    safety.test.ts        # LE plus fourni : tous les garde-fous
  profile/
    age.test.ts
    bmi.test.ts
```

---

## 11. Définition de "terminé" pour la Phase 1

- [ ] Tous les fichiers ci-dessus créés, TypeScript strict, zéro `any`.
- [ ] Toutes les fonctions publiques testées (cas nominaux + limites + erreurs).
- [ ] **Tous les garde-fous de sécurité couverts par des tests dédiés**, avec la preuve qu'aucun chemin ne produit un objectif dangereux.
- [ ] Toutes les constantes de référence commentées avec leur source.
- [ ] Aucune dépendance à React, au réseau ou à SQLite dans `src/domain/`.
- [ ] Couverture de test du dossier `domain/nutrition/` proche de 100 %.
- [ ] Lint + typecheck verts.

---

## 12. Rappel : sources des seuils de sécurité

- **Planchers 1200 kcal (femmes) / 1500 kcal (hommes)** : protocoles cliniques reprenant les Obesity Guidelines ; en dessous relève de la diète très basses calories sous supervision médicale.
- **Déficit 300–750 kcal/jour** : Harvard Health et consensus clinique pour un déficit modéré préservant la masse maigre.
- **Rythme ≤ 1 %/semaine du poids corporel** : littérature composition corporelle ; au-delà, accélération de la perte de masse maigre. 0,5–1 %/semaine recommandé, 0,75 % retenu par défaut.
- **Protéines 1.6–2.2 g/kg** : études sur la préservation de la masse maigre en déficit combinée à l'entraînement en résistance.
- **IMC 18.5** : seuil standard d'insuffisance pondérale.

> Ces valeurs devront être revalidées avec un professionnel de santé avant mise en production, comme prévu au document principal (section 15).

*Fin de la spécification Phase 1.*
