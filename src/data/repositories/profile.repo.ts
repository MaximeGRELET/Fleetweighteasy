import { asc, eq } from 'drizzle-orm';

import { goalChangeEvent, profile } from '@/data/db/schema';
import { markDeleted, markDirty } from '@/data/db/sync-meta';
import {
  PROFILE_ROW_ID,
  toGoalChangeEvent,
  toGoalChangeEventInsert,
  toProfileInsert,
  toUserProfile,
} from '@/data/types';
import {
  buildGoalChangeEvent,
  type GoalChangeEvent,
  hasGoalChanged,
} from '@/domain/nutrition/safety';
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
  /**
   * Crée ou remplace le profil. `createdAt` est préservé.
   *
   * Si l'objectif change (voir `hasGoalChanged`), un événement est ajouté à
   * l'historique dans la même transaction : un profil modifié sans trace
   * rendrait la détection de signaux de risque aveugle à cette révision.
   */
  save(userProfile: UserProfile): UserProfile;
  /** Objectifs successifs, du plus ancien au plus récent. */
  getGoalHistory(): GoalChangeEvent[];
  hasCompletedOnboarding(): boolean;
  /** Efface le profil et son historique d'objectifs — droit à la suppression (RGPD). */
  clear(): void;
}

/** Identifiant de synchronisation de l'unique ligne de profil. */
const PROFILE_SYNC_ID = String(PROFILE_ROW_ID);

export function createProfileRepository(context: RepositoryContext): ProfileRepository {
  const { db, generateId, now } = context;

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

      const goalChanged = hasGoalChanged(existing && toUserProfile(existing), userProfile);

      db.transaction((tx) => {
        tx.insert(profile)
          .values(values)
          .onConflictDoUpdate({ target: profile.id, set: values })
          .run();

        markDirty(tx, 'profile', PROFILE_SYNC_ID, at);

        if (goalChanged) {
          const eventId = generateId();
          tx.insert(goalChangeEvent)
            .values(toGoalChangeEventInsert(eventId, buildGoalChangeEvent(userProfile, at)))
            .run();
          markDirty(tx, 'goal_change_event', eventId, at);
        }
      });

      return userProfile;
    },

    getGoalHistory() {
      return db
        .select()
        .from(goalChangeEvent)
        .orderBy(asc(goalChangeEvent.at))
        .all()
        .map(toGoalChangeEvent);
    },

    hasCompletedOnboarding() {
      return readRow()?.onboardingCompleted ?? false;
    },

    clear() {
      const at = now();

      db.transaction((tx) => {
        tx.delete(profile).where(eq(profile.id, PROFILE_ROW_ID)).run();
        markDeleted(tx, 'profile', PROFILE_SYNC_ID, at);

        // L'historique est une donnée de santé au même titre que le profil :
        // l'effacer avec lui, pierre tombale comprise pour la synchro.
        const events = tx.select({ id: goalChangeEvent.id }).from(goalChangeEvent).all();
        tx.delete(goalChangeEvent).run();
        for (const { id } of events) {
          markDeleted(tx, 'goal_change_event', id, at);
        }
      });
    },
  };
}
