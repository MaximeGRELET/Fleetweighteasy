# État d'avancement — Application d'accompagnement à la perte de poids

> Document de suivi. Mis à jour au fil des phases.
> **Dernière mise à jour :** fin Phase 7 (recettes). Phase 6 validée sur appareil.

---

## Vue d'ensemble

| Phase | Intitulé                     | État                                           |
| ----- | ---------------------------- | ---------------------------------------------- |
| 0     | Fondations projet            | ✅ Terminée & commitée                         |
| 1     | Domaine nutritionnel         | ✅ Terminée & commitée                         |
| 2     | Data & persistance locale    | ✅ Terminée & commitée                         |
| 3     | Onboarding                   | ✅ Terminée & commitée                         |
| 4     | Journal + Open Food Facts    | ✅ Terminée & commitée                         |
| 5     | Suivi du poids & progression | ⏭️ Prochaine                                   |
| 6     | Moteur de conseils           | ⬜ Contenu prêt (25 briques rédigées)          |
| 7     | Recettes                     | ✅ Construite — à valider sur appareil         |
| 8     | Sport                        | ⬜ Données prêtes (METs + noyau exercices)     |
| 9     | Backend & synchronisation    | ⬜ Groundwork posé — voir dépendances d'entrée |
| 10    | Durcissement & mise en prod  | ⬜                                             |

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

### Phase 5 — Suivi du poids & progression

- Domaine `progress/` pur et testé à 100 % (branches comprises) : arithmétique de dates, moyenne mobile, rythme réel, statut de progression, politique de recalcul adaptatif.
- **Moyenne mobile en jours, pas en nombre de pesées** : une pesée hebdomadaire et une pesée quotidienne donnent la même échelle de temps.
- **Rythme réel par régression linéaire** — robuste à une pesée aberrante, et c'est ce qui rend le plateau détectable. Rien n'est annoncé sous 14 jours de recul.
- **Détection de plateau** prête pour la Phase 6 : statut unique exposé par `assessProgress`, seuils à 3 semaines / 4 pesées / quart du rythme visé.
- **Recalcul adaptatif branché sur le poids lissé**, jamais sur la dernière pesée. Réalignement du profil dès 0,5 kg, notification seulement au-delà de 50 kcal — sauf garde-fou nouvellement déclenché, toujours annoncé.
- **Seuil de notification mesuré depuis le dernier objectif annoncé**, et non depuis le recalcul précédent (voir la décision ci-dessous).
- Courbe `react-native-svg` (incluse dans Expo Go, pas de development build) : tendance en trait plein, points bruts effacés à 35 % d'opacité.
- Test de vocabulaire sur les messages : aucune formulation culpabilisante ne peut passer.
- Sélecteur de période avec rôle d'accessibilité `radio` (et non `checkbox`) — la dette signalée plus bas n'a pas été reconduite ici.
- 820 tests au vert, lint et typecheck propres. Bundle Android vérifié via Metro.

### Décision — la dérive silencieuse du recalcul adaptatif

**Problème trouvé et corrigé après la première livraison de la Phase 5.** Le seuil de notification
de 50 kcal était appliqué de proche en proche : chaque recalcul se comparait au précédent, et le
poids du profil — la base de comparaison — était réécrit à chaque réalignement.

Le rythme visé étant proportionnel au poids, le déficit se resserre en même temps que la dépense :
l'objectif bouge donc lentement, ~4 kcal par palier de 0,5 kg. **Mesuré sur un profil type : 10 kg
perdus en vingt paliers déplaçaient l'objectif de 73 kcal sans déclencher une seule notification**,
parce qu'aucun pas isolé n'atteignait le seuil. L'utilisateur aurait mangé selon un objectif
sensiblement différent de celui qu'on lui avait annoncé, sans qu'on le lui ait jamais dit.

**Correction retenue : la comparaison part du dernier objectif effectivement annoncé.** Une colonne
`profile.last_notified_weight_kg` (migration `0002`, additive et nullable) mémorise le poids de la
dernière annonce. Chaque évaluation recalcule l'objectif depuis ce poids-là, pas depuis le
précédent. Après correction, le même scénario déclenche une annonce à 83 kg (2 172 → 2 121 kcal) et
l'écart jamais annoncé reste sous 50 kcal en permanence.

**Un poids, et non un nombre de kcal.** Mémoriser l'objectif annoncé le figerait sous les hypothèses
du moment : si l'utilisateur change son niveau d'activité ou son objectif, ce nombre deviendrait
faux et la comparaison suivante rapporterait un écart qui ne doit rien au poids. En mémorisant un
poids, la référence est recalculée avec le profil courant — un changement de réglage déjà vu à
l'écran ne se fait pas annoncer deux fois.

**Le piège à ne pas rouvrir.** La base doit être _épinglée_ dès le premier réalignement silencieux.
Un simple repli `?? currentWeightKg` la ferait suivre le poids fraîchement réaligné, ce qui remet
l'écart cumulé à zéro à chaque palier et rétablit exactement la dérive. `applyAdaptiveEvaluation`
applique le réalignement et la base ensemble, pour qu'aucun appelant ne puisse en oublier une.

Couvert par `tests/unit/progress/adaptive.test.ts` (paliers cumulés à 0,5 kg et 0,2 kg, espacement
des annonces, épinglage de la base), par un aller-retour SQLite dans
`tests/integration/profile.repo.test.ts` — sans persistance, la dérive reviendrait à chaque
redémarrage — et de bout en bout dans `tests/component/weight-tracking.test.tsx`.

### Phase 6 — Moteur de conseils

- Domaine `advice/` pur et testé à 100 % (branches comprises) : types stricts, correspondance profil ↔ tags, évaluation des conditions, sélection, construction du contexte.
- **21 briques intégrées** telles que rédigées (ids, tags, conditions, priorités inchangés), 15 topics.
- **Moteur déterministe** : une brique par topic, la plus prioritaire, triée par priorité décroissante.
- **Bande de sécurité par référence** : le domaine désigne un drapeau, `lib/messages/safety.ts` reste la seule source du texte. Aucune mise en garde n'existe en double.
- **Signaux de risque de la Phase 1 enfin dotés d'un message** (4 textes), et branchés à la bande — en attente d'un historique des objectifs pour être alimentés.
- **Topic `plateau` possédé par l'écran poids** : le moteur s'abstient pour ne pas doubler le message de la Phase 5.
- Conseil du jour sur le tableau + section conseils dédiée.
- Contrôles de contenu automatisés : aucun chiffre calculé en dur, aucune formulation proscrite, priorités sans collision entre topics.
- 993 tests au vert, lint et typecheck propres. Bundle Android vérifié via Metro.

---

### Décisions — Phase 6

**Les garde-fous passent par référence, jamais par duplication du texte.** Leur contenu existait
déjà dans `lib/messages/safety.ts` pour l'onboarding. En faire des briques aurait créé un second
exemplaire de chaque mise en garde, destiné à diverger. Le moteur désigne donc un drapeau
(`SafetyNoticeKey`) et la couche message le résout. Conséquence voulue : aucun contenu nouveau à
rédiger pour les garde-fous de calcul.

**Le plateau reste à l'écran de suivi du poids.** `explainProgressStatus` (Phase 5) l'explique déjà
avec le nombre de semaines mesuré ; la brique `plateau__default` disait presque mot pour mot la
même chose. Le moteur exclut le topic via `TOPICS_OWNED_ELSEWHERE`. La brique n'a pas été
supprimée : elle est écrite et validée, et c'est le filtre qu'il faudra retirer si le produit
change d'avis.

**Ordre des garde-fous entre eux :** objectif menant à l'insuffisance pondérale, puis signaux de
risque comportementaux, puis plancher calorique appliqué — ce dernier étant une protection _déjà
en place_, donc plutôt rassurante. `underweight_target_requested` est masqué quand
`goal_leads_to_underweight` est actif : c'est le même objectif, au passé et au présent.

**Les garde-fous ponctuels ne sont pas répétés.** Rythme et déficit plafonnés commentent une
décision prise à l'écran de réglage, où ils ont été expliqués. Les afficher chaque jour serait du
harcèlement, ce que la spec exclut (§6.6).

### Décision — le rappel de pesée est un conseil, pas une relance

**Question posée en fin de Phase 6 :** `weighing_fluctuations__reminder` (priorité 45) sort rarement
en conseil du jour, car `understanding_deficit__weight_loss` (60) s'applique en permanence à tout
profil en perte. Fallait-il un mécanisme séparé de la priorité pour le faire remonter ?

**Non.** L'intention d'origine est documentée, et quatre signaux concordent :

1. **Le brief §3 énumère les conditions qui doivent primer** : « un `plateau` détecté ou un
   `recentSlip` doit passer devant un conseil générique. Le nouvel utilisateur voit d'abord
   `getting_started`. » Le rappel de pesée est lui aussi conditionnel, et il n'est délibérément
   **pas** dans cette liste — l'auteur a distingué les conditions fortes du simple rappel.
2. **Le brief §4.5 le qualifie de « rappel doux »**, « sans pression ».
3. **Le texte rédigé dit la même chose** : « sans pression ni obsession du chiffre. Quand tu veux. »
4. **La spec §6.6 le confirme au niveau produit** : « Ton sobre, pas de notification intrusive. Le
   conseil s'affiche, il ne harcèle pas. »

Un mécanisme de remontée forcée contredirait les quatre. **Rien à changer.**

Ce que sa priorité de 45 fait réellement — et qui est son vrai rôle — c'est passer devant
`weighing_fluctuations__default` (40) : quand la semaine s'est écoulée sans pesée, le conseil
général sur les fluctuations est **remplacé** par le rappel. C'est vérifié par un test unitaire et
par un test d'écran. Question close ; ne pas la rouvrir sans changer d'abord l'intention produit.

### Phase 7 — Recettes

- Domaine `recipes/` pur et testé à 100 % (branches comprises) : table d'ingrédients, catalogue, dérivation, nutrition, filtrage.
- **22 recettes et 47 ingrédients** transcrits du catalogue rédigé, quantités et étapes inchangées.
- **Allergènes et régimes dérivés des ingrédients**, jamais saisis par recette.
- **Vocabulaire d'allergènes fermé à l'onboarding** (9 puces, sésame ajouté) et table de correspondance couvrant les libellés antérieurs — un profil existant reste protégé.
- **Nutrition calculée** depuis les ingrédients, à l'état de référence déclaré (cru/cuit), affiché à l'écran.
- **Ajout au journal par le mécanisme de snapshot existant** : aucune migration, aucune seconde voie.
- Liste filtrée, détail avec ingrédients/étapes/nutrition, choix du nombre de portions.
- 1 110 tests au vert, lint et typecheck propres. Bundle Android vérifié via Metro.

---

### Décisions — Phase 7

**L'origine remplace la liste d'exclusions par ingrédient.** La table rédigée donnait par
ingrédient les régimes exclus. Elle était déjà fausse : le poulet et le bœuf n'y excluaient pas
`pescatarian`, alors que la recette de salade de poulet, elle, se déclarait bien incompatible. Une
dérivation fidèle à la table aurait donc servi du poulet aux pescatariens. Chaque ingrédient porte
désormais une **origine** dont les exclusions se déduisent — une origine se vérifie d'un coup
d'œil, une liste se recopie.

**Le miel est classé d'origine animale**, donc exclu du régime végétalien, ce que la table ne
faisait pas. Aucune recette végétalienne du catalogue n'en contient : le classement ne retire rien
à personne aujourd'hui, et évite une réclamation le jour où une recette au miel sera ajoutée.

**Le vocabulaire d'allergènes est fermé à la saisie** (décision prise en cours de phase). Les puces
de l'onboarding sont exactement les neuf allergènes que le catalogue sait exclure. Le champ libre
subsiste, marqué comme non filtrant, et ce qui n'est pas reconnu est signalé sur l'écran des
recettes plutôt que tu. **Cela a modifié un écran de la Phase 3**, déjà validé.

**Une entrée issue d'une recette ne référence pas la recette.** Ajouter `recipe_id` à
`food_log_entry` aurait imposé une reconstruction de table (la contrainte CHECK « un aliment OU un
repas » est au niveau table en SQLite), avec copie de données utilisateur. Le snapshot suffit à
l'usage : corriger une portion déjà loggée se fait en supprimant puis réajoutant, comme aujourd'hui
pour un aliment dont la source a disparu.

---

### Ce qui dépend de la vérification Ciqual

Question posée en début de phase — voici la réponse précise.

**Ne dépendent pas des valeurs numériques**, et sont donc solides dès maintenant :
l'exclusion des allergènes, la compatibilité régime, le filtrage et le classement. Tous se fondent
sur les allergènes et l'origine des ingrédients, pas sur les kcal. Aucun chemin de sécurité n'est
suspendu à cette vérification.

**En dépendent directement :** la nutrition affichée par portion, et surtout **le snapshot écrit au
journal**. C'est le point à surveiller : par conception, un snapshot est immuable — corriger la
table d'ingrédients plus tard ne rectifiera pas les entrées déjà enregistrées. Il est donc
préférable que la vérification ait lieu **avant que de vrais utilisateurs ne loggent des recettes**,
faute de quoi leur historique gardera durablement les valeurs provisoires.

**Ce que la transcription a déjà éliminé :** un contrôle automatique compare les calories de chaque
ingrédient à ses macronutriments (système Atwater). Aucune erreur de saisie n'en ressort — les
écarts observés (brocoli, concombre, tomate, pomme) s'expliquent par les fibres, comptées dans les
glucides mais n'apportant qu'environ 2 kcal/g. Ce test attrape une coquille, pas une valeur
officiellement fausse : il ne remplace pas Ciqual.

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
- **Trou de contenu conseils (Phase 6)** : aucune brique `protein` pour les régimes `flexitarian` et `pescatarian` — ces profils ne reçoivent aucun conseil sur ce thème. Tracé aussi dans `files/BRIQUES_CONSEIL_REDIGEES.md`. **À rédiger avant la Phase 10.**
- **Seuils inventés en Phase 6**, faute de spécification : « écart récent » (dépassement de 25 % du budget sur les deux derniers jours) et « nouvel utilisateur » (sept jours). Documentés et isolés dans `domain/advice/context.ts`, faciles à déplacer si l'usage réel les dément.

---

## À valider sur appareil (Phase 7)

Ce qui pouvait être mécanisé l'a été ; ce qui reste demande un écran et un œil.

**Déjà couvert par les tests :** exclusion des allergènes (les neuf, plus les libellés antérieurs),
respect du régime, avertissement sur une allergie non reconnue, filtre par moment de la journée,
ajout au journal avec snapshot figé et mise à l'échelle des portions.

**Ce qui demande réellement l'appareil :**

- [ ] **Lisibilité d'une recette** sur écran de téléphone : longueur de la liste d'ingrédients,
      numérotation des étapes, encombrement de la page de détail.
- [ ] **Le sélecteur de portions** : la demi-portion est-elle compréhensible, le pas de 0,5 est-il
      le bon ?
- [ ] **Contraste en thème sombre** de la mention « Contient : … », affichée en ton `caution`.
- [ ] **Parcours complet** : tableau du jour → recettes → détail → ajout → retour au journal, et
      vérifier que l'entrée ajoutée apparaît bien au bon repas.
- [ ] **Écran d'onboarding « alimentation »** : les puces d'allergies ont changé, vérifier qu'elles
      tiennent bien en largeur avec « Fruits à coque » et « Crustacés ».

---

## Points relevés en Phase 7 (à arbitrer, non bloquants)

- **Le catalogue rédigé déclare des régimes par recette de façon inégale** : la recette 2 sous-déclare
  (« vegetarian » seul, alors qu'elle convient aussi aux pescatariens), la recette 20 mélange clés
  anglaises et mot français. Ces libellés ne sont pas utilisés par le code — la dérivation fait foi —
  mais ils restent trompeurs à la lecture du document.
- **Un aliment détesté absent de la table d'ingrédients n'exclut rien.** « Coriandre », proposé par
  l'onboarding, n'est ingrédient d'aucune recette : le déclarer n'a aucun effet. Sans conséquence de
  sécurité, mais l'utilisateur peut s'attendre à autre chose.
- **Le catalogue ne porte aucune image** alors que la spec §7.6 en prévoit. Le modèle laisse la
  place (`imageUrl` dans la spec) mais aucune source d'images n'est définie.

---

## Phase 9 — Backend & synchronisation : dépendances d'entrée

Points identifiés au fil des phases précédentes qui **conditionnent** la Phase 9. Ce ne sont pas
des sujets réglés : ils attendent d'être traités ici, ou plus tôt si le besoin se précise.

### `detectRiskSignals` attend un historique des objectifs successifs

La détection de signaux de risque comportementaux existe depuis la **Phase 1**
(`src/domain/nutrition/safety.ts`) : objectifs répétés sous le plancher, poids cible révisé à la
baisse plusieurs fois, rythme systématiquement poussé au maximum. La **Phase 6** lui a donné ce qui
lui manquait côté sortie — quatre messages rédigés dans `src/lib/messages/advice.ts`, et une place
dans la bande de sécurité du moteur de conseils, testée de bout en bout.

**Il lui manque toujours son entrée.** La fonction prend un `GoalChangeEvent[]` : l'historique des
objectifs successivement définis par l'utilisateur. **Aucune table ne le conserve.** La table
`profile` ne garde qu'une seule ligne, réécrite à chaque modification : changer de poids cible
efface le précédent sans laisser de trace. Il n'y a donc aujourd'hui rien à donner à la fonction,
et `useAdvice` lui passe une liste vide — explicitement, avec le commentaire qui l'explique.

Ce qu'il faudra décider en Phase 9 (ou avant) :

- **Où vit l'historique.** Une table `goal_change_event` en append-only est le candidat naturel, avec
  son entrée `sync_meta` comme les autres.
- **Ce qu'on y écrit.** `GoalChangeEvent` porte déjà sexe, poids courant, taille, poids cible et
  rythme demandé **avant plafonnement** — cette dernière valeur n'est actuellement persistée nulle
  part, alors qu'elle est ce qui permet de repérer un rythme systématiquement poussé au maximum.
- **La rétention.** Ce sont des données de santé sensibles : leur durée de conservation et leur
  effacement (RGPD) relèvent de la même décision que le reste de la synchro.

Une fois la table en place, le branchement se réduit à une ligne dans `useAdvice` : remplacer
`riskSignals: []` par l'appel à `detectRiskSignals`. Le reste de la chaîne est déjà écrit et
éprouvé.

---

## Prochaine étape : Phase 8 — Sport

Les données sont prêtes (`files/DONNEES_SPORT.md` : table METs + noyau d'exercices). Le calcul des
calories sportives existe depuis la Phase 1 (`calories-sport.ts`, modes `fixed` / `credited`) et le
journal des séances depuis la Phase 2 (`workout.repo`) : la phase branche du contenu sur des
fondations déjà posées, comme la Phase 7 vient de le faire.
