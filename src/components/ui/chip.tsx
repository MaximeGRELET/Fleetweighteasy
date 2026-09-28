import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

import { Text } from './text';

/**
 * Ce que la puce annonce aux lecteurs d'écran :
 * - `checkbox` : sélection multiple (allergies, aliments détestés) ;
 * - `radio` : choix exclusif, à placer dans un conteneur `radiogroup` ;
 * - `button` : action immédiate, sans état sélectionné.
 */
export type ChipRole = 'checkbox' | 'radio' | 'button';

export interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** `checkbox` par défaut. */
  role?: ChipRole;
  /** Occupe toute la largeur : pour un libellé long, dans une liste verticale. */
  block?: boolean;
  testID?: string;
}

/** Puce compacte : sélection multiple, choix exclusif ou action, selon `role`. */
export function Chip({
  label,
  selected,
  onPress,
  role = 'checkbox',
  block = false,
  testID,
}: ChipProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={accessibilityStateFor(role, selected)}
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      style={[
        styles.chip,
        block ? styles.block : undefined,
        {
          // Hauteur portée par la pastille elle-même plutôt que par un
          // `hitSlop` : une zone élargie invisible chevaucherait la pastille
          // voisine, séparée de 8 px seulement, et le doigt tomberait à côté.
          minHeight: theme.minTouchTarget,
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

function accessibilityStateFor(role: ChipRole, selected: boolean) {
  switch (role) {
    case 'checkbox':
      return { checked: selected };
    case 'radio':
      // `checked` pour Android, `selected` pour iOS : les deux lecteurs d'écran
      // n'annoncent pas l'état d'un bouton radio à partir de la même clé.
      return { checked: selected, selected };
    case 'button':
      return {};
  }
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  block: { width: '100%' },
});
