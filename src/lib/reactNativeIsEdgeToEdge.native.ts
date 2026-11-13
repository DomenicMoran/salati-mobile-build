import { TurboModuleRegistry } from 'react-native';

const warnings = new Set<string>();

export function isEdgeToEdgeFromLibrary(): boolean {
  return TurboModuleRegistry.get('RNEdgeToEdge') != null;
}

export function isEdgeToEdgeFromProperty(): boolean {
  const deviceInfo = TurboModuleRegistry.get('DeviceInfo') as
    | { getConstants?: () => { isEdgeToEdge?: boolean } }
    | undefined;
  return deviceInfo?.getConstants?.().isEdgeToEdge === true;
}

export function isEdgeToEdge(): boolean {
  return isEdgeToEdgeFromLibrary() || isEdgeToEdgeFromProperty();
}

export function controlEdgeToEdgeValues(values: Record<string, unknown>): void {
  if (!__DEV__ || !isEdgeToEdge()) return;
  const entries = Object.entries(values).filter(([, value]) => typeof value !== 'undefined');
  const stableKey = entries.map(([k, v]) => `${k}:${String(v)}`).join('|');
  if (entries.length < 1 || warnings.has(stableKey)) return;
  warnings.add(stableKey);
}
