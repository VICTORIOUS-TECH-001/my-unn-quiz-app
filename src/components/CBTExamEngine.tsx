import React, { useEffect, useRef, useState } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Flag,
  ChevronLeft,
  ChevronRight,
  Send,
  HelpCircle,
  Bookmark,
  Shield,
  User,
  RotateCcw,
} from 'lucide-react';
import { Attempt, OptionKey, Question, Quiz, Result, Student } from '../types';
import { cbtStorage } from '../services/storage';
import { UNNLogo } from './UNNLogo';
import { firebaseNow } from '../services/firebase';

interface CBTExamEngineProps {
  quiz: Quiz;
  student: Student;
  onFinish: (result: Result) => void;
  onCancel: () => void;
}

export const CBTExamEngine: React.FC<CBTExamEngineProps> = ({
  quiz,
  student,
  onFinish,
  onCancel,
}) => {
  const questions = quiz.questions;
  const totalQuestions = questions.length;

  // Initialize or restore attempt state
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, OptionKey>>({});
  const [flagged, setFlagged] = useState<string[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<number>(quiz.durationMinutes * 60);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [autoSubmitFired, setAutoSubmitFired] = useState<boolean>(false);
  const [filterMode, setFilterMode] = useState<'all' | 'answered' | 'unanswered' | 'flagged'>('all');

  // Anti-cheating & recovery refs
  const timerRef = useRef<number | null>(null);
  const isSubmittingRef = useRef<boolean>(false);
  isSubmittingRef.current = isSubmitting;

  // Load existing attempt or create new attempt on mount
  useEffect(() => {
    // Check if result already exists for this student & quiz
    const existingResult = cbtStorage.getResultByStudent(quiz.id, student.regNo);
    if (existingResult) {
      alert('You have already submitted this examination. Directing to official results.');
      onFinish(existingResult);
      return;
    }

    const savedAttempt = cbtStorage.getAttempt(quiz.id, student.regNo);
    const totalDurationSeconds = quiz.durationMinutes * 60;

    if (savedAttempt && !savedAttempt.isSubmitted) {
      // Restore answers and flags
      setAnswers(savedAttempt.answers || {});
      setFlagged(savedAttempt.flaggedQuestions || []);

      // Calculate elapsed real time since started
      const elapsedSeconds = Math.floor((firebaseNow() - savedAttempt.startedAt) / 1000);
      const remaining = Math.max(0, totalDurationSeconds - elapsedSeconds);
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        // Time expired while away
        handleSubmitExam('auto_timer');
        return;
      }
    } else {
      // Fresh new attempt
      const newAttempt: Attempt = {
        id: `att_${quiz.id}_${firebaseNow()}`,
        quizId: quiz.id,
        studentRegNo: student.regNo,
        studentName: student.name,
        startedAt: firebaseNow(),
        durationSeconds: totalDurationSeconds,
        timeRemainingSeconds: totalDurationSeconds,
        answers: {},
        flaggedQuestions: [],
        isSubmitted: false,
      };
      cbtStorage.saveAttempt(newAttempt);
      setTimeRemaining(totalDurationSeconds);
    }

    // Anti-cheating: Prevent accidental back navigation / window close
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isSubmittingRef.current) {
        e.preventDefault();
        e.returnValue = 'You have an active examination in progress. Answers may be lost if you leave.';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [quiz.id, student.regNo]);

  // Main countdown timer effect
  useEffect(() => {
    timerRef.current = window.setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          if (!isSubmittingRef.current) {
            setAutoSubmitFired(true);
            handleSubmitExam('auto_timer');
          }
          return 0;
        }

        const next = prev - 1;
        // Persist time periodically to localStorage
        const attempt = cbtStorage.getAttempt(quiz.id, student.regNo);
        if (attempt && !attempt.isSubmitted) {
          attempt.timeRemainingSeconds = next;
          cbtStorage.saveAttempt(attempt);
        }
        return next;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [quiz.id, student.regNo]);

  // Save current answers whenever they change
  const handleSelectOption = (option: OptionKey) => {
    if (timeRemaining <= 0 || isSubmitting) return;

    const currentQ = questions[currentIdx];
    if (!currentQ) return;

    const updatedAnswers = {
      ...answers,
      [currentQ.id]: option,
    };
    setAnswers(updatedAnswers);

    // Save attempt continuously to localStorage
    const attempt = cbtStorage.getAttempt(quiz.id, student.regNo);
    if (attempt) {
      attempt.answers = updatedAnswers;
      cbtStorage.saveAttempt(attempt);
    }
  };

  // Toggle flag for question
  const handleToggleFlag = () => {
    const currentQ = questions[currentIdx];
    if (!currentQ) return;

    let updatedFlags: string[];
    if (flagged.includes(currentQ.id)) {
      updatedFlags = flagged.filter((id) => id !== currentQ.id);
    } else {
      updatedFlags = [...flagged, currentQ.id];
    }
    setFlagged(updatedFlags);

    const attempt = cbtStorage.getAttempt(quiz.id, student.regNo);
    if (attempt) {
      attempt.flaggedQuestions = updatedFlags;
      cbtStorage.saveAttempt(attempt);
    }
  };

  // Keyboard navigation for power users
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in text fields
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        showConfirmModal
      ) {
        return;
      }

      const key = e.key.toUpperCase();
      if (key === 'A' || key === '1') handleSelectOption('A');
      else if (key === 'B' || key === '2') handleSelectOption('B');
      else if (key === 'C' || key === '3') handleSelectOption('C');
      else if (key === 'D' || key === '4') handleSelectOption('D');
      else if (key === 'N' || key === 'ARROWDOWN' || key === 'ARROWRIGHT') {
        if (currentIdx < totalQuestions - 1) setCurrentIdx((prev) => prev + 1);
      } else if (key === 'P' || key === 'ARROWUP' || key === 'ARROWLEFT') {
        if (currentIdx > 0) setCurrentIdx((prev) => prev - 1);
      } else if (key === 'F') {
        handleToggleFlag();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIdx, totalQuestions, showConfirmModal, answers, flagged]);

  // Core Result Calculation and Submission
  const handleSubmitExam = (submissionType: 'early' | 'auto_timer') => {
    if (isSubmittingRef.current) return;
    setIsSubmitting(true);
    isSubmittingRef.current = true;
    setShowConfirmModal(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // 1. Calculate score & grades
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;

    questions.forEach((q) => {
      const studentAns = answers[q.id];
      if (!studentAns) {
        unansweredCount++;
      } else if (studentAns === q.correctAnswer) {
        correctCount++;
      } else {
        wrongCount++;
      }
    });

    const score = correctCount;
    const percentage = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
    const { grade } = cbtStorage.calculateGrade(percentage);

    // 2. Mark attempt as submitted
    const attempt = cbtStorage.getAttempt(quiz.id, student.regNo);
    if (attempt) {
      attempt.isSubmitted = true;
      attempt.submittedAt = firebaseNow();
      attempt.timeRemainingSeconds = 0;
      cbtStorage.saveAttempt(attempt);
    }

    // 3. Construct official result object
    const newResult: Result = {
      id: `res_${quiz.id}_${student.regNo.replace(/[^a-zA-Z0-9]/g, '_')}`,
      quizId: quiz.id,
      quizTitle: quiz.title,
      courseCode: quiz.courseCode,
      courseTitle: quiz.courseTitle,
      studentRegNo: student.regNo,
      studentName: student.name,
      totalQuestions,
      correctAnswers: correctCount,
      wrongAnswers: wrongCount,
      unanswered: unansweredCount,
      score,
      percentage: Number(percentage.toFixed(2)),
      grade,
      submittedAt: new Date().toISOString(),
      submissionType,
      answers,
    };

    // 4. Save and auto-rank
    const savedResult = cbtStorage.saveResult(newResult);

    // 5. Navigate to results
    setTimeout(() => {
      onFinish(savedResult);
    }, 400);
  };

  // Format timer MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentQ = questions[currentIdx] || null;
  const currentAnswer = currentQ ? answers[currentQ.id] : undefined;
  const isCurrentFlagged = currentQ ? flagged.includes(currentQ.id) : false;

  const answeredCount = Object.keys(answers).length;
  const unansweredCount = totalQuestions - answeredCount;
  const flaggedCount = flagged.length;

  // Filter questions for the grid
  const filteredQuestionIndexes = questions
    .map((q, idx) => ({ q, idx }))
    .filter(({ q, idx }) => {
      if (filterMode === 'answered') return !!answers[q.id];
      if (filterMode === 'unanswered') return !answers[q.id];
      if (filterMode === 'flagged') return flagged.includes(q.id);
      return true;
    });

  // Timer status styling
  const isUrgent = timeRemaining <= 300; // <= 5 mins
  const isCritical = timeRemaining <= 60; // <= 1 min

  return (
    <div className="min-h-screen bg-transparent flex flex-col arena-enter">
      {/* Official CBT Top Bar */}
      <div className="bg-[#0b6537] text-white px-4 py-3 shadow-md border-b-4 border-[#22c55e] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Candidate & Course Identity */}
          <div className="flex items-center gap-3">
            <UNNLogo size="sm" showText={false} />
            <div>
              <div className="text-xs font-mono font-bold text-emerald-200">
                {quiz.courseCode}: {quiz.courseTitle}
              </div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span>{student.name}</span>
                <span className="text-xs font-mono text-emerald-200">
                  ({student.regNo})
                </span>
              </div>
            </div>
          </div>

          {/* Real-time University CBT Countdown Timer */}
          <div className="flex items-center gap-3">
            <div
              className={`px-4 py-1.5 rounded-xl border-2 flex items-center gap-2 shadow-inner font-mono font-black text-lg sm:text-xl transition-all ${
                isCritical
                  ? 'bg-red-600 text-white border-red-300 animate-bounce'
                  : isUrgent
                  ? 'bg-red-700 text-white border-red-400 animate-pulse'
                  : 'bg-[#074625] text-white border-[#22c55e]'
              }`}
              title="Official CBT Countdown Timer"
            >
              <Clock className="w-5 h-5 text-[#22c55e]" />
              <span>{formatTime(timeRemaining)}</span>
            </div>

            <button
              id="submitCbtExamBtn"
              onClick={() => setShowConfirmModal(true)}
              disabled={isSubmitting}
              className="px-4 py-2 bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 shrink-0 cursor-pointer anim-shine"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit Exam</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Examination Stage */}
      <div className="max-w-7xl mx-auto w-full p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1">
        {/* Left 3 Columns: Active Question Card */}
        <div className="lg:col-span-3 flex flex-col space-y-4">
          {currentQ ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 flex-1 flex flex-col justify-between">
              <div>
                {/* Question Metadata Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold bg-emerald-50 text-[#0b6537] border border-emerald-200 px-3 py-1 rounded-lg">
                      Question {currentIdx + 1} of {totalQuestions}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">1 Mark</span>
                  </div>

                  <button
                    onClick={handleToggleFlag}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      isCurrentFlagged
                        ? 'bg-purple-100 text-purple-800 border border-purple-300'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    <Bookmark
                      className={`w-3.5 h-3.5 ${isCurrentFlagged ? 'fill-current' : ''}`}
                    />
                    <span>{isCurrentFlagged ? 'Flagged for Review' : 'Flag Question'}</span>
                  </button>
                </div>

                {/* Question Body */}
                <div className="py-6">
                  <h3 className="text-base sm:text-lg font-serif font-bold text-slate-900 leading-relaxed">
                    {currentQ.questionText}
                  </h3>
                </div>

                {/* Multiple Choice Options (A, B, C, D) */}
                <div className="space-y-3 pt-2">
                  {(['A', 'B', 'C', 'D'] as OptionKey[]).map((optKey) => {
                    const optText = currentQ.options[optKey];
                    if (!optText) return null;
                    const isSelected = currentAnswer === optKey;

                    return (
                      <div
                        key={optKey}
                        onClick={() => handleSelectOption(optKey)}
                        className={`exam-option p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3.5 ${
                          isSelected
                            ? 'bg-[#0b6537]/10 border-[#0b6537] shadow-sm'
                            : 'bg-white hover:bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-[#0b6537] text-white'
                              : 'bg-slate-100 text-slate-700 border border-slate-300'
                          }`}
                        >
                          {optKey}
                        </div>
                        <div className="flex-1 text-xs sm:text-sm font-medium text-slate-800 pt-1 leading-relaxed">
                          {optText}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Navigation Controls Bar */}
              <div className="pt-8 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 mt-6">
                <button
                  onClick={() => setCurrentIdx((prev) => Math.max(0, prev - 1))}
                  disabled={currentIdx === 0}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous (P)</span>
                </button>

                <div className="flex items-center gap-2">
                  {currentAnswer && (
                    <button
                      onClick={() => {
                        const copy = { ...answers };
                        delete copy[currentQ.id];
                        setAnswers(copy);
                        const att = cbtStorage.getAttempt(quiz.id, student.regNo);
                        if (att) {
                          att.answers = copy;
                          cbtStorage.saveAttempt(att);
                        }
                      }}
                      className="text-xs text-slate-400 hover:text-red-600 underline font-medium px-2 py-1"
                    >
                      Clear Choice
                    </button>
                  )}

                  {currentIdx === totalQuestions - 1 ? (
                    <button
                      onClick={() => setShowConfirmModal(true)}
                      className="px-6 py-2.5 rounded-xl bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold text-xs flex items-center gap-1.5 shadow cursor-pointer"
                    >
                      <span>Review & Submit</span>
                      <Send className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        setCurrentIdx((prev) => Math.min(totalQuestions - 1, prev + 1))
                      }
                      className="px-6 py-2.5 rounded-xl bg-[#0b6537] hover:bg-[#074625] text-white font-bold text-xs flex items-center gap-1.5 shadow"
                    >
                      <span>Next Question (N)</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-8 text-center text-slate-400">
              No questions found for this examination.
            </div>
          )}
        </div>

        {/* Right 1 Column: Question Jump Grid (70 questions) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Question Navigator ({totalQuestions})
            </h4>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0b6537]"></span>
                Answered: {answeredCount}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-200 border border-slate-300"></span>
                Left: {unansweredCount}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                Flagged: {flaggedCount}
              </span>
            </div>
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex rounded-lg bg-slate-100 p-1 text-[11px] font-semibold text-slate-600">
            <button
              onClick={() => setFilterMode('all')}
              className={`flex-1 py-1 rounded-md transition-colors ${
                filterMode === 'all' ? 'bg-white shadow-xs text-[#0b6537]' : ''
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterMode('answered')}
              className={`flex-1 py-1 rounded-md transition-colors ${
                filterMode === 'answered' ? 'bg-white shadow-xs text-[#0b6537]' : ''
              }`}
            >
              Answered
            </button>
            <button
              onClick={() => setFilterMode('unanswered')}
              className={`flex-1 py-1 rounded-md transition-colors ${
                filterMode === 'unanswered' ? 'bg-white shadow-xs text-[#0b6537]' : ''
              }`}
            >
              Left
            </button>
            <button
              onClick={() => setFilterMode('flagged')}
              className={`flex-1 py-1 rounded-md transition-colors ${
                filterMode === 'flagged' ? 'bg-white shadow-xs text-[#0b6537]' : ''
              }`}
            >
              Flags
            </button>
          </div>

          {/* The 70 Questions Interactive Grid */}
          <div className="flex-1 overflow-y-auto max-h-[500px] pr-1">
            <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-5 gap-2">
              {filteredQuestionIndexes.map(({ q, idx }) => {
                const isAnswered = !!answers[q.id];
                const isFlag = flagged.includes(q.id);
                const isCurrent = idx === currentIdx;

                let btnStyle = 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200';
                if (isAnswered) {
                  btnStyle = 'bg-[#0b6537] text-white font-bold border-[#074625] shadow-xs';
                }
                if (isFlag) {
                  btnStyle = isAnswered
                    ? 'bg-purple-700 text-white font-bold border-purple-900'
                    : 'bg-purple-100 text-purple-800 border-purple-400 font-bold';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIdx(idx)}
                    className={`h-9 text-xs rounded-lg border font-mono relative flex items-center justify-center transition-all ${btnStyle} ${
                      isCurrent ? 'ring-2 ring-blue-500 ring-offset-2 scale-105 z-10' : ''
                    }`}
                    title={`Question ${idx + 1} (${
                      isAnswered ? 'Answered: ' + answers[q.id] : 'Unanswered'
                    }${isFlag ? ' - Flagged' : ''})`}
                  >
                    <span>{idx + 1}</span>
                    {isFlag && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] absolute top-1 right-1"></span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Legend and Keyboard Guide */}
          <div className="pt-3 border-t border-slate-100 text-[10px] text-slate-400 space-y-1">
            <p>
              Keyboard: <kbd className="px-1 bg-slate-100 rounded border">A</kbd>,{' '}
              <kbd className="px-1 bg-slate-100 rounded border">B</kbd>,{' '}
              <kbd className="px-1 bg-slate-100 rounded border">C</kbd>,{' '}
              <kbd className="px-1 bg-slate-100 rounded border">D</kbd> to select option.
            </p>
            <p>
              <kbd className="px-1 bg-slate-100 rounded border">N</kbd> for Next,{' '}
              <kbd className="px-1 bg-slate-100 rounded border">P</kbd> for Previous,{' '}
              <kbd className="px-1 bg-slate-100 rounded border">F</kbd> to Flag.
            </p>
          </div>
        </div>
      </div>

      {/* Early Submission Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border-2 border-emerald-700 animate-scaleIn">
            <div className="flex items-center gap-3 text-emerald-800">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-[#0b6537]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Submit Examination?
                </h3>
                <p className="text-xs text-slate-500">
                  Are you sure you want to submit your quiz now?
                </p>
              </div>
            </div>

            {/* Summary statistics */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block">Total Questions</span>
                <span className="font-bold text-slate-800">{totalQuestions}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Answered Questions</span>
                <span className="font-bold text-emerald-700">{answeredCount}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Unanswered Questions</span>
                <span className="font-bold text-red-600">{unansweredCount}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Time Remaining</span>
                <span className="font-bold font-mono text-slate-800">
                  {formatTime(timeRemaining)}
                </span>
              </div>
            </div>

            {unansweredCount > 0 && (
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900">
                Notice: You have <strong>{unansweredCount} unanswered questions</strong>. You will
                not be able to modify your answers once submitted.
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
              >
                Return to Exam
              </button>
              <button
                type="button"
                id="confirmEarlySubmitBtn"
                onClick={() => handleSubmitExam('early')}
                className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl shadow-md"
              >
                Yes, Submit Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto Submission Overlay (When 00:00 reached) */}
      {autoSubmitFired && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto text-red-600 animate-pulse">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Time Expired (00:00)
            </h3>
            <p className="text-xs text-slate-600">
              Official examination duration has concluded. Your test responses are being
              automatically submitted and graded...
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
