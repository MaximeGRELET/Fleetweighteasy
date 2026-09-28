# État d'avancement — Application d'accompagnement à la perte de poids

> Document de suivi. Mis à jour au fil des phases.
> **Dernière mise à jour :** fin Phase 8 (sport), version `v0.1.0`. Phase 7 validée sur appareil.
> **Mode de travail à partir de la v0.1.0 :** une branche et un ticket GitHub par évolution, fusion dans `main` par pull request.

---

## Vue d'ensemble

| Phase | Intitulé                     | État                                     |
| ----- | ---------------------------- | ---------------------------------------- |
| 0     | Fondations projet            | ✅ Terminée & commitée                   |
| 1     | Domaine nutritionnel         | ✅ Terminée & commitée                   |
| 2     | Data & persistance locale    | ✅ Terminée & commitée                   |
| 3     | Onboarding                   | ✅ Terminée & commitée                   |
| 4     | Journal + Open Food Facts    | ✅ Terminée & commitée                   |
| 5     | Suivi du poids & progression | ✅ Terminée & commitée                   |
| 6     | Moteur de conseils           | ✅ Terminée & commitée                   |
| 7     | Recettes                     | ✅ Terminée — validée sur appareil       |
| 8     | Sport                        | ✅ Construite — à valider sur appareil   |
| 9     | Backend & synchronisation    | ⏭️ Prochaine — voir dépendances d'entrée |
| 10    | Durcissement & mise en prod  | ⬜                                       |

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

### Phase 8 — Sport

- Domaine `training/` pur et testé à 100 % (branches comprises) : noyau d'exercices, programmes, sélection, double progression.
- **Réutilisation intégrale de l'existant** : METs et `estimateCardioKcal` viennent de la Phase 1, les types de séance de la Phase 2, le `calorieMode` de la Phase 4. Rien n'a été redéfini.
- **31 exercices et 5 programmes** transcrits/composés depuis le document de référence, maison et salle.
- **Musculation sans estimation calorique**, décision de la Phase 1 reprise telle quelle : elle vise la composition corporelle, pas la dépense.
- **Dépense cardio figée à l'enregistrement**, comme un snapshot nutritionnel — colonne `estimated_kcal_burned` déjà présente au schéma, aucune seconde voie créée.
- Écrans : accueil sport, saisie cardio avec estimation, séance de musculation avec journalisation et cible de progression.
- 1 192 tests au vert, lint et typecheck propres. Bundle Android vérifié via Metro.

---

### Décisions — Phase 8

**Le crédit sportif ne peut pas contourner le plancher calorique — vérifié.** C'était la question
posée en début de phase. Le crédit **ajoute** au budget : celui-ci vaut toujours objectif + sport,
donc reste au-dessus du plancher quel que soit le volume. Le seul chemin qui aurait pu creuser le
budget — une dépense négative — est refusé à l'entrée par `applyCalorieMode`. Six tests
paramétrés (0 à 5 000 kcal) verrouillent l'invariant.

**Constat inverse, laissé en l'état sur décision produit.** C'est le mode `fixed`, le défaut, qui
fait chuter l'énergie _nette_ : 1 200 kcal de budget moins 800 kcal de sport laissent 400 kcal
nets. C'est voulu — le facteur d'activité du TDEE couvre l'entraînement habituel — et l'écran du
jour affiche déjà la dépense séparément. Aucun avertissement n'a été ajouté : il aurait fallu
inventer un seuil d'énergie disponible, qui est une notion clinique à part entière.

**La musculation n'ouvre aucun crédit, même en mode crédité.** Reprise de la décision de la
Phase 1 : lui coller une valeur METs donnerait un chiffre trompeur. La séance est enregistrée et
visible, elle ne touche simplement pas au budget.

**Le programme recommandé est plafonné au niveau intermédiaire.** L'onboarding ne demande aucun
niveau d'entraînement : le seul indice disponible est le nombre de jours par semaine, qui dit la
disponibilité, pas l'expérience. Quelqu'un peut avoir six soirées libres et n'avoir jamais tenu une
barre. Les programmes avancés restent consultables, ils ne sont jamais mis en avant. Un niveau
auto-déclaré à l'onboarding lèverait cette approximation.

**Les consignes d'exécution sont livrées vides, et l'écran le dit.** Le document les renvoie
explicitement à un chantier de contenu séparé (§C.2), au même titre que les briques de conseil : ce
sont des consignes de prévention des blessures, qui demandent une relecture professionnelle. Les
inventer aurait été le contraire de prudent. Un avertissement sport dédié (`SPORT_DISCLAIMER`) est
affiché en attendant, sur l'accueil sport comme sur la séance.

---

## ⚠️ Actions qui te reviennent (hors code) — à ne pas perdre

1. **`EXPO_PUBLIC_OFF_CONTACT`** doit contenir une **adresse réellement surveillée** avant toute mise en service. C'est le canal par lequel Open Food Facts prévient avant de bloquer. Un placeholder = risque de blocage silencieux en prod. _(En dev, ton email personnel suffit.)_
2. **Validation santé par un professionnel** avant la prod : planchers caloriques, plafond de rythme, seuils d'IMC, et les messages sensibles (plateau, reprise après écart, faim). Rappelé dans le README.
3. **Conseil juridique ODbL** (Open Food Facts, clause share-alike) avant tout usage commercial.
4. 🚧 **BLOQUANT AVANT PROD — vérifier les valeurs nutritionnelles** des recettes et de la table d'ingrédients avec la base Ciqual (France). **Prérequis à toute mise en service auprès de vrais utilisateurs**, et non une tâche de phase de développement : la Phase 7 est livrée, mais le catalogue ne doit pas être exposé à des utilisateurs réels tant que ce contrôle n'a pas eu lieu. **Raison :** le snapshot nutritionnel est immuable par conception (PHASE_2 §2.4). Une entrée de journal fige les valeurs à l'ajout, et corriger la table plus tard **ne rectifiera pas** les entrées déjà écrites — l'historique d'un utilisateur garderait indéfiniment des valeurs provisoires. Il n'y a pas de rattrapage possible après coup, seulement avant. Détail de ce qui en dépend et de ce qui n'en dépend pas : section « Ce qui dépend de la vérification Ciqual ».
5. **Nom définitif du produit** (provisoire actuel : FleetWeightEasy) — centralisé, renommage indolore.
6. **Consignes d'exécution des exercices** — chantier de contenu, à faire avant la prod. 31 exercices × 2-4 puces (exécution correcte + point de sécurité), renvoyées par `DONNEES_SPORT.md` §C.2 à un chantier séparé « comme les briques ». **Contenu de prévention des blessures : à faire relire par un professionnel**, au même titre que les briques sensibles. En attendant, `instructions` est vide partout, l'écran de séance l'annonce et affiche `SPORT_DISCLAIMER`. Un test échouera le jour où le contenu arrivera — c'est le rappel voulu pour retirer l'avertissement.
7. **Source des images de recettes** — décision produit en attente. La spec §7.6 prévoit une illustration par recette, mais rien n'est arrêté : banque d'images, droits d'usage, format, hébergement. Le champ `imageUrl` existe dans le modèle (`src/domain/recipes/types.ts`), documenté comme **prévu mais non branché** — aucun écran ne le lit, aucune recette ne le renseigne. Rien à implémenter tant que la source n'est pas définie.

---

## Points à surveiller (dette légère, non bloquante)

- **Search-a-licious** : mapping validé sur appareil au premier essai, mais garder un œil si la forme des réponses évolue.
- **Quotas OFF** : calibrés à 80 lectures / 8 recherches par minute (sous les 100/10 documentés). À revérifier contre la politique courante.
- **Signal de fiabilité** : `verified` est toujours `false` pour OFF (choix sémantique assumé). Vérifier que l'utilisateur a _un_ autre signal de fiabilité des données (complétude, mention « données communautaires »).
- **Accessibilité** : les puces de choix de repas utilisent un rôle `checkbox` pour un choix exclusif (devrait être `radio`). À corriger en passe d'accessibilité groupée (Phase 10).
- **Trou de contenu conseils (Phase 6)** : aucune brique `protein` pour les régimes `flexitarian` et `pescatarian` — ces profils ne reçoivent aucun conseil sur ce thème. Tracé aussi dans `files/BRIQUES_CONSEIL_REDIGEES.md`. **À rédiger avant la Phase 10.**
- **Seuils inventés en Phase 6**, faute de spécification : « écart récent » (dépassement de 25 % du budget sur les deux derniers jours) et « nouvel utilisateur » (sept jours). Documentés et isolés dans `domain/advice/context.ts`, faciles à déplacer si l'usage réel les dément.

---

## À valider sur appareil (Phase 8)

Ce qui pouvait être mécanisé l'a été ; ce qui reste demande un écran et un œil.

**Déjà couvert par les tests :** estimation cardio et son figeage à l'enregistrement, message du
mode de calories (fixe vs crédité), sélection du programme selon matériel et jours, journalisation
d'une séance de musculation sans crédit calorique, cible de progression, avertissements affichés.

**Ce qui demande réellement l'appareil :**

- [ ] **Longueur de la liste d'intensités cardio** : la marche en propose cinq, le vélo sept — vérifier
      que le choix reste lisible sans faire défiler indéfiniment.
- [ ] **Écran de séance de musculation** : cinq exercices, deux champs chacun — vérifier
      l'encombrement et le confort de saisie au clavier numérique.
- [ ] **Contraste en thème sombre** des deux encarts `caution` (avertissement sport, consignes à
      venir), qui apparaissent tous deux sur le parcours.
- [ ] **Parcours complet** : tableau du jour → séances → cardio → retour, et vérifier que la
      dépense estimée remonte bien au budget du jour dans le mode réglé.
- [ ] **Lisibilité du message de progression** après saisie, qui s'affiche sous chaque exercice.

---

## Points relevés en Phase 8 (à arbitrer, non bloquants)

- **Aucun tirage vertical au poids du corps.** La liste de référence n'en propose pas — une traction
  demande une barre. Les programmes maison couvrent donc huit patterns sur neuf. Un test fige le
  constat et échouera si un exercice comble le trou.
- **Aucun niveau d'entraînement déclaré à l'onboarding.** La sélection de programme s'en passe par
  prudence (plafond intermédiaire), mais une question à l'onboarding rendrait la recommandation
  juste plutôt que prudente.
- **Le dossier `src/app/(tabs)/` est un échafaudage vide** de la Phase 0 (cinq dossiers, cinq
  `.gitkeep`). L'app utilise des routes à plat. À supprimer ou à utiliser en Phase 10.

---

## Points relevés en Phase 7 (à arbitrer, non bloquants)

- ✅ **Régimes déclarés inégalement dans le catalogue rédigé** — corrigé. Les recettes 2 et 20
  listent désormais leurs régimes compatibles au complet, et une note rappelle que ces libellés sont
  indicatifs : c'est la dérivation depuis les ingrédients qui fait foi.
- ✅ **Aliments détestés orphelins** — corrigé, et le problème était plus large que « coriandre » :
  **les six** suggestions (coriandre, champignons, olives, foie, chou, anchois) ne correspondaient à
  aucun ingrédient du catalogue, si bien que les cocher n'écartait jamais rien. Elles viennent
  maintenant de la table d'ingrédients, et un test garantit que chaque suggestion peut réellement
  exclure quelque chose. Une saisie libre reste conservée au profil même si aucune recette ne la
  contient — c'est la préférence de la personne, pas un critère.
- **Images de recettes** : décision produit en attente (voir « Actions qui te reviennent », point 6).
  Le champ `imageUrl` est prévu dans le modèle mais délibérément non branché.

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

**Son entrée est en place depuis le ticket #1.** La table `goal_change_event`, en ajout seul et
suivie par `sync_meta`, conserve les objectifs successifs que `profile` écrase. `profile.save` y
ajoute un événement, dans la même transaction, chaque fois que le type d'objectif, le poids cible
ou le rythme change (`hasGoalChanged`). Le recalcul adaptatif après une pesée ne touche que le poids
courant : il n'écrit rien, pour ne pas noyer les vrais choix dans des réécritures subies.
L'événement fige le **rythme demandé avant plafonnement**, qui n'était persisté nulle part
ailleurs. `useAdvice` passe désormais `detectRiskSignals(profile.getGoalHistory())` à la bande de
sécurité. Un test d'écran vérifie la chaîne de bout en bout.

Restent ouverts :

- **`requestedDailyKcal`** : la colonne existe, mais aucun écran ne demande d'objectif calorique
  explicite. Le signal « objectifs répétés sous le plancher » ne peut donc pas encore se déclencher.
- **La rétention.** Ce sont des données de santé sensibles. `profile.clear()` et la
  réinitialisation effacent l'historique avec le profil ; la durée de conservation côté serveur
  relève de la même décision que le reste de la synchro.

---

## Prochaine étape : Phase 9 — Backend & synchronisation

Le groundwork est posé depuis la Phase 2 : `sync_meta` avec `dirty` / `updatedAt` / `syncedAt` /
`deletedAt`, écrit dans la même transaction que chaque écriture métier, et les pierres tombales des
suppressions. Les dépendances d'entrée sont listées ci-dessus ; l'historique des objectifs
successifs est désormais en place (ticket #1).
