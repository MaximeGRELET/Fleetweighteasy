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

export function useLocalSearchParams() {
  return {};
}

export function resetRouterMock() {
  routerMock.push.mockClear();
  routerMock.replace.mockClear();
  routerMock.back.mockClear();
  routerMock.navigate.mockClear();
  routerMock.dismissAll.mockClear();
  routerMock.canGoBack.mockClear();
  routerMock.canGoBack.mockReturnValue(true);
}
