import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Callout, Text } from '@/components/ui';
import { type BackupSummary, type PickedBackup, useLocalData } from '@/hooks/use-local-data';
import { useTheme } from '@/hooks/use-theme';
import { formatIsoDate } from '@/lib/format';
import { BACKUP_PRIVACY_NOTE, EXPORT_FAILED, explainImportError } from '@/lib/messages/backup';
import type { Explanation } from '@/lib/messages/safety';
import { todayIsoDate } from '@/stores/session';

/**
 * Mes données : sauvegarder, restaurer, effacer.
 *
 * L'app n'a pas de serveur : ce fichier est la seule façon de retrouver ses
 * données sur un autre téléphone. L'écran est donc aussi joignable depuis
 * l'accueil de l'onboarding — sur un téléphone neuf, restaurer ne doit pas
 * exiger de refaire tout le parcours.
 *
 * Les deux actions destructrices — restaurer, qui remplace tout, et effacer —
 * demandent un second appui explicite, comme le panneau de développement.
 */
export default function LocalDataScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { exportData, pickBackup, restore, eraseAll } = useLocalData();

  const [busy, setBusy] = useState(false);
  const [exportProblem, setExportProblem] = useState<Explanation>();
  const [picked, setPicked] = useState<PickedBackup>();
  const [restoreProblem, setRestoreProblem] = useState<Explanation>();
  const [eraseArmed, setEraseArmed] = useState(false);

  async function handleExport() {
    setBusy(true);
    setExportProblem(undefined);
    try {
      await exportData();
    } catch {
      setExportProblem(EXPORT_FAILED);
    } finally {
      setBusy(false);
    }
  }

  async function handlePick() {
    setBusy(true);
    setRestoreProblem(undefined);
    try {
      setPicked(await pickBackup());
    } catch {
      setPicked({ status: 'refused', reason: 'unreadable' });
    } finally {
      setBusy(false);
    }
  }

  function handleRestore() {
    if (picked?.status !== 'ready') {
      return;
    }

    try {
      restore(picked.backup);
    } catch {
      setPicked(undefined);
      setRestoreProblem(explainImportError('invalid_content'));
      return;
    }

    // Retour par l'aiguillage racine : il envoie vers le tableau du jour si la
    // sauvegarde contenait un profil, vers l'onboarding sinon.
    router.replace('/');
  }

  function handleErase() {
    if (!eraseArmed) {
      setEraseArmed(true);
      return;
    }

    eraseAll();
    router.replace('/');
  }

  const refusal = picked?.status === 'refused' ? explainImportError(picked.reason) : undefined;
  const importProblem = refusal ?? restoreProblem;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={[styles.content, { maxWidth: theme.maxContentWidth }]}>
          <View style={styles.heading}>
            <Text variant="caption" tone="textMuted">
              Mes données
            </Text>
            <Text variant="title">Elles restent sur ce téléphone</Text>
            <Text variant="body" tone="textMuted">
              Rien n’est envoyé sur un serveur. Pour changer de téléphone ou te prémunir d’une
              perte, garde une sauvegarde.
            </Text>
          </View>

          <Section title="Sauvegarder">
            <Text variant="body" tone="textMuted">
              Crée un fichier avec toutes tes données, à ranger où tu veux : Drive, mail,
              ordinateur…
            </Text>
            <Text variant="caption" tone="textMuted" testID="data-privacy-note">
              {BACKUP_PRIVACY_NOTE}
            </Text>
            <Button
              label="Exporter mes données"
              onPress={handleExport}
              disabled={busy}
              testID="data-export"
            />
            {exportProblem ? <ExplanationCallout explanation={exportProblem} /> : null}
          </Section>

          <Section title="Restaurer">
            <Text variant="body" tone="textMuted">
              Récupère tes données depuis un fichier de sauvegarde. Elles remplaceront celles de ce
              téléphone.
            </Text>

            {picked?.status === 'ready' ? (
              <View style={styles.group} testID="data-restore-preview">
                <Text variant="body" testID="data-restore-summary">
                  {describeSummary(picked.summary)}
                </Text>
                <Callout
                  tone="caution"
                  title="Tes données actuelles seront remplacées"
                  body="Tout ce qui est sur ce téléphone sera remplacé par le contenu de la sauvegarde. Cette opération ne peut pas être annulée."
                />
                <Button
                  label="Remplacer mes données"
                  onPress={handleRestore}
                  testID="data-restore-confirm"
                />
                <Button
                  label="Annuler"
                  variant="quiet"
                  onPress={() => setPicked(undefined)}
                  testID="data-restore-cancel"
                />
              </View>
            ) : (
              <Button
                label="Importer une sauvegarde"
                variant="secondary"
                onPress={handlePick}
                disabled={busy}
                testID="data-import"
              />
            )}

            {importProblem ? <ExplanationCallout explanation={importProblem} /> : null}
          </Section>

          <Section title="Effacer">
            <Text variant="body" tone="textMuted">
              Supprime définitivement toutes tes données de ce téléphone : profil, journal, pesées,
              séances. Pense à exporter d’abord si tu veux les garder.
            </Text>
            <Button
              label={eraseArmed ? 'Confirmer l’effacement définitif' : 'Effacer toutes mes données'}
              variant={eraseArmed ? 'primary' : 'secondary'}
              onPress={handleErase}
              testID="data-erase"
            />
            {eraseArmed ? (
              <Button
                label="Annuler"
                variant="quiet"
                onPress={() => setEraseArmed(false)}
                testID="data-erase-cancel"
              />
            ) : null}
          </Section>

          <Button
            label="Retour"
            variant="secondary"
            onPress={() => router.back()}
            testID="data-back"
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text variant="subheading">{title}</Text>
      {children}
    </View>
  );
}

function ExplanationCallout({ explanation }: { explanation: Explanation }) {
  return (
    <Callout
      tone={explanation.tone}
      title={explanation.title}
      body={explanation.body}
      testID={`data-problem-${explanation.id}`}
    />
  );
}

/** « Sauvegarde du 28 septembre 2026 : 42 pesées, 310 entrées de journal, 18 séances. » */
function describeSummary(summary: BackupSummary): string {
  const date = formatIsoDate(todayIsoDate(new Date(summary.exportedAt)));
  const parts = [
    plural(summary.weight_entry, 'pesée', 'pesées'),
    plural(summary.food_log_entry, 'entrée de journal', 'entrées de journal'),
    plural(summary.workout_log_entry, 'séance', 'séances'),
  ];
  const profileNote =
    summary.profile === 0 ? ' Elle ne contient pas de profil : tu repasseras par l’accueil.' : '';

  return `Sauvegarde du ${date} : ${parts.join(', ')}.${profileNote}`;
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count > 1 ? pluralForm : singular}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%' },
  content: { padding: 24, gap: 24, alignSelf: 'center', width: '100%' },
  heading: { gap: 4 },
  group: { gap: 12 },
});
