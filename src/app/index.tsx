import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { useCaloriePlan, useHasCompletedOnboarding, useStoredProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { formatGrams, formatKcal } from '@/lib/format';
import { HEALTH_DISCLAIMER } from '@/lib/legal';

/**
 * Aiguillage racine.
 *
 * Un profil dont l'onboarding est terminé entre directement dans l'app : au
 * redémarrage, on ne repasse jamais par le questionnaire.
 */
export default function RootScreen() {
  const completed = useHasCompletedOnboarding();

  if (!completed) {
    return <Redirect href="/(onboarding)" />;
  }

  return <TodayScreen />;
}

/**
 * Tableau du jour, réduit à l'essentiel en attendant le journal (Phase 4).
 *
 * Les chiffres affichés sont **recalculés** depuis le profil à chaque rendu :
 * rien n'est stocké figé, donc rien ne peut devenir périmé.
 */
function TodayScreen() {
  const theme = useTheme();
  const profile = useStoredProfile();
  const plan = useCaloriePlan(profile);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <SafeAreaView style={[styles.content, { maxWidth: theme.maxContentWidth }]}>
        <Text variant="caption" tone="textMuted">
          Ton objectif du jour
        </Text>
        <Text variant="numeric" testID="today-target">
          {plan ? formatKcal(plan.target.targetKcal) : '—'}
        </Text>

        {plan ? (
          <Text variant="caption" tone="textMuted" testID="today-macros">
            {formatGrams(plan.macros.proteinG)} de protéines · {formatGrams(plan.macros.fatG)} de
            lipides · {formatGrams(plan.macros.carbsG)} de glucides
          </Text>
        ) : null}

        <Text variant="body" tone="textMuted" style={styles.pending}>
          Le journal alimentaire, les conseils et le suivi sportif arrivent dans les prochaines
          étapes de construction.
        </Text>

        <Text variant="caption" tone="textMuted" style={styles.pending}>
          {HEALTH_DISCLAIMER}
        </Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 24, gap: 8, alignItems: 'center' },
  pending: { textAlign: 'center', marginTop: 16 },
});
