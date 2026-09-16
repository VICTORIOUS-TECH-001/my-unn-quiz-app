import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Calendar,
  Clock,
  Plus,
  Trash2,
  Edit2,
  Users,
  Award,
  Bell,
  Settings,
  Search,
  CheckCircle2,
  AlertCircle,
  Download,
  Play,
  Pause,
  Database,
  Printer,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  FileSpreadsheet,
  X,
  Lock,
  Unlock,
  KeyRound,
  Eye,
  EyeOff,
  Upload,
} from 'lucide-react';
import {
  Course,
  GradeBoundary,
  NotificationItem,
  OptionKey,
  Question,
  Quiz,
  QuizStatus,
  Result,
  Student,
} from '../types';
import { cbtStorage } from '../services/storage';
import { UNNLogo } from './UNNLogo';
import { authenticateAdmin, isLocalAdminAuthenticated, logoutAdmin, LOCAL_ADMIN_EMAIL } from '../services/localAuth';
import { extractQuestionsFromFile, extractQuestionsFromText } from '../services/questionImport';

interface AdminPortalProps {
  onBackToStudentPortal: () => void;
  onViewQuizResults: (quizId: string) => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  onBackToStudentPortal,
  onViewQuizResults,
}) => {
  const [activeTab, setActiveTab] = useState<
    | 'dashboard'
    | 'courses'
    | 'quizzes'
    | 'questions'
    | 'schedule'
    | 'results'
    | 'students'
    | 'notifications'
    | 'grading'
  >('dashboard');

  // Core Data
  const [courses, setCourses] = useState<Course[]>(cbtStorage.getCourses());
  const [quizzes, setQuizzes] = useState<Quiz[]>(cbtStorage.getQuizzes());
  const [students, setStudents] = useState<Student[]>(cbtStorage.getStudents());
  const [notifications, setNotifications] = useState<NotificationItem[]>(
    cbtStorage.getNotifications()
  );
  const [results, setResults] = useState<Result[]>(cbtStorage.getResults());
  const [config, setConfig] = useState(cbtStorage.getConfig());

  // UI States
  const [selectedQuizForQuestions, setSelectedQuizForQuestions] = useState<string>(
    quizzes[0]?.id || ''
  );
  const [selectedQuizForResults, setSelectedQuizForResults] = useState<string>(
    quizzes[0]?.id || ''
  );

  // Search States
  const [studentSearch, setStudentSearch] = useState('');
  const [resultSearch, setResultSearch] = useState('');

  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    try {
      return isLocalAdminAuthenticated();
    } catch {
      return false;
    }
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [adminEmail, setAdminEmail] = useState(LOCAL_ADMIN_EMAIL);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    try {
      if (!adminEmail.trim() || !passwordInput) {
        setPasswordError('Enter the local administrator email and password.');
        return;
      }
      await authenticateAdmin(adminEmail, passwordInput);
      setIsUnlocked(true);
      setPasswordInput('');
    } catch (error) {
      console.error('Local administrator authentication failed:', error);
      const code = error instanceof Error && 'code' in error ? String(error.code) : '';
      if (
        code.includes('auth/invalid-credential') ||
        code.includes('auth/invalid-login-credentials') ||
        code.includes('auth/wrong-password')
      ) {
        setPasswordError('Local administrator rejected the email or password.');
      } else if (code.includes('auth/user-not-found')) {
        setPasswordError('This email is not registered for local administration.');
      } else if (code.includes('auth/too-many-requests')) {
        setPasswordError('Too many failed attempts. Wait and try again.');
      } else if (code.includes('auth/network-request-failed')) {
        setPasswordError('The local administrator service could not be reached.');
      } else {
        setPasswordError(`Local sign-in failed (${code || 'unknown error'}).`);
      }
    }
  };

  const handleLockAdmin = async () => {
    setIsUnlocked(false);
    await logoutAdmin();
    setPasswordInput('');
    setPasswordError(null);
  };

  const handleExitAdmin = async () => {
    await handleLockAdmin();
    onBackToStudentPortal();
  };

  // Modals & Form States
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseForm, setCourseForm] = useState<Partial<Course>>({
    code: '',
    title: '',
    description: '',
    creditUnits: 4,
    semester: 'First Semester',
    lecturer: '',
  });

  const [showQuizModal, setShowQuizModal] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [quizForm, setQuizForm] = useState({
    courseId: courses[0]?.id || '',
    title: '',
    durationMinutes: 25,
    date: new Date().toISOString().slice(0, 10),
    startTime: '13:00',
    endTime: '13:25',
    instructions: '1. Answer all questions.\n2. Exam ends automatically at 00:00.',
  });

  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [questionForm, setQuestionForm] = useState({
    questionText: '',
    optA: '',
    optB: '',
    optC: '',
    optD: '',
    correctAnswer: 'A' as OptionKey,
    explanation: '',
  });
  const [questionImportText, setQuestionImportText] = useState('');
  const [questionImportStatus, setQuestionImportStatus] = useState<string | null>(null);
  const [isImportingQuestions, setIsImportingQuestions] = useState(false);
  const [classListStatus, setClassListStatus] = useState<string | null>(null);

  const [showStudentModal, setShowStudentModal] = useState(false);
  const [studentForm, setStudentForm] = useState({
    name: '',
    regNo: '',
    level: '100 Level',
    faculty: 'Faculty of Law',
    campus: 'UNEC (Enugu Campus)',
    class: '100 Level Class',
  });

  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notifForm, setNotifForm] = useState({
    title: '',
    message: '',
    type: 'general' as const,
    targetCourse: 'LAW 411',
  });

  // Refresh data from storage
  const refreshData = () => {
    setCourses(cbtStorage.getCourses());
    setQuizzes(cbtStorage.getQuizzes());
    setStudents(cbtStorage.getStudents());
    setNotifications(cbtStorage.getNotifications());
    setResults(cbtStorage.getResults());
    setConfig(cbtStorage.getConfig());
  };

  useEffect(() => {
    const handleDataChange = () => refreshData();
    window.addEventListener('cbt_data_change', handleDataChange);
    return () => window.removeEventListener('cbt_data_change', handleDataChange);
  }, []);

  // ================= COURSE ACTIONS =================
  const handleSaveCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseForm.code || !courseForm.title) return;

    if (editingCourse) {
      cbtStorage.updateCourse({
        ...editingCourse,
        code: courseForm.code.trim().toUpperCase(),
        title: courseForm.title.trim(),
        description: courseForm.description || '',
        creditUnits: Number(courseForm.creditUnits) || 4,
        semester: courseForm.semester || 'First Semester',
        lecturer: courseForm.lecturer || '',
      });
    } else {
      const newCourse: Course = {
        id: `course_${Date.now()}`,
        code: courseForm.code.trim().toUpperCase(),
        title: courseForm.title.trim(),
        description: courseForm.description || '',
        creditUnits: Number(courseForm.creditUnits) || 4,
        semester: courseForm.semester || 'First Semester',
        lecturer: courseForm.lecturer || '',
      };
      cbtStorage.addCourse(newCourse);
    }
    setShowCourseModal(false);
    setEditingCourse(null);
    refreshData();
  };

  const handleDeleteCourse = (id: string) => {
    if (confirm('Are you sure you want to delete this course?')) {
      cbtStorage.deleteCourse(id);
      refreshData();
    }
  };

  // ================= QUIZ ACTIONS =================
  const handleSaveQuiz = (e: React.FormEvent) => {
    e.preventDefault();
    const course = courses.find((c) => c.id === quizForm.courseId);
    if (!course) {
      alert('Select a course before saving the quiz.');
      return;
    }
    if (!quizForm.title.trim()) {
      alert('Enter a quiz title before saving.');
      return;
    }
    const parseClockTime = (value: string): [number, number] => {
      const match = value.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
      if (!match) return [NaN, NaN];
      let hours = Number(match[1]);
      const minutes = Number(match[2]);
      const meridiem = match[3]?.toUpperCase();
      if (meridiem) {
        if (hours < 1 || hours > 12 || minutes > 59) return [NaN, NaN];
        if (meridiem === 'PM' && hours < 12) hours += 12;
        if (meridiem === 'AM' && hours === 12) hours = 0;
      } else if (hours > 23 || minutes > 59) {
        return [NaN, NaN];
      }
      return [hours, minutes];
    };
    const scheduleDateTime = (() => {
      const [year, month, day] = quizForm.date.split('-').map(Number);
      if (year && month && day) {
        const [hours, minutes] = parseClockTime(quizForm.startTime);
        if (Number.isNaN(hours) || Number.isNaN(minutes)) {
          return new Date().toISOString();
        }
        const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
        return date.toISOString();
      }
      return new Date().toISOString();
    })();
    const endDateTime = (() => {
      const [year, month, day] = quizForm.date.split('-').map(Number);
      if (year && month && day) {
        const [hours, minutes] = parseClockTime(quizForm.endTime);
        if (Number.isNaN(hours) || Number.isNaN(minutes)) {
          return new Date(new Date(scheduleDateTime).getTime() + (Number(quizForm.durationMinutes) || 25) * 60000).toISOString();
        }
        const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
        return date.toISOString();
      }
      return new Date(new Date(scheduleDateTime).getTime() + (Number(quizForm.durationMinutes) || 25) * 60000).toISOString();
    })();
    const durationMinutes = Number(quizForm.durationMinutes);
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      alert('Duration must be greater than zero minutes.');
      return;
    }
    if (new Date(endDateTime).getTime() <= new Date(scheduleDateTime).getTime()) {
      alert('End time must be after the start time.');
      return;
    }

    if (editingQuiz) {
      cbtStorage.updateQuiz({
        ...editingQuiz,
        courseId: course.id,
        courseCode: course.code,
        courseTitle: course.title,
        title: quizForm.title,
        durationMinutes,
        date: quizForm.date,
        startTime: quizForm.startTime,
        scheduledDateTime: scheduleDateTime,
        endDateTime,
        instructions: quizForm.instructions,
      });
    } else {
      const newQuiz: Quiz = {
        id: `quiz_${Date.now()}`,
        courseId: course.id,
        courseCode: course.code,
        courseTitle: course.title,
        title: quizForm.title,
        totalQuestions: 0,
        durationMinutes,
        date: quizForm.date,
        startTime: quizForm.startTime,
        scheduledDateTime: scheduleDateTime,
        endDateTime,
        status: 'scheduled',
        questions: [],
        instructions: quizForm.instructions,
        createdAt: new Date().toISOString(),
      };
      cbtStorage.addQuiz(newQuiz);
      setSelectedQuizForQuestions(newQuiz.id);
    }
    setShowQuizModal(false);
    setEditingQuiz(null);
    refreshData();
  };

  const addImportedQuestions = (questions: Question[]) => {
    if (!activeQuizForQ) {
      setQuestionImportStatus('Create or select a quiz before importing questions.');
      return;
    }
    if (questions.length === 0) {
      setQuestionImportStatus('No questions found. Use numbered questions with options A-D.');
      return;
    }
    questions.forEach((question) => cbtStorage.addQuestion(activeQuizForQ.id, question));
    setQuestionImportText('');
    setQuestionImportStatus(`${questions.length} question${questions.length === 1 ? '' : 's'} imported.`);
    refreshData();
  };

  const handleQuestionFileImport = async (file: File) => {
    setIsImportingQuestions(true);
    setQuestionImportStatus(null);
    try {
      addImportedQuestions(await extractQuestionsFromFile(file));
    } catch (error) {
      console.error('Question document import failed:', error);
      setQuestionImportStatus('Could not read this document. Use a text-based PDF or DOCX file.');
    } finally {
      setIsImportingQuestions(false);
    }
  };

  const handleQuestionPasteImport = () => {
    addImportedQuestions(extractQuestionsFromText(questionImportText));
  };

  const handleDeleteQuiz = (id: string) => {
    if (confirm('Are you sure you want to delete this quiz and its questions?')) {
      cbtStorage.deleteQuiz(id);
      refreshData();
    }
  };

  const handleToggleQuizStatus = (quiz: Quiz, newStatus: QuizStatus) => {
    cbtStorage.scheduleQuiz(quiz.id, quiz.date, quiz.startTime, quiz.durationMinutes, newStatus);
    refreshData();
  };

  // ================= QUESTION ACTIONS =================
  const activeQuizForQ = quizzes.find((q) => q.id === selectedQuizForQuestions) || quizzes[0];

  const handleSaveQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeQuizForQ) return;
    if (!questionForm.questionText || !questionForm.optA || !questionForm.optB) {
      alert('Question text and at least Options A and B are required.');
      return;
    }

    const questionObj: Question = {
      id: editingQuestion ? editingQuestion.id : `q_${Date.now()}`,
      questionText: questionForm.questionText.trim(),
      options: {
        A: questionForm.optA.trim(),
        B: questionForm.optB.trim(),
        C: questionForm.optC.trim() || 'None of the above',
        D: questionForm.optD.trim() || 'All of the above',
      },
      correctAnswer: questionForm.correctAnswer,
      explanation: questionForm.explanation.trim(),
    };

    if (editingQuestion) {
      cbtStorage.updateQuestion(activeQuizForQ.id, questionObj);
    } else {
      cbtStorage.addQuestion(activeQuizForQ.id, questionObj);
    }

    setShowQuestionModal(false);
    setEditingQuestion(null);
    setQuestionForm({
      questionText: '',
      optA: '',
      optB: '',
      optC: '',
      optD: '',
      correctAnswer: 'A',
      explanation: '',
    });
    refreshData();
  };

  const handleDeleteQuestion = (qId: string) => {
    if (!activeQuizForQ) return;
    if (confirm('Delete this question?')) {
      cbtStorage.deleteQuestion(activeQuizForQ.id, qId);
      refreshData();
    }
  };

  // ================= STUDENT ACTIONS =================
  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.name || !studentForm.regNo) return;

    const newSt: Student = {
      sn: students.length + 1,
      name: studentForm.name.trim(),
      regNo: studentForm.regNo.trim().toUpperCase(),
      level: studentForm.level,
      faculty: studentForm.faculty,
      campus: studentForm.campus,
      class: studentForm.class,
    };

    const added = cbtStorage.addStudent(newSt);
    if (!added) {
      alert('A student with this Registration Number already exists.');
      return;
    }
    setShowStudentModal(false);
    setStudentForm({
      name: '',
      regNo: '',
      level: '100 Level',
      faculty: 'Faculty of Law',
      campus: 'UNEC (Enugu Campus)',
      class: '100 Level Class',
    });
    refreshData();
  };

  // ================= NOTIFICATION ACTIONS =================
  const handleSaveNotification = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifForm.title || !notifForm.message) return;

    const newN: NotificationItem = {
      id: `notif_${Date.now()}`,
      title: notifForm.title.trim(),
      message: notifForm.message.trim(),
      date: 'Just now',
      type: notifForm.type,
      targetCourse: notifForm.targetCourse,
    };

    cbtStorage.addNotification(newN);
    setShowNotifModal(false);
    setNotifForm({
      title: '',
      message: '',
      type: 'general',
      targetCourse: 'LAW 411',
    });
    refreshData();
  };

  // ================= RESULTS ACTIONS =================
  const activeQuizForResults =
    quizzes.find((q) => q.id === selectedQuizForResults) || quizzes[0];
  const quizResultsList = activeQuizForResults
    ? cbtStorage.calculateRanking(cbtStorage.getResults(activeQuizForResults.id))
    : [];

  const filteredQuizResults = quizResultsList.filter(
    (r) =>
      r.studentName.toLowerCase().includes(resultSearch.toLowerCase()) ||
      r.studentRegNo.toLowerCase().includes(resultSearch.toLowerCase())
  );

  const handleDeleteResult = (id: string) => {
    if (confirm('Delete this individual student result? Note: Local to this browser in prototype.')) {
      cbtStorage.deleteResult(id);
      refreshData();
    }
  };

  const handleDeleteAllQuizResults = (quizId: string) => {
    if (
      confirm(
        'WARNING: Are you sure you want to delete ALL results for this quiz? This cannot be undone.'
      )
    ) {
      cbtStorage.deleteResultsByQuiz(quizId);
      refreshData();
    }
  };

  // Export CSV of results
  const exportResultsCSV = () => {
    if (!activeQuizForResults || quizResultsList.length === 0) {
      alert('No results to export.');
      return;
    }
    const headers = [
      'Rank',
      'Student Name',
      'Reg Number',
      'Score',
      'Total Questions',
      'Percentage',
      'Grade',
      'Submission Time',
    ];
    const rows = quizResultsList.map((r) => [
      r.rank,
      `"${r.studentName}"`,
      r.studentRegNo,
      r.score,
      r.totalQuestions,
      `${r.percentage}%`,
      r.grade,
      `"${r.submittedAt}"`,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `${activeQuizForResults.courseCode}_Results_Official_UNEC.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter students
  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.regNo.toLowerCase().includes(studentSearch.toLowerCase())
  );

  // Security gate for the local administrator session.
  if (!isUnlocked) {
    return (
      <div className="min-h-[calc(100vh-140px)] flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-50">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          {/* Official University Header */}
          <div className="bg-white p-6 sm:p-8 text-center border-b-[5px] border-[#0b6537]">
            <div className="flex justify-center mb-3">
              <UNNLogo size="lg" showText={true} subText="to restore the dignity of man" textColor="text-[#0b6537]" />
            </div>
            <div className="mt-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-full text-xs font-mono font-bold uppercase tracking-wider mb-2">
                <Lock className="w-3.5 h-3.5 text-emerald-700" />
                <span>Admin Access Restricted</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0b6537]">
                Staff Administrator Login
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Enter the administrator security password to access quiz controls, question bank, and results.
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="p-6 sm:p-8 space-y-6">
            {passwordError && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Authentication Failed</p>
                  <p className="mt-0.5">{passwordError}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleUnlock} className="space-y-5">
              <div>
                <label
                  htmlFor="adminEmailInput"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2"
                >
                  Admin Email
                </label>
                <input
                  id="adminEmailInput"
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  autoComplete="username"
                  className="w-full px-3.5 py-3 bg-slate-50 border-2 border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:border-[#0b6537] focus:ring-2 focus:ring-[#0b6537]/20 outline-none transition-all"
                />
              </div>
              <div>
                <label
                  htmlFor="adminPasswordInput"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2"
                >
                  Admin Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4 text-[#0b6537]" />
                  </div>
                  <input
                    id="adminPasswordInput"
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      if (passwordError) setPasswordError(null);
                    }}
                    placeholder="Enter local admin password"
                    autoFocus
                    autoComplete="current-password"
                    className="w-full pl-10 pr-11 py-3.5 bg-slate-50 border-2 border-slate-300 rounded-xl text-base font-mono font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#0b6537] focus:ring-2 focus:ring-[#0b6537]/20 outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-4 px-6 bg-[#0b6537] hover:bg-[#074625] active:scale-[0.99] text-white font-bold text-base rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <Unlock className="w-5 h-5" />
                <span>Unlock Admin Portal</span>
              </button>

              <button
                type="button"
                onClick={handleExitAdmin}
                className="w-full py-2.5 px-4 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                &larr; Return to Candidate Portal
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Admin Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0b6537] p-5 rounded-2xl text-white border-l-8 border-[#22c55e] shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-[#22c55e] text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded">
              ADMIN CONTROL CENTER
            </span>
            <span className="text-xs text-emerald-100">
              UNEC Faculty of Law &bull; Student Quiz Competition Portal
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight mt-1">
            Student Quiz Competition - Administration
          </h1>
          <p className="text-xs text-emerald-100">
            Manage courses, tests, questions bank, scheduling, student roster, and result grading.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleLockAdmin}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-800 hover:bg-red-700 text-white font-semibold text-xs rounded-xl border border-red-700 transition-colors shadow-xs cursor-pointer"
            title="Lock Admin Portal"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Lock Portal</span>
          </button>
          <button
            onClick={handleExitAdmin}
            className="px-4 py-2 bg-[#074625] hover:bg-[#063b20] text-emerald-200 font-semibold text-xs rounded-xl border border-emerald-600 transition-colors cursor-pointer"
          >
            Switch to Candidate Portal
          </button>
        </div>
      </div>

      {/* Admin Tab Bar */}
      <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar gap-2 sm:gap-3">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`pb-3 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
            activeTab === 'dashboard'
              ? 'border-emerald-800 text-emerald-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Overview
        </button>

        <button
          onClick={() => setActiveTab('courses')}
          className={`pb-3 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
            activeTab === 'courses'
              ? 'border-emerald-800 text-emerald-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Courses ({courses.length})
        </button>

        <button
          onClick={() => setActiveTab('quizzes')}
          className={`pb-3 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
            activeTab === 'quizzes'
              ? 'border-emerald-800 text-emerald-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Quizzes ({quizzes.length})
        </button>

        <button
          onClick={() => setActiveTab('questions')}
          className={`pb-3 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
            activeTab === 'questions'
              ? 'border-emerald-800 text-emerald-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Questions Editor
        </button>

        <button
          onClick={() => setActiveTab('schedule')}
          className={`pb-3 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
            activeTab === 'schedule'
              ? 'border-emerald-800 text-emerald-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Scheduler & Timers
        </button>

        <button
          onClick={() => setActiveTab('results')}
          className={`pb-3 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
            activeTab === 'results'
              ? 'border-emerald-800 text-emerald-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Results Manager
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={`pb-3 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
            activeTab === 'students'
              ? 'border-emerald-800 text-emerald-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Students Roster ({students.length})
        </button>

        <button
          onClick={() => setActiveTab('notifications')}
          className={`pb-3 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
            activeTab === 'notifications'
              ? 'border-emerald-800 text-emerald-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Broadcasts ({notifications.length})
        </button>

        <button
          onClick={() => setActiveTab('grading')}
          className={`pb-3 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
            activeTab === 'grading'
              ? 'border-emerald-800 text-emerald-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Grading Scale
        </button>
      </div>

      {/* 1. OVERVIEW DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-semibold uppercase block">
                Total Enrolled
              </span>
              <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
                {students.length}
              </span>
              <span className="text-[11px] text-emerald-700 font-medium">
                030 Law Class, UNEC
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-semibold uppercase block">
                Active Courses
              </span>
              <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
                {courses.length}
              </span>
              <span className="text-[11px] text-emerald-700 font-medium">
                400-Level Curriculum
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-semibold uppercase block">
                Quizzes Created
              </span>
              <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
                {quizzes.length}
              </span>
              <span className="text-[11px] text-emerald-700 font-medium">
                {quizzes.filter((q) => q.status === 'active').length} Active Now
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-semibold uppercase block">
                Submissions Logged
              </span>
              <span className="text-2xl font-black text-emerald-800 font-mono mt-1 block">
                {results.length}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Auto-calculated scores
              </span>
            </div>
          </div>

          {/* Quick Actions and Architecture Note */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#22c55e]" />
                Quick Admin Actions
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setEditingQuiz(null);
                    setShowQuizModal(true);
                  }}
                  className="p-3 bg-slate-50 hover:bg-emerald-50 rounded-xl border border-slate-200 text-left text-xs font-semibold text-slate-800 transition-colors flex items-center justify-between"
                >
                  <span>+ Create New Quiz</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <button
                  onClick={() => {
                    setEditingCourse(null);
                    setShowCourseModal(true);
                  }}
                  className="p-3 bg-slate-50 hover:bg-emerald-50 rounded-xl border border-slate-200 text-left text-xs font-semibold text-slate-800 transition-colors flex items-center justify-between"
                >
                  <span>+ Add Course</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <button
                  onClick={() => setActiveTab('questions')}
                  className="p-3 bg-slate-50 hover:bg-emerald-50 rounded-xl border border-slate-200 text-left text-xs font-semibold text-slate-800 transition-colors flex items-center justify-between"
                >
                  <span>Edit 70 Questions</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <button
                  onClick={() => setShowNotifModal(true)}
                  className="p-3 bg-slate-50 hover:bg-emerald-50 rounded-xl border border-slate-200 text-left text-xs font-semibold text-slate-800 transition-colors flex items-center justify-between"
                >
                  <span>Broadcast Notice</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Architecture note for the local JSON backend */}
            <div className="bg-emerald-50/80 rounded-2xl p-6 border border-emerald-200 shadow-xs space-y-2 text-xs text-emerald-950">
              <div className="flex items-center gap-2 font-bold text-emerald-900">
                <Database className="w-4 h-4 text-emerald-700" />
                Local JSON Backend
              </div>
              <p className="leading-relaxed text-emerald-900/80">
                This local prototype stores data in structured JSON files. The repository methods
                (`cbtStorage.saveResult`, `getStudents`, `scheduleQuiz`) map to local backend resources:
              </p>
              <ul className="list-disc pl-5 space-y-1 font-mono text-[11px] text-emerald-800">
                <li><code>students/</code> - 356 Verified UNEC candidates</li>
                <li><code>courses/</code> &amp; <code>quizzes/</code> - Dynamic exam configs</li>
                <li><code>attempts/</code> &amp; <code>results/</code> - Persistent local scores</li>
              </ul>
              <p className="text-[11px] text-slate-500 italic pt-1">
                Changes are written to <code>server/data/</code> and are available to the local portal.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. COURSES MANAGEMENT */}
      {activeTab === 'courses' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Course Management</h2>
              <p className="text-xs text-slate-500">
                Manage the 100 Level course catalogue and edit courses dynamically.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={async () => {
                  if (!confirm('Delete all courses except PHIL 101?')) return;
                  try {
                    await cbtStorage.keepOnlyPhil101();
                    refreshData();
                  } catch (error) {
                    console.error('Course cleanup failed:', error);
                    alert('Course cleanup failed. Confirm local administrator access.');
                  }
                }}
                className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Trash2 className="w-4 h-4" />
                <span>Keep PHIL 101 Only</span>
              </button>
              <button
                onClick={() => {
                  setEditingCourse(null);
                  setCourseForm({
                    code: '',
                    title: '',
                    description: '',
                    creditUnits: 4,
                    semester: 'First Semester',
                    lecturer: '',
                  });
                  setShowCourseModal(true);
                }}
                className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add Course</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {courses.map((course) => (
              <div
                key={course.id}
                className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-mono font-bold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded">
                      {course.code}
                    </span>
                    <span className="text-xs text-slate-500 font-semibold">
                      {course.creditUnits} Units &bull; {course.semester}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-2">
                    {course.title}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {course.description}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono mt-2">
                    Lecturer(s): {course.lecturer || 'Faculty Board'}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setEditingCourse(course);
                      setCourseForm({ ...course });
                      setShowCourseModal(true);
                    }}
                    className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-medium flex items-center gap-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => handleDeleteCourse(course.id)}
                    className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-medium flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. QUIZZES MANAGEMENT */}
      {activeTab === 'quizzes' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Quiz & Examination Manager</h2>
              <p className="text-xs text-slate-500">
                Create and configure quizzes. Set dates, start times, and durations.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingQuiz(null);
                setQuizForm({
                  courseId: courses[0]?.id || '',
                  title: '',
                  durationMinutes: 25,
                  date: new Date().toISOString().slice(0, 10),
                  startTime: '13:00',
                  endTime: '13:25',
                  instructions: '1. Answer all questions.\n2. Exam ends automatically at 00:00.',
                });
                setShowQuizModal(true);
              }}
              className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create Quiz</span>
            </button>
          </div>

          <div className="space-y-3">
            {quizzes.map((q) => (
              <div
                key={q.id}
                className="p-5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded">
                      {q.courseCode}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        q.status === 'active'
                          ? 'bg-emerald-700 text-white'
                          : q.status === 'completed'
                          ? 'bg-slate-300 text-slate-800'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}
                    >
                      {q.status}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{q.title}</h3>
                  <p className="text-xs text-slate-500">
                    Day: <span className="font-semibold text-slate-700">{q.date}</span> &bull; Time:{' '}
                    <span className="font-semibold text-slate-700">{q.startTime}</span> &bull; Duration:{' '}
                    <span className="font-semibold text-emerald-800">
                      {q.durationMinutes} Minutes
                    </span>{' '}
                    &bull; Questions:{' '}
                    <span className="font-semibold text-slate-700">
                      {q.questions.length} Questions
                    </span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {q.status === 'active' ? (
                    <button
                      onClick={() => handleToggleQuizStatus(q, 'scheduled')}
                      className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Pause className="w-3.5 h-3.5" /> Deactivate
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleQuizStatus(q, 'active')}
                      className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs"
                      title="Make quiz active immediately for students"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" /> Activate Now
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setSelectedQuizForQuestions(q.id);
                      setActiveTab('questions');
                    }}
                    className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold"
                  >
                    Questions ({q.questions.length})
                  </button>

                  <button
                    onClick={() => {
                      setSelectedQuizForResults(q.id);
                      setActiveTab('results');
                    }}
                    className="px-3 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-900 hover:bg-emerald-100 rounded-xl text-xs font-semibold"
                  >
                    Results
                  </button>

                  <button
                    onClick={() => {
                      setEditingQuiz(q);
                      setQuizForm({
                        courseId: q.courseId,
                        title: q.title,
                        durationMinutes: q.durationMinutes,
                        date: q.date,
                        startTime: q.startTime,
                        endTime: q.endDateTime
                          ? new Date(q.endDateTime).toISOString().slice(11, 16)
                          : `${String(Math.floor((new Date(q.scheduledDateTime).getTime() / 60000 + q.durationMinutes) % 1440 / 60)).padStart(2, '0')}:${String((new Date(q.scheduledDateTime).getMinutes() + q.durationMinutes) % 60).padStart(2, '0')}`,
                        instructions: q.instructions,
                      });
                      setShowQuizModal(true);
                    }}
                    className="p-2 text-slate-500 hover:text-slate-800"
                    title="Edit Quiz details"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteQuiz(q.id)}
                    className="p-2 text-slate-400 hover:text-red-600"
                    title="Delete Quiz"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. QUESTIONS BANK (UP TO 70 QUESTIONS) */}
      {activeTab === 'questions' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Question Bank Editor ({activeQuizForQ ? activeQuizForQ.questions.length : 0} Questions)
              </h2>
              <p className="text-xs text-slate-500">
                Add, modify or delete questions with multiple-choice options A, B, C, D and correct
                answers.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedQuizForQuestions}
                onChange={(e) => setSelectedQuizForQuestions(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium"
              >
                {quizzes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.courseCode}: {q.title} ({q.questions.length} Qs)
                  </option>
                ))}
              </select>

              <button
                onClick={() => {
                  setEditingQuestion(null);
                  setQuestionForm({
                    questionText: '',
                    optA: '',
                    optB: '',
                    optC: '',
                    optD: '',
                    correctAnswer: 'A',
                    explanation: '',
                  });
                  setShowQuestionModal(true);
                }}
                className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
              >
                <Plus className="w-4 h-4" />
                <span>Add Question</span>
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-emerald-950">Import question document</h3>
                <p className="mt-1 text-xs text-emerald-900/70">
                  Upload a text-based PDF, DOCX, or paste questions. Use numbered questions with
                  options A-D and an optional Answer: A line.
                </p>
              </div>
              <label className="shrink-0 cursor-pointer rounded-xl bg-emerald-800 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-900">
                <Upload className="mr-1 inline h-4 w-4" />
                {isImportingQuestions ? 'Reading...' : 'Upload'}
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  className="hidden"
                  disabled={isImportingQuestions}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleQuestionFileImport(file);
                    event.currentTarget.value = '';
                  }}
                />
              </label>
            </div>
            <textarea
              rows={5}
              value={questionImportText}
              onChange={(event) => setQuestionImportText(event.target.value)}
              placeholder={'1. What is the supreme law?\nA. Constitution\nB. Statute\nC. Case law\nD. Custom\nAnswer: A'}
              className="mt-3 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-emerald-900">{questionImportStatus}</span>
              <button
                type="button"
                onClick={handleQuestionPasteImport}
                disabled={!questionImportText.trim() || isImportingQuestions}
                className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Parse pasted questions
              </button>
            </div>
          </div>

          {/* List of Questions */}
          <div className="space-y-4">
            {activeQuizForQ?.questions.map((q, idx) => (
              <div
                key={q.id}
                className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3"
              >
                <div className="flex justify-between items-start">
                  <span className="text-xs font-mono font-bold bg-emerald-800 text-white px-2.5 py-0.5 rounded-md">
                    Question {idx + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingQuestion(q);
                        setQuestionForm({
                          questionText: q.questionText,
                          optA: q.options.A,
                          optB: q.options.B,
                          optC: q.options.C,
                          optD: q.options.D,
                          correctAnswer: q.correctAnswer,
                          explanation: q.explanation || '',
                        });
                        setShowQuestionModal(true);
                      }}
                      className="text-xs font-medium text-slate-600 hover:text-emerald-800 px-2 py-1 rounded hover:bg-slate-200"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="text-xs font-medium text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <p className="text-sm font-semibold text-slate-900">{q.questionText}</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {(['A', 'B', 'C', 'D'] as OptionKey[]).map((opt) => (
                    <div
                      key={opt}
                      className={`p-2 rounded-lg border flex items-center gap-2 ${
                        q.correctAnswer === opt
                          ? 'bg-emerald-100 border-emerald-400 font-bold text-emerald-950'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <span className="font-mono">{opt}.</span>
                      <span>{q.options[opt]}</span>
                      {q.correctAnswer === opt && (
                        <span className="ml-auto text-[10px] bg-emerald-800 text-white px-1.5 py-0.2 rounded">
                          CORRECT
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {q.explanation && (
                  <p className="text-[11px] text-slate-500 italic bg-white p-2 rounded-lg border border-slate-100">
                    <strong>Reference:</strong> {q.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. SCHEDULE & TIMERS */}
      {activeTab === 'schedule' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Quiz Scheduling Controller</h2>
            <p className="text-xs text-slate-500">
              Set exact availability times. When scheduled time is reached, students can access
              the exam simultaneously.
            </p>
          </div>

          <div className="space-y-4">
            {quizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="p-5 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4 items-center"
              >
                <div>
                  <span className="text-xs font-mono font-bold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded">
                    {quiz.courseCode}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 mt-1">{quiz.title}</h3>
                  <p className="text-xs text-slate-500">{quiz.questions.length} Questions</p>
                </div>

                <div className="text-xs space-y-1">
                  <p>
                    <strong className="text-slate-600">Quiz Day:</strong> {quiz.date}
                  </p>
                  <p>
                    <strong className="text-slate-600">Start Time:</strong> {quiz.startTime}
                  </p>
                  <p>
                    <strong className="text-slate-600">Duration:</strong> {quiz.durationMinutes}{' '}
                    Minutes
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-end gap-2">
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${
                      quiz.status === 'active'
                        ? 'bg-emerald-700 text-white animate-pulse'
                        : quiz.status === 'scheduled'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {quiz.status}
                  </span>

                  {quiz.status === 'active' ? (
                    <button
                      onClick={() => handleToggleQuizStatus(quiz, 'scheduled')}
                      className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Close Quiz
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleQuizStatus(quiz, 'active')}
                      className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold"
                    >
                      Start Now
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditingQuiz(quiz);
                      setQuizForm({
                        courseId: quiz.courseId,
                        title: quiz.title,
                        durationMinutes: quiz.durationMinutes,
                        date: quiz.date,
                        startTime: quiz.startTime,
                        endTime: quiz.endDateTime
                          ? new Date(quiz.endDateTime).toISOString().slice(11, 16)
                          : quiz.startTime,
                        instructions: quiz.instructions,
                      });
                      setShowQuizModal(true);
                    }}
                    className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold"
                  >
                    Edit Quiz
                  </button>
                  <button
                    onClick={() => handleDeleteQuiz(quiz.id)}
                    className="px-3 py-1.5 bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 rounded-xl text-xs font-semibold"
                  >
                    Delete Quiz
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. RESULTS MANAGER */}
      {activeTab === 'results' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Examination Results Management
              </h2>
              <p className="text-xs text-slate-500">
                View submitted scores, search candidates, download CSV, or manage deletion.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedQuizForResults}
                onChange={(e) => setSelectedQuizForResults(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium"
              >
                {quizzes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.courseCode}: {q.title}
                  </option>
                ))}
              </select>

              <button
                onClick={exportResultsCSV}
                className="px-3 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-semibold flex items-center gap-1 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>

              {activeQuizForResults && (
                <button
                  onClick={() => handleDeleteAllQuizResults(activeQuizForResults.id)}
                  className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-xs font-semibold flex items-center gap-1"
                  title="Delete all results for this quiz"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All</span>
                </button>
              )}
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search candidate name or reg number..."
              value={resultSearch}
              onChange={(e) => setResultSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-emerald-700"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-semibold">
                  <th className="p-3 w-14 text-center">Rank</th>
                  <th className="p-3">Student Name</th>
                  <th className="p-3 font-mono">Reg Number</th>
                  <th className="p-3 text-center">Score</th>
                  <th className="p-3 text-center">Percentage</th>
                  <th className="p-3 text-center">Grade</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQuizResults.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="p-3 text-center font-bold">
                      {cbtStorage.getRankSuffix(r.rank || 1)}
                    </td>
                    <td className="p-3 font-semibold text-slate-900">{r.studentName}</td>
                    <td className="p-3 font-mono text-emerald-800">{r.studentRegNo}</td>
                    <td className="p-3 text-center font-bold">
                      {r.score}/{r.totalQuestions}
                    </td>
                    <td className="p-3 text-center font-mono">{r.percentage.toFixed(2)}%</td>
                    <td className="p-3 text-center font-bold">{r.grade}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleDeleteResult(r.id)}
                        className="text-red-600 hover:text-red-800 font-medium px-2 py-1 rounded hover:bg-red-50 text-[11px]"
                      >
                        Delete Result
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredQuizResults.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400 text-xs">
                      No results found for this examination.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. STUDENTS ROSTER (356 STUDENTS) */}
      {activeTab === 'students' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                100 Level Student Database ({students.length} Candidates)
              </h2>
              <p className="text-xs text-slate-500">
                Official class roster loaded directly from UNEC official class list.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={async () => {
                  try {
                    await cbtStorage.uploadClassListToLocalBackend();
                    setClassListStatus('Class list saved to local JSON storage.');
                  } catch (error) {
                    console.error('Class list upload failed:', error);
                    setClassListStatus('Save failed. Confirm the local backend is running.');
                  }
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Class List</span>
              </button>
              <button
                onClick={() => setShowStudentModal(true)}
                className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
              >
                <Plus className="w-4 h-4" />
                <span>Add Candidate</span>
              </button>
            </div>
          </div>
          {classListStatus && <p className="text-xs font-semibold text-emerald-800">{classListStatus}</p>}

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search student by name or registration number..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-emerald-700"
            />
          </div>

          <div className="overflow-x-auto max-h-[550px]">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-100 text-slate-700 font-semibold z-10">
                <tr>
                  <th className="p-3 w-16 text-center">S/N</th>
                  <th className="p-3">Candidate Full Name</th>
                  <th className="p-3 font-mono">Registration Number</th>
                  <th className="p-3">Level / Class</th>
                  <th className="p-3">Campus</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((st) => (
                  <tr key={st.sn + st.regNo} className="hover:bg-slate-50">
                    <td className="p-3 text-center font-mono text-slate-400">{st.sn}</td>
                    <td className="p-3 font-semibold text-slate-900">{st.name}</td>
                    <td className="p-3 font-mono font-bold text-emerald-800">{st.regNo}</td>
                    <td className="p-3 text-slate-600">
                      {st.level} ({st.class})
                    </td>
                    <td className="p-3 text-slate-500">{st.campus}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => {
                          if (confirm(`Remove ${st.name} from student database?`)) {
                            cbtStorage.deleteStudent(st.regNo);
                            refreshData();
                          }
                        }}
                        className="text-red-500 hover:text-red-700 text-xs px-2 py-1"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 8. BROADCASTS & NOTIFICATIONS */}
      {activeTab === 'notifications' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Broadcasts & Notifications Manager
              </h2>
              <p className="text-xs text-slate-500">
                Send official alerts to student dashboards (e.g. Constitutional Law Quiz starts
                today at 1:00 PM).
              </p>
            </div>

            <button
              onClick={() => setShowNotifModal(true)}
              className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
            >
              <Plus className="w-4 h-4" />
              <span>Create Announcement</span>
            </button>
          </div>

          <div className="space-y-3">
            {notifications.map((n) => (
              <div
                key={n.id}
                className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-start justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-emerald-800 uppercase">
                      {n.targetCourse || 'ALL FACULTY'}
                    </span>
                    <span className="text-slate-400">&bull;</span>
                    <span className="text-slate-400">{n.date}</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">{n.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>
                </div>

                <button
                  onClick={() => {
                    cbtStorage.deleteNotification(n.id);
                    refreshData();
                  }}
                  className="text-red-500 hover:text-red-700 text-xs p-1"
                  title="Delete announcement"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 9. GRADING SCALE CONFIGURATION */}
      {activeTab === 'grading' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Grading System Configuration
            </h2>
            <p className="text-xs text-slate-500">
              Configure university grade boundaries. Changes apply automatically to all score
              calculations.
            </p>
          </div>

          <div className="space-y-3">
            {config.gradingScale.map((b, index) => (
              <div
                key={b.grade}
                className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3 items-center text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-emerald-800 text-white font-bold flex items-center justify-center text-sm font-serif">
                    {b.grade}
                  </span>
                  <span className="font-semibold text-slate-800">{b.description}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Min %:</span>
                  <input
                    type="number"
                    value={b.minPercent}
                    onChange={(e) => {
                      const updated = [...config.gradingScale];
                      updated[index].minPercent = Number(e.target.value);
                      cbtStorage.updateGradingScale(updated);
                      refreshData();
                    }}
                    className="w-20 px-2 py-1 border border-slate-300 rounded font-mono bg-white"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Max %:</span>
                  <input
                    type="number"
                    value={b.maxPercent}
                    onChange={(e) => {
                      const updated = [...config.gradingScale];
                      updated[index].maxPercent = Number(e.target.value);
                      cbtStorage.updateGradingScale(updated);
                      refreshData();
                    }}
                    className="w-20 px-2 py-1 border border-slate-300 rounded font-mono bg-white"
                  />
                </div>

                <div className="text-right text-[11px] text-slate-400 font-mono">
                  Points: {b.points || 0}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 text-[11px] text-slate-400">
            Standard Nigerian University Commission (NUC) 5-point grading benchmark: A (70-100%), B
            (65-69%), C (60-64%), D (55-59%), E (50-54%), F (0-49%).
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT COURSE */}
      {showCourseModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {editingCourse ? 'Edit Course' : 'Add New Course'}
              </h3>
              <button
                onClick={() => setShowCourseModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveCourse} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Course Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. LAW 411"
                    value={courseForm.code}
                    onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Credit Units
                  </label>
                  <input
                    type="number"
                    value={courseForm.creditUnits}
                    onChange={(e) =>
                      setCourseForm({ ...courseForm, creditUnits: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Course Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Constitutional Law"
                  value={courseForm.title}
                  onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Course Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief synopsis of syllabus..."
                  value={courseForm.description}
                  onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Lecturer / Departmental Board
                </label>
                <input
                  type="text"
                  placeholder="e.g. Prof. C. O. Okeke, SAN"
                  value={courseForm.lecturer}
                  onChange={(e) => setCourseForm({ ...courseForm, lecturer: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCourseModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg shadow"
                >
                  Save Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT QUIZ */}
      {showQuizModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {editingQuiz ? 'Edit Examination' : 'Create New Examination / Quiz'}
              </h3>
              <button
                onClick={() => setShowQuizModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveQuiz} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Course *
                </label>
                <select
                  value={quizForm.courseId}
                  onChange={(e) => setQuizForm({ ...quizForm, courseId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} - {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Quiz / Exam Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Constitutional Law Mid-Semester CBT"
                  value={quizForm.title}
                  onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Day / Date
                  </label>
                  <input
                    type="date"
                    required
                    placeholder="Select exam date"
                    value={quizForm.date}
                    onChange={(e) => setQuizForm({ ...quizForm, date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Start Time
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 13:00 or 1:00 PM"
                    value={quizForm.startTime}
                    onChange={(e) => setQuizForm({ ...quizForm, startTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    required
                    value={quizForm.endTime}
                    onChange={(e) => setQuizForm({ ...quizForm, endTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Duration (Mins)
                  </label>
                  <input
                    type="number"
                    required
                    value={quizForm.durationMinutes}
                    onChange={(e) =>
                      setQuizForm({ ...quizForm, durationMinutes: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Candidate Instructions
                </label>
                <textarea
                  rows={2}
                  value={quizForm.instructions}
                  onChange={(e) => setQuizForm({ ...quizForm, instructions: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowQuizModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg shadow"
                >
                  Save Quiz
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT QUESTION */}
      {showQuestionModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {editingQuestion ? 'Edit Question' : 'Add Multiple Choice Question'}
              </h3>
              <button
                onClick={() => setShowQuestionModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveQuestion} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Question Text *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. What is the supreme law of Nigeria?"
                  value={questionForm.questionText}
                  onChange={(e) =>
                    setQuestionForm({ ...questionForm, questionText: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="space-y-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Option A *</label>
                  <input
                    type="text"
                    required
                    value={questionForm.optA}
                    onChange={(e) => setQuestionForm({ ...questionForm, optA: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Option B *</label>
                  <input
                    type="text"
                    required
                    value={questionForm.optB}
                    onChange={(e) => setQuestionForm({ ...questionForm, optB: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Option C</label>
                  <input
                    type="text"
                    value={questionForm.optC}
                    onChange={(e) => setQuestionForm({ ...questionForm, optC: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Option D</label>
                  <input
                    type="text"
                    value={questionForm.optD}
                    onChange={(e) => setQuestionForm({ ...questionForm, optD: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Select Correct Answer *
                </label>
                <div className="flex gap-4">
                  {(['A', 'B', 'C', 'D'] as OptionKey[]).map((opt) => (
                    <label key={opt} className="flex items-center gap-1.5 font-bold cursor-pointer">
                      <input
                        type="radio"
                        name="correctAnswer"
                        value={opt}
                        checked={questionForm.correctAnswer === opt}
                        onChange={() =>
                          setQuestionForm({ ...questionForm, correctAnswer: opt })
                        }
                      />
                      <span>Option {opt}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Statute / Case Law Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Section 1(1) 1999 Constitution"
                  value={questionForm.explanation}
                  onChange={(e) =>
                    setQuestionForm({ ...questionForm, explanation: e.target.value })
                  }
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowQuestionModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg shadow"
                >
                  Save Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD STUDENT */}
      {showStudentModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Add Candidate to Roster</h3>
              <button
                onClick={() => setShowStudentModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddStudent} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Candidate Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Okonkwo Chinedu Mark"
                  value={studentForm.name}
                  onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Registration Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2025/300999"
                  value={studentForm.regNo}
                  onChange={(e) => setStudentForm({ ...studentForm, regNo: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono uppercase"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowStudentModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg shadow"
                >
                  Add Candidate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE NOTIFICATION */}
      {showNotifModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Broadcast Notice to Students</h3>
              <button
                onClick={() => setShowNotifModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveNotification} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Course Tag
                </label>
                <input
                  type="text"
                  placeholder="e.g. LAW 411 or GENERAL"
                  value={notifForm.targetCourse}
                  onChange={(e) => setNotifForm({ ...notifForm, targetCourse: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Notice Headline *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Constitutional Law Quiz starts today at 1:00 PM"
                  value={notifForm.title}
                  onChange={(e) => setNotifForm({ ...notifForm, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Message Content *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Details for students..."
                  value={notifForm.message}
                  onChange={(e) => setNotifForm({ ...notifForm, message: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowNotifModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg shadow"
                >
                  Publish Notice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
