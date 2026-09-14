export interface Student {
  sn: number;
  name: string;
  regNo: string;
  level: string;
  faculty: string;
  campus: string;
  class: string;
  email?: string;
  phone?: string;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  description: string;
  creditUnits: number;
  semester: string;
  lecturer: string;
}

export type OptionKey = 'A' | 'B' | 'C' | 'D';

export interface Question {
  id: string;
  questionText: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: OptionKey;
  explanation?: string;
}

export type QuizStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';

export interface Quiz {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  title: string;
  totalQuestions: number;
  durationMinutes: number;
  date: string;
  startTime: string;
  scheduledDateTime: string; // ISO string
  endDateTime?: string; // ISO string; prevents new students joining after the host deadline
  status: QuizStatus;
  questions: Question[];
  instructions: string;
  createdAt: string;
}

export interface Attempt {
  id: string;
  quizId: string;
  studentRegNo: string;
  studentName: string;
  startedAt: number; // Unix timestamp in ms
  durationSeconds: number;
  timeRemainingSeconds: number;
  answers: Record<string, OptionKey>;
  flaggedQuestions: string[];
  isSubmitted: boolean;
  submittedAt?: number;
}

export interface Result {
  id: string;
  quizId: string;
  quizTitle: string;
  courseCode: string;
  courseTitle: string;
  studentRegNo: string;
  studentName: string;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  unanswered: number;
  score: number;
  percentage: number;
  grade: string;
  rank?: number;
  submittedAt: string;
  submissionType: 'early' | 'auto_timer';
  answers: Record<string, OptionKey>;
}

export interface GradeBoundary {
  grade: string;
  minPercent: number;
  maxPercent: number;
  points?: number;
  description: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  date: string;
  type: 'quiz_schedule' | 'exam_alert' | 'general' | 'result';
  targetCourse?: string;
}

export interface SystemConfig {
  institution: string;
  campus: string;
  faculty: string;
  academicSession: string;
  gradingScale: GradeBoundary[];
  syncMode: 'localStorage' | 'firestore_ready';
}
