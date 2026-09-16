import {
  Attempt,
  Course,
  GradeBoundary,
  NotificationItem,
  Question,
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
  INITIAL_QUIZZES,
  INITIAL_RESULTS,
  INITIAL_STUDENTS,
} from './seedData';

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
};

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
  void persistToLocalBackend(key, value);
}

function setLocalItemWithoutSync<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error saving remote ${key} cache:`, err);
  }
}

const BACKEND_RESOURCE_BY_KEY: Record<string, string> = {
  [STORAGE_KEYS.STUDENTS]: 'students',
  [STORAGE_KEYS.COURSES]: 'courses',
  [STORAGE_KEYS.QUIZZES]: 'quizzes',
  [STORAGE_KEYS.ATTEMPTS]: 'attempts',
  [STORAGE_KEYS.RESULTS]: 'results',
  [STORAGE_KEYS.NOTIFICATIONS]: 'notifications',
  [STORAGE_KEYS.CONFIG]: 'config',
};
const STORAGE_KEY_BY_BACKEND_RESOURCE = Object.fromEntries(
  Object.entries(BACKEND_RESOURCE_BY_KEY).map(([key, resource]) => [resource, key])
) as Record<string, string>;
let localSocket: WebSocket | null = null;
let reconnectTimer: number | null = null;
const clientId =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
const pendingWrites = new Map<string, Promise<void>>();

async function persistToLocalBackend(key: string, value: unknown): Promise<void> {
  const resource = BACKEND_RESOURCE_BY_KEY[key];
  if (!resource || typeof window === 'undefined') return;

  try {
    const previousWrite = pendingWrites.get(resource) || Promise.resolve();
    const nextWrite = previousWrite.then(async () => {
      const response = await fetch(`/api/storage/${resource}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-client-id': clientId },
        body: JSON.stringify(value),
      });
      if (!response.ok) {
        throw new Error(`Local backend returned HTTP ${response.status}`);
      }
    });
    pendingWrites.set(resource, nextWrite);
    await nextWrite;
    if (pendingWrites.get(resource) === nextWrite) pendingWrites.delete(resource);
  } catch (error) {
    console.error(`Local JSON persistence failed for ${resource}:`, error);
  }
}

function connectToLocalBackend(): void {
  if (typeof window === 'undefined' || localSocket) return;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  localSocket = new WebSocket(`${protocol}//${window.location.host}/ws`);

  localSocket.onmessage = (event) => {
    const message = JSON.parse(String(event.data)) as {
      type?: string;
      resource?: string;
      value?: unknown;
      source?: string | null;
    };
    if (message.type !== 'storage-updated' || !message.resource || message.source === clientId) return;
    const key = STORAGE_KEY_BY_BACKEND_RESOURCE[message.resource];
    if (!key) return;
    setLocalItemWithoutSync(key, message.value);
    notifyChange(message.resource);
  };
  localSocket.onclose = () => {
    localSocket = null;
    if (reconnectTimer === null) {
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connectToLocalBackend();
      }, 1000);
    }
  };
  localSocket.onerror = () => localSocket?.close();
}

/**
 * Repository Service Layer
 * Repository service backed by the local JSON API:
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

  public async hydrateFromLocalBackend(): Promise<void> {
    const resources = [
      ['STUDENTS', 'students', INITIAL_STUDENTS],
      ['COURSES', 'courses', INITIAL_COURSES],
      ['QUIZZES', 'quizzes', INITIAL_QUIZZES],
      ['ATTEMPTS', 'attempts', {}],
      ['RESULTS', 'results', INITIAL_RESULTS],
      ['NOTIFICATIONS', 'notifications', INITIAL_NOTIFICATIONS],
      ['CONFIG', 'config', INITIAL_CONFIG],
    ] as const;
    try {
      const loaded = await Promise.all(
        resources.map(async ([keyName, resource, fallback]) => {
          const response = await fetch(`/api/storage/${resource}`);
          if (!response.ok) throw new Error(`Local backend returned HTTP ${response.status}`);
          const value = await response.json();
          return [keyName, value.items, fallback] as const;
        })
      );
      loaded.forEach(([keyName, value, fallback]) => {
        const hasData = Array.isArray(value) ? value.length > 0 : Object.keys(value || {}).length > 0;
        setLocalItemWithoutSync(STORAGE_KEYS[keyName], hasData ? value : fallback);
      });
      notifyChange('all');
      connectToLocalBackend();
    } catch (error) {
      console.error('Local JSON hydration failed; continuing with cached data:', error);
    }
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
    notifyChange('students');
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
    notifyChange('courses');
  }

  public async keepOnlyPhil101(): Promise<void> {
    const phil101 =
      this.getCourses().find((course) => course.code.toUpperCase() === 'PHIL 101') ||
      INITIAL_COURSES[0];
    setLocalItem(STORAGE_KEYS.COURSES, [phil101]);
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
    notifyChange('quizzes');
  }

  public async uploadClassListToLocalBackend(): Promise<void> {
    await persistToLocalBackend(STORAGE_KEYS.STUDENTS, this.getStudents());
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
      const parsedDate = new Date(`${date}T${startTime}`);
      if (!Number.isNaN(parsedDate.getTime())) {
        q.scheduledDateTime = parsedDate.toISOString();
        q.endDateTime = new Date(parsedDate.getTime() + durationMinutes * 60000).toISOString();
      }
      this.updateQuiz(q);
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
    }
  }

  public updateQuestion(quizId: string, question: Question): void {
    const quiz = this.getQuizById(quizId);
    if (quiz) {
      const idx = quiz.questions.findIndex((q) => q.id === question.id);
      if (idx !== -1) {
        quiz.questions[idx] = question;
        this.updateQuiz(quiz);
      }
    }
  }

  public deleteQuestion(quizId: string, questionId: string): void {
    const quiz = this.getQuizById(quizId);
    if (quiz) {
      quiz.questions = quiz.questions.filter((q) => q.id !== questionId);
      quiz.totalQuestions = quiz.questions.length;
      this.updateQuiz(quiz);
    }
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
