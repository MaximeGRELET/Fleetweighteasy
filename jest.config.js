/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['<rootDir>/tests/**/*.test.ts', '<rootDir>/tests/**/*.test.tsx'],
  testPathIgnorePatterns: ['<rootDir>/tests/e2e/'],
  collectCoverageFrom: [
    'src/domain/**/*.ts',
    'src/data/**/*.ts',
    'src/stores/**/*.ts',
    // Modules purement déclaratifs : types du domaine et schéma Drizzle. Ils
    // sont vérifiés par le typage et par les tests de migration, pas par une
    // métrique de lignes exécutées.
    '!src/domain/**/types.ts',
    '!src/data/db/schema.ts',
    '!src/data/db/client.ts',
    '!src/data/db/migrator.ts',
    '!src/data/repositories/index.ts',
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
