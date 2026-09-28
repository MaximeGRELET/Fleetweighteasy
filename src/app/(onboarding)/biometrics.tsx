import DateTimePicker from '@react-native-community/datetimepicker';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { StepScreen } from '@/components/onboarding/step-screen';
import { Callout, OptionCard, Text, TextField } from '@/components/ui';
import { buildBiometricsStepSchema } from '@/domain/profile/validation';
import type { Sex } from '@/domain/profile/types';
import { useOnboarding } from '@/hooks/use-onboarding';
import { useTheme } from '@/hooks/use-theme';
import { formatIsoDate } from '@/lib/format';
import { SEX_FIELD_NOTE } from '@/lib/messages/safety';
import { nextStep, onboardingRoute, stepProgress } from '@/lib/onboarding-steps';

const SEXES: { value: Sex; label: string }[] = [
  { value: 'female', label: 'Femme' },
  { value: 'male', label: 'Homme' },
];

const DEFAULT_BIRTH_YEAR_OFFSET = 30;

/**
 * Écran 4 — biométrie. Première collecte de données de santé : l'écran est
 * inaccessible tant que le consentement n'a pas été donné.
 */
export default function BiometricsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { draft, update, hasConsented } = useOnboarding();

  const [pickerVisible, setPickerVisible] = useState(false);
  const [heightText, setHeightText] = useState(draft.heightCm?.toString() ?? '');
  const [weightText, setWeightText] = useState(draft.currentWeightKg?.toString() ?? '');
  const [submitted, setSubmitted] = useState(false);

  // Garde-fou structurel : aucune donnée biométrique n'est collectée sans
  // consentement, même si l'utilisateur arrive ici par un lien direct.
  if (!hasConsented) {
    return <Redirect href="/(onboarding)/consent" />;
  }

  const parsed = buildBiometricsStepSchema().safeParse({
    sex: draft.sex,
    birthDate: draft.birthDate,
    heightCm: parseNumber(heightText),
    currentWeightKg: parseNumber(weightText),
  });

  const errors = submitted && !parsed.success ? collectErrors(parsed.error.issues) : {};

  const submit = () => {
    setSubmitted(true);

    if (!parsed.success) {
      return;
    }

    update({
      heightCm: parsed.data.heightCm,
      currentWeightKg: parsed.data.currentWeightKg,
    });

    const next = nextStep('biometrics', draft.goalType);
    if (next) {
      router.push(onboardingRoute(next));
    }
  };

  return (
    <StepScreen
      testID="onboarding-biometrics"
      title="Parle-nous de toi"
      subtitle="Ces quatre informations suffisent à estimer ta dépense énergétique."
      progress={stepProgress('biometrics', draft.goalType)}
      primaryLabel="Continuer"
      onPrimary={submit}
    >
      <View style={styles.group}>
        <Text variant="caption" tone="textMuted">
          Sexe biologique
        </Text>
        {SEXES.map((option) => (
          <OptionCard
            key={option.value}
            testID={`sex-${option.value}`}
            label={option.label}
            selected={draft.sex === option.value}
            onPress={() => update({ sex: option.value })}
          />
        ))}
        <Callout title="Pourquoi cette question" body={SEX_FIELD_NOTE} />
        {errors.sex ? (
          <Text variant="caption" tone="caution">
            {errors.sex}
          </Text>
        ) : null}
      </View>

      <View style={styles.group}>
        <Text variant="caption" tone="textMuted">
          Date de naissance
        </Text>
        <Pressable
          accessibilityRole="button"
          // La date choisie fait partie de l'étiquette : sans elle, le lecteur
          // d'écran n'annoncerait que le nom du champ, jamais sa valeur.
          accessibilityLabel={`Date de naissance : ${draft.birthDate ? formatIsoDate(draft.birthDate) : 'non renseignée'}`}
          testID="birthdate-trigger"
          onPress={() => setPickerVisible(true)}
          style={[
            styles.dateField,
            { borderColor: theme.colors.border, borderRadius: theme.radius.md },
          ]}
        >
          <Text variant="body" tone={draft.birthDate ? 'text' : 'textMuted'}>
            {draft.birthDate ? formatIsoDate(draft.birthDate) : 'Choisir une date'}
          </Text>
        </Pressable>
        {errors.birthDate ? (
          <Text variant="caption" tone="caution">
            {errors.birthDate}
          </Text>
        ) : null}
        {pickerVisible ? (
          <DateTimePicker
            testID="birthdate-picker"
            value={parseDateOrDefault(draft.birthDate)}
            mode="date"
            maximumDate={new Date()}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_event, selected) => {
              setPickerVisible(Platform.OS === 'ios');
              if (selected) {
                update({ birthDate: toIsoDate(selected) });
              }
            }}
          />
        ) : null}
      </View>

      <TextField
        testID="height-field"
        label="Taille"
        suffix="cm"
        keyboardType="numeric"
        value={heightText}
        onChangeText={setHeightText}
        placeholder="170"
        {...(errors.heightCm ? { error: errors.heightCm } : {})}
      />

      <TextField
        testID="weight-field"
        label="Poids actuel"
        suffix="kg"
        keyboardType="numeric"
        value={weightText}
        onChangeText={setWeightText}
        placeholder="70"
        hint="Pèse-toi de préférence le matin, à jeun."
        {...(errors.currentWeightKg ? { error: errors.currentWeightKg } : {})}
      />
    </StepScreen>
  );
}

/** Accepte la virgule décimale : c'est ce que tape un clavier français. */
function parseNumber(text: string): number | undefined {
  const normalized = text.replace(',', '.').trim();

  if (normalized.length === 0) {
    return undefined;
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : Number.NaN;
}

function collectErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const issue of issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !errors[field]) {
      errors[field] = issue.message;
    }
  }

  return errors;
}

function parseDateOrDefault(isoDate: string | undefined): Date {
  if (isoDate) {
    const parsed = new Date(`${isoDate}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const fallback = new Date();
  fallback.setFullYear(fallback.getFullYear() - DEFAULT_BIRTH_YEAR_OFFSET);
  return fallback;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  dateField: { padding: 14, borderWidth: StyleSheet.hairlineWidth },
});
