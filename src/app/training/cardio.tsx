import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Callout, Text, TextField } from '@/components/ui';
import { estimateCardioKcal } from '@/domain/nutrition/calories-sport';
import {
  listMetEntriesForActivity,
  type CardioActivity,
  type MetEntry,
} from '@/domain/nutrition/mets-table';
import { useStoredProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { useLogCardio } from '@/hooks/use-training';
import { formatKcal } from '@/lib/format';
import { useSessionStore } from '@/stores/session';

const ACTIVITIES: { value: CardioActivity; label: string }[] = [
  { value: 'walking', label: 'Marche' },
  { value: 'running', label: 'Course' },
  { value: 'cycling', label: 'Vélo' },
];

/**
 * Saisie d'une séance cardio.
 *
 * L'estimation est affichée **avant** l'enregistrement, et présentée comme une
 * estimation : le terrain, la pente, la forme et les pauses la font varier, le
 * plus souvent à la baisse. C'est cette imprécision qui justifie que le mode de
 * calories par défaut ne recrédite pas le sport (DONNEES_SPORT §A.2).
 */
export default function CardioScreen() {
  const theme = useTheme();
  const router = useRouter();
  const selectedDate = useSessionStore((state) => state.selectedDate);

  const profile = useStoredProfile();
  const logCardio = useLogCardio();

  const [activity, setActivity] = useState<CardioActivity>('walking');
  const [metEntryId, setMetEntryId] = useState<string>();
  const [duration, setDuration] = useState('30');
  const [saved, setSaved] = useState(false);

  const entries = listMetEntriesForActivity(activity);
  const selected = entries.find((entry) => entry.id === metEntryId);
  const durationMin = Number(duration.replace(',', '.'));
  const isUsableDuration = Number.isFinite(durationMin) && durationMin > 0;

  const estimate =
    profile && selected && isUsableDuration
      ? estimateCardioKcal({
          metValue: selected.met,
          weightKg: profile.currentWeightKg,
          durationMin,
        })
      : undefined;

  function save() {
    if (!selected || !isUsableDuration) {
      return;
    }

    logCardio({ date: selectedDate, metEntryId: selected.id, durationMin });
    setSaved(true);
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={[styles.content, { maxWidth: theme.maxContentWidth }]}>
          <View style={styles.heading}>
            <Text variant="caption" tone="textMuted">
              Cardio
            </Text>
            <Text variant="title">Enregistrer une séance</Text>
          </View>

          <View style={styles.row} accessibilityRole="radiogroup">
            {ACTIVITIES.map(({ value, label }) => (
              <Choice
                key={value}
                label={label}
                selected={activity === value}
                onPress={() => {
                  setActivity(value);
                  setMetEntryId(undefined);
                }}
                testID={`cardio-activity-${value}`}
              />
            ))}
          </View>

          <Text variant="subheading" style={styles.section}>
            Intensité
          </Text>

          {entries.map((entry: MetEntry) => (
            <Choice
              key={entry.id}
              label={`${entry.label} · ${entry.paceHint}`}
              selected={metEntryId === entry.id}
              onPress={() => setMetEntryId(entry.id)}
              testID={`cardio-intensity-${entry.id}`}
              block
            />
          ))}

          <TextField
            label="Durée"
            value={duration}
            onChangeText={setDuration}
            suffix="min"
            keyboardType="number-pad"
            testID="cardio-duration"
          />

          {estimate !== undefined ? (
            <Callout
              title={`Environ ${formatKcal(estimate)}`}
              body={
                'Estimation de planification, pas une mesure : le terrain, la forme du jour et les ' +
                'pauses la font varier, souvent à la baisse.'
              }
              testID="cardio-estimate"
            />
          ) : null}

          <Button
            label="Enregistrer la séance"
            onPress={save}
            disabled={!selected || !isUsableDuration}
            testID="cardio-save"
          />

          {saved ? (
            <Text variant="caption" tone="primary" testID="cardio-saved">
              Séance enregistrée.
            </Text>
          ) : null}

          <Button
            label="Revenir"
            variant="secondary"
            onPress={() => router.back()}
            testID="cardio-back"
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** Choix exclusif, en rôle `radio`. */
function Choice({
  label,
  selected,
  onPress,
  testID,
  block,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
  block?: boolean;
}) {
  const theme = useTheme();

  return (
    <Text
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      variant="caption"
      tone={selected ? 'primary' : 'text'}
      style={[
        styles.choice,
        block ? styles.block : undefined,
        {
          borderRadius: theme.radius.pill,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
          backgroundColor: selected ? theme.colors.primaryMuted : theme.colors.surface,
        },
      ]}
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%' },
  content: { padding: 24, gap: 10, alignSelf: 'center', width: '100%' },
  heading: { gap: 4 },
  section: { marginTop: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  block: { width: '100%' },
});
