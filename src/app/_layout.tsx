import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { useTheme } from '@/hooks/use-theme';
import { initObservability, withErrorTracking } from '@/lib/observability';

initObservability();

function RootLayout() {
  const theme = useTheme();

  useEffect(() => {
    // Réservé aux phases suivantes : restauration de session, migrations DB.
  }, []);

  return (
    <>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      />
    </>
  );
}

export default withErrorTracking(RootLayout);
