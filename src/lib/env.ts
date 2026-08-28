/**
 * Accès unique aux variables d'environnement publiques.
 *
 * Expo n'inline que les variables préfixées `EXPO_PUBLIC_` : elles sont donc
 * visibles dans le bundle. Aucun secret ici — uniquement des identifiants
 * publics de télémétrie (DSN Sentry, clé projet PostHog).
 */
function readPublic(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export const env = {
  sentryDsn: readPublic(process.env.EXPO_PUBLIC_SENTRY_DSN),
  posthogApiKey: readPublic(process.env.EXPO_PUBLIC_POSTHOG_API_KEY),
  posthogHost: readPublic(process.env.EXPO_PUBLIC_POSTHOG_HOST) ?? 'https://eu.i.posthog.com',
  isDev: __DEV__,
} as const;
