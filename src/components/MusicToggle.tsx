import React, { useEffect, useState } from 'react';
import { Music, Volume2, VolumeX } from 'lucide-react';
import { focusMusic } from '../services/music';

/**
 * Floating focus-music controller. Students can turn the smooth background
 * sound on/off and adjust volume. Hidden while printing.
 */
export const MusicToggle: React.FC = () => {
  const [playing, setPlaying] = useState(focusMusic.isPlaying());
  const [volume, setVolume] = useState(focusMusic.getVolume());
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const off = focusMusic.subscribe((isPlaying) => setPlaying(isPlaying));
    const unlockOnce = () => focusMusic.unlock();
    window.addEventListener('pointerdown', unlockOnce, { once: true });
    window.addEventListener('keydown', unlockOnce, { once: true });
    // If preference is on, reflect it once audio unlocks.
    setPlaying(focusMusic.isPlaying());
    return () => {
      off();
      window.removeEventListener('pointerdown', unlockOnce);
      window.removeEventListener('keydown', unlockOnce);
    };
  }, []);

  const handleToggle = () => {
    void focusMusic.toggle();
  };

  return (
    <div className="print:hidden fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-2">
      {expanded && (
        <div className="music-pop glass-strong rounded-2xl p-3 w-56 shadow-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5 text-emerald-300" />
              Focus Music
            </span>
            <span className="text-[10px] font-mono text-emerald-200/80">
              {playing ? 'PLAYING' : 'PAUSED'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <VolumeX className="w-4 h-4 text-white/60 shrink-0" />
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              onChange={(e) => {
                const v = Number(e.target.value) / 100;
                setVolume(v);
                focusMusic.setVolume(v);
              }}
              className="music-slider flex-1"
              aria-label="Music volume"
            />
            <Volume2 className="w-4 h-4 text-white/60 shrink-0" />
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-white/60">
            Smooth gaming ambience to keep you focused. Turn it off anytime.
          </p>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="glass-strong text-white text-[11px] font-semibold px-3 py-2 rounded-full shadow-xl hover:scale-105 active:scale-95 transition-transform"
          title="Music settings"
        >
          {playing ? '🎧 Focus ON' : '🎧 Focus OFF'}
        </button>
        <button
          onClick={handleToggle}
          title={playing ? 'Turn focus music off' : 'Turn focus music on'}
          className={`relative w-12 h-12 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${
            playing
              ? 'bg-gradient-to-br from-emerald-400 via-green-500 to-teal-600 glow-green'
              : 'glass-strong text-white/80'
          }`}
        >
          {playing ? (
            <span className="eq-bars" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </span>
          ) : (
            <VolumeX className="w-5 h-5" />
          )}
          {playing && (
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-lime-300 animate-ping" />
          )}
        </button>
      </div>
    </div>
  );
};
