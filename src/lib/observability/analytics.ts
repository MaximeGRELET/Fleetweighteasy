import PostHog from 'posthog-react-native';

import { env } from '@/lib/env';

let client: PostHog | undefined;

/**
 * Initialise l'analytics produit.
 *
 * Câblé « à vide » en Phase 0 : aucun événement métier n'est encore émis.
 * Sans clé configurée, tout devient no-op.
 *
 * Confidentialité (PLAN_IMPLEMENTATION §11.2) : cette couche ne doit jamais
 * transporter de donnée de santé. Les propriétés d'événement sont limitées à
 * des valeurs non identifiantes (écran, action, catégorie).
 */
export function initAnalytics(): void {
  if (client || !env.posthogApiKey) {
    return;
  }

  client = new PostHog(env.posthogApiKey, {
    host: env.posthogHost,
    // Pas de capture automatique : chaque événement sera déclaré explicitement.
    captureAppLifecycleEvents: false,
    disabled: env.isDev,
  });
}

export type AnalyticsProperties = Record<string, string | number | boolean>;

/** Émet un événement produit. No-op tant que l'analytics n'est pas configuré. */
export function trackEvent(name: string, properties?: AnalyticsProperties): void {
  client?.capture(name, properties);
}

/** Vide la file d'envoi (utile avant une mise en arrière-plan). */
export async function flushAnalytics(): Promise<void> {
  await client?.flush();
}
