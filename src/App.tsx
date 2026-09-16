import React, { useEffect, useState } from 'react';
import { LoaderCircle, ShieldCheck } from 'lucide-react';
import { cbtStorage } from './services/storage';
import { Course, Quiz, Result, Student } from './types';
import { Navbar } from './components/Navbar';
import { StudentLogin } from './components/StudentLogin';
import { StudentDashboard } from './components/StudentDashboard';
import { CBTExamEngine } from './components/CBTExamEngine';
import { ResultView } from './components/ResultView';
import { PastResults } from './components/PastResults';
import { AdminPortal } from './components/AdminPortal';
import { PracticeEngine } from './components/PracticeEngine';
import { MusicToggle } from './components/MusicToggle';

type AppView = 'login' | 'dashboard' | 'exam' | 'practice' | 'results' | 'past-results' | 'admin';

const ACTIVE_STUDENT_KEY = 'unn_cbt_active_student_session';

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>('login');
  const [currentStudent, setCurrentStudent] = useState<Student | null>(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_STUDENT_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [activeResult, setActiveResult] = useState<Result | null>(null);
  const [practiceCourse, setPracticeCourse] = useState<Course | null>(null);
  const [isDataReady, setIsDataReady] = useState(false);

  // If student was already logged in on initial load, navigate to dashboard
  useEffect(() => {
    void cbtStorage.hydrateFromFirebase().finally(() => setIsDataReady(true));
    if (currentStudent && currentView === 'login') {
      setCurrentView('dashboard');
    }
  }, []);

  if (!isDataReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-white to-emerald-50 px-6">
        <div className="w-full max-w-sm rounded-3xl border border-emerald-100 bg-white/90 p-8 text-center shadow-xl shadow-emerald-900/10 backdrop-blur-sm">
          <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center">
            <div className="absolute inset-0 animate-ping rounded-full bg-emerald-100/70" />
            <div className="absolute inset-2 animate-spin rounded-full border-4 border-emerald-100 border-t-[#0b6537]" />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0b6537] text-white shadow-lg">
              <ShieldCheck className="h-7 w-7" />
            </div>
          </div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">
            Preparing your CBT portal
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Securely loading exams, questions, schedules, and results from Firebase.
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 text-xs font-semibold text-emerald-800">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            <span>Connecting to Firebase</span>
          </div>
          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-emerald-100">
            <div className="h-full w-1/2 animate-[loading_1.4s_ease-in-out_infinite] rounded-full bg-[#0b6537]" />
          </div>
        </div>
      </div>
    );
  }

  const handleLoginSuccess = (student: Student) => {
    setCurrentStudent(student);
    try {
      localStorage.setItem(ACTIVE_STUDENT_KEY, JSON.stringify(student));
    } catch (e) {
      console.error(e);
    }
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    setCurrentStudent(null);
    try {
      localStorage.removeItem(ACTIVE_STUDENT_KEY);
    } catch (e) {
      console.error(e);
    }
    setActiveQuiz(null);
    setActiveResult(null);
    setCurrentView('login');
  };

  const handleStartQuiz = (quiz: Quiz) => {
    setActiveQuiz(quiz);
    setCurrentView('exam');
  };

  const handleStartPractice = (course: Course) => {
    setPracticeCourse(course);
    setCurrentView('practice');
  };

  const handleExamFinish = (result: Result) => {
    setActiveResult(result);
    // Locate quiz
    const quiz = cbtStorage.getQuizById(result.quizId);
    if (quiz) {
      setActiveQuiz(quiz);
    }
    setCurrentView('results');
  };

  const handleViewResults = (quizId?: string) => {
    const targetId = quizId || activeQuiz?.id || cbtStorage.getQuizzes()[0]?.id;
    if (targetId) {
      const quiz = cbtStorage.getQuizById(targetId);
      if (quiz) {
        setActiveQuiz(quiz);
        // Look up student's result if any
        if (currentStudent) {
          const res = cbtStorage.getResultByStudent(quiz.id, currentStudent.regNo);
          setActiveResult(res || null);
        } else {
          setActiveResult(null);
        }
        setCurrentView('results');
      }
    }
  };

  return (
    <div className="app-shell min-h-screen flex flex-col font-sans text-slate-800 antialiased selection:bg-emerald-800 selection:text-white">
      {/* Animated ambient background */}
      <div className="ambient-bg" aria-hidden="true">
        <span className="ambient-blob blob-1" />
        <span className="ambient-blob blob-2" />
        <span className="ambient-blob blob-3" />
        <span className="ambient-grid" />
      </div>
      {/* Do not show standard Navbar during active exam session to prevent distraction */}
      {(currentView !== 'exam' && currentView !== 'practice') && (
        <Navbar
          currentStudent={currentStudent}
          currentView={currentView}
          onNavigate={(view) => {
            if (view === 'dashboard' && !currentStudent) {
              setCurrentView('login');
            } else {
              setCurrentView(view);
            }
          }}
          onLogout={handleLogout}
        />
      )}

      {/* Main Content Router */}
      <main className="flex-1 relative z-10">
        {currentView === 'login' && (
          <StudentLogin
            onLoginSuccess={handleLoginSuccess}
            onGoToAdmin={() => setCurrentView('admin')}
          />
        )}

        {currentView === 'dashboard' && currentStudent && (
          <StudentDashboard
            student={currentStudent}
            onStartQuiz={handleStartQuiz}
            onStartPractice={handleStartPractice}
            onViewResults={handleViewResults}
            onViewPastResults={() => setCurrentView('past-results')}
            onLogout={handleLogout}
          />
        )}

        {currentView === 'exam' && activeQuiz && currentStudent && (
          <CBTExamEngine
            quiz={activeQuiz}
            student={currentStudent}
            onFinish={handleExamFinish}
            onCancel={() => setCurrentView('dashboard')}
          />
        )}

        {currentView === 'practice' && practiceCourse && currentStudent && (
          <PracticeEngine
            course={practiceCourse}
            student={currentStudent}
            onExit={() => setCurrentView('dashboard')}
          />
        )}

        {currentView === 'results' && activeQuiz && (
          <ResultView
            quiz={activeQuiz}
            currentStudent={currentStudent}
            activeResult={activeResult}
            onBackToDashboard={() => setCurrentView(currentStudent ? 'dashboard' : 'admin')}
            onSelectOtherQuiz={() => setCurrentView('past-results')}
          />
        )}

        {currentView === 'past-results' && (
          <PastResults
            currentStudent={currentStudent}
            onSelectQuiz={(quiz) => {
              setActiveQuiz(quiz);
              if (currentStudent) {
                const res = cbtStorage.getResultByStudent(quiz.id, currentStudent.regNo);
                setActiveResult(res || null);
              } else {
                setActiveResult(null);
              }
              setCurrentView('results');
            }}
            onBack={() => setCurrentView(currentStudent ? 'dashboard' : 'admin')}
          />
        )}

        {currentView === 'admin' && (
          <AdminPortal
            onBackToStudentPortal={() => {
              if (currentStudent) {
                setCurrentView('dashboard');
              } else {
                setCurrentView('login');
              }
            }}
            onViewQuizResults={(quizId) => {
              const q = cbtStorage.getQuizById(quizId);
              if (q) {
                setActiveQuiz(q);
                setActiveResult(null);
                setCurrentView('results');
              }
            }}
          />
        )}
      </main>

      {/* Copyright Footer (Hidden during printing or active exam/practice) */}
      {(currentView !== 'exam' && currentView !== 'practice') && (
        <footer className="print:hidden relative z-10 glass-footer text-slate-200 text-xs py-4 border-t border-white/10 text-center">
          <div className="max-w-7xl mx-auto px-4">
            <p className="font-medium tracking-wide">
              Copyright &copy; {new Date().getFullYear()} victorious tech institute .com
              <span className="mx-2 opacity-40">•</span>
              <span className="text-lime-200/80">🎮 Practice Arena • 🎧 Focus Music</span>
            </p>
          </div>
        </footer>
      )}

      {/* Global focus-music controller */}
      <MusicToggle />
    </div>
  );
}
