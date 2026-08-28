/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['<rootDir>/tests/**/*.test.ts', '<rootDir>/tests/**/*.test.tsx'],
  testPathIgnorePatterns: ['<rootDir>/tests/e2e/'],
  collectCoverageFrom: ['src/domain/**/*.ts', '!src/domain/**/*.d.ts'],
  coverageThreshold: {
    // Le domaine porte le risque métier (PLAN_IMPLEMENTATION §12) : quasi 100 %.
    'src/domain/nutrition/**/*.ts': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
  },
};
