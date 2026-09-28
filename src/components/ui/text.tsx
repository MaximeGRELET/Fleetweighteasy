import { Text as RNText, type StyleProp, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import type { Palette } from '@/theme';
import type { TypographyToken } from '@/theme/typography';

export interface AppTextProps extends TextProps {
  variant?: TypographyToken;
  tone?: keyof Pick<Palette, 'text' | 'textMuted' | 'primary' | 'caution' | 'onPrimary'>;
  style?: StyleProp<TextStyle>;
}

/**
 * Variantes annoncées comme titres. La navigation par titres est le premier
 * moyen de parcourir un écran au lecteur d'écran ; sans ce rôle, elle ne trouve
 * rien. `subheading` n'en fait pas partie : il sert aussi de libellé de bouton.
 */
const HEADER_VARIANTS: ReadonlySet<TypographyToken> = new Set(['title', 'heading']);

/** Texte du design system : toute couleur et toute taille viennent des tokens. */
export function Text({ variant = 'body', tone = 'text', style, ...props }: AppTextProps) {
  const theme = useTheme();

  return (
    <RNText
      accessibilityRole={HEADER_VARIANTS.has(variant) ? 'header' : undefined}
      {...props}
      style={[theme.typography[variant], { color: theme.colors[tone] }, style]}
    />
  );
}
