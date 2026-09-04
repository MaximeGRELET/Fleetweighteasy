# FleetWeightEasy

Application mobile (iOS + Android) d'accompagnement à la perte de poids et à la recomposition
corporelle : suivi calorique, conseils personnalisés fondés sur la science, recettes adaptées et
accompagnement sportif.

> Nom de code provisoire — à arbitrer (cf. `files/PLAN_IMPLEMENTATION.md` §15).

## Stack

React Native + Expo (SDK 57) · TypeScript strict · Expo Router · Drizzle / SQLite ·
TanStack Query · expo-camera · react-native-svg · Jest / jest-expo · ESLint + Prettier + Husky ·
Sentry + PostHog.

## Démarrer

```bash
npm install
cp .env.example .env   # télémétrie facultative ; voir EXPO_PUBLIC_OFF_CONTACT ci-dessous
npm start
```

## Scripts

| Script                            | Rôle                                      |
| --------------------------------- | ----------------------------------------- |
| `npm start`                       | Serveur de développement Expo             |
| `npm run android` / `ios` / `web` | Lancement par plateforme                  |
| `npm run lint`                    | ESLint (inclut les règles d'architecture) |
| `npm run typecheck`               | `tsc --noEmit`                            |
| `npm test`                        | Tests Jest                                |
| `npm run test:domain`             | Tests unitaires du domaine uniquement     |
| `npm run test:coverage`           | Tests + seuils de couverture du domaine   |
| `npm run format`                  | Prettier                                  |

## Architecture

Architecture en couches, **les dépendances pointent vers le bas** :

```
UI (src/app, src/components)
  ↓
Hooks (src/hooks, src/stores)
  ↓
Domaine (src/domain)      ← logique métier pure, testée à ~100 %
  ↓
Data (src/data)           ← SQLite, repositories, API
```

Deux règles sont vérifiées automatiquement par ESLint plutôt que par relecture :

- `src/domain/**` ne peut importer ni React, ni Expo, ni la couche data, ni la télémétrie ;
- `src/app/**` et `src/components/**` ne peuvent pas importer `@/data` directement.

## Persistance

Local-first : toute donnée utilisateur vit d'abord en SQLite sur l'appareil, via Drizzle. La
synchro serveur (Phase 9) viendra par-dessus, sans remettre cette couche en cause.

- Le schéma est dans [src/data/db/schema.ts](src/data/db/schema.ts) ; après l'avoir modifié,
  lancer `npm run db:generate` et **commiter les fichiers générés** — les tests d'intégration
  rejouent ces mêmes migrations.
- Les repositories reçoivent leur base, leur horloge et leur générateur d'identifiants par
  injection : les tests tournent sur SQLite en mémoire, sans appareil ni émulateur.

Deux décisions structurantes, prises tôt parce qu'elles sont coûteuses à rattraper :

**Le snapshot nutritionnel.** Une entrée de journal fige ses valeurs nutritionnelles à l'ajout.
Si un produit Open Food Facts est corrigé six mois plus tard, l'historique de l'utilisateur ne
bouge pas. Les totaux du jour somment les snapshots, jamais une jointure sur les aliments.

**Le journal de synchronisation.** La table `sync_meta` (`dirty` / `updatedAt` / `syncedAt` /
`deletedAt`) est écrite dans la même transaction que chaque écriture métier, bien avant que la
synchro existe. Les suppressions y laissent une pierre tombale, sans quoi elles ne pourraient
jamais être propagées au serveur.

## Outillage de développement

Un panneau de debug, présent **uniquement en `__DEV__`**, expose un bouton
« Réinitialiser les données (dev) » sur l'écran du jour et sur l'accueil de l'onboarding. Il
efface profil, consentement, journal, poids, séances, cache d'aliments et `sync_meta`, puis
renvoie sur l'onboarding : rejouer le parcours sur un appareil ne demande plus de désinstaller
l'app.

L'effacement passe par la couche data — `resetAllLocalData` dans
[src/data/reset.ts](src/data/reset.ts), atteint depuis l'UI via
`repositories.maintenance.resetAllLocalData()` — jamais par du SQL écrit dans un écran. La table
`__drizzle_migrations` n'est pas touchée : la vider ferait rejouer les migrations sur des tables
existantes.

Trois garde-fous cumulés le tiennent hors des builds de production : le composant ne rend rien
hors `__DEV__`, ses points d'appel sont conditionnés par le même littéral — que le minifieur
remplace par `false`, ce qui supprime la branche — et le hook d'effacement lève une exception s'il
est appelé ailleurs. [tests/component/dev-reset.test.tsx](tests/component/dev-reset.test.tsx) le
vérifie dans les deux sens.

## Onboarding

Le parcours vit dans [src/app/(onboarding)/](<src/app/(onboarding)/>) : accueil, consentement,
puis sept à neuf écrans de profilage selon l'objectif choisi. Trois règles le structurent.

**Le consentement précède la collecte.** L'écran de consentement est bloquant et écrit dans la
table `consent` (horodatage + version de politique) avant qu'une ligne de profil puisse exister.
L'écran de biométrie redirige vers lui tant qu'il n'a pas été donné — le garde-fou est structurel,
pas seulement visuel.

**Aucune règle métier n'est réécrite dans l'UI.** Les schémas Zod par écran vivent dans
[src/domain/profile/validation.ts](src/domain/profile/validation.ts) et composent les bornes du
domaine. Le plafond du curseur de rythme vient de `getMaxWeeklyRateKg`, le contrôle d'IMC du poids
cible de `classifyBmi`.

**Aucun ajustement n'est silencieux.** Chaque `adjustment` et `warning` remonté par le domaine est
traduit en langage clair par [src/lib/messages/safety.ts](src/lib/messages/safety.ts) et affiché
sur l'écran de restitution. Cas particulièrement soigné : quand le plancher calorique place
l'objectif **au-dessus** de la dépense estimée, un message dédié explique que c'est volontaire —
sans quoi l'utilisateur croirait à un bug. Un test de balayage vérifie qu'aucun drapeau du domaine
ne peut rester sans message.

Le profil n'est persisté qu'au dernier écran ; les objectifs, eux, ne sont jamais stockés — ils se
recalculent depuis le profil à chaque affichage.

## Journal alimentaire et Open Food Facts

Le cœur de l'usage quotidien : chercher ou scanner un aliment, l'ajouter au journal, voir son
budget du jour. Quatre décisions structurent cette partie.

**Une seule frontière avec le distant.** Toute la connaissance d'Open Food Facts vit dans
[src/data/remote/](src/data/remote/), derrière l'interface `FoodDataSource`. Ni l'UI, ni les hooks,
ni les repositories ne savent d'où viennent les aliments : ils voient des `FoodItem` du domaine.
Changer de source — USDA, base maison, API commerciale — revient à écrire un fichier voisin.

**Le local est la source de vérité.** `food.repo` fait foi ; le distant ne fait que l'alimenter.
Tout produit consulté, scanné ou trouvé par recherche, est écrit en base **au moment où il est
vu** : c'est cette base qui rend l'app utilisable hors ligne, et c'est aussi elle qui économise le
quota d'appels. TanStack Query ne sert donc qu'au distant — cache mémoire, déduplication,
annulation, réessais — et n'est **pas** persisté : un second cache sérialisé créerait deux vérités
à réconcilier.

**Les contraintes d'Open Food Facts sont tenues par construction, pas par discipline.**

- Le **User-Agent** (nom, version, contact) est posé par [src/data/remote/http.ts](src/data/remote/http.ts),
  seul chemin sortant : un `fetch` écrit ailleurs l'oublierait. Sans contact configuré
  (`EXPO_PUBLIC_OFF_CONTACT`), l'app **ferme** l'accès au réseau plutôt que d'interroger OFF sous
  une identité incomplète — le journal, les aliments maison et les repas continuent de marcher.
- Le **throttling** est double : debounce de 400 ms sur la saisie, puis limiteur à fenêtre
  glissante par endpoint ([throttle.ts](src/data/remote/throttle.ts)), calibré sous les quotas
  annoncés. Un code-barres dont la clé de contrôle est fausse ne part jamais sur le réseau.
- La **recherche textuelle** passe par Search-a-licious : l'API v2 n'a pas de plein texte
  server-side. Le scan, lui, utilise `/api/v2/product/{code}.json` avec une liste de `fields`
  restreinte à ce qui est affiché.
- L'**attribution ODbL** est affichée partout où une donnée OFF apparaît.

**La frontière ODbL est nette, et le reste.** Toute ligne issue d'OFF porte `source = 'off'` et un
identifiant préfixé `off:`. Une correction utilisateur ne modifie **jamais** une ligne OFF : elle
crée un aliment `custom` distinct. Seuls les aliments `custom` partent à la synchro serveur. Le
raisonnement complet est dans [src/data/remote/licence.ts](src/data/remote/licence.ts) — à
retrancher avec un conseil juridique avant tout usage commercial.

### Données collaboratives, complétude variable

Aucune valeur n'est inventée : un produit dont on ignore les lipides n'est pas un produit à 0 g de
lipides. Une fiche à laquelle il manque un des quatre nutriments obligatoires est signalée comme
**incomplète** — distincte d'un produit _inconnu_ — et ouvre la saisie manuelle **pré-remplie** de
ce que la source savait déjà. Chaque aliment affiche son indicateur de fiabilité : `verified` n'est
vrai que pour ce que l'utilisateur a saisi lui-même, jamais pour une donnée collaborative.

### Offline-first, vérifié chemin par chemin

| Chemin                                    | Sans réseau                                  |
| ----------------------------------------- | -------------------------------------------- |
| Tableau du jour, totaux, budget           | fonctionne — aucun appel réseau              |
| Ajouter / corriger / supprimer une entrée | fonctionne                                   |
| Consulter un aliment déjà en cache        | fonctionne                                   |
| Rejouer un repas prédéfini                | fonctionne                                   |
| Saisir un aliment maison                  | fonctionne — c'est le repli universel        |
| Chercher ou scanner un produit jamais vu  | message clair + repli sur la saisie manuelle |

Aucun écran ne reste vide ni bloqué sur un indicateur de chargement : chaque motif d'échec est
traduit par [src/lib/messages/food-source.ts](src/lib/messages/food-source.ts) et propose au moins
une issue. TanStack Query tourne en `networkMode: 'always'` précisément pour cela — en mode
« online », il mettrait les requêtes en pause au lieu de les laisser échouer proprement.

### Modes de calories

Le tableau du jour applique le `calorieMode` du profil via `buildDailyBudget`, jamais dans l'écran.
En mode `fixed`, une séance n'augmente pas le budget mais reste **affichée séparément** ; en mode
`credited`, l'apport est ajouté visiblement. Les deux vues sont toujours calculées, et la vue
alternative est accessible en un tap : c'est une comparaison, elle ne change pas le réglage.

### Scan et caméra

`expo-camera` est inclus dans Expo Go : le scan y fonctionne sans development build. Un build de
production a besoin du plugin déclaré dans `app.json`, qui porte le texte d'autorisation et
désactive la permission micro (le scan ne capte pas de son). En test, la caméra est remplacée par
[tests/support/camera-mock.tsx](tests/support/camera-mock.tsx) : tout ce qui suit la lecture est
éprouvé sans appareil, et **aucun test n'atteint le réseau**.

## Suivi du poids et progression

Se peser, voir la tendance, et laisser les objectifs suivre le corps. Quatre décisions
structurent cette partie, et toutes découlent du même souci : le poids est une donnée
anxiogène, et l'app ne doit pas amplifier le bruit qu'elle affiche.

**La tendance est la donnée principale ; les pesées brutes sont le second plan.** Le poids varie
d'un à deux kilos d'un jour à l'autre sans qu'aucune graisse n'ait bougé. La courbe trace donc
une moyenne mobile en trait plein et coloré, et les points bruts en gris effacé
([weight-chart.tsx](src/components/charts/weight-chart.tsx)). La fenêtre de lissage est exprimée
en **jours**, pas en nombre de pesées : une moyenne sur les sept dernières _pesées_ couvrirait
sept semaines chez quelqu'un qui se pèse le dimanche, et la tendance affichée retarderait d'un
mois et demi.

**Le rythme réel vient d'une régression, pas d'une soustraction.** Comparer la première et la
dernière pesée d'une période ferait dépendre tout le bilan de deux journées prises au hasard.
[rate.ts](src/domain/progress/rate.ts) ajuste une droite sur l'ensemble des points, ce qui rend
l'indicateur robuste à une pesée aberrante — et rend la détection de plateau possible, un plateau
étant une pente nulle et non deux nombres égaux. Aucun rythme n'est annoncé avant quatorze jours
de recul : ne rien dire est plus juste que dire trop tôt.

**Le recalcul adaptatif réaligne souvent et prévient rarement.** Il porte sur le poids **lissé**,
jamais sur la dernière pesée — sinon une journée salée déplacerait l'objectif calorique du
lendemain. Le profil suit dès un demi-kilo d'écart, pour que les chiffres restent justes ; mais
l'utilisateur n'est prévenu que si l'objectif bouge d'au moins 50 kcal
([adaptive.ts](src/domain/progress/adaptive.ts)). Cette discrétion ne contredit pas la règle
« aucun ajustement silencieux » : `recalculateForNewWeight` force la notification dès qu'un
garde-fou apparaît qui n'était pas déjà actif, et un plancher calorique qui se déclenche est donc
toujours annoncé, quel que soit l'écart en kcal.

**Ce seuil se mesure depuis le dernier objectif annoncé, jamais depuis le recalcul précédent.** La
distinction n'est pas théorique : le rythme visé étant proportionnel au poids, un palier de 0,5 kg
ne déplace l'objectif que de quelques kcal. Une comparaison de proche en proche laisserait donc
passer une perte de dix kilos — plus de 70 kcal d'écart cumulé — sans jamais franchir le seuil à un
pas donné. La colonne `profile.last_notified_weight_kg` mémorise le poids de la dernière annonce,
et `applyAdaptiveEvaluation` l'épingle dès le premier réalignement silencieux : la laisser suivre
le poids courant remettrait le cumul à zéro à chaque palier et rétablirait la dérive.

**Le statut de progression est classé par le domaine, mis en mots par la couche message.**
[assessment.ts](src/domain/progress/assessment.ts) range la situation en un statut unique —
plateau, rythme tenu, plus lent que prévu, reprise, perte non planifiée, ou perte plus rapide que
le plafond de sécurité, ce dernier primant sur tous les autres. C'est ce statut que consommera le
moteur de conseils de la Phase 6 : la définition d'un plateau vit à un seul endroit.

### Ton

Les textes de [progress.ts](src/lib/messages/progress.ts) sont soumis à un test de vocabulaire :
aucun message ne peut contenir de formulation culpabilisante. Un rythme plus lent que prévu est
attribué à l'imprécision du modèle — la dépense énergétique est estimée par une formule
statistique appliquée à un individu — au moins autant qu'au comportement de la personne. Un
plateau est présenté comme une étape banale, et une perte trop rapide comme un signal de santé
plutôt que comme une performance.

## Moteur de conseils

Ce qui distingue l'app d'un compteur : elle explique. Un socle de 21 briques rédigées, 15 thèmes,
assemblés par un moteur déterministe — mêmes profil et contexte, mêmes conseils.

**Les chiffres viennent des formules, le texte vient des briques, et les deux ne se croisent
jamais.** Aucune brique ne contient « ton objectif est 1 800 kcal » : elle expliquerait un chiffre
devenu faux à la première variation de poids. Un test balaie tout le contenu à la recherche d'un
nombre suivi d'une unité nutritionnelle.

**La sélection est une donnée, pas du code.** Chaque brique porte des `tags` (profil) et une
`condition` (situation) ; le moteur garde celles dont **tous** les tags correspondent, évalue la
condition, puis n'en retient qu'une par thème — la plus prioritaire
([engine.ts](src/domain/advice/engine.ts)). Ajouter une variante ne demande aucune modification du
moteur.

**Une mise en garde de santé passe toujours devant un conseil.** Quand un garde-fou est actif —
plancher calorique appliqué, poids cible sous le seuil sain, signal de risque — il occupe le
conseil du jour et les briques passent en dessous. Le moteur ne rédige aucune de ces mises en
garde : il désigne un drapeau, que [lib/messages/safety.ts](src/lib/messages/safety.ts) traduit —
le module qui sert déjà à l'onboarding. Sans cette indirection, la même mise en garde existerait
en deux exemplaires, et le jour où l'une serait corrigée, l'autre mentirait.

**Un thème appartient à un seul écran.** Le plateau est expliqué par l'écran de suivi du poids
depuis la Phase 5, chiffres à l'appui ; le moteur s'en abstient
([`TOPICS_OWNED_ELSEWHERE`](src/domain/advice/rules.ts)). La brique reste écrite et validée — c'est
le filtre qu'il faudra retirer le jour où le produit voudra l'inverse, pas le texte à réécrire.

**L'ordre ne dépend jamais de l'ordre de déclaration.** Deux thèmes ne partagent jamais une
priorité, invariant vérifié sur le contenu lui-même : insérer une brique ne peut donc pas changer
silencieusement le conseil de quelqu'un.

### Ton, et ce qui le garantit

Les briques sont soumises aux mêmes contrôles que les messages de sécurité : aucune formulation
proscrite (compensation punitive, jeûne, « tricher », « mauvais aliment »), la faim intense
présentée comme un signal de manger, et l'interdiction explicite de compenser un écart. Les trois
briques sensibles — plateau, reprise après écart, faim et satiété — sont recensées dans
`SENSITIVE_BLOCK_IDS` et **doivent être revalidées par un professionnel de santé** avant la
production.

## Recettes

Un catalogue de 22 recettes livré avec l'application, filtré sur le profil et loggeable au journal
en un tap. Rien ne passe par le réseau : la liste s'ouvre en avion comme le reste.

**Allergènes et compatibilité régime sont déduits des ingrédients, jamais saisis à la main.** Une
liste recopiée par recette s'oublie au premier ajout — et c'est exactement ce qui était arrivé dans
le catalogue rédigé, où le poulet n'excluait pas les pescatariens. Chaque ingrédient porte une
**origine** (`plant`, `honey`, `dairy`, `egg`, `fish`, `meat`) dont les exclusions se déduisent
([diet.ts](src/domain/recipes/diet.ts)). Une origine se vérifie d'un coup d'œil ; une liste
d'exclusions se recopie et se trompe.

**L'exclusion des allergènes est la seule règle dure.** Le profil stocke des libellés français,
les recettes portent une union stricte : sans traduction explicite, le filtre le plus important de
la phase ne s'appliquerait jamais, et sans rien signaler. Le vocabulaire est donc **fermé à la
saisie** — les puces d'allergies de l'onboarding sont exactement les neuf allergènes que le
catalogue sait exclure, sésame compris, qui manquait. Une saisie libre que le code ne reconnaît pas
n'est pas ignorée en silence : l'écran des recettes le dit
([allergens.ts](src/domain/recipes/allergens.ts)).

**Le reste est une préférence, et se traite comme telle.** Régime, aliments détestés et temps
disponible excluent aussi, mais leur enjeu est le confort. La correspondance des aliments détestés
est approximative — « oignon » retrouve « Oignon » — là où celle des allergènes ne l'est jamais.

**Logger une recette crée une entrée de journal ordinaire.** Mêmes colonnes, même snapshot figé,
mêmes totaux du jour. L'entrée ne référence pas la recette : le catalogue est livré avec
l'application et peut changer à la mise à jour suivante, tandis que le snapshot dit ce qui a été
mangé ce jour-là et continuera de le dire (PHASE_2 §2.4).

### Cru ou cuit

100 g de riz cru ne sont pas 100 g de riz cuit : le premier pèse près de trois fois plus une fois
cuit. Chaque ingrédient déclare son **état de référence**, les quantités des recettes sont
exprimées dans ce même état, et l'écran de détail l'affiche — peser au mauvais moment fausserait la
journée d'un facteur trois.

> ⚠️ Les valeurs nutritionnelles du catalogue sont des ordres de grandeur, **à confirmer avec une
> base officielle** (Ciqual) avant mise en production. Ce qui en dépend est détaillé dans
> `AVANCEMENT.md`.

## Sport

Cardio et musculation ne se modélisent pas pareil, et ne se rejoignent que dans le journal des
séances (PLAN_IMPLEMENTATION §4.4).

**Le cardio estime une dépense ; la musculation n'en estime aucune.** Ce n'est pas un oubli : la
musculation vise la composition corporelle, pas la dépense, et lui coller une valeur METs
donnerait un chiffre trompeur qui ouvrirait un crédit alimentaire injustifié. Une séance de
musculation est donc enregistrée et visible, sans jamais toucher au budget.

**Le mode de calories n'est pas redéfini ici.** Les écrans sport lisent le `calorieMode` du profil
via `buildDailyBudget`, comme le tableau du jour : en mode `fixed`, une séance est affichée mais
n'ouvre rien ; en `credited`, elle s'ajoute visiblement. Il n'existe pas de second chemin.

**La dépense est figée à l'enregistrement**, dans la colonne `estimated_kcal_burned` — même
garantie que le snapshot nutritionnel d'une entrée de journal. Corriger son poids plus tard ne
réécrit pas les séances passées. Le nom de l'exercice est figé de la même façon, pour que
l'historique reste lisible si le noyau change.

**Le crédit sportif ne peut pas contourner le plancher calorique.** C'est vérifié par des tests
dédiés : le crédit **ajoute** au budget, donc celui-ci reste toujours au-dessus du plancher, et une
dépense négative est refusée à l'entrée. Le seul chemin par lequel un crédit aurait pu creuser le
budget est fermé.

### Programmes et progression

Le programme recommandé se choisit sur les jours disponibles et le matériel déclaré, **plafonné à
un niveau intermédiaire** : l'onboarding ne demande aucun niveau d'entraînement, et le nombre de
jours libres dit la disponibilité, pas l'expérience. Un programme avancé reste consultable, il
n'est simplement jamais celui qu'on met en avant. La progression suit la double progression —
quand le haut de la fourchette est tenu **sur toutes les séries**, la charge monte (salle) ou les
répétitions augmentent (maison).

> ⚠️ Les **consignes d'exécution** de chaque exercice ne sont pas rédigées : c'est un chantier de
> contenu distinct (DONNEES_SPORT §C.2), au même titre que les briques de conseil, et il touche à
> la prévention des blessures. L'écran l'indique explicitement plutôt que de laisser croire qu'un
> mouvement n'en demande pas, et affiche l'avertissement sport en attendant.

## Documentation

La planification complète vit dans [`files/`](files/) — point d'entrée :
[`files/POUR_CLAUDE_CODE.md`](files/POUR_CLAUDE_CODE.md), document maître :
[`files/PLAN_IMPLEMENTATION.md`](files/PLAN_IMPLEMENTATION.md).

## Avant toute mise en production

Les seuils de sécurité santé (planchers caloriques, plafond de rythme, seuils d'IMC) et les
messages sensibles **doivent être revalidés par un professionnel de santé**
(`files/PHASE_1_DOMAINE_NUTRITIONNEL.md` §12). L'application ne pose aucun diagnostic médical.
