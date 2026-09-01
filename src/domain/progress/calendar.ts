import { InvalidInputError } from '@/domain/errors';

/**
 * Arithmétique sur les dates civiles `YYYY-MM-DD`.
 *
 * Tout le suivi du poids raisonne en jours calendaires, jamais en instants : une
 * pesée appartient à une journée, pas à une heure. Les calculs passent donc par
 * UTC — `new Date('2026-03-15')` est interprété en UTC alors que
 * `new Date(2026, 2, 15)` l'est en heure locale, et mélanger les deux décale
 * les fenêtres d'un jour selon le fuseau de l'appareil.
 */

const MS_PER_DAY = 86_400_000;

/** Convertit une date civile en instant UTC (minuit). */
export function parseIsoDate(value: string, field = 'date'): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) {
    throw new InvalidInputError(field, `Date invalide : « ${value} » (format attendu YYYY-MM-DD).`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const asDate = new Date(Date.UTC(year, month - 1, day));

  // `Date.UTC` normalise silencieusement : le 31 février deviendrait le 2 ou
  // le 3 mars. On refuse plutôt que de décaler la donnée à l'insu de l'appelant.
  const isRealCalendarDay =
    asDate.getUTCFullYear() === year &&
    asDate.getUTCMonth() === month - 1 &&
    asDate.getUTCDate() === day;

  if (!isRealCalendarDay) {
    throw new InvalidInputError(field, `Date inexistante au calendrier : « ${value} ».`);
  }

  return asDate;
}

/** Instant UTC → date civile `YYYY-MM-DD`. */
export function toIsoDate(date: Date): string {
  const year = String(date.getUTCFullYear()).padStart(4, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Décale une date civile d'un nombre de jours, positif ou négatif. */
export function addDays(isoDate: string, days: number): string {
  if (!Number.isInteger(days)) {
    throw new InvalidInputError('days', 'Le décalage doit être un nombre entier de jours.');
  }

  return toIsoDate(new Date(parseIsoDate(isoDate).getTime() + days * MS_PER_DAY));
}

/**
 * Nombre de jours entre deux dates civiles. Signé : négatif si `toDate`
 * précède `fromDate`.
 */
export function daysBetween(fromDate: string, toDate: string): number {
  const from = parseIsoDate(fromDate, 'fromDate');
  const to = parseIsoDate(toDate, 'toDate');
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

/** Compare deux dates civiles, pour trier une série chronologiquement. */
export function compareIsoDates(a: string, b: string): number {
  // Le format `YYYY-MM-DD` à largeur fixe se trie correctement en lexicographie.
  return a < b ? -1 : a > b ? 1 : 0;
}
