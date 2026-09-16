import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Bell,
  Play,
  Award,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  User,
  GraduationCap,
  RotateCcw,
  Zap,
  Flame,
  Star,
  Gamepad2,
  Trophy,
} from 'lucide-react';
import { Attempt, Course, NotificationItem, Quiz, Result, Student } from '../types';
import { DEFAULT_PRACTICE_DRAW, cbtStorage } from '../services/storage';

interface StudentDashboardProps {
  student: Student;
  onStartQuiz: (quiz: Quiz) => void;
  onStartPractice: (course: Course) => void;
  onViewResults: (quizId?: string) => void;
  onViewPastResults: () => void;
  onLogout: () => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  student,
  onStartQuiz,
  onStartPractice,
  onViewResults,
  onViewPastResults,
  onLogout,
}) => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [studentResults, setStudentResults] = useState<Result[]>([]);
  const [ongoingAttempt, setOngoingAttempt] = useState<Attempt | null>(null);
  const [ongoingQuiz, setOngoingQuiz] = useState<Quiz | null>(null);
  const [activeTab, setActiveTab] = useState<'quiz' | 'practice' | 'upcoming' | 'results' | 'notifications'>(
    'quiz'
  );
  const [courses, setCourses] = useState<Course[]>([]);

  const loadData = () => {
    const allQuizzes = cbtStorage.getQuizzes();
    setQuizzes(allQuizzes);
    setCourses(cbtStorage.getCourses());

    const allNotifs = cbtStorage.getNotifications();
    setNotifications(allNotifs);

    const allResults = cbtStorage.getResults();
    const cleanReg = student.regNo.trim().toUpperCase().replace(/\s+/g, '');
    const myResults = allResults.filter(
      (r) => r.studentRegNo.toUpperCase().replace(/\s+/g, '') === cleanReg
    );
    setStudentResults(myResults);

    // Check if student has an ongoing in-progress attempt
    const activeQuiz = allQuizzes.find((q) => q.status === 'active');
    if (activeQuiz) {
      const attempt = cbtStorage.getAttempt(activeQuiz.id, student.regNo);
      if (attempt && !attempt.isSubmitted && attempt.timeRemainingSeconds > 0) {
        setOngoingAttempt(attempt);
        setOngoingQuiz(activeQuiz);
      } else {
        setOngoingAttempt(null);
        setOngoingQuiz(null);
      }
    }
  };

  useEffect(() => {
    loadData();
    // Refresh banks from Firebase so counts are always database-fresh.
    cbtStorage
      .refreshQuestionBanksFromFirebase()
      .then(() => loadData())
      .catch(() => undefined);
    const unsubscribe = cbtStorage.subscribe(() => {
      loadData();
    });
    return unsubscribe;
  }, [student.regNo]);

  // Determine Active Quiz and Upcoming Quiz
  const activeQuiz = quizzes.find((q) => q.status === 'active');
  const upcomingQuizzes = quizzes.filter((q) => q.status === 'scheduled');
  const firstUpcoming = upcomingQuizzes[0] || null;

  // Check if student already submitted this active quiz
  const alreadySubmittedActive = activeQuiz
    ? studentResults.some((r) => r.quizId === activeQuiz.id)
    : false;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Student Identity Card */}
      <div className="bg-[#0b6537] rounded-2xl p-5 sm:p-6 text-white shadow-xl border-l-8 border-[#22c55e] anim-rise anim-glow-pulse anim-shine">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-emerald-200 text-xl font-bold font-serif shadow-inner shrink-0 anim-pop anim-float">
              {student.name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider bg-[#22c55e] text-white px-2 py-0.5 rounded-md font-mono">
                  Candidate Verified
                </span>
                <span className="text-[11px] text-emerald-100">
                  {student.level} &bull; {student.class}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight mt-1 anim-headline">
                {student.name}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-emerald-100 font-mono mt-0.5">
                <span>
                  REG NO: <strong className="text-emerald-200">{student.regNo}</strong>
                </span>
                <span>FACULTY: {student.faculty}</span>
                <span>CAMPUS: {student.campus}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              onClick={onLogout}
              className="px-3.5 py-1.5 rounded-xl bg-[#074625] hover:bg-red-700 text-xs font-semibold text-white border border-emerald-600 transition-colors shadow-xs"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Ongoing In-Progress Exam Alert Banner */}
        {ongoingAttempt && ongoingQuiz && !alreadySubmittedActive && (
          <div className="mt-4 p-3 bg-emerald-500/20 border border-emerald-400/60 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-pulse">
            <div className="flex items-center gap-2.5">
              <RotateCcw className="w-5 h-5 text-emerald-200 shrink-0" />
              <div>
                <p className="text-xs font-bold text-emerald-100">
                  Active Examination In Progress!
                </p>
                <p className="text-[11px] text-white">
                  You have an unfinished attempt for {ongoingQuiz.courseCode}:{' '}
                  {ongoingQuiz.title}. Timer is actively running.
                </p>
              </div>
            </div>
            <button
              onClick={() => onStartQuiz(ongoingQuiz)}
              className="w-full sm:w-auto px-4 py-1.5 bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold text-xs rounded-lg shadow-md transition-all shrink-0 cursor-pointer"
            >
              Resume Exam Now
            </button>
          </div>
        )}
      </div>

      {/* Navigation Tabs - Highly accessible for Android / Mobile */}
      <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar gap-2 sm:gap-4 tabs-playful anim-rise" style={{ '--d': '0.1s' } as React.CSSProperties}>
        <button
          onClick={() => setActiveTab('quiz')}
          className={`pb-3 px-3 text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'quiz'
              ? 'border-[#0b6537] text-[#0b6537]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Active & Upcoming Quiz</span>
          {activeQuiz && (
            <span className="w-2 h-2 rounded-full bg-[#0b6537] animate-ping"></span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('practice')}
          className={`pb-3 px-3 text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'practice'
              ? 'border-[#0b6537] text-[#0b6537]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Gamepad2 className="w-4 h-4" />
          <span>Practice Arena 🎮</span>
        </button>

        <button
          onClick={() => setActiveTab('upcoming')}
          className={`pb-3 px-3 text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'upcoming'
              ? 'border-[#0b6537] text-[#0b6537]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Schedule ({upcomingQuizzes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('results')}
          className={`pb-3 px-3 text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'results'
              ? 'border-[#0b6537] text-[#0b6537]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>My Results ({studentResults.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('notifications')}
          className={`pb-3 px-3 text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'notifications'
              ? 'border-[#0b6537] text-[#0b6537]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Updates & Notifications ({notifications.length})</span>
        </button>
      </div>

      {/* TAB 1: QUIZ SECTION (Main Requirement) */}
      {activeTab === 'quiz' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Quiz Area (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            {activeQuiz ? (
              <div className="bg-white rounded-2xl p-6 shadow-md border-2 border-[#0b6537] relative overflow-hidden anim-gradient-border anim-rise">
                <div className="absolute top-0 right-0 bg-[#0b6537] text-white text-[11px] font-bold px-4 py-1 rounded-bl-xl uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>
                  Quiz Available
                </div>

                <div className="flex items-center gap-2 text-xs font-semibold text-[#0b6537] uppercase tracking-wider font-mono">
                  <span>{activeQuiz.courseCode}</span>
                  <span>&bull;</span>
                  <span>{activeQuiz.courseTitle}</span>
                </div>

                <h2 className="text-xl font-bold text-slate-900 mt-2">
                  {activeQuiz.title}
                </h2>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5 stagger-rise">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                      Duration
                    </span>
                    <span className="text-base font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                      <Clock className="w-4 h-4 text-[#0b6537]" />
                      {activeQuiz.durationMinutes} Mins
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                      Questions
                    </span>
                    <span className="text-base font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                      <FileText className="w-4 h-4 text-[#0b6537]" />
                      {activeQuiz.questions.length} Items
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                      Day
                    </span>
                    <span className="text-base font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                      <Calendar className="w-4 h-4 text-[#0b6537]" />
                      {activeQuiz.date}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                      Start Time
                    </span>
                    <span className="text-base font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                      <Clock className="w-4 h-4 text-[#0b6537]" />
                      {activeQuiz.startTime}
                    </span>
                  </div>
                </div>

                {/* Instructions */}
                <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200 text-xs text-emerald-900 space-y-1.5 mb-6 anim-rise" style={{ '--d': '0.25s' } as React.CSSProperties}>
                  <p className="font-bold flex items-center gap-1 text-emerald-950">
                    <ShieldCheck className="w-4 h-4 text-[#0b6537]" />
                    Important Examination Instructions:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-emerald-800">
                    <li>The exam duration is strictly {activeQuiz.durationMinutes} minutes.</li>
                    <li>Questions will automatically submit when the timer reaches 00:00.</li>
                    <li>Your progress is continuously saved in your browser.</li>
                    <li>Do not navigate away or close the browser window during testing.</li>
                  </ul>
                </div>

                {alreadySubmittedActive ? (
                  <div className="p-4 bg-slate-100 rounded-xl border border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <CheckCircle2 className="w-5 h-5 text-[#0b6537]" />
                      <span>You have already submitted this examination.</span>
                    </div>
                    <button
                      onClick={() => onViewResults(activeQuiz.id)}
                      className="px-4 py-2 bg-[#0b6537] hover:bg-[#074625] text-white rounded-xl text-xs font-bold transition-all shadow"
                    >
                      View Examination Results
                    </button>
                  </div>
                ) : (
                  <button
                    id="startCbtQuizBtn"
                    onClick={() => onStartQuiz(activeQuiz)}
                    className="w-full py-4 bg-[#0b6537] hover:bg-[#074625] active:bg-[#063b20] text-white font-bold text-base rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 text-center cursor-pointer anim-shine"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    <span>Enter & Start Examination ({activeQuiz.questions.length} Questions)</span>
                  </button>
                )}
              </div>
            ) : (
              /* When no active quiz is available */
              <div className="bg-white rounded-2xl p-8 shadow-md border border-slate-200 text-center space-y-4">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                  <BookOpen className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">
                  No quiz is currently available.
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  There is no active computer-based examination open right now.
                  Please consult the official examination timetable below.
                </p>

                {firstUpcoming && (
                  <div className="mt-6 text-left max-w-md mx-auto p-5 bg-emerald-50 border border-emerald-300 rounded-2xl shadow-xs">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 uppercase tracking-wider mb-2">
                      <Calendar className="w-4 h-4 text-emerald-700" />
                      UPCOMING QUIZ
                    </div>
                    <div className="space-y-1.5 text-xs text-slate-800">
                      <p>
                        <strong className="text-slate-600">Course:</strong>{' '}
                        <span className="font-semibold text-emerald-900">
                          {firstUpcoming.courseCode} - {firstUpcoming.courseTitle}
                        </span>
                      </p>
                      <p>
                        <strong className="text-slate-600">Quiz:</strong>{' '}
                        <span>{firstUpcoming.title}</span>
                      </p>
                      <p>
                        <strong className="text-slate-600">Date:</strong>{' '}
                        <span>{firstUpcoming.date}</span>
                      </p>
                      <p>
                        <strong className="text-slate-600">Time:</strong>{' '}
                        <span>{firstUpcoming.startTime}</span>
                      </p>
                      <p>
                        <strong className="text-slate-600">Duration:</strong>{' '}
                        <span>{firstUpcoming.durationMinutes} Minutes</span>
                      </p>
                    </div>
                    <div className="mt-3 pt-3 border-t border-emerald-200 flex items-center justify-between text-[11px] text-emerald-900 font-medium">
                      <span>Status: Scheduled by Admin</span>
                      <span className="italic">Available at official start time</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Sidebar: Updates and Quick Actions */}
          <div className="space-y-6 stagger-rise">
            {/* Quick Result Summary Card */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 card-lift">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-emerald-700" />
                  Recent Submissions
                </h3>
                <button
                  onClick={onViewPastResults}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline"
                >
                  View All
                </button>
              </div>

              {studentResults.length > 0 ? (
                <div className="space-y-2.5">
                  {studentResults.slice(0, 3).map((res) => (
                    <div
                      key={res.id}
                      onClick={() => onViewResults(res.quizId)}
                      className="p-3 bg-slate-50 hover:bg-emerald-50/50 border border-slate-200 rounded-xl cursor-pointer transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] font-mono font-semibold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                            {res.courseCode}
                          </span>
                          <h4 className="text-xs font-semibold text-slate-800 mt-1 line-clamp-1">
                            {res.quizTitle}
                          </h4>
                        </div>
                        <span className="text-sm font-bold text-emerald-800">
                          Grade {res.grade}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
                        <span>
                          Score: {res.score}/{res.totalQuestions} ({res.percentage.toFixed(1)}%)
                        </span>
                        <span>Rank #{res.rank || '-'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-slate-400">
                  No completed quizzes yet.
                </div>
              )}
            </div>

            {/* Official Updates Widget */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-[#0b6537]" />
                  Official Announcements
                </h3>
                <span className="text-[11px] font-mono text-slate-400">
                  {notifications.length}
                </span>
              </div>

              <div className="space-y-3">
                {notifications.slice(0, 3).map((notif) => (
                  <div
                    key={notif.id}
                    className="p-3 bg-slate-50 rounded-xl border-l-4 border-emerald-700 text-xs space-y-1"
                  >
                    <div className="flex justify-between items-center text-[10px] text-slate-400">
                      <span className="font-semibold text-emerald-800 uppercase">
                        {notif.targetCourse || 'FACULTY NOTICE'}
                      </span>
                      <span>{notif.date}</span>
                    </div>
                    <p className="font-bold text-slate-800">{notif.title}</p>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      {notif.message}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRACTICE ARENA TAB */}
      {activeTab === 'practice' && (
        <div className="space-y-5 arena-enter">
          <div className="arena-card rounded-3xl p-5 sm:p-6 relative overflow-hidden">
            <div className="arena-orb arena-orb-a" />
            <div className="arena-orb arena-orb-b" />
            <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                  <Gamepad2 className="w-6 h-6 text-lime-300" />
                  Practice Arena
                </h2>
                <p className="text-xs text-white/70 mt-1">
                  Pick a course — each run draws a fresh random set from the question bank.
                  Earn XP, build streaks, and master every topic! 🚀
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="arena-chip">
                  <Star className="w-3.5 h-3.5 text-amber-300" />
                  {cbtStorage.getStudentXp(student.regNo)} XP
                </span>
                <span className="arena-chip">
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                  {cbtStorage.getPracticeHistory(student.regNo).length} runs
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {courses.map((course, i) => {
              const bankCount = cbtStorage.getBankQuestionCount(course.id);
              const draw = Math.min(
                cbtStorage.getQuestionBankByCourse(course.id)?.questionsPerAttempt ||
                  DEFAULT_PRACTICE_DRAW,
                bankCount
              );
              const myRuns = cbtStorage
                .getPracticeHistory(student.regNo)
                .filter((h) => h.courseId === course.id);
              const best = myRuns.reduce((m, h) => Math.max(m, h.percentage), 0);
              return (
                <div
                  key={course.id}
                  className="practice-course-card rounded-3xl p-5 relative overflow-hidden"
                  style={{ animationDelay: `${i * 0.08}s` }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-mono font-bold bg-emerald-900/80 text-lime-200 px-2.5 py-1 rounded-lg">
                      {course.code}
                    </span>
                    <span className="text-[11px] font-bold text-white/80 bg-white/10 px-2.5 py-1 rounded-full">
                      📚 {bankCount} in bank
                    </span>
                  </div>
                  <h3 className="mt-2 text-base font-black text-white">{course.title}</h3>
                  <p className="text-[11px] text-white/60 mt-0.5">
                    {course.lecturer || 'Faculty Board'} • {course.creditUnits} units
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-white/70">
                    <span className="flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-amber-300" /> {draw} random/run
                    </span>
                    {myRuns.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Trophy className="w-3.5 h-3.5 text-lime-300" /> Best: {best.toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => onStartPractice(course)}
                    disabled={bankCount === 0}
                    className="mt-4 w-full btn-arena text-sm px-4 py-3 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    {bankCount === 0 ? 'No Questions Yet' : `Play ${draw} Random Questions`}
                  </button>
                </div>
              );
            })}
            {courses.length === 0 && (
              <div className="col-span-2 text-center py-12 text-slate-400 text-xs">
                No courses available yet.
              </div>
            )}
          </div>

          {/* Recent practice history */}
          {cbtStorage.getPracticeHistory(student.regNo).length > 0 && (
            <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-700" /> My Practice History
              </h3>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 font-semibold">
                      <th className="p-2.5 rounded-l-lg">Course</th>
                      <th className="p-2.5 text-center">Score</th>
                      <th className="p-2.5 text-center">Grade</th>
                      <th className="p-2.5 text-center">XP</th>
                      <th className="p-2.5 text-right rounded-r-lg">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cbtStorage.getPracticeHistory(student.regNo).slice(0, 8).map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-mono font-bold text-emerald-800">{h.courseCode}</td>
                        <td className="p-2.5 text-center font-bold">
                          {h.correctAnswers}/{h.totalQuestions} ({h.percentage.toFixed(1)}%)
                        </td>
                        <td className="p-2.5 text-center font-black text-emerald-700">{h.grade}</td>
                        <td className="p-2.5 text-center font-mono text-amber-600">+{h.xpEarned}</td>
                        <td className="p-2.5 text-right text-slate-400">
                          {new Date(h.completedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: UPCOMING QUIZZES */}
      {activeTab === 'upcoming' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              Examination Timetable & Upcoming Tests
            </h2>
            <p className="text-xs text-slate-500">
              Scheduled examinations for 400-Level UNEC Law Class.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcomingQuizzes.map((q, i) => (
              <div
                key={q.id}
                style={{ '--d': `${i * 0.08}s` } as React.CSSProperties}
                className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 relative overflow-hidden hover:border-emerald-500 transition-colors card-lift anim-rise"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                      {q.courseCode}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-1.5">
                      {q.title}
                    </h3>
                    <p className="text-xs text-slate-500">{q.courseTitle}</p>
                  </div>
                  <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full">
                    Scheduled
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">DAY</span>
                    <span className="font-semibold">{q.date}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">TIME</span>
                    <span className="font-semibold">{q.startTime}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">DURATION</span>
                    <span className="font-semibold">{q.durationMinutes} Minutes</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">QUESTIONS</span>
                    <span className="font-semibold">{q.questions.length} Multiple Choice</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 italic">
                  Quiz activates automatically at the designated start time.
                </p>
              </div>
            ))}

            {upcomingQuizzes.length === 0 && (
              <div className="col-span-2 text-center py-12 text-slate-400 text-xs">
                No upcoming quizzes scheduled at this time.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PAST RESULTS */}
      {activeTab === 'results' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                My Examination Results
              </h2>
              <p className="text-xs text-slate-500">
                Official Computer-Based Test scores and ranks recorded under Registration Number{' '}
                <span className="font-mono font-bold text-emerald-800">{student.regNo}</span>.
              </p>
            </div>
            <button
              onClick={onViewPastResults}
              className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-semibold self-start sm:self-center transition-colors"
            >
              Browse Full Class Results
            </button>
          </div>

          {studentResults.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                    <th className="p-3">Course</th>
                    <th className="p-3">Quiz Title</th>
                    <th className="p-3 text-center">Score</th>
                    <th className="p-3 text-center">Percentage</th>
                    <th className="p-3 text-center">Grade</th>
                    <th className="p-3 text-center">Class Rank</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {studentResults.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-semibold text-emerald-800">
                        {r.courseCode}
                      </td>
                      <td className="p-3 font-medium text-slate-900">{r.quizTitle}</td>
                      <td className="p-3 text-center font-bold">
                        {r.score}/{r.totalQuestions}
                      </td>
                      <td className="p-3 text-center font-semibold">
                        {r.percentage.toFixed(1)}%
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold text-xs ${
                            r.grade === 'A'
                              ? 'bg-emerald-100 text-emerald-800'
                              : r.grade === 'B'
                              ? 'bg-blue-100 text-blue-800'
                              : r.grade === 'C'
                              ? 'bg-teal-100 text-teal-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {r.grade}
                        </span>
                      </td>
                      <td className="p-3 text-center font-semibold text-slate-700">
                        {r.rank ? `${r.rank}${r.rank === 1 ? 'st' : r.rank === 2 ? 'nd' : r.rank === 3 ? 'rd' : 'th'}` : '-'}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => onViewResults(r.quizId)}
                          className="px-3 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-lg text-[11px] font-semibold transition-colors"
                        >
                          View Result Slip
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 text-xs">
              No results recorded yet. Complete an active test to generate your official score sheet.
            </div>
          )}
        </div>
      )}

      {/* TAB 4: UPDATES & NOTIFICATIONS */}
      {activeTab === 'notifications' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              Departmental Notices & Bulletins
            </h2>
            <p className="text-xs text-slate-500">
              Real-time administrative broadcast for Faculty of Law students.
            </p>
          </div>

          <div className="space-y-3">
            {notifications.map((n) => (
              <div
                key={n.id}
                className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5"
              >
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <span className="font-bold text-emerald-800 uppercase tracking-wider">
                    {n.targetCourse || 'ANNOUNCEMENT'}
                  </span>
                  <span>{n.date}</span>
                </div>
                <h3 className="text-sm font-bold text-slate-900">{n.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
