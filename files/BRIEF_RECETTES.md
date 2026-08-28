# Brief structurel — Catalogue de recettes (Phase 7)

> **Complément de `PHASES_6_A_10.md` (Phase 7).**
> **Double usage :**
> 1. Pour **Claude Code** : structure de données exacte (types stricts) et logique de filtrage.
> 2. Pour **toi (rédaction)** : la grille qui dit quelles recettes écrire, pour quel profil, et comment les équilibrer.
>
> Ce document définit **l'ossature et la stratégie de couverture**, pas les recettes finales. La rédaction suit ensuite.

---

## 1. Principes (à ne jamais enfreindre)

- **La nutrition est calculée depuis les ingrédients**, jamais saisie à la main. Chaque ingrédient porte ses valeurs pour 100 g ; le total de la recette en découle. Cohérence garantie avec le journal.
- **Exclusion des allergènes = règle dure de sécurité.** Une recette contenant un allergène du profil est retirée, sans exception, avant tout autre critère.
- **Respect du régime = règle dure.** Une recette non conforme au `dietType` de l'utilisateur ne lui est jamais proposée.
- **Les recettes sont des données**, dans `src/domain/recipes/content/` (ou synchronisées depuis le backend en Phase 9).
- **Contenu pré-rédigé et validé**, pas de génération IA en V1.

---

## 2. Les types (contrat pour Claude Code)

### 2.1 La recette

```
interface Recipe {
  id: string;
  name: string;
  mealTypes: MealType[];        // à quels moments elle convient
  dietTypes: DietType[];        // régimes COMPATIBLES (liste inclusive)
  allergens: Allergen[];        // allergènes présents (pour exclusion)
  tags: RecipeTag[];            // goûts, style, atout nutritionnel
  ingredients: RecipeIngredient[];
  steps: string[];              // étapes courtes, FR
  prepTimeMin: number;
  difficulty: 'easy' | 'medium' | 'hard';
  servings: number;             // nombre de portions de la recette
  // nutrition NON stockée : calculée depuis ingredients / servings
}

interface RecipeIngredient {
  ref: IngredientRef;           // référence à la table d'ingrédients (§4)
  quantityG: number;            // quantité en grammes (ou ml pour liquides)
  display?: string;             // texte affiché, ex: "2 œufs (100 g)"
}
```

### 2.2 Énumérations

```
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

// DietType est déjà défini en Phase 1 :
// 'omnivore' | 'flexitarian' | 'pescatarian' | 'vegetarian' | 'vegan'

type Allergen =
  | 'gluten' | 'dairy' | 'eggs' | 'nuts' | 'peanuts'
  | 'soy' | 'shellfish' | 'fish' | 'sesame';

type RecipeTag =
  // Atout nutritionnel
  | 'high_protein' | 'high_fiber' | 'low_calorie'
  // Style / praticité
  | 'quick' | 'batch_cook' | 'one_pan' | 'no_cook'
  // Goûts
  | 'sweet' | 'savory' | 'spicy' | 'comfort' | 'fresh';
```

> **Règle de cohérence régime :** `dietTypes` liste tous les régimes compatibles. Une recette végane est compatible avec tous les régimes (`vegan` inclut de fait `vegetarian`, `pescatarian`, etc. — mais on liste explicitement pour rester simple et sûr). Une recette avec poisson est compatible `pescatarian`, `flexitarian`, `omnivore` mais **pas** `vegetarian` ni `vegan`. Claude Code doit implémenter une fonction de validation qui vérifie que `dietTypes` est cohérent avec les ingrédients (un ingrédient viande interdit `vegetarian`).

---

## 3. Logique de filtrage (rappel + détail)

`filterRecipes({ recipes, profile })` dans `domain/recipes/filter.ts` :

1. **Exclure** toute recette dont un `allergen` figure dans `profile.allergies`. (sécurité, non négociable)
2. **Exclure** toute recette dont un ingrédient figure dans `profile.dislikes`.
3. **Exclure** toute recette dont `dietTypes` ne contient pas `profile.dietType`.
4. **Filtrer** par temps si l'utilisateur a une contrainte (`prepTimeMin` ≤ dispo).
5. **Ordonner** par pertinence :
   - bonus si la recette porte un tag aligné avec l'objectif (`high_protein` en perte/recomp, `low_calorie` en perte) ;
   - bonus si elle correspond à une préférence de goût de l'utilisateur ;
   - le `mealType` courant remonte les recettes adaptées au moment de la journée.
6. Fonction **pure**, testée. L'exclusion allergènes fait l'objet d'un test de sécurité dédié.

---

## 4. Table d'ingrédients de référence

Pour calculer la nutrition, chaque ingrédient utilisé doit exister dans une petite table de référence (valeurs pour 100 g). Cette table est un jeu de données partagé, réutilisable par le journal (aliments « maison »).

```
interface IngredientRef {
  id: string;               // ex: 'egg', 'chicken_breast', 'rolled_oats'
  name: string;             // FR
  per100g: {
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  };
  allergens: Allergen[];    // hérités par toute recette qui l'utilise
  dietExclusions: DietType[]; // régimes incompatibles (ex: viande exclut vegetarian/vegan)
}
```

> **Automatisation utile :** les `allergens` et l'incompatibilité régime d'une recette peuvent être **dérivés** de ses ingrédients plutôt que saisis à la main — plus sûr (pas d'oubli). Claude Code peut générer `recipe.allergens` = union des allergènes des ingrédients, et vérifier `dietTypes` contre les `dietExclusions`. On garde quand même les champs explicites sur la recette pour l'affichage et le contrôle.

La table initiale couvrira les ingrédients des recettes du socle (§5). Valeurs nutritionnelles issues de sources de référence standard (à vérifier à la rédaction).

---

## 5. Stratégie de couverture (la grille)

Objectif V1 : un socle qui garantit que **chaque profil de régime trouve de quoi manger à chaque repas**. On ne vise pas des centaines de recettes, mais une couverture équilibrée.

### 5.1 Matrice de couverture cible

Pour le socle V1, viser au minimum, par type de repas, une couverture de chaque régime. Cible indicative : **~20-24 recettes** au lancement, réparties ainsi :

| Meal type | Omnivore/Flexi | Pescatarian | Vegetarian | Vegan |
|---|---|---|---|---|
| Petit-déjeuner | ✓ | (souvent commun) | ✓ | ✓ |
| Déjeuner | ✓ | ✓ | ✓ | ✓ |
| Dîner | ✓ | ✓ | ✓ | ✓ |
| Collation | ✓ | (commun) | ✓ | ✓ |

> Beaucoup de recettes végétariennes/véganes couvrent aussi les profils omnivores (un omnivore peut manger végé). On maximise donc la réutilisation : privilégier des recettes végé/véganes savoureuses qui servent plusieurs profils, et ajouter des recettes avec viande/poisson là où c'est pertinent.

### 5.2 Équilibre nutritionnel du socle

- Au moins la moitié des recettes taguées `high_protein` (cohérent avec le positionnement perte/recomposition).
- Une bonne part de `quick` (≤ 20 min) et `no_cook` (praticité = adhérence).
- Quelques `batch_cook` (préparer en avance aide à tenir sur la durée).
- Varier les goûts (`sweet`/`savory`/`fresh`/`comfort`) pour ne pas lasser.

### 5.3 Grille de rédaction (socle initial proposé)

Chaque ligne = une recette à écrire. Colonnes : nom provisoire, repas, régimes compatibles, atout. **Tu rédiges ingrédients + étapes** à partir de cette intention.

| # | Nom provisoire | Repas | Régimes | Atout / intention |
|---|---|---|---|---|
| 1 | Bol de skyr, fruits rouges & flocons | petit-déj | végé (base laitière) | `high_protein`, `quick`, `sweet` — petit-déj protéiné express |
| 2 | Porridge protéiné banane-cannelle | petit-déj | végé ; véganisable | `high_fiber`, `comfort` — flocons + boisson + protéine |
| 3 | Toast avocat & œuf poché | petit-déj | végé | `savory`, `quick` — classique rassasiant |
| 4 | Overnight oats vanille (vegan) | petit-déj | vegan | `no_cook`, `batch_cook`, `high_fiber` — à préparer la veille |
| 5 | Omelette légumes & fromage | petit-déj/déj | végé | `high_protein`, `one_pan` — modulable selon légumes |
| 6 | Salade poulet grillé & quinoa | déjeuner | omni/flexi | `high_protein`, `fresh`, `batch_cook` — repas complet équilibré |
| 7 | Buddha bowl pois chiches rôtis | déjeuner | vegan | `high_protein`, `high_fiber` — végétal et rassasiant |
| 8 | Wrap thon & crudités | déjeuner | pesca/flexi/omni | `high_protein`, `quick` — rapide et nomade |
| 9 | Dahl de lentilles corail | déj/dîner | vegan | `high_protein`, `high_fiber`, `batch_cook`, `comfort` — économique, se réchauffe |
| 10 | Poêlée tofu, brocoli & riz | dîner | vegan | `high_protein`, `one_pan` — sauté rapide |
| 11 | Saumon, patate douce & épinards | dîner | pesca/flexi/omni | `high_protein` — oméga-3, complet |
| 12 | Poulet basquaise express | dîner | omni/flexi | `high_protein`, `one_pan` — mijoté simplifié |
| 13 | Chili sin carne | dîner | vegan | `high_protein`, `high_fiber`, `batch_cook`, `spicy` — grand volume, peu calorique |
| 14 | Curry de légumes & pois chiches | dîner | vegan | `high_fiber`, `comfort` — réconfortant, végétal |
| 15 | Cabillaud en papillote & légumes | dîner | pesca/flexi/omni | `low_calorie`, `high_protein` — léger et propre |
| 16 | Steak haché, haricots verts & pommes de terre | dîner | omni/flexi | `high_protein`, `comfort` — assiette classique équilibrée |
| 17 | Fromage blanc, miel & noix | collation | végé | `high_protein`, `no_cook`, `sweet` — collation protéinée |
| 18 | Houmous & bâtonnets de légumes | collation | vegan | `high_fiber`, `no_cook`, `savory` — à grignoter sainement |
| 19 | Pomme & beurre de cacahuète | collation | vegan | `no_cook`, `quick` — sucré-salé rassasiant (⚠ allergène cacahuète) |
| 20 | Smoothie protéiné vert | collation/petit-déj | véganisable | `high_protein`, `no_cook`, `fresh` — rapide, modulable |
| 21 | Œufs durs & crudités | collation | végé | `high_protein`, `no_cook` — simple et efficace |
| 22 | Yaourt grec, granola & fruits | collation/petit-déj | végé | `high_protein`, `sweet`, `quick` — gourmand mais équilibré |

> 22 recettes couvrant les 4 régimes non-omnivores et tous les repas. Extensible ensuite sans limite.

---

## 6. Règles de rédaction

- **Étapes courtes et numérotées**, verbe d'action en tête, pas de blabla.
- **Quantités en grammes** (ou ml) pour permettre le calcul nutritionnel ; le `display` peut ajouter la mesure ménagère (« 1 c. à soupe »).
- **Portions réalistes** : préciser `servings`, la nutrition est par portion.
- Rester dans des ingrédients **courants et accessibles** (pas d'ingrédient rare).
- Pas d'allégation santé exagérée. On décrit, on ne promet pas de miracle.

---

## 7. Ce qu'il reste à faire après ce brief

1. **Claude Code** implémente le type `Recipe`, la table `IngredientRef`, le filtrage, et la dérivation automatique allergènes/régime depuis les ingrédients.
2. **Toi (ou nous ensemble)** : rédiger ingrédients + étapes pour les ~22 recettes de la grille, en s'appuyant sur la table d'ingrédients.
3. Constituer la table d'ingrédients de référence (valeurs pour 100 g, sourcées).
4. Enrichir le catalogue au fil du temps (l'architecture le permet sans refonte).

---

## 8. Note sécurité & cohérence

- L'**exclusion allergènes** est la règle la plus critique de cette phase : test dédié, et dérivation automatique depuis les ingrédients pour éviter tout oubli humain.
- La table d'ingrédients étant partagée avec le journal, ses valeurs doivent être **fiables** : les sourcer à la rédaction.
- Attention à l'ingrédient cacahuète (recette 19) et fruits à coque (recette 17, 22) : bien taguer les allergènes.

*Fin du brief structurel du catalogue de recettes.*
