import type { RequiredNutrient } from '@/data/remote/off-mapping';
import { FoodSourceError, type FoodSourceFailure } from '@/data/remote/types';
import type { BarcodeRejection } from '@/domain/food/barcode';

/**
 * Traduction des échecs réseau et des motifs de rejet en langage clair.
 *
 * Même règle que pour les garde-fous de santé : le code lève des drapeaux, ce
 * fichier écrit les phrases. Et la même exigence de fond — **aucun échec
 * silencieux**. Un écran qui n'a pas pu joindre Open Food Facts doit le dire et
 * proposer une issue, jamais rester vide ou tourner indéfiniment
 * (PHASES_2_A_5 §4.7).
 */

export interface SourceMessage {
  title: string;
  body: string;
  /** Vrai quand la saisie manuelle est la sortie naturelle de cette situation. */
  offersManualEntry: boolean;
  /** Vrai quand réessayer a des chances d'aboutir. */
  offersRetry: boolean;
}

const FAILURE_MESSAGES: Record<FoodSourceFailure, SourceMessage> = {
  offline: {
    title: 'Pas de connexion',
    body:
      'Impossible de joindre la base de produits pour le moment. Les aliments que tu as déjà ' +
      'consultés restent disponibles, et tu peux saisir celui-ci à la main.',
    offersManualEntry: true,
    offersRetry: true,
  },
  timeout: {
    title: 'La recherche prend trop de temps',
    body:
      'Le réseau ne répond pas. Tes aliments déjà enregistrés restent accessibles ; tu peux ' +
      'réessayer ou saisir celui-ci à la main.',
    offersManualEntry: true,
    offersRetry: true,
  },
  rate_limited: {
    title: 'Trop de recherches d’affilée',
    body:
      'La base de produits limite le nombre de requêtes. Patiente quelques secondes avant de ' +
      'réessayer — ou saisis l’aliment à la main.',
    offersManualEntry: true,
    offersRetry: true,
  },
  unavailable: {
    title: 'Base de produits indisponible',
    body:
      'Le service ne répond pas correctement en ce moment. Ce n’est pas de ton fait. Tu peux ' +
      'réessayer plus tard ou saisir l’aliment à la main.',
    offersManualEntry: true,
    offersRetry: true,
  },
  malformed: {
    title: 'Réponse inattendue',
    body:
      'La base de produits a répondu dans un format qu’on ne sait pas lire. Saisis l’aliment à ' +
      'la main en attendant qu’on corrige ça.',
    offersManualEntry: true,
    offersRetry: false,
  },
  not_configured: {
    title: 'Recherche en ligne désactivée',
    body:
      'Cette installation n’est pas configurée pour interroger la base de produits. Le journal, ' +
      'tes aliments maison et tes repas fonctionnent normalement.',
    offersManualEntry: true,
    offersRetry: false,
  },
};

/** Message par défaut : un échec inconnu reste un échec qu'on explique. */
const UNKNOWN_FAILURE: SourceMessage = {
  title: 'Recherche impossible',
  body:
    'Quelque chose s’est mal passé pendant la recherche. Tu peux réessayer ou saisir l’aliment ' +
    'à la main.',
  offersManualEntry: true,
  offersRetry: true,
};

export function explainSourceError(error: unknown): SourceMessage {
  return error instanceof FoodSourceError ? FAILURE_MESSAGES[error.reason] : UNKNOWN_FAILURE;
}

/** Produit absent de la base — une réponse, pas une panne. */
export const UNKNOWN_PRODUCT_MESSAGE: SourceMessage = {
  title: 'Produit inconnu',
  body:
    'Ce code-barres n’existe pas encore dans la base collaborative. Saisis ses valeurs une fois : ' +
    'il sera ensuite disponible dans tes aliments.',
  offersManualEntry: true,
  offersRetry: false,
};

const NUTRIENT_LABELS: Record<RequiredNutrient, string> = {
  kcal: 'les calories',
  proteinG: 'les protéines',
  carbsG: 'les glucides',
  fatG: 'les lipides',
};

/**
 * Produit trouvé, mais aux valeurs trop incomplètes pour être journalisé.
 *
 * On nomme ce qui manque plutôt que de dire « données incomplètes » : la donnée
 * est collaborative, et la personne qui a le produit en main est justement
 * celle qui peut la compléter.
 */
export function explainIncompleteProduct(missing: readonly RequiredNutrient[]): SourceMessage {
  const labels = missing.map((nutrient) => NUTRIENT_LABELS[nutrient]);

  return {
    title: 'Fiche incomplète',
    body:
      `La base connaît ce produit mais il lui manque ${joinFrench(labels)}. Complète les valeurs ` +
      'depuis l’étiquette : on garde le reste, tu n’as que le manquant à saisir.',
    offersManualEntry: true,
    offersRetry: false,
  };
}

const BARCODE_REJECTIONS: Record<BarcodeRejection, string> = {
  empty: 'Aucun code n’a été lu.',
  not_numeric:
    'Ce code contient autre chose que des chiffres : ce n’est pas un code-barres produit.',
  unsupported_length: 'Ce code n’a pas un format de code-barres alimentaire reconnu.',
  bad_check_digit:
    'Le code lu est incohérent — la lecture a probablement échoué. Réessaie en tenant le produit ' +
    'bien à plat.',
};

export function explainBarcodeRejection(reason: BarcodeRejection): SourceMessage {
  return {
    title: 'Code-barres illisible',
    body: BARCODE_REJECTIONS[reason],
    // Réessayer un scan est la première chose à tenter ; la saisie manuelle
    // reste ouverte si le code-barres est abîmé.
    offersManualEntry: true,
    offersRetry: true,
  };
}

/** « a, b et c » — la conjonction française, qui n'est pas une virgule finale. */
function joinFrench(values: readonly string[]): string {
  if (values.length <= 1) {
    return values[0] ?? '';
  }

  return `${values.slice(0, -1).join(', ')} et ${values[values.length - 1]}`;
}
