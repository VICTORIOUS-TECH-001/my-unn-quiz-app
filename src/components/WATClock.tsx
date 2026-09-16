import React, { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';
import { firebaseNow } from '../services/firebase';
import { formatWATClock, formatWATDate } from '../services/watTime';

/**
 * Live universal-time card. Every schedule in the portal runs on West
 * African Time, so whatever the admin sets applies to all users equally.
 */
export const WATClock: React.FC = () => {
  const [now, setNow] = useState<number>(() => firebaseNow());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(firebaseNow()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="rounded-2xl p-4 bg-gradient-to-br from-emerald-950 via-green-900 to-emerald-950 border border-emerald-400/30 text-white shadow-lg relative overflow-hidden">
      <div className="arena-orb arena-orb-a" style={{ width: 160, height: 160 }} />
      <div className="relative flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-lime-200">
            <Globe className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '8s' }} />
            Universal Time • WAT (UTC+1)
          </div>
          <div className="mt-1 text-2xl font-black font-mono tracking-tight text-white">
            {formatWATClock(now)}
          </div>
          <div className="text-[11px] text-emerald-100/80">{formatWATDate(now)}</div>
        </div>
        <div className="text-right shrink-0">
          <span className="live-badge">● LIVE</span>
          <p className="mt-1.5 text-[10px] leading-snug text-emerald-100/70 max-w-[130px]">
            One clock for admin + all students
          </p>
        </div>
      </div>
    </div>
  );
};
