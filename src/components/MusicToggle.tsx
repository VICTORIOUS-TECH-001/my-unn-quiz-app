import React, { useEffect, useState } from 'react';
import { ListMusic, Music, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { MUSIC_TRACKS, focusMusic } from '../services/music';

/**
 * Floating focus-music controller. Students pick from multiple stations,
 * turn the smooth background sound on/off and adjust volume.
 * Hidden while printing.
 */
export const MusicToggle: React.FC = () => {
  const [playing, setPlaying] = useState(focusMusic.isPlaying());
  const [volume, setVolume] = useState(focusMusic.getVolume());
  const [trackId, setTrackId] = useState(focusMusic.getTrackId());
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const offPlay = focusMusic.subscribe((isPlaying) => setPlaying(isPlaying));
    const offTrack = focusMusic.onTrackChange((id) => setTrackId(id));
    const unlockOnce = () => focusMusic.unlock();
    window.addEventListener('pointerdown', unlockOnce, { once: true });
    window.addEventListener('keydown', unlockOnce, { once: true });
    setPlaying(focusMusic.isPlaying());
    setTrackId(focusMusic.getTrackId());
    return () => {
      offPlay();
      offTrack();
      window.removeEventListener('pointerdown', unlockOnce);
      window.removeEventListener('keydown', unlockOnce);
    };
  }, []);

  const handleToggle = () => {
    void focusMusic.toggle();
  };

  const cycleTrack = () => {
    const idx = MUSIC_TRACKS.findIndex((t) => t.id === trackId);
    const next = MUSIC_TRACKS[(idx + 1) % MUSIC_TRACKS.length];
    focusMusic.setTrack(next.id);
    if (!playing) void focusMusic.play();
  };

  const current = MUSIC_TRACKS.find((t) => t.id === trackId) || MUSIC_TRACKS[0];

  return (
    <div className="print:hidden fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-2">
      {expanded && (
        <div className="music-pop glass-strong rounded-2xl p-3 w-64 shadow-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <ListMusic className="w-3.5 h-3.5 text-emerald-300" />
              Focus Stations
            </span>
            <span className="text-[10px] font-mono text-emerald-200/80">
              {playing ? '● PLAYING' : '○ PAUSED'}
            </span>
          </div>

          {/* Station picker */}
          <div className="space-y-1.5">
            {MUSIC_TRACKS.map((track) => {
              const active = track.id === trackId;
              return (
                <button
                  key={track.id}
                  onClick={() => {
                    focusMusic.setTrack(track.id);
                    if (!playing) void focusMusic.play();
                  }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all ${
                    active
                      ? 'bg-gradient-to-r from-emerald-500/40 to-lime-500/30 border border-emerald-400/40 shadow-lg'
                      : 'bg-white/5 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  <span className="text-xl leading-none">{track.emoji}</span>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-xs font-bold truncate ${active ? 'text-white' : 'text-white/85'}`}>
                      {track.name}
                    </span>
                    <span className="block text-[10px] text-white/50 truncate">
                      {track.blurb}
                    </span>
                  </span>
                  {active && playing && (
                    <span className="eq-bars eq-bars-sm" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                  )}
                  {active && !playing && (
                    <Music className="w-4 h-4 text-emerald-300 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 mt-3">
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
            Pick a station 🎧 — smooth gaming ambience to keep you focused. Turn it off anytime.
          </p>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="glass-strong text-white text-[11px] font-semibold px-3 py-2 rounded-full shadow-xl hover:scale-105 active:scale-95 transition-transform max-w-[180px] truncate"
          title="Choose focus station"
        >
          {current.emoji} {current.name} • {playing ? 'ON' : 'OFF'}
        </button>
        <button
          onClick={cycleTrack}
          title="Next station"
          className="glass-strong w-10 h-10 rounded-full shadow-xl text-white/80 hover:text-white hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
        >
          <SkipForward className="w-4 h-4" />
        </button>
        <button
          onClick={handleToggle}
          title={playing ? 'Turn focus music off' : 'Turn focus music on'}
          className={`relative w-12 h-12 rounded-full shadow-2xl flex items-center justify-center transition-all music-float ${
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
