import React, { useEffect, useState } from 'react';
import { subscribeLiveBroadcasts, LiveBroadcast } from '../services/liveSync';

/**
 * LiveToasts — floating banner at the top of the student app.
 * Subscribes to the single Firestore document `liveAnnouncements/latest`
 * and pops in a colour-coded toast whenever the admin (Control Room) sends
 * a broadcast.  Auto-dismisses after 12 s unless it is an "end" kind.
 */
export const LiveToasts: React.FC = () => {
  const [broadcast, setBroadcast] = useState<LiveBroadcast | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const off = subscribeLiveBroadcasts((bc) => {
      if (!bc) return;
      setBroadcast(bc);
      setVisible(true);

      // Auto-dismiss after 12 s (end toasts stay until user dismisses)
      if (bc.kind !== 'end') {
        window.setTimeout(() => setVisible(false), 12000);
      }
    });
    return off;
  }, []);

  if (!broadcast || !visible) return null;

  const bg =
    broadcast.kind === 'live'
      ? 'bg-red-600 border-red-400'
      : broadcast.kind === 'warning'
      ? 'bg-amber-500 border-amber-300'
      : broadcast.kind === 'end'
      ? 'bg-slate-900 border-slate-600'
      : 'bg-emerald-700 border-emerald-400';

  const textCol =
    broadcast.kind === 'end' ? 'text-white' : 'text-white';

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-3 px-4 py-3 shadow-lg border-b anim-pop ${bg} ${textCol}`}
      role="alert"
    >
      <p className="text-sm font-bold flex-1 text-center">{broadcast.message}</p>
      <button
        onClick={() => setVisible(false)}
        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-black"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
};