import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, LinkButton, ProgressDots, Text } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';

export interface StepScreenProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  progress?: { step: number; total: number };
  /** Note discrète sous les boutons (disclaimer, précision). */
  footerNote?: string;
  testID?: string;
}

/**
 * Gabarit commun des écrans d'onboarding : une idée par écran, une action
 * principale, une progression visible.
 *
 * Le retour arrière a une affordance **visible** : les écrans n'ont pas
 * d'en-tête, et se reposer sur le geste iOS ou le bouton matériel Android
 * laisserait une partie des utilisateurs sans issue apparente.
 */
export function StepScreen(props: StepScreenProps) {
  const theme = useTheme();
  const router = useRouter();
  const canGoBack = router.canGoBack?.() ?? false;

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      testID={props.testID}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { maxWidth: theme.maxContentWidth }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topBar}>
            {canGoBack ? (
              <LinkButton
                label="← Retour"
                tone="textMuted"
                accessibilityLabel="Revenir à l’écran précédent"
                testID="step-back"
                onPress={() => router.back()}
              />
            ) : (
              <View />
            )}
            {props.progress ? (
              <ProgressDots step={props.progress.step} total={props.progress.total} />
            ) : null}
          </View>

          <View style={styles.heading}>
            <Text variant="title">{props.title}</Text>
            {props.subtitle ? (
              <Text variant="body" tone="textMuted">
                {props.subtitle}
              </Text>
            ) : null}
          </View>

          <View style={styles.body}>{props.children}</View>
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
          <Button
            label={props.primaryLabel}
            onPress={props.onPrimary}
            disabled={props.primaryDisabled ?? false}
            testID="step-primary"
          />
          {props.secondaryLabel && props.onSecondary ? (
            <Button
              label={props.secondaryLabel}
              onPress={props.onSecondary}
              variant="quiet"
              testID="step-secondary"
            />
          ) : null}
          {props.footerNote ? (
            <Text variant="caption" tone="textMuted" style={styles.note}>
              {props.footerNote}
            </Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: 24, gap: 24, alignSelf: 'center', width: '100%' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  heading: { gap: 8 },
  body: { gap: 12 },
  footer: { padding: 24, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  note: { textAlign: 'center' },
});
