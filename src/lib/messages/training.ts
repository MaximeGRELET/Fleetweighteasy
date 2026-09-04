import type { ProgressionAdvice } from '@/domain/training/progression';

/**
 * Mise en mots de la progression.
 *
 * Le domaine décide (`increase_load`, `increase_reps`, `hold`), ce module
 * formule. Le ton suit celui du reste de l'application : on constate et on
 * propose, on ne félicite ni ne réprimande. Ne pas progresser d'une séance à
 * l'autre est le cas le plus fréquent, pas un échec.
 */
export const PROGRESSION_ADVICE: Record<ProgressionAdvice, string> = {
  increase_load: 'Tu as tenu le haut de la fourchette sur toutes tes séries : monte la charge.',
  increase_reps:
    'Tu as tenu le haut de la fourchette sur toutes tes séries : vise quelques répétitions de plus.',
  hold: 'Garde cette charge à la prochaine séance, le temps de tenir le haut de la fourchette partout.',
};
