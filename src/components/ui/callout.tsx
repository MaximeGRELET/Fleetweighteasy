import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

import { Text } from './text';

export interface CalloutProps {
  title: string;
  body: string;
  /**
   * `caution` sert aux garde-fous de santé. Le ton reste informatif : l'app
   * explique, elle ne réprimande pas.
   */
  tone?: 'neutral' | 'caution';
  testID?: string;
}

export function Callout({ title, body, tone = 'neutral', testID }: CalloutProps) {
  const theme = useTheme();
  const isCaution = tone === 'caution';

  return (
    <View
      testID={testID}
      accessibilityRole="summary"
      style={[
        styles.container,
        {
          borderRadius: theme.radius.md,
          backgroundColor: isCaution ? theme.colors.cautionSurface : theme.colors.surfaceMuted,
          borderColor: isCaution ? theme.colors.caution : theme.colors.border,
        },
      ]}
    >
      <Text variant="subheading" tone={isCaution ? 'caution' : 'text'}>
        {title}
      </Text>
      <Text variant="caption" tone="textMuted">
        {body}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 14, gap: 6, borderWidth: StyleSheet.hairlineWidth },
});
