# FleetWeightEasy

Application mobile (iOS + Android) d'accompagnement à la perte de poids et à la recomposition
corporelle : suivi calorique, conseils personnalisés fondés sur la science, recettes adaptées et
accompagnement sportif.

> Nom de code provisoire — à arbitrer (cf. `files/PLAN_IMPLEMENTATION.md` §15).

## Stack

React Native + Expo (SDK 57) · TypeScript strict · Expo Router · Jest / jest-expo ·
ESLint + Prettier + Husky · Sentry + PostHog.

## Démarrer

```bash
npm install
cp .env.example .env   # facultatif : la télémétrie est désactivée si les clés sont vides
npm start
```

## Scripts

| Script                            | Rôle                                      |
| --------------------------------- | ----------------------------------------- |
| `npm start`                       | Serveur de développement Expo             |
| `npm run android` / `ios` / `web` | Lancement par plateforme                  |
| `npm run lint`                    | ESLint (inclut les règles d'architecture) |
| `npm run typecheck`               | `tsc --noEmit`                            |
| `npm test`                        | Tests Jest                                |
| `npm run test:domain`             | Tests unitaires du domaine uniquement     |
| `npm run test:coverage`           | Tests + seuils de couverture du domaine   |
| `npm run format`                  | Prettier                                  |

## Architecture

Architecture en couches, **les dépendances pointent vers le bas** :

```
UI (src/app, src/components)
  ↓
Hooks (src/hooks, src/stores)
  ↓
Domaine (src/domain)      ← logique métier pure, testée à ~100 %
  ↓
Data (src/data)           ← SQLite, repositories, API
```

Deux règles sont vérifiées automatiquement par ESLint plutôt que par relecture :

- `src/domain/**` ne peut importer ni React, ni Expo, ni la couche data, ni la télémétrie ;
- `src/app/**` et `src/components/**` ne peuvent pas importer `@/data` directement.

## Documentation

La planification complète vit dans [`files/`](files/) — point d'entrée :
[`files/POUR_CLAUDE_CODE.md`](files/POUR_CLAUDE_CODE.md), document maître :
[`files/PLAN_IMPLEMENTATION.md`](files/PLAN_IMPLEMENTATION.md).

## Avant toute mise en production

Les seuils de sécurité santé (planchers caloriques, plafond de rythme, seuils d'IMC) et les
messages sensibles **doivent être revalidés par un professionnel de santé**
(`files/PHASE_1_DOMAINE_NUTRITIONNEL.md` §12). L'application ne pose aucun diagnostic médical.
