import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import * as Crypto from 'expo-crypto';

const PBKDF2_ITER = 120_000;
const SALT_BYTES = 16;
const DK_LEN = 32;

export function isLegacyPinHash(hash: string | null): boolean {
  return !!hash && /^[a-f0-9]{64}$/i.test(hash);
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** PIN als PBKDF2-SHA256 mit Salt — gleiche Logik wie Salati TV. */
export async function hashAdminPin(pin: string): Promise<string> {
  const trimmed = pin.trim();
  if (trimmed.length < 4 || trimmed.length > 12) throw new Error('pin_length');
  const salt = await Crypto.getRandomBytesAsync(SALT_BYTES);
  const dk = pbkdf2(sha256, utf8ToBytes(trimmed), salt, { c: PBKDF2_ITER, dkLen: DK_LEN });
  return `v2$${PBKDF2_ITER}$${bytesToBase64(salt)}$${bytesToHex(dk)}`;
}