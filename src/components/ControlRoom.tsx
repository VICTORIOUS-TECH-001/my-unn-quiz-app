import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Megaphone,
  Play,
  Plus,
  Radio,
  Square,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Quiz } from '../types';
import { cbtStorage } from '../services/storage';
import {
  ExamControl,
  PresenceEntry,
  broadcastLive,
  endExamLive,
  extendExamLive,
  isPresenceFresh,
  launchExamLive,
  subscribeAllExamControls,
  subscribeConnection,
  subscribePresence,
} from '../services/liveSync';
import { firebaseNow } from '../services/firebase';
import { formatWATTime } from '../services/watTime';

interface ControlRoomProps {
  quizzes: Quiz[];
  onChanged: () => void;
}

function mmss(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * JAMB-style live command center. Everything here executes on ALL student
 * devices within ~1 second via the Firestore control plane:
 * launch, extend, end-now, broadcast, online presence, live submissions.
 */
export const ControlRoom: React.FC<ControlRoomProps> = ({ quizzes, onChanged }) => {
  const [controls, setControls] = useState<ExamControl[]>([]);
  const [presence, setPresence] = useState<PresenceEntry[]>([]);
  const [online, setOnline] = useState(true);
  const [now, setNow] = useState(() => firebaseNow());
  const [, setTick] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [noteError, setNoteError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const offControls = subscribeAllExamControls(setControls);
    const offPresence = subscribePresence(setPresence);
    const offConn = subscribeConnection(setOnline);
    const offStore = cbtStorage.subscribe(() => setTick((t) => t + 1));
    const timer = window.setInterval(() => setNow(firebaseNow()), 1000);
    return () => {
      offControls();
      offPresence();
      offConn();
      offStore();
      window.clearInterval(timer);
    };
  }, []);

  const controlByQuiz = useMemo(() => {
    const map = new Map<string, ExamControl>();
    controls.forEach((c) => map.set(c.quizId, c));
    return map;
  }, [controls]);

  const freshPresence = useMemo(() => presence.filter(isPresenceFresh), [presence]);

  const flash = (message: string, isError = false) => {
    setNote(message);
    setNoteError(isError);
  };

  const runAction = async (key: string, fn: () => Promise<void>, done: string) => {
    setBusy(key);
    flash('📡 Pushing to all devices…');
    try {
      await fn();
      onChanged();
      flash(`✅ ${done} — live on every device.`);
    } catch (error) {
      console.error('Control action failed:', error);
      flash('⚠️ Live push FAILED — check internet connection and Firestore rules, then retry.', true);
    } finally {
      setBusy(null);
    }
  };

  const handleLaunch = (quiz: Quiz) =>
    runAction(`launch-${quiz.id}`, async () => {
      cbtStorage.scheduleQuiz(quiz.id, quiz.date, quiz.startTime, quiz.durationMinutes, 'active');
      const fresh = cbtStorage.getQuizById(quiz.id) || quiz;
      await launchExamLive({ ...fresh, status: 'active' });
      await broadcastLive(
        `🟢 ${fresh.courseCode} exam is LIVE! Enter now — one shared clock for everyone.`,
        fresh.courseCode,
        'live'
      );
    }, `${quiz.courseCode} launched`);

  const handleExtend = (quiz: Quiz, minutes: number) =>
    runAction(`extend-${quiz.id}`, async () => {
      await extendExamLive(quiz.id, minutes);
      await broadcastLive(
        `⏳ ${quiz.courseCode}: +${minutes} minutes added to the exam window!`,
        quiz.courseCode,
        'warning'
      );
    }, `+${minutes} min added to ${quiz.courseCode}`);

  const handleEnd = (quiz: Quiz) =>
    runAction(`end-${quiz.id}`, async () => {
      if (!confirm(`End ${quiz.courseCode} NOW for every student? All open exams will auto-submit.`)) {
        throw new Error('cancelled');
      }
      cbtStorage.scheduleQuiz(quiz.id, quiz.date, quiz.startTime, quiz.durationMinutes, 'completed');
      await endExamLive(quiz);
      await broadcastLive(`🛑 ${quiz.courseCode} exam has ENDED. All papers auto-submitted.`, quiz.courseCode, 'end');
    }, `${quiz.courseCode} ended for all`);

  const handleBroadcast = () =>
    runAction('broadcast', async () => {
      const message = prompt('Message to show instantly on EVERY student screen:');
      if (!message || !message.trim()) throw new Error('cancelled');
      await broadcastLive(`📢 ${message.trim()}`, undefined, 'info');
    }, 'Broadcast sent');

  const liveQuizzes = quizzes.filter((q) => q.status === 'active' || q.status === 'scheduled');

  const feed = useMemo(() => {
    const all = cbtStorage.getResults();
    return [...all]
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
      .slice(0, 8);
  }, [quizzes]);

  return (
    <div className="space-y-5">
      {/* Status strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger-rise">
        <div className="rounded-2xl p-4 bg-white border border-slate-200 shadow-xs flex items-center gap-3">
          <span
            className={`w-3 h-3 rounded-full ${online ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}
          />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Firebase link</div>
            <div className={`text-sm font-black ${online ? 'text-emerald-700' : 'text-red-600'}`}>
              {online ? '● CONNECTED' : '○ OFFLINE'}
            </div>
          </div>
        </div>
        <div className="rounded-2xl p-4 bg-white border border-slate-200 shadow-xs flex items-center gap-3">
          <Users className="w-5 h-5 text-emerald-700" />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Students online</div>
            <div className="text-sm font-black text-slate-900">{freshPresence.length} live</div>
          </div>
        </div>
        <div className="rounded-2xl p-4 bg-white border border-slate-200 shadow-xs flex items-center gap-3">
          <Radio className="w-5 h-5 text-emerald-700" />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Exams on air</div>
            <div className="text-sm font-black text-slate-900">
              {quizzes.filter((q) => q.status === 'active').length} live
            </div>
          </div>
        </div>
        <button
          onClick={handleBroadcast}
          disabled={busy !== null}
          className="rounded-2xl p-4 bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-md flex items-center justify-center gap-2 text-xs font-black hover:from-emerald-700 hover:to-green-700 disabled:opacity-50 anim-shine"
        >
          <Megaphone className="w-5 h-5" />
          BROADCAST TO ALL SCREENS
        </button>
      </div>

      {note && (
        <div
          className={`flex items-start gap-2.5 p-3.5 rounded-xl text-xs border anim-pop ${
            noteError ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          {noteError ? (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" />
          )}
          <span className="font-semibold">{note}</span>
        </div>
      )}

      {/* Live exam cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {liveQuizzes.map((quiz) => {
          const control = controlByQuiz.get(quiz.id);
          const inExam = freshPresence.filter((p) => p.screen === 'exam' && p.quizId === quiz.id).length;
          const submitted = cbtStorage.getResults(quiz.id).length;
          const windowLeft =
            control && control.windowEndMs > 0 ? Math.max(0, control.windowEndMs - now) : 0;
          const isLive = quiz.status === 'active';
          return (
            <div
              key={quiz.id}
              className={`rounded-2xl p-5 border-2 shadow-md space-y-3 anim-rise card-lift ${
                isLive ? 'bg-emerald-950 border-emerald-400/50 text-white' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                        isLive ? 'bg-lime-300 text-emerald-950' : 'bg-emerald-100 text-emerald-900'
                      }`}
                    >
                      {quiz.courseCode}
                    </span>
                    {isLive ? (
                      <span className="live-badge">● ON AIR</span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        Scheduled
                      </span>
                    )}
                  </div>
                  <h3 className={`mt-1.5 text-sm font-bold ${isLive ? 'text-white' : 'text-slate-900'}`}>
                    {quiz.title}
                  </h3>
                  <p className={`text-[11px] ${isLive ? 'text-emerald-100/80' : 'text-slate-500'}`}>
                    {quiz.questions.length} questions • {quiz.durationMinutes} min •{' '}
                    {control && control.windowEndMs > 0
                      ? `window ends ${formatWATTime(control.windowEndMs)} WAT`
                      : `starts ${formatWATTime(quiz.scheduledDateTime, quiz.startTime)} WAT`}
                    {control && control.extraMinutes > 0 && ` (+${control.extraMinutes} added)`}
                  </p>
                </div>
                {isLive && (
                  <div className="text-right shrink-0">
                    <div className="text-[10px] font-bold uppercase text-lime-200 flex items-center gap-1 justify-end">
                      <Clock className="w-3 h-3" /> Left
                    </div>
                    <div className="text-xl font-black font-mono">{mmss(windowLeft)}</div>
                  </div>
                )}
              </div>

              <div className={`flex items-center gap-3 text-[11px] font-bold ${isLive ? 'text-emerald-100' : 'text-slate-600'}`}>
                <span className="flex items-center gap-1">
                  {online ? <Wifi className="w-3.5 h-3.5 text-lime-400" /> : <WifiOff className="w-3.5 h-3.5" />}
                  {inExam} writing now
                </span>
                <span>•</span>
                <span>{submitted} submitted</span>
                <span>•</span>
                <span>{freshPresence.length} online total</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {!isLive ? (
                  <button
                    onClick={() => void handleLaunch(quiz)}
                    disabled={busy !== null}
                    className="btn-arena text-xs px-4 py-2 disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    {busy === `launch-${quiz.id}` ? 'Launching…' : '🚀 LAUNCH NOW'}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => void handleExtend(quiz, 5)}
                      disabled={busy !== null}
                      className="px-4 py-2 rounded-full text-xs font-black bg-amber-300 hover:bg-amber-200 text-amber-950 shadow flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" /> +5 MIN LIVE
                    </button>
                    <button
                      onClick={() => void handleExtend(quiz, 15)}
                      disabled={busy !== null}
                      className="px-4 py-2 rounded-full text-xs font-black bg-white/10 hover:bg-white/20 text-white border border-white/25 flex items-center gap-1.5 disabled:opacity-50"
                    >
                      +15 MIN
                    </button>
                    <button
                      onClick={() => void handleEnd(quiz)}
                      disabled={busy !== null}
                      className="px-4 py-2 rounded-full text-xs font-black bg-red-600 hover:bg-red-500 text-white shadow flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" /> END NOW FOR ALL
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {liveQuizzes.length === 0 && (
          <div className="col-span-full text-center py-10 text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl bg-white">
            No scheduled or active exams. Create a quiz first, then launch it from here.
          </div>
        )}
      </div>

      {/* Live feed + online students */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live submissions feed
          </h3>
          <div className="mt-3 space-y-2 max-h-64 overflow-y-auto pr-1">
            {feed.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-2 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 anim-rise"
              >
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 truncate">{r.studentName}</p>
                  <p className="font-mono text-[10px] text-emerald-800">
                    {r.courseCode} • {r.studentRegNo}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-slate-900">
                    {r.score}/{r.totalQuestions}
                  </p>
                  <p className="text-[10px] font-bold text-emerald-700">
                    {r.grade} • {r.percentage.toFixed(1)}%
                  </p>
                </div>
              </div>
            ))}
            {feed.length === 0 && (
              <p className="text-center text-xs text-slate-400 py-6">
                Submissions will stream in here live as students finish. 📡
              </p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-700" />
            Online now ({freshPresence.length})
          </h3>
          <div className="mt-3 flex flex-wrap gap-1.5 max-h-64 overflow-y-auto pr-1">
            {freshPresence.slice(0, 60).map((p) => (
              <span
                key={p.regNo}
                title={`${p.regNo} • ${p.screen}${p.quizId ? ` • ${p.quizId}` : ''}`}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-full px-2.5 py-1"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {p.name.split(' ').slice(0, 2).join(' ')}
                <span className="text-emerald-600/70 font-mono text-[10px]">{p.screen}</span>
              </span>
            ))}
            {freshPresence.length === 0 && (
              <p className="text-xs text-slate-400 py-6 text-center w-full">
                No students online right now.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
