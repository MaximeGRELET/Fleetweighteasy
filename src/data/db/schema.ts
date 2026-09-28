import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

/**
 * Schéma SQLite local — source de vérité de l'application (local-first).
 *
 * Conventions :
 * - Les identifiants sont des UUID texte, générés côté client : ils resteront
 *   valides quand la synchro serveur arrivera (Phase 9), sans renumérotation.
 * - Les dates civiles sont stockées en `YYYY-MM-DD`, les horodatages en ISO 8601
 *   UTC. Texte plutôt qu'entier : lisible en debug et trié correctement par SQLite.
 * - Les booléens sont des entiers 0/1 (`mode: 'boolean'` côté Drizzle).
 * - Aucune valeur calculée par le domaine n'est stockée figée, à une exception
 *   près et assumée : le snapshot nutritionnel du journal (voir `foodLogEntry`).
 */

// --- Profil ----------------------------------------------------------------

/**
 * Profil de l'utilisateur local : **une seule ligne**, contrainte par
 * `id = 1`. Les objectifs (calories, macros) ne sont pas stockés : ils se
 * recalculent depuis le profil via le domaine, seule source de vérité.
 */
export const profile = sqliteTable(
  'profile',
  {
    id: integer('id').primaryKey(),

    // Biométrie
    sex: text('sex', { enum: ['male', 'female'] }).notNull(),
    birthDate: text('birth_date').notNull(),
    heightCm: real('height_cm').notNull(),
    currentWeightKg: real('current_weight_kg').notNull(),

    // Objectif
    goalType: text('goal_type', {
      enum: ['weight_loss', 'recomposition', 'maintenance'],
    }).notNull(),
    targetWeightKg: real('target_weight_kg'),
    weeklyRateKg: real('weekly_rate_kg'),

    // Activité & sport
    activityLevel: text('activity_level', {
      enum: ['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active'],
    }).notNull(),
    trainingDaysPerWeek: integer('training_days_per_week').notNull(),
    /** JSON : `{ practices, strengthEnvironments, cardioActivities }`. */
    sportProfile: text('sport_profile'),

    // Alimentation (listes sérialisées en JSON : jamais interrogées en SQL)
    dietType: text('diet_type', {
      enum: ['omnivore', 'flexitarian', 'pescatarian', 'vegetarian', 'vegan'],
    }).notNull(),
    allergies: text('allergies').notNull(),
    dislikes: text('dislikes').notNull(),

    // Réglages
    calorieMode: text('calorie_mode', { enum: ['fixed', 'credited'] }).notNull(),

    // Métadonnées
    onboardingCompleted: integer('onboarding_completed', { mode: 'boolean' }).notNull(),
    /**
     * Poids à partir duquel l'objectif affiché a été annoncé pour la dernière
     * fois (Phase 5).
     *
     * C'est la base de comparaison du recalcul adaptatif, et elle ne peut pas
     * être dérivée : elle dépend de l'historique des messages effectivement
     * montrés. Sans elle, chaque recalcul se comparerait au précédent, et une
     * perte régulière ferait dériver l'objectif de dizaines de kcal sans jamais
     * franchir le seuil de notification à un pas donné.
     *
     * Nullable : un profil antérieur à cette colonne retombe sur
     * `currentWeightKg`, qui est bien le poids de la dernière restitution.
     */
    lastNotifiedWeightKg: real('last_notified_weight_kg'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [check('profile_single_row', sql`${table.id} = 1`)],
);

/**
 * Consentement explicite aux données de santé (RGPD).
 *
 * Table distincte du profil, et non une colonne de celui-ci : le consentement
 * est recueilli **avant** toute collecte biométrique (Phase 3 §3.4), donc avant
 * qu'une ligne de profil puisse exister. `policyVersion` permet de redemander
 * le consentement quand la politique de confidentialité change.
 */
export const consent = sqliteTable(
  'consent',
  {
    id: integer('id').primaryKey(),
    grantedAt: text('granted_at').notNull(),
    policyVersion: text('policy_version').notNull(),
  },
  (table) => [check('consent_single_row', sql`${table.id} = 1`)],
);

// --- Aliments --------------------------------------------------------------

/**
 * Cache des aliments : produits Open Food Facts consultés (Phase 4) et
 * aliments maison. Le cache est ce qui rend le journal utilisable hors ligne.
 */
export const foodItem = sqliteTable(
  'food_item',
  {
    id: text('id').primaryKey(),
    source: text('source', { enum: ['off', 'custom'] }).notNull(),
    barcode: text('barcode'),
    name: text('name').notNull(),
    brand: text('brand'),

    // Valeurs pour 100 g / 100 ml
    kcalPer100: real('kcal_per_100').notNull(),
    proteinGPer100: real('protein_g_per_100').notNull(),
    carbsGPer100: real('carbs_g_per_100').notNull(),
    fatGPer100: real('fat_g_per_100').notNull(),
    fiberGPer100: real('fiber_g_per_100'),
    sugarGPer100: real('sugar_g_per_100'),
    saturatedFatGPer100: real('saturated_fat_g_per_100'),
    sodiumMgPer100: real('sodium_mg_per_100'),

    /** Portions usuelles, JSON : `[{ label, grams }]`. */
    servingSizes: text('serving_sizes').notNull(),
    /**
     * Indicateur de fiabilité : Open Food Facts est collaboratif et ses données
     * sont parfois incomplètes (PLAN_IMPLEMENTATION §6.2). L'UI l'affiche.
     */
    verified: integer('verified', { mode: 'boolean' }).notNull(),
    cachedAt: text('cached_at').notNull(),
  },
  (table) => [
    index('food_item_barcode_idx').on(table.barcode),
    index('food_item_name_idx').on(table.name),
  ],
);

/** Repas prédéfini : une composition réutilisable, loggée en un tap. */
export const meal = sqliteTable('meal', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  /** JSON : `[{ foodItemId, quantityG }]`. */
  items: text('items').notNull(),
  createdAt: text('created_at').notNull(),
});

// --- Journal ---------------------------------------------------------------

/**
 * Entrée du journal alimentaire.
 *
 * ⚠️ DÉCISION DE CONCEPTION CENTRALE — le snapshot nutritionnel.
 *
 * Les colonnes `*_snapshot` figent les valeurs nutritionnelles **au moment de
 * l'ajout**, pour la quantité effectivement consommée. Si un produit Open Food
 * Facts est corrigé six mois plus tard, ou si l'utilisateur modifie un aliment
 * maison, l'historique ne bouge pas : le passé est immuable.
 *
 * Conséquences assumées :
 * - les totaux du jour se calculent en sommant les snapshots, jamais en
 *   rejoignant `food_item` ;
 * - `food_item_id` / `meal_id` sont `ON DELETE SET NULL` : supprimer un aliment
 *   ne détruit pas l'historique, il en coupe seulement la référence ;
 * - `name_snapshot` permet d'afficher l'entrée même sans source.
 */
export const foodLogEntry = sqliteTable(
  'food_log_entry',
  {
    id: text('id').primaryKey(),
    date: text('date').notNull(),
    mealType: text('meal_type', {
      enum: ['breakfast', 'lunch', 'dinner', 'snack'],
    }).notNull(),

    foodItemId: text('food_item_id').references(() => foodItem.id, { onDelete: 'set null' }),
    mealId: text('meal_id').references(() => meal.id, { onDelete: 'set null' }),
    quantityG: real('quantity_g').notNull(),

    // Snapshot : valeurs pour la quantité loggée, figées à l'ajout.
    nameSnapshot: text('name_snapshot').notNull(),
    kcalSnapshot: real('kcal_snapshot').notNull(),
    proteinGSnapshot: real('protein_g_snapshot').notNull(),
    carbsGSnapshot: real('carbs_g_snapshot').notNull(),
    fatGSnapshot: real('fat_g_snapshot').notNull(),
    fiberGSnapshot: real('fiber_g_snapshot'),

    loggedAt: text('logged_at').notNull(),
  },
  (table) => [
    index('food_log_entry_date_idx').on(table.date),
    // Une entrée référence un aliment OU un repas, jamais les deux, mais peut
    // n'en référencer aucun si la source a été supprimée depuis.
    check(
      'food_log_entry_single_source',
      sql`not (${table.foodItemId} is not null and ${table.mealId} is not null)`,
    ),
  ],
);

/** Pesée. Une par jour : la courbe lissée (Phase 5) raisonne par date. */
export const weightEntry = sqliteTable('weight_entry', {
  id: text('id').primaryKey(),
  date: text('date').notNull().unique(),
  weightKg: real('weight_kg').notNull(),
  note: text('note'),
});

/**
 * Séance enregistrée. Cardio et musculation ne se modélisent pas pareil
 * (PLAN_IMPLEMENTATION §4.4) : le détail vit dans `payload`, typé côté domaine
 * selon `type`, plutôt que dans deux tables aux colonnes creuses.
 */
export const workoutLogEntry = sqliteTable(
  'workout_log_entry',
  {
    id: text('id').primaryKey(),
    date: text('date').notNull(),
    type: text('type', { enum: ['cardio', 'strength'] }).notNull(),
    payload: text('payload').notNull(),
    estimatedKcalBurned: real('estimated_kcal_burned'),
  },
  (table) => [index('workout_log_entry_date_idx').on(table.date)],
);

/**
 * Historique des objectifs successifs, en **ajout seul** : une ligne n'est
 * jamais modifiée après écriture.
 *
 * `profile` ne garde que l'objectif courant ; c'est ici que survit ce qu'il
 * écrase, pour que `detectRiskSignals` puisse repérer des révisions répétées
 * (PHASE_1 §5.5). Les colonnes reprennent `GoalChangeEvent` à l'identique.
 * Données de santé : effacées avec le profil (`profile.clear()`).
 */
export const goalChangeEvent = sqliteTable(
  'goal_change_event',
  {
    id: text('id').primaryKey(),
    at: text('at').notNull(),
    sex: text('sex', { enum: ['male', 'female'] }).notNull(),
    currentWeightKg: real('current_weight_kg').notNull(),
    heightCm: real('height_cm').notNull(),
    targetWeightKg: real('target_weight_kg'),
    /** Rythme choisi, avant plafonnement : le seul endroit où il survit. */
    requestedWeeklyRateKg: real('requested_weekly_rate_kg'),
    requestedDailyKcal: real('requested_daily_kcal'),
  },
  (table) => [index('goal_change_event_at_idx').on(table.at)],
);

// --- Métadonnées de synchronisation ---------------------------------------

export const SYNC_ENTITY_TYPES = [
  'profile',
  'goal_change_event',
  'consent',
  'food_item',
  'meal',
  'food_log_entry',
  'weight_entry',
  'workout_log_entry',
] as const;

/**
 * Journal de synchronisation, posé dès la Phase 2 alors que la synchro serveur
 * n'arrive qu'en Phase 9 : ajouter ces colonnes plus tard imposerait une
 * migration de toutes les tables et une reconstruction de l'état « sale ».
 *
 * - `dirty` : modifié localement, pas encore poussé.
 * - `updatedAt` : dernière écriture locale.
 * - `syncedAt` : dernier accusé de réception du serveur.
 * - `deletedAt` : pierre tombale. Une ligne supprimée localement doit rester
 *   ici, sinon la suppression ne pourra jamais être propagée au serveur.
 */
export const syncMeta = sqliteTable(
  'sync_meta',
  {
    entityType: text('entity_type', { enum: SYNC_ENTITY_TYPES }).notNull(),
    entityId: text('entity_id').notNull(),
    updatedAt: text('updated_at').notNull(),
    syncedAt: text('synced_at'),
    dirty: integer('dirty', { mode: 'boolean' }).notNull(),
    deletedAt: text('deleted_at'),
  },
  (table) => [
    primaryKey({ columns: [table.entityType, table.entityId] }),
    index('sync_meta_dirty_idx').on(table.dirty),
  ],
);

export type SyncEntityType = (typeof SYNC_ENTITY_TYPES)[number];

/**
 * État de la synchronisation, sur **une seule ligne** (`id = 1`).
 *
 * `pullCursor` est le curseur **fourni par le serveur** : la position du
 * dernier changement déjà tiré. Opaque côté app. Il ne s'appuie jamais sur
 * l'horloge de l'appareil, qui peut dériver ou être réglée à la main : une
 * lecture « depuis telle heure » pourrait alors manquer des changements.
 */
export const syncState = sqliteTable(
  'sync_state',
  {
    id: integer('id').primaryKey(),
    pullCursor: text('pull_cursor'),
  },
  (table) => [check('sync_state_single_row', sql`${table.id} = 1`)],
);
