import * as Location from 'expo-location';
import { useState } from 'react';

export interface DeviceLocationResult {
  lat: number;
  lon: number;
}

interface UseDeviceLocationState {
  loading: boolean;
  error: string | null;
  /**
   * true, wenn die Berechtigung dauerhaft verweigert ist (`canAskAgain`
   * false) — dann öffnet `requestForegroundPermissionsAsync()` keinen
   * Systemdialog mehr und ein erneutes Antippen des Ortungs-Knopfes bleibt
   * wirkungslos (Audit 2026-07-27, U5). Der Aufrufer soll in dem Fall
   * `Linking.openSettings()` anbieten.
   */
  blocked: boolean;
}

/**
 * Fragt Standort-Berechtigung an und liest die aktuelle Position.
 * Gibt null zurück (mit gesetztem `error`) wenn Berechtigung verweigert wird
 * oder die Ortung fehlschlägt — der Aufrufer entscheidet über den Fallback
 * (z.B. manuelle Stadtsuche via Nominatim).
 */
export function useDeviceLocation() {
  const [state, setState] = useState<UseDeviceLocationState>({
    loading: false,
    error: null,
    blocked: false,
  });

  async function requestLocation(): Promise<DeviceLocationResult | null> {
    setState({ loading: true, error: null, blocked: false });
    try {
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setState({ loading: false, error: 'permission_denied', blocked: !canAskAgain });
        return null;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setState({ loading: false, error: null, blocked: false });
      return { lat: pos.coords.latitude, lon: pos.coords.longitude };
    } catch {
      setState({ loading: false, error: 'location_failed', blocked: false });
      return null;
    }
  }

  return { ...state, requestLocation };
}
