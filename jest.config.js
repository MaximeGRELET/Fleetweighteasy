/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['<rootDir>/tests/**/*.test.ts', '<rootDir>/tests/**/*.test.tsx'],
  testPathIgnorePatterns: ['<rootDir>/tests/e2e/'],
  // Le premier test d'un fichier d'écran paie la compilation à froid de l'écran
  // et de ses dépendances. Sur la CI, cela dépasse parfois les 5 s par défaut
  // (#25). 20 s absorbent ce démarrage sans laisser un vrai blocage passer
  // inaperçu.
  testTimeout: 20_000,
  collectCoverageFrom: [
    'src/domain/**/*.ts',
    'src/data/**/*.ts',
    'src/stores/**/*.ts',
    'src/lib/**/*.ts',
    // Modules purement déclaratifs : types du domaine et schéma Drizzle. Ils
    // sont vérifiés par le typage et par les tests de migration, pas par une
    // métrique de lignes exécutées.
    '!src/domain/**/types.ts',
    '!src/data/db/schema.ts',
    '!src/data/db/client.ts',
    '!src/data/db/migrator.ts',
    '!src/data/repositories/index.ts',
    // Câblage à la plateforme, sans logique propre.
    '!src/lib/id.ts',
    '!src/lib/app-info.ts',
    '!src/lib/env.ts',
    '!src/lib/observability/**',
    '!src/**/*.d.ts',
  ],
  coverageThreshold: {
    // Le domaine porte le risque métier (PLAN_IMPLEMENTATION §12) : quasi 100 %.
    'src/domain/nutrition/**/*.ts': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    'src/domain/journal/**/*.ts': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    // Entraînement : la sélection de programme et la progression de charge
    // décident de ce qu'on demande au corps de quelqu'un.
    'src/domain/training/**/*.ts': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    // Recettes : l'exclusion des allergènes est le seul filtre que la spec
    // qualifie de non négociable. Un chemin non couvert y est un allergène
    // potentiellement servi.
    'src/domain/recipes/**/*.ts': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    // Moteur de conseils : la sélection décide de ce qui s'affiche, dont les
    // mises en garde de santé. Un chemin non couvert, c'est un conseil qui ne
    // sort jamais — le mode de panne le plus discret qui soit.
    'src/domain/advice/**/*.ts': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    // Suivi du poids : la moyenne mobile, le rythme réel et la détection de
    // plateau décident de ce qui est annoncé à l'utilisateur sur sa santé.
    'src/domain/progress/**/*.ts': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    // Modèle et validation du profil : mêmes enjeux que les formules.
    'src/domain/profile/**/*.ts': {
      statements: 100,
      branches: 95,
      functions: 100,
      lines: 100,
    },
    // Traduction des garde-fous et formatage : un message manquant serait un
    // ajustement silencieux.
    'src/lib/**/*.ts': {
      statements: 100,
      branches: 95,
      functions: 100,
      lines: 100,
    },
    // La couche data est couverte par des tests d'intégration sur SQLite ;
    // le câblage à Expo (client, migrator, singletons) est exclu ci-dessus.
    'src/data/**/*.ts': {
      statements: 95,
      branches: 90,
      functions: 95,
      lines: 95,
    },
  },
};
