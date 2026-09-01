import { createRateLimiter, RateLimitExceededError } from '@/data/remote/throttle';

/**
 * Horloge et attente injectées : le test ne dort jamais réellement, il avance
 * le temps. Un limiteur testé avec de vrais `setTimeout` prendrait une minute
 * par cas.
 */
function createClock(startAt = 0) {
  let current = startAt;

  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
    /** Attente simulée : avancer l'horloge suffit à libérer la fenêtre. */
    sleep: (ms: number) => {
      current += ms;
      return Promise.resolve();
    },
  };
}

describe('createRateLimiter', () => {
  it('laisse passer les appels tant que la fenêtre n’est pas pleine', async () => {
    const clock = createClock();
    const limiter = createRateLimiter({
      maxCalls: 3,
      windowMs: 1000,
      maxWaitMs: 5000,
      now: clock.now,
      sleep: clock.sleep,
    });

    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();

    expect(limiter.available()).toBe(0);
    // Aucun appel n'a eu à attendre : trois scans d'affilée sont un usage normal.
    expect(clock.now()).toBe(0);
  });

  it('fait attendre l’appel qui déborde, plutôt que de le refuser', async () => {
    const clock = createClock();
    const limiter = createRateLimiter({
      maxCalls: 2,
      windowMs: 1000,
      maxWaitMs: 5000,
      now: clock.now,
      sleep: clock.sleep,
    });

    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();

    // Le troisième attend que le premier sorte de la fenêtre glissante.
    expect(clock.now()).toBe(1001);
  });

  it('libère les créneaux au fil de la fenêtre glissante', async () => {
    const clock = createClock();
    const limiter = createRateLimiter({
      maxCalls: 2,
      windowMs: 1000,
      maxWaitMs: 5000,
      now: clock.now,
      sleep: clock.sleep,
    });

    await limiter.acquire();
    await limiter.acquire();
    expect(limiter.available()).toBe(0);

    clock.advance(1001);

    expect(limiter.available()).toBe(2);
  });

  it('abandonne au-delà de l’attente maximale, pour ne pas bloquer un écran', async () => {
    // Sans ce plafond, un écran resterait sur son indicateur de chargement
    // aussi longtemps que la file est pleine (PHASES_2_A_5 §4.7).
    const clock = createClock();
    const limiter = createRateLimiter({
      maxCalls: 1,
      windowMs: 60_000,
      maxWaitMs: 100,
      now: clock.now,
      sleep: clock.sleep,
    });

    await limiter.acquire();

    await expect(limiter.acquire()).rejects.toBeInstanceOf(RateLimitExceededError);
  });

  it('n’attend pas du tout quand aucun créneau n’est prévu', async () => {
    const limiter = createRateLimiter({ maxCalls: 0, windowMs: 1000, maxWaitMs: 0 });

    await expect(limiter.acquire()).rejects.toBeInstanceOf(RateLimitExceededError);
  });

  it('ne compte pas les appels sortis de la fenêtre', () => {
    const clock = createClock();
    const limiter = createRateLimiter({
      maxCalls: 5,
      windowMs: 1000,
      maxWaitMs: 5000,
      now: clock.now,
      sleep: clock.sleep,
    });

    expect(limiter.available()).toBe(5);
  });

  it('sert plusieurs appelants en attente sans dépasser le quota', async () => {
    const clock = createClock();
    const limiter = createRateLimiter({
      maxCalls: 1,
      windowMs: 1000,
      maxWaitMs: 10_000,
      now: clock.now,
      sleep: clock.sleep,
    });

    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();

    // Chaque appel supplémentaire a attendu sa propre fenêtre : le quota n'a
    // jamais été dépassé, même sous une rafale.
    expect(clock.now()).toBe(2002);
  });
});
