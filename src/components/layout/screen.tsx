import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LinkButton, Text } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';

export interface ScreenProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Barre d'actions collée en bas, hors défilement. */
  footer?: ReactNode;
  /** Contenu qui gère son propre défilement (une liste, par exemple). */
  scrollable?: boolean;
  testID?: string;
}

/**
 * Gabarit des écrans hors onboarding.
 *
 * Même exigence que `StepScreen` sur un point précis : le retour arrière a une
 * affordance **visible**. Ces écrans n'ont pas d'en-tête de navigation, et se
 * reposer sur le geste iOS ou le bouton matériel Android laisserait une partie
 * des utilisateurs sans issue apparente.
 */
export function Screen({
  title,
  subtitle,
  children,
  footer,
  scrollable = true,
  testID,
}: ScreenProps) {
  const theme = useTheme();
  const router = useRouter();
  const canGoBack = router.canGoBack?.() ?? false;

  const header = (
    <View style={styles.heading}>
      {canGoBack ? (
        <LinkButton
          label="← Retour"
          tone="textMuted"
          accessibilityLabel="Revenir à l’écran précédent"
          testID="screen-back"
          onPress={() => router.back()}
        />
      ) : null}
      <Text variant="title">{title}</Text>
      {subtitle ? (
        <Text variant="body" tone="textMuted">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      testID={testID}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        {scrollable ? (
          <ScrollView
            contentContainerStyle={[styles.content, { maxWidth: theme.maxContentWidth }]}
            keyboardShouldPersistTaps="handled"
          >
            {header}
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.content, styles.flex, { maxWidth: theme.maxContentWidth }]}>
            {header}
            {children}
          </View>
        )}

        {footer ? (
          <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>{footer}</View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: 24, gap: 16, alignSelf: 'center', width: '100%' },
  heading: { gap: 4 },
  footer: { padding: 24, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
});
