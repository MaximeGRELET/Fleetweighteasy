// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

/**
 * Les règles `no-restricted-imports` ci-dessous ne sont pas cosmétiques :
 * elles rendent la règle d'architecture « les dépendances pointent vers le bas »
 * (PLAN_IMPLEMENTATION §3.1) vérifiable automatiquement plutôt que par relecture.
 */
const DOMAIN_FORBIDDEN = [
  { group: ['react', 'react-*'], message: 'Le domaine est du TypeScript pur : pas de React.' },
  {
    group: ['expo', 'expo-*', '@expo/*'],
    message: "Le domaine ne dépend d'aucune API de plateforme.",
  },
  {
    group: ['@sentry/*', 'posthog-*'],
    message: 'Le domaine ne fait pas de télémétrie.',
  },
  {
    group: [
      '@/data',
      '@/data/*',
      '@/hooks',
      '@/hooks/*',
      '@/components/*',
      '@/app/*',
      '@/stores/*',
    ],
    message: 'Le domaine ne connaît ni la data, ni les hooks, ni l’UI.',
  },
];

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', 'node_modules/*', '.expo/*', 'coverage/*'],
  },
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
    },
  },
  {
    // `plugins` est fourni par la config Expo sur ces mêmes fichiers.
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // Couche domaine : logique métier pure, aucune I/O.
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: DOMAIN_FORBIDDEN }],
    },
  },
  {
    // Couche UI : ne parle jamais directement à la data (toujours via un hook).
    files: ['src/app/**/*.tsx', 'src/components/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/data', '@/data/*'],
              message: "L'UI n'accède pas à la data directement : passer par un hook.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ['tests/**/*.ts', 'tests/**/*.tsx'],
    languageOptions: {
      globals: { jest: 'readonly' },
    },
  },
]);
