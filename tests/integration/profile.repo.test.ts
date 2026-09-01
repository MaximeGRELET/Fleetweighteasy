import { getSyncMeta } from '@/data/db/sync-meta';
import { DataIntegrityError } from '@/data/errors';
import { createConsentRepository, type ConsentRepository } from '@/data/repositories/consent.repo';
import { createProfileRepository, type ProfileRepository } from '@/data/repositories/profile.repo';
import { profile as profileTable } from '@/data/db/schema';
import { toUserProfile } from '@/data/types';
import { calculateCalorieTarget } from '@/domain/nutrition/energy';

import { buildStoredProfile } from './helpers/fixtures';
import { createTestDatabase, type TestDatabase } from './helpers/test-db';

describe('profileRepo', () => {
  let database: TestDatabase;
  let profileRepo: ProfileRepository;

  beforeEach(() => {
    database = createTestDatabase();
    profileRepo = createProfileRepository(database.context);
  });

  afterEach(() => {
    database.close();
  });

  it('renvoie undefined tant qu’aucun profil n’existe', () => {
    expect(profileRepo.get()).toBeUndefined();
    expect(profileRepo.hasCompletedOnboarding()).toBe(false);
  });

  it('enregistre puis relit le profil à l’identique', () => {
    const stored = buildStoredProfile();

    profileRepo.save(stored);

    expect(profileRepo.get()).toEqual(stored);
    expect(profileRepo.hasCompletedOnboarding()).toBe(true);
  });

  it('conserve les listes et les champs optionnels', () => {
    profileRepo.save(
      buildStoredProfile({ allergies: ['gluten', 'lactose'], dislikes: [], weeklyRateKg: 0.5 }),
    );

    const reloaded = profileRepo.get();
    expect(reloaded?.allergies).toEqual(['gluten', 'lactose']);
    expect(reloaded?.dislikes).toEqual([]);
    expect(reloaded?.weeklyRateKg).toBe(0.5);
  });

  it('omet les champs optionnels absents plutôt que de les remonter à null', () => {
    profileRepo.save(buildStoredProfile({ targetWeightKg: undefined, weeklyRateKg: undefined }));

    const reloaded = profileRepo.get();
    expect(reloaded).toBeDefined();
    expect('targetWeightKg' in (reloaded ?? {})).toBe(false);
    expect('weeklyRateKg' in (reloaded ?? {})).toBe(false);
  });

  /**
   * La base de comparaison du recalcul adaptatif doit survivre au redémarrage :
   * si elle repartait à zéro, l'écart cumulé repartirait avec elle et la dérive
   * silencieuse reviendrait à chaque ouverture de l'app.
   */
  it('persiste la base d’annonce du recalcul adaptatif', () => {
    profileRepo.save(buildStoredProfile({ currentWeightKg: 79.4, lastNotifiedWeightKg: 85 }));

    expect(profileRepo.get()?.lastNotifiedWeightKg).toBe(85);
  });

  it('omet la base d’annonce tant qu’aucun objectif n’a été annoncé', () => {
    profileRepo.save(buildStoredProfile({ lastNotifiedWeightKg: undefined }));

    const reloaded = profileRepo.get();

    // Absente plutôt que `null` : le domaine retombe alors sur `currentWeightKg`.
    expect('lastNotifiedWeightKg' in (reloaded ?? {})).toBe(false);
  });

  it('reste sur une seule ligne quels que soient les enregistrements successifs', () => {
    profileRepo.save(buildStoredProfile({ currentWeightKg: 72.5 }));
    database.advanceMinutes(60 * 24 * 7);
    profileRepo.save(buildStoredProfile({ currentWeightKg: 71.2 }));

    expect(database.db.select().from(profileTable).all()).toHaveLength(1);
    expect(profileRepo.get()?.currentWeightKg).toBe(71.2);
  });

  it('préserve la date de création et met à jour la date de modification', () => {
    profileRepo.save(buildStoredProfile());
    const created = database.db.select().from(profileTable).all()[0];

    database.advanceMinutes(120);
    profileRepo.save(buildStoredProfile({ currentWeightKg: 71 }));
    const updated = database.db.select().from(profileTable).all()[0];

    expect(updated?.createdAt).toBe(created?.createdAt);
    expect(updated?.updatedAt).not.toBe(created?.updatedAt);
  });

  it('ne persiste aucun objectif calculé : ils se recalculent depuis le profil', () => {
    const stored = buildStoredProfile();
    profileRepo.save(stored);

    const columns = Object.keys(database.db.select().from(profileTable).all()[0] ?? {});
    expect(columns).not.toEqual(expect.arrayContaining(['targetKcal', 'proteinG', 'tdeeKcal']));

    // Le profil relu suffit à reproduire exactement les mêmes chiffres.
    const at = new Date('2026-03-15T00:00:00Z');
    expect(calculateCalorieTarget(profileRepo.get() ?? stored, at)).toEqual(
      calculateCalorieTarget(stored, at),
    );
  });

  it('efface le profil et laisse une pierre tombale de synchronisation', () => {
    profileRepo.save(buildStoredProfile());
    database.advanceMinutes(5);

    profileRepo.clear();

    expect(profileRepo.get()).toBeUndefined();
    expect(getSyncMeta(database.db, 'profile', '1')).toMatchObject({
      dirty: true,
      deletedAt: database.currentNow().toISOString(),
    });
  });

  it('marque le profil comme à synchroniser à chaque enregistrement', () => {
    profileRepo.save(buildStoredProfile());

    expect(getSyncMeta(database.db, 'profile', '1')).toMatchObject({
      dirty: true,
      updatedAt: database.currentNow().toISOString(),
    });
  });

  it('échoue bruyamment si une colonne JSON est corrompue', () => {
    profileRepo.save(buildStoredProfile());
    database.db.update(profileTable).set({ allergies: 'pas du json' }).run();

    expect(() => profileRepo.get()).toThrow(DataIntegrityError);
  });

  it('rejette une forme JSON valide mais inattendue', () => {
    profileRepo.save(buildStoredProfile());
    database.db
      .update(profileTable)
      .set({ dislikes: JSON.stringify([{ nom: 'coriandre' }]) })
      .run();

    expect(() => profileRepo.get()).toThrow(/profile.dislikes/);
  });
});

describe('mappers du profil', () => {
  it('remonte les colonnes vers le type du domaine', () => {
    const database = createTestDatabase();
    const profileRepo = createProfileRepository(database.context);
    const stored = buildStoredProfile();

    profileRepo.save(stored);
    const row = database.db.select().from(profileTable).all()[0];

    expect(row).toBeDefined();
    expect(row && toUserProfile(row)).toEqual(stored);
    database.close();
  });
});

describe('consentRepo', () => {
  let database: TestDatabase;
  let consentRepo: ConsentRepository;

  beforeEach(() => {
    database = createTestDatabase();
    consentRepo = createConsentRepository(database.context);
  });

  afterEach(() => {
    database.close();
  });

  it('n’a rien enregistré au départ', () => {
    expect(consentRepo.get()).toBeUndefined();
    expect(consentRepo.hasGranted('2026-01')).toBe(false);
  });

  it('s’enregistre avant même qu’un profil existe', () => {
    const record = consentRepo.grant('2026-01');

    expect(record).toEqual({
      grantedAt: database.currentNow().toISOString(),
      policyVersion: '2026-01',
    });
    expect(consentRepo.hasGranted('2026-01')).toBe(true);
    // Aucun profil n'a été créé au passage.
    expect(createProfileRepository(database.context).get()).toBeUndefined();
  });

  it('redemande le consentement quand la politique change de version', () => {
    consentRepo.grant('2026-01');

    expect(consentRepo.hasGranted('2026-06')).toBe(false);
  });

  it('remplace l’enregistrement précédent sans créer de doublon', () => {
    consentRepo.grant('2026-01');
    database.advanceMinutes(60);
    const renewed = consentRepo.grant('2026-06');

    expect(consentRepo.get()).toEqual(renewed);
    expect(consentRepo.hasGranted('2026-06')).toBe(true);
  });

  it('permet le retrait du consentement', () => {
    consentRepo.grant('2026-01');
    database.advanceMinutes(5);

    consentRepo.revoke();

    expect(consentRepo.get()).toBeUndefined();
    expect(getSyncMeta(database.db, 'consent', '1')).toMatchObject({
      dirty: true,
      deletedAt: database.currentNow().toISOString(),
    });
  });
});
