import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { SourceNotice } from '@/components/food/source-notice';
import { Screen } from '@/components/layout/screen';
import { Button, Callout, Text } from '@/components/ui';
import { normalizeBarcode } from '@/domain/food/barcode';
import { useBarcodeLookup } from '@/hooks/use-food-catalog';
import { useTheme } from '@/hooks/use-theme';
import {
  explainBarcodeRejection,
  explainSourceError,
  explainIncompleteProduct,
  UNKNOWN_PRODUCT_MESSAGE,
} from '@/lib/messages/food-source';
import { readMealTypeParam } from '@/lib/route-params';
import { useFoodDraftStore } from '@/stores/food-draft';

/**
 * Scan d'un code-barres.
 *
 * Trois issues sont traitées distinctement, parce qu'elles appellent trois
 * conduites différentes (PHASES_2_A_5 §4.3) :
 *
 * - **trouvé** — localement ou à distance : on enchaîne sur l'ajout au journal ;
 * - **incomplet** — la fiche existe mais il lui manque des nutriments : on
 *   ouvre la saisie manuelle **pré-remplie**, sans faire retaper ce qu'on sait ;
 * - **inconnu ou hors ligne** : on l'explique et on propose la saisie manuelle.
 *
 * Aucune de ces issues ne laisse l'écran tourner dans le vide : c'est la règle
 * de la phase (§4.7), et c'est ce que vérifient les tests d'écran.
 */
export default function FoodScanScreen() {
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams<{ mealType?: string }>();
  const mealType = readMealTypeParam(params.mealType);

  const [permission, requestPermission] = useCameraPermissions();
  const [scannedCode, setScannedCode] = useState<string | undefined>(undefined);
  const lookup = useBarcodeLookup(scannedCode);
  const startFrom = useFoodDraftStore((state) => state.startFrom);
  const startBlank = useFoodDraftStore((state) => state.startBlank);

  const outcome = lookup.outcome;

  const openManualEntry = useCallback(() => {
    if (outcome?.status === 'incomplete') {
      // Le nom, la marque et les valeurs déjà connues sont conservés : la
      // personne n'a que le manquant à saisir.
      startFrom(outcome.draft, mealType);
    } else {
      startBlank({
        ...(outcome?.status === 'unknown' ? { barcode: outcome.barcode } : {}),
        ...(mealType === undefined ? {} : { mealType }),
      });
    }

    router.replace('/food/custom');
  }, [outcome, mealType, startFrom, startBlank, router]);

  // Un produit trouvé n'a rien à faire sur l'écran de scan : on enchaîne.
  useEffect(() => {
    if (outcome?.status === 'found') {
      router.replace({
        pathname: '/food/add',
        params: {
          foodItemId: outcome.item.id,
          ...(mealType === undefined ? {} : { mealType }),
        },
      });
    }
  }, [outcome, mealType, router]);

  if (permission === null) {
    return (
      <Screen title="Scanner un produit" testID="food-scan">
        <ActivityIndicator />
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen
        title="Scanner un produit"
        subtitle="L’accès à la caméra est nécessaire pour lire un code-barres."
        testID="food-scan"
      >
        <Callout
          title="Caméra non autorisée"
          body={
            permission.canAskAgain
              ? 'Autorise l’accès à la caméra pour scanner. Tu peux aussi chercher le produit par son nom ou le saisir à la main.'
              : 'L’accès à la caméra a été refusé. Tu peux l’autoriser depuis les réglages de ton téléphone, chercher le produit par son nom, ou le saisir à la main.'
          }
        />
        {permission.canAskAgain ? (
          <Button
            label="Autoriser la caméra"
            onPress={() => void requestPermission()}
            testID="scan-request-permission"
          />
        ) : null}
        <Button
          label="Saisir à la main"
          variant="secondary"
          onPress={openManualEntry}
          testID="scan-manual-entry"
        />
      </Screen>
    );
  }

  return (
    <Screen
      title="Scanner un produit"
      subtitle="Vise le code-barres. La lecture se fait toute seule."
      testID="food-scan"
    >
      {scannedCode === undefined ? (
        <View
          style={[
            styles.viewfinder,
            { borderRadius: theme.radius.lg, borderColor: theme.colors.border },
          ]}
          testID="scan-viewfinder"
        >
          <CameraView
            style={styles.camera}
            // Seuls les formats alimentaires : un QR code de ticket de caisse
            // n'a aucune chance de désigner un produit.
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
            onBarcodeScanned={({ data }) => setScannedCode(data)}
          />
        </View>
      ) : null}

      {lookup.isLoading ? (
        <View style={styles.loading} testID="scan-loading">
          <ActivityIndicator />
          <Text variant="caption" tone="textMuted">
            Recherche du produit…
          </Text>
        </View>
      ) : null}

      {/* Un code mal lu : on le dit et on relance le scan, sans passer par le
          réseau — le code n'aurait rien ramené. */}
      {outcome?.status === 'invalid' && scannedCode !== undefined ? (
        <SourceNotice
          testID="scan-invalid"
          message={explainBarcodeRejection(rejectionOf(scannedCode))}
          onRetry={() => setScannedCode(undefined)}
          onManualEntry={openManualEntry}
        />
      ) : null}

      {outcome?.status === 'incomplete' ? (
        <SourceNotice
          testID="scan-incomplete"
          message={explainIncompleteProduct(outcome.missing)}
          onManualEntry={openManualEntry}
        />
      ) : null}

      {outcome?.status === 'unknown' ? (
        <SourceNotice
          testID="scan-unknown"
          message={UNKNOWN_PRODUCT_MESSAGE}
          onManualEntry={openManualEntry}
        />
      ) : null}

      {lookup.error ? (
        <SourceNotice
          testID="scan-error"
          message={explainSourceError(lookup.error)}
          onRetry={lookup.refetch}
          onManualEntry={openManualEntry}
        />
      ) : null}

      {scannedCode !== undefined && !lookup.isLoading ? (
        <Button
          label="Scanner un autre produit"
          variant="quiet"
          onPress={() => setScannedCode(undefined)}
          testID="scan-again"
        />
      ) : null}
    </Screen>
  );
}

/** Motif précis du rejet, pour expliquer *pourquoi* le code n'est pas exploitable. */
function rejectionOf(code: string) {
  const normalized = normalizeBarcode(code);
  return normalized.ok ? 'bad_check_digit' : normalized.reason;
}

const styles = StyleSheet.create({
  viewfinder: { width: '100%', aspectRatio: 4 / 3, overflow: 'hidden', borderWidth: 1 },
  camera: { flex: 1 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
