import { InvalidBiometricsError } from '@/domain/errors';

/**
 * Âge en années révolues, dérivé de la date de naissance.
 *
 * L'âge n'est jamais stocké : il deviendrait faux avec le temps
 * (PHASE_1_DOMAINE_NUTRITIONNEL §2.2).
 *
 * @param birthDate date ISO 8601 (`YYYY-MM-DD`)
 * @param now instant de référence, injecté pour rendre la fonction pure et testable
 */
export function getAge(birthDate: string, now: Date = new Date()): number {
  const birth = parseIsoDate(birthDate);

  if (Number.isNaN(now.getTime())) {
    throw new InvalidBiometricsError('now', "L'instant de référence est invalide.");
  }

  let age = now.getUTCFullYear() - birth.year;

  const beforeBirthdayThisYear =
    now.getUTCMonth() + 1 < birth.month ||
    (now.getUTCMonth() + 1 === birth.month && now.getUTCDate() < birth.day);

  if (beforeBirthdayThisYear) {
    age -= 1;
  }

  if (age < 0) {
    throw new InvalidBiometricsError('birthDate', 'La date de naissance est dans le futur.');
  }

  return age;
}

type CalendarDate = { year: number; month: number; day: number };

/**
 * Analyse une date civile sans passer par le fuseau local : `new Date('YYYY-MM-DD')`
 * est interprété en UTC, ce qui décalerait l'âge d'un jour selon la région.
 */
function parseIsoDate(value: string): CalendarDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) {
    throw new InvalidBiometricsError(
      'birthDate',
      `Date de naissance invalide : « ${value} » (format attendu YYYY-MM-DD).`,
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const asDate = new Date(Date.UTC(year, month - 1, day));
  const isRealCalendarDay =
    asDate.getUTCFullYear() === year &&
    asDate.getUTCMonth() === month - 1 &&
    asDate.getUTCDate() === day;

  if (!isRealCalendarDay) {
    throw new InvalidBiometricsError(
      'birthDate',
      `Date de naissance inexistante au calendrier : « ${value} ».`,
    );
  }

  return { year, month, day };
}
