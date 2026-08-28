# Phases 6 à 10 — Spécifications détaillées

> **Complément de `PLAN_IMPLEMENTATION.md`.** Suite de `PHASES_2_A_5.md`.
> **Destiné à :** Claude Code.

---

# PHASE 6 — Moteur de conseils

## 6.1 Objectif

Ce qui distingue l'app d'un simple compteur : elle **conseille**. Implémenter le moteur qui assemble des briques de contenu selon le profil et la situation, et afficher un conseil pertinent au bon moment.

## 6.2 Architecture (rappel et détail)

Trois éléments, tous dans `src/domain/advice/` :

1. **Les briques** (`content/`) : contenu FR pré-rédigé, chacune taggée. Données pures, pas de logique.
2. **Le moteur** (`engine.ts`) : sélectionne et ordonne les briques pertinentes.
3. **Les règles** (`rules.ts`) : la logique de correspondance profil ↔ tags et de résolution des conflits.

**Découplage fondamental** (rappel Phase 1) : les chiffres (calories, macros, rythme) viennent des **formules**, jamais des briques. Les briques ne portent que du **texte explicatif et des conseils qualitatifs**. On n'écrit jamais « ton objectif est 1800 kcal » dans une brique ; on écrit « voici pourquoi un déficit modéré préserve tes muscles », et le chiffre est injecté par le calcul.

## 6.3 Modèle d'une brique

```
interface AdviceBlock {
  id: string;
  topic: AdviceTopic;           // ex: 'deficit', 'protein', 'plateau', 'sleep'...
  tags: AdviceTag[];            // critères de sélection (goalType, dietType, niveau, situation)
  priority: number;             // ordre d'affichage
  title: string;                // FR
  body: string;                 // FR, sobre, pédagogique
  sources?: string[];           // références (crédibilité "vraie science")
  conditions?: AdviceCondition; // règle logique optionnelle (ex: afficher si plateau détecté)
}
```

`AdviceTopic`, `AdviceTag`, `AdviceCondition` sont des types stricts (unions), pas des chaînes libres — pour que le typage garantisse la cohérence et évite les fautes de frappe silencieuses.

## 6.4 Le moteur

```
function selectAdvice(input: {
  profile: UserProfile;
  context: AdviceContext;   // situation courante : plateau détecté ? nouvel utilisateur ?
                            // écart récent ? progression régulière ? etc.
}): AdviceBlock[]
```

Logique (dans `rules.ts`) :
- Filtrer les briques dont les `tags` correspondent au profil.
- Évaluer les `conditions` contextuelles (ex. brique « plateau » affichée seulement si `context.plateauDetected`).
- Résoudre les conflits : au plus une brique par `topic` à la fois (la plus prioritaire / pertinente).
- Trier par `priority`.
- **Déterministe** : mêmes entrées → mêmes conseils. Testable intégralement.

## 6.5 Périmètre de contenu (V1, itératif)

Topics prioritaires à couvrir, chacun décliné en plusieurs briques selon le profil : comprendre son déficit, importance des protéines, gérer un plateau, faim et satiété, hydratation, sommeil et poids, alcool, week-ends et imprévus, différence perte de poids / perte de graisse, reprise après un écart, spécificités recomposition.

> **Ce contenu se construit progressivement.** L'architecture permet d'ajouter des briques en continu sans refonte. Un chantier de rédaction séparé (voir document dédié à venir) alimentera ce dossier. En Phase 6, on livre le moteur + un socle initial de briques couvrant les topics prioritaires.

## 6.6 Affichage

- **Conseil du jour** sur le tableau principal : une brique mise en avant, choisie par le moteur selon la situation.
- **Section conseils** dédiée : les briques pertinentes, regroupées par thème, consultables à tout moment.
- Ton sobre, pas de notification intrusive. Le conseil s'affiche, il ne harcèle pas.

## 6.7 Tests

- Moteur : chaque combinaison profil + contexte → briques attendues.
- Déterminisme vérifié.
- Conditions contextuelles (plateau, nouvel utilisateur, écart) déclenchent les bonnes briques.
- Aucune brique ne contient de chiffre calculé en dur (contrôle de contenu).

## 6.8 Définition de "terminé"

- [ ] Moteur déterministe implémenté et testé exhaustivement.
- [ ] Types stricts pour topics/tags/conditions.
- [ ] Socle initial de briques couvrant les topics prioritaires.
- [ ] Conseil du jour + section conseils affichés.
- [ ] Séparation stricte chiffres (formules) / texte (briques) respectée.

---

# PHASE 7 — Recettes

## 7.1 Objectif

Proposer des idées de recettes adaptées aux goûts, au régime et aux contraintes de l'utilisateur, et permettre de les logger directement au journal.

## 7.2 Modèle

```
interface Recipe {
  id: string;
  name: string;
  tags: RecipeTag[];          // régime, goûts, temps de prépa, difficulté, macros dominantes
  dietTypes: DietType[];      // compatibilité régime
  allergens: string[];        // pour exclusion
  ingredients: RecipeIngredient[];
  steps: string[];
  prepTimeMin: number;
  difficulty: 'easy' | 'medium' | 'hard';
  nutrition: MacroResult & { kcal: number }; // calculé depuis les ingrédients
  imageUrl?: string;
}
```

## 7.3 Filtrage (domaine pur)

```
function filterRecipes(input: {
  recipes: Recipe[];
  profile: UserProfile;
}): Recipe[]
```

Logique (`domain/recipes/filter.ts`) :
- **Exclure** les recettes contenant un allergène de `profile.allergies` (règle dure, sécurité).
- **Exclure** les recettes contenant un aliment de `profile.dislikes`.
- **Respecter** `profile.dietType` (une recette non végane est exclue pour un utilisateur végane).
- **Respecter** le temps disponible si renseigné.
- **Ordonner** par pertinence : préférences positives, macros alignées avec l'objectif (ex. mettre en avant les recettes riches en protéines en déficit).
- Fonction pure, testée.

## 7.4 Nutrition des recettes

- Les valeurs nutritionnelles sont **calculées depuis les ingrédients** (cohérence avec le journal), pas saisies à la main.
- Logger une recette = créer une entrée de journal avec snapshot (Phase 2 §2.4), comme un repas prédéfini.

## 7.5 Contenu V1

- Catalogue de recettes **pré-rédigées et validées** (pas de génération IA en V1, conformément au périmètre).
- Stockées en données locales (bundlées avec l'app, ou synchronisées depuis le backend en Phase 9).
- Volume initial à définir (voir plan principal §15) ; l'architecture ne dépend pas du volume.

## 7.6 Écrans

- Liste de recettes filtrées pour l'utilisateur, avec image, temps, difficulté, macros clés.
- Détail d'une recette : ingrédients, étapes, nutrition, bouton « ajouter au journal ».
- Filtres manuels complémentaires (temps, type de repas) par-dessus le filtrage automatique.

## 7.7 Tests

- Filtrage : allergènes toujours exclus (test de sécurité), régime respecté, tri correct.
- Calcul nutritionnel d'une recette cohérent avec la somme des ingrédients.
- Log d'une recette → entrée de journal correcte.

## 7.8 Définition de "terminé"

- [ ] Filtrage par profil fonctionnel, exclusion allergènes garantie et testée.
- [ ] Nutrition calculée depuis les ingrédients.
- [ ] Log direct d'une recette au journal.
- [ ] Catalogue initial en place.

---

# PHASE 8 — Sport

## 8.1 Objectif

Accompagner l'utilisateur dans son activité physique selon son profil : cardio (marche, course, vélo) et musculation (salle + maison), avec journalisation et intégration au bilan énergétique.

## 8.2 Rappel architectural : deux natures distinctes

Comme posé au plan principal (§4.4), **cardio et musculation ne se modélisent pas pareil.** On les traite séparément dans le domaine et dans l'UI, ils se rejoignent seulement dans le journal des séances et le bilan calorique.

## 8.3 Cardio / endurance

- **Saisie** : activité (marche/course/vélo) + durée (+ distance/allure/intensité optionnelles).
- **Dépense** estimée via METs (Phase 1 §7.1). Résolution du MET selon l'allure/intensité via la table de référence.
- **Progression** : cadres via briques de conseil dédiées (Phase 6) — volume hebdomadaire, zones d'intensité, augmentation progressive. Pas de « programme » rigide : des repères adaptables.
- Intégration au bilan selon le `calorieMode` (Phase 1 §7.2).

## 8.4 Musculation / recomposition

- **V1 = noyau solide, pas exhaustif.** Bibliothèque d'exercices couvrant les grands patterns moteurs (poussée horizontale/verticale, tirage horizontal/vertical, dominante genou, dominante hanche, gainage), en versions `equipment: 'none'` (maison) et `equipment: 'gym'` (salle).

```
interface Exercise {
  id: string;
  name: string;
  muscleGroups: MuscleGroup[];
  equipment: 'none' | 'gym';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  mediaUrl?: string;          // démonstration
  instructions: string[];     // exécution correcte + sécurité
}

interface Program {
  id: string;
  name: string;
  split: 'full_body' | 'upper_lower' | 'push_pull_legs';
  daysPerWeek: number;
  level: 'beginner' | 'intermediate' | 'advanced';
  sessions: ProgramSession[];
}
```

- **Programmes** : full-body 3×/sem pour débutants, splits pour intermédiaires. Sélection/adaptation selon `profile` (jours dispo, niveau, matériel).
- **Progression** (`domain/training/progression.ts`) : règles de progression de charge/répétitions (ex. double progression), pures et testées.
- **Journalisation** : séries × répétitions × charge par exercice ; historique ; progression visible dans le temps.

## 8.5 Science de la recomposition (cohérence avec le positionnement)

- L'app met en avant que la recomposition repose sur : entraînement en résistance + apport protéique élevé (Phase 1 §6) + déficit modéré (Phase 1 §5). Les briques de conseil (Phase 6) portent ce message. Les chiffres viennent des formules.
- L'entraînement en résistance est présenté comme le levier de **préservation de la masse maigre** pendant la perte — cohérent avec la littérature.

## 8.6 Extension future (architecture prête)

Ajouter des exercices salle, de nouveaux sports, du matériel = **nouvelles données taggées** (`Exercise`, `Program`), sans changement d'architecture. La V2 « salle complète » est un ajout de contenu, pas une refonte.

## 8.7 Écrans

- **Cardio** : saisie rapide d'une séance, estimation calorique, repères de progression.
- **Muscu** : programme du jour, exécution guidée (exercice, séries/reps/charge cibles, saisie du réalisé), historique et courbes de progression.
- **Journal des séances** unifié, alimentant le bilan.

## 8.8 Tests

- Domaine : estimation METs (valeurs de référence), règles de progression, sélection de programme selon profil.
- Intégration : journalisation d'une séance, intégration au bilan selon le mode.

## 8.9 Définition de "terminé"

- [ ] Cardio : saisie + estimation + repères de progression.
- [ ] Muscu : bibliothèque noyau (maison + salle), programmes, progression, journalisation.
- [ ] Intégration au bilan énergétique selon le `calorieMode`.
- [ ] Architecture prête pour l'extension (contenu taggé).

---

# PHASE 9 — Backend & synchronisation

## 9.1 Objectif

Ajouter les comptes, la sauvegarde serveur, le multi-appareils et la conformité (export/suppression). **Par-dessus** le local-first existant, sans le remettre en cause : l'app doit rester pleinement utilisable offline.

## 9.2 Stack backend (validée, à isoler)

- **Supabase** : Auth + Postgres + Storage.
- **Isolé derrière une couche `data/remote/supabase.ts`** et les repositories. Supabase reste un détail d'implémentation remplaçable ; le reste de l'app ne le connaît pas directement.

## 9.3 Authentification

- Méthodes : email/mot de passe au minimum ; envisager OAuth (Apple obligatoire si autres providers sociaux sur iOS, Google) selon les règles des stores.
- **Connexion sans compte possible** : l'app doit fonctionner en local avant/ sans création de compte (le compte sert à sauvegarder/synchroniser, pas à débloquer l'usage de base). Le profil local est rattaché au compte à la création.
- Gestion des sessions, refresh tokens, déconnexion, suppression de compte.

## 9.4 Modèle serveur & sécurité

- Schéma Postgres miroir des entités locales (profil, journal, poids, séances, aliments maison, repas).
- **Row Level Security (RLS) strict** : chaque utilisateur n'accède qu'à ses propres lignes. Politique testée (un utilisateur ne peut jamais lire les données d'un autre).
- Données de santé sensibles : chiffrement au repos, minimisation de ce qui est envoyé.
- Les recettes et le catalogue d'exercices (contenu partagé, non personnel) peuvent être servis en lecture publique/authentifiée.

## 9.5 Synchronisation local ↔ serveur

- Modèle : **local-first avec synchro en arrière-plan.** Le local est la source de vérité pour l'usage ; le serveur est la sauvegarde et le point de partage multi-appareils.
- Utiliser `sync_meta` (Phase 2 §2.4 : `dirty`, `updatedAt`, `syncedAt`) pour la **synchro incrémentale** : ne pousser/tirer que ce qui a changé.
- **Résolution de conflits** : stratégie explicite et documentée (ex. last-write-wins horodaté pour les entrées simples ; pour les données à risque de conflit, règle par entité). Documenter le choix pour chaque type de données.
- Synchro déclenchée : au démarrage (si réseau), après modification (débounce), en background si possible.
- **Robustesse offline** : les modifications hors ligne sont marquées `dirty` et poussées à la reconnexion. Aucune perte de données.

## 9.6 Conformité RGPD (implémentation)

- **Export des données** : l'utilisateur peut télécharger l'ensemble de ses données dans un format lisible (JSON).
- **Suppression du compte** : efface le compte et **toutes** les données associées, serveur **et** local. Confirmation explicite. Irréversible et clairement annoncé.
- Consentement (Phase 3) rattaché au compte, horodaté.
- Journalisation des accès conforme, politique de rétention définie.

## 9.7 Tests

- RLS : tests prouvant l'isolation entre utilisateurs.
- Synchro : scénarios offline → online, conflits, reprise après coupure ; aucune perte ni doublon.
- Export/suppression : complétude vérifiée (rien n'est oublié).

## 9.8 Définition de "terminé"

- [ ] Auth fonctionnelle, usage local possible sans compte, rattachement à la création.
- [ ] RLS strict, isolation prouvée par les tests.
- [ ] Synchro incrémentale robuste offline↔online, conflits gérés, sans perte.
- [ ] Export et suppression complets (serveur + local).
- [ ] Supabase isolé derrière la couche data.

---

# PHASE 10 — Durcissement & mise en production

## 10.1 Objectif

Amener l'app à un niveau publiable : tests de parcours, accessibilité, performance, sécurité, écrans légaux, build et soumission aux stores.

## 10.2 Tests end-to-end (Maestro)

Couvrir les parcours critiques de bout en bout :
- Onboarding complet → écran principal.
- Logger un repas (scan + recherche + manuel).
- Enregistrer un poids et voir la courbe.
- Enregistrer une séance de sport.
- Créer un compte, se déconnecter, se reconnecter, retrouver ses données.
- Exporter puis supprimer ses données.

## 10.3 Accessibilité

- Labels d'accessibilité sur tous les éléments interactifs.
- Contrastes conformes (WCAG AA), tailles de police respectant les réglages système (Dynamic Type).
- Navigation au lecteur d'écran testée sur les parcours principaux.
- Cibles tactiles suffisantes.

## 10.4 Performance

- Temps de démarrage maîtrisé (migrations SQLite non bloquantes perçues, écran de chargement propre).
- Listes virtualisées (journal, recettes, exercices) pour rester fluides.
- Images optimisées et mises en cache.
- Pas de requête réseau sur le chemin critique quand le cache suffit.
- Profilage sur appareil bas de gamme, pas seulement sur simulateur.

## 10.5 Sécurité & confidentialité (revue finale)

- Revue RGPD complète : consentement, minimisation, chiffrement au repos des données sensibles locales, export, suppression.
- Revue RLS et règles Supabase.
- Secrets hors du code (variables d'environnement, EAS secrets), aucune clé en dur.
- Sentry configuré pour **ne pas** capturer de données de santé personnelles dans les logs d'erreur.

## 10.6 Écrans légaux et de confiance

- **Politique de confidentialité** claire, en français.
- **Conditions d'utilisation.**
- **Disclaimer santé** visible : l'app informe et accompagne, **ne remplace pas un professionnel de santé** et ne pose aucun diagnostic. Les objectifs et calculs sont des estimations.
- **Attribution Open Food Facts** (obligation ODbL).
- Mention des garde-fous et orientation vers des ressources d'aide (troubles alimentaires) là où c'est pertinent.

## 10.7 Validation santé (préalable non négociable)

- **Faire revalider par un professionnel de santé** les seuils de sécurité, les formules et le ton des messages sensibles (plancher calorique, rythme, détection de signaux à risque, messages en cas d'objectif à risque), conformément au plan principal §15 et à la Phase 1 §12.
- Cette validation externe conditionne la mise en production. Ce n'est pas une formalité.

## 10.8 Build & soumission

- **EAS Build** : builds de production iOS + Android.
- **EAS Submit** : soumission aux stores.
- Fiches stores : descriptions, captures, mots-clés, catégorie santé/fitness (attention aux politiques spécifiques santé d'Apple et Google).
- Configuration des mises à jour OTA (Expo Updates) pour les correctifs sans re-soumission.
- Monitoring en place (Sentry, PostHog) avant le lancement.

## 10.9 Définition de "terminé"

- [ ] E2E des parcours critiques verts.
- [ ] Accessibilité, performance, sécurité revues et conformes.
- [ ] Écrans légaux + disclaimer santé + attribution OFF en place.
- [ ] Validation santé externe obtenue.
- [ ] Builds de production générés, fiches stores prêtes, monitoring actif.
- [ ] App soumise.

---

# Post-V1 (préparé, non implémenté)

Rappel des extensions que l'architecture anticipe sans les implémenter : freemium/paiement, objets connectés (montres, balances Bluetooth), bibliothèque salle étendue, fonctions sociales, personnalisation par IA. Chacune s'ajoute sur les fondations posées, sans refonte.

*Fin des phases 6 à 10.*
