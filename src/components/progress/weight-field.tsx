import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, TextField } from '@/components/ui';
import { weightKgSchema } from '@/domain/profile/validation';
import { formatIsoDate } from '@/lib/format';

export interface WeightFieldProps {
  /** Date de la pesée à saisir. */
  date: string;
  /** Valeur déjà enregistrée pour cette date, s'il y en a une. */
  existingWeightKg?: number;
  onSubmit: (weightKg: number) => void;
  testID?: string;
}

/**
 * Saisie de la pesée du jour.
 *
 * Une seule pesée par date : quand il en existe déjà une, le champ est
 * pré-rempli et le bouton parle de correction, pas d'ajout. L'utilisateur doit
 * comprendre qu'il ne va pas empiler deux valeurs contradictoires.
 *
 * Les bornes de validation viennent de `weightKgSchema`, le schéma déjà utilisé
 * par l'onboarding : un écran ne redéfinit jamais une règle métier.
 */
export function WeightField({ date, existingWeightKg, onSubmit, testID }: WeightFieldProps) {
  const [value, setValue] = useState(existingWeightKg ? String(existingWeightKg) : '');
  const [error, setError] = useState<string>();

  function submit() {
    // La virgule est le séparateur décimal du clavier français ; la refuser
    // serait un rejet incompréhensible.
    const parsed = Number(value.replace(',', '.'));
    const result = weightKgSchema.safeParse(Number.isNaN(parsed) ? undefined : parsed);

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Indique ton poids en kilogrammes.');
      return;
    }

    setError(undefined);
    onSubmit(result.data);
  }

  const isCorrection = existingWeightKg !== undefined;

  return (
    <View style={styles.container}>
      <TextField
        label={`Ta pesée du ${formatIsoDate(date)}`}
        value={value}
        onChangeText={setValue}
        suffix="kg"
        keyboardType="decimal-pad"
        placeholder="72,4"
        error={error}
        hint={
          isCorrection
            ? 'Une pesée par jour : enregistrer remplacera la valeur du jour.'
            : 'Idéalement le matin, à jeun, après être passé aux toilettes.'
        }
        testID={testID}
      />
      <Button
        label={isCorrection ? 'Corriger ma pesée' : 'Enregistrer'}
        onPress={submit}
        testID={testID ? `${testID}-submit` : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
});
