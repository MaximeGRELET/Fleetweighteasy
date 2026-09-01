import { readMealTypeParam, readStringParam } from '@/lib/route-params';

/**
 * Un paramètre de route vient de l'extérieur : lien profond, historique de
 * navigation, route reconstruite après reprise de l'app. Le transtyper
 * reviendrait à affirmer sans vérifier.
 */
describe('readMealTypeParam', () => {
  it('accepte les quatre repas connus', () => {
    expect(readMealTypeParam('breakfast')).toBe('breakfast');
    expect(readMealTypeParam('lunch')).toBe('lunch');
    expect(readMealTypeParam('dinner')).toBe('dinner');
    expect(readMealTypeParam('snack')).toBe('snack');
  });

  it('rejette une valeur inventée plutôt que de la propager', () => {
    expect(readMealTypeParam('brunch')).toBeUndefined();
    expect(readMealTypeParam('')).toBeUndefined();
    expect(readMealTypeParam(undefined)).toBeUndefined();
  });

  it('prend le premier d’un paramètre répété', () => {
    // Expo Router remonte un tableau quand la clé apparaît deux fois dans l'URL.
    expect(readMealTypeParam(['dinner', 'lunch'])).toBe('dinner');
    expect(readMealTypeParam([])).toBeUndefined();
  });
});

describe('readStringParam', () => {
  it('rend la valeur telle quelle', () => {
    expect(readStringParam('off:3017620422003')).toBe('off:3017620422003');
  });

  it('traite le vide comme une absence', () => {
    expect(readStringParam('')).toBeUndefined();
    expect(readStringParam('   ')).toBeUndefined();
    expect(readStringParam(undefined)).toBeUndefined();
  });

  it('prend le premier d’un paramètre répété', () => {
    expect(readStringParam(['a', 'b'])).toBe('a');
    expect(readStringParam([])).toBeUndefined();
  });
});
