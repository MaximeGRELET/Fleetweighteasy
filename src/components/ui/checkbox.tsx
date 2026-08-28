import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

import { Text } from './text';

export interface CheckboxProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
  testID?: string;
}

/** Case à cocher. Jamais pré-cochée quand elle porte un consentement. */
export function Checkbox({ label, checked, onToggle, testID }: CheckboxProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      testID={testID}
      onPress={onToggle}
      style={styles.row}
    >
      <View
        style={[
          styles.box,
          {
            borderRadius: theme.radius.sm,
            borderColor: checked ? theme.colors.primary : theme.colors.border,
            backgroundColor: checked ? theme.colors.primary : 'transparent',
          },
        ]}
      >
        {checked ? (
          <Text variant="caption" tone="onPrimary">
            ✓
          </Text>
        ) : null}
      </View>
      <Text variant="body" style={styles.label}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  box: {
    width: 24,
    height: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  label: { flex: 1 },
});
