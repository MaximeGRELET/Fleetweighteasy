/**
 * Expo Router est remplacé globalement : les écrans testés vivent dans
 * `src/app/`, et on veut observer leurs effets sans monter une vraie
 * navigation. Voir `tests/support/router-mock.tsx`.
 */
jest.mock('expo-router', () => require('./tests/support/router-mock'));

export {};
