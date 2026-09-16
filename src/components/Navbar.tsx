import React, { useEffect, useState } from 'react';
import { UNNLogo } from './UNNLogo';
import {
  LogOut,
  Clock,
  ShieldCheck,
  BookOpen,
  Award,
} from 'lucide-react';
import { Student } from '../types';
import { firebaseNow } from '../services/firebase';

interface NavbarProps {
  currentStudent: Student | null;
  currentView: string;
  onNavigate: (view: any) => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentStudent,
  currentView,
  onNavigate,
  onLogout,
}) => {
  const [watTime, setWatTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date(firebaseNow());
      const timeStr = now.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const dateStr = now.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
      setWatTime(`${dateStr} • ${timeStr} WAT`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-40 shadow-md">
      {/* 1. Official UNN Header Banner */}
      <div className="bg-white border-b-2 border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
          {/* Official Logo Banner */}
          <div
            className="cursor-pointer"
            onClick={() => {
              if (currentView === 'admin') onNavigate('admin');
              else if (currentStudent) onNavigate('dashboard');
              else onNavigate('login');
            }}
          >
            <UNNLogo
              size="md"
              subText="to restore the dignity of man"
              textColor="text-[#0b6537]"
            />
          </div>

          {/* Right Header Badges and Quick Tools */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex flex-col text-right">
              <span className="text-xs font-mono font-bold text-[#0b6537] tracking-wider uppercase">
                Faculty of Law &bull; UNEC
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Student Quiz Competition Portal
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-1 font-mono text-xs text-[#0b6537] bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              <Clock className="w-3.5 h-3.5 text-[#0b6537]" />
              <span>{watTime}</span>
            </div>

          </div>
        </div>
      </div>

      {/* 2. Official UNN Solid Green Bar with UNN Light Green Accent Stripe */}
      <div className="bg-[#0b6537] text-white px-4 sm:px-6 py-2 border-b-4 border-[#22c55e]">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Navigation Links */}
          <div className="flex items-center gap-2">
            {currentView === 'admin' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-[#22c55e] text-white uppercase tracking-wide font-mono">
                <ShieldCheck className="w-3.5 h-3.5" />
                Staff Administrator Portal
              </span>
            ) : currentStudent ? (
              <nav className="flex items-center gap-1.5 text-xs">
                <button
                  onClick={() => onNavigate('dashboard')}
                  className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                    currentView === 'dashboard'
                      ? 'bg-[#074625] text-white shadow-xs'
                      : 'text-emerald-100 hover:bg-[#074625]/60'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    Dashboard
                  </span>
                </button>
                <button
                  onClick={() => onNavigate('past-results')}
                  className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                    currentView === 'past-results' || currentView === 'results'
                      ? 'bg-[#074625] text-white shadow-xs'
                      : 'text-emerald-100 hover:bg-[#074625]/60'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5" />
                    Past Results
                  </span>
                </button>
              </nav>
            ) : (
              <span className="text-xs font-bold text-emerald-100 uppercase tracking-wider font-mono">
                Student Quiz Competition Portal
              </span>
            )}
          </div>

          {/* User Session Status */}
          <div className="flex items-center gap-3">
            {currentView === 'admin' ? (
              <button
                onClick={() => {
                  try {
                    sessionStorage.removeItem('unn_admin_unlocked');
                  } catch (e) {
                    console.error(e);
                  }
                  onNavigate(currentStudent ? 'dashboard' : 'login');
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#074625] hover:bg-[#063b20] text-emerald-200 text-xs font-medium border border-emerald-700 transition-colors cursor-pointer"
              >
                Exit Admin
              </button>
            ) : currentStudent ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-bold text-white tracking-wide leading-tight">
                    {currentStudent.name}
                  </div>
                  <div className="text-[10px] font-mono text-emerald-200">
                    {currentStudent.regNo}
                  </div>
                </div>
                <div
                  className="w-7 h-7 rounded-full bg-[#074625] border border-[#22c55e] flex items-center justify-center text-emerald-200 font-bold text-[11px] shadow-xs"
                  title={`Candidate: ${currentStudent.name}`}
                >
                  {currentStudent.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')}
                </div>
                <button
                  onClick={onLogout}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#074625] hover:bg-red-700 text-white text-xs font-medium transition-colors border border-emerald-700"
                  title="Sign out of student portal"
                >
                  <LogOut className="w-3 h-3" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => onNavigate('admin')}
                className="flex items-center gap-1.5 text-xs bg-[#074625] hover:bg-[#063b20] text-emerald-200 border border-emerald-700 px-3 py-1 rounded-lg transition-colors font-semibold anim-bounce-soft"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#22c55e]" />
                Staff Login
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
