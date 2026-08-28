import { fireEvent } from '@testing-library/react-native';

import BiometricsScreen from '@/app/(onboarding)/biometrics';
import ConsentScreen from '@/app/(onboarding)/consent';
import { PRIVACY_POLICY_VERSION } from '@/lib/legal';

import { createAppHarness, type AppHarness } from '../support/render-with-app';
import { routerMock } from '../support/router-mock';

/**
 * Le consentement est le garde-fou RGPD de l'onboarding : il précède toute
 * collecte de données de santé, il est explicite, et il est horodaté.
 */
describe('écran de consentement', () => {
  let harness: AppHarness;

  beforeEach(() => {
    harness = createAppHarness();
  });

  afterEach(() => {
    harness.cleanup();
  });

  it('n’a rien enregistré à l’ouverture', async () => {
    await harness.renderScreen(<ConsentScreen />);

    expect(harness.repositories.consent.get()).toBeUndefined();
  });

  it('bloque tant que la case n’est pas cochée', async () => {
    const screen = await harness.renderScreen(<ConsentScreen />);

    expect(screen.getByTestId('step-primary').props.accessibilityState.disabled).toBe(true);
  });

  it('ne pré-coche jamais la case', async () => {
    const screen = await harness.renderScreen(<ConsentScreen />);

    expect(screen.getByTestId('consent-checkbox').props.accessibilityState.checked).toBe(false);
  });

  it('ne persiste rien tant que l’utilisateur n’a pas continué', async () => {
    const screen = await harness.renderScreen(<ConsentScreen />);

    await fireEvent.press(screen.getByTestId('consent-checkbox'));

    expect(harness.repositories.consent.get()).toBeUndefined();
  });

  it('enregistre le consentement horodaté et versionné, puis avance', async () => {
    const screen = await harness.renderScreen(<ConsentScreen />);

    await fireEvent.press(screen.getByTestId('consent-checkbox'));
    await fireEvent.press(screen.getByTestId('step-primary'));

    expect(harness.repositories.consent.get()).toEqual({
      grantedAt: harness.database.currentNow().toISOString(),
      policyVersion: PRIVACY_POLICY_VERSION,
    });
    expect(routerMock.push).toHaveBeenCalledWith('/(onboarding)/goal');
  });

  it('n’a créé aucun profil au passage : le consentement précède la collecte', async () => {
    const screen = await harness.renderScreen(<ConsentScreen />);

    await fireEvent.press(screen.getByTestId('consent-checkbox'));
    await fireEvent.press(screen.getByTestId('step-primary'));

    expect(harness.repositories.profile.get()).toBeUndefined();
  });

  it('annonce ce qui est collecté avant de le demander', async () => {
    const screen = await harness.renderScreen(<ConsentScreen />);

    expect(screen.getByText(/sexe biologique/)).toBeTruthy();
    expect(screen.getByText(/restent sur cet appareil/)).toBeTruthy();
    expect(screen.getByText(/supprimer définitivement/)).toBeTruthy();
  });
});

describe('écran de biométrie', () => {
  let harness: AppHarness;

  beforeEach(() => {
    harness = createAppHarness();
  });

  afterEach(() => {
    harness.cleanup();
  });

  it('renvoie au consentement quand il n’a pas été donné', async () => {
    const screen = await harness.renderScreen(<BiometricsScreen />);

    expect(screen.getByTestId('redirect').props.children).toBe('/(onboarding)/consent');
    // Aucun champ biométrique n'est même rendu.
    expect(screen.queryByTestId('weight-field')).toBeNull();
  });

  it('s’ouvre une fois le consentement donné', async () => {
    harness.repositories.consent.grant(PRIVACY_POLICY_VERSION);
    const screen = await harness.renderScreen(<BiometricsScreen />);

    expect(screen.queryByTestId('redirect')).toBeNull();
    expect(screen.getByTestId('weight-field')).toBeTruthy();
  });

  it('explique l’usage du champ sexe biologique', async () => {
    harness.repositories.consent.grant(PRIVACY_POLICY_VERSION);
    const screen = await harness.renderScreen(<BiometricsScreen />);

    expect(screen.getByText(/identité de genre/)).toBeTruthy();
  });

  it('refuse d’avancer sur une saisie incomplète, en signalant les champs fautifs', async () => {
    harness.repositories.consent.grant(PRIVACY_POLICY_VERSION);
    const screen = await harness.renderScreen(<BiometricsScreen />);

    await fireEvent.press(screen.getByTestId('step-primary'));

    expect(routerMock.push).not.toHaveBeenCalled();
    expect(screen.getByText(/Indique ta taille/)).toBeTruthy();
  });

  it('refuse une taille hors plage physiologique', async () => {
    harness.repositories.consent.grant(PRIVACY_POLICY_VERSION);
    const screen = await harness.renderScreen(<BiometricsScreen />);

    await fireEvent.changeText(screen.getByTestId('height-field'), '12');
    await fireEvent.changeText(screen.getByTestId('weight-field'), '70');
    await fireEvent.press(screen.getByTestId('step-primary'));

    expect(routerMock.push).not.toHaveBeenCalled();
    expect(screen.getByText(/entre 100 et 250 cm/)).toBeTruthy();
  });

  it('accepte la virgule décimale du clavier français', async () => {
    harness.repositories.consent.grant(PRIVACY_POLICY_VERSION);
    const screen = await harness.renderScreen(<BiometricsScreen />);

    await fireEvent.press(screen.getByTestId('sex-female'));
    await fireEvent.changeText(screen.getByTestId('height-field'), '168');
    await fireEvent.changeText(screen.getByTestId('weight-field'), '72,5');
    await fireEvent.press(screen.getByTestId('step-primary'));

    // La date de naissance manque encore : on ne doit pas avancer.
    expect(routerMock.push).not.toHaveBeenCalled();
    expect(screen.queryByText(/entre 25 et 400 kg/)).toBeNull();
  });
});
