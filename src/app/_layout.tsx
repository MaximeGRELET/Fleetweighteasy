import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useDatabase } from '@/hooks/use-database';
import { useTheme } from '@/hooks/use-theme';
import { initObservability, withErrorTracking } from '@/lib/observability';
import type { Theme } from '@/theme';

initObservability();

function RootLayout() {
  const theme = useTheme();
  const database = useDatabase();

  return (
    <>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      {renderContent(theme, database)}
    </>
  );
}

/**
 * L'app n'ouvre son interface qu'une fois la base migrée : afficher le journal
 * sur une base non migrée provoquerait des erreurs SQL en cascade.
 */
function renderContent(theme: Theme, database: ReturnType<typeof useDatabase>) {
  if (database.error) {
    return (
      <Centered theme={theme}>
        <Text style={[theme.typography.heading, { color: theme.colors.text }]}>
          Base de données indisponible
        </Text>
        <Text style={[theme.typography.body, styles.message, { color: theme.colors.textMuted }]}>
          L’application n’a pas pu préparer ses données locales. Redémarre-la ; si le problème
          persiste, réinstalle-la.
        </Text>
      </Centered>
    );
  }

  if (!database.ready) {
    return (
      <Centered theme={theme}>
        <ActivityIndicator color={theme.colors.primary} />
      </Centered>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    />
  );
}

function Centered({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  return (
    <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.inner, { maxWidth: theme.maxContentWidth }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  inner: { alignItems: 'center', gap: 12 },
  message: { textAlign: 'center' },
});

export default withErrorTracking(RootLayout);
