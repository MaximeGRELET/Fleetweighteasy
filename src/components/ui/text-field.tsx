import { StyleSheet, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

import { Text } from './text';

export interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  /** Unité affichée à droite du champ (kg, cm…). */
  suffix?: string;
  keyboardType?: KeyboardTypeOptions;
  placeholder?: string;
  error?: string;
  hint?: string;
  testID?: string;
}

export function TextField({
  label,
  value,
  onChangeText,
  suffix,
  keyboardType = 'default',
  placeholder,
  error,
  hint,
  testID,
}: TextFieldProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <Text variant="caption" tone="textMuted">
        {label}
      </Text>
      <View
        style={[
          styles.field,
          {
            borderRadius: theme.radius.md,
            borderColor: error ? theme.colors.caution : theme.colors.border,
            backgroundColor: theme.colors.surface,
          },
        ]}
      >
        <TextInput
          // L'unité et le message sous le champ sont des textes voisins, que
          // le lecteur d'écran ne relie pas au champ : l'unité rejoint
          // l'étiquette, l'erreur ou l'aide passe en indication.
          accessibilityLabel={suffix ? `${label}, en ${suffix}` : label}
          accessibilityHint={error ?? hint}
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          style={[theme.typography.body, styles.input, { color: theme.colors.text }]}
        />
        {suffix ? (
          <Text variant="body" tone="textMuted">
            {suffix}
          </Text>
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" tone="caution">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="textMuted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, paddingVertical: 14 },
});
