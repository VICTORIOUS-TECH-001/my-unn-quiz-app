import React, { useEffect, useState } from 'react';
import { Quiz } from '../types';
import { ExamControl, subscribeExamControl } from '../services/liveSync';
import { formatWATTime } from '../services/watTime';

interface LiveWindowBarProps {
  quiz: Quiz;
}

/**
 * LiveWindowBar — shared-exam countdown shown on the student dashboard.
 * Subscribes to `examControl/{quiz.id}` and renders:
 *   • a green "LIVE" bar with the shared-window close time, or
 *   • a blue "UPCOMING" bar with the scheduled start, or
 *   • nothing if there is no live control record yet.
 */
export const LiveWindowBar: React.FC<LiveWindowBarProps> = ({ quiz }) => {
  const [ctrl, setCtrl] = useState<ExamControl | null>(null);

  useEffect(() => {
    const off = subscribeExamControl(quiz.id, setCtrl);
    return off;
  }, [quiz.id]);

  if (!ctrl) return null;

  // Active exam with a shared window
  if (ctrl.status === 'active' && ctrl.windowEndMs > 0) {
    return (
      <div className="rounded-xl px-4 py-2.5 bg-emerald-950 text-white flex items-center justify-between gap-2 text-[11px] font-mono shadow-md anim-pop">
        <span className="flex items-center gap-1.5 font-bold text-lime-200">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          LIVE — SHARED WINDOW
        </span>
        <span className="text-emerald-100">
          Closes {formatWATTime(ctrl.windowEndMs)} WAT
          {ctrl.extraMinutes > 0 && (
            <span className="ml-2 font-bold text-amber-300">
              +{ctrl.extraMinutes} min added
            </span>
          )}
        </span>
      </div>
    );
  }

  // Scheduled (not yet started)
  if (ctrl.status === 'scheduled' && ctrl.scheduledStartMs > 0) {
    return (
      <div className="rounded-xl px-4 py-2.5 bg-sky-900 text-sky-100 flex items-center justify-between gap-2 text-[11px] font-mono shadow-sm anim-rise">
        <span className="flex items-center gap-1.5 font-bold">
          <span className="w-2 h-2 rounded-full bg-sky-400" />
          SCHEDULED
        </span>
        <span>
          Starts {formatWATTime(ctrl.scheduledStartMs)} WAT
        </span>
      </div>
    );
  }

  // Completed / cancelled — nothing to show
  return null;
};