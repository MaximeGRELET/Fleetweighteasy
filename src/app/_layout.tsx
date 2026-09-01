import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAppFoodSource } from '@/hooks/use-app-food-source';
import { useAppRepositories } from '@/hooks/use-app-repositories';
import { useDatabase } from '@/hooks/use-database';
import { FoodSourceProvider } from '@/hooks/use-food-source';
import { RepositoriesProvider } from '@/hooks/use-repositories';
import { useTheme } from '@/hooks/use-theme';
import { initObservability, withErrorTracking } from '@/lib/observability';
import { createAppQueryClient } from '@/lib/query-client';
import type { Theme } from '@/theme';

initObservability();

function RootLayout() {
  const theme = useTheme();
  const database = useDatabase();

  if (database.error) {
    return (
      <>
        <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
        <Centered theme={theme}>
          <Text style={[theme.typography.heading, { color: theme.colors.text }]}>
            Base de données indisponible
          </Text>
          <Text style={[theme.typography.body, styles.message, { color: theme.colors.textMuted }]}>
            L’application n’a pas pu préparer ses données locales. Redémarre-la ; si le problème
            persiste, réinstalle-la.
          </Text>
        </Centered>
      </>
    );
  }

  // L'app n'ouvre son interface qu'une fois la base migrée : afficher un écran
  // sur une base non migrée provoquerait des erreurs SQL en cascade.
  if (!database.ready) {
    return (
      <>
        <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
        <Centered theme={theme}>
          <ActivityIndicator color={theme.colors.primary} />
        </Centered>
      </>
    );
  }

  return <ReadyApp />;
}

/**
 * Rendu séparé : les repositories ne sont construits qu'une fois la base
 * migrée, et un hook ne peut pas vivre sous un retour anticipé.
 *
 * Les trois fournisseurs sont posés ici et nulle part ailleurs — base locale,
 * source distante, cache de requêtes. Un écran qui construirait la sienne
 * ouvrirait une seconde connexion ou partirait sur le vrai réseau en test.
 */
function ReadyApp() {
  const theme = useTheme();
  const repositories = useAppRepositories();
  const foodSource = useAppFoodSource();
  const queryClient = useMemo(() => createAppQueryClient(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <RepositoriesProvider value={repositories}>
        <FoodSourceProvider value={foodSource}>
          <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.colors.background },
            }}
          />
        </FoodSourceProvider>
      </RepositoriesProvider>
    </QueryClientProvider>
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
