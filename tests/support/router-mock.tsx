import type { ReactNode } from 'react';
import { Text } from 'react-native';

/**
 * Substitut d'Expo Router pour les tests d'écran.
 *
 * Les écrans d'onboarding sont testés pour ce qu'ils font — persister, avertir,
 * bloquer — pas pour la navigation elle-même. Le routeur est donc espionné, et
 * `Redirect` rend un marqueur observable au lieu de naviguer.
 */
export const routerMock = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  navigate: jest.fn(),
  dismissAll: jest.fn(),
  canGoBack: jest.fn(() => true),
};

export function useRouter() {
  return routerMock;
}

export function Redirect({ href }: { href: string }) {
  return <Text testID="redirect">{String(href)}</Text>;
}

export function Stack({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

/**
 * Paramètres de route observés par les écrans.
 *
 * Un écran atteint par navigation reçoit ses paramètres de l'URL ; en test,
 * c'est le test qui les pose. Sans cela, impossible d'éprouver un écran de
 * détail — il ne saurait pas de quoi il parle.
 */
let searchParams: Record<string, string> = {};

export function setLocalSearchParams(params: Record<string, string>) {
  searchParams = params;
}

export function useLocalSearchParams() {
  return searchParams;
}

export function resetRouterMock() {
  searchParams = {};
  routerMock.push.mockClear();
  routerMock.replace.mockClear();
  routerMock.back.mockClear();
  routerMock.navigate.mockClear();
  routerMock.dismissAll.mockClear();
  routerMock.canGoBack.mockClear();
  routerMock.canGoBack.mockReturnValue(true);
}
