import React, { useState, useEffect } from 'react';
import { UNNLogo } from './UNNLogo';
import {
  LogIn,
  AlertCircle,
  Clock,
  Timer,
} from 'lucide-react';
import { Student, Quiz } from '../types';
import { cbtStorage } from '../services/storage';
import { formatWATDate, formatWATTime } from '../services/watTime';
import { firebaseNow } from '../services/firebase';

interface StudentLoginProps {
  onLoginSuccess: (student: Student) => void;
  onGoToAdmin?: () => void;
}

interface CountdownState {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  totalMs: number;
}

function calculateCountdown(targetDateStr: string): CountdownState {
  const target = new Date(targetDateStr).getTime();
  const now = firebaseNow();
  const diff = target - now;

  if (isNaN(target) || diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true, totalMs: 0 };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return { days, hours, minutes, seconds, isExpired: false, totalMs: diff };
}

export const StudentLogin: React.FC<StudentLoginProps> = ({
  onLoginSuccess,
  onGoToAdmin,
}) => {
  const [regNo, setRegNo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string>('');
  const [countdown, setCountdown] = useState<CountdownState>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
    totalMs: 0,
  });

  // Load quizzes and setup listeners
  useEffect(() => {
    const loadQuizData = () => {
      const allQuizzes = cbtStorage.getQuizzes();
      // Filter active or scheduled quizzes
      const available = allQuizzes.filter(
        (q) => q.status === 'scheduled' || q.status === 'active'
      );
      setQuizzes(available.length > 0 ? available : allQuizzes);

      // Prefer upcoming scheduled quiz or active quiz
      if (available.length > 0) {
        const scheduled = available.find((q) => q.status === 'scheduled');
        const active = available.find((q) => q.status === 'active');
        setSelectedQuizId((prev) => {
          if (prev && available.some((q) => q.id === prev)) return prev;
          return scheduled ? scheduled.id : active ? active.id : available[0].id;
        });
      } else if (allQuizzes.length > 0) {
        setSelectedQuizId(allQuizzes[0].id);
      }
    };

    loadQuizData();

    const handleStorageChange = () => loadQuizData();
    window.addEventListener('cbt_data_change', handleStorageChange);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('cbt_data_change', handleStorageChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Selected quiz reference
  const currentQuiz = quizzes.find((q) => q.id === selectedQuizId) || quizzes[0];
  const quizEndTime = currentQuiz?.endDateTime
    ? new Date(currentQuiz.endDateTime).getTime()
    : currentQuiz
      ? new Date(currentQuiz.scheduledDateTime).getTime() + currentQuiz.durationMinutes * 60000
      : 0;
  const isQuizOver = Boolean(currentQuiz && quizEndTime <= firebaseNow());

  // Live countdown timer ticking every second
  useEffect(() => {
    if (!currentQuiz) return;

    const updateTimer = () => {
      const scheduledTime = currentQuiz.scheduledDateTime || new Date().toISOString();
      const state = calculateCountdown(scheduledTime);
      setCountdown(state);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [currentQuiz]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = regNo.trim();
    if (!trimmed) {
      setError('Please enter your candidate registration number.');
      return;
    }
    if (isQuizOver) {
      setError('This quiz is over and no new students can enter.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const student = cbtStorage.getStudentByRegNo(trimmed);
      if (!student) {
        setError(
          'Registration number not found. Please verify your registration number or contact the administrator.'
        );
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
      onLoginSuccess(student);
    }, 250);
  };

  return (
    <div className="min-h-[calc(100vh-140px)] py-6 px-4 sm:px-6 flex flex-col justify-center bg-transparent arena-enter relative overflow-hidden">
      {/* Floating study emojis */}
      <span className="float-shape text-4xl top-8 left-4 sm:left-10" style={{ '--d': '0s' } as React.CSSProperties}>🎓</span>
      <span className="float-shape text-3xl top-24 right-6 sm:right-14" style={{ '--d': '1.2s' } as React.CSSProperties}>📚</span>
      <span className="float-shape text-3xl bottom-24 left-8 sm:left-20" style={{ '--d': '2s' } as React.CSSProperties}>⚡</span>
      <span className="float-shape text-4xl bottom-10 right-8 sm:right-20" style={{ '--d': '0.6s' } as React.CSSProperties}>🎯</span>
      <div className="max-w-4xl mx-auto w-full relative">
        {/* Announcement ticker */}
        <div className="ticker-bar rounded-full px-4 py-1.5 mb-4 text-[11px] font-bold text-lime-200 anim-rise">
          <div className="anim-ticker-track gap-10 whitespace-nowrap">
            {[0, 1].map((copy) => (
              <span key={copy} className="flex gap-10 pr-10">
                <span>🎮 Practice Arena is OPEN — fresh 70 questions every run</span>
                <span>🎧 Focus music keeps you concentrated</span>
                <span>📚 Question banks now live for every course</span>
                <span>🏆 Earn XP & build streaks as you study</span>
              </span>
            ))}
          </div>
        </div>
        {/* Main 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
          {/* Column 1: Upcoming Quiz Showcase & Live Countdown Timer */}
          <div className="md:col-span-7 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden flex flex-col anim-rise card-lift" style={{ '--d': '0.1s' } as React.CSSProperties}>
            {/* Header with Official UNN Crest */}
            <div className="bg-[#0b6537] px-4 py-3 sm:px-5 sm:py-3.5 text-white border-b-2 border-[#22c55e]">
              <div className="flex items-center justify-between gap-3">
                <UNNLogo
                  size="sm"
                  showText={true}
                  subText="to restore the dignity of man"
                  textColor="text-white"
                />
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#074625] border border-[#22c55e]/40 rounded-full text-[10px] font-mono font-bold text-emerald-200 shrink-0">
                  <Clock className="w-3 h-3 text-[#22c55e]" />
                  <span>CBT SCHEDULE</span>
                </div>
              </div>
            </div>

            {/* Quiz Selector tabs if multiple upcoming */}
            {quizzes.length > 1 && (
              <div className="bg-emerald-50/70 border-b border-emerald-100 px-4 py-1.5 flex items-center gap-1.5 overflow-x-auto">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 shrink-0">
                  Quiz:
                </span>
                {quizzes.map((q) => {
                  const isSel = q.id === selectedQuizId;
                  return (
                    <button
                      key={q.id}
                      onClick={() => setSelectedQuizId(q.id)}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer hover-grow ${
                        isSel
                          ? 'bg-[#0b6537] text-white shadow-xs'
                          : 'bg-white text-slate-700 hover:bg-emerald-100/80 border border-slate-200'
                      }`}
                    >
                      {q.courseCode}
                      {q.status === 'active' && (
                        <span className="ml-1 w-1.5 h-1.5 inline-block rounded-full bg-[#22c55e] animate-pulse"></span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Featured Quiz Information */}
            {currentQuiz && (
              <div className="p-4 sm:p-5 space-y-3.5">
                {/* Course identity */}
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-0.5 bg-[#0b6537] text-white font-mono font-bold text-[11px] rounded">
                      {currentQuiz.courseCode}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        currentQuiz.status === 'active'
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-slate-100 text-slate-700 border border-slate-300'
                      }`}
                    >
                      {currentQuiz.status === 'active' ? '🟢 Exam Active Now' : '📅 Scheduled Exam'}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {formatWATDate(currentQuiz.scheduledDateTime, currentQuiz.date)} &bull; {formatWATTime(currentQuiz.scheduledDateTime, currentQuiz.startTime)} WAT
                    </span>
                  </div>

                  <div>
                    <h2 className="text-base font-bold text-slate-900 leading-snug">
                      {currentQuiz.courseTitle}
                    </h2>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {currentQuiz.title}
                    </p>
                  </div>
                </div>

                {/* COUNTDOWN TO LOGIN DISPLAY */}
                <div className="bg-[#074625] rounded-xl p-3.5 text-white border border-[#22c55e]/40 shadow-inner space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-emerald-200 text-[10px] font-mono font-bold uppercase tracking-wider">
                      <Timer className="w-3.5 h-3.5 text-[#22c55e] animate-pulse" />
                      <span>
                        {isQuizOver
                          ? 'Login Status: Closed'
                          : currentQuiz.status === 'active' || countdown.isExpired
                          ? 'Login Status: Ready'
                          : 'Countdown to Exam Login'}
                      </span>
                    </div>
                    {currentQuiz.status === 'active' && (
                      <span className="live-badge">● LIVE</span>
                    )}
                  </div>

                  {/* Digit Blocks */}
                  {isQuizOver ? (
                  <div className="p-2.5 bg-slate-800 rounded-lg border border-slate-600 text-center space-y-0.5">
                    <div className="text-xl sm:text-2xl font-black text-white tracking-wide font-mono">
                      QUIZ OVER
                    </div>
                    <p className="text-[11px] text-slate-300 font-medium">
                      The exam entry period has ended.
                    </p>
                  </div>
                  ) : currentQuiz.status === 'active' || countdown.isExpired ? (
                    <div className="p-2.5 bg-[#0b6537] rounded-lg border border-[#22c55e]/50 text-center space-y-0.5">
                      <div className="text-xl sm:text-2xl font-black text-white tracking-wide font-mono">
                        PORTAL OPEN FOR LOGIN
                      </div>
                      <p className="text-[11px] text-emerald-200 font-medium">
                        The examination room is active. Enter your registration number to start.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2 text-center stagger-rise">
                      <div className="bg-[#0b6537] p-2 rounded-lg border border-emerald-700/60 shadow-xs">
                        <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white">
                          {String(countdown.days).padStart(2, '0')}
                        </div>
                        <div className="text-[9px] uppercase tracking-wider text-emerald-200 font-bold mt-0.5">
                          Days
                        </div>
                      </div>
                      <div className="bg-[#0b6537] p-2 rounded-lg border border-emerald-700/60 shadow-xs">
                        <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white">
                          {String(countdown.hours).padStart(2, '0')}
                        </div>
                        <div className="text-[9px] uppercase tracking-wider text-emerald-200 font-bold mt-0.5">
                          Hours
                        </div>
                      </div>
                      <div className="bg-[#0b6537] p-2 rounded-lg border border-emerald-700/60 shadow-xs">
                        <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white">
                          {String(countdown.minutes).padStart(2, '0')}
                        </div>
                        <div className="text-[9px] uppercase tracking-wider text-emerald-200 font-bold mt-0.5">
                          Mins
                        </div>
                      </div>
                      <div className="bg-[#0b6537] p-2 rounded-lg border border-[#22c55e]/40 shadow-xs ring-1 ring-[#22c55e]/30">
                        <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-[#22c55e]">
                          {String(countdown.seconds).padStart(2, '0')}
                        </div>
                        <div className="text-[9px] uppercase tracking-wider text-emerald-200 font-bold mt-0.5">
                          Secs
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Exam Key Metrics - Compact div and small font */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5 stagger-rise">
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-center">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                      Questions
                    </span>
                    <span className="text-xs font-bold text-slate-800 block mt-0.5">
                      {currentQuiz.totalQuestions} Questions
                    </span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-center">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                      Time Allowed
                    </span>
                    <span className="text-xs font-bold text-slate-800 block mt-0.5">
                      {currentQuiz.durationMinutes} Mins
                    </span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-center">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                      Passing Grade
                    </span>
                    <span className="text-xs font-bold text-[#0b6537] block mt-0.5">
                      50% (Grade C)
                    </span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-center">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                      Assessment
                    </span>
                    <span className="text-xs font-bold text-slate-800 block mt-0.5">
                      CBT Objective
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Column 2: Candidate Login Form - Compact, Smart, No Demo Buttons */}
          <div className="md:col-span-5 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden flex flex-col anim-rise card-lift" style={{ '--d': '0.22s' } as React.CSSProperties}>
            {/* Login Card Header */}
            <div className="p-4 text-center border-b-2 border-[#0b6537] bg-white">
              <div className="flex justify-center mb-2 anim-bounce-soft">
                <UNNLogo
                  size="md"
                  showText={false}
                  textColor="text-[#0b6537]"
                />
              </div>
              <h2 className="text-lg font-bold tracking-tight text-[#0b6537]">
                Candidate Exam Login
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                Enter your UNN registration number to access the CBT assessment.
              </p>
            </div>

            {/* Login Form Body */}
            <div className="p-4 sm:p-5 space-y-4">
              {error && (
                <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Verification Failed</p>
                    <p className="mt-0.5 text-[11px]">{error}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-3.5">
                <div>
                  <label
                    htmlFor="candidateRegNo"
                    className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                  >
                    Candidate Registration Number
                  </label>
                  <div className="relative">
                    <input
                      id="candidateRegNo"
                      type="text"
                      value={regNo}
                      onChange={(e) => {
                        setRegNo(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="e.g. 2025/298761"
                      autoFocus
                      autoComplete="off"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#0b6537] focus:ring-2 focus:ring-[#0b6537]/20 outline-none transition-all uppercase"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Format: YYYY/NNNNNN (e.g. 2025/298761)
                  </span>
                </div>

                <button
                  type="submit"
                  id="studentLoginSubmitBtn"
                  disabled={isLoading || isQuizOver}
                  className="w-full py-2.5 px-4 bg-[#0b6537] hover:bg-[#074625] active:scale-[0.99] text-white font-bold text-sm rounded-lg transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 anim-shine"
                >
                  {isQuizOver ? (
                    <span>Quiz Over</span>
                  ) : isLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Enter Examination</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
