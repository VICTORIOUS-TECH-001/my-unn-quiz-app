import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { firebaseDb, firebaseNow } from './firebase';
import { Quiz, QuizStatus } from '../types';

/**
 * LIVE CONTROL PLANE — the JAMB-style "same program on every phone" layer.
 *
 * Firestore is the single source of truth and every device holds open
 * realtime listeners, so admin actions (launch, extend, end, broadcast,
 * schedule, questions) land on all screens within ~1 second:
 *
 * - examControl/{quizId}  — live status, shared exam window, force-submit
 * - liveAnnouncements/latest — instant broadcast toasts on every device
 * - presence/{regNo} — 30s heartbeats so admin sees who is online
 */

export interface ExamControl {
  quizId: string;
  status: QuizStatus;
  scheduledStartMs: number;
  windowStartMs: number;
  windowEndMs: number;
  extraMinutes: number;
  questionsVersion: number;
  forceSubmit: boolean;
  forceSubmitAt: number;
}

export interface LiveBroadcast {
  id: string;
  message: string;
  targetCourse?: string | null;
  kind: 'info' | 'live' | 'warning' | 'end';
  createdAt: number;
}

export interface PresenceEntry {
  regNo: string;
  name: string;
  screen: string;
  quizId?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lastSeen?: any;
}

const controlDoc = (quizId: string) => doc(firebaseDb, 'examControl', quizId);

/** Merge-write live fields for a quiz. Awaited by admin so failures surface. */
export async function publishExamControl(
  quizId: string,
  patch: Partial<ExamControl>
): Promise<void> {
  await setDoc(
    controlDoc(quizId),
    { ...patch, quizId, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function deleteExamControl(quizId: string): Promise<void> {
  try {
    await deleteDoc(controlDoc(quizId));
  } catch {
    /* already gone */
  }
}

export function subscribeExamControl(
  quizId: string,
  cb: (control: ExamControl | null) => void
): () => void {
  return onSnapshot(
    controlDoc(quizId),
    (snap) => cb(snap.exists() ? (snap.data() as ExamControl) : null),
    (error) => {
      console.error('Control stream failed:', error);
      cb(null);
    }
  );
}

export function subscribeAllExamControls(
  cb: (controls: ExamControl[]) => void
): () => void {
  return onSnapshot(
    collection(firebaseDb, 'examControl'),
    (snap) => cb(snap.docs.map((d) => d.data() as ExamControl)),
    (error) => console.error('Controls stream failed:', error)
  );
}

/** Launch: every phone sees LIVE + shares one countdown window. */
export async function launchExamLive(quiz: Quiz): Promise<void> {
  const startMs = firebaseNow();
  await publishExamControl(quiz.id, {
    status: 'active',
    scheduledStartMs: new Date(quiz.scheduledDateTime).getTime() || startMs,
    windowStartMs: startMs,
    windowEndMs: startMs + quiz.durationMinutes * 60000,
    extraMinutes: 0,
    forceSubmit: false,
  });
}

/** Add minutes to the running window on ALL devices instantly. */
export async function extendExamLive(
  quizId: string,
  minutes: number
): Promise<number> {
  const snap = await getDoc(controlDoc(quizId));
  const data = snap.data() as ExamControl | undefined;
  const base = data?.windowEndMs && data.windowEndMs > 0 ? data.windowEndMs : firebaseNow();
  const next = base + minutes * 60000;
  await publishExamControl(quizId, {
    windowEndMs: next,
    extraMinutes: (data?.extraMinutes || 0) + minutes,
  });
  return next;
}

/** End now: every open exam auto-submits within seconds. */
export async function endExamLive(quiz: Quiz): Promise<void> {
  await publishExamControl(quiz.id, {
    status: 'completed',
    forceSubmit: true,
    forceSubmitAt: firebaseNow(),
    windowEndMs: firebaseNow(),
  });
}

/** Mirror a schedule save. Never clobbers a running window. */
export async function scheduleExamLive(quiz: Quiz): Promise<void> {
  const startMs = new Date(quiz.scheduledDateTime).getTime() || firebaseNow();
  if (quiz.status === 'active') {
    await publishExamControl(quiz.id, { scheduledStartMs: startMs });
    return;
  }
  await publishExamControl(quiz.id, {
    status: 'scheduled',
    scheduledStartMs: startMs,
    forceSubmit: false,
    windowStartMs: 0,
    windowEndMs: 0,
  });
}

/**
 * Notify open exams that this quiz's questions changed.
 * Version = server timestamp, so any increase means "reload questions".
 */
export async function bumpQuestionsVersion(quizId: string): Promise<void> {
  await publishExamControl(quizId, { questionsVersion: firebaseNow() });
}

// ---------------- Broadcasts (one message -> every screen) ----------------

export async function broadcastLive(
  message: string,
  targetCourse?: string,
  kind: LiveBroadcast['kind'] = 'info'
): Promise<void> {
  await setDoc(doc(firebaseDb, 'liveAnnouncements', 'latest'), {
    id: `bc_${Date.now()}`,
    message,
    targetCourse: targetCourse || null,
    kind,
    createdAt: firebaseNow(),
  });
}

export function subscribeLiveBroadcasts(
  cb: (broadcast: LiveBroadcast | null) => void
): () => void {
  let first = true;
  return onSnapshot(
    doc(firebaseDb, 'liveAnnouncements', 'latest'),
    (snap) => {
      if (!snap.exists()) {
        cb(null);
        return;
      }
      const data = snap.data() as LiveBroadcast;
      if (first) {
        first = false;
        // Don't toast stale history on fresh app load.
        if (firebaseNow() - (data.createdAt || 0) > 60000) {
          cb(null);
          return;
        }
      }
      cb(data);
    },
    (error) => console.error('Broadcast stream failed:', error)
  );
}

// ---------------- Presence (who is online right now) ----------------

function presenceKey(regNo: string): string {
  return regNo.replace(/[^a-zA-Z0-9]/g, '_');
}

/** Heartbeat every 30s. Returns a stop function. */
export function startPresence(
  regNo: string,
  name: string,
  screen: string,
  quizId?: string
): () => void {
  const ref = doc(firebaseDb, 'presence', presenceKey(regNo));
  let stopped = false;
  const beat = () => {
    if (stopped) return;
    setDoc(
      ref,
      { regNo, name, screen, quizId: quizId || null, lastSeen: serverTimestamp() },
      { merge: true }
    ).catch((error) => console.error('Presence beat failed:', error));
  };
  beat();
  const timer = window.setInterval(beat, 30000);
  return () => {
    stopped = true;
    window.clearInterval(timer);
  };
}

export function subscribePresence(
  cb: (entries: PresenceEntry[]) => void
): () => void {
  return onSnapshot(
    collection(firebaseDb, 'presence'),
    (snap) => cb(snap.docs.map((d) => d.data() as PresenceEntry)),
    (error) => console.error('Presence stream failed:', error)
  );
}

/** Fresh = heartbeat within the last 2 minutes (server clock). */
export function isPresenceFresh(entry: PresenceEntry): boolean {
  try {
    const ms = entry.lastSeen?.toMillis?.();
    if (typeof ms !== 'number') return true; // pending write: assume online
    return firebaseNow() - ms < 120000;
  } catch {
    return true;
  }
}

// ---------------- Connection (online + Firestore reachable) ----------------

export function subscribeConnection(cb: (online: boolean) => void): () => void {
  let firestoreOk = true;
  let disposed = false;
  const emit = () => {
    if (!disposed) cb(navigator.onLine && firestoreOk);
  };
  const onOnline = () => emit();
  const onOffline = () => emit();
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  const unsub = onSnapshot(
    doc(firebaseDb, 'system', 'clock'),
    () => {
      firestoreOk = true;
      emit();
    },
    () => {
      firestoreOk = false;
      emit();
    }
  );
  emit();
  return () => {
    disposed = true;
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    unsub();
  };
}
