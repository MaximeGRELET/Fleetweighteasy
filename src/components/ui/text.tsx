import { Text as RNText, type StyleProp, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import type { Palette } from '@/theme';
import type { TypographyToken } from '@/theme/typography';

export interface AppTextProps extends TextProps {
  variant?: TypographyToken;
  tone?: keyof Pick<Palette, 'text' | 'textMuted' | 'primary' | 'caution' | 'onPrimary'>;
  style?: StyleProp<TextStyle>;
}

/** Texte du design system : toute couleur et toute taille viennent des tokens. */
export function Text({ variant = 'body', tone = 'text', style, ...props }: AppTextProps) {
  const theme = useTheme();

  return (
    <RNText {...props} style={[theme.typography[variant], { color: theme.colors[tone] }, style]} />
  );
}
