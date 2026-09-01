import { ADVICE_BLOCKS, SENSITIVE_BLOCK_IDS } from '@/domain/advice/content';
import type { AdviceBlock } from '@/domain/advice/types';

/**
 * Contrôles sur le contenu lui-même.
 *
 * Les briques sont des données rédigées à la main : ce sont ces tests, et non
 * le typage, qui empêchent une erreur de saisie de passer inaperçue.
 */
describe('contenu des briques', () => {
  it('couvre les quinze topics du brief', () => {
    const topics = new Set(ADVICE_BLOCKS.map((block) => block.topic));

    expect(topics.size).toBe(15);
  });

  it('n’a aucun identifiant en double', () => {
    const ids = ADVICE_BLOCKS.map((block) => block.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('respecte la convention d’identifiant `topic__variante`', () => {
    for (const block of ADVICE_BLOCKS) {
      expect(block.id).toMatch(/^[a-z_]+__[a-z_]+$/);
      expect(block.id.startsWith(`${block.topic}__`)).toBe(true);
    }
  });

  it('donne à chaque brique un titre et un corps non vides', () => {
    for (const block of ADVICE_BLOCKS) {
      expect(block.title.length).toBeGreaterThan(0);
      expect(block.body.length).toBeGreaterThan(80);
    }
  });

  it('attribue une priorité positive à chaque brique', () => {
    for (const block of ADVICE_BLOCKS) {
      expect(block.priority).toBeGreaterThan(0);
    }
  });

  /**
   * Le découplage central de la Phase 6 : les chiffres viennent des formules,
   * jamais du contenu. Une brique qui annoncerait « 1 800 kcal » deviendrait
   * fausse à la première variation de poids, sans que rien ne le signale.
   */
  describe('aucun chiffre calculé en dur', () => {
    /** Nombres suivis d'une unité nutritionnelle : la forme à proscrire. */
    const CALCULATED_NUMBER = /\d[\d\s  .,]*\s*(kcal|calories|kg|g\b|grammes)/i;

    it.each(ADVICE_BLOCKS.map((block) => [block.id, block] as const))(
      '%s ne chiffre ni calories ni grammes',
      (_id, block: AdviceBlock) => {
        expect(`${block.title} ${block.body}`).not.toMatch(CALCULATED_NUMBER);
      },
    );
  });

  /**
   * Règles de sécurité du contenu (BRIEF_BRIQUES_CONSEIL §5). Le ton n'est pas
   * une affaire de goût : ces briques touchent au comportement alimentaire.
   */
  describe('règles de sécurité du contenu', () => {
    const FORBIDDEN = [
      'saute un repas',
      'sauter des repas pour',
      'jeûne',
      'punir',
      'tricher',
      'triché',
      'mauvais aliment',
      'aliment interdit',
      'tu as échoué',
      'sois discipliné',
      'brûle ce que tu as mangé',
    ];

    it.each(ADVICE_BLOCKS.map((block) => [block.id, block] as const))(
      '%s n’emploie aucune formulation proscrite',
      (_id, block: AdviceBlock) => {
        const text = `${block.title} ${block.body}`.toLowerCase();

        for (const phrase of FORBIDDEN) {
          expect(text).not.toContain(phrase);
        }
      },
    );

    it('recense les trois briques à faire valider par un professionnel', () => {
      const ids = ADVICE_BLOCKS.map((block) => block.id);

      expect(SENSITIVE_BLOCK_IDS).toEqual([
        'plateau__default',
        'recovery_after_slip__default',
        'hunger_satiety__default',
      ]);

      for (const sensitive of SENSITIVE_BLOCK_IDS) {
        expect(ids).toContain(sensitive);
      }
    });

    it('présente la faim intense comme un signal de manger, jamais de résister', () => {
      const block = ADVICE_BLOCKS.find(({ id }) => id === 'hunger_satiety__default');

      expect(block?.body).toMatch(/il faut manger, pas résister/);
    });

    it('interdit explicitement la compensation punitive après un écart', () => {
      const block = ADVICE_BLOCKS.find(({ id }) => id === 'recovery_after_slip__default');

      expect(block?.body).toMatch(/ne compense pas/);
      expect(block?.body).toMatch(/plus de mal que de bien/);
    });
  });

  /**
   * L'ordre du conseil du jour repose entièrement sur la priorité : si deux
   * topics la partageaient, leur ordre dépendrait de l'ordre de déclaration, et
   * insérer une brique changerait silencieusement le conseil de quelqu'un.
   * Plusieurs briques d'un **même** topic peuvent en revanche partager une
   * priorité : la déduplication n'en garde qu'une.
   */
  it('n’attribue jamais la même priorité à deux topics différents', () => {
    const topicsByPriority = new Map<number, Set<string>>();

    for (const block of ADVICE_BLOCKS) {
      const topics = topicsByPriority.get(block.priority) ?? new Set<string>();
      topics.add(block.topic);
      topicsByPriority.set(block.priority, topics);
    }

    const collisions = [...topicsByPriority.entries()]
      .filter(([, topics]) => topics.size > 1)
      .map(([priority, topics]) => `${priority} : ${[...topics].join(', ')}`);

    expect(collisions).toEqual([]);
  });

  describe('conditions déclarées', () => {
    it('n’attache une condition qu’aux briques situationnelles', () => {
      const withCondition = ADVICE_BLOCKS.filter((block) => block.condition).map(({ id }) => id);

      expect(withCondition.sort()).toEqual([
        'getting_started__default',
        'plateau__default',
        'recovery_after_slip__default',
        'weighing_fluctuations__reminder',
      ]);
    });

    it('donne aux briques situationnelles une priorité supérieure aux briques générales', () => {
      const situational = ADVICE_BLOCKS.filter(
        (block) => block.condition && block.id !== 'weighing_fluctuations__reminder',
      );

      // Un plateau ou un écart récent passe devant un rappel d'hydratation.
      for (const block of situational) {
        expect(block.priority).toBeGreaterThanOrEqual(85);
      }
    });
  });
});
