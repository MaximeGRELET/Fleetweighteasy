import { todayIsoDate, useSessionStore } from '@/stores/session';

describe('todayIsoDate', () => {
  it('formate la date locale en YYYY-MM-DD', () => {
    expect(todayIsoDate(new Date(2026, 2, 5, 23, 30))).toBe('2026-03-05');
  });

  it('complète les mois et jours sur deux chiffres', () => {
    expect(todayIsoDate(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });

  it('utilise le fuseau local, pas UTC', () => {
    // Un 1er janvier à 00h30 locale reste le 1er janvier pour l'utilisateur,
    // même si UTC est encore la veille.
    const localNewYear = new Date(2026, 0, 1, 0, 30);
    expect(todayIsoDate(localNewYear)).toBe('2026-01-01');
  });
});

describe('useSessionStore', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it('démarre sur la date du jour, base non prête', () => {
    const state = useSessionStore.getState();

    expect(state.selectedDate).toBe(todayIsoDate());
    expect(state.databaseReady).toBe(false);
    expect(state.expandedMealType).toBeUndefined();
  });

  it('change le jour affiché', () => {
    useSessionStore.getState().setSelectedDate('2026-03-15');

    expect(useSessionStore.getState().selectedDate).toBe('2026-03-15');
  });

  it('déplie puis replie un repas', () => {
    const { toggleMealType } = useSessionStore.getState();

    toggleMealType('lunch');
    expect(useSessionStore.getState().expandedMealType).toBe('lunch');

    toggleMealType('lunch');
    expect(useSessionStore.getState().expandedMealType).toBeUndefined();
  });

  it('ne garde qu’un seul repas déplié à la fois', () => {
    const { toggleMealType } = useSessionStore.getState();

    toggleMealType('lunch');
    toggleMealType('dinner');

    expect(useSessionStore.getState().expandedMealType).toBe('dinner');
  });

  it('signale que la base est prête', () => {
    useSessionStore.getState().setDatabaseReady(true);

    expect(useSessionStore.getState().databaseReady).toBe(true);
  });

  it('revient à l’état initial', () => {
    const state = useSessionStore.getState();
    state.setSelectedDate('2020-01-01');
    state.toggleMealType('snack');
    state.setDatabaseReady(true);

    state.reset();

    expect(useSessionStore.getState()).toMatchObject({
      selectedDate: todayIsoDate(),
      expandedMealType: undefined,
      databaseReady: false,
    });
  });
});
