/** Modèle du suivi de poids et de la progression (Phase 5). */

export interface WeightEntry {
  id: string;
  /** Date civile `YYYY-MM-DD`. Une pesée par jour. */
  date: string;
  weightKg: number;
  note?: string;
}

/** Une pesée à enregistrer : l'identifiant est posé par le repository. */
export type NewWeightEntry = Omit<WeightEntry, 'id'>;

/**
 * Le minimum dont les calculs ont besoin : une date et un poids.
 *
 * Les fonctions du domaine acceptent ce type plutôt que `WeightEntry`, pour
 * pouvoir être éprouvées sans fabriquer d'identifiants. Une `WeightEntry` en
 * est un cas particulier.
 */
export interface WeightPoint {
  date: string;
  weightKg: number;
}

/** Fenêtre d'observation proposée à l'utilisateur. */
export type ProgressPeriod = '30d' | '90d' | 'all';

/**
 * Lecture de la progression, destinée autant à l'affichage qu'au moteur de
 * conseils de la Phase 6.
 *
 * Un seul statut à la fois, choisi dans cet ordre de priorité : la sécurité
 * passe avant le confort, et le constat avant le jugement. Aucun de ces libellés
 * ne porte de reproche — c'est la couche message qui les met en mots, et elle
 * n'a jamais à dire « tu as échoué ».
 */
export type ProgressStatus =
  /** Pas assez de pesées, ou sur une durée trop courte, pour conclure. */
  | 'insufficient_data'
  /** La perte dépasse le plafond de sécurité : signal de santé, pas une réussite. */
  | 'faster_than_safe'
  /** Le rythme réel suit le rythme visé. */
  | 'on_track'
  /** Ça descend, mais plus lentement que prévu. */
  | 'slower_than_planned'
  /** Stable depuis assez longtemps malgré le déficit — déclencheur de conseil (Phase 6). */
  | 'plateau'
  /** Tendance à la hausse alors que l'objectif ne le prévoit pas. */
  | 'gaining'
  /** Le poids baisse alors qu'aucune perte n'était planifiée (objectif de maintien). */
  | 'unplanned_loss';
