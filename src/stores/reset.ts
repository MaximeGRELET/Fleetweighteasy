import { useFoodDraftStore } from './food-draft';
import { useOnboardingStore } from './onboarding';
import { useSessionStore } from './session';

/**
 * Remet l'état mémoire dans sa position de premier lancement, **après** que la
 * base a changé sous les écrans : effacement complet ou restauration d'une
 * sauvegarde.
 *
 * Sans cela, un brouillon d'onboarding abandonné, un aliment en cours de saisie
 * ou un jour sélectionné survivraient à des données qui ne sont plus les mêmes.
 */
export function resetInMemoryState(): void {
  useOnboardingStore.getState().reset();
  useFoodDraftStore.getState().clear();

  const session = useSessionStore.getState();
  session.reset();
  // `reset()` remet `databaseReady` à faux, ce qui serait un mensonge : les
  // migrations restent appliquées, seules les lignes ont changé.
  session.setDatabaseReady(true);
  // Après `reset()`, les révisions valent 0 — soit parfois leur valeur d'avant.
  // Les incrémenter garantit un changement, donc une relecture par les écrans
  // abonnés : profil, journal et pesées.
  session.bumpProfileRevision();
  session.bumpJournalRevision();
  session.bumpWeightRevision();
}
