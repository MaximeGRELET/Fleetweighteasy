import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

import { Text } from './text';

export interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}

/** Sélection multiple compacte (allergies, aliments détestés). */
export function Chip({ label, selected, onPress, testID }: ChipProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      style={[
        styles.chip,
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
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
