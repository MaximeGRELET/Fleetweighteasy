import type { AdviceContext } from '@/domain/advice/types';

/** Contexte neutre : rien de particulier ne se passe, utilisateur installé. */
const BASE_CONTEXT: AdviceContext = {
  isNewUser: false,
  daysSinceStart: 60,
  plateauDetected: false,
  recentSlipDetected: false,
  weightTrend: 'down',
  loggedTodayCount: 3,
  hasWeighedThisWeek: true,
};

export function buildContext(overrides: Partial<AdviceContext> = {}): AdviceContext {
  return { ...BASE_CONTEXT, ...overrides };
}
