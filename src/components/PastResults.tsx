import React, { useState } from 'react';
import { Award, BookOpen, Calendar, Clock, ArrowRight, ArrowLeft, Users, FileText } from 'lucide-react';
import { Quiz, Student } from '../types';
import { cbtStorage } from '../services/storage';

interface PastResultsProps {
  currentStudent?: Student | null;
  onSelectQuiz: (quiz: Quiz) => void;
  onBack: () => void;
}

export const PastResults: React.FC<PastResultsProps> = ({
  currentStudent,
  onSelectQuiz,
  onBack,
}) => {
  const quizzes = cbtStorage.getQuizzes();
  const allResults = cbtStorage.getResults();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-700" />
            <span>Past Results Archive</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Select any completed or active examination to view the dedicated results page, ranked
            score sheet, and student result slips. Results from different quizzes are strictly
            isolated.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {quizzes.map((quiz) => {
            const quizResults = allResults.filter((r) => r.quizId === quiz.id);
            const myResult = currentStudent
              ? quizResults.find(
                  (r) =>
                    r.studentRegNo.toUpperCase().replace(/\s+/g, '') ===
                    currentStudent.regNo.toUpperCase().replace(/\s+/g, '')
                )
              : null;

            return (
              <div
                key={quiz.id}
                onClick={() => onSelectQuiz(quiz)}
                className="p-5 bg-slate-50 hover:bg-emerald-50/40 border border-slate-200 hover:border-emerald-600 rounded-2xl cursor-pointer transition-all shadow-xs group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                      {quiz.courseCode}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        quiz.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800 font-bold'
                          : quiz.status === 'completed'
                          ? 'bg-slate-200 text-slate-700'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {quiz.status.toUpperCase()}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mt-2 group-hover:text-emerald-900 transition-colors">
                    {quiz.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">{quiz.courseTitle}</p>

                  <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200 my-3">
                    <div>
                      <span className="text-slate-400 block text-[9px]">QUESTIONS</span>
                      <span className="font-semibold">{quiz.questions.length} Items</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px]">DURATION</span>
                      <span className="font-semibold">{quiz.durationMinutes} Mins</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px]">PARTICIPANTS</span>
                      <span className="font-bold text-emerald-800">{quizResults.length} Submissions</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs">
                  {myResult ? (
                    <span className="text-emerald-800 font-bold">
                      Your Score: {myResult.score}/{myResult.totalQuestions} (Grade {myResult.grade})
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">Not attempted by you</span>
                  )}
                  <span className="flex items-center gap-1 font-semibold text-emerald-700 group-hover:translate-x-1 transition-transform">
                    View Results <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
