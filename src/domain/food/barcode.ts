/**
 * Normalisation et validation des codes-barres alimentaires.
 *
 * Deux raisons de faire ce travail dans le domaine, avant tout appel réseau :
 *
 * - Open Food Facts indexe ses produits sur une forme canonique. Un UPC-A à
 *   douze chiffres et le même code en EAN-13 désignent le même produit ; les
 *   chercher sous deux clés différentes créerait deux entrées de cache pour un
 *   seul aliment.
 * - Une lecture caméra approximative produit un code syntaxiquement faux. Le
 *   rejeter localement épargne un aller-retour réseau qui, de toute façon,
 *   n'aurait rien ramené — et le rate-limit d'OFF se compte en appels.
 */

/** Longueurs GTIN reconnues, hors normalisation. */
export type BarcodeFormat = 'ean8' | 'ean13';

/** Motif de rejet, traduit par la couche UI. Le domaine ne rédige pas de texte. */
export type BarcodeRejection =
  /** Chaîne vide après nettoyage. */
  | 'empty'
  /** Caractères non numériques : ce n'est pas un GTIN. */
  | 'not_numeric'
  /** Ni EAN-8, ni UPC-A, ni EAN-13, ni GTIN-14 réductible. */
  | 'unsupported_length'
  /** Clé de contrôle GS1 fausse : lecture caméra erronée, presque toujours. */
  | 'bad_check_digit';

export type BarcodeNormalization =
  { ok: true; code: string; format: BarcodeFormat } | { ok: false; reason: BarcodeRejection };

const EAN_8 = 8;
const UPC_A = 12;
const EAN_13 = 13;
const GTIN_14 = 14;

/**
 * Ramène un code lu à sa forme canonique Open Food Facts.
 *
 * Règles appliquées, dans cet ordre :
 *
 * 1. tout ce qui n'est pas un chiffre est retiré (espaces, tirets de saisie) ;
 * 2. un GTIN-14 dont le préfixe d'emballage est `0` retombe sur son EAN-13 —
 *    c'est le même produit, conditionné en carton ;
 * 3. un UPC-A (12 chiffres, marché nord-américain) est préfixé d'un `0`, qui
 *    est exactement ce que fait Open Food Facts avant d'indexer ;
 * 4. la clé de contrôle GS1 est vérifiée sur la forme obtenue.
 *
 * L'EAN-8 est conservé tel quel : le préfixer produirait un code inexistant.
 */
export function normalizeBarcode(raw: string): BarcodeNormalization {
  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    return { ok: false, reason: 'empty' };
  }

  // Les tirets et espaces sont fréquents dans une saisie manuelle ; tout autre
  // caractère signale autre chose qu'un code-barres.
  const digits = trimmed.replace(/[\s-]/g, '');

  if (!/^\d+$/.test(digits)) {
    return { ok: false, reason: 'not_numeric' };
  }

  const canonical = toCanonicalLength(digits);

  if (canonical === undefined) {
    return { ok: false, reason: 'unsupported_length' };
  }

  if (!hasValidCheckDigit(canonical)) {
    return { ok: false, reason: 'bad_check_digit' };
  }

  return { ok: true, code: canonical, format: canonical.length === EAN_8 ? 'ean8' : 'ean13' };
}

function toCanonicalLength(digits: string): string | undefined {
  if (digits.length === GTIN_14) {
    return digits.startsWith('0') ? digits.slice(1) : undefined;
  }

  if (digits.length === UPC_A) {
    return `0${digits}`;
  }

  return digits.length === EAN_8 || digits.length === EAN_13 ? digits : undefined;
}

/**
 * Clé de contrôle GS1 : en partant de la droite, hors clé, les rangs sont
 * pondérés alternativement 3 puis 1 ; la clé complète la somme au multiple de
 * dix supérieur.
 */
export function computeCheckDigit(digitsWithoutKey: string): number {
  let sum = 0;

  for (let index = 0; index < digitsWithoutKey.length; index += 1) {
    // Le chiffre le plus à droite du corps pèse 3, puis on alterne.
    const positionFromRight = digitsWithoutKey.length - index;
    const weight = positionFromRight % 2 === 1 ? 3 : 1;
    sum += Number(digitsWithoutKey[index]) * weight;
  }

  return (10 - (sum % 10)) % 10;
}

function hasValidCheckDigit(code: string): boolean {
  const body = code.slice(0, -1);
  const key = Number(code[code.length - 1]);

  return computeCheckDigit(body) === key;
}
