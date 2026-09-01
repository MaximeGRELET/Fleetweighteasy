import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import type { ProgressPeriod } from '@/domain/progress/types';
import { useTheme } from '@/hooks/use-theme';

export interface PeriodSelectorProps {
  value: ProgressPeriod;
  onChange: (period: ProgressPeriod) => void;
  testID?: string;
}

const PERIODS: { period: ProgressPeriod; label: string }[] = [
  { period: '30d', label: '30 jours' },
  { period: '90d', label: '90 jours' },
  { period: 'all', label: 'Tout' },
];

/**
 * Choix de la fenêtre d'observation.
 *
 * Le rôle d'accessibilité est `radiogroup` / `radio`, et non `checkbox` : le
 * choix est exclusif, et un lecteur d'écran doit l'annoncer comme tel. Les
 * puces multi-sélection de l'onboarding utilisent `Chip`, qui porte le rôle
 * `checkbox` correct pour leur usage.
 */
export function PeriodSelector({ value, onChange, testID }: PeriodSelectorProps) {
  const theme = useTheme();

  return (
    <View testID={testID} accessibilityRole="radiogroup" style={styles.row}>
      {PERIODS.map(({ period, label }) => {
        const selected = period === value;

        return (
          <Pressable
            key={period}
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected }}
            accessibilityLabel={label}
            testID={`period-${period}`}
            onPress={() => onChange(period)}
            style={[
              styles.item,
              {
                borderRadius: theme.radius.pill,
                borderColor: selected ? theme.colors.primary : theme.colors.border,
                backgroundColor: selected ? theme.colors.primaryMuted : theme.colors.surface,
              },
            ]}
          >
            <Text variant="caption" tone={selected ? 'primary' : 'text'}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  item: { paddingVertical: 8, paddingHorizontal: 14, borderWidth: StyleSheet.hairlineWidth },
});
