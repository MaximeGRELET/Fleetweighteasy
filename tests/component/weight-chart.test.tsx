import { fireEvent, render } from '@testing-library/react-native';

import { WeightChart } from '@/components/charts/weight-chart';
import { buildWeightTrend } from '@/domain/progress/trend';
import type { WeightPoint } from '@/domain/progress/types';

/**
 * Courbe de poids.
 *
 * Le graphique ne se dessine qu'une fois sa largeur connue : ces tests
 * déclenchent la mise en page, sans quoi le SVG ne serait jamais rendu et les
 * tests d'écran passeraient sur une courbe vide.
 */
describe('courbe de poids', () => {
  function buildPoints(weights: number[]): WeightPoint[] {
    return weights.map((weightKg, index) => ({
      date: `2026-03-${String(index + 1).padStart(2, '0')}`,
      weightKg,
    }));
  }

  async function renderChart(weights: number[], targetWeightKg?: number) {
    const points = buildPoints(weights);
    const screen = await render(
      <WeightChart
        points={points}
        trend={buildWeightTrend(points)}
        targetWeightKg={targetWeightKg}
        testID="chart"
      />,
    );

    // Sans largeur mesurée, le composant n'a aucune échelle où projeter.
    await fireEvent(screen.getByTestId('chart-plot'), 'layout', {
      nativeEvent: { layout: { width: 300, height: 180 } },
    });

    return screen;
  }

  it('trace la tendance une fois la largeur connue', async () => {
    const screen = await renderChart([80, 81, 80, 82, 80, 81, 80]);
    const path: string = screen.getByTestId('chart-trend').props.d;

    expect(path).toMatch(/^M /);
    // Sept points lissés, donc sept commandes de tracé.
    expect(path.match(/[ML] /g)).toHaveLength(7);
  });

  it('trace un point brut par pesée, en plus de la tendance', async () => {
    const screen = await renderChart([80, 81, 82]);

    expect(screen.getAllByTestId('chart-point')).toHaveLength(3);
  });

  it('efface les points bruts derrière la tendance', async () => {
    const screen = await renderChart([80, 81, 82]);
    const [firstPoint] = screen.getAllByTestId('chart-point');

    // Le propos de la phase tient dans cette hiérarchie : la tendance se lit,
    // les points bruts se devinent.
    expect(firstPoint.props.opacity).toBeLessThan(0.5);
    expect(screen.getByTestId('chart-trend').props.strokeWidth).toBeGreaterThan(2);
  });

  it('n’écrase pas la courbe quand le poids ne bouge pas', async () => {
    const screen = await renderChart([80, 80, 80, 80]);
    const path: string = screen.getByTestId('chart-trend').props.d;
    const ordinates = [...path.matchAll(/[ML] [\d.]+ ([\d.]+)/g)].map((match) => Number(match[1]));

    // Une amplitude nulle sans garde-fou remplirait toute la hauteur au gré des
    // arrondis, ce qui dramatiserait une semaine parfaitement stable.
    expect(Math.max(...ordinates) - Math.min(...ordinates)).toBe(0);
  });

  it('trace le repère du poids cible quand il tombe dans la plage affichée', async () => {
    const screen = await renderChart([80, 79, 78], 79);

    expect(screen.getByTestId('chart-target')).toBeTruthy();
  });

  it('ne trace aucun repère quand la cible est hors de la plage', async () => {
    const screen = await renderChart([80, 79, 78], 65);

    expect(screen.queryByTestId('chart-target')).toBeNull();
  });

  it('annonce la courbe aux lecteurs d’écran, qui ne la voient pas', async () => {
    const screen = await renderChart([80, 79, 78]);

    expect(screen.getByLabelText(/Courbe de poids lissée/)).toBeTruthy();
  });

  it('décrit le cas d’une pesée unique sans parler de tendance', async () => {
    const screen = await renderChart([80]);

    expect(screen.getByLabelText(/une seule pesée/)).toBeTruthy();
  });

  it('invite à se peser plutôt que d’afficher un cadre vide', async () => {
    const screen = await render(<WeightChart points={[]} trend={[]} testID="chart" />);

    expect(screen.getByText(/dès ta première pesée/)).toBeTruthy();
  });
});
