/**
 * Table de référence des METs (Metabolic Equivalent of Task).
 *
 * Source : 2024 Adult Compendium of Physical Activities (DONNEES_SPORT §A.3).
 * 1 MET ≈ l'énergie dépensée assis au repos (≈ 3,5 ml O₂/kg/min).
 *
 * Ces valeurs sont des estimations de planification, pas des mesures : terrain,
 * pente, forme physique, vent, charge et pauses modifient la dépense réelle,
 * souvent à la baisse. Cette imprécision est la raison même pour laquelle le
 * mode calories par défaut est `fixed` (le sport n'est pas recrédité).
 */

export type CardioActivity = 'walking' | 'running' | 'cycling';
export type CardioEnvironment = 'outdoor' | 'stationary';

export interface MetEntry {
  id: string;
  activity: CardioActivity;
  environment?: CardioEnvironment;
  /** Libellé affiché à l'utilisateur (FR). */
  label: string;
  /** Repère d'allure ou d'intensité, affiché en complément du libellé. */
  paceHint: string;
  met: number;
}

export const MET_ENTRIES: readonly MetEntry[] = [
  // Marche
  {
    id: 'walk_slow',
    activity: 'walking',
    environment: 'outdoor',
    label: 'Marche lente, plate',
    paceHint: '~3,2 km/h',
    met: 2.8,
  },
  {
    id: 'walk_moderate',
    activity: 'walking',
    environment: 'outdoor',
    label: 'Marche modérée, plate',
    paceHint: '~4,5–5,5 km/h',
    met: 3.5,
  },
  {
    id: 'walk_brisk',
    activity: 'walking',
    environment: 'outdoor',
    label: 'Marche rapide',
    paceHint: '~5,6–6,4 km/h',
    met: 4.8,
  },
  {
    id: 'walk_very_brisk',
    activity: 'walking',
    environment: 'outdoor',
    label: 'Marche très rapide',
    paceHint: '~6,5–7,2 km/h',
    met: 6.3,
  },
  {
    id: 'walk_uphill',
    activity: 'walking',
    environment: 'outdoor',
    label: 'Marche en montée, effort soutenu',
    paceHint: 'dénivelé marqué',
    met: 7.0,
  },

  // Course à pied
  {
    id: 'run_jog_light',
    activity: 'running',
    environment: 'outdoor',
    label: 'Footing léger',
    paceHint: '~6–7 km/h',
    met: 6.0,
  },
  {
    id: 'run_general',
    activity: 'running',
    environment: 'outdoor',
    label: 'Course, allure libre',
    paceHint: '~8 km/h',
    met: 7.5,
  },
  {
    id: 'run_moderate',
    activity: 'running',
    environment: 'outdoor',
    label: 'Course modérée',
    paceHint: '~9,5–10 km/h',
    met: 9.3,
  },
  {
    id: 'run_fast',
    activity: 'running',
    environment: 'outdoor',
    label: 'Course rapide',
    paceHint: '~11–12 km/h',
    met: 11.0,
  },
  {
    id: 'run_very_fast',
    activity: 'running',
    environment: 'outdoor',
    label: 'Course très rapide',
    paceHint: '~13–14 km/h',
    met: 13.5,
  },

  // Vélo extérieur
  {
    id: 'bike_light',
    activity: 'cycling',
    environment: 'outdoor',
    label: 'Vélo loisir, allure tranquille',
    paceHint: '< 16 km/h',
    met: 4.0,
  },
  {
    id: 'bike_moderate',
    activity: 'cycling',
    environment: 'outdoor',
    label: 'Vélo, effort modéré',
    paceHint: '~19–22 km/h',
    met: 8.0,
  },
  {
    id: 'bike_vigorous',
    activity: 'cycling',
    environment: 'outdoor',
    label: 'Vélo, effort soutenu',
    paceHint: '~23–25 km/h',
    met: 10.0,
  },
  {
    id: 'bike_fast',
    activity: 'cycling',
    environment: 'outdoor',
    label: 'Vélo rapide / sportif',
    paceHint: '~26–30 km/h',
    met: 12.0,
  },

  // Vélo d'appartement / home-trainer
  {
    id: 'bike_stationary_light',
    activity: 'cycling',
    environment: 'stationary',
    label: 'Vélo d’appartement, résistance faible',
    paceHint: 'léger',
    met: 5.5,
  },
  {
    id: 'bike_stationary_moderate',
    activity: 'cycling',
    environment: 'stationary',
    label: 'Vélo d’appartement, résistance modérée',
    paceHint: 'modéré',
    met: 7.0,
  },
  {
    id: 'bike_stationary_vigorous',
    activity: 'cycling',
    environment: 'stationary',
    label: 'Vélo d’appartement, résistance élevée',
    paceHint: 'soutenu',
    met: 10.5,
  },
] as const;

/**
 * Musculation générale, à titre indicatif (~3,5 MET ; 5–6 MET si intense).
 * Non utilisée pour estimer des calories en V1 : la musculation vise la
 * composition corporelle, pas la dépense (DONNEES_SPORT §A.3).
 */
export const RESISTANCE_TRAINING_MET_REFERENCE = 3.5;

export function findMetEntry(id: string): MetEntry | undefined {
  return MET_ENTRIES.find((entry) => entry.id === id);
}

export function listMetEntriesForActivity(activity: CardioActivity): MetEntry[] {
  return MET_ENTRIES.filter((entry) => entry.activity === activity);
}
