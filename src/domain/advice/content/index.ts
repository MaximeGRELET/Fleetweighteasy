import type { AdviceBlock } from '../types';

/**
 * Socle de contenu V1 — 21 briques, 15 topics.
 *
 * Transcription fidèle de `files/BRIQUES_CONSEIL_REDIGEES.md` : identifiants,
 * tags, conditions et priorités y sont déjà arrêtés, et ce fichier n'en
 * réinvente aucun. Toute retouche de texte se fait ici **et** dans le document
 * de rédaction, qui reste la référence éditoriale.
 *
 * Deux règles portent tout le découplage de la Phase 6 :
 *
 * **Aucun chiffre calculé n'apparaît dans une brique.** Pas de « ton objectif
 * est 1 800 kcal » : les valeurs viennent des formules (Phase 1) et sont
 * affichées à côté, jamais fondues dans le texte. Un test de contenu le
 * vérifie, parce qu'une brique chiffrée deviendrait fausse sans prévenir dès
 * que le profil change.
 *
 * **Ce sont des données, pas du code.** Aucune logique ici : le moteur décide
 * seul de ce qui s'affiche.
 *
 * Trois briques sont signalées comme sensibles par le brief et **doivent être
 * revalidées par un professionnel de santé** avant la production :
 * `plateau__default`, `recovery_after_slip__default`, `hunger_satiety__default`.
 */
export const ADVICE_BLOCKS: readonly AdviceBlock[] = [
  {
    id: 'getting_started__default',
    topic: 'getting_started',
    tags: [],
    priority: 100,
    condition: { requires: { isNewUser: true } },
    title: 'Bienvenue, on commence en douceur',
    body:
      'Les premiers jours servent juste à prendre l’habitude de noter ce que tu manges. Pas ' +
      'besoin que ce soit parfait : c’est la régularité qui compte, pas la précision au gramme ' +
      'près. Ajoute ton premier repas quand tu veux, on avance à ton rythme.',
  },

  {
    id: 'understanding_deficit__weight_loss',
    topic: 'understanding_deficit',
    tags: ['goal:weight_loss'],
    priority: 60,
    title: 'Comment fonctionne la perte de poids',
    body:
      'Perdre du poids, c’est consommer un peu moins d’énergie que ce que ton corps dépense. ' +
      'C’est de loin le levier le plus important, bien avant le choix des aliments ou du sport. ' +
      'On vise un écart modéré et tenable dans la durée, pas un régime brutal qui s’effondre au ' +
      'bout d’une semaine.',
  },
  {
    id: 'understanding_deficit__recomp',
    topic: 'understanding_deficit',
    tags: ['goal:recomposition'],
    priority: 55,
    title: 'Perdre du gras, garder du muscle',
    body:
      'En recomposition, tu manges autour de ton niveau d’entretien : l’idée est de perdre du ' +
      'gras tout en préservant ou en gagnant du muscle. La balance bouge peu, mais ton corps se ' +
      'transforme. C’est plus lent à lire sur le chiffre, plus visible dans le miroir.',
  },

  {
    id: 'protein__omnivore',
    topic: 'protein',
    tags: ['goal:weight_loss', 'diet:omnivore'],
    priority: 50,
    title: 'Les protéines, ta priorité',
    body:
      'En période de perte, les protéines protègent ton muscle et te calent mieux entre les ' +
      'repas. Vise-les à chaque repas : viande, poisson, œufs, mais aussi légumineuses, tofu ou ' +
      'laitages. C’est le macronutriment à ne pas négliger.',
  },
  {
    id: 'protein__vegetarian',
    topic: 'protein',
    tags: ['diet:vegetarian'],
    priority: 50,
    title: 'Des protéines sans viande',
    body:
      'Tu peux largement couvrir tes besoins en protéines sans viande. Appuie-toi sur les œufs, ' +
      'les laitages, les légumineuses (lentilles, pois chiches), le tofu et le tempeh. ' +
      'Répartis-les sur la journée pour un effet optimal.',
  },
  {
    id: 'protein__vegan',
    topic: 'protein',
    tags: ['diet:vegan'],
    priority: 50,
    title: 'Des protéines 100 % végétales',
    body:
      'Légumineuses, tofu, tempeh, seitan et protéines de pois te permettent d’atteindre tes ' +
      'objectifs sans produit animal. Varie les sources dans la journée pour couvrir tous les ' +
      'acides aminés. C’est tout à fait faisable avec un peu d’organisation.',
  },
  {
    id: 'protein__recomp',
    topic: 'protein',
    tags: ['goal:recomposition'],
    priority: 52,
    title: 'Protéines et entraînement, le duo gagnant',
    body:
      'En recomposition, les protéines sont encore plus centrales : ce sont elles qui, ' +
      'combinées à l’entraînement, construisent le muscle. Répartis-les sur tes repas plutôt que ' +
      'tout d’un coup. C’est le carburant de ta transformation.',
  },

  {
    id: 'plateau__default',
    topic: 'plateau',
    tags: [],
    priority: 90,
    condition: { requires: { plateauDetected: true } },
    title: 'Un palier, c’est normal',
    body:
      'Ton poids stagne depuis quelques temps, et c’est une étape que presque tout le monde ' +
      'traverse — ce n’est pas un échec. Souvent, c’est de l’eau ou une simple variation qui ' +
      'masque tes progrès réels. Avant tout changement, continue sur ta lancée et vérifie juste ' +
      'que ton suivi reste régulier : la patience paie ici.',
  },

  {
    id: 'weighing_fluctuations__default',
    topic: 'weighing_fluctuations',
    tags: [],
    priority: 40,
    title: 'La balance monte et descend, c’est normal',
    body:
      'Ton poids varie d’un jour à l’autre selon l’eau, le sel, la digestion ou le cycle — ça ne ' +
      'reflète pas ta graisse. Ce qui compte, c’est la tendance sur plusieurs jours, pas le ' +
      'chiffre d’un matin. Fie-toi à ta courbe, pas à la pesée isolée.',
  },
  {
    id: 'weighing_fluctuations__reminder',
    topic: 'weighing_fluctuations',
    tags: [],
    priority: 45,
    condition: { requires: { hasWeighedThisWeek: false } },
    title: 'Un petit point sur la balance ?',
    body:
      'Tu ne t’es pas pesé cette semaine. Une pesée hebdomadaire suffit pour suivre ta tendance, ' +
      'sans pression ni obsession du chiffre. Quand tu veux, dans les mêmes conditions de ' +
      'préférence.',
  },

  {
    id: 'hunger_satiety__default',
    topic: 'hunger_satiety',
    tags: ['goal:weight_loss'],
    priority: 42,
    title: 'Gérer la faim sans souffrir',
    body:
      'Avoir un peu faim en période de perte peut arriver, mais tu ne dois jamais te sentir vidé ' +
      'ou affamé. Mise sur les protéines, les fibres et les aliments à fort volume (légumes, ' +
      'soupes) qui calent sans exploser les calories, et bois régulièrement. Si la faim est ' +
      'intense, c’est le signe qu’il faut manger, pas résister.',
  },

  {
    id: 'hydration__default',
    topic: 'hydration',
    tags: [],
    priority: 20,
    title: 'Bois de l’eau, simplement',
    body:
      'Bien s’hydrater aide à la satiété et au bien-être général, et on confond parfois soif et ' +
      'faim. Garde une bouteille à portée de main et bois régulièrement dans la journée. Pas ' +
      'besoin d’en faire une contrainte.',
  },

  {
    id: 'sleep__default',
    topic: 'sleep',
    tags: [],
    priority: 30,
    title: 'Le sommeil pèse dans la balance',
    body:
      'Mal dormir augmente les fringales et les envies de sucre le lendemain — ton appétit est ' +
      'directement lié à ton repos. Un coucher plus régulier fait souvent plus pour ta perte de ' +
      'poids qu’un effort de volonté. Soigne tes nuits autant que tes repas.',
  },

  {
    id: 'alcohol__default',
    topic: 'alcohol',
    tags: ['goal:weight_loss'],
    priority: 25,
    title: 'L’alcool et tes objectifs',
    body:
      'L’alcool apporte des calories « vides » et met en pause l’utilisation des graisses le ' +
      'temps que ton corps le gère. Pas besoin de tout supprimer : en être conscient et modérer ' +
      'suffit à éviter que ça freine tes progrès. Une question d’équilibre, pas d’interdiction.',
  },

  {
    id: 'weekends_slips__default',
    topic: 'weekends_slips',
    tags: ['goal:weight_loss'],
    priority: 35,
    title: 'Les week-ends font partie du jeu',
    body:
      'Sorties, repas de famille, imprévus : ça fait partie de la vie et ça n’a rien de grave. ' +
      'Ce qui compte, c’est la cohérence sur l’ensemble de la semaine, pas un repas isolé. ' +
      'Anticipe quand tu peux, profite sans culpabiliser, et reprends ton rythme ensuite.',
  },

  {
    id: 'recovery_after_slip__default',
    topic: 'recovery_after_slip',
    tags: [],
    priority: 85,
    condition: { requires: { recentSlipDetected: true } },
    title: 'Un écart n’efface pas tes progrès',
    body:
      'Tu as un peu dépassé, et ce n’est pas grave du tout : un repas ne défait pas des semaines ' +
      'd’efforts. Surtout, ne compense pas en sautant des repas ou en te punissant au sport — ça ' +
      'fait plus de mal que de bien. Reprends simplement ton rythme au prochain repas, comme si ' +
      'de rien n’était.',
  },

  {
    id: 'weight_vs_fat__default',
    topic: 'weight_vs_fat',
    tags: [],
    priority: 38,
    title: 'Le poids ne dit pas tout',
    body:
      'La balance mesure ton poids total, pas ta composition : tu peux perdre du gras sans ' +
      'qu’elle bouge, si tu gagnes du muscle ou retiens de l’eau. Regarde aussi tes mesures, tes ' +
      'vêtements et ton énergie. Ce sont souvent de meilleurs indicateurs que le seul chiffre.',
  },

  {
    id: 'recomposition__default',
    topic: 'recomposition',
    tags: ['goal:recomposition'],
    priority: 58,
    title: 'Les trois piliers de la recomposition',
    body:
      'La recomposition repose sur trois choses : l’entraînement en résistance, des protéines ' +
      'suffisantes, et un léger déficit ou un maintien. C’est plus lent sur la balance, mais ' +
      'c’est ce qui redessine vraiment ta silhouette. Constance et patience sont tes meilleures ' +
      'alliées.',
  },

  {
    id: 'resistance_training__weight_loss',
    topic: 'resistance_training',
    tags: ['goal:weight_loss', 'trains:strength'],
    priority: 48,
    title: 'Garde la muscu pendant ta perte',
    body:
      'Continuer la musculation en période de perte protège ton muscle, ce qui fait que ' +
      'l’essentiel de ce que tu perds vient bien du gras. C’est ce qui fait la différence entre ' +
      '« maigrir » et « s’affiner ». Ne lâche pas la charge, même en déficit.',
  },
  {
    id: 'resistance_training__encourage',
    topic: 'resistance_training',
    tags: ['goal:weight_loss', 'trains:cardio'],
    priority: 33,
    title: 'Et si tu ajoutais un peu de résistance ?',
    body:
      'Le cardio est excellent, mais ajouter un peu de renforcement musculaire t’aiderait à ' +
      'préserver ton muscle pendant la perte. Même deux courtes séances par semaine font une ' +
      'vraie différence sur ton physique final. À considérer, sans pression.',
  },

  {
    id: 'cardio_progression__default',
    topic: 'cardio_progression',
    tags: ['trains:cardio'],
    priority: 34,
    title: 'Progresser en cardio sans se blesser',
    body:
      'Pour progresser durablement, augmente ton volume petit à petit plutôt que tout d’un coup, ' +
      'et alterne les intensités. La récupération fait partie de l’entraînement, pas contre lui. ' +
      'Ton corps s’adapte mieux à la régularité qu’aux gros pics.',
  },
];

/**
 * Briques touchant à la santé mentale et aux comportements alimentaires.
 *
 * Recensées ici pour que la vérification avant production porte sur une liste
 * explicite plutôt que sur la mémoire de qui relit (BRIEF_BRIQUES_CONSEIL §5).
 */
export const SENSITIVE_BLOCK_IDS: readonly string[] = [
  'plateau__default',
  'recovery_after_slip__default',
  'hunger_satiety__default',
];
