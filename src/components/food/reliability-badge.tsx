import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';

export interface ReliabilityBadgeProps {
  /** `true` uniquement pour un aliment saisi par l'utilisateur. */
  verified: boolean;
  source: 'off' | 'custom';
  testID?: string;
}

/**
 * Indicateur de fiabilité d'une donnée nutritionnelle.
 *
 * Open Food Facts est une base **collaborative** : les valeurs y sont parfois
 * incomplètes ou fausses (PHASES_2_A_5 §4.2). L'app ne peut pas le vérifier à
 * la place de l'utilisateur, donc elle le dit — et lui laisse la correction.
 *
 * Le badge ne juge pas la qualité de l'aliment, seulement l'origine du chiffre.
 * D'où un ton neutre plutôt qu'un avertissement : « on ne sait pas » n'est pas
 * « attention danger ».
 */
export function ReliabilityBadge({ verified, source, testID }: ReliabilityBadgeProps) {
  const theme = useTheme();
  const isCollaborative = source === 'off' && !verified;

  const label = isCollaborative ? 'Donnée collaborative' : 'Saisi par toi';

  return (
    <View
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={describeReliability({ verified, source })}
      style={[
        styles.badge,
        {
          borderRadius: theme.radius.pill,
          backgroundColor: isCollaborative ? theme.colors.surfaceMuted : theme.colors.primaryMuted,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Text variant="caption" tone={isCollaborative ? 'textMuted' : 'primary'}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Version parlée du badge. Exportée pour les éléments cliquables qui le
 * contiennent : leur étiquette masque celle du badge, ils doivent la reprendre.
 */
export function describeReliability({
  verified,
  source,
}: Pick<ReliabilityBadgeProps, 'verified' | 'source'>): string {
  return source === 'off' && !verified
    ? 'Donnée collaborative, à vérifier sur l’étiquette'
    : 'Aliment que tu as saisi toi-même';
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
