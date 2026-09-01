import { useCallback, useState } from 'react';
import { Pressable, Text } from 'react-native';

/**
 * Substitut d'`expo-camera` pour les tests d'écran.
 *
 * La caméra est un module natif : elle n'existe pas dans l'environnement de
 * test. Le viseur devient donc un bouton, qui émet le code-barres préparé par
 * le test — ce qui permet d'éprouver **tout** ce qui suit la lecture (résolution
 * du produit, cache, repli hors ligne) sans dépendre d'un appareil.
 */

export interface CameraPermissionState {
  granted: boolean;
  canAskAgain: boolean;
}

let permissionState: CameraPermissionState | null = { granted: true, canAskAgain: true };
let nextScannedCode = '';

/** Prépare l'état d'autorisation observé par l'écran. */
export function setCameraPermission(state: CameraPermissionState | null): void {
  permissionState = state;
}

/** Prépare le code que produira une pression sur le viseur. */
export function setNextScannedCode(code: string): void {
  nextScannedCode = code;
}

export function resetCameraMock(): void {
  permissionState = { granted: true, canAskAgain: true };
  nextScannedCode = '';
}

export interface CameraViewProps {
  onBarcodeScanned?: (event: { data: string; type: string }) => void;
  barcodeScannerSettings?: { barcodeTypes: string[] };
  style?: unknown;
}

export function CameraView({ onBarcodeScanned, barcodeScannerSettings }: CameraViewProps) {
  return (
    <Pressable
      testID="camera-view"
      accessibilityRole="button"
      // Les formats acceptés sont exposés pour que le test puisse vérifier
      // qu'on ne demande pas au lecteur d'écouter les QR codes.
      accessibilityLabel={(barcodeScannerSettings?.barcodeTypes ?? []).join(',')}
      onPress={() => onBarcodeScanned?.({ data: nextScannedCode, type: 'ean13' })}
    >
      <Text>viseur</Text>
    </Pressable>
  );
}

export function useCameraPermissions(): [
  CameraPermissionState | null,
  () => Promise<CameraPermissionState>,
] {
  const [state, setState] = useState<CameraPermissionState | null>(permissionState);

  const request = useCallback(async () => {
    const granted = { granted: true, canAskAgain: true };
    permissionState = granted;
    setState(granted);
    return granted;
  }, []);

  return [state, request];
}
