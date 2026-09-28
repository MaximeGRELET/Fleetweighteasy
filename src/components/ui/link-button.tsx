import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

import { Text } from './text';

export interface LinkButtonProps {
  label: string;
  onPress: () => void;
  /** `primary` pour une action à proposer, `textMuted` pour une action discrète. */
  tone?: 'primary' | 'textMuted';
  /** Quand le libellé ne suffit pas hors contexte (« Retirer » quoi ?). */
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * Action secondaire présentée comme un lien texte (« ← Retour », « Retirer »).
 *
 * Le texte est petit, la zone tactile ne l'est pas : elle atteint le minimum
 * du thème dans les deux dimensions, quel que soit le libellé.
 */
export function LinkButton({
  label,
  onPress,
  tone = 'primary',
  accessibilityLabel,
  testID,
}: LinkButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      onPress={onPress}
      style={[styles.link, { minHeight: theme.minTouchTarget, minWidth: theme.minTouchTarget }]}
    >
      <Text variant="caption" tone={tone}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { alignSelf: 'flex-start', justifyContent: 'center' },
});
