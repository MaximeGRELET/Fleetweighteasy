import { resetAllLocalData } from '@/data/reset';

import type { RepositoryContext } from './context';

/**
 * Opérations transverses à toutes les tables.
 *
 * Ces opérations ne relèvent d'aucune entité en particulier : elles n'avaient
 * donc leur place dans aucun des autres repositories. Elles passent quand même
 * par la fabrique commune, pour que l'UI n'ait qu'un seul point d'accès à la
 * data (`useRepositories`) et qu'un test puisse les exercer sur sa base en
 * mémoire comme n'importe quoi d'autre.
 */
export interface MaintenanceRepository {
  /**
   * Efface toutes les données locales : profil et historique des objectifs,
   * consentement, journal, poids, séances, cache d'aliments, métadonnées de
   * synchronisation.
   *
   * Le schéma est conservé — seul son contenu disparaît. Après appel, l'app est
   * dans l'état d'une première installation : `hasCompletedOnboarding()` est
   * faux et l'aiguillage racine renvoie vers l'onboarding.
   */
  resetAllLocalData(): void;
}

export function createMaintenanceRepository(context: RepositoryContext): MaintenanceRepository {
  const { db } = context;

  return {
    resetAllLocalData() {
      resetAllLocalData(db);
    },
  };
}
