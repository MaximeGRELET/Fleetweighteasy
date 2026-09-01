import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdviceCard } from '@/components/advice/advice-card';
import { Button, Callout, Text } from '@/components/ui';
import { useAdvice } from '@/hooks/use-advice';
import { useCaloriePlan, useStoredProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { HEALTH_DISCLAIMER } from '@/lib/legal';
import { explainAdviceSafety } from '@/lib/messages/advice';

/**
 * Section conseils.
 *
 * Tous les conseils pertinents à l'instant, dans l'ordre que le moteur a fixé —
 * le même que celui du conseil du jour, puisque c'est la même sélection. La
 * page se consulte quand on veut ; rien ici ne notifie ni ne relance.
 */
export default function AdviceScreen() {
  const theme = useTheme();
  const router = useRouter();

  const profile = useStoredProfile();
  const plan = useCaloriePlan(profile);
  const selection = useAdvice();

  const safety =
    selection && plan
      ? explainAdviceSafety({ notices: selection.safety, target: plan.target })
      : [];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={[styles.content, { maxWidth: theme.maxContentWidth }]}>
          <View style={styles.heading}>
            <Text variant="caption" tone="textMuted">
              Conseils
            </Text>
            <Text variant="title">Ce qui te concerne</Text>
          </View>

          {/* Les mises en garde ouvrent la page : elles priment sur le reste
              ici comme sur le tableau du jour. */}
          {safety.map((explanation) => (
            <Callout
              key={explanation.id}
              title={explanation.title}
              body={explanation.body}
              tone={explanation.tone}
              testID={`advice-safety-${explanation.id}`}
            />
          ))}

          {selection && selection.blocks.length > 0 ? (
            selection.blocks.map((block) => (
              <AdviceCard key={block.id} block={block} testID={`advice-block-${block.id}`} />
            ))
          ) : (
            <Text variant="body" tone="textMuted" testID="advice-empty">
              Tes conseils apparaîtront ici à mesure que tu utilises l’application.
            </Text>
          )}

          <Text variant="caption" tone="textMuted" style={styles.note}>
            {HEALTH_DISCLAIMER}
          </Text>

          <Button
            label="Revenir au journal"
            variant="secondary"
            onPress={() => router.back()}
            testID="advice-back"
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%' },
  content: { padding: 24, gap: 16, alignSelf: 'center', width: '100%' },
  heading: { gap: 4 },
  note: { textAlign: 'center' },
});
