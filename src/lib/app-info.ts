import Constants from 'expo-constants';

/**
 * Identité de l'application, lue depuis `app.json`.
 *
 * Source de vérité unique : le nom de code est provisoire
 * (PLAN_IMPLEMENTATION §15). Un renommage ne doit toucher que `app.json`
 * (`name`, `slug`, `scheme`, `ios.bundleIdentifier`, `android.package`),
 * plus `package.json` et le README. Jamais de nom en dur dans l'UI.
 */
export const appInfo = {
  name: Constants.expoConfig?.name ?? 'FleetWeightEasy',
  version: Constants.expoConfig?.version ?? '0.0.0',
} as const;
