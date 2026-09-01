/**
 * Mentions de source et de licence affichées dans l'application.
 *
 * Open Food Facts est publié sous **Open Database License** : l'attribution est
 * une obligation, pas une politesse (PHASES_2_A_5 §4.2). Elle vit dans `lib`
 * parce que c'est du texte destiné à l'écran — l'UI ne peut pas importer la
 * couche data, et la couche data n'a pas à rédiger.
 *
 * Le versant architectural de la licence — isolation des données OFF, frontière
 * à garder nette pour un éventuel usage commercial — est documenté dans
 * `src/data/remote/licence.ts`.
 */

/** Mention longue, pour le tableau du jour et les mentions légales. */
export const ODBL_ATTRIBUTION =
  'Données produits © Open Food Facts, sous licence ODbL. Base collaborative : vérifie l’étiquette en cas de doute.';

/** Mention courte, pour une fiche produit ou une ligne de résultat. */
export const ODBL_ATTRIBUTION_SHORT = 'Source : Open Food Facts (ODbL)';

/** Texte de la licence, pour un lien sortant depuis les mentions légales. */
export const ODBL_LICENCE_URL = 'https://opendatacommons.org/licenses/odbl/1-0/';
