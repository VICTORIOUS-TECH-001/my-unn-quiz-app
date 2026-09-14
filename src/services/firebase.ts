import { initializeApp } from 'firebase/app';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import {
  browserSessionPersistence,
  getAuth,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'not-configured',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'not-configured.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'not-configured',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'not-configured.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'not-configured',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'not-configured',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
};

if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId) {
  console.error(
    'Firebase is not configured. Create a local .env file from .env.example and add the Web App configuration from Firebase Console.'
  );
}

const app = initializeApp(firebaseConfig);
export const firebaseDb = getFirestore(app);
export const firebaseAuth = getAuth(app);
let serverClockOffsetMs = 0;

const collectionForKey: Record<string, string> = {
  unn_cbt_students_v1: 'students',
  unn_cbt_courses_v1: 'courses',
  unn_cbt_quizzes_v1: 'quizzes',
  unn_cbt_attempts_v1: 'attempts',
  unn_cbt_results_v1: 'results',
  unn_cbt_notifications_v1: 'notifications',
  unn_cbt_config_v1: 'config',
};

function documentId(value: unknown): string {
  return String(value).replace(/[\/#?[\]]/g, '_');
}

export async function syncStorageCollection(key: string, value: unknown): Promise<void> {
  const collectionName = collectionForKey[key];
  if (!collectionName) return;

  try {
    if (collectionName === 'config') {
      await setDoc(doc(firebaseDb, collectionName, 'system'), value as Record<string, unknown>);
      return;
    }

    const entries = Array.isArray(value)
      ? value.map((item) => {
          const record = item as Record<string, unknown>;
          return [record.id || record.regNo || crypto.randomUUID(), item] as const;
        })
      : Object.entries((value || {}) as Record<string, unknown>);
    await Promise.all(
      entries.map(([id, item]) =>
        setDoc(doc(firebaseDb, collectionName, documentId(id)), item as Record<string, unknown>)
      )
    );
  } catch (error) {
    console.error(`Firebase sync failed for ${collectionName}:`, error);
  }
}

export async function readStorageCollection<T>(collectionName: string): Promise<T[]> {
  const snapshot = await getDocs(collection(firebaseDb, collectionName));
  return snapshot.docs.map((item) => item.data() as T);
}

export async function authenticateAdmin(email: string, password: string): Promise<void> {
  await setPersistence(firebaseAuth, browserSessionPersistence);
  await signInWithEmailAndPassword(firebaseAuth, email.trim().toLowerCase(), password);
}

export async function logoutAdmin(): Promise<void> {
  await signOut(firebaseAuth);
}

export async function deleteFirebaseDocument(collectionName: string, id: string): Promise<void> {
  await deleteDoc(doc(firebaseDb, collectionName, documentId(id)));
}

export async function logAdminAction(
  action: string,
  resource: string,
  resourceId?: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  if (!firebaseAuth.currentUser) return;
  await setDoc(doc(collection(firebaseDb, 'adminLogs')), {
    action,
    resource,
    resourceId: resourceId || null,
    details,
    adminUid: firebaseAuth.currentUser.uid,
    adminEmail: firebaseAuth.currentUser.email || null,
    createdAt: serverTimestamp(),
  });
}

export async function initializeFirebaseClock(): Promise<void> {
  const clockRef = doc(firebaseDb, 'system', 'clock');
  await setDoc(clockRef, { serverTime: serverTimestamp() }, { merge: true });
  onSnapshot(clockRef, (snapshot) => {
    const value = snapshot.data()?.serverTime;
    if (value instanceof Timestamp) {
      serverClockOffsetMs = value.toMillis() - Date.now();
    }
  });
}

export function firebaseNow(): number {
  return Date.now() + serverClockOffsetMs;
}

export function subscribeToFirebaseCollection(
  collectionName: string,
  onChange: (items: unknown[]) => void
): () => void {
  return onSnapshot(
    collection(firebaseDb, collectionName),
    (snapshot) => onChange(snapshot.docs.map((item) => item.data())),
    (error) => console.error(`Firebase listener failed for ${collectionName}:`, error)
  );
}
