# Phases 2 à 5 — Spécifications détaillées

> **Complément de `PLAN_IMPLEMENTATION.md`.** Suite de `PHASE_1_DOMAINE_NUTRITIONNEL.md`.
> **Destiné à :** Claude Code.
> Chaque phase est un incrément livrable et testé. Ne pas avancer tant qu'une phase n'est pas verte.

---

# PHASE 2 — Couche data & persistance locale

## 2.1 Objectif

Poser la persistance **local-first** : toute donnée utilisateur (profil, journal, poids, séances, aliments en cache) vit d'abord en SQLite sur l'appareil. L'app doit être pleinement fonctionnelle sans réseau. La synchronisation serveur viendra en Phase 9, par-dessus cette couche, sans la remettre en cause.

## 2.2 Stack de persistance (validée)

- **`expo-sqlite`** (async API, mode WAL, foreign keys, change listeners — disponibles depuis SDK 51).
- **Drizzle ORM** (`drizzle-orm/expo-sqlite`) pour le typage fort et les migrations via `drizzle-kit`.
- **`useLiveQuery`** de Drizzle pour les requêtes réactives (l'UI se met à jour quand la donnée change).
- Migrations générées par `drizzle-kit generate`, appliquées au runtime via `useMigrations`, avec un écran de chargement tant que la migration n'est pas terminée.

> Alternative notée mais non retenue en V1 : OP-SQLite (JSI, plus rapide sur très gros volumes). À reconsidérer seulement si on manipule des dizaines de milliers de lignes en local, ce qui n'est pas le cas ici.

## 2.3 Principe d'architecture : le pattern Repository

L'UI et les hooks **ne parlent jamais directement à Drizzle ni à SQLite**. Ils passent par des repositories, un par entité, exposant une interface claire. C'est ce qui rend la source de données remplaçable et testable.

```
src/data/
  db/
    client.ts            # ouverture SQLite + instance Drizzle
    schema.ts            # tous les schémas de tables Drizzle
    migrations/          # généré par drizzle-kit
  repositories/
    profile.repo.ts
    food-log.repo.ts
    weight.repo.ts
    food.repo.ts         # cache des aliments (OFF + maison)
    meal.repo.ts         # repas prédéfinis
    workout.repo.ts
  types.ts               # types de rangée <-> types domaine (mappers)
```

Chaque repository expose des méthodes métier explicites, pas du SQL brut : `profileRepo.get()`, `profileRepo.save(profile)`, `foodLogRepo.addEntry(entry)`, `foodLogRepo.getByDate(date)`, `weightRepo.getHistory(range)`, etc.

## 2.4 Schémas de tables (dérivés de la section 4 du plan principal)

Tables à créer (colonnes détaillées à partir des types du domaine) :

- **profile** : une seule ligne (le profil de l'utilisateur local). Champs de `UserProfile` (Phase 1, §2.2). Les objectifs calculés ne sont **pas** stockés figés : ils se recalculent depuis le profil via le domaine (source de vérité unique = le profil + les formules).
- **food_item** : cache des aliments. `id`, `source` (`off`/`custom`), `barcode`, `name`, `brand`, valeurs pour 100 g (`kcal`, `proteinG`, `carbsG`, `fatG`, et champs optionnels), `servingSizes` (JSON), `verified`, `cachedAt`.
- **meal** : repas prédéfinis. `id`, `name`, `items` (JSON : liste de {foodItemId, quantityG}).
- **food_log_entry** : `id`, `date`, `mealType`, `foodItemId` **ou** `mealId`, `quantityG`, et les valeurs nutritionnelles **figées au moment de l'ajout** (`kcalSnapshot`, `proteinSnapshot`, etc.) pour préserver l'historique même si la donnée source change plus tard.
- **weight_entry** : `id`, `date`, `weightKg`, `note`.
- **workout_log_entry** : `id`, `date`, `type` (`cardio`/`strength`), `payload` (JSON typé selon le type), `estimatedKcalBurned`.
- **sync_meta** (préparé pour Phase 9) : `entityId`, `entityType`, `updatedAt`, `syncedAt`, `dirty` (booléen). Permet la synchro incrémentale plus tard sans refonte.

> **Décision de conception importante :** les valeurs nutritionnelles d'une entrée de journal sont **snapshotées** à l'ajout. Si un aliment OFF est corrigé sur le serveur six mois plus tard, l'historique de l'utilisateur ne doit pas changer rétroactivement. Le passé est immuable.

## 2.5 Store de session (Zustand)

`src/stores/session.ts` : état UI transverse et non persistant en base (ou persisté léger via `expo-sqlite/kv-store`) — par ex. l'onglet actif, le mode d'affichage, des drapeaux de première utilisation. **Pas** de logique métier, **pas** de données de journal ici.

## 2.6 Tests

- Tests d'intégration des repositories sur une base SQLite en mémoire (ou fichier temporaire).
- Vérifier le CRUD complet de chaque entité.
- Vérifier le snapshot nutritionnel (une modif de l'aliment source ne change pas une entrée existante).
- Vérifier les migrations (une base vierge se migre sans erreur).

## 2.7 Définition de "terminé"

- [ ] Toutes les tables créées, migrations générées et appliquées.
- [ ] Un repository par entité, avec interface métier claire, aucun SQL exposé hors `data/`.
- [ ] Mappers row <-> type domaine testés.
- [ ] CRUD et snapshot couverts par des tests d'intégration.
- [ ] L'app démarre, crée sa base et fonctionne **sans réseau**.

---

# PHASE 3 — Onboarding

## 3.1 Objectif

Permettre à un nouvel utilisateur de créer son profil via un questionnaire fluide, obtenir ses objectifs calculés (Phase 1) et entrer dans l'app. C'est le premier contact : il doit être clair, rapide, rassurant.

## 3.2 Principes UX

- **Une idée par écran.** Progression visible (barre ou points). Retour arrière toujours possible.
- **Friction minimale** : préremplir des valeurs par défaut raisonnables, claviers adaptés (numérique pour poids/taille), validation en temps réel via Zod.
- **Pédagogie à la fin, pas au milieu** : on ne noie pas l'utilisateur d'explications pendant la saisie ; la restitution explique les chiffres une fois calculés.
- **Consentement avant collecte biométrique** (voir §3.4).

## 3.3 Séquence des écrans

1. **Accueil** — promesse de valeur en une phrase, bouton commencer.
2. **Consentement données de santé** — voir §3.4. Bloquant : pas de suite sans consentement.
3. **Objectif** — perte de poids / recomposition / maintien.
4. **Biométrie** — sexe (avec note respectueuse expliquant l'usage métabolique, cf. Phase 1 §9), date de naissance, taille, poids actuel.
5. **Poids cible** (optionnel, sauté si maintien) — avec vérification IMC en direct (Phase 1 §5.4) : si le poids cible mène à l'insuffisance pondérale, message bienveillant, pas de blocage brutal mais pas d'encouragement.
6. **Niveau d'activité** — 5 niveaux, chacun décrit concrètement (« sédentaire : travail de bureau, peu de marche »… « très actif : sport intense 6-7×/sem »).
7. **Jours d'entraînement / sport pratiqué** — muscu (salle/maison), cardio (marche/course/vélo), ou mix.
8. **Alimentation** — régime, allergies, aliments détestés. (Ces données servent surtout aux phases 6-7 ; on les collecte ici.)
9. **Rythme souhaité** (si perte de poids) — curseur **borné** par les garde-fous (Phase 1 §5). L'utilisateur ne peut pas sélectionner un rythme dangereux ; si sa préférence dépasse la borne, on lui explique.
10. **Restitution** — l'app affiche : objectif calorique, macros, rythme effectif, et **explique le pourquoi** (BMR → TDEE → objectif). Tout garde-fou déclenché (Phase 1, `adjustments`/`warnings`) est expliqué ici en langage clair et bienveillant.
11. **Réglage du mode calories** — `fixed` (défaut, recommandé) vs `credited`, avec explication des deux (Phase 1 §7.2). L'utilisateur peut garder le défaut.
12. **Entrée dans l'app.**

## 3.4 Écran de consentement (RGPD)

- Explique **quelles** données de santé sont collectées, **pourquoi** (personnaliser les calculs), **où** elles vivent (sur l'appareil d'abord), et les **droits** (export, suppression).
- Consentement **explicite** (case à cocher active, pas de pré-cochage), avant toute saisie biométrique.
- Lien vers la politique de confidentialité complète (rédigée en Phase 10).
- Le consentement est horodaté et persisté.

## 3.5 Technique

- **React Hook Form + Zod** : un schéma Zod par écran, réutilisant les types du domaine (Phase 1). La validation métier (bornes, plausibilité) vient du domaine, pas dupliquée dans l'UI.
- À la fin, le profil validé est persisté via `profileRepo.save()` (Phase 2), `onboardingCompleted = true`.
- Les objectifs sont calculés à la volée via le domaine (Phase 1), **jamais** stockés figés.
- Navigation via Expo Router, groupe `(onboarding)`.

## 3.6 Tests

- Test E2E (Maestro, cadré en Phase 10 mais le parcours est défini ici) : un utilisateur complète l'onboarding et arrive à l'écran principal.
- Tests d'intégration : le profil est correctement persisté ; les garde-fous se déclenchent et s'affichent quand les entrées l'exigent.
- Cas limite : rythme agressif demandé → borné + expliqué ; poids cible sous IMC 18.5 → averti.

## 3.7 Définition de "terminé"

- [ ] Tous les écrans implémentés, navigation fluide, retour arrière fonctionnel.
- [ ] Consentement bloquant et persisté avant toute collecte biométrique.
- [ ] Validation via Zod branchée sur le domaine (pas de règle métier dupliquée).
- [ ] Restitution pédagogique affichant et expliquant tous les garde-fous.
- [ ] Profil persisté, `onboardingCompleted` géré, redémarrage de l'app → on ne repasse pas l'onboarding.

---

# PHASE 4 — Journal alimentaire + Open Food Facts

## 4.1 Objectif

Le cœur de l'usage quotidien : chercher/scanner un aliment, l'ajouter au journal, voir son budget calorique du jour. **Doit fonctionner offline** pour tout ce qui est déjà en cache.

## 4.2 Intégration Open Food Facts — contraintes réelles (vérifiées)

Points confirmés qui **conditionnent la conception** :

- **User-Agent personnalisé obligatoire** sur chaque appel (identifie l'app ; sans lui, risque de blocage). Format : nom de l'app + version + contact.
- **Rate-limits appliqués par endpoint.** → throttling côté client + cache agressif indispensables.
- **Licence ODbL : attribution + share-alike.** → afficher l'attribution OFF ; et **point de vigilance stratégique** : le share-alike impose que toute base *combinant* les données OFF avec une autre source soit republiée en open data. Cela a des implications si un jour on construit une base propriétaire par-dessus. **À trancher avec un conseil juridique avant tout usage commercial.** En V1 (consultation + cache), on reste dans un usage conforme, mais on isole les données OFF pour garder cette frontière nette.
- **Pas de recherche plein-texte dans l'API v2 server-side.** La v2 offre la recherche **structurée** (par catégories, marques, nutriments) via `/api/v2/search`. Le full-text passe par un service séparé (**Search-a-licious**, `search.openfoodfacts.org`). → Voir §4.4 pour la stratégie de recherche.
- **Données crowdsourcées, complétude variable.** → toujours vérifier la présence d'un champ avant de s'en servir ; afficher un indicateur de fiabilité ; permettre correction locale.

## 4.3 Scan de code-barres (chemin principal)

- `expo-camera` pour le scan.
- Endpoint : `GET /api/v2/product/{barcode}.json?fields=...` (limiter les `fields` à ce qu'on affiche, pour alléger).
- Normalisation du code-barres selon la référence OFF.
- Produit trouvé → mapper vers `FoodItem`, **mettre en cache local** (`food.repo`), proposer l'ajout au journal.
- Produit absent ou données incomplètes → proposer la saisie/complétion manuelle (aliment `custom`).

## 4.4 Recherche par nom (chemin secondaire)

Vu l'absence de full-text en v2 server-side, stratégie en V1 :
- Utiliser **Search-a-licious** (`search.openfoodfacts.org`) pour la recherche textuelle, derrière la même couche d'abstraction.
- **Debounce** de la saisie (search-as-you-type génère beaucoup d'appels → rate-limit). Throttling strict.
- Résultats mis en cache. Priorité d'affichage aux produits déjà en cache / déjà utilisés par l'utilisateur (rapidité + moins d'appels).
- Repli : recherche structurée v2 par catégorie/marque si pertinent.

## 4.5 Couche d'abstraction (rappel architecture)

Toute la logique OFF vit dans `src/data/remote/openfoodfacts.ts`, derrière une interface `FoodDataSource` :

```
interface FoodDataSource {
  getByBarcode(barcode: string): Promise<FoodItem | null>;
  searchByName(query: string): Promise<FoodItem[]>;
}
```

Ainsi, ajouter une autre source (USDA, base maison, une API commerciale si l'ODbL devient contraignante) = implémenter la même interface, sans toucher au reste.

- **TanStack Query** gère cache mémoire, retry, invalidation, et persiste vers SQLite pour l'offline.
- Le repository `food.repo` est la source de vérité locale ; la source distante ne fait que l'alimenter.

## 4.6 Écrans

- **Tableau du jour** (écran principal / onglet journal) : budget calorique, consommé, restant, barres de macros, repas de la journée regroupés par type (petit-déj/déjeuner/dîner/collation). Le budget respecte le `calorieMode` (Phase 1 §7). En mode `credited`, afficher clairement l'apport du sport ; en mode `fixed`, afficher le sport séparément sans l'ajouter au budget, avec la vue alternative accessible (transparence).
- **Recherche / scan** : champ de recherche + bouton scan, résultats, fiche produit avec valeurs et indicateur de fiabilité.
- **Ajout d'une entrée** : choix de la quantité (avec portions usuelles si dispo), du type de repas, validation → snapshot nutritionnel (Phase 2 §2.4).
- **Repas prédéfinis** : créer un repas à partir d'aliments, le rejouer en un tap.
- **Aliment maison** : formulaire de saisie manuelle (valeurs pour 100 g).

## 4.7 Offline-first (à vérifier explicitement)

- Ajouter, éditer, supprimer une entrée : fonctionne sans réseau.
- Consulter un aliment déjà en cache : fonctionne sans réseau.
- Scan/recherche d'un produit **jamais** vu : nécessite le réseau → message clair + repli sur saisie manuelle.
- Aucun écran ne doit « planter » ou rester bloqué sur un spinner sans réseau.

## 4.8 Tests

- Domaine : calculs de totaux journaliers, application du `calorieMode`.
- Intégration : ajout d'entrée → snapshot correct ; cache OFF ; comportement offline.
- Mock de `FoodDataSource` (pas d'appel réseau réel en test).

## 4.9 Définition de "terminé"

- [ ] Scan et recherche fonctionnels, User-Agent conforme, throttling en place.
- [ ] Cache local systématique de tout produit consulté.
- [ ] Attribution OFF affichée ; données OFF isolées (frontière ODbL nette).
- [ ] Tableau du jour correct, respectant le mode calories, avec les deux vues.
- [ ] Repas prédéfinis et aliments maison opérationnels.
- [ ] Offline-first vérifié sur tous les chemins.

---

# PHASE 5 — Suivi du poids & progression

## 5.1 Objectif

Permettre à l'utilisateur de suivre son poids dans le temps, de voir sa progression **sereinement** (sans anxiété liée aux fluctuations quotidiennes), et déclencher le recalcul adaptatif des objectifs.

## 5.2 Principes (santé mentale d'abord)

- Le poids fluctue au jour le jour (eau, digestion, cycle). Afficher une **courbe lissée** (moyenne mobile, ex. 7 jours) en plus des points bruts, pour montrer la tendance réelle et éviter la sur-réaction.
- Pesée **hebdomadaire** recommandée (message pédagogique), même si l'app permet une saisie plus fréquente.
- Ton toujours **encourageant et factuel**, jamais culpabilisant. Pas de « vous avez échoué ». Un plateau ou une reprise passagère est présenté comme normal, avec la brique de conseil adaptée (Phase 6).

## 5.3 Fonctionnalités

- Saisie d'un poids (`weightRepo.addEntry`), avec note optionnelle.
- Courbe : points bruts + moyenne mobile lissée. Sélecteur de période (30 j / 90 j / tout).
- Indicateurs : variation sur la période, progression vers le poids cible (si défini), rythme réel vs rythme visé.
- **Recalcul adaptatif** (Phase 1 §8) : quand le poids évolue significativement, recalculer BMR/TDEE/objectif. Ne notifier que si l'écart dépasse le seuil (éviter les micro-ajustements anxiogènes). Expliquer l'ajustement (« ton métabolisme estimé a légèrement baissé avec la perte de poids, voici ton nouvel objectif »).
- Détection de plateau (pas de tendance à la baisse sur X semaines malgré le déficit) → déclenche une brique de conseil dédiée en Phase 6.

## 5.4 Technique

- Courbe : `victory-native` ou équivalent React Native (composant graphique isolé dans `components/charts/`).
- Calculs (moyenne mobile, détection de plateau, rythme réel) dans le **domaine** (`domain/progress/`), purs et testés.
- Données via `weightRepo` (Phase 2).

## 5.5 Tests

- Domaine : moyenne mobile correcte, détection de plateau, calcul du rythme réel, seuil de recalcul.
- Intégration : saisie → courbe à jour (via `useLiveQuery`) ; recalcul déclenché au bon moment.

## 5.6 Définition de "terminé"

- [ ] Saisie de poids et courbe lissée fonctionnelles.
- [ ] Indicateurs de progression corrects.
- [ ] Recalcul adaptatif branché, notifié seulement au-delà du seuil, expliqué.
- [ ] Détection de plateau prête à alimenter la Phase 6.
- [ ] Ton et présentation conformes aux principes de santé mentale.

*Fin des phases 2 à 5.*
