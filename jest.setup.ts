/**
 * Expo Router est remplacé globalement : les écrans testés vivent dans
 * `src/app/`, et on veut observer leurs effets sans monter une vraie
 * navigation. Voir `tests/support/router-mock.tsx`.
 */
jest.mock('expo-router', () => require('./tests/support/router-mock'));

/**
 * `expo-camera` est un module natif : il n'existe pas dans l'environnement de
 * test. Le substitut transforme le viseur en bouton, ce qui permet d'éprouver
 * tout ce qui suit la lecture d'un code-barres sans appareil.
 */
jest.mock('expo-camera', () => require('./tests/support/camera-mock'));

export {};
