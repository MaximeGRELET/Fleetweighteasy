/**
 * Frontière ODbL autour des données Open Food Facts.
 *
 * Open Food Facts est publié sous **Open Database License** : attribution
 * obligatoire, et clause de partage à l'identique (*share-alike*). Le plan
 * (PHASES_2_A_5 §4.2) en tire un point de vigilance stratégique : toute base
 * qui *combinerait* des données OFF avec une autre source devrait être
 * republiée en open data. Cela se tranchera avec un conseil juridique avant
 * tout usage commercial.
 *
 * En V1 — consultation et mise en cache — l'usage est conforme. Ce qui se joue
 * ici est de garder la frontière **nette**, pour que la question reste simple à
 * trancher plus tard plutôt que de devenir un audit de base de données :
 *
 * - toute ligne issue d'OFF porte `source = 'off'` et un identifiant préfixé
 *   `off:` (voir `offItemId`) : l'origine se lit sans jointure ;
 * - une correction utilisateur ne modifie **jamais** une ligne OFF. Elle crée
 *   un aliment `custom` distinct (`food.repo.createCustom`). Les deux jeux ne
 *   se mélangent donc jamais dans une même ligne, et retirer toutes les données
 *   OFF resterait une opération triviale ;
 * - seuls les aliments `custom` sont poussés à la synchro serveur
 *   (`food.repo`, `isUserOwned`) : le cache OFF ne quitte pas l'appareil.
 */

/**
 * Le texte d'attribution lui-même vit dans `src/lib/attribution.ts` : l'UI ne
 * peut pas importer la couche data, et c'est elle qui doit l'afficher.
 */

/** Préfixe des identifiants locaux d'origine Open Food Facts. */
export const OFF_ID_PREFIX = 'off:';

/**
 * Vrai si l'aliment provient d'Open Food Facts.
 *
 * Le test porte sur `source`, la colonne qui fait foi ; le préfixe
 * d'identifiant n'est qu'une commodité de lecture.
 */
export function isOpenFoodFactsItem(item: { source: string }): boolean {
  return item.source === 'off';
}
