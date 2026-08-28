import { eq } from 'drizzle-orm';

import { profile } from '@/data/db/schema';
import { markDeleted, markDirty } from '@/data/db/sync-meta';
import { PROFILE_ROW_ID, toProfileInsert, toUserProfile } from '@/data/types';
import type { UserProfile } from '@/domain/profile/types';

import type { RepositoryContext } from './context';

/**
 * Accès au profil de l'utilisateur local.
 *
 * Le profil est la source de vérité de tous les calculs : les objectifs
 * (calories, macros) ne sont **jamais** persistés, ils se recalculent à la
 * volée via le domaine. Une seule ligne existe en base.
 */
export interface ProfileRepository {
  get(): UserProfile | undefined;
  /** Crée ou remplace le profil. `createdAt` est préservé. */
  save(userProfile: UserProfile): UserProfile;
  hasCompletedOnboarding(): boolean;
  /** Efface le profil — droit à la suppression (RGPD). */
  clear(): void;
}

/** Identifiant de synchronisation de l'unique ligne de profil. */
const PROFILE_SYNC_ID = String(PROFILE_ROW_ID);

export function createProfileRepository(context: RepositoryContext): ProfileRepository {
  const { db, now } = context;

  function readRow() {
    return db.select().from(profile).where(eq(profile.id, PROFILE_ROW_ID)).get();
  }

  return {
    get() {
      const row = readRow();
      return row ? toUserProfile(row) : undefined;
    },

    save(userProfile) {
      const at = now();
      const timestamp = at.toISOString();
      const existing = readRow();

      const values = toProfileInsert(userProfile, {
        // Un enregistrement ultérieur ne réécrit pas la date de création.
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      });

      db.transaction((tx) => {
        tx.insert(profile)
          .values(values)
          .onConflictDoUpdate({ target: profile.id, set: values })
          .run();

        markDirty(tx, 'profile', PROFILE_SYNC_ID, at);
      });

      return userProfile;
    },

    hasCompletedOnboarding() {
      return readRow()?.onboardingCompleted ?? false;
    },

    clear() {
      const at = now();

      db.transaction((tx) => {
        tx.delete(profile).where(eq(profile.id, PROFILE_ROW_ID)).run();
        markDeleted(tx, 'profile', PROFILE_SYNC_ID, at);
      });
    },
  };
}
