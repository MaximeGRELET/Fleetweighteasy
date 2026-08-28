import { getSyncMeta } from '@/data/db/sync-meta';
import { DataIntegrityError } from '@/data/errors';
import { createWeightRepository, type WeightRepository } from '@/data/repositories/weight.repo';
import { createWorkoutRepository, type WorkoutRepository } from '@/data/repositories/workout.repo';
import { workoutLogEntry } from '@/data/db/schema';
import { estimateCardioKcalFromEntry } from '@/domain/nutrition/calories-sport';

import { createTestDatabase, type TestDatabase } from './helpers/test-db';

describe('weightRepo', () => {
  let database: TestDatabase;
  let weightRepo: WeightRepository;

  beforeEach(() => {
    database = createTestDatabase();
    weightRepo = createWeightRepository(database.context);
  });

  afterEach(() => {
    database.close();
  });

  it('enregistre et relit une pesée', () => {
    const entry = weightRepo.upsertForDate({ date: '2026-03-15', weightKg: 72.4 });

    expect(entry).toEqual({ id: 'id-1', date: '2026-03-15', weightKg: 72.4 });
    expect(weightRepo.getByDate('2026-03-15')).toEqual(entry);
    expect(weightRepo.getById('id-1')).toEqual(entry);
  });

  it('conserve la note quand il y en a une', () => {
    const entry = weightRepo.upsertForDate({
      date: '2026-03-15',
      weightKg: 72.4,
      note: 'après le sport',
    });

    expect(weightRepo.getByDate('2026-03-15')?.note).toBe('après le sport');
    expect(entry.note).toBe('après le sport');
  });

  it('corrige la pesée du jour au lieu d’en empiler une seconde', () => {
    const first = weightRepo.upsertForDate({ date: '2026-03-15', weightKg: 72.4 });
    database.advanceMinutes(600);
    const corrected = weightRepo.upsertForDate({ date: '2026-03-15', weightKg: 71.9 });

    // Même identifiant : côté synchro c'est une mise à jour, pas une
    // suppression suivie d'une création.
    expect(corrected.id).toBe(first.id);
    expect(weightRepo.getHistory()).toEqual([corrected]);
    expect(weightRepo.getByDate('2026-03-15')?.weightKg).toBe(71.9);
  });

  it('renvoie l’historique par date croissante', () => {
    weightRepo.upsertForDate({ date: '2026-03-17', weightKg: 71.8 });
    weightRepo.upsertForDate({ date: '2026-03-15', weightKg: 72.4 });
    weightRepo.upsertForDate({ date: '2026-03-16', weightKg: 72.1 });

    expect(weightRepo.getHistory().map((entry) => entry.date)).toEqual([
      '2026-03-15',
      '2026-03-16',
      '2026-03-17',
    ]);
  });

  it('borne l’historique à une plage', () => {
    weightRepo.upsertForDate({ date: '2026-03-10', weightKg: 73 });
    weightRepo.upsertForDate({ date: '2026-03-15', weightKg: 72.4 });
    weightRepo.upsertForDate({ date: '2026-03-20', weightKg: 71.5 });

    expect(
      weightRepo
        .getHistory({ fromDate: '2026-03-12', toDate: '2026-03-18' })
        .map((entry) => entry.date),
    ).toEqual(['2026-03-15']);
  });

  it('donne la dernière pesée connue', () => {
    weightRepo.upsertForDate({ date: '2026-03-15', weightKg: 72.4 });
    weightRepo.upsertForDate({ date: '2026-03-20', weightKg: 71.5 });

    expect(weightRepo.getLatest()?.date).toBe('2026-03-20');
  });

  it('renvoie undefined quand il n’y a aucune pesée', () => {
    expect(weightRepo.getLatest()).toBeUndefined();
    expect(weightRepo.getById('inconnu')).toBeUndefined();
    expect(weightRepo.getByDate('2026-03-15')).toBeUndefined();
    expect(weightRepo.getHistory()).toEqual([]);
  });

  it('supprime une pesée et laisse une pierre tombale', () => {
    const entry = weightRepo.upsertForDate({ date: '2026-03-15', weightKg: 72.4 });
    database.advanceMinutes(1);

    weightRepo.remove(entry.id);

    expect(weightRepo.getHistory()).toEqual([]);
    expect(getSyncMeta(database.db, 'weight_entry', entry.id)?.deletedAt).toBe(
      database.currentNow().toISOString(),
    );
  });
});

describe('workoutRepo', () => {
  let database: TestDatabase;
  let workoutRepo: WorkoutRepository;

  beforeEach(() => {
    database = createTestDatabase();
    workoutRepo = createWorkoutRepository(database.context);
  });

  afterEach(() => {
    database.close();
  });

  it('enregistre une séance de cardio avec sa dépense estimée', () => {
    const estimatedKcalBurned = estimateCardioKcalFromEntry({
      metEntryId: 'run_moderate',
      weightKg: 72,
      durationMin: 45,
    });

    const entry = workoutRepo.add({
      date: '2026-03-15',
      payload: {
        type: 'cardio',
        activity: 'running',
        metEntryId: 'run_moderate',
        durationMin: 45,
        distanceKm: 7.2,
      },
      estimatedKcalBurned,
    });

    expect(workoutRepo.getById(entry.id)).toEqual(entry);
    expect(entry.estimatedKcalBurned).toBe(502);
  });

  it('enregistre une séance de musculation sans estimation calorique', () => {
    const entry = workoutRepo.add({
      date: '2026-03-15',
      payload: {
        type: 'strength',
        durationMin: 55,
        exercises: [
          {
            exerciseId: 'squat',
            name: 'Squat',
            sets: [
              { reps: 8, weightKg: 60 },
              { reps: 8, weightKg: 60 },
            ],
          },
          { exerciseId: 'pullup', name: 'Traction', sets: [{ reps: 6 }] },
        ],
      },
    });

    const reloaded = workoutRepo.getById(entry.id);
    expect(reloaded).toEqual(entry);
    expect(reloaded?.estimatedKcalBurned).toBeUndefined();
    expect(reloaded?.payload.type).toBe('strength');
  });

  it('liste les séances par date et par plage', () => {
    workoutRepo.add({
      date: '2026-03-15',
      payload: { type: 'cardio', activity: 'walking', metEntryId: 'walk_brisk', durationMin: 30 },
      estimatedKcalBurned: 168,
    });
    workoutRepo.add({
      date: '2026-03-16',
      payload: { type: 'cardio', activity: 'cycling', metEntryId: 'bike_light', durationMin: 60 },
      estimatedKcalBurned: 280,
    });

    expect(workoutRepo.getByDate('2026-03-15')).toHaveLength(1);
    expect(workoutRepo.getByDateRange('2026-03-15', '2026-03-16')).toHaveLength(2);
    expect(workoutRepo.getByDateRange('2026-03-01', '2026-03-10')).toEqual([]);
  });

  it('somme la dépense estimée du jour', () => {
    workoutRepo.add({
      date: '2026-03-15',
      payload: { type: 'cardio', activity: 'walking', metEntryId: 'walk_brisk', durationMin: 30 },
      estimatedKcalBurned: 168,
    });
    workoutRepo.add({
      date: '2026-03-15',
      payload: {
        type: 'strength',
        exercises: [{ exerciseId: 'squat', name: 'Squat', sets: [{ reps: 10 }] }],
      },
    });

    // La musculation ne contribue pas : elle vise la composition, pas la dépense.
    expect(workoutRepo.getEstimatedKcalForDate('2026-03-15')).toBe(168);
    expect(workoutRepo.getEstimatedKcalForDate('2026-03-14')).toBe(0);
  });

  it('met à jour une séance', () => {
    const entry = workoutRepo.add({
      date: '2026-03-15',
      payload: { type: 'cardio', activity: 'walking', metEntryId: 'walk_brisk', durationMin: 30 },
      estimatedKcalBurned: 168,
    });

    const updated = workoutRepo.update({ ...entry, estimatedKcalBurned: 200 });

    expect(workoutRepo.getById(entry.id)).toEqual(updated);
    expect(workoutRepo.getByDate('2026-03-15')).toHaveLength(1);
  });

  it('supprime une séance', () => {
    const entry = workoutRepo.add({
      date: '2026-03-15',
      payload: { type: 'cardio', activity: 'walking', metEntryId: 'walk_brisk', durationMin: 30 },
    });

    workoutRepo.remove(entry.id);

    expect(workoutRepo.getById(entry.id)).toBeUndefined();
    expect(getSyncMeta(database.db, 'workout_log_entry', entry.id)?.deletedAt).toBeDefined();
  });

  it('refuse une charge utile incohérente avec la colonne `type`', () => {
    const entry = workoutRepo.add({
      date: '2026-03-15',
      payload: { type: 'cardio', activity: 'walking', metEntryId: 'walk_brisk', durationMin: 30 },
    });

    database.db.update(workoutLogEntry).set({ type: 'strength' }).run();

    expect(() => workoutRepo.getById(entry.id)).toThrow(DataIntegrityError);
  });

  it('refuse une charge utile malformée', () => {
    const entry = workoutRepo.add({
      date: '2026-03-15',
      payload: { type: 'cardio', activity: 'walking', metEntryId: 'walk_brisk', durationMin: 30 },
    });

    database.db
      .update(workoutLogEntry)
      .set({ payload: JSON.stringify({ type: 'natation' }) })
      .run();

    expect(() => workoutRepo.getById(entry.id)).toThrow(/workout_log_entry.payload/);
  });
});
