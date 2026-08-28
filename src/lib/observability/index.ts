import { initAnalytics } from './analytics';
import { initErrorTracking } from './sentry';

export { flushAnalytics, trackEvent, type AnalyticsProperties } from './analytics';
export { withErrorTracking } from './sentry';

/** Point d'entrée unique appelé une fois au démarrage de l'app. */
export function initObservability(): void {
  initErrorTracking();
  initAnalytics();
}
