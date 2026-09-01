/**
 * Réponses Open Food Facts de référence.
 *
 * Volontairement fidèles au vrai format, y compris ses irrégularités : c'est ce
 * qui donne du sens aux tests de complétude. Une fiche OFF n'est presque jamais
 * pleine, et notre code doit s'en accommoder sans inventer de valeurs.
 */

export const NUTELLA_BARCODE = '3017620422003';

/** Fiche complète : les quatre nutriments obligatoires sont là. */
export function buildOffProduct(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    code: NUTELLA_BARCODE,
    product_name: 'Nutella',
    product_name_fr: 'Nutella pâte à tartiner',
    brands: 'Ferrero, Nutella',
    serving_size: '15 g',
    serving_quantity: 15,
    nutriments: {
      'energy-kcal_100g': 539,
      energy_100g: 2255,
      proteins_100g: 6.3,
      carbohydrates_100g: 57.5,
      fat_100g: 30.9,
      fiber_100g: 3.4,
      sugars_100g: 56.3,
      'saturated-fat_100g': 10.6,
      sodium_100g: 0.0428,
    },
    ...overrides,
  };
}

/** Enveloppe de `/api/v2/product/{code}.json` pour un produit trouvé. */
export function buildProductResponse(
  product: Record<string, unknown> = buildOffProduct(),
): Record<string, unknown> {
  return { status: 1, code: product.code, product };
}

/**
 * Réponse « produit inconnu ».
 *
 * Open Food Facts ne renvoie pas systématiquement un 404 dans ce cas : il
 * arrive qu'un 200 porte `status: 0`. Les deux chemins doivent mener au même
 * résultat côté app.
 */
export function buildNotFoundResponse(): Record<string, unknown> {
  return { status: 0, status_verbose: 'product not found' };
}

/** Enveloppe Search-a-licious. */
export function buildSearchResponse(hits: Record<string, unknown>[]): Record<string, unknown> {
  return { hits, count: hits.length, page: 1, page_size: hits.length };
}
