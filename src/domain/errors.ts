/**
 * Erreurs typées du domaine.
 *
 * Le domaine ne connaît pas l'UI : il lève des erreurs porteuses d'un `code`
 * stable, que les couches supérieures traduiront en message utilisateur.
 */
export type DomainErrorCode = 'invalid_biometrics' | 'invalid_input';

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    // Nécessaire pour `instanceof` quand la cible de compilation est ES5.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Entrée biométrique hors des plages physiologiques plausibles.
 * Empêche toute formule de produire un chiffre absurde en aval.
 */
export class InvalidBiometricsError extends DomainError {
  readonly field: string;

  constructor(field: string, message: string) {
    super('invalid_biometrics', message);
    this.field = field;
  }
}

/** Entrée non biométrique invalide (durée négative, MET nul, etc.). */
export class InvalidInputError extends DomainError {
  readonly field: string;

  constructor(field: string, message: string) {
    super('invalid_input', message);
    this.field = field;
  }
}
