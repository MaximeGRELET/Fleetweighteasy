import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WeightChart } from '@/components/charts/weight-chart';
import { PeriodSelector } from '@/components/progress/period-selector';
import { ProgressIndicators } from '@/components/progress/progress-indicators';
import { WeightField } from '@/components/progress/weight-field';
import { Button, Callout, Text } from '@/components/ui';
import type { ProgressSummary } from '@/domain/progress/summary';
import type { ProgressPeriod } from '@/domain/progress/types';
import { useProgress } from '@/hooks/use-progress';
import { useWeightTracker } from '@/hooks/use-weight';
import { useTheme } from '@/hooks/use-theme';
import type { Explanation } from '@/lib/messages/safety';
import {
  explainAdaptiveAdjustment,
  explainProgressStatus,
  TREND_NOT_ESTABLISHED,
  WEIGHING_GUIDANCE,
} from '@/lib/messages/progress';
import { todayIsoDate } from '@/stores/session';

/**
 * Suivi du poids et progression.
 *
 * L'écran suit l'ordre dans lequel on veut que l'information soit lue : la
 * saisie du jour, puis la **tendance**, puis les chiffres, puis l'explication.
 * Le nombre brut n'arrive jamais seul — c'est la règle qui vaut déjà pour les
 * garde-fous de l'onboarding, appliquée ici à la courbe.
 */
export default function WeightScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [period, setPeriod] = useState<ProgressPeriod>('30d');
  const [adaptiveNotice, setAdaptiveNotice] = useState<Explanation[]>([]);

  const today = todayIsoDate();
  const tracker = useWeightTracker();
  const summary = useProgress(period);

  function recordWeight(weightKg: number) {
    const { adaptive } = tracker.recordWeight({ date: today, weightKg });

    // Le recalcul est appliqué sans rien demander, mais jamais sans le dire
    // quand il se voit : la liste est vide tant que l'écart reste sous le seuil.
    setAdaptiveNotice(adaptive ? explainAdaptiveAdjustment(adaptive) : []);
  }

  const trendIsThin = summary?.trend.at(-1)?.sampleCount === 1;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={[styles.content, { maxWidth: theme.maxContentWidth }]}>
          <View style={styles.heading}>
            <Text variant="caption" tone="textMuted">
              Suivi
            </Text>
            <Text variant="title">Ton poids</Text>
          </View>

          <WeightField
            date={today}
            existingWeightKg={tracker.entryForDate(today)?.weightKg}
            onSubmit={recordWeight}
            testID="weight-field"
          />

          {adaptiveNotice.map((explanation) => (
            <Callout
              key={explanation.id}
              title={explanation.title}
              body={explanation.body}
              tone={explanation.tone}
              testID={`adaptive-${explanation.id}`}
            />
          ))}

          {summary ? (
            <>
              <PeriodSelector value={period} onChange={setPeriod} testID="period-selector" />

              <WeightChart
                points={summary.points}
                trend={summary.trend}
                targetWeightKg={summary.goal?.targetWeightKg}
                testID="weight-chart"
              />

              {trendIsThin ? (
                <Text variant="caption" tone="textMuted" testID="trend-thin">
                  {TREND_NOT_ESTABLISHED}
                </Text>
              ) : null}

              <ProgressIndicators summary={summary} testID="progress-indicators" />

              <StatusCallout summary={summary} />
            </>
          ) : (
            <Text variant="body" tone="textMuted">
              Ton suivi se construira à partir de ton profil et de tes pesées.
            </Text>
          )}

          <Callout
            title={WEIGHING_GUIDANCE.title}
            body={WEIGHING_GUIDANCE.body}
            testID="weighing-guidance"
          />

          <Button
            label="Revenir au journal"
            variant="secondary"
            onPress={() => router.back()}
            testID="weight-back"
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/**
 * Explication du statut de progression.
 *
 * Le `testID` porte le statut du domaine : un test peut ainsi vérifier *quel*
 * message est affiché, pas seulement qu'il y en a un.
 */
function StatusCallout({ summary }: { summary: ProgressSummary }) {
  const explanation = explainProgressStatus(summary);

  return (
    <Callout
      title={explanation.title}
      body={explanation.body}
      tone={explanation.tone}
      testID={`status-${summary.status}`}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%' },
  content: { padding: 24, gap: 16, alignSelf: 'center', width: '100%' },
  heading: { gap: 4 },
});
