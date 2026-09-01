# État d'avancement — Application d'accompagnement à la perte de poids

> Document de suivi. Mis à jour au fil des phases.
> **Dernière mise à jour :** fin Phase 6 (moteur de conseils). Phase 5 validée sur appareil.

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

## À valider sur appareil (Phase 6)

- [ ] Vérifier que le conseil du jour s'affiche sur le tableau et change avec la situation (nouvel utilisateur, écart récent).
- [ ] Ouvrir la section conseils et vérifier la lisibilité des briques sur écran de téléphone.
- [ ] Vérifier le thème sombre sur les deux surfaces.
- [ ] Vérifier qu'une mise en garde de sécurité prend bien la place du conseil du jour.

---

## Points relevés en Phase 6 (à arbitrer, non bloquants)

- **Le document de contenu annonce 25 briques, il en contient 21.** Le brief structurel dit « ~25 »,
  et sa grille en liste exactement 21 — les deux documents concordent brique par brique. C'est le
  récapitulatif de `BRIQUES_CONSEIL_REDIGEES.md` qui est faux, pas le contenu. Les 21 sont
  intégrées.
- **Aucune brique protéines pour les régimes `flexitarian` et `pescatarian`.** Ces profils ne
  reçoivent donc aucun conseil sur ce thème. Le moteur préfère se taire plutôt que de servir un
  texte pensé pour quelqu'un d'autre ; deux variantes à rédiger combleraient le trou.
- **Le rappel de pesée ne sera presque jamais le conseil du jour.** Sa priorité (45) le place
  derrière `understanding_deficit__weight_loss` (60), qui s'applique en permanence à tout profil en
  perte. Il reste visible dans la section conseils. À revoir si l'intention était d'en faire une
  relance.
- **Les signaux de risque n'ont aucune source de données.** `detectRiskSignals` existe depuis la
  Phase 1 et dispose maintenant de messages et d'une surface d'affichage, mais il lui faut un
  historique des objectifs successifs qu'aucune table ne conserve. À prévoir avec la Phase 9
  (synchro) ou plus tôt si le sujet est jugé prioritaire.
- **Seuils inventés faute de spécification.** Ni le brief ni la spec ne définissaient « écart
  récent » ni « nouvel utilisateur ». Retenus : dépassement de 25 % du budget sur les deux derniers
  jours, et sept jours d'ancienneté. Documentés et isolés dans `domain/advice/context.ts`.

---

## Prochaine étape : Phase 7 — Recettes

Le contenu est prêt (22 recettes + table d'ingrédients dans `files/RECETTES_REDIGEES.md`). Le
filtrage par régime, allergies et aliments détestés s'appuiera sur les mêmes champs de profil que
les tags de conseil.

**Rappel de la liste d'actions ci-dessus :** vérifier les valeurs nutritionnelles des recettes avec
la base Ciqual au moment de l'intégration.
