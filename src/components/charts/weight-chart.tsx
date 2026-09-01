import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { Text } from '@/components/ui';
import type { TrendPoint } from '@/domain/progress/trend';
import type { WeightPoint } from '@/domain/progress/types';
import { useTheme } from '@/hooks/use-theme';
import { formatIsoDate, formatKg } from '@/lib/format';

/**
 * Courbe de poids : points bruts et tendance lissée.
 *
 * La hiérarchie visuelle porte tout le propos de la phase. La **ligne de
 * tendance** est tracée en couleur d'accent et en trait plein ; les **pesées
 * brutes** sont de petits points discrets, volontairement effacés. Quelqu'un
 * qui regarde ce graphique deux secondes doit voir la tendance, pas le
 * soubresaut du matin.
 *
 * Le composant ne calcule aucune valeur métier : il reçoit une série déjà
 * lissée par le domaine et se contente de la projeter en pixels.
 */

export interface WeightChartProps {
  /** Pesées brutes de la période. */
  points: readonly WeightPoint[];
  /** Série lissée correspondante. */
  trend: readonly TrendPoint[];
  /** Poids cible, tracé en repère s'il tombe dans la plage affichée. */
  targetWeightKg?: number;
  testID?: string;
}

const CHART_HEIGHT = 180;
/** Marge verticale, pour qu'un point extrême ne soit pas collé au bord. */
const VERTICAL_PADDING = 12;
/** Amplitude minimale affichée : sans elle, une série plate remplirait la hauteur de bruit. */
const MIN_RANGE_KG = 1;
/**
 * Opacité des pesées brutes.
 *
 * Assez basse pour que la tendance domine au premier regard, assez haute pour
 * que les points restent trouvables quand on les cherche.
 */
const RAW_POINT_OPACITY = 0.35;

export function WeightChart({ points, trend, targetWeightKg, testID }: WeightChartProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  if (trend.length === 0) {
    return (
      <View testID={testID} style={[styles.empty, { height: CHART_HEIGHT }]}>
        <Text variant="caption" tone="textMuted">
          Ta courbe apparaîtra dès ta première pesée.
        </Text>
      </View>
    );
  }

  const scale = buildScale({ points, trend, targetWeightKg, width });

  return (
    <View testID={testID} accessible accessibilityLabel={describeChart(trend)}>
      <View style={styles.plotRow}>
        <View style={styles.axis}>
          <Text variant="caption" tone="textMuted">
            {formatKg(scale.maxKg)}
          </Text>
          <Text variant="caption" tone="textMuted">
            {formatKg(scale.minKg)}
          </Text>
        </View>

        <View
          style={styles.plot}
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          testID={testID ? `${testID}-plot` : undefined}
        >
          {width > 0 ? (
            <Svg width={width} height={CHART_HEIGHT}>
              {/* Repère du poids cible, tracé sous la courbe pour ne pas la masquer. */}
              {scale.targetY !== undefined ? (
                <Line
                  x1={0}
                  y1={scale.targetY}
                  x2={width}
                  y2={scale.targetY}
                  stroke={theme.colors.border}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  testID={testID ? `${testID}-target` : undefined}
                />
              ) : null}

              {/* Pesées brutes : présentes, mais en retrait. */}
              {points.map((point) => (
                <Circle
                  key={point.date}
                  cx={scale.x(point.date)}
                  cy={scale.y(point.weightKg)}
                  r={2}
                  fill={theme.colors.textMuted}
                  opacity={RAW_POINT_OPACITY}
                  testID={testID ? `${testID}-point` : undefined}
                />
              ))}

              {/* La tendance : c'est elle qu'on veut lire. */}
              <Path
                d={buildPath(trend, scale)}
                stroke={theme.colors.primary}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                testID={testID ? `${testID}-trend` : undefined}
              />
            </Svg>
          ) : null}
        </View>
      </View>

      <View style={styles.dates}>
        <Text variant="caption" tone="textMuted">
          {formatIsoDate(trend[0].date)}
        </Text>
        <Text variant="caption" tone="textMuted">
          {formatIsoDate(trend[trend.length - 1].date)}
        </Text>
      </View>
    </View>
  );
}

interface Scale {
  minKg: number;
  maxKg: number;
  x: (date: string) => number;
  y: (weightKg: number) => number;
  /** Ordonnée du poids cible, seulement s'il tombe dans la plage affichée. */
  targetY?: number;
}

function buildScale(input: {
  points: readonly WeightPoint[];
  trend: readonly TrendPoint[];
  targetWeightKg?: number;
  width: number;
}): Scale {
  const values = [
    ...input.points.map((point) => point.weightKg),
    ...input.trend.map((point) => point.trendKg),
  ];

  let minKg = Math.min(...values);
  let maxKg = Math.max(...values);

  // Une série parfaitement plate donnerait une amplitude nulle : la courbe
  // occuperait toute la hauteur au gré des arrondis, ce qui dramatiserait
  // exactement ce qu'on cherche à apaiser.
  if (maxKg - minKg < MIN_RANGE_KG) {
    const centre = (maxKg + minKg) / 2;
    minKg = centre - MIN_RANGE_KG / 2;
    maxKg = centre + MIN_RANGE_KG / 2;
  }

  const usableHeight = CHART_HEIGHT - VERTICAL_PADDING * 2;
  const y = (weightKg: number) =>
    VERTICAL_PADDING + ((maxKg - weightKg) / (maxKg - minKg)) * usableHeight;

  // Les abscisses suivent le rang du point dans la série lissée, et non sa
  // date : la courbe reste lisible quand les pesées sont espacées inégalement.
  const positions = new Map(input.trend.map((point, index) => [point.date, index]));
  const lastIndex = Math.max(input.trend.length - 1, 1);

  const target = input.targetWeightKg;
  const targetIsVisible = target !== undefined && target >= minKg && target <= maxKg;

  return {
    minKg,
    maxKg,
    x: (date) => ((positions.get(date) ?? 0) / lastIndex) * input.width,
    y,
    targetY: targetIsVisible ? y(target) : undefined,
  };
}

function buildPath(trend: readonly TrendPoint[], scale: Scale): string {
  return trend
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${scale.x(point.date).toFixed(2)} ${scale.y(point.trendKg).toFixed(2)}`,
    )
    .join(' ');
}

/** Résumé lu par les lecteurs d'écran : une courbe n'est pas accessible sans texte. */
function describeChart(trend: readonly TrendPoint[]): string {
  const first = trend[0];
  const last = trend[trend.length - 1];

  if (trend.length === 1) {
    return `Courbe de poids : une seule pesée, ${formatKg(first.trendKg)}.`;
  }

  return (
    `Courbe de poids lissée, de ${formatIsoDate(first.date)} à ${formatIsoDate(last.date)} : ` +
    `de ${formatKg(first.trendKg)} à ${formatKg(last.trendKg)}.`
  );
}

const styles = StyleSheet.create({
  plotRow: { flexDirection: 'row', gap: 8 },
  axis: { height: CHART_HEIGHT, justifyContent: 'space-between', paddingVertical: 6 },
  plot: { flex: 1, height: CHART_HEIGHT },
  dates: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  empty: { alignItems: 'center', justifyContent: 'center' },
});
