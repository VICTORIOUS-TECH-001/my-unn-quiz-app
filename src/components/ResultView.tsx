import React, { useState } from 'react';
import {
  Award,
  Printer,
  Search,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  FileText,
  Share2,
  Trophy,
  Filter,
  Medal,
} from 'lucide-react';
import { Quiz, Result, Student } from '../types';
import { cbtStorage } from '../services/storage';
import { UNNLogo } from './UNNLogo';

interface ResultViewProps {
  quiz: Quiz;
  currentStudent?: Student | null;
  activeResult?: Result | null;
  onBackToDashboard: () => void;
  onSelectOtherQuiz?: () => void;
}

export const ResultView: React.FC<ResultViewProps> = ({
  quiz,
  currentStudent,
  activeResult,
  onBackToDashboard,
  onSelectOtherQuiz,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'individual' | 'leaderboard'>(
    activeResult ? 'individual' : 'leaderboard'
  );

  // Fetch results exclusively for this quiz
  const rawResults = cbtStorage.getResults(quiz.id);
  const rankedResults = cbtStorage.calculateRanking(rawResults);

  // Find current student's result if available
  const studentResult =
    activeResult ||
    (currentStudent
      ? rankedResults.find(
          (r) =>
            r.studentRegNo.toUpperCase().replace(/\s+/g, '') ===
            currentStudent.regNo.toUpperCase().replace(/\s+/g, '')
        )
      : null);

  // Filtered leaderboard
  const filteredResults = rankedResults.filter((r) => {
    const matchesSearch =
      r.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.studentRegNo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGrade = gradeFilter === 'all' || r.grade === gradeFilter;
    return matchesSearch && matchesGrade;
  });

  const handlePrint = () => {
    window.print();
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
          <Trophy className="w-3.5 h-3.5 text-[#0b6537]" />
          1st
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-slate-200 text-slate-800 border border-slate-300">
          <Medal className="w-3.5 h-3.5 text-slate-600" />
          2nd
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-stone-100 text-stone-800 border border-stone-300">
          <Medal className="w-3.5 h-3.5 text-stone-600" />
          3rd
        </span>
      );
    }
    return (
      <span className="font-mono font-bold text-slate-700 text-xs">
        {cbtStorage.getRankSuffix(rank)}
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Action Controls (Hidden during print) */}
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-2">
          <button
            onClick={onBackToDashboard}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>
          {onSelectOtherQuiz && (
            <button
              onClick={onSelectOtherQuiz}
              className="text-xs text-emerald-800 hover:text-emerald-950 font-semibold px-2 py-1 underline"
            >
              Browse Other Quizzes
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
            {studentResult && (
              <button
                onClick={() => setViewMode('individual')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  viewMode === 'individual' ? 'bg-white text-emerald-900 shadow-xs' : ''
                }`}
              >
                My Result Slip
              </button>
            )}
            <button
              onClick={() => setViewMode('leaderboard')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                viewMode === 'leaderboard' ? 'bg-white text-emerald-900 shadow-xs' : ''
              }`}
            >
              Full Master Sheet ({rankedResults.length})
            </button>
          </div>

          <button
            id="printResultsBtn"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#0b6537] hover:bg-[#074625] text-white rounded-xl text-xs font-bold shadow transition-all"
            title="Print Official UNN Examination Result"
          >
            <Printer className="w-4 h-4" />
            <span>Print Results</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: INDIVIDUAL OFFICIAL RESULT SLIP */}
      {viewMode === 'individual' && studentResult && (
        <div
          id="printableStudentSlip"
          className="bg-white rounded-2xl p-6 sm:p-10 shadow-lg border-2 border-slate-300 print:border-none print:shadow-none print:p-0 space-y-6"
        >
          {/* Official University Header */}
          <div className="text-center border-b-[4px] border-[#0b6537] pb-6 space-y-2">
            <div className="flex justify-center mb-2">
              <UNNLogo size="xl" showText={true} subText="to restore the dignity of man" textColor="text-[#0b6537]" />
            </div>
            <p className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider">
              FACULTY OF LAW &bull; ENUGU CAMPUS (UNEC)
            </p>
            <div className="inline-block mt-2 px-4 py-1.5 bg-[#0b6537] text-white text-xs font-mono font-bold uppercase rounded-md tracking-wider shadow-xs">
              OFFICIAL STUDENT QUIZ COMPETITION RESULT SLIP
            </div>
          </div>

          {/* Student and Examination Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-200 text-xs">
            <div className="space-y-2">
              <div>
                <span className="text-slate-500 block uppercase text-[10px] font-semibold">
                  Candidate Full Name
                </span>
                <span className="text-sm font-bold text-slate-900">
                  {studentResult.studentName}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block uppercase text-[10px] font-semibold">
                  Registration / Matric Number
                </span>
                <span className="text-sm font-mono font-bold text-[#0b6537]">
                  {studentResult.studentRegNo}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block uppercase text-[10px] font-semibold">
                  Academic Level / Class
                </span>
                <span className="font-semibold text-slate-800">
                  Student Quiz Competition Portal &bull; UNEC
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <span className="text-slate-500 block uppercase text-[10px] font-semibold">
                  Course Code & Title
                </span>
                <span className="text-sm font-bold text-slate-900">
                  {studentResult.courseCode}: {studentResult.courseTitle}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block uppercase text-[10px] font-semibold">
                  Examination Title
                </span>
                <span className="font-semibold text-slate-800">
                  {studentResult.quizTitle}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block uppercase text-[10px] font-semibold">
                  Date & Submission Mode
                </span>
                <span className="text-slate-700">
                  {new Date(studentResult.submittedAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  ({studentResult.submissionType === 'early' ? 'Early Hand-in' : 'Timer Finalized'})
                </span>
              </div>
            </div>
          </div>

          {/* Large Performance Showcase */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
              <span className="text-[11px] font-semibold uppercase text-emerald-800 block">
                Total Score
              </span>
              <span className="text-2xl sm:text-3xl font-black text-emerald-950 font-mono mt-1 block">
                {studentResult.score}{' '}
                <span className="text-xs font-normal text-slate-500">
                  / {studentResult.totalQuestions}
                </span>
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200">
              <span className="text-[11px] font-semibold uppercase text-blue-800 block">
                Percentage
              </span>
              <span className="text-2xl sm:text-3xl font-black text-blue-950 font-mono mt-1 block">
                {studentResult.percentage.toFixed(2)}%
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-[#0b6537]/10 border border-[#0b6537]/30">
              <span className="text-[11px] font-semibold uppercase text-[#0b6537] block">
                Official Grade
              </span>
              <span className="text-2xl sm:text-3xl font-black text-[#074625] font-serif mt-1 block">
                {studentResult.grade}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200">
              <span className="text-[11px] font-semibold uppercase text-purple-800 block">
                Class Position / Rank
              </span>
              <span className="text-2xl sm:text-3xl font-black text-purple-950 font-serif mt-1 block">
                {studentResult.rank ? cbtStorage.getRankSuffix(studentResult.rank) : '—'}
              </span>
            </div>
          </div>

          {/* Breakdown Stats */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-around gap-4 text-xs text-slate-700">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>
                Correct Answers: <strong>{studentResult.correctAnswers}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-500" />
              <span>
                Wrong Answers: <strong>{studentResult.wrongAnswers}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <span>
                Unanswered: <strong>{studentResult.unanswered}</strong>
              </span>
            </div>
          </div>

          {/* University Stamp & Signature Verification Area */}
          <div className="pt-10 border-t border-slate-200 grid grid-cols-2 gap-8 text-xs text-slate-600">
            <div className="text-center space-y-1">
              <div className="w-44 border-b border-slate-400 mx-auto mb-2"></div>
              <p className="font-semibold text-slate-800">Faculty Examinations Officer</p>
              <p className="text-[11px] text-slate-500">Faculty of Law, UNEC</p>
            </div>
            <div className="text-center space-y-1">
              <div className="w-44 border-b border-slate-400 mx-auto mb-2"></div>
              <p className="font-semibold text-slate-800">Dean / Head of Department</p>
              <p className="text-[11px] text-slate-500">University of Nigeria, Nsukka</p>
            </div>
          </div>

          <p className="text-[10px] text-center text-slate-400 font-mono pt-4 border-t border-slate-100">
            Result ID: {studentResult.id} &bull; Generated from Official UNN Computer-Based Test
            Repository &bull; Valid only with official university stamp.
          </p>
        </div>
      )}

      {/* VIEW 2: FULL MASTER RESULT SHEET & RANKED LEADERBOARD */}
      {viewMode === 'leaderboard' && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
          {/* Official Sheet Header */}
          <div className="border-b-2 border-emerald-900 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-mono font-bold text-emerald-800 uppercase">
                  {quiz.courseCode}: {quiz.courseTitle}
                </div>
                <h2 className="text-xl font-bold text-slate-900 uppercase tracking-tight mt-0.5">
                  {quiz.title} &bull; Official Results
                </h2>
                <p className="text-xs text-slate-500">
                  {quiz.date}, {quiz.startTime} &bull; {quiz.totalQuestions} Questions &bull;{' '}
                  {quiz.durationMinutes} Minutes &bull; Ranked from Highest to Lowest Score
                </p>
              </div>

              <div className="text-right hidden sm:block">
                <span className="text-xs font-semibold text-slate-500 block">Total Submissions</span>
                <span className="text-xl font-bold font-mono text-emerald-900">
                  {rankedResults.length} Candidates
                </span>
              </div>
            </div>
          </div>

          {/* Search and Filters (Hidden on Print) */}
          <div className="print:hidden flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search candidate name or reg number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-emerald-700"
              />
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-500">Filter Grade:</span>
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700"
              >
                <option value="all">All Grades</option>
                <option value="A">Grade A (70-100%)</option>
                <option value="B">Grade B (65-69%)</option>
                <option value="C">Grade C (60-64%)</option>
                <option value="D">Grade D (55-59%)</option>
                <option value="E">Grade E (50-54%)</option>
                <option value="F">Grade F (0-49%)</option>
              </select>
            </div>
          </div>

          {/* Full Ranked Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-emerald-900 text-white font-semibold">
                  <th className="p-3 w-16 text-center">Rank</th>
                  <th className="p-3">Student Name</th>
                  <th className="p-3 font-mono">Reg Number</th>
                  <th className="p-3 text-center">Score</th>
                  <th className="p-3 text-center">Percentage</th>
                  <th className="p-3 text-center">Grade</th>
                  <th className="p-3 text-right">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredResults.map((res) => {
                  const isCurrentUser =
                    currentStudent &&
                    res.studentRegNo.toUpperCase().replace(/\s+/g, '') ===
                      currentStudent.regNo.toUpperCase().replace(/\s+/g, '');

                  return (
                    <tr
                      key={res.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        isCurrentUser ? 'bg-emerald-50/90 font-semibold' : ''
                      }`}
                    >
                      <td className="p-3 text-center">
                        {getRankBadge(res.rank || 1)}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-900">
                          {res.studentName}
                          {isCurrentUser && (
                            <span className="ml-2 text-[10px] bg-emerald-700 text-white px-1.5 py-0.5 rounded">
                              YOU
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 font-mono text-emerald-800">
                        {res.studentRegNo}
                      </td>
                      <td className="p-3 text-center font-bold text-slate-900">
                        {res.score}/{res.totalQuestions}
                      </td>
                      <td className="p-3 text-center font-mono font-semibold">
                        {res.percentage.toFixed(2)}%
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold text-xs ${
                            res.grade === 'A'
                              ? 'bg-emerald-100 text-emerald-800'
                              : res.grade === 'B'
                              ? 'bg-blue-100 text-blue-800'
                              : res.grade === 'C'
                              ? 'bg-teal-100 text-teal-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {res.grade}
                        </span>
                      </td>
                      <td className="p-3 text-right text-[11px] text-slate-400 font-mono">
                        {new Date(res.submittedAt).toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  );
                })}

                {filteredResults.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400 text-xs">
                      No results found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Master sheet footer for print */}
          <div className="pt-6 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400 font-mono">
            <span>Faculty of Law &bull; University of Nigeria, Nsukka</span>
            <span>Official Computer-Based Test Master Grade Sheet</span>
          </div>
        </div>
      )}
    </div>
  );
};
