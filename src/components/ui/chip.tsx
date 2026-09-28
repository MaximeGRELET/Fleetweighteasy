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
  testID?: string;
}

/** Puce compacte : sélection multiple, choix exclusif ou action, selon `role`. */
export function Chip({ label, selected, onPress, role = 'checkbox', testID }: ChipProps) {
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
    borderWidth: StyleSheet.hairlineWidth,
  },
});
