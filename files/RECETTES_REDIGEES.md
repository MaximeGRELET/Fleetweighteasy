# Catalogue de recettes — Contenu rédigé (V1)

> **Complément de `BRIEF_RECETTES.md`.** Contenu prêt à intégrer dans `src/domain/recipes/content/` et la table d'ingrédients partagée.
> **Rappel :** la nutrition de chaque recette est **calculée** par Claude Code depuis les ingrédients et la table ci-dessous, jamais saisie à la main.

---

## ⚠️ Note critique : cru vs cuit

Les valeurs nutritionnelles diffèrent selon que l'aliment est **cru** ou **cuit** (100 g de riz cru ≈ 130 kcal deviennent ~360 g de riz cuit ; les valeurs par 100 g cuit sont bien plus basses). **Chaque ingrédient de la table précise son état de référence.** Les quantités dans les recettes sont exprimées dans ce même état. Claude Code doit respecter cette cohérence état↔quantité dans le calcul. Valeurs issues de bases de type USDA (système Atwater : 4 kcal/g protéines et glucides, 9 kcal/g lipides) — **à revérifier finement à l'intégration**.

---

## 1. Table d'ingrédients de référence (partagée avec le journal)

Valeurs pour 100 g (ou 100 ml pour les liquides), dans l'état indiqué.

| id | nom (FR) | état | kcal | prot. | gluc. | lip. | allergènes | exclut régimes |
|---|---|---|---|---|---|---|---|---|
| `chicken_breast_raw` | Blanc de poulet | cru | 120 | 23 | 0 | 2.6 | — | vegetarian, vegan |
| `lean_beef_raw` | Bœuf haché 5% MG | cru | 137 | 21 | 0 | 5 | — | vegetarian, vegan |
| `salmon_raw` | Saumon | cru | 208 | 20 | 0 | 13 | fish | vegetarian, vegan |
| `cod_raw` | Cabillaud | cru | 82 | 18 | 0 | 0.7 | fish | vegetarian, vegan |
| `canned_tuna` | Thon au naturel (égoutté) | cuit | 116 | 26 | 0 | 1 | fish | vegetarian, vegan |
| `egg` | Œuf | cru | 143 | 13 | 0.7 | 10 | eggs | vegan |
| `greek_yogurt_0` | Yaourt grec 0% | — | 59 | 10 | 3.6 | 0.4 | dairy | vegan |
| `skyr` | Skyr nature | — | 63 | 11 | 4 | 0.2 | dairy | vegan |
| `fromage_blanc_0` | Fromage blanc 0% | — | 47 | 8 | 4 | 0.2 | dairy | vegan |
| `cheese_emmental` | Emmental | — | 380 | 28 | 0 | 29 | dairy | vegan |
| `milk_semi` | Lait demi-écrémé | — | 47 | 3.3 | 4.8 | 1.6 | dairy | vegan |
| `soy_milk` | Boisson soja nature | — | 43 | 3.3 | 1.8 | 1.8 | soy | — |
| `tofu_firm` | Tofu ferme | — | 144 | 17 | 3 | 8 | soy | — |
| `rolled_oats` | Flocons d'avoine | cru | 379 | 13 | 68 | 6.5 | gluten | — |
| `granola` | Granola | — | 470 | 10 | 64 | 18 | gluten, nuts | — |
| `white_rice_raw` | Riz blanc | cru | 360 | 7 | 79 | 0.6 | — | — |
| `quinoa_raw` | Quinoa | cru | 368 | 14 | 64 | 6 | — | — |
| `lentils_raw` | Lentilles corail/vertes | cru (sec) | 352 | 25 | 60 | 1 | — | — |
| `chickpeas_cooked` | Pois chiches (cuits/conserve) | cuit | 139 | 9 | 22 | 2.6 | — | — |
| `red_beans_cooked` | Haricots rouges (cuits/conserve) | cuit | 127 | 9 | 22 | 0.5 | — | — |
| `whole_wheat_wrap` | Galette de blé (wrap) | — | 297 | 9 | 49 | 7 | gluten | — |
| `bread_wholegrain` | Pain complet | — | 247 | 10 | 41 | 3.5 | gluten | — |
| `potato_raw` | Pomme de terre | cru | 77 | 2 | 17 | 0.1 | — | — |
| `sweet_potato_raw` | Patate douce | cru | 86 | 1.6 | 20 | 0.1 | — | — |
| `avocado` | Avocat | — | 160 | 2 | 9 | 15 | — | — |
| `banana` | Banane | — | 89 | 1.1 | 23 | 0.3 | — | — |
| `apple` | Pomme | — | 52 | 0.3 | 14 | 0.2 | — | — |
| `mixed_berries` | Fruits rouges | — | 43 | 1 | 10 | 0.3 | — | — |
| `spinach` | Épinards frais | — | 23 | 2.9 | 1.4 | 0.4 | — | — |
| `broccoli_raw` | Brocoli | cru | 34 | 2.8 | 7 | 0.4 | — | — |
| `green_beans` | Haricots verts | cuit | 35 | 1.9 | 7 | 0.2 | — | — |
| `bell_pepper` | Poivron | cru | 31 | 1 | 6 | 0.3 | — | — |
| `tomato` | Tomate | cru | 18 | 0.9 | 3.9 | 0.2 | — | — |
| `onion` | Oignon | cru | 40 | 1.1 | 9 | 0.1 | — | — |
| `carrot` | Carotte | cru | 41 | 0.9 | 10 | 0.2 | — | — |
| `cucumber` | Concombre | cru | 15 | 0.7 | 3.6 | 0.1 | — | — |
| `mixed_vegetables` | Légumes variés (mélange) | — | 40 | 2 | 8 | 0.3 | — | — |
| `coconut_milk` | Lait de coco | — | 197 | 2 | 3 | 20 | — | — |
| `olive_oil` | Huile d'olive | — | 884 | 0 | 0 | 100 | — | — |
| `peanut_butter` | Beurre de cacahuète | — | 588 | 25 | 20 | 50 | peanuts | — |
| `walnuts` | Noix | — | 654 | 15 | 14 | 65 | nuts | — |
| `honey` | Miel | — | 304 | 0.3 | 82 | 0 | — | — |
| `hummus` | Houmous | — | 166 | 8 | 14 | 10 | sesame | — |
| `protein_powder_whey` | Protéine whey | — | 400 | 80 | 8 | 6 | dairy | vegan |
| `protein_powder_pea` | Protéine de pois | — | 380 | 80 | 5 | 6 | — | — |
| `curry_spices` | Épices curry | — | 0 | 0 | 0 | 0 | — | — |
| `chia_seeds` | Graines de chia | — | 486 | 17 | 42 | 31 | — | — |

> Table volontairement limitée aux ingrédients des 22 recettes. À étendre au fil du catalogue. Les valeurs sont des ordres de grandeur de référence : **à confirmer à l'intégration** avec une base officielle (USDA / Ciqual pour la France).

---

## 2. Les 22 recettes

> Format : ingrédients (id + quantité en g/ml, dans l'état de la table) puis étapes. La nutrition par portion est calculée par le code. `servings` indiqué pour chaque recette.

### PETITS-DÉJEUNERS

#### 1. Bol de skyr, fruits rouges & flocons
- **id :** `skyr_berries_oats` · **repas :** breakfast · **régimes :** vegetarian, pescatarian, flexitarian, omnivore · **tags :** high_protein, quick, sweet · **difficulté :** easy · **temps :** 5 min · **portions :** 1
- **Ingrédients :** `skyr` 200 g, `mixed_berries` 80 g, `rolled_oats` 30 g, `honey` 10 g
- **Étapes :**
  1. Verse le skyr dans un bol.
  2. Ajoute les fruits rouges et les flocons d'avoine.
  3. Termine par un filet de miel. C'est prêt.

#### 2. Porridge protéiné banane-cannelle
- **id :** `porridge_banana` · **repas :** breakfast · **régimes :** vegetarian (véganisable avec soja) · **tags :** high_fiber, comfort · **difficulté :** easy · **temps :** 10 min · **portions :** 1
- **Ingrédients :** `rolled_oats` 50 g, `milk_semi` 200 ml, `banana` 100 g, `protein_powder_whey` 20 g
- **Étapes :**
  1. Fais chauffer les flocons avec le lait à feu doux, en remuant, 5 min.
  2. Hors du feu, incorpore la protéine en poudre et une pincée de cannelle.
  3. Ajoute la banane en rondelles et sers chaud.

#### 3. Toast avocat & œuf poché
- **id :** `avocado_egg_toast` · **repas :** breakfast · **régimes :** vegetarian, pescatarian, flexitarian, omnivore · **tags :** savory, quick · **difficulté :** medium · **temps :** 10 min · **portions :** 1
- **Ingrédients :** `bread_wholegrain` 60 g, `avocado` 60 g, `egg` 55 g
- **Étapes :**
  1. Fais griller le pain et pocher l'œuf 3 min dans une eau frémissante.
  2. Écrase l'avocat sur le pain, sale et poivre.
  3. Dépose l'œuf poché par-dessus.

#### 4. Overnight oats vanille (vegan)
- **id :** `overnight_oats_vegan` · **repas :** breakfast · **régimes :** vegan, vegetarian, pescatarian, flexitarian, omnivore · **tags :** no_cook, batch_cook, high_fiber · **difficulté :** easy · **temps :** 5 min (+ nuit) · **portions :** 1
- **Ingrédients :** `rolled_oats` 50 g, `soy_milk` 200 ml, `chia_seeds` 15 g, `mixed_berries` 60 g
- **Étapes :**
  1. Mélange flocons, boisson soja et graines de chia dans un bocal.
  2. Laisse au frais toute la nuit.
  3. Au matin, ajoute les fruits rouges et déguste.

#### 5. Omelette légumes & fromage
- **id :** `veggie_cheese_omelette` · **repas :** breakfast, lunch · **régimes :** vegetarian, pescatarian, flexitarian, omnivore · **tags :** high_protein, one_pan · **difficulté :** easy · **temps :** 10 min · **portions :** 1
- **Ingrédients :** `egg` 110 g (2 œufs), `bell_pepper` 60 g, `spinach` 30 g, `cheese_emmental` 20 g, `olive_oil` 5 g
- **Étapes :**
  1. Fais revenir le poivron émincé et les épinards dans l'huile.
  2. Verse les œufs battus, laisse prendre à feu moyen.
  3. Ajoute le fromage, replie l'omelette et sers.

### DÉJEUNERS

#### 6. Salade poulet grillé & quinoa
- **id :** `chicken_quinoa_salad` · **repas :** lunch · **régimes :** flexitarian, omnivore · **tags :** high_protein, fresh, batch_cook · **difficulté :** easy · **temps :** 20 min · **portions :** 2
- **Ingrédients :** `chicken_breast_raw` 240 g, `quinoa_raw` 100 g, `tomato` 100 g, `cucumber` 100 g, `olive_oil` 15 g
- **Étapes :**
  1. Cuis le quinoa selon l'emballage, laisse tiédir.
  2. Grille le poulet à la poêle, coupe-le en lamelles.
  3. Mélange quinoa, légumes en dés, poulet et huile d'olive. Assaisonne.

#### 7. Buddha bowl pois chiches rôtis
- **id :** `chickpea_buddha_bowl` · **repas :** lunch · **régimes :** vegan, vegetarian, pescatarian, flexitarian, omnivore · **tags :** high_protein, high_fiber · **difficulté :** easy · **temps :** 25 min · **portions :** 2
- **Ingrédients :** `chickpeas_cooked` 240 g, `quinoa_raw` 80 g, `carrot` 100 g, `spinach` 60 g, `olive_oil` 15 g
- **Étapes :**
  1. Rôtis les pois chiches au four 20 min avec un peu d'huile et des épices.
  2. Cuis le quinoa, râpe la carotte.
  3. Dresse le bol : quinoa, épinards, carotte, pois chiches. Arrose d'huile.

#### 8. Wrap thon & crudités
- **id :** `tuna_wrap` · **repas :** lunch · **régimes :** pescatarian, flexitarian, omnivore · **tags :** high_protein, quick · **difficulté :** easy · **temps :** 10 min · **portions :** 1
- **Ingrédients :** `whole_wheat_wrap` 60 g, `canned_tuna` 100 g, `tomato` 60 g, `cucumber` 60 g, `fromage_blanc_0` 30 g
- **Étapes :**
  1. Tartine la galette de fromage blanc.
  2. Répartis le thon émietté et les crudités en dés.
  3. Roule serré, coupe en deux.

#### 9. Dahl de lentilles corail
- **id :** `red_lentil_dahl` · **repas :** lunch, dinner · **régimes :** vegan, vegetarian, pescatarian, flexitarian, omnivore · **tags :** high_protein, high_fiber, batch_cook, comfort · **difficulté :** easy · **temps :** 30 min · **portions :** 3
- **Ingrédients :** `lentils_raw` 200 g, `coconut_milk` 200 ml, `onion` 100 g, `tomato` 150 g, `curry_spices` 5 g, `olive_oil` 10 g
- **Étapes :**
  1. Fais revenir l'oignon dans l'huile, ajoute les épices.
  2. Ajoute lentilles, tomates, lait de coco et 400 ml d'eau.
  3. Laisse mijoter 25 min jusqu'à ce que les lentilles soient fondantes.

### DÎNERS

#### 10. Poêlée tofu, brocoli & riz
- **id :** `tofu_broccoli_stirfry` · **repas :** dinner · **régimes :** vegan, vegetarian, pescatarian, flexitarian, omnivore · **tags :** high_protein, one_pan · **difficulté :** medium · **temps :** 20 min · **portions :** 2
- **Ingrédients :** `tofu_firm` 250 g, `broccoli_raw` 200 g, `white_rice_raw` 120 g, `olive_oil` 15 g
- **Étapes :**
  1. Cuis le riz. En parallèle, dore le tofu en cubes dans l'huile.
  2. Ajoute le brocoli, fais sauter 6-8 min.
  3. Sers le sauté sur le riz, assaisonne (sauce soja si tu veux).

#### 11. Saumon, patate douce & épinards
- **id :** `salmon_sweet_potato` · **repas :** dinner · **régimes :** pescatarian, flexitarian, omnivore · **tags :** high_protein · **difficulté :** easy · **temps :** 30 min · **portions :** 2
- **Ingrédients :** `salmon_raw` 240 g, `sweet_potato_raw` 300 g, `spinach` 100 g, `olive_oil` 10 g
- **Étapes :**
  1. Enfourne la patate douce en cubes 25 min à 200 °C.
  2. Cuis le saumon à la poêle, 4 min par face.
  3. Fais tomber les épinards à la poêle. Dresse le tout.

#### 12. Poulet basquaise express
- **id :** `chicken_basquaise` · **repas :** dinner · **régimes :** flexitarian, omnivore · **tags :** high_protein, one_pan · **difficulté :** easy · **temps :** 25 min · **portions :** 2
- **Ingrédients :** `chicken_breast_raw` 240 g, `bell_pepper` 150 g, `tomato` 200 g, `onion` 80 g, `olive_oil` 10 g
- **Étapes :**
  1. Dore le poulet dans l'huile, réserve.
  2. Fais revenir oignon et poivrons, ajoute les tomates.
  3. Remets le poulet, mijote 15 min à couvert.

#### 13. Chili sin carne
- **id :** `chili_sin_carne` · **repas :** dinner · **régimes :** vegan, vegetarian, pescatarian, flexitarian, omnivore · **tags :** high_protein, high_fiber, batch_cook, spicy · **difficulté :** easy · **temps :** 30 min · **portions :** 3
- **Ingrédients :** `red_beans_cooked` 360 g, `tomato` 300 g, `bell_pepper` 150 g, `onion` 100 g, `curry_spices` 5 g, `olive_oil` 10 g
- **Étapes :**
  1. Fais revenir oignon et poivrons dans l'huile.
  2. Ajoute haricots, tomates et épices (cumin, paprika, piment).
  3. Laisse mijoter 20 min. Sers tel quel ou avec un peu de riz.

#### 14. Curry de légumes & pois chiches
- **id :** `veggie_chickpea_curry` · **repas :** dinner · **régimes :** vegan, vegetarian, pescatarian, flexitarian, omnivore · **tags :** high_fiber, comfort · **difficulté :** easy · **temps :** 25 min · **portions :** 3
- **Ingrédients :** `chickpeas_cooked` 300 g, `mixed_vegetables` 300 g, `coconut_milk` 200 ml, `onion` 100 g, `curry_spices` 8 g, `olive_oil` 10 g
- **Étapes :**
  1. Fais revenir l'oignon et les épices dans l'huile.
  2. Ajoute légumes, pois chiches et lait de coco.
  3. Mijote 15 min. Sers chaud.

#### 15. Cabillaud en papillote & légumes
- **id :** `cod_papillote` · **repas :** dinner · **régimes :** pescatarian, flexitarian, omnivore · **tags :** low_calorie, high_protein · **difficulté :** easy · **temps :** 25 min · **portions :** 2
- **Ingrédients :** `cod_raw` 240 g, `mixed_vegetables` 300 g, `olive_oil` 10 g
- **Étapes :**
  1. Dépose chaque dos de cabillaud sur du papier cuisson.
  2. Entoure de légumes, filet d'huile, sel, herbes.
  3. Ferme les papillotes, enfourne 18 min à 200 °C.

#### 16. Steak haché, haricots verts & pommes de terre
- **id :** `beef_greenbeans_potato` · **repas :** dinner · **régimes :** flexitarian, omnivore · **tags :** high_protein, comfort · **difficulté :** easy · **temps :** 25 min · **portions :** 2
- **Ingrédients :** `lean_beef_raw` 240 g, `green_beans` 250 g, `potato_raw` 300 g, `olive_oil` 10 g
- **Étapes :**
  1. Cuis les pommes de terre à l'eau ou à la vapeur.
  2. Poêle les haricots verts, puis les steaks selon ta cuisson.
  3. Sers l'assiette équilibrée, assaisonne.

### COLLATIONS

#### 17. Fromage blanc, miel & noix
- **id :** `fromage_blanc_honey_walnuts` · **repas :** snack · **régimes :** vegetarian, pescatarian, flexitarian, omnivore · **tags :** high_protein, no_cook, sweet · **difficulté :** easy · **temps :** 3 min · **portions :** 1
- **Ingrédients :** `fromage_blanc_0` 150 g, `honey` 10 g, `walnuts` 15 g
- **Étapes :**
  1. Verse le fromage blanc dans un bol.
  2. Ajoute le miel et les noix concassées. (⚠ contient fruits à coque)

#### 18. Houmous & bâtonnets de légumes
- **id :** `hummus_veggie_sticks` · **repas :** snack · **régimes :** vegan, vegetarian, pescatarian, flexitarian, omnivore · **tags :** high_fiber, no_cook, savory · **difficulté :** easy · **temps :** 5 min · **portions :** 1
- **Ingrédients :** `hummus` 80 g, `carrot` 80 g, `cucumber` 80 g, `bell_pepper` 60 g
- **Étapes :**
  1. Coupe les légumes en bâtonnets.
  2. Sers avec le houmous. (⚠ contient sésame)

#### 19. Pomme & beurre de cacahuète
- **id :** `apple_peanut_butter` · **repas :** snack · **régimes :** vegan, vegetarian, pescatarian, flexitarian, omnivore · **tags :** no_cook, quick · **difficulté :** easy · **temps :** 3 min · **portions :** 1
- **Ingrédients :** `apple` 150 g, `peanut_butter` 20 g
- **Étapes :**
  1. Coupe la pomme en quartiers.
  2. Trempe dans le beurre de cacahuète. (⚠ contient arachides)

#### 20. Smoothie protéiné vert
- **id :** `green_protein_smoothie` · **repas :** snack, breakfast · **régimes :** vegan (avec protéine de pois), végétarien · **tags :** high_protein, no_cook, fresh · **difficulté :** easy · **temps :** 5 min · **portions :** 1
- **Ingrédients :** `soy_milk` 250 ml, `banana` 100 g, `spinach` 30 g, `protein_powder_pea` 25 g
- **Étapes :**
  1. Mets tous les ingrédients au blender.
  2. Mixe jusqu'à consistance lisse. Sers frais.

#### 21. Œufs durs & crudités
- **id :** `boiled_eggs_veggies` · **repas :** snack · **régimes :** vegetarian, pescatarian, flexitarian, omnivore · **tags :** high_protein, no_cook · **difficulté :** easy · **temps :** 12 min · **portions :** 1
- **Ingrédients :** `egg` 110 g (2 œufs), `cucumber` 80 g, `tomato` 80 g
- **Étapes :**
  1. Cuis les œufs 9 min dans l'eau bouillante, refroidis-les.
  2. Écale et sers avec les crudités.

#### 22. Yaourt grec, granola & fruits
- **id :** `greek_yogurt_granola` · **repas :** snack, breakfast · **régimes :** vegetarian, pescatarian, flexitarian, omnivore · **tags :** high_protein, sweet, quick · **difficulté :** easy · **temps :** 3 min · **portions :** 1
- **Ingrédients :** `greek_yogurt_0` 170 g, `granola` 40 g, `mixed_berries` 60 g
- **Étapes :**
  1. Verse le yaourt dans un bol.
  2. Ajoute le granola et les fruits rouges. (⚠ granola : gluten + fruits à coque)

---

## 3. Récapitulatif de couverture

- **22 recettes** : 5 petits-déjeuners, 4 déjeuners, 7 dîners, 6 collations.
- **Régimes** : chaque régime (vegan, végétarien, pescatarien, flexitarien, omnivore) trouve des options à chaque repas. Les recettes véganes/végétariennes couvrent aussi les profils omnivores.
- **Nutrition** : majorité `high_protein`, cohérent avec le positionnement perte de poids / recomposition. Plusieurs `no_cook` et `quick` pour l'adhérence, plusieurs `batch_cook` pour tenir dans la durée.
- **Allergènes** : correctement identifiés (gluten, lait, œufs, poisson, arachides, fruits à coque, sésame, soja). La dérivation automatique depuis les ingrédients (brief §4) garantit qu'aucun n'est oublié.

## 4. Étapes suivantes

1. **Claude Code** : implémenter la table `IngredientRef`, le type `Recipe`, le calcul nutritionnel (par portion, en respectant l'état cru/cuit), la dérivation automatique des allergènes et de la compatibilité régime, le filtrage.
2. **Vérifier les valeurs nutritionnelles** à l'intégration avec une base officielle (USDA ou Ciqual pour la France).
3. **Étendre** le catalogue au fil du temps (l'architecture le permet sans refonte).

*Fin du catalogue de recettes V1.*
