import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { appInfo } from '@/lib/app-info';

/**
 * Écran d'attente de la Phase 0.
 *
 * Il sera remplacé par le routage réel (onboarding / onglets) en Phase 3.
 */
export default function RootScreen() {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <SafeAreaView style={[styles.content, { maxWidth: theme.maxContentWidth }]}>
        <Text style={[theme.typography.title, { color: theme.colors.text }]}>{appInfo.name}</Text>
        <Text style={[theme.typography.body, styles.subtitle, { color: theme.colors.textMuted }]}>
          Fondations du projet en place. Le parcours utilisateur arrive avec l’onboarding.
        </Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 24, gap: 12, alignItems: 'center' },
  subtitle: { textAlign: 'center' },
});
