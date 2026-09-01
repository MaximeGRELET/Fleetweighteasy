import { StyleSheet, View } from 'react-native';

import { Callout } from '@/components/ui';
import type { AdviceSelection } from '@/domain/advice/types';
import type { CalorieTargetResult } from '@/domain/nutrition/energy';
import { explainAdviceSafety } from '@/lib/messages/advice';

import { AdviceCard } from './advice-card';

export interface DailyAdviceProps {
  selection: AdviceSelection;
  /** Objectif courant, d'où les garde-fous tirent leur texte. */
  target: CalorieTargetResult;
  testID?: string;
}

/**
 * Le conseil du jour, tel que le moteur l'a décidé.
 *
 * L'écran ne choisit rien : il affiche `safety` s'il y en a, sinon `featured`.
 * L'arbitrage — une mise en garde de santé passe devant un conseil général —
 * vit dans le domaine, où un seul endroit en répond.
 */
export function DailyAdvice({ selection, target, testID }: DailyAdviceProps) {
  const safety = explainAdviceSafety({ notices: selection.safety, target });

  if (safety.length > 0) {
    return (
      <View style={styles.stack} testID={testID}>
        {safety.map((explanation) => (
          <Callout
            key={explanation.id}
            title={explanation.title}
            body={explanation.body}
            tone={explanation.tone}
            testID={`advice-safety-${explanation.id}`}
          />
        ))}
      </View>
    );
  }

  if (!selection.featured) {
    return null;
  }

  return (
    <View style={styles.stack} testID={testID}>
      <AdviceCard
        block={selection.featured}
        eyebrow="Conseil du jour"
        testID={`advice-featured-${selection.featured.id}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { width: '100%', gap: 12 },
});
