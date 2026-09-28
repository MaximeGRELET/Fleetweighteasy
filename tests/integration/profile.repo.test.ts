import { getSyncMeta, listDirty } from '@/data/db/sync-meta';
import { DataIntegrityError } from '@/data/errors';
import { createConsentRepository, type ConsentRepository } from '@/data/repositories/consent.repo';
import { createProfileRepository, type ProfileRepository } from '@/data/repositories/profile.repo';
import { goalChangeEvent, profile as profileTable } from '@/data/db/schema';
import { toUserProfile } from '@/data/types';
import { calculateCalorieTarget } from '@/domain/nutrition/energy';
import { detectRiskSignals, getMaxWeeklyRateKg } from '@/domain/nutrition/safety';

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

describe('profileRepo — historique des objectifs', () => {
  let database: TestDatabase;
  let profileRepo: ProfileRepository;

  beforeEach(() => {
    database = createTestDatabase();
    profileRepo = createProfileRepository(database.context);
  });

  afterEach(() => {
    database.close();
  });

  it('est vide tant qu’aucun profil n’a été enregistré', () => {
    expect(profileRepo.getGoalHistory()).toEqual([]);
  });

  it('enregistre l’objectif défini à l’onboarding', () => {
    profileRepo.save(buildStoredProfile({ targetWeightKg: 65, weeklyRateKg: 0.5 }));

    expect(profileRepo.getGoalHistory()).toEqual([
      {
        at: database.currentNow().toISOString(),
        sex: 'female',
        currentWeightKg: 72.5,
        heightCm: 168,
        targetWeightKg: 65,
        requestedWeeklyRateKg: 0.5,
      },
    ]);
  });

  it('ajoute un événement à chaque révision, sans réécrire les précédents', () => {
    profileRepo.save(buildStoredProfile({ targetWeightKg: 65 }));
    database.advanceMinutes(60 * 24);
    profileRepo.save(buildStoredProfile({ targetWeightKg: 62 }));
    database.advanceMinutes(60 * 24);
    profileRepo.save(buildStoredProfile({ targetWeightKg: 60 }));

    expect(profileRepo.getGoalHistory().map((event) => event.targetWeightKg)).toEqual([65, 62, 60]);
  });

  /**
   * Le recalcul adaptatif réécrit le profil après chaque pesée significative :
   * ce n'est pas un choix de l'utilisateur et il ne doit pas compter comme tel.
   */
  it('n’ajoute rien quand seul le poids courant change', () => {
    profileRepo.save(buildStoredProfile());
    database.advanceMinutes(60 * 24 * 7);
    profileRepo.save(buildStoredProfile({ currentWeightKg: 71.8, lastNotifiedWeightKg: 72.5 }));

    expect(profileRepo.getGoalHistory()).toHaveLength(1);
  });

  it('conserve le rythme demandé avant plafonnement', () => {
    const requested = 1.5;
    expect(getMaxWeeklyRateKg(72.5)).toBeLessThan(requested);

    profileRepo.save(buildStoredProfile({ weeklyRateKg: requested }));

    expect(profileRepo.getGoalHistory()[0]?.requestedWeeklyRateKg).toBe(requested);
  });

  it('marque chaque événement comme à synchroniser', () => {
    profileRepo.save(buildStoredProfile());

    const [row] = database.db.select().from(goalChangeEvent).all();
    expect(row && getSyncMeta(database.db, 'goal_change_event', row.id)).toMatchObject({
      dirty: true,
      updatedAt: database.currentNow().toISOString(),
    });
  });

  it('efface l’historique avec le profil, pierres tombales comprises', () => {
    profileRepo.save(buildStoredProfile({ targetWeightKg: 65 }));
    database.advanceMinutes(60);
    profileRepo.save(buildStoredProfile({ targetWeightKg: 62 }));
    database.advanceMinutes(5);

    profileRepo.clear();

    expect(profileRepo.getGoalHistory()).toEqual([]);
    const tombstones = listDirty(database.db).filter(
      (record) => record.entityType === 'goal_change_event',
    );
    expect(tombstones).toHaveLength(2);
    expect(tombstones.every((record) => record.deletedAt !== undefined)).toBe(true);
  });

  it('fournit à la détection de quoi repérer des révisions répétées', () => {
    for (const targetWeightKg of [65, 62, 60]) {
      profileRepo.save(buildStoredProfile({ targetWeightKg }));
      database.advanceMinutes(60 * 24);
    }

    expect(detectRiskSignals(profileRepo.getGoalHistory())).toContain(
      'repeatedly_lowered_target_weight',
    );
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
