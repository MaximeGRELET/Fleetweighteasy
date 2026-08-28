import type { Config } from 'drizzle-kit';

/**
 * Configuration de `drizzle-kit generate`.
 *
 * `driver: 'expo'` produit en plus un `migrations.js` importable au runtime,
 * appliqué au démarrage de l'app (voir `src/data/db/migrator.ts`).
 */
export default {
  schema: './src/data/db/schema.ts',
  out: './src/data/db/migrations',
  dialect: 'sqlite',
  driver: 'expo',
} satisfies Config;
