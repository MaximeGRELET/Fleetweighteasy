import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Fichier de sauvegarde, côté plateforme : écrire puis partager, choisir puis
 * lire. Rien d'autre — le contenu est produit et vérifié par la couche data.
 *
 * Isolé ici pour que les écrans restent testables : les tests remplacent ce
 * module, sans simuler de système de fichiers ni de feuille de partage.
 */

export const BACKUP_MIME_TYPE = 'application/json';

/**
 * Écrit la sauvegarde dans le cache puis ouvre la feuille de partage : c'est
 * l'utilisateur qui choisit où la ranger (Drive, mail, ordinateur…).
 *
 * Le fichier temporaire est supprimé ensuite. Il contient des données de santé :
 * il ne doit pas traîner dans le cache une fois partagé.
 */
export async function shareBackupFile(fileName: string, contents: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Le partage de fichiers n’est pas disponible sur cet appareil.');
  }

  const file = new File(Paths.cache, fileName);

  try {
    if (file.exists) {
      file.delete();
    }
    file.create();
    file.write(contents);

    await Sharing.shareAsync(file.uri, {
      mimeType: BACKUP_MIME_TYPE,
      UTI: 'public.json',
      dialogTitle: 'Enregistrer ma sauvegarde',
    });
  } finally {
    if (file.exists) {
      file.delete();
    }
  }
}

/**
 * Ouvre le sélecteur de fichiers et renvoie le texte du fichier choisi, ou
 * `undefined` si l'utilisateur a annulé.
 *
 * Aucun filtre de type : selon l'endroit où il a été rangé, un `.json` est
 * parfois annoncé comme texte ou comme binaire, et le filtrer le rendrait
 * invisible. La vérification du contenu, elle, ne laisse rien passer.
 */
export async function pickBackupFileText(): Promise<string | undefined> {
  const picked = await File.pickFileAsync({ mimeTypes: '*/*' });

  if (picked.canceled) {
    return undefined;
  }

  return picked.result.text();
}
