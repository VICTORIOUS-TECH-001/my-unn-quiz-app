import {
  Attempt,
  Course,
  GradeBoundary,
  NotificationItem,
  PracticeHistoryEntry,
  Question,
  QuestionBank,
  Quiz,
  QuizStatus,
  Result,
  Student,
  SystemConfig,
} from '../types';
import {
  DEFAULT_GRADING_SCALE,
  INITIAL_CONFIG,
  INITIAL_COURSES,
  INITIAL_NOTIFICATIONS,
  INITIAL_QUESTION_BANKS,
  INITIAL_QUIZZES,
  INITIAL_RESULTS,
  INITIAL_STUDENTS,
} from './seedData';
import {
  deleteFirebaseDocument,
  initializeFirebaseClock,
  logAdminAction,
  readStorageCollection,
  subscribeToFirebaseCollection,
  syncStorageCollection,
} from './firebase';
import { parseWATDateTime } from './watTime';
import {
  bumpQuestionsVersion,
  deleteExamControl,
  publishExamControl,
  scheduleExamLive,
} from './liveSync';

// Structured Storage Keys with unified namespace
const STORAGE_KEYS = {
  STUDENTS: 'unn_cbt_students_v1',
  COURSES: 'unn_cbt_courses_v1',
  QUIZZES: 'unn_cbt_quizzes_v1',
  ATTEMPTS: 'unn_cbt_attempts_v1',
  RESULTS: 'unn_cbt_results_v1',
  NOTIFICATIONS: 'unn_cbt_notifications_v1',
  CONFIG: 'unn_cbt_config_v1',
  ACTIVE_SESSION: 'unn_cbt_session_v1',
  QUESTION_BANKS: 'unn_cbt_questionbanks_v1',
  PRACTICE_HISTORY: 'unn_cbt_practice_history_v1',
};

/** Default number of questions drawn from a bank for each practice/quiz run. */
export const DEFAULT_PRACTICE_DRAW = 70;

export function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Event Dispatcher for reactive multi-tab and UI sync
const CBT_CHANGE_EVENT = 'cbt_data_change';

function notifyChange(resource: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CBT_CHANGE_EVENT, { detail: { resource } }));
  }
}

// Safely retrieve parsed JSON from localStorage
function getLocalItem<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(key);
    if (!item) return fallback;
    return JSON.parse(item) as T;
  } catch (err) {
    console.error(`Error reading ${key} from localStorage:`, err);
    return fallback;
  }
}

// Safely save item to localStorage
function setLocalItem<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error saving ${key} to localStorage:`, err);
  }
  if (firebaseReady) {
    void syncStorageCollection(key, value);
  }
}

function setLocalItemWithoutSync<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error saving remote ${key} cache:`, err);
  }
}

let firebaseReady = false;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(`Firebase request timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

/**
 * Repository Service Layer
 * Designed to mirror future Firebase Firestore collections:
 * - collection('students')
 * - collection('courses')
 * - collection('quizzes')
 * - collection('attempts')
 * - collection('results')
 * - collection('notifications')
 * - collection('config')
 */
export class CBTStorageService {
  constructor() {
    this.initializeDefaults();
  }

  public async hydrateFromFirebase(): Promise<void> {
    const resources = [
      ['STUDENTS', 'students', INITIAL_STUDENTS],
      ['COURSES', 'courses', INITIAL_COURSES],
      ['QUIZZES', 'quizzes', INITIAL_QUIZZES],
      ['RESULTS', 'results', INITIAL_RESULTS],
      ['NOTIFICATIONS', 'notifications', INITIAL_NOTIFICATIONS],
      ['QUESTION_BANKS', 'questionBanks', INITIAL_QUESTION_BANKS],
    ] as const;

    try {
      const remoteResources = await withTimeout(Promise.all(
        resources.map(async ([keyName, collectionName, fallback]) => ({
          keyName,
          fallback,
          items: await readStorageCollection<unknown>(collectionName),
        }))
      ), 8000);
      const hasRemoteData = remoteResources.some(({ items }) => items.length > 0);

      if (hasRemoteData) {
        for (const resource of remoteResources) {
          if (resource.items.length > 0) {
            setLocalItem(STORAGE_KEYS[resource.keyName], resource.items);
          }
        }
        const remoteConfig = await withTimeout(readStorageCollection<SystemConfig>('config'), 5000);
        if (remoteConfig[0]) setLocalItem(STORAGE_KEYS.CONFIG, remoteConfig[0]);
      } else {
        await withTimeout(Promise.all(
          resources.map(([keyName]) =>
            syncStorageCollection(STORAGE_KEYS[keyName], getLocalItem(STORAGE_KEYS[keyName], []))
          )
        ), 8000);
        await withTimeout(syncStorageCollection(STORAGE_KEYS.CONFIG, this.getConfig()), 5000);
      }
      firebaseReady = true;
      await withTimeout(initializeFirebaseClock(), 5000);
      this.subscribeToFirebase();
      notifyChange('all');
    } catch (error) {
      console.error('Firebase hydration failed; continuing with local data:', error);
      firebaseReady = true;
    }
  }

  private subscribeToFirebase(): void {
      const resources = [
        ['students', STORAGE_KEYS.STUDENTS],
        ['courses', STORAGE_KEYS.COURSES],
        ['quizzes', STORAGE_KEYS.QUIZZES],
        ['results', STORAGE_KEYS.RESULTS],
        ['notifications', STORAGE_KEYS.NOTIFICATIONS],
        ['questionBanks', STORAGE_KEYS.QUESTION_BANKS],
      ] as const;

        resources.forEach(([collectionName, key]) => {
        subscribeToFirebaseCollection(collectionName, (items) => {
            if (items.length > 0) {
              setLocalItemWithoutSync(key, items);
              notifyChange(collectionName);
            }
          });
        });
      subscribeToFirebaseCollection('config', (items) => {
        if (items[0]) {
          setLocalItemWithoutSync(STORAGE_KEYS.CONFIG, items[0]);
          notifyChange('config');
        }
      });
  }

  public initializeDefaults(forceReset = false): void {
    if (typeof window === 'undefined') return;

    if (forceReset || !localStorage.getItem(STORAGE_KEYS.STUDENTS)) {
      setLocalItem(STORAGE_KEYS.STUDENTS, INITIAL_STUDENTS);
    }
    if (forceReset || !localStorage.getItem(STORAGE_KEYS.COURSES)) {
      setLocalItem(STORAGE_KEYS.COURSES, INITIAL_COURSES);
    }
    if (forceReset || !localStorage.getItem(STORAGE_KEYS.QUIZZES)) {
      setLocalItem(STORAGE_KEYS.QUIZZES, INITIAL_QUIZZES);
    }
    if (forceReset || !localStorage.getItem(STORAGE_KEYS.RESULTS)) {
      setLocalItem(STORAGE_KEYS.RESULTS, INITIAL_RESULTS);
    }
    if (forceReset || !localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)) {
      setLocalItem(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
    }
    if (forceReset || !localStorage.getItem(STORAGE_KEYS.CONFIG)) {
      setLocalItem(STORAGE_KEYS.CONFIG, INITIAL_CONFIG);
    }
    if (forceReset || !localStorage.getItem(STORAGE_KEYS.ATTEMPTS)) {
      setLocalItem(STORAGE_KEYS.ATTEMPTS, {});
    }
    if (forceReset || !localStorage.getItem(STORAGE_KEYS.QUESTION_BANKS)) {
      setLocalItem(STORAGE_KEYS.QUESTION_BANKS, INITIAL_QUESTION_BANKS);
    }
    if (forceReset || !localStorage.getItem(STORAGE_KEYS.PRACTICE_HISTORY)) {
      setLocalItem(STORAGE_KEYS.PRACTICE_HISTORY, []);
    }

    if (forceReset) {
      notifyChange('all');
    }
  }

  // ==================== STUDENTS ====================
  public getStudents(): Student[] {
    return getLocalItem<Student[]>(STORAGE_KEYS.STUDENTS, INITIAL_STUDENTS).map((student) => ({
      ...student,
      level: '100 Level',
      class: '100 Level Class',
    }));
  }

  public getStudentByRegNo(regNo: string): Student | null {
    if (!regNo) return null;
    const cleanReg = regNo.trim().toUpperCase().replace(/\s+/g, '');
    const students = this.getStudents();
    return (
      students.find((s) => s.regNo.toUpperCase().replace(/\s+/g, '') === cleanReg) || null
    );
  }

  public addStudent(student: Student): boolean {
    const students = this.getStudents();
    const existing = this.getStudentByRegNo(student.regNo);
    if (existing) return false;
    students.push(student);
    setLocalItem(STORAGE_KEYS.STUDENTS, students);
    notifyChange('students');
    return true;
  }

  public updateStudent(student: Student): void {
    const students = this.getStudents();
    const index = students.findIndex((s) => s.regNo === student.regNo);
    if (index !== -1) {
      students[index] = student;
      setLocalItem(STORAGE_KEYS.STUDENTS, students);
      notifyChange('students');
    }
  }

  public deleteStudent(regNo: string): void {
    const students = this.getStudents().filter((s) => s.regNo !== regNo);
    setLocalItem(STORAGE_KEYS.STUDENTS, students);
    void deleteFirebaseDocument('students', regNo.replace(/[^a-zA-Z0-9]/g, '_'));
    notifyChange('students');
  }

  /**
   * Bulk import from an official class list. Matches by registration number:
   * new reg numbers are added, existing ones get their names/details refreshed.
   * Every imported student can immediately log in and gets a dashboard.
   */
  public importStudents(list: Student[]): { added: number; updated: number } {
    const students = getLocalItem<Student[]>(STORAGE_KEYS.STUDENTS, INITIAL_STUDENTS);
    const indexByReg = new Map(
      students.map((s, i) => [s.regNo.toUpperCase().replace(/\s+/g, ''), i])
    );
    let added = 0;
    let updated = 0;
    for (const incoming of list) {
      const key = incoming.regNo.toUpperCase().replace(/\s+/g, '');
      const existingIdx = indexByReg.get(key);
      if (existingIdx === undefined) {
        students.push({ ...incoming, sn: students.length + 1 });
        indexByReg.set(key, students.length - 1);
        added += 1;
      } else {
        const existing = students[existingIdx];
        students[existingIdx] = {
          ...existing,
          name: incoming.name || existing.name,
          level: incoming.level || existing.level,
          faculty: incoming.faculty || existing.faculty,
          campus: incoming.campus || existing.campus,
          class: incoming.class || existing.class,
        };
        updated += 1;
      }
    }
    setLocalItem(STORAGE_KEYS.STUDENTS, students);
    notifyChange('students');
    return { added, updated };
  }

  /** Explicitly push the whole student roster to Firebase. */
  public async pushStudentsToFirebase(): Promise<void> {
    await syncStorageCollection(STORAGE_KEYS.STUDENTS, this.getStudents());
  }

  // ==================== COURSES ====================
  public getCourses(): Course[] {
    return getLocalItem<Course[]>(STORAGE_KEYS.COURSES, INITIAL_COURSES);
  }

  public getCourseById(id: string): Course | null {
    return this.getCourses().find((c) => c.id === id) || null;
  }

  public addCourse(course: Course): void {
    const courses = this.getCourses();
    courses.push(course);
    setLocalItem(STORAGE_KEYS.COURSES, courses);
    notifyChange('courses');
  }

  public updateCourse(course: Course): void {
    const courses = this.getCourses();
    const idx = courses.findIndex((c) => c.id === course.id);
    if (idx !== -1) {
      courses[idx] = course;
      setLocalItem(STORAGE_KEYS.COURSES, courses);
      notifyChange('courses');
    }
  }

  public deleteCourse(id: string): void {
    const courses = this.getCourses().filter((c) => c.id !== id);
    setLocalItem(STORAGE_KEYS.COURSES, courses);
    void deleteFirebaseDocument('courses', id);
    void logAdminAction('delete', 'course', id).catch((error) =>
      console.error('Firebase course audit logging failed:', error)
    );
    notifyChange('courses');
  }

  public async keepOnlyPhil101(): Promise<void> {
    const phil101 =
      this.getCourses().find((course) => course.code.toUpperCase() === 'PHIL 101') ||
      INITIAL_COURSES[0];
    setLocalItem(STORAGE_KEYS.COURSES, [phil101]);
    const remoteCourses = await readStorageCollection<Course>('courses');
    await Promise.all(
      remoteCourses
        .filter((course) => course.id !== phil101.id)
        .map((course) => deleteFirebaseDocument('courses', course.id))
    );
    await syncStorageCollection(STORAGE_KEYS.COURSES, [phil101]);
    notifyChange('courses');
  }

  // ==================== QUIZZES ====================
  public getQuizzes(): Quiz[] {
    return getLocalItem<Quiz[]>(STORAGE_KEYS.QUIZZES, INITIAL_QUIZZES);
  }

  public getQuizById(id: string): Quiz | null {
    return this.getQuizzes().find((q) => q.id === id) || null;
  }

  public addQuiz(quiz: Quiz): void {
    const quizzes = this.getQuizzes();
    quizzes.unshift(quiz);
    setLocalItem(STORAGE_KEYS.QUIZZES, quizzes);
    notifyChange('quizzes');
  }

  public updateQuiz(quiz: Quiz): void {
    const quizzes = this.getQuizzes();
    const idx = quizzes.findIndex((q) => q.id === quiz.id);
    if (idx !== -1) {
      quizzes[idx] = quiz;
      setLocalItem(STORAGE_KEYS.QUIZZES, quizzes);
      notifyChange('quizzes');
    }
  }

  public deleteQuiz(id: string): void {
    const quizzes = this.getQuizzes().filter((q) => q.id !== id);
    setLocalItem(STORAGE_KEYS.QUIZZES, quizzes);
    this.deleteResultsByQuiz(id);
    void deleteFirebaseDocument('quizzes', id);
    void deleteExamControl(id);
    void logAdminAction('delete', 'quiz', id).catch((error) =>
      console.error('Firebase quiz audit logging failed:', error)
    );
    notifyChange('quizzes');
  }

  public async uploadClassListToFirebase(): Promise<void> {
    await syncStorageCollection(STORAGE_KEYS.STUDENTS, this.getStudents());
    await logAdminAction('upload', 'students', undefined, { count: this.getStudents().length });
  }

  public scheduleQuiz(
    quizId: string,
    date: string,
    startTime: string,
    durationMinutes: number,
    status: QuizStatus = 'scheduled'
  ): void {
    const quizzes = this.getQuizzes();
    const q = quizzes.find((item) => item.id === quizId);
    if (q) {
      q.date = date;
      q.startTime = startTime;
      q.durationMinutes = durationMinutes;
      q.status = status;
      const parsed = parseWATDateTime(date, startTime);
      if (parsed) {
        q.scheduledDateTime = parsed;
        q.endDateTime = new Date(new Date(parsed).getTime() + durationMinutes * 60000).toISOString();
      }
      this.updateQuiz(q);
      // JAMB-style live mirror: schedule/status edits reach every device in ~1s.
      // Fire-and-forget here - admin buttons await the same push to surface errors.
      try {
        const fresh = this.getQuizById(quizId);
        if (fresh && fresh.status !== 'active') {
          if (fresh.status === 'scheduled') {
            void scheduleExamLive(fresh).catch((error) =>
              console.error('Live schedule push failed:', error)
            );
          } else {
            // completed / cancelled: force auto-submit on every open exam now.
            void publishExamControl(quizId, {
              status: fresh.status,
              forceSubmit: true,
              forceSubmitAt: Date.now(),
              windowEndMs: Date.now(),
            }).catch((error) => console.error('Live end push failed:', error));
          }
        }
      } catch (error) {
        console.error('Live mirror failed:', error);
      }
    }
  }

  // ==================== QUESTIONS ====================
  public getQuestions(quizId: string): Question[] {
    const quiz = this.getQuizById(quizId);
    return quiz ? quiz.questions : [];
  }

  public addQuestion(quizId: string, question: Question): void {
    const quiz = this.getQuizById(quizId);
    if (quiz) {
      quiz.questions.push(question);
      quiz.totalQuestions = quiz.questions.length;
      this.updateQuiz(quiz);
      void bumpQuestionsVersion(quizId).catch((error) =>
        console.error('Live questions-version push failed:', error)
      );
    }
  }

  public updateQuestion(quizId: string, question: Question): void {
    const quiz = this.getQuizById(quizId);
    if (quiz) {
      const idx = quiz.questions.findIndex((q) => q.id === question.id);
      if (idx !== -1) {
        quiz.questions[idx] = question;
        this.updateQuiz(quiz);
        void bumpQuestionsVersion(quizId).catch((error) =>
          console.error('Live questions-version push failed:', error)
        );
      }
    }
  }

  public deleteQuestion(quizId: string, questionId: string): void {
    const quiz = this.getQuizById(quizId);
    if (quiz) {
      quiz.questions = quiz.questions.filter((q) => q.id !== questionId);
      quiz.totalQuestions = quiz.questions.length;
      this.updateQuiz(quiz);
      void bumpQuestionsVersion(quizId).catch((error) =>
        console.error('Live questions-version push failed:', error)
      );
    }
  }

  // ==================== QUESTION BANKS (per course, saved in Firebase) ====================
  public getQuestionBanks(): QuestionBank[] {
    return getLocalItem<QuestionBank[]>(STORAGE_KEYS.QUESTION_BANKS, []);
  }

  public getQuestionBankByCourse(courseId: string): QuestionBank | null {
    return this.getQuestionBanks().find((b) => b.courseId === courseId) || null;
  }

  public getBankQuestionCount(courseId: string): number {
    return this.getQuestionBankByCourse(courseId)?.questions.length || 0;
  }

  private saveQuestionBanks(banks: QuestionBank[]): void {
    setLocalItem(STORAGE_KEYS.QUESTION_BANKS, banks);
    notifyChange('questionBanks');
  }

  public ensureQuestionBank(courseId: string): QuestionBank {
    const existing = this.getQuestionBankByCourse(courseId);
    if (existing) return existing;
    const course = this.getCourseById(courseId);
    const bank: QuestionBank = {
      id: `bank_${courseId}`,
      courseId,
      courseCode: course?.code || 'GEN',
      courseTitle: course?.title || 'General',
      questions: [],
      updatedAt: new Date().toISOString(),
      questionsPerAttempt: DEFAULT_PRACTICE_DRAW,
    };
    const banks = this.getQuestionBanks();
    banks.push(bank);
    this.saveQuestionBanks(banks);
    return bank;
  }

  /** Append imported questions to a course bank (dedupes identical question text). */
  public addQuestionsToBank(courseId: string, questions: Question[]): { added: number; duplicates: number } {
    const bank = this.ensureQuestionBank(courseId);
    const seen = new Set(
      bank.questions.map((q) => q.questionText.trim().toLowerCase())
    );
    let added = 0;
    let duplicates = 0;
    for (const q of questions) {
      const key = q.questionText.trim().toLowerCase();
      if (seen.has(key)) {
        duplicates += 1;
        continue;
      }
      seen.add(key);
      bank.questions.push({ ...q, id: q.id || `q_bank_${Date.now()}_${added}` });
      added += 1;
    }
    bank.updatedAt = new Date().toISOString();
    const banks = this.getQuestionBanks().map((b) =>
      b.courseId === courseId ? bank : b
    );
    this.saveQuestionBanks(banks);
    return { added, duplicates };
  }

  public updateBankQuestion(courseId: string, question: Question): void {
    const bank = this.getQuestionBankByCourse(courseId);
    if (!bank) return;
    const idx = bank.questions.findIndex((q) => q.id === question.id);
    if (idx === -1) return;
    bank.questions[idx] = question;
    bank.updatedAt = new Date().toISOString();
    this.saveQuestionBanks(
      this.getQuestionBanks().map((b) => (b.courseId === courseId ? bank : b))
    );
  }

  public deleteBankQuestion(courseId: string, questionId: string): void {
    const bank = this.getQuestionBankByCourse(courseId);
    if (!bank) return;
    bank.questions = bank.questions.filter((q) => q.id !== questionId);
    bank.updatedAt = new Date().toISOString();
    this.saveQuestionBanks(
      this.getQuestionBanks().map((b) => (b.courseId === courseId ? bank : b))
    );
  }

  public clearQuestionBank(courseId: string): void {
    const bank = this.getQuestionBankByCourse(courseId);
    if (!bank) return;
    bank.questions = [];
    bank.updatedAt = new Date().toISOString();
    this.saveQuestionBanks(
      this.getQuestionBanks().map((b) => (b.courseId === courseId ? bank : b))
    );
  }

  public setQuestionsPerAttempt(courseId: string, count: number): void {
    const bank = this.ensureQuestionBank(courseId);
    bank.questionsPerAttempt = Math.max(5, Math.min(200, Math.round(count) || DEFAULT_PRACTICE_DRAW));
    bank.updatedAt = new Date().toISOString();
    this.saveQuestionBanks(
      this.getQuestionBanks().map((b) => (b.courseId === courseId ? bank : b))
    );
  }

  /**
   * Draw N random questions from a course bank for one practice/quiz run.
   * Every run shuffles both the question order and option order so each
   * practice feels fresh.
   */
  public drawRandomQuestions(courseId: string, count?: number): Question[] {
    const bank = this.getQuestionBankByCourse(courseId);
    if (!bank || bank.questions.length === 0) return [];
    const take = Math.min(count || bank.questionsPerAttempt || DEFAULT_PRACTICE_DRAW, bank.questions.length);
    return shuffleArray(bank.questions).slice(0, take).map((q) => {
      const entries = shuffleArray(Object.entries(q.options) as [keyof Question['options'], string][]);
      const remapped = { A: '', B: '', C: '', D: '' } as Question['options'];
      const keys: (keyof Question['options'])[] = ['A', 'B', 'C', 'D'];
      let newCorrect: keyof Question['options'] = 'A';
      entries.forEach(([oldKey, text], i) => {
        remapped[keys[i]] = text;
        if (oldKey === q.correctAnswer) newCorrect = keys[i];
      });
      return { ...q, options: remapped, correctAnswer: newCorrect };
    });
  }

  /** Fill/refresh a quiz's questions with a fresh random pull from its course bank. */
  public fillQuizFromBank(quizId: string, count?: number): number {
    const quiz = this.getQuizById(quizId);
    if (!quiz) return 0;
    const pulled = this.drawRandomQuestions(quiz.courseId, count || DEFAULT_PRACTICE_DRAW);
    if (pulled.length === 0) return 0;
    quiz.questions = pulled;
    quiz.totalQuestions = pulled.length;
    this.updateQuiz(quiz);
    void bumpQuestionsVersion(quizId).catch((error) =>
      console.error('Live questions-version push failed:', error)
    );
    return pulled.length;
  }

  /**
   * Explicitly push ALL question banks to the Firebase database.
   * Called after admin uploads so many concurrent students always
   * read the latest questions from the database (not just this browser).
   */
  public async pushQuestionBanksToFirebase(): Promise<void> {
    await syncStorageCollection(STORAGE_KEYS.QUESTION_BANKS, this.getQuestionBanks());
  }

  /**
   * Explicitly pull the latest question banks FROM Firebase into this device.
   * Called on student screens so concurrent writers always practise
   * with the newest uploaded questions.
   */
  public async refreshQuestionBanksFromFirebase(): Promise<number> {
    const remote = await readStorageCollection<QuestionBank>('questionBanks');
    if (remote.length > 0) {
      setLocalItemWithoutSync(STORAGE_KEYS.QUESTION_BANKS, remote);
      notifyChange('questionBanks');
    }
    return remote.length;
  }

  // ==================== PRACTICE HISTORY ====================
  public getPracticeHistory(studentRegNo?: string): PracticeHistoryEntry[] {
    const all = getLocalItem<PracticeHistoryEntry[]>(STORAGE_KEYS.PRACTICE_HISTORY, []);
    if (!studentRegNo) return all;
    const clean = studentRegNo.trim().toUpperCase().replace(/\s+/g, '');
    return all.filter((h) => h.studentRegNo.toUpperCase().replace(/\s+/g, '') === clean);
  }

  public savePracticeHistory(entry: PracticeHistoryEntry): void {
    const all = getLocalItem<PracticeHistoryEntry[]>(STORAGE_KEYS.PRACTICE_HISTORY, []);
    all.unshift(entry);
    setLocalItem(STORAGE_KEYS.PRACTICE_HISTORY, all.slice(0, 200));
    notifyChange('practiceHistory');
  }

  public getStudentXp(studentRegNo: string): number {
    return this.getPracticeHistory(studentRegNo).reduce((sum, h) => sum + (h.xpEarned || 0), 0);
  }

  // ==================== ATTEMPTS & REFRESH RECOVERY ====================
  private getAttemptsMap(): Record<string, Attempt> {
    return getLocalItem<Record<string, Attempt>>(STORAGE_KEYS.ATTEMPTS, {});
  }

  public getAttemptKey(quizId: string, studentRegNo: string): string {
    return `${quizId}__${studentRegNo.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }

  public getAttempt(quizId: string, studentRegNo: string): Attempt | null {
    const map = this.getAttemptsMap();
    const key = this.getAttemptKey(quizId, studentRegNo);
    return map[key] || null;
  }

  public saveAttempt(attempt: Attempt): void {
    const map = this.getAttemptsMap();
    const key = this.getAttemptKey(attempt.quizId, attempt.studentRegNo);
    map[key] = attempt;
    setLocalItem(STORAGE_KEYS.ATTEMPTS, map);
  }

  public clearAttempt(quizId: string, studentRegNo: string): void {
    const map = this.getAttemptsMap();
    const key = this.getAttemptKey(quizId, studentRegNo);
    delete map[key];
    setLocalItem(STORAGE_KEYS.ATTEMPTS, map);
  }

  // ==================== RESULTS & RANKING ====================
  public getResults(quizId?: string): Result[] {
    const all = getLocalItem<Result[]>(STORAGE_KEYS.RESULTS, INITIAL_RESULTS);
    if (!quizId) return all;
    return all.filter((r) => r.quizId === quizId);
  }

  public getResultByStudent(quizId: string, studentRegNo: string): Result | null {
    const cleanReg = studentRegNo.trim().toUpperCase().replace(/\s+/g, '');
    const list = this.getResults(quizId);
    return (
      list.find((r) => r.studentRegNo.toUpperCase().replace(/\s+/g, '') === cleanReg) || null
    );
  }

  public saveResult(result: Result): Result {
    const results = this.getResults();
    // Check if result exists for this student & quiz
    const cleanReg = result.studentRegNo.trim().toUpperCase().replace(/\s+/g, '');
    const existingIdx = results.findIndex(
      (r) =>
        r.quizId === result.quizId &&
        r.studentRegNo.toUpperCase().replace(/\s+/g, '') === cleanReg
    );

    if (existingIdx !== -1) {
      results[existingIdx] = result;
    } else {
      results.push(result);
    }

    // Recalculate ranking for this quiz
    const rankedForQuiz = this.calculateRanking(
      results.filter((r) => r.quizId === result.quizId)
    );

    // Merge ranked back into full list
    const otherResults = results.filter((r) => r.quizId !== result.quizId);
    const finalResults = [...otherResults, ...rankedForQuiz];

    setLocalItem(STORAGE_KEYS.RESULTS, finalResults);
    notifyChange('results');

    // Return the ranked version of this result
    const saved = rankedForQuiz.find(
      (r) => r.studentRegNo.toUpperCase().replace(/\s+/g, '') === cleanReg
    );
    return saved || result;
  }

  public deleteResult(id: string): void {
    const results = this.getResults().filter((r) => r.id !== id);
    setLocalItem(STORAGE_KEYS.RESULTS, results);
    if (firebaseReady) {
      void deleteFirebaseDocument('results', id).catch((error) => {
        console.error('Firebase result deletion failed:', error);
      });
      void logAdminAction('delete', 'result', id).catch((error) =>
        console.error('Firebase result audit logging failed:', error)
      );
    }
    notifyChange('results');
  }

  public deleteResultsByQuiz(quizId: string): void {
    const results = this.getResults().filter((r) => r.quizId !== quizId);
    setLocalItem(STORAGE_KEYS.RESULTS, results);
    notifyChange('results');
  }

  public calculateRanking(quizResults: Result[]): Result[] {
    // Sort descending by score, then percentage, then earlier submission time
    const sorted = [...quizResults].sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (b.percentage !== a.percentage) {
        return b.percentage - a.percentage;
      }
      return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
    });

    // Assign standard ranking (1, 2, 3...)
    return sorted.map((res, index) => ({
      ...res,
      rank: index + 1,
    }));
  }

  public getRankSuffix(rank: number): string {
    const j = rank % 10;
    const k = rank % 100;
    if (j === 1 && k !== 11) return `${rank}st`;
    if (j === 2 && k !== 12) return `${rank}nd`;
    if (j === 3 && k !== 13) return `${rank}rd`;
    return `${rank}th`;
  }

  // ==================== CONFIG & GRADING SCALE ====================
  public getConfig(): SystemConfig {
    return getLocalItem<SystemConfig>(STORAGE_KEYS.CONFIG, INITIAL_CONFIG);
  }

  public updateGradingScale(scale: GradeBoundary[]): void {
    const cfg = this.getConfig();
    cfg.gradingScale = scale;
    setLocalItem(STORAGE_KEYS.CONFIG, cfg);
    notifyChange('config');
  }

  public calculateGrade(percentage: number): { grade: string; description: string } {
    const config = this.getConfig();
    const boundaries = config.gradingScale || DEFAULT_GRADING_SCALE;

    // Boundaries sorted descending by minPercent
    const sorted = [...boundaries].sort((a, b) => b.minPercent - a.minPercent);
    for (const b of sorted) {
      if (percentage >= b.minPercent) {
        return { grade: b.grade, description: b.description };
      }
    }
    return { grade: 'F', description: 'Fail' };
  }

  // ==================== NOTIFICATIONS ====================
  public getNotifications(): NotificationItem[] {
    return getLocalItem<NotificationItem[]>(
      STORAGE_KEYS.NOTIFICATIONS,
      INITIAL_NOTIFICATIONS
    );
  }

  public addNotification(item: NotificationItem): void {
    const list = this.getNotifications();
    list.unshift(item);
    setLocalItem(STORAGE_KEYS.NOTIFICATIONS, list);
    notifyChange('notifications');
  }

  public deleteNotification(id: string): void {
    const list = this.getNotifications().filter((n) => n.id !== id);
    setLocalItem(STORAGE_KEYS.NOTIFICATIONS, list);
    notifyChange('notifications');
  }

  // Multi-tab listener subscription
  public subscribe(callback: (resource: string) => void): () => void {
    if (typeof window === 'undefined') return () => {};

    const customHandler = (e: Event) => {
      const custom = e as CustomEvent<{ resource: string }>;
      callback(custom.detail?.resource || 'all');
    };

    const storageHandler = (e: StorageEvent) => {
      if (e.key && Object.values(STORAGE_KEYS).includes(e.key)) {
        callback(e.key);
      }
    };

    window.addEventListener(CBT_CHANGE_EVENT, customHandler);
    window.addEventListener('storage', storageHandler);

    return () => {
      window.removeEventListener(CBT_CHANGE_EVENT, customHandler);
      window.removeEventListener('storage', storageHandler);
    };
  }
}

export const cbtStorage = new CBTStorageService();
