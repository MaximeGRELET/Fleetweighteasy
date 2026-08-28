import {
  formatCm,
  formatGrams,
  formatIsoDate,
  formatKcal,
  formatKg,
  formatWeeklyRate,
} from '@/lib/format';

/** Espaces insécables : le nombre ne doit jamais être séparé de son unité. */
const THIN_NBSP = '\u202f';
const NBSP = '\u00a0';

describe('formatKcal', () => {
  it('groupe les milliers avec une espace insécable étroite', () => {
    expect(formatKcal(2099)).toBe(`2${THIN_NBSP}099${NBSP}kcal`);
  });

  it('n’ajoute pas de séparateur sous mille', () => {
    expect(formatKcal(750)).toBe(`750${NBSP}kcal`);
  });

  it('arrondit à l’entier', () => {
    expect(formatKcal(1204.75)).toBe(`1${THIN_NBSP}205${NBSP}kcal`);
  });

  it('gère zéro', () => {
    expect(formatKcal(0)).toBe(`0${NBSP}kcal`);
  });

  it('utilise un vrai signe moins pour les valeurs négatives', () => {
    expect(formatKcal(-54)).toBe(`−54${NBSP}kcal`);
  });
});

describe('formatGrams et formatKg', () => {
  it('n’affiche la décimale que si elle existe', () => {
    expect(formatGrams(144)).toBe(`144${NBSP}g`);
    expect(formatGrams(4.1)).toBe(`4,1${NBSP}g`);
  });

  it('ne fabrique pas de fausse précision', () => {
    // 4,05 n'est pas représentable exactement : on n'invente pas un dixième.
    expect(formatGrams(4.05)).toBe(`4${NBSP}g`);
  });

  it('formate les poids', () => {
    expect(formatKg(72.45)).toBe(`72,5${NBSP}kg`);
    expect(formatKg(72, 0)).toBe(`72${NBSP}kg`);
  });
});

describe('formatWeeklyRate', () => {
  it('exprime le rythme en kg par semaine, au centième', () => {
    expect(formatWeeklyRate(0.6818)).toBe(`0,68${NBSP}kg par semaine`);
    expect(formatWeeklyRate(0.6)).toBe(`0,6${NBSP}kg par semaine`);
  });
});

describe('formatCm', () => {
  it('arrondit à l’entier', () => {
    expect(formatCm(180.4)).toBe(`180${NBSP}cm`);
  });
});

describe('formatIsoDate', () => {
  it('écrit la date en toutes lettres', () => {
    expect(formatIsoDate('2026-03-15')).toBe('15 mars 2026');
    expect(formatIsoDate('1992-06-01')).toBe('1 juin 1992');
    expect(formatIsoDate('2000-12-31')).toBe('31 décembre 2000');
  });

  it('rend la chaîne telle quelle si elle n’est pas une date ISO', () => {
    expect(formatIsoDate('pas une date')).toBe('pas une date');
  });

  it('rend la chaîne telle quelle si le mois est hors plage', () => {
    expect(formatIsoDate('2026-13-01')).toBe('2026-13-01');
  });
});
