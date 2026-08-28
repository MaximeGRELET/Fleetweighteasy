# Données sport — Référence (V1)

> **Complément de `PHASES_6_A_10.md` (Phase 8) et `PHASE_1_DOMAINE_NUTRITIONNEL.md` (§7, METs).**
> Deux jeux de données de référence : la **table METs** (cardio) et le **noyau d'exercices** (musculation).
> À intégrer dans `src/domain/nutrition/mets-table.ts` et `src/domain/training/`.

---

## PARTIE A — Table METs (cardio)

### A.1 Principe et formule

Un **MET** (Metabolic Equivalent of Task) est le rapport entre la dépense d'une activité et la dépense au repos. 1 MET ≈ l'énergie dépensée assis au repos (≈ 3,5 ml O₂/kg/min).

**Formule de dépense retenue :**

```
kcal = MET × poidsKg × duréeHeures
```

Exemple de contrôle : personne de 70 kg, marche à 4,8 MET pendant 30 min → 4,8 × 70 × 0,5 = **168 kcal**. (Cohérent avec la référence Compendium.)

### A.2 ⚠️ Prudence obligatoire (ton de l'app)

Ces valeurs sont des **estimations de planification**, pas des mesures. Le terrain, la pente, la forme physique, le vent, la charge et les pauses modifient la dépense réelle, souvent à la baisse. Cette imprécision est **la raison même** pour laquelle le mode calories par défaut est `fixed` (le sport n'est pas recrédité). L'app affiche toujours ces chiffres comme indicatifs.

### A.3 Valeurs METs — source : 2024 Adult Compendium of Physical Activities

Structurées par activité et par intensité/allure. Claude Code résout le MET selon l'allure/intensité saisie ou choisie par l'utilisateur.

```
// src/domain/nutrition/mets-table.ts
```

**Marche**

| id | description | allure | MET |
|---|---|---|---|
| `walk_slow` | Marche lente, plate | ~3,2 km/h | 2.8 |
| `walk_moderate` | Marche modérée, plate | ~4,5-5,5 km/h | 3.5 |
| `walk_brisk` | Marche rapide | ~5,6-6,4 km/h | 4.8 |
| `walk_very_brisk` | Marche très rapide | ~6,5-7,2 km/h | 6.3 |
| `walk_uphill` | Marche en montée, effort soutenu | — | 7.0 |

**Course à pied**

| id | description | allure | MET |
|---|---|---|---|
| `run_jog_light` | Footing léger | ~6-7 km/h | 6.0 |
| `run_general` | Course, allure libre | ~8 km/h | 7.5 |
| `run_moderate` | Course modérée | ~9,5-10 km/h | 9.3 |
| `run_fast` | Course rapide | ~11-12 km/h | 11.0 |
| `run_very_fast` | Course très rapide | ~13-14 km/h | 13.5 |

**Vélo (extérieur)**

| id | description | allure | MET |
|---|---|---|---|
| `bike_light` | Loisir, allure tranquille | <16 km/h | 4.0 |
| `bike_moderate` | Effort modéré | ~19-22 km/h | 8.0 |
| `bike_vigorous` | Effort soutenu | ~23-25 km/h | 10.0 |
| `bike_fast` | Rapide / sportif | ~26-30 km/h | 12.0 |

**Vélo (appartement / home-trainer)**

| id | description | intensité | MET |
|---|---|---|---|
| `bike_stationary_light` | Résistance faible | léger | 5.5 |
| `bike_stationary_moderate` | Résistance modérée | modéré | 7.0 |
| `bike_stationary_vigorous` | Résistance élevée | soutenu | 10.5 |

> **Note recomposition / muscu :** à titre indicatif, une séance de musculation générale vaut ~3,5 MET (≈ 5-6 MET si intense avec peu de repos). En V1, la muscu n'est pas estimée en calories via METs (elle vise la composition, pas la dépense) — mais la valeur est notée si tu veux l'afficher plus tard.

### A.4 Type pour Claude Code

```
interface MetEntry {
  id: string;
  activity: 'walking' | 'running' | 'cycling';
  environment?: 'outdoor' | 'stationary';
  label: string;          // FR, affiché à l'utilisateur
  met: number;
}

function estimateCardioKcal(input: {
  metValue: number;
  weightKg: number;
  durationMin: number;
}): number {
  return Math.round(input.metValue * input.weightKg * (input.durationMin / 60));
}
```

---

## PARTIE B — Noyau d'exercices (musculation)

### B.1 Principe

**V1 = noyau solide, pas exhaustif.** ~30 exercices couvrant tous les grands patterns moteurs, en versions `none` (maison, sans matériel) et `gym` (salle). L'objectif est de pouvoir bâtir des programmes complets (full-body, split) pour débutants et intermédiaires. L'extension (salle complète, matériel varié) se fait en ajoutant des données taggées, sans refonte.

### B.2 Patterns moteurs couverts

Poussée horizontale, poussée verticale, tirage horizontal, tirage vertical, dominante genou (quadriceps), dominante hanche (chaîne postérieure), fentes/unilatéral, gainage/tronc, mollets. Un programme équilibré pioche dans chacun.

### B.3 Type pour Claude Code

```
interface Exercise {
  id: string;
  name: string;              // FR
  pattern: MovementPattern;
  muscleGroups: MuscleGroup[];
  equipment: 'none' | 'gym';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  instructions: string[];    // exécution + sécurité, FR
  mediaUrl?: string;         // démonstration (à fournir plus tard)
}

type MovementPattern =
  | 'horizontal_push' | 'vertical_push'
  | 'horizontal_pull' | 'vertical_pull'
  | 'knee_dominant' | 'hip_dominant'
  | 'lunge' | 'core' | 'calves';

type MuscleGroup =
  | 'chest' | 'shoulders' | 'triceps' | 'back' | 'biceps'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'abs';
```

### B.4 Liste des exercices

#### Maison (equipment: none)

| id | nom | pattern | muscles | niveau |
|---|---|---|---|---|
| `pushup` | Pompes | horizontal_push | chest, triceps, shoulders | beginner |
| `incline_pushup` | Pompes inclinées (sur support) | horizontal_push | chest, triceps | beginner |
| `pike_pushup` | Pompes piquées | vertical_push | shoulders, triceps | intermediate |
| `bodyweight_row` | Rowing sous table / australien | horizontal_pull | back, biceps | beginner |
| `superman` | Superman (extension dorsale) | horizontal_pull | back, glutes | beginner |
| `bodyweight_squat` | Squat au poids du corps | knee_dominant | quads, glutes | beginner |
| `split_squat` | Fente bulgare (pied surélevé) | lunge | quads, glutes | intermediate |
| `walking_lunge` | Fentes marchées | lunge | quads, glutes | beginner |
| `glute_bridge` | Pont fessier | hip_dominant | glutes, hamstrings | beginner |
| `single_leg_rdl` | Soulevé de terre unilatéral (sans charge) | hip_dominant | hamstrings, glutes | intermediate |
| `plank` | Gainage planche | core | abs | beginner |
| `side_plank` | Gainage latéral | core | abs | beginner |
| `dead_bug` | Dead bug | core | abs | beginner |
| `calf_raise_bw` | Extensions mollets debout | calves | calves | beginner |

#### Salle (equipment: gym)

| id | nom | pattern | muscles | niveau |
|---|---|---|---|---|
| `barbell_bench_press` | Développé couché barre | horizontal_push | chest, triceps, shoulders | intermediate |
| `dumbbell_bench_press` | Développé couché haltères | horizontal_push | chest, triceps | beginner |
| `overhead_press` | Développé militaire | vertical_push | shoulders, triceps | intermediate |
| `dumbbell_shoulder_press` | Développé épaules haltères | vertical_push | shoulders, triceps | beginner |
| `seated_row` | Rowing assis à la poulie | horizontal_pull | back, biceps | beginner |
| `dumbbell_row` | Rowing haltère | horizontal_pull | back, biceps | beginner |
| `lat_pulldown` | Tirage vertical à la poulie | vertical_pull | back, biceps | beginner |
| `assisted_pullup` | Traction assistée | vertical_pull | back, biceps | intermediate |
| `barbell_squat` | Squat barre | knee_dominant | quads, glutes | intermediate |
| `leg_press` | Presse à cuisses | knee_dominant | quads, glutes | beginner |
| `romanian_deadlift` | Soulevé de terre roumain | hip_dominant | hamstrings, glutes | intermediate |
| `leg_curl` | Leg curl (ischios) | hip_dominant | hamstrings | beginner |
| `dumbbell_lunge` | Fentes haltères | lunge | quads, glutes | beginner |
| `cable_crunch` | Crunch à la poulie | core | abs | beginner |
| `machine_calf_raise` | Extensions mollets machine | calves | calves | beginner |
| `bicep_curl` | Curl biceps | horizontal_pull | biceps | beginner |
| `triceps_pushdown` | Extension triceps poulie | horizontal_push | triceps | beginner |

> Instructions d'exécution (`instructions[]`) à rédiger par exercice : 2-4 puces, exécution correcte + point de sécurité clé. À faire au moment de l'intégration ou en chantier séparé (comme les briques). Les démos vidéo (`mediaUrl`) viendront plus tard.

### B.5 Programmes (structure)

```
interface Program {
  id: string;
  name: string;
  split: 'full_body' | 'upper_lower' | 'push_pull_legs';
  daysPerWeek: number;
  level: 'beginner' | 'intermediate' | 'advanced';
  equipment: 'none' | 'gym';
  sessions: ProgramSession[];
}

interface ProgramSession {
  name: string;               // ex: "Full body A"
  exercises: ProgramExercise[];
}

interface ProgramExercise {
  exerciseId: string;
  sets: number;
  repRange: [number, number]; // ex: [8, 12]
  restSec: number;
}
```

**Programmes du socle V1 (à décliner maison + salle) :**

1. **Full-body débutant, 3 j/sem** — la base recommandée pour la plupart des utilisateurs. Chaque séance couvre tous les patterns : une poussée, un tirage, un dominante genou, un dominante hanche, un gainage.
2. **Upper/Lower intermédiaire, 4 j/sem** — pour ceux qui veulent plus de volume.
3. **Push/Pull/Legs, 3-6 j/sem** — pour intermédiaires avancés (salle surtout).

Le moteur (`domain/training/programs.ts`) sélectionne le programme selon `profile` (jours dispo, niveau, matériel).

### B.6 Progression (règle)

`domain/training/progression.ts` — **double progression** (règle simple et éprouvée) :
- L'utilisateur vise une fourchette de répétitions (ex. 8-12).
- Quand il atteint le haut de la fourchette sur toutes les séries, il augmente la charge (salle) ou la difficulté / le nombre de reps (maison) à la séance suivante.
- Fonction pure, testée : entrée = performance de la séance, sortie = cible de la prochaine.

---

## PARTIE C — Étapes suivantes

1. **Claude Code** : intégrer la table METs (`mets-table.ts`) et `estimateCardioKcal` ; intégrer les exercices, programmes et la règle de progression.
2. **Chantier de contenu** (comme les briques) : rédiger les `instructions[]` de chaque exercice (exécution + sécurité).
3. Ajouter les démos vidéo (`mediaUrl`) plus tard.
4. **Étendre** exercices et programmes au fil du temps (données taggées, sans refonte).

## Note de sécurité

- Les instructions d'exécution doivent inclure un **point de sécurité** par exercice (dos neutre, amplitude contrôlée, etc.).
- L'app recommande d'adapter les charges à son niveau et, en cas de douleur ou de condition particulière, de consulter un professionnel. Disclaimer sport à inclure (cohérent avec le disclaimer santé, Phase 10).

*Fin des données sport V1.*
