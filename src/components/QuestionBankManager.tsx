import React, { useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Copy,
  Database,
  Download,
  Edit2,
  FileText,
  FileUp,
  AlertCircle,
  LoaderCircle,
  Plus,
  Search,
  Shuffle,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Course, OptionKey, Question } from '../types';
import { DEFAULT_PRACTICE_DRAW, cbtStorage } from '../services/storage';
import {
  QUESTION_TEMPLATE,
  downloadQuestionTemplate,
  extractQuestionsFromFileDetailed,
  extractQuestionsFromTextDetailed,
} from '../services/questionImport';

interface QuestionBankManagerProps {
  courses: Course[];
  onChanged: () => void;
}

/**
 * Admin Question Bank: one bank per course, stored in Firebase.
 * Admin uploads MANY questions via PDF / Word / TXT (or paste), and every
 * student practice / quiz run draws a fresh random set (default 70).
 */
export const QuestionBankManager: React.FC<QuestionBankManagerProps> = ({
  courses,
  onChanged,
}) => {
  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    courses[0]?.id || ''
  );
  const [search, setSearch] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [revision, setRevision] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);
  const [editForm, setEditForm] = useState({
    questionText: '',
    optA: '',
    optB: '',
    optC: '',
    optD: '',
    correctAnswer: 'A' as OptionKey,
    explanation: '',
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const course = courses.find((c) => c.id === selectedCourseId) || courses[0];
  const bank = course ? cbtStorage.getQuestionBankByCourse(course.id) : null;
  const bankQuestions = useMemo(
    () => (bank ? bank.questions : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bank?.questions.length, bank?.updatedAt, selectedCourseId, revision]
  );
  const perAttempt = bank?.questionsPerAttempt || DEFAULT_PRACTICE_DRAW;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bankQuestions;
    return bankQuestions.filter(
      (item) =>
        item.questionText.toLowerCase().includes(q) ||
        item.options.A.toLowerCase().includes(q) ||
        item.options.B.toLowerCase().includes(q)
    );
  }, [bankQuestions, search]);

  const rerender = () => {
    setRevision((r) => r + 1);
    onChanged();
  };

  const flash = (msg: string, err = false) => {
    setStatus(msg);
    setIsError(err);
  };

  const handleFiles = async (files: FileList | File[] | null) => {
    if (!course) {
      flash('Create a course first, then upload questions into it.', true);
      return;
    }
    const list = files ? Array.from(files) : [];
    if (list.length === 0) return;
    setIsReading(true);
    setWarnings([]);
    flash(`Reading ${list.length} document${list.length > 1 ? 's' : ''}…`);
    try {
      let totalAdded = 0;
      let totalDupes = 0;
      let totalSkipped = 0;
      const allWarnings: string[] = [];
      for (const file of list) {
        const report = await extractQuestionsFromFileDetailed(file);
        const { added, duplicates } = cbtStorage.addQuestionsToBank(
          course.id,
          report.questions
        );
        totalAdded += added;
        totalDupes += duplicates;
        totalSkipped += report.skippedBlocks;
        allWarnings.push(...report.warnings.slice(0, 3));
      }
      setWarnings(allWarnings.slice(0, 5));
      if (totalAdded === 0) {
        flash(
          `No new questions found. Check the format guide — each question needs numbering + options A–D + "Answer: X". (${totalSkipped} block${totalSkipped === 1 ? '' : 's'} skipped${totalDupes ? `, ${totalDupes} duplicate${totalDupes === 1 ? '' : 's'}` : ''})`,
          true
        );
        rerender();
      } else {
        const summary =
          `✅ Saved ${totalAdded} question${totalAdded === 1 ? '' : 's'} to ${course.code} bank` +
          (totalDupes ? ` (${totalDupes} duplicate${totalDupes === 1 ? '' : 's'} skipped)` : '') +
          (totalSkipped ? ` (${totalSkipped} block${totalSkipped === 1 ? '' : 's'} skipped)` : '');
        flash(`${summary} — ☁️ pushing to Firebase database…`);
        rerender();
        try {
          await cbtStorage.pushQuestionBanksToFirebase();
          flash(`${summary}. ☁️ Live in Firebase database for all students.`);
        } catch (pushError) {
          console.error('Bank Firebase push failed:', pushError);
          flash(`${summary}. ⚠️ Saved on this device — Firebase sync will retry automatically.`, true);
        }
        rerender();
      }
    } catch (error) {
      console.error('Bank upload failed:', error);
      flash(
        'Could not read this file. Use a text-based PDF (not scanned images), DOCX, or TXT.',
        true
      );
    } finally {
      setIsReading(false);
    }
  };

  const handlePasteImport = () => {
    if (!course) return;
    if (!pasteText.trim()) {
      flash('Paste questions first, then click Parse & Save.', true);
      return;
    }
    const report = extractQuestionsFromTextDetailed(pasteText);
    setWarnings(report.warnings.slice(0, 5));
    if (report.questions.length === 0) {
      flash(
        `No questions found in pasted text (${report.skippedBlocks} block${report.skippedBlocks === 1 ? '' : 's'} skipped). Follow the format guide.`,
        true
      );
      return;
    }
    const { added, duplicates } = cbtStorage.addQuestionsToBank(
      course.id,
      report.questions
    );
    setPasteText('');
    flash(
      `✅ Saved ${added} question${added === 1 ? '' : 's'} to ${course.code} bank.` +
        (duplicates ? ` ${duplicates} duplicate${duplicates === 1 ? '' : 's'} skipped.` : '')
    );
    rerender();
  };

  const openEdit = (q: Question) => {
    setEditing(q);
    setEditForm({
      questionText: q.questionText,
      optA: q.options.A,
      optB: q.options.B,
      optC: q.options.C,
      optD: q.options.D,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || '',
    });
  };

  const saveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!course || !editing) return;
    cbtStorage.updateBankQuestion(course.id, {
      ...editing,
      questionText: editForm.questionText.trim(),
      options: {
        A: editForm.optA.trim(),
        B: editForm.optB.trim(),
        C: editForm.optC.trim() || 'None of the above',
        D: editForm.optD.trim() || 'All of the above',
      },
      correctAnswer: editForm.correctAnswer,
      explanation: editForm.explanation.trim(),
    });
    setEditing(null);
    flash('Question updated in bank.');
    rerender();
  };

  if (courses.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-10 text-center border border-slate-200">
        <Database className="w-10 h-10 mx-auto text-slate-300" />
        <h3 className="mt-3 font-bold text-slate-800">No courses yet</h3>
        <p className="text-xs text-slate-500 mt-1">
          Add a course first — each course gets its own question bank.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Course picker cards with bank counts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {courses.map((c) => {
          const count = cbtStorage.getBankQuestionCount(c.id);
          const active = course?.id === c.id;
          return (
            <button
              key={c.id}
              onClick={() => {
                setSelectedCourseId(c.id);
                setSearch('');
                setWarnings([]);
                setStatus(null);
              }}
              className={`text-left p-4 rounded-2xl border-2 transition-all cursor-pointer group card-lift ${
                active
                  ? 'border-emerald-600 bg-gradient-to-br from-emerald-600 to-green-700 text-white shadow-lg shadow-emerald-900/20 scale-[1.01]'
                  : 'border-slate-200 bg-white hover:border-emerald-400 hover:shadow-md'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                    active ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-900'
                  }`}
                >
                  {c.code}
                </span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    active ? 'bg-lime-300 text-emerald-950' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {count} in bank
                </span>
              </div>
              <h3 className={`mt-2 text-sm font-bold ${active ? 'text-white' : 'text-slate-900'}`}>
                {c.title}
              </h3>
              <p className={`text-[11px] mt-0.5 ${active ? 'text-emerald-100' : 'text-slate-500'}`}>
                Practice draws {perAttempt} random per run
              </p>
            </button>
          );
        })}
      </div>

      {course && (
        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-5">
          {/* Header + per-attempt control */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-700" />
                {course.code} — Question Bank
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload <strong>hundreds</strong> of questions once — they save in Firebase. Each
                student practice automatically pulls a fresh random set.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <Shuffle className="w-4 h-4 text-emerald-700" />
              <span className="font-semibold text-slate-700">Questions per practice:</span>
              <input
                type="number"
                min={5}
                max={200}
                value={perAttempt}
                onChange={(e) => {
                  cbtStorage.setQuestionsPerAttempt(course.id, Number(e.target.value));
                  rerender();
                }}
                className="w-16 px-2 py-1 border border-slate-300 rounded-lg font-mono font-bold text-emerald-900 bg-white"
              />
            </div>
          </div>

          {/* Firebase live-sync status */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              ☁️ Firebase database connected — {bankQuestions.length} questions live for all concurrent students.
            </span>
            <button
              onClick={() => {
                flash('☁️ Syncing banks to Firebase database…');
                cbtStorage
                  .pushQuestionBanksToFirebase()
                  .then(() => flash('☁️ All question banks synced to Firebase database.'))
                  .catch(() => flash('⚠️ Sync failed — check internet / Firebase rules, then retry.', true));
              }}
              className="self-start sm:self-center px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold shadow-xs"
            >
              Sync now
            </button>
          </div>

          {/* Upload zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              void handleFiles(e.dataTransfer.files);
            }}
            onClick={() => fileRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center transition-all ${
              dragActive
                ? 'border-emerald-500 bg-emerald-50 scale-[1.01]'
                : 'border-emerald-300 bg-gradient-to-br from-emerald-50/80 to-lime-50/60 hover:border-emerald-500 hover:shadow-md'
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.txt"
              className="hidden"
              onChange={(e) => {
                void handleFiles(e.target.files);
                e.currentTarget.value = '';
              }}
            />
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-700 text-white flex items-center justify-center shadow-lg shadow-emerald-900/20 float-soft">
                {isReading ? (
                  <LoaderCircle className="w-7 h-7 animate-spin" />
                ) : (
                  <FileUp className="w-7 h-7" />
                )}
              </div>
            </div>
            <h3 className="mt-3 text-sm font-bold text-slate-900">
              {isReading ? 'Reading documents…' : 'Drop PDF / Word documents here, or click to upload'}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              .pdf, .docx, .doc, .txt — upload many files at once. Scanned/image PDFs can't be read;
              use text-based documents.
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-700 text-white text-xs font-bold shadow">
                <Upload className="w-3.5 h-3.5" /> Choose files
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  downloadQuestionTemplate();
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-emerald-300 text-emerald-900 text-xs font-bold hover:bg-emerald-50"
              >
                <Download className="w-3.5 h-3.5" /> Download format template
              </button>
            </div>
          </div>

          {status && (
            <div
              className={`flex items-start gap-2.5 p-3.5 rounded-xl text-xs border ${
                isError
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}
            >
              {isError ? (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" />
              )}
              <span className="font-medium">{status}</span>
            </div>
          )}
          {warnings.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 space-y-1">
              {warnings.map((w, i) => (
                <p key={i}>⚠️ {w}</p>
              ))}
            </div>
          )}

          {/* Format guide */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  Required document format
                </h3>
                <button
                  onClick={() => {
                    try {
                      void navigator.clipboard.writeText(QUESTION_TEMPLATE);
                      flash('Format template copied to clipboard.');
                    } catch {
                      flash('Copy failed — use the download button instead.', true);
                    }
                  }}
                  className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy
                </button>
              </div>
              <pre className="mt-2 text-[11px] leading-relaxed font-mono bg-emerald-950 text-emerald-50 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap">
{`1. What is the supreme law of Nigeria?
A. Criminal Code Act
B. Constitution of Nigeria
C. Evidence Act
D. Electoral Act
Answer: B
Explanation: Section 1(1), 1999 Constitution.

2. Rights are in which Chapter?
A. Chapter I
B. Chapter II
C. Chapter III
D. Chapter IV
Answer: D`}
              </pre>
              <ul className="mt-2 text-[11px] text-slate-600 space-y-1 list-disc pl-5">
                <li>Number every question: <code>1.</code> <code>2)</code> or <code>Question 1:</code></li>
                <li>Options A–D, each on its own line</li>
                <li>Correct answer as <code>Answer: B</code> (also accepts <code>Ans:</code>, <code>Correct:</code>)</li>
                <li>Optional <code>Explanation:</code> shown to students after practice</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-600" />
                Or paste questions directly
              </h3>
              <textarea
                rows={9}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={'1. Sample question here?\nA. Option one\nB. Option two\nC. Option three\nD. Option four\nAnswer: A'}
                className="mt-2 flex-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
              />
              <button
                onClick={handlePasteImport}
                disabled={!pasteText.trim()}
                className="mt-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white text-xs font-bold shadow flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Parse & Save to {course.code} Bank
              </button>
            </div>
          </div>

          {/* Bank contents */}
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                Saved in {course.code} bank ({bankQuestions.length})
              </h3>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search bank…"
                    className="pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-emerald-700 w-52"
                  />
                </div>
                {bankQuestions.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm(`Delete ALL ${bankQuestions.length} questions in the ${course.code} bank? This cannot be undone.`)) {
                        cbtStorage.clearQuestionBank(course.id);
                        flash(`${course.code} bank cleared.`);
                        rerender();
                      }
                    }}
                    className="px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 rounded-xl flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Clear
                  </button>
                )}
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                {bankQuestions.length === 0
                  ? 'Bank is empty — upload a PDF/Word document or paste questions above.'
                  : 'No questions match your search.'}
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                {filtered.slice(0, 300).map((q, idx) => (
                  <div
                    key={q.id}
                    className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 hover:border-emerald-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-semibold text-slate-900 leading-relaxed">
                        <span className="font-mono text-emerald-800 mr-1.5">Q{idx + 1}.</span>
                        {q.questionText}
                      </p>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openEdit(q)}
                          className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Delete this question from the bank?')) {
                              cbtStorage.deleteBankQuestion(course.id, q.id);
                              rerender();
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                      {(['A', 'B', 'C', 'D'] as OptionKey[]).map((opt) => (
                        <div
                          key={opt}
                          className={`px-2 py-1 rounded-lg border ${
                            q.correctAnswer === opt
                              ? 'bg-emerald-100 border-emerald-400 text-emerald-950 font-bold'
                              : 'bg-white border-slate-200 text-slate-600'
                          }`}
                        >
                          <span className="font-mono mr-1">{opt}.</span>
                          {q.options[opt]}
                          {q.correctAnswer === opt && <span className="ml-1.5">✓</span>}
                        </div>
                      ))}
                    </div>
                    {q.explanation && (
                      <p className="mt-1.5 text-[11px] text-slate-500 italic">
                        💡 {q.explanation}
                      </p>
                    )}
                  </div>
                ))}
                {filtered.length > 300 && (
                  <p className="text-center text-[11px] text-slate-400 py-2">
                    Showing first 300 of {filtered.length} — use search to narrow down.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-3 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Edit Bank Question</h3>
              <button
                onClick={() => setEditing(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={saveEdit} className="space-y-3 text-xs">
              <textarea
                required
                rows={3}
                value={editForm.questionText}
                onChange={(e) => setEditForm({ ...editForm, questionText: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
              />
              {(['optA', 'optB', 'optC', 'optD'] as const).map((key, i) => (
                <div key={key}>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Option {['A', 'B', 'C', 'D'][i]}
                  </label>
                  <input
                    type="text"
                    value={editForm[key]}
                    onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              ))}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Correct Answer</label>
                <div className="flex gap-4">
                  {(['A', 'B', 'C', 'D'] as OptionKey[]).map((opt) => (
                    <label key={opt} className="flex items-center gap-1.5 font-bold cursor-pointer">
                      <input
                        type="radio"
                        name="bankCorrect"
                        checked={editForm.correctAnswer === opt}
                        onChange={() => setEditForm({ ...editForm, correctAnswer: opt })}
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
              <input
                type="text"
                placeholder="Explanation (optional)"
                value={editForm.explanation}
                onChange={(e) => setEditForm({ ...editForm, explanation: e.target.value })}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg shadow"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

