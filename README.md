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

## Persistance

Local-first : toute donnée utilisateur vit d'abord en SQLite sur l'appareil, via Drizzle. La
synchro serveur (Phase 9) viendra par-dessus, sans remettre cette couche en cause.

- Le schéma est dans [src/data/db/schema.ts](src/data/db/schema.ts) ; après l'avoir modifié,
  lancer `npm run db:generate` et **commiter les fichiers générés** — les tests d'intégration
  rejouent ces mêmes migrations.
- Les repositories reçoivent leur base, leur horloge et leur générateur d'identifiants par
  injection : les tests tournent sur SQLite en mémoire, sans appareil ni émulateur.

Deux décisions structurantes, prises tôt parce qu'elles sont coûteuses à rattraper :

**Le snapshot nutritionnel.** Une entrée de journal fige ses valeurs nutritionnelles à l'ajout.
Si un produit Open Food Facts est corrigé six mois plus tard, l'historique de l'utilisateur ne
bouge pas. Les totaux du jour somment les snapshots, jamais une jointure sur les aliments.

**Le journal de synchronisation.** La table `sync_meta` (`dirty` / `updatedAt` / `syncedAt` /
`deletedAt`) est écrite dans la même transaction que chaque écriture métier, bien avant que la
synchro existe. Les suppressions y laissent une pierre tombale, sans quoi elles ne pourraient
jamais être propagées au serveur.

## Onboarding

Le parcours vit dans [src/app/(onboarding)/](<src/app/(onboarding)/>) : accueil, consentement,
puis sept à neuf écrans de profilage selon l'objectif choisi. Trois règles le structurent.

**Le consentement précède la collecte.** L'écran de consentement est bloquant et écrit dans la
table `consent` (horodatage + version de politique) avant qu'une ligne de profil puisse exister.
L'écran de biométrie redirige vers lui tant qu'il n'a pas été donné — le garde-fou est structurel,
pas seulement visuel.

**Aucune règle métier n'est réécrite dans l'UI.** Les schémas Zod par écran vivent dans
[src/domain/profile/validation.ts](src/domain/profile/validation.ts) et composent les bornes du
domaine. Le plafond du curseur de rythme vient de `getMaxWeeklyRateKg`, le contrôle d'IMC du poids
cible de `classifyBmi`.

**Aucun ajustement n'est silencieux.** Chaque `adjustment` et `warning` remonté par le domaine est
traduit en langage clair par [src/lib/messages/safety.ts](src/lib/messages/safety.ts) et affiché
sur l'écran de restitution. Cas particulièrement soigné : quand le plancher calorique place
l'objectif **au-dessus** de la dépense estimée, un message dédié explique que c'est volontaire —
sans quoi l'utilisateur croirait à un bug. Un test de balayage vérifie qu'aucun drapeau du domaine
ne peut rester sans message.

Le profil n'est persisté qu'au dernier écran ; les objectifs, eux, ne sont jamais stockés — ils se
recalculent depuis le profil à chaque affichage.

## Documentation

La planification complète vit dans [`files/`](files/) — point d'entrée :
[`files/POUR_CLAUDE_CODE.md`](files/POUR_CLAUDE_CODE.md), document maître :
[`files/PLAN_IMPLEMENTATION.md`](files/PLAN_IMPLEMENTATION.md).

## Avant toute mise en production

Les seuils de sécurité santé (planchers caloriques, plafond de rythme, seuils d'IMC) et les
messages sensibles **doivent être revalidés par un professionnel de santé**
(`files/PHASE_1_DOMAINE_NUTRITIONNEL.md` §12). L'application ne pose aucun diagnostic médical.
