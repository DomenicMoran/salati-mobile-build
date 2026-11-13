import * as Crypto from 'expo-crypto';

/** PIN nur als SHA-256-Hex — gleiche Logik wie Salati TV. */
export async function hashAdminPin(pin: string): Promise<string> {
  const trimmed = pin.trim();
  if (trimmed.length < 4 || trimmed.length > 12) {
    throw new Error('pin_length');
  }
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, trimmed);
}
