# Brief structurel — Briques de conseil (Phase 6)

> **Complément de `PHASES_6_A_10.md` (Phase 6).**
> **Double usage :**
> 1. Pour **Claude Code** : la structure de données exacte (types stricts) du moteur de conseils.
> 2. Pour **toi (rédaction)** : la grille qui dit quelle brique écrire, pour qui, quand, et ce qu'elle doit dire — sans page blanche.
>
> Ce document définit **l'ossature et l'intention**, pas les textes finaux. La rédaction complète se fait ensuite, guidée par cette grille.

---

## 1. Rappel du principe (à ne jamais enfreindre)

- **Les chiffres viennent des formules, jamais des briques.** Une brique ne contient aucun nombre calculé en dur (pas de « ton objectif est 1800 kcal »). Elle explique, motive, contextualise. Les valeurs sont injectées à l'affichage par le domaine (Phase 1).
- **Les briques sont des données**, pas du code. Elles vivent dans `src/domain/advice/content/`.
- **Le moteur est déterministe** : mêmes entrées (profil + contexte) → mêmes briques.
- **Ton** : sobre, bienveillant, factuel, jamais culpabilisant. On respecte l'intelligence de l'utilisateur.

---

## 2. Les types (contrat pour Claude Code)

### 2.1 Topics

Un `topic` = un thème de conseil. Un seul topic peut être affiché à la fois (résolution de conflit par priorité).

```
type AdviceTopic =
  | 'understanding_deficit'   // comprendre le déficit calorique
  | 'protein'                 // importance des protéines
  | 'plateau'                 // gérer un palier
  | 'hunger_satiety'          // faim et satiété
  | 'hydration'               // hydratation
  | 'sleep'                   // sommeil et poids
  | 'alcohol'                 // alcool et perte de poids
  | 'weekends_slips'          // week-ends, imprévus, écarts
  | 'weight_vs_fat'           // perte de poids ≠ perte de graisse
  | 'recovery_after_slip'     // reprise après un écart
  | 'recomposition'           // spécificités recomposition
  | 'resistance_training'     // pourquoi la muscu en déficit
  | 'cardio_progression'      // progresser en cardio
  | 'weighing_fluctuations'   // comprendre les fluctuations de la balance
  | 'getting_started';        // premiers pas (nouvel utilisateur)
```

### 2.2 Tags (critères de sélection selon le profil)

Un tag = une condition sur le profil. Une brique est candidate si **tous** ses tags correspondent au profil (ET logique). Une brique sans tag s'applique à tout le monde.

```
type AdviceTag =
  // Objectif
  | 'goal:weight_loss' | 'goal:recomposition' | 'goal:maintenance'
  // Régime alimentaire
  | 'diet:omnivore' | 'diet:flexitarian' | 'diet:pescatarian'
  | 'diet:vegetarian' | 'diet:vegan'
  // Sport pratiqué
  | 'trains:strength' | 'trains:cardio' | 'trains:none'
  // Niveau d'activité
  | 'activity:low' | 'activity:moderate' | 'activity:high'
  // Ancienneté d'usage
  | 'user:new' | 'user:established';
```

> Les tags régime servent surtout à adapter les conseils protéines/recettes (ex. sources de protéines végétales pour `diet:vegan`).

### 2.3 Conditions contextuelles

Un `condition` = une règle sur la **situation courante**, pas sur le profil. Évaluée à partir de `AdviceContext`.

```
interface AdviceContext {
  isNewUser: boolean;             // onboarding récent
  daysSinceStart: number;
  plateauDetected: boolean;       // Phase 5 : pas de tendance à la baisse sur X sem
  recentSlipDetected: boolean;    // dépassement marqué récent
  weightTrend: 'down' | 'stable' | 'up' | 'insufficient_data';
  loggedTodayCount: number;       // engagement du jour
  hasWeighedThisWeek: boolean;
}

interface AdviceCondition {
  requires?: Partial<AdviceContext>;   // conditions à satisfaire pour afficher
}
```

### 2.4 La brique

```
interface AdviceBlock {
  id: string;
  topic: AdviceTopic;
  tags: AdviceTag[];
  priority: number;          // plus élevé = affiché en priorité si conflit
  title: string;             // FR
  body: string;              // FR — le texte que TU rédiges
  sources?: string[];        // références (crédibilité "vraie science")
  condition?: AdviceCondition;
}
```

---

## 3. Logique du moteur (rappel pour Claude Code)

`selectAdvice({ profile, context })` :
1. Garder les briques dont **tous** les `tags` matchent le profil.
2. Parmi elles, garder celles dont la `condition` est satisfaite par le `context` (une brique sans condition est toujours éligible).
3. Grouper par `topic` ; ne conserver que la brique de plus haute `priority` par topic.
4. Trier les topics retenus par priorité.
5. **Conseil du jour** = le topic de plus haute priorité pertinent à l'instant. **Section conseils** = tous les topics pertinents, regroupés.

Priorités indicatives (à affiner) : les conditions contextuelles fortes priment. Un `plateau` détecté ou un `recentSlip` doit passer devant un conseil générique. Le nouvel utilisateur voit d'abord `getting_started`.

---

## 4. Grille de rédaction (le cœur de ce brief)

Pour chaque brique : son intention (ce qu'elle doit dire), les tags/conditions de déclenchement, et une priorité indicative. **Tu rédiges le `body` à partir de la colonne « intention ».** Plusieurs variantes d'un même topic existent pour coller au profil.

> Convention d'`id` : `topic__variante` (ex. `protein__vegan`).

### 4.1 Topic : getting_started (nouvel utilisateur)

| id | tags | condition | priorité | intention (ce que le texte doit dire) |
|---|---|---|---|---|
| `getting_started__default` | — | `isNewUser: true` | 100 | Rassurer : les premiers jours servent à prendre l'habitude de logger. Pas besoin d'être parfait. Expliquer que la régularité prime sur la perfection. Inviter à logger un premier repas. |

### 4.2 Topic : understanding_deficit

| id | tags | condition | priorité | intention |
|---|---|---|---|---|
| `understanding_deficit__weight_loss` | `goal:weight_loss` | — | 60 | Expliquer simplement le déficit : consommer un peu moins que la dépense. Insister sur « modéré et durable » plutôt qu'agressif. Rappeler que c'est le principal levier de la perte (≈ 80 % du résultat). Sans chiffre en dur. |
| `understanding_deficit__recomp` | `goal:recomposition` | — | 55 | Expliquer qu'en recomposition on vise proche du maintien : perdre du gras et préserver/gagner du muscle simultanément, ce qui est plus lent sur la balance mais visible sur le corps. |

### 4.3 Topic : protein

| id | tags | condition | priorité | intention |
|---|---|---|---|---|
| `protein__omnivore` | `goal:weight_loss`, `diet:omnivore` | — | 50 | Pourquoi les protéines sont clés en déficit : préservent le muscle, rassasient. Sources animales et végétales courantes. |
| `protein__vegetarian` | `diet:vegetarian` | — | 50 | Idem, avec focus sources végétariennes (œufs, laitages, légumineuses, tofu). |
| `protein__vegan` | `diet:vegan` | — | 50 | Idem, sources 100 % végétales (légumineuses, tofu/tempeh, seitan, protéines de pois), et note sur la complémentarité. |
| `protein__recomp` | `goal:recomposition` | — | 52 | Protéines encore plus centrales en recomposition, réparties sur la journée, combinées à l'entraînement en résistance. |

### 4.4 Topic : plateau

| id | tags | condition | priorité | intention |
|---|---|---|---|---|
| `plateau__default` | — | `plateauDetected: true` | 90 | **Message clé, sensible.** Normaliser : un palier est fréquent et ne signifie pas un échec. Expliquer les causes possibles (adaptation, rétention d'eau, mesures). Rassurer avant de conseiller. Inviter à la patience et à la constance ; suggérer de vérifier la régularité du suivi avant tout ajustement. Ton déculpabilisant. |

### 4.5 Topic : weighing_fluctuations

| id | tags | condition | priorité | intention |
|---|---|---|---|---|
| `weighing_fluctuations__default` | — | — | 40 | Expliquer que le poids varie au jour le jour (eau, sel, digestion, cycle) et que la tendance sur plusieurs jours compte, pas le chiffre isolé. Renvoie à la courbe lissée. Réduit l'anxiété de la balance. |
| `weighing_fluctuations__reminder` | — | `hasWeighedThisWeek: false` | 45 | Rappel doux de se peser (hebdo) pour suivre la tendance, sans pression. |

### 4.6 Topic : hunger_satiety

| id | tags | condition | priorité | intention |
|---|---|---|---|---|
| `hunger_satiety__default` | `goal:weight_loss` | — | 42 | Gérer la faim en déficit : aliments rassasiants (protéines, fibres, volume), hydratation, régularité des repas. **Ne jamais** encourager à ignorer la faim ou à sous-manger sous le plancher. Message équilibré et sain. |

### 4.7 Topic : hydration

| id | tags | condition | priorité | intention |
|---|---|---|---|---|
| `hydration__default` | — | — | 20 | Rôle de l'hydratation dans la satiété et le bien-être. Repères simples, sans injonction excessive. |

### 4.8 Topic : sleep

| id | tags | condition | priorité | intention |
|---|---|---|---|---|
| `sleep__default` | — | — | 30 | Lien entre sommeil, appétit et récupération. Un mauvais sommeil augmente les fringales. Conseils de base sur la régularité du coucher. |

### 4.9 Topic : alcohol

| id | tags | condition | priorité | intention |
|---|---|---|---|---|
| `alcohol__default` | `goal:weight_loss` | — | 25 | Impact de l'alcool sur les calories et la perte de poids, factuel et sans moralisme. Comment l'intégrer avec modération sans faire dérailler l'objectif. |

### 4.10 Topic : weekends_slips

| id | tags | condition | priorité | intention |
|---|---|---|---|---|
| `weekends_slips__default` | `goal:weight_loss` | — | 35 | Les week-ends et imprévus font partie de la vie. Comment les anticiper sans culpabilité. La cohérence sur la semaine compte plus qu'un seul repas. |

### 4.11 Topic : recovery_after_slip

| id | tags | condition | priorité | intention |
|---|---|---|---|---|
| `recovery_after_slip__default` | — | `recentSlipDetected: true` | 85 | **Message clé, sensible.** Un écart n'annule pas les progrès. Pas de compensation punitive (ni jeûne, ni sur-sport). Reprendre simplement au repas suivant. Ton chaleureux, anti-culpabilité, anti-restriction. |

### 4.12 Topic : weight_vs_fat

| id | tags | condition | priorité | intention |
|---|---|---|---|---|
| `weight_vs_fat__default` | — | — | 38 | La balance mesure le poids total, pas la composition. On peut perdre du gras sans que la balance bouge (muscle, eau). Renvoie aux mesures et sensations, pas seulement au chiffre. |

### 4.13 Topic : recomposition

| id | tags | condition | priorité | intention |
|---|---|---|---|---|
| `recomposition__default` | `goal:recomposition` | — | 58 | Les trois piliers : entraînement en résistance, protéines élevées, déficit modéré. Pourquoi c'est plus lent sur la balance mais efficace sur le physique. Patience et constance. |

### 4.14 Topic : resistance_training

| id | tags | condition | priorité | intention |
|---|---|---|---|---|
| `resistance_training__weight_loss` | `goal:weight_loss`, `trains:strength` | — | 48 | Pourquoi garder la muscu en déficit : préserve la masse maigre, donc l'essentiel de la perte vient du gras. |
| `resistance_training__encourage` | `goal:weight_loss`, `trains:cardio` | — | 33 | Pour qui ne fait que du cardio : intérêt d'ajouter un peu de résistance pour préserver le muscle. Suggestion douce, pas d'injonction. |

### 4.15 Topic : cardio_progression

| id | tags | condition | priorité | intention |
|---|---|---|---|---|
| `cardio_progression__default` | `trains:cardio` | — | 34 | Progresser en cardio sans se blesser : augmenter le volume progressivement, alterner intensités, importance de la récupération. |

---

## 5. Règles de sécurité spécifiques au contenu

Ces briques touchent à la santé mentale et aux comportements alimentaires. Impératifs de rédaction :

- **Jamais** encourager à descendre sous le plancher calorique, à sauter des repas pour « rattraper », ou à compenser un écart par la restriction ou le sur-sport.
- **Jamais** de langage culpabilisant, moralisateur ou de type « bon/mauvais aliment », « tricher ».
- Les briques `plateau`, `recovery_after_slip`, `hunger_satiety` sont les plus sensibles : ton chaleureux, déculpabilisant, orienté durabilité.
- Là où c'est pertinent, rappeler avec tact que pour toute difficulté persistante (relation à l'alimentation, blocage), un professionnel de santé est la bonne ressource.
- Ces textes font partie de ceux à **faire revalider par un professionnel de santé** avant la prod (plan principal §15).

---

## 6. Ce qu'il reste à faire après ce brief

1. **Claude Code** implémente le moteur avec ces types exacts et un socle de briques (peut commencer avec des `body` provisoires).
2. **Toi** : rédiger les `body` définitifs en suivant la colonne « intention » de la grille. Chaque brique est courte (quelques phrases), sobre.
3. Ajouter des variantes au fil du temps (l'architecture le permet sans refonte) : nouvelles combinaisons régime/objectif, nouveaux topics.
4. Faire valider les briques sensibles par un professionnel de santé.

---

## 7. Récapitulatif : couverture initiale

15 topics, ~25 briques dans la grille ci-dessus pour le socle V1. C'est un volume **gérable** à rédiger (contrairement aux milliers de combinaisons qu'aurait produit l'approche « un texte par combinaison »), tout en couvrant les situations réelles des utilisateurs grâce à l'assemblage par tags et conditions.

*Fin du brief structurel des briques de conseil.*
