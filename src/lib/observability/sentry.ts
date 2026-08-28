import * as Sentry from '@sentry/react-native';

import { env } from '@/lib/env';

let initialized = false;

/**
 * Initialise le suivi d'erreurs.
 *
 * Câblé mais volontairement « à vide » en Phase 0 : aucun événement métier n'est
 * envoyé. Sans DSN configuré, la fonction ne fait rien — l'app doit rester
 * pleinement utilisable sans télémétrie (principe local-first).
 *
 * Confidentialité (PLAN_IMPLEMENTATION §11.2) : `sendDefaultPii` reste à false
 * et aucune donnée de santé (poids, biométrie, objectifs) ne doit jamais être
 * attachée à un événement Sentry.
 */
export function initErrorTracking(): void {
  if (initialized || !env.sentryDsn) {
    return;
  }

  Sentry.init({
    dsn: env.sentryDsn,
    sendDefaultPii: false,
    enableAutoSessionTracking: true,
    debug: false,
    tracesSampleRate: env.isDev ? 1.0 : 0.1,
  });

  initialized = true;
}

/** Enveloppe le composant racine pour capturer les erreurs de rendu. */
export const withErrorTracking = Sentry.wrap;
