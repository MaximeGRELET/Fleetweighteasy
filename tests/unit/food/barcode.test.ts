import { computeCheckDigit, normalizeBarcode } from '@/domain/food/barcode';

/** Codes réels, tous porteurs d'une clé de contrôle GS1 valide. */
const EAN_13 = '3017620422003';
const EAN_8 = '96385074';
const UPC_A = '036000291452';

describe('normalizeBarcode', () => {
  it('accepte un EAN-13 tel quel', () => {
    expect(normalizeBarcode(EAN_13)).toEqual({ ok: true, code: EAN_13, format: 'ean13' });
  });

  it('accepte un EAN-8 sans le compléter', () => {
    // Préfixer un EAN-8 produirait un code qui n'existe chez personne.
    expect(normalizeBarcode(EAN_8)).toEqual({ ok: true, code: EAN_8, format: 'ean8' });
  });

  it('préfixe un UPC-A d’un zéro, comme le fait Open Food Facts', () => {
    expect(normalizeBarcode(UPC_A)).toEqual({ ok: true, code: `0${UPC_A}`, format: 'ean13' });
  });

  it('ramène un GTIN-14 d’emballage sur l’EAN-13 du produit', () => {
    expect(normalizeBarcode(`0${EAN_13}`)).toEqual({ ok: true, code: EAN_13, format: 'ean13' });
  });

  it('refuse un GTIN-14 dont le préfixe d’emballage n’est pas neutre', () => {
    // Un préfixe non nul désigne un conditionnement, pas l'unité de vente : le
    // retirer changerait de produit.
    expect(normalizeBarcode(`1${EAN_13}`)).toEqual({ ok: false, reason: 'unsupported_length' });
  });

  it('tolère les espaces et tirets d’une saisie manuelle', () => {
    expect(normalizeBarcode(' 3017-6204 22003 ')).toEqual({
      ok: true,
      code: EAN_13,
      format: 'ean13',
    });
  });

  it('rejette une chaîne vide', () => {
    expect(normalizeBarcode('   ')).toEqual({ ok: false, reason: 'empty' });
  });

  it('rejette ce qui n’est pas un nombre', () => {
    expect(normalizeBarcode('30176204ABCD3')).toEqual({ ok: false, reason: 'not_numeric' });
  });

  it('rejette une longueur qui n’est pas un GTIN', () => {
    expect(normalizeBarcode('12345')).toEqual({ ok: false, reason: 'unsupported_length' });
  });

  it('rejette une clé de contrôle fausse : c’est une lecture caméra ratée', () => {
    // Dernier chiffre modifié : le code garde une longueur valide mais ne
    // désigne aucun produit. L'arrêter ici épargne un appel réseau inutile.
    expect(normalizeBarcode('3017620422004')).toEqual({ ok: false, reason: 'bad_check_digit' });
  });

  it('rejette une transposition de chiffres, l’erreur de lecture la plus courante', () => {
    expect(normalizeBarcode('3017620242003').ok).toBe(false);
  });
});

describe('computeCheckDigit', () => {
  it('retrouve la clé d’un EAN-13 connu', () => {
    expect(computeCheckDigit(EAN_13.slice(0, -1))).toBe(3);
  });

  it('retrouve la clé d’un EAN-8 connu', () => {
    expect(computeCheckDigit(EAN_8.slice(0, -1))).toBe(4);
  });

  it('préfixer un UPC-A d’un zéro ne change pas sa clé', () => {
    // Propriété qui rend la normalisation sûre : le zéro ajouté pèse zéro.
    expect(computeCheckDigit(UPC_A.slice(0, -1))).toBe(computeCheckDigit(`0${UPC_A}`.slice(0, -1)));
  });
});
