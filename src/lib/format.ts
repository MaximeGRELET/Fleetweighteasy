/**
 * Formatage des nombres affichés.
 *
 * Aucun calcul ici : ces fonctions mettent en forme des valeurs déjà produites
 * par le domaine. Un arrondi d'affichage ne doit jamais devenir une source de
 * vérité (PLAN_IMPLEMENTATION §3.3).
 */

/** Espace insécable étroit : le séparateur de milliers en français. */
const THIN_NBSP = ' ';
/** Espace insécable : ne jamais séparer un nombre de son unité en fin de ligne. */
const NBSP = ' ';

function formatDecimal(value: number, maximumFractionDigits: number): string {
  const rounded = Number(value.toFixed(maximumFractionDigits));
  const absolute = Math.abs(rounded).toString();
  const separatorIndex = absolute.indexOf('.');
  const hasDecimals = separatorIndex !== -1;

  const integerPart = hasDecimals ? absolute.slice(0, separatorIndex) : absolute;
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, THIN_NBSP);
  // Signe moins typographique, et non le trait d'union du clavier.
  const sign = rounded < 0 ? '−' : '';

  return hasDecimals
    ? `${sign}${grouped},${absolute.slice(separatorIndex + 1)}`
    : `${sign}${grouped}`;
}

export function formatKcal(value: number): string {
  return `${formatDecimal(Math.round(value), 0)}${NBSP}kcal`;
}

export function formatGrams(value: number): string {
  return `${formatDecimal(value, 1)}${NBSP}g`;
}

export function formatKg(value: number, fractionDigits = 1): string {
  return `${formatDecimal(value, fractionDigits)}${NBSP}kg`;
}

/** Rythme hebdomadaire, arrondi au centième : 0,6 kg par semaine. */
export function formatWeeklyRate(weeklyRateKg: number): string {
  return `${formatDecimal(weeklyRateKg, 2)}${NBSP}kg par semaine`;
}

export function formatCm(value: number): string {
  return `${formatDecimal(value, 0)}${NBSP}cm`;
}

/** Date civile `YYYY-MM-DD` → `15 mars 2026`. */
const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

export function formatIsoDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);

  if (!match) {
    return isoDate;
  }

  const month = MONTHS[Number(match[2]) - 1];
  return month ? `${Number(match[3])} ${month} ${match[1]}` : isoDate;
}
