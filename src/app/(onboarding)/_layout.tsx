import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

/**
 * Pile d'onboarding. Le retour arrière natif reste actif sur chaque écran
 * (geste et bouton système) : l'utilisateur peut toujours revenir corriger.
 */
export default function OnboardingLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
        animation: 'slide_from_right',
      }}
    />
  );
}
