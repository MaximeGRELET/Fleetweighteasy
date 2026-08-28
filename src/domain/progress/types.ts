/** Modèle du suivi de poids (exploité par la Phase 5). */

export interface WeightEntry {
  id: string;
  /** Date civile `YYYY-MM-DD`. Une pesée par jour. */
  date: string;
  weightKg: number;
  note?: string;
}

/** Une pesée à enregistrer : l'identifiant est posé par le repository. */
export type NewWeightEntry = Omit<WeightEntry, 'id'>;
