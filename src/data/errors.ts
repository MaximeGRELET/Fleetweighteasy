/**
 * Erreur d'intégrité de la base locale.
 *
 * Levée quand une colonne JSON ne respecte pas sa forme attendue : base
 * corrompue, migration ratée, ou écriture par une version antérieure de l'app.
 * On préfère échouer bruyamment plutôt que de laisser une donnée douteuse
 * remonter jusqu'aux calculs nutritionnels.
 */
export class DataIntegrityError extends Error {
  readonly code = 'data_integrity';
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = 'DataIntegrityError';
    this.field = field;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
