import { fireEvent, waitFor } from '@testing-library/react-native';

import WelcomeScreen from '@/app/(onboarding)/index';
import LocalDataScreen from '@/app/data/index';
import RootScreen from '@/app/index';
import { BACKUP_FORMAT, parseBackup, serializeBackup } from '@/data/backup';
import { createRepositories } from '@/data/repositories/factory';
import { backupFileName } from '@/hooks/use-local-data';
import { pickBackupFileText, shareBackupFile } from '@/lib/backup-file';
import { PRIVACY_POLICY_VERSION } from '@/lib/legal';
import { useOnboardingStore } from '@/stores/onboarding';
import { useSessionStore } from '@/stores/session';

import { buildStoredProfile } from '../integration/helpers/fixtures';
import { createTestDatabase } from '../integration/helpers/test-db';
import { createAppHarness, type AppHarness } from '../support/render-with-app';
import { routerMock } from '../support/router-mock';

/**
 * Le partage et le sélecteur de fichiers sont des API de plateforme : ils sont
 * remplacés ici. Tout le reste — lecture, vérification, remplacement des
 * données — tourne sur de vrais repositories adossés à une base en mémoire.
 */
jest.mock('@/lib/backup-file', () => ({
  shareBackupFile: jest.fn(() => Promise.resolve()),
  pickBackupFileText: jest.fn(),
}));

const shareMock = jest.mocked(shareBackupFile);
const pickMock = jest.mocked(pickBackupFileText);

/** Une sauvegarde venue d'un autre téléphone. */
function backupFromAnotherPhone(): string {
  const other = createTestDatabase({ idPrefix: 'other' });
  const repositories = createRepositories(other.context);
  repositories.consent.grant(PRIVACY_POLICY_VERSION);
  repositories.profile.save(buildStoredProfile({ currentWeightKg: 68.2 }));
  repositories.weight.upsertForDate({ date: '2026-02-01', weightKg: 69 });
  repositories.weight.upsertForDate({ date: '2026-03-01', weightKg: 68.2 });

  const text = serializeBackup(repositories.maintenance.createBackup());
  other.close();
  return text;
}

describe('mes données', () => {
  let harness: AppHarness;

  beforeEach(() => {
    harness = createAppHarness();
    harness.repositories.consent.grant(PRIVACY_POLICY_VERSION);
    harness.repositories.profile.save(buildStoredProfile({ currentWeightKg: 75 }));
    useSessionStore.getState().setDatabaseReady(true);
    shareMock.mockReset().mockResolvedValue(undefined);
    pickMock.mockReset();
  });

  afterEach(() => {
    harness.cleanup();
  });

  describe('accès', () => {
    it('est accessible depuis l’écran du jour', async () => {
      const screen = await harness.renderScreen(<RootScreen />);

      await fireEvent.press(screen.getByTestId('today-data'));

      expect(routerMock.push).toHaveBeenCalledWith('/data');
    });

    /** Sur un téléphone neuf, restaurer ne doit pas exiger de refaire l'onboarding. */
    it('est accessible dès l’accueil de l’onboarding', async () => {
      const screen = await harness.renderScreen(<WelcomeScreen />);

      await fireEvent.press(screen.getByTestId('onboarding-restore'));

      expect(routerMock.push).toHaveBeenCalledWith('/data');
    });
  });

  describe('export', () => {
    it('partage un fichier daté contenant toutes les données', async () => {
      const screen = await harness.renderScreen(<LocalDataScreen />);

      await fireEvent.press(screen.getByTestId('data-export'));

      await waitFor(() => expect(shareMock).toHaveBeenCalledTimes(1));
      const [fileName, contents] = shareMock.mock.calls[0]!;
      expect(fileName).toBe(backupFileName());
      expect(fileName).toMatch(/-sauvegarde-\d{4}-\d{2}-\d{2}\.json$/);
      expect(parseBackup(contents).tables.profile[0]).toMatchObject({ currentWeightKg: 75 });
    });

    it('prévient que le fichier contient des données de santé', async () => {
      const screen = await harness.renderScreen(<LocalDataScreen />);

      expect(screen.getByTestId('data-privacy-note')).toHaveTextContent(/données de santé/);
    });

    it('explique un échec, sans rien perdre', async () => {
      shareMock.mockRejectedValue(new Error('partage indisponible'));
      const screen = await harness.renderScreen(<LocalDataScreen />);

      await fireEvent.press(screen.getByTestId('data-export'));

      expect(await screen.findByTestId('data-problem-backup_export_failed')).toBeTruthy();
      expect(harness.repositories.profile.get()?.currentWeightKg).toBe(75);
    });
  });

  describe('restauration', () => {
    it('montre le contenu de la sauvegarde avant de remplacer quoi que ce soit', async () => {
      pickMock.mockResolvedValue(backupFromAnotherPhone());
      const screen = await harness.renderScreen(<LocalDataScreen />);

      await fireEvent.press(screen.getByTestId('data-import'));

      expect(await screen.findByTestId('data-restore-summary')).toHaveTextContent(
        /2 pesées, 0 entrée de journal, 0 séance/,
      );
      // Rien n'est encore remplacé.
      expect(harness.repositories.profile.get()?.currentWeightKg).toBe(75);
    });

    it('remplace les données après confirmation, puis repasse par l’aiguillage', async () => {
      pickMock.mockResolvedValue(backupFromAnotherPhone());
      useOnboardingStore.getState().update({ heightCm: 190 });
      const screen = await harness.renderScreen(<LocalDataScreen />);

      await fireEvent.press(screen.getByTestId('data-import'));
      await fireEvent.press(await screen.findByTestId('data-restore-confirm'));

      expect(harness.repositories.profile.get()?.currentWeightKg).toBe(68.2);
      expect(harness.repositories.weight.getHistory()).toHaveLength(2);
      expect(routerMock.replace).toHaveBeenCalledWith('/');
      // Aucun état mémoire ne survit à des données qui ne sont plus les mêmes.
      expect(useOnboardingStore.getState().draft.heightCm).toBeUndefined();
    });

    it('laisse tout en place si l’utilisateur annule', async () => {
      pickMock.mockResolvedValue(backupFromAnotherPhone());
      const screen = await harness.renderScreen(<LocalDataScreen />);

      await fireEvent.press(screen.getByTestId('data-import'));
      await fireEvent.press(await screen.findByTestId('data-restore-cancel'));

      expect(screen.queryByTestId('data-restore-preview')).toBeNull();
      expect(harness.repositories.profile.get()?.currentWeightKg).toBe(75);
    });

    it('ne fait rien si aucun fichier n’est choisi', async () => {
      pickMock.mockResolvedValue(undefined);
      const screen = await harness.renderScreen(<LocalDataScreen />);

      await fireEvent.press(screen.getByTestId('data-import'));

      await waitFor(() => expect(pickMock).toHaveBeenCalled());
      expect(screen.queryByTestId('data-restore-preview')).toBeNull();
      expect(screen.queryByTestId(/^data-problem-/)).toBeNull();
    });

    it('dit que rien n’a changé si la base refuse une sauvegarde bien formée', async () => {
      const backup = parseBackup(backupFromAnotherPhone());
      const [weighing] = backup.tables.weight_entry;
      backup.tables.weight_entry.push({ ...weighing, id: 'meme-jour' });
      pickMock.mockResolvedValue(serializeBackup(backup));
      const screen = await harness.renderScreen(<LocalDataScreen />);

      await fireEvent.press(screen.getByTestId('data-import'));
      await fireEvent.press(await screen.findByTestId('data-restore-confirm'));

      expect(screen.getByTestId('data-problem-backup_invalid_content')).toBeTruthy();
      expect(harness.repositories.profile.get()?.currentWeightKg).toBe(75);
      expect(routerMock.replace).not.toHaveBeenCalled();
    });

    it.each([
      ['un fichier illisible', 'pas du json', 'backup_unreadable'],
      ['un autre JSON', '{"liste": ["pain"]}', 'backup_not_a_backup'],
      [
        'une version inconnue',
        JSON.stringify({ format: BACKUP_FORMAT, version: 99, exportedAt: '', tables: {} }),
        'backup_unsupported_version',
      ],
    ])('refuse %s et le dit, sans rien modifier', async (_label, text, problemId) => {
      pickMock.mockResolvedValue(text);
      const screen = await harness.renderScreen(<LocalDataScreen />);

      await fireEvent.press(screen.getByTestId('data-import'));

      expect(await screen.findByTestId(`data-problem-${problemId}`)).toHaveTextContent(
        /n’ont pas été modifiées/,
      );
      expect(harness.repositories.profile.get()?.currentWeightKg).toBe(75);
    });
  });

  describe('effacement', () => {
    it('demande une confirmation explicite', async () => {
      const screen = await harness.renderScreen(<LocalDataScreen />);

      await fireEvent.press(screen.getByTestId('data-erase'));

      expect(harness.repositories.profile.get()).toBeDefined();
      expect(screen.getByTestId('data-erase')).toHaveTextContent(/Confirmer/);
    });

    it('efface tout au second appui et renvoie vers l’accueil', async () => {
      const screen = await harness.renderScreen(<LocalDataScreen />);

      await fireEvent.press(screen.getByTestId('data-erase'));
      await fireEvent.press(screen.getByTestId('data-erase'));

      expect(harness.repositories.profile.get()).toBeUndefined();
      expect(harness.repositories.consent.get()).toBeUndefined();
      expect(routerMock.replace).toHaveBeenCalledWith('/');
    });

    it('s’annule sans rien effacer', async () => {
      const screen = await harness.renderScreen(<LocalDataScreen />);

      await fireEvent.press(screen.getByTestId('data-erase'));
      await fireEvent.press(screen.getByTestId('data-erase-cancel'));
      await fireEvent.press(screen.getByTestId('data-erase'));

      expect(harness.repositories.profile.get()).toBeDefined();
    });
  });
});
