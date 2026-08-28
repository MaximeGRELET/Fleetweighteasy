import { eq } from 'drizzle-orm';

import { consent } from '@/data/db/schema';
import { markDeleted, markDirty } from '@/data/db/sync-meta';
import { CONSENT_ROW_ID } from '@/data/types';

import type { RepositoryContext } from './context';

/**
 * Consentement aux données de santé (RGPD).
 *
 * Recueilli **avant** toute collecte biométrique (Phase 3 §3.4), donc avant que
 * le profil existe : d'où une table dédiée plutôt qu'une colonne du profil.
 */
export interface ConsentRecord {
  /** Horodatage ISO 8601 du consentement explicite. */
  grantedAt: string;
  /** Version de la politique de confidentialité acceptée. */
  policyVersion: string;
}

export interface ConsentRepository {
  get(): ConsentRecord | undefined;
  /** Vrai si l'utilisateur a consenti à la version courante de la politique. */
  hasGranted(policyVersion: string): boolean;
  /** Enregistre le consentement explicite et l'horodate. */
  grant(policyVersion: string): ConsentRecord;
  /** Retrait du consentement — droit à la suppression (RGPD). */
  revoke(): void;
}

const CONSENT_SYNC_ID = String(CONSENT_ROW_ID);

export function createConsentRepository(context: RepositoryContext): ConsentRepository {
  const { db, now } = context;

  function readRow() {
    return db.select().from(consent).where(eq(consent.id, CONSENT_ROW_ID)).get();
  }

  return {
    get() {
      const row = readRow();
      return row ? { grantedAt: row.grantedAt, policyVersion: row.policyVersion } : undefined;
    },

    hasGranted(policyVersion) {
      return readRow()?.policyVersion === policyVersion;
    },

    grant(policyVersion) {
      const at = now();
      const record: ConsentRecord = { grantedAt: at.toISOString(), policyVersion };

      db.transaction((tx) => {
        tx.insert(consent)
          .values({ id: CONSENT_ROW_ID, ...record })
          .onConflictDoUpdate({ target: consent.id, set: record })
          .run();

        markDirty(tx, 'consent', CONSENT_SYNC_ID, at);
      });

      return record;
    },

    revoke() {
      const at = now();

      db.transaction((tx) => {
        tx.delete(consent).where(eq(consent.id, CONSENT_ROW_ID)).run();
        markDeleted(tx, 'consent', CONSENT_SYNC_ID, at);
      });
    },
  };
}
