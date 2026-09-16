import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Flame,
  Home,
  Lightbulb,
  Play,
  RotateCcw,
  Sparkles,
  Star,
  Target,
  Trophy,
  XCircle,
  Zap,
} from 'lucide-react';
import { Course, OptionKey, Question, Student } from '../types';
import { DEFAULT_PRACTICE_DRAW, cbtStorage } from '../services/storage';
import { focusMusic } from '../services/music';

interface PracticeEngineProps {
  course: Course;
  student: Student;
  onExit: () => void;
}

type Phase = 'setup' | 'playing' | 'finished';

/**
 * Practice Arena: each run draws a fresh random set (default 70) from the
 * course question bank. Gamified with XP, streaks, instant feedback and review.
 */
export const PracticeEngine: React.FC<PracticeEngineProps> = ({
  course,
  student,
  onExit,
}) => {
  const bankSize = cbtStorage.getBankQuestionCount(course.id);
  const perAttempt =
    cbtStorage.getQuestionBankByCourse(course.id)?.questionsPerAttempt ||
    DEFAULT_PRACTICE_DRAW;

  const [phase, setPhase] = useState<Phase>('setup');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, OptionKey>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [flagged, setFlagged] = useState<string[]>([]);
  const [instantFeedback, setInstantFeedback] = useState(true);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [xp, setXp] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [showNavigator, setShowNavigator] = useState(false);
  const [cheer, setCheer] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  const total = questions.length;
  const answeredCount = Object.keys(answers).length;
  const currentQ = questions[currentIdx] || null;

  const progress = total > 0 ? Math.round((answeredCount / total) * 100) : 0;

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  const flashCheer = (msg: string) => {
    setCheer(msg);
    window.setTimeout(() => setCheer(null), 1800);
  };

  const startPractice = () => {
    const drawn = cbtStorage.drawRandomQuestions(course.id);
    if (drawn.length === 0) return;
    setQuestions(drawn);
    setCurrentIdx(0);
    setAnswers({});
    setRevealed({});
    setFlagged([]);
    setStreak(0);
    setBestStreak(0);
    setXp(0);
    setElapsed(0);
    startRef.current = Date.now();
    setPhase('playing');
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
  };

  const finishPractice = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    let correct = 0;
    questions.forEach((q) => {
      if (answers[q.id] === q.correctAnswer) correct += 1;
    });
    const pct = total > 0 ? (correct / total) * 100 : 0;
    const { grade } = cbtStorage.calculateGrade(pct);
    const bonus = bestStreak >= 10 ? 50 : bestStreak >= 5 ? 20 : 0;
    const totalXp = xp + bonus + (grade === 'A' ? 30 : grade === 'B' ? 15 : 0);
    setXp(totalXp);
    cbtStorage.savePracticeHistory({
      id: `practice_${Date.now()}`,
      courseId: course.id,
      courseCode: course.code,
      courseTitle: course.title,
      studentRegNo: student.regNo,
      totalQuestions: total,
      correctAnswers: correct,
      percentage: Number(pct.toFixed(2)),
      grade,
      xpEarned: totalXp,
      bestStreak,
      completedAt: new Date().toISOString(),
      durationSeconds: elapsed,
    });
    focusMusic.sfx('finish');
    setPhase('finished');
  };

  const handleSelect = (opt: OptionKey) => {
    if (!currentQ || phase !== 'playing') return;
    if (answers[currentQ.id] && instantFeedback) return; // locked after reveal
    const updated = { ...currentQ ? { ...answers, [currentQ.id]: opt } : answers };
    setAnswers(updated);
    const isCorrect = opt === currentQ.correctAnswer;
    if (instantFeedback) {
      setRevealed((r) => ({ ...r, [currentQ.id]: true }));
      if (isCorrect) {
        focusMusic.sfx('correct');
        const newStreak = streak + 1;
        setStreak(newStreak);
        setBestStreak((b) => Math.max(b, newStreak));
        const gained = 10 + Math.min(newStreak * 2, 20);
        setXp((x) => x + gained);
        if (newStreak === 5) flashCheer('🔥 5 in a row! On fire!');
        else if (newStreak === 10) flashCheer('⚡ 10 streak! Unstoppable!');
        else if (newStreak === 20) flashCheer('👑 20 streak! Legend!');
        else if (newStreak % 3 === 0) flashCheer(`+${gained} XP ✨`);
      } else {
        focusMusic.sfx('wrong');
        setStreak(0);
      }
    }
  };

  const score = useMemo(() => {
    let correct = 0;
    questions.forEach((q) => {
      if (answers[q.id] === q.correctAnswer) correct += 1;
    });
    return correct;
  }, [answers, questions]);

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  /* ---------------- SETUP PHASE ---------------- */
  if (phase === 'setup') {
    const history = cbtStorage.getPracticeHistory(student.regNo).filter((h) => h.courseId === course.id);
    const totalXp = cbtStorage.getStudentXp(student.regNo);
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 arena-enter">
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 text-xs font-semibold text-white/80 hover:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        <div className="arena-card rounded-3xl p-6 sm:p-10 text-center relative overflow-hidden">
          <div className="arena-orb arena-orb-a" />
          <div className="arena-orb arena-orb-b" />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[11px] font-bold text-lime-200 uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5" /> Practice Arena
            </div>
            <h1 className="mt-3 text-2xl sm:text-4xl font-black text-white tracking-tight">
              {course.code}: <span className="text-gradient-gold">{course.title}</span>
            </h1>
            <p className="mt-2 text-sm text-white/70 max-w-lg mx-auto">
              Every run shuffles <strong className="text-white">{Math.min(perAttempt, bankSize)} fresh random questions</strong> from
              a bank of <strong className="text-white">{bankSize}</strong> — plus shuffled options. No two practices are the same!
            </p>

            <div className="mt-6 grid grid-cols-3 gap-3 max-w-md mx-auto">
              <div className="arena-stat">
                <Target className="w-5 h-5 mx-auto text-lime-300" />
                <div className="mt-1 text-xl font-black text-white">{Math.min(perAttempt, bankSize)}</div>
                <div className="text-[10px] uppercase tracking-wider text-white/60">Questions</div>
              </div>
              <div className="arena-stat">
                <Star className="w-5 h-5 mx-auto text-amber-300" />
                <div className="mt-1 text-xl font-black text-white">{totalXp}</div>
                <div className="text-[10px] uppercase tracking-wider text-white/60">Total XP</div>
              </div>
              <div className="arena-stat">
                <Trophy className="w-5 h-5 mx-auto text-emerald-300" />
                <div className="mt-1 text-xl font-black text-white">{history.length}</div>
                <div className="text-[10px] uppercase tracking-wider text-white/60">Runs</div>
              </div>
            </div>

            <label className="mt-6 inline-flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-white/80 bg-white/10 border border-white/15 rounded-full px-4 py-2">
              <button
                role="switch"
                aria-checked={instantFeedback}
                onClick={() => setInstantFeedback((v) => !v)}
                className={`w-10 h-5.5 h-6 rounded-full relative transition-colors ${instantFeedback ? 'bg-lime-400' : 'bg-white/20'}`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${instantFeedback ? 'left-[18px]' : 'left-0.5'}`}
                />
              </button>
              Instant feedback + explanations
            </label>

            <div className="mt-6">
              <button
                onClick={startPractice}
                disabled={bankSize === 0}
                className="btn-arena text-base px-10 py-4 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Play className="w-5 h-5 fill-current" /> Start Practice Run
              </button>
              {bankSize === 0 && (
                <p className="mt-3 text-xs text-amber-200">
                  No questions in this bank yet — ask your admin to upload some.
                </p>
              )}
            </div>

            {history.length > 0 && (
              <div className="mt-8 text-left">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white/60 mb-2">
                  Your recent runs
                </h3>
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {history.slice(0, 5).map((h) => (
                    <div key={h.id} className="flex items-center justify-between text-xs bg-white/8 bg-white/10 rounded-xl px-3 py-2">
                      <span className="text-white/80 font-medium">
                        {h.correctAnswers}/{h.totalQuestions} • {h.percentage.toFixed(1)}%
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-lime-200">+{h.xpEarned} XP</span>
                        <span className="font-bold text-amber-300">{h.grade}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- FINISHED PHASE ---------------- */
  if (phase === 'finished') {
    const pct = total > 0 ? (score / total) * 100 : 0;
    const { grade } = cbtStorage.calculateGrade(pct);
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 arena-enter">
        <div className="arena-card rounded-3xl p-6 sm:p-10 text-center relative overflow-hidden">
          <div className="confetti" aria-hidden="true">
            {Array.from({ length: 24 }).map((_, i) => (
              <span key={i} style={{ left: `${(i * 41) % 100}%`, animationDelay: `${(i % 12) * 0.25}s` }} />
            ))}
          </div>
          <div className="relative">
            <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-amber-300 to-orange-500 flex items-center justify-center shadow-2xl pop-in">
              <Trophy className="w-10 h-10 text-white" />
            </div>
            <h1 className="mt-4 text-3xl font-black text-white">Run Complete! 🎉</h1>
            <p className="text-sm text-white/70 mt-1">
              {course.code} • {total} questions in {formatElapsed(elapsed)}
            </p>
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-rise">
              <div className="arena-stat">
                <div className="text-2xl font-black text-white">{score}/{total}</div>
                <div className="text-[10px] uppercase tracking-wider text-white/60">Score</div>
              </div>
              <div className="arena-stat">
                <div className="text-2xl font-black text-lime-300">{pct.toFixed(1)}%</div>
                <div className="text-[10px] uppercase tracking-wider text-white/60">Accuracy</div>
              </div>
              <div className="arena-stat">
                <div className="text-2xl font-black text-amber-300">{grade}</div>
                <div className="text-[10px] uppercase tracking-wider text-white/60">Grade</div>
              </div>
              <div className="arena-stat">
                <div className="text-2xl font-black text-white">+{xp}</div>
                <div className="text-[10px] uppercase tracking-wider text-white/60">XP earned</div>
              </div>
            </div>
            <p className="mt-3 text-xs text-white/60 flex items-center justify-center gap-1.5">
              <Flame className="w-4 h-4 text-orange-400" /> Best streak this run: {bestStreak}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button onClick={startPractice} className="btn-arena text-sm px-6 py-3">
                <RotateCcw className="w-4 h-4" /> New Random {Math.min(perAttempt, bankSize)} — Retry
              </button>
              <button
                onClick={onExit}
                className="px-6 py-3 rounded-full text-sm font-bold text-white bg-white/10 border border-white/20 hover:bg-white/20 transition-all flex items-center gap-2"
              >
                <Home className="w-4 h-4" /> Dashboard
              </button>
            </div>

            {/* Answer review */}
            <div className="mt-8 text-left">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white/60 mb-2 flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4 text-amber-300" /> Review answers & explanations
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {questions.map((q, i) => {
                  const mine = answers[q.id];
                  const ok = mine === q.correctAnswer;
                  return (
                    <div key={q.id} className="bg-white/10 border border-white/10 rounded-xl p-3">
                      <p className="text-xs font-semibold text-white flex items-start gap-2">
                        {ok ? (
                          <CheckCircle2 className="w-4 h-4 text-lime-300 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-300 shrink-0 mt-0.5" />
                        )}
                        <span>Q{i + 1}. {q.questionText}</span>
                      </p>
                      <p className="mt-1.5 ml-6 text-[11px] text-white/70">
                        Your answer: <strong className={ok ? 'text-lime-200' : 'text-red-200'}>{mine ? `${mine}. ${q.options[mine]}` : '— skipped'}</strong>
                        {!ok && (
                          <span className="block">
                            Correct: <strong className="text-lime-200">{q.correctAnswer}. {q.options[q.correctAnswer]}</strong>
                          </span>
                        )}
                      </p>
                      {q.explanation && (
                        <p className="mt-1 ml-6 text-[11px] text-amber-200/90 italic">💡 {q.explanation}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- PLAYING PHASE ---------------- */
  const currentAnswer = currentQ ? answers[currentQ.id] : undefined;
  const isRevealed = currentQ ? !!revealed[currentQ.id] : false;
  const isFlagged = currentQ ? flagged.includes(currentQ.id) : false;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 arena-enter">
      {/* HUD bar */}
      <div className="arena-hud rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
            title="Exit practice"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="text-[10px] font-mono font-bold text-lime-200 uppercase">{course.code} • Practice</div>
            <div className="text-xs font-bold text-white">Q{currentIdx + 1} of {total}</div>
          </div>
        </div>
        <div className="flex-1 min-w-[120px] max-w-xs">
          <div className="arena-progress">
            <div className="arena-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-1 text-[10px] font-mono text-white/60 text-right">{progress}% answered</div>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold">
          <span className="arena-chip">
            <Flame className="w-3.5 h-3.5 text-orange-400" /> {streak}
          </span>
          <span className="arena-chip">
            <Zap className="w-3.5 h-3.5 text-amber-300" /> {xp} XP
          </span>
          <span className="arena-chip font-mono">
            <Clock className="w-3.5 h-3.5 text-sky-300" /> {formatElapsed(elapsed)}
          </span>
        </div>
      </div>

      {cheer && (
        <div className="cheer-pop">{cheer}</div>
      )}

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Question card */}
        <div className="lg:col-span-3">
          {currentQ && (
            <div key={currentQ.id} className="arena-question rounded-3xl p-5 sm:p-7 question-slide">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg">
                  Question {currentIdx + 1} / {total}
                </span>
                <button
                  onClick={() => {
                    if (!currentQ) return;
                    setFlagged((f) =>
                      f.includes(currentQ.id) ? f.filter((id) => id !== currentQ.id) : [...f, currentQ.id]
                    );
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                    isFlagged ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  <Flag className={`w-3.5 h-3.5 ${isFlagged ? 'fill-current' : ''}`} />
                  {isFlagged ? 'Flagged' : 'Flag'}
                </button>
              </div>

              <h2 className="mt-4 text-base sm:text-lg font-bold text-slate-900 leading-relaxed">
                {currentQ.questionText}
              </h2>

              <div className="mt-4 space-y-2.5">
                {(['A', 'B', 'C', 'D'] as OptionKey[]).map((opt) => {
                  const text = currentQ.options[opt];
                  const selected = currentAnswer === opt;
                  const correctOpt = currentQ.correctAnswer === opt;
                  let cls = 'arena-option';
                  if (isRevealed) {
                    if (correctOpt) cls += ' arena-option-correct';
                    else if (selected) cls += ' arena-option-wrong';
                    else cls += ' arena-option-dim';
                  } else if (selected) {
                    cls += ' arena-option-selected';
                  }
                  return (
                    <button
                      key={opt}
                      onClick={() => handleSelect(opt)}
                      disabled={isRevealed}
                      className={cls}
                    >
                      <span className="arena-option-key">{opt}</span>
                      <span className="flex-1 text-left">{text}</span>
                      {isRevealed && correctOpt && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
                      {isRevealed && selected && !correctOpt && <XCircle className="w-5 h-5 text-red-500 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {isRevealed && currentQ.explanation && (
                <div className="mt-4 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex gap-2 explain-pop">
                  <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <span><strong>Why?</strong> {currentQ.explanation}</span>
                </div>
              )}
              {isRevealed && (
                <div className={`mt-3 text-xs font-bold ${currentAnswer === currentQ.correctAnswer ? 'text-emerald-700' : 'text-red-600'}`}>
                  {currentAnswer === currentQ.correctAnswer ? '✅ Correct! Nice one.' : `❌ Correct answer: ${currentQ.correctAnswer}`}
                </div>
              )}

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                <button
                  onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                  disabled={currentIdx === 0}
                  className="arena-nav-btn disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>
                <button
                  onClick={() => setShowNavigator((v) => !v)}
                  className="lg:hidden text-[11px] font-bold text-emerald-800 underline"
                >
                  {showNavigator ? 'Hide' : 'Show'} navigator
                </button>
                {currentIdx === total - 1 ? (
                  <button onClick={finishPractice} className="btn-arena text-xs px-5 py-2.5">
                    <Award className="w-4 h-4" /> Finish Run
                  </button>
                ) : (
                  <button
                    onClick={() => setCurrentIdx((i) => Math.min(total - 1, i + 1))}
                    className="arena-nav-btn-primary"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigator */}
        <div className={`${showNavigator ? 'block' : 'hidden'} lg:block`}>
          <div className="arena-navigator rounded-3xl p-4">
            <div className="flex items-center justify-between text-[11px] font-bold text-white/70 uppercase tracking-wider">
              <span>Navigator</span>
              <span>{answeredCount}/{total}</span>
            </div>
            <div className="mt-3 grid grid-cols-5 lg:grid-cols-4 gap-1.5 max-h-[420px] overflow-y-auto pr-1">
              {questions.map((q, i) => {
                const done = !!answers[q.id];
                const flag = flagged.includes(q.id);
                const cur = i === currentIdx;
                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIdx(i)}
                    className={`arena-nav-dot ${done ? 'done' : ''} ${cur ? 'current' : ''} ${flag ? 'flagged' : ''}`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <button
              onClick={finishPractice}
              className="mt-4 w-full py-2.5 rounded-xl text-xs font-bold text-white bg-white/10 border border-white/20 hover:bg-white/20 transition-all flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" /> Finish & See Score
            </button>
          </div>
        </div>
      </div>

      {/* Mobile prev/next floating */}
      <div className="lg:hidden fixed bottom-20 left-4 right-4 flex justify-between pointer-events-none">
        <button
          onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
          disabled={currentIdx === 0}
          className="pointer-events-auto w-11 h-11 rounded-full arena-hud text-white flex items-center justify-center disabled:opacity-30"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button
          onClick={() => setCurrentIdx((i) => Math.min(total - 1, i + 1))}
          disabled={currentIdx === total - 1}
          className="pointer-events-auto w-11 h-11 rounded-full arena-hud text-white flex items-center justify-center disabled:opacity-30"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
