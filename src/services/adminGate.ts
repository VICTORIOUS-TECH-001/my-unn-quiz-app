import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firebaseDb } from './firebase';

/**
 * Admin gate: the admin portal is locked with a PIN verified against
 * Firebase Firestore (document `config/admin`, field `pin`).
 * Default PIN: 0420 (seeded into Firebase on first check).
 * Change it anytime from the admin header ("Change PIN") or directly
 * in the Firebase console.
 */
export const DEFAULT_ADMIN_PIN = '0420';
const ADMIN_SESSION_KEY = 'unn_admin_unlocked_v1';

function pinDocRef() {
  return doc(firebaseDb, 'config', 'admin');
}

export function isAdminSessionUnlocked(): boolean {
  try {
    return sessionStorage.getItem(ADMIN_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function unlockAdminSession(): void {
  try {
    sessionStorage.setItem(ADMIN_SESSION_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function lockAdminSession(): void {
  try {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export async function verifyAdminPin(pin: string): Promise<boolean> {
  const clean = pin.trim();
  if (!clean) return false;
  try {
    const snap = await getDoc(pinDocRef());
    if (!snap.exists()) {
      await setDoc(pinDocRef(), {
        pin: DEFAULT_ADMIN_PIN,
        updatedAt: new Date().toISOString(),
      });
      return clean === DEFAULT_ADMIN_PIN;
    }
    const data = snap.data() as { pin?: unknown };
    const expected =
      typeof data.pin === 'string' && data.pin ? data.pin : DEFAULT_ADMIN_PIN;
    return clean === expected;
  } catch (error) {
    console.error('Admin PIN verification failed:', error);
    // Offline fallback so the admin is never hard-locked out.
    return clean === DEFAULT_ADMIN_PIN;
  }
}

export async function changeAdminPin(newPin: string): Promise<void> {
  await setDoc(
    pinDocRef(),
    { pin: newPin.trim(), updatedAt: new Date().toISOString() },
    { merge: true }
  );
}
