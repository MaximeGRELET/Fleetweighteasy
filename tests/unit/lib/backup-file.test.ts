import { pickBackupFileText, shareBackupFile } from '@/lib/backup-file';

/**
 * Le fichier temporaire contient des données de santé : il doit disparaître du
 * cache une fois partagé, y compris quand le partage échoue. Le système de
 * fichiers et la feuille de partage sont simulés.
 */

const mockFiles = new Map<string, string>();
const mockStorage = { full: false };

jest.mock('expo-file-system', () => {
  class File {
    readonly uri: string;

    constructor(directory: { uri: string }, name: string) {
      this.uri = `${directory.uri}/${name}`;
    }

    get exists() {
      return mockFiles.has(this.uri);
    }

    create() {
      if (mockStorage.full) {
        throw new Error('Espace de stockage insuffisant');
      }
      mockFiles.set(this.uri, '');
    }

    write(contents: string) {
      mockFiles.set(this.uri, contents);
    }

    delete() {
      mockFiles.delete(this.uri);
    }

    text() {
      return Promise.resolve(mockFiles.get(this.uri) ?? '');
    }

    static pickFileAsync = jest.fn();
  }

  return { File, Paths: { cache: { uri: 'file:///cache' } } };
});

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve()),
}));

const { File } = jest.requireMock<{
  File: { pickFileAsync: jest.Mock } & (new (
    directory: { uri: string },
    name: string,
  ) => {
    uri: string;
  });
}>('expo-file-system');
const Sharing = jest.requireMock<{ isAvailableAsync: jest.Mock; shareAsync: jest.Mock }>(
  'expo-sharing',
);

describe('fichier de sauvegarde', () => {
  beforeEach(() => {
    mockFiles.clear();
    mockStorage.full = false;
    Sharing.isAvailableAsync.mockResolvedValue(true);
    Sharing.shareAsync.mockReset().mockResolvedValue(undefined);
    File.pickFileAsync.mockReset();
  });

  describe('partage', () => {
    it('partage le contenu en JSON, puis supprime le fichier temporaire', async () => {
      let sharedContents: string | undefined;
      Sharing.shareAsync.mockImplementation((uri: string) => {
        sharedContents = mockFiles.get(uri);
        return Promise.resolve();
      });

      await shareBackupFile('sauvegarde.json', '{"format":"x"}');

      expect(Sharing.shareAsync).toHaveBeenCalledWith(
        'file:///cache/sauvegarde.json',
        expect.objectContaining({ mimeType: 'application/json' }),
      );
      expect(sharedContents).toBe('{"format":"x"}');
      expect(mockFiles.size).toBe(0);
    });

    it('supprime le fichier temporaire même si le partage échoue', async () => {
      Sharing.shareAsync.mockRejectedValue(new Error('annulé par le système'));

      await expect(shareBackupFile('sauvegarde.json', '{}')).rejects.toThrow('annulé');

      expect(mockFiles.size).toBe(0);
    });

    it('remplace un fichier temporaire resté d’un essai précédent', async () => {
      mockFiles.set('file:///cache/sauvegarde.json', 'ancien contenu');
      let sharedContents: string | undefined;
      Sharing.shareAsync.mockImplementation((uri: string) => {
        sharedContents = mockFiles.get(uri);
        return Promise.resolve();
      });

      await shareBackupFile('sauvegarde.json', 'nouveau');

      expect(sharedContents).toBe('nouveau');
    });

    it('échoue sans partager si le fichier ne peut pas être créé', async () => {
      mockStorage.full = true;

      await expect(shareBackupFile('sauvegarde.json', '{}')).rejects.toThrow('stockage');

      expect(Sharing.shareAsync).not.toHaveBeenCalled();
      expect(mockFiles.size).toBe(0);
    });

    it('échoue clairement sans rien écrire si le partage est indisponible', async () => {
      Sharing.isAvailableAsync.mockResolvedValue(false);

      await expect(shareBackupFile('sauvegarde.json', '{}')).rejects.toThrow(/partage/);

      expect(mockFiles.size).toBe(0);
      expect(Sharing.shareAsync).not.toHaveBeenCalled();
    });
  });

  describe('choix', () => {
    it('renvoie le texte du fichier choisi', async () => {
      const picked = new File({ uri: 'file:///downloads' }, 'sauvegarde.json');
      mockFiles.set(picked.uri, '{"format":"x"}');
      File.pickFileAsync.mockResolvedValue({ canceled: false, result: picked });

      await expect(pickBackupFileText()).resolves.toBe('{"format":"x"}');
    });

    it('renvoie undefined si l’utilisateur annule', async () => {
      File.pickFileAsync.mockResolvedValue({ canceled: true, result: null });

      await expect(pickBackupFileText()).resolves.toBeUndefined();
    });
  });
});
