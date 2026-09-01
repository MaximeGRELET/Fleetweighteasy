import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import type { Palette } from '@/theme';

import { Text } from './text';

export interface ProgressBarProps {
  label: string;
  /** Valeur déjà formatée : la barre n'arrondit rien elle-même. */
  value: string;
  /** Part de la cible atteinte. Non bornée en entrée — la barre tronque. */
  ratio: number;
  /** Teinte de remplissage, prise dans la palette. */
  tone: keyof Pick<Palette, 'protein' | 'carbs' | 'fat' | 'primary'>;
  /** Décrit l'avancement aux lecteurs d'écran, qui ne voient pas la barre. */
  accessibilityLabel: string;
  testID?: string;
}

/**
 * Barre d'avancement d'un macronutriment.
 *
 * Le remplissage est tronqué à 100 % — une barre qui déborderait de son
 * conteneur ne dit rien de plus — mais le dépassement reste lisible dans la
 * valeur chiffrée, qui n'est jamais tronquée. Le ton reste neutre : dépasser
 * une cible de macros n'est pas une faute (PLAN_IMPLEMENTATION §1.6).
 */
export function ProgressBar({
  label,
  value,
  ratio,
  tone,
  accessibilityLabel,
  testID,
}: ProgressBarProps) {
  const theme = useTheme();
  const filled = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0));

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.header}>
        <Text variant="caption" tone="textMuted">
          {label}
        </Text>
        <Text variant="caption" tone="textMuted">
          {value}
        </Text>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(filled * 100) }}
        style={[
          styles.track,
          { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.pill },
        ]}
      >
        <View
          style={[
            styles.fill,
            {
              backgroundColor: theme.colors[tone],
              borderRadius: theme.radius.pill,
              width: `${filled * 100}%`,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4, width: '100%' },
  header: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 8, overflow: 'hidden' },
  fill: { height: '100%' },
});
