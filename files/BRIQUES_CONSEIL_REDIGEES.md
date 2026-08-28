# Briques de conseil — Contenu rédigé (V1)

> **Complément de `BRIEF_BRIQUES_CONSEIL.md`.** Contenu prêt à intégrer dans `src/domain/advice/content/`.
> **Style :** tutoiement, 2-3 phrases par brique, ton sobre et bienveillant.
> **Rappel :** aucun chiffre calculé en dur — les valeurs sont injectées à l'affichage par le domaine.
> **Sensibles (à faire valider par un professionnel de santé) :** `plateau__default`, `recovery_after_slip__default`, `hunger_satiety__default`.

---

## getting_started

### getting_started__default
- **tags :** —
- **condition :** `isNewUser: true`
- **priorité :** 100
- **title :** Bienvenue, on commence en douceur
- **body :** Les premiers jours servent juste à prendre l'habitude de noter ce que tu manges. Pas besoin que ce soit parfait : c'est la régularité qui compte, pas la précision au gramme près. Ajoute ton premier repas quand tu veux, on avance à ton rythme.

---

## understanding_deficit

### understanding_deficit__weight_loss
- **tags :** `goal:weight_loss`
- **condition :** —
- **priorité :** 60
- **title :** Comment fonctionne la perte de poids
- **body :** Perdre du poids, c'est consommer un peu moins d'énergie que ce que ton corps dépense. C'est de loin le levier le plus important, bien avant le choix des aliments ou du sport. On vise un écart modéré et tenable dans la durée, pas un régime brutal qui s'effondre au bout d'une semaine.

### understanding_deficit__recomp
- **tags :** `goal:recomposition`
- **condition :** —
- **priorité :** 55
- **title :** Perdre du gras, garder du muscle
- **body :** En recomposition, tu manges autour de ton niveau d'entretien : l'idée est de perdre du gras tout en préservant ou en gagnant du muscle. La balance bouge peu, mais ton corps se transforme. C'est plus lent à lire sur le chiffre, plus visible dans le miroir.

---

## protein

### protein__omnivore
- **tags :** `goal:weight_loss`, `diet:omnivore`
- **condition :** —
- **priorité :** 50
- **title :** Les protéines, ta priorité
- **body :** En période de perte, les protéines protègent ton muscle et te calent mieux entre les repas. Vise-les à chaque repas : viande, poisson, œufs, mais aussi légumineuses, tofu ou laitages. C'est le macronutriment à ne pas négliger.

### protein__vegetarian
- **tags :** `diet:vegetarian`
- **condition :** —
- **priorité :** 50
- **title :** Des protéines sans viande
- **body :** Tu peux largement couvrir tes besoins en protéines sans viande. Appuie-toi sur les œufs, les laitages, les légumineuses (lentilles, pois chiches), le tofu et le tempeh. Répartis-les sur la journée pour un effet optimal.

### protein__vegan
- **tags :** `diet:vegan`
- **condition :** —
- **priorité :** 50
- **title :** Des protéines 100 % végétales
- **body :** Légumineuses, tofu, tempeh, seitan et protéines de pois te permettent d'atteindre tes objectifs sans produit animal. Varie les sources dans la journée pour couvrir tous les acides aminés. C'est tout à fait faisable avec un peu d'organisation.

### protein__recomp
- **tags :** `goal:recomposition`
- **condition :** —
- **priorité :** 52
- **title :** Protéines et entraînement, le duo gagnant
- **body :** En recomposition, les protéines sont encore plus centrales : ce sont elles qui, combinées à l'entraînement, construisent le muscle. Répartis-les sur tes repas plutôt que tout d'un coup. C'est le carburant de ta transformation.

---

## plateau

### plateau__default
- **tags :** —
- **condition :** `plateauDetected: true`
- **priorité :** 90
- **title :** Un palier, c'est normal
- **body :** Ton poids stagne depuis quelques temps, et c'est une étape que presque tout le monde traverse — ce n'est pas un échec. Souvent, c'est de l'eau ou une simple variation qui masque tes progrès réels. Avant tout changement, continue sur ta lancée et vérifie juste que ton suivi reste régulier : la patience paie ici.

---

## weighing_fluctuations

### weighing_fluctuations__default
- **tags :** —
- **condition :** —
- **priorité :** 40
- **title :** La balance monte et descend, c'est normal
- **body :** Ton poids varie d'un jour à l'autre selon l'eau, le sel, la digestion ou le cycle — ça ne reflète pas ta graisse. Ce qui compte, c'est la tendance sur plusieurs jours, pas le chiffre d'un matin. Fie-toi à ta courbe, pas à la pesée isolée.

### weighing_fluctuations__reminder
- **tags :** —
- **condition :** `hasWeighedThisWeek: false`
- **priorité :** 45
- **title :** Un petit point sur la balance ?
- **body :** Tu ne t'es pas pesé cette semaine. Une pesée hebdomadaire suffit pour suivre ta tendance, sans pression ni obsession du chiffre. Quand tu veux, dans les mêmes conditions de préférence.

---

## hunger_satiety

### hunger_satiety__default
- **tags :** `goal:weight_loss`
- **condition :** —
- **priorité :** 42
- **title :** Gérer la faim sans souffrir
- **body :** Avoir un peu faim en période de perte peut arriver, mais tu ne dois jamais te sentir vidé ou affamé. Mise sur les protéines, les fibres et les aliments à fort volume (légumes, soupes) qui calent sans exploser les calories, et bois régulièrement. Si la faim est intense, c'est le signe qu'il faut manger, pas résister.

---

## hydration

### hydration__default
- **tags :** —
- **condition :** —
- **priorité :** 20
- **title :** Bois de l'eau, simplement
- **body :** Bien s'hydrater aide à la satiété et au bien-être général, et on confond parfois soif et faim. Garde une bouteille à portée de main et bois régulièrement dans la journée. Pas besoin d'en faire une contrainte.

---

## sleep

### sleep__default
- **tags :** —
- **condition :** —
- **priorité :** 30
- **title :** Le sommeil pèse dans la balance
- **body :** Mal dormir augmente les fringales et les envies de sucre le lendemain — ton appétit est directement lié à ton repos. Un coucher plus régulier fait souvent plus pour ta perte de poids qu'un effort de volonté. Soigne tes nuits autant que tes repas.

---

## alcohol

### alcohol__default
- **tags :** `goal:weight_loss`
- **condition :** —
- **priorité :** 25
- **title :** L'alcool et tes objectifs
- **body :** L'alcool apporte des calories « vides » et met en pause l'utilisation des graisses le temps que ton corps le gère. Pas besoin de tout supprimer : en être conscient et modérer suffit à éviter que ça freine tes progrès. Une question d'équilibre, pas d'interdiction.

---

## weekends_slips

### weekends_slips__default
- **tags :** `goal:weight_loss`
- **condition :** —
- **priorité :** 35
- **title :** Les week-ends font partie du jeu
- **body :** Sorties, repas de famille, imprévus : ça fait partie de la vie et ça n'a rien de grave. Ce qui compte, c'est la cohérence sur l'ensemble de la semaine, pas un repas isolé. Anticipe quand tu peux, profite sans culpabiliser, et reprends ton rythme ensuite.

---

## recovery_after_slip

### recovery_after_slip__default
- **tags :** —
- **condition :** `recentSlipDetected: true`
- **priorité :** 85
- **title :** Un écart n'efface pas tes progrès
- **body :** Tu as un peu dépassé, et ce n'est pas grave du tout : un repas ne défait pas des semaines d'efforts. Surtout, ne compense pas en sautant des repas ou en te punissant au sport — ça fait plus de mal que de bien. Reprends simplement ton rythme au prochain repas, comme si de rien n'était.

---

## weight_vs_fat

### weight_vs_fat__default
- **tags :** —
- **condition :** —
- **priorité :** 38
- **title :** Le poids ne dit pas tout
- **body :** La balance mesure ton poids total, pas ta composition : tu peux perdre du gras sans qu'elle bouge, si tu gagnes du muscle ou retiens de l'eau. Regarde aussi tes mesures, tes vêtements et ton énergie. Ce sont souvent de meilleurs indicateurs que le seul chiffre.

---

## recomposition

### recomposition__default
- **tags :** `goal:recomposition`
- **condition :** —
- **priorité :** 58
- **title :** Les trois piliers de la recomposition
- **body :** La recomposition repose sur trois choses : l'entraînement en résistance, des protéines suffisantes, et un léger déficit ou un maintien. C'est plus lent sur la balance, mais c'est ce qui redessine vraiment ta silhouette. Constance et patience sont tes meilleures alliées.

---

## resistance_training

### resistance_training__weight_loss
- **tags :** `goal:weight_loss`, `trains:strength`
- **condition :** —
- **priorité :** 48
- **title :** Garde la muscu pendant ta perte
- **body :** Continuer la musculation en période de perte protège ton muscle, ce qui fait que l'essentiel de ce que tu perds vient bien du gras. C'est ce qui fait la différence entre « maigrir » et « s'affiner ». Ne lâche pas la charge, même en déficit.

### resistance_training__encourage
- **tags :** `goal:weight_loss`, `trains:cardio`
- **condition :** —
- **priorité :** 33
- **title :** Et si tu ajoutais un peu de résistance ?
- **body :** Le cardio est excellent, mais ajouter un peu de renforcement musculaire t'aiderait à préserver ton muscle pendant la perte. Même deux courtes séances par semaine font une vraie différence sur ton physique final. À considérer, sans pression.

---

## cardio_progression

### cardio_progression__default
- **tags :** `trains:cardio`
- **condition :** —
- **priorité :** 34
- **title :** Progresser en cardio sans se blesser
- **body :** Pour progresser durablement, augmente ton volume petit à petit plutôt que tout d'un coup, et alterne les intensités. La récupération fait partie de l'entraînement, pas contre lui. Ton corps s'adapte mieux à la régularité qu'aux gros pics.

---

## Récapitulatif

25 briques rédigées, couvrant 15 topics. Toutes en tutoiement, format court, ton sobre et bienveillant. Les trois briques sensibles (`plateau__default`, `recovery_after_slip__default`, `hunger_satiety__default`) appliquent les règles de sécurité du brief : pas de compensation punitive, pas de restriction sous le seuil, la faim intense présentée comme un signal de manger.

**Étapes suivantes :**
- Intégration par Claude Code dans `src/domain/advice/content/` avec les `id`, `tags`, `condition` et `priority` exacts (déjà présents ci-dessus).
- Validation des trois briques sensibles par un professionnel de santé avant la prod.
- Enrichissement progressif (nouvelles variantes régime/objectif) au fil du temps.

*Fin du contenu rédigé V1.*
