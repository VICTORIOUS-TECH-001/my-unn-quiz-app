/**
 * FocusMusic — generative "smooth gaming" ambient engine built on Web Audio.
 * No audio files needed: warm pads + soft plucks + airy shimmer, looping
 * forever while students study. Students pick from multiple stations,
 * toggle on/off and adjust volume; preferences persist in localStorage.
 */

export interface MusicPreset {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  chords: number[][];
  pluckScale: number[];
  chordMs: number;
  padCutoff: number;
  padLevel: number;
  pluckLevel: number;
  pluckDensity: number; // 0..1 probability a pluck plays each tick
  pluckGapMin: number; // ms
  pluckGapMax: number; // ms
  noiseLevel: number; // 0 = none (rain uses soft noise)
}

export const MUSIC_TRACKS: MusicPreset[] = [
  {
    id: 'ocean',
    name: 'Ocean Focus',
    emoji: '🌊',
    blurb: 'Calm waves of lo-fi pads',
    chords: [
      [130.81, 164.81, 196.0, 246.94, 293.66], // Cmaj9
      [110.0, 130.81, 164.81, 196.0, 246.94], // Am9
      [87.31, 130.81, 174.61, 220.0, 261.63], // Fmaj9
      [98.0, 146.83, 196.0, 246.94, 293.66], // Gadd9
    ],
    pluckScale: [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5],
    chordMs: 9000,
    padCutoff: 900,
    padLevel: 0.5,
    pluckLevel: 0.35,
    pluckDensity: 0.85,
    pluckGapMin: 1400,
    pluckGapMax: 4600,
    noiseLevel: 0,
  },
  {
    id: 'rain',
    name: 'Rainy Lo-fi',
    emoji: '🌧️',
    blurb: 'Soft rain + sleepy piano-ish drops',
    chords: [
      [110.0, 130.81, 164.81, 261.63], // Am(add9-ish)
      [87.31, 130.81, 174.61, 220.0], // F
      [130.81, 164.81, 196.0, 293.66], // C
      [98.0, 146.83, 196.0, 293.66], // G
    ],
    pluckScale: [440.0, 523.25, 587.33, 659.25, 783.99],
    chordMs: 11000,
    padCutoff: 650,
    padLevel: 0.42,
    pluckLevel: 0.3,
    pluckDensity: 0.6,
    pluckGapMin: 2200,
    pluckGapMax: 6000,
    noiseLevel: 0.045,
  },
  {
    id: 'space',
    name: 'Deep Space',
    emoji: '🌌',
    blurb: 'Low drones for deep concentration',
    chords: [
      [55.0, 110.0, 164.81, 220.0, 329.63], // A drone
      [49.0, 98.0, 146.83, 196.0, 293.66], // G drone
      [43.65, 87.31, 130.81, 174.61, 261.63], // F drone
      [65.41, 130.81, 196.0, 261.63, 392.0], // C drone
    ],
    pluckScale: [659.25, 783.99, 880.0, 1046.5, 1318.5],
    chordMs: 14000,
    padCutoff: 520,
    padLevel: 0.55,
    pluckLevel: 0.22,
    pluckDensity: 0.45,
    pluckGapMin: 3000,
    pluckGapMax: 8000,
    noiseLevel: 0,
  },
  {
    id: 'energy',
    name: 'Energy Boost',
    emoji: '⚡',
    blurb: 'Bright & bouncy study energy',
    chords: [
      [130.81, 164.81, 196.0, 261.63], // C
      [98.0, 123.47, 146.83, 196.0], // G-ish
      [110.0, 130.81, 164.81, 220.0], // Am
      [87.31, 110.0, 130.81, 174.61], // F-ish
    ],
    pluckScale: [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66],
    chordMs: 5200,
    padCutoff: 1400,
    padLevel: 0.4,
    pluckLevel: 0.5,
    pluckDensity: 0.95,
    pluckGapMin: 700,
    pluckGapMax: 2200,
    noiseLevel: 0,
  },
];

type PlayListener = (playing: boolean) => void;
type TrackListener = (trackId: string) => void;

const STORE_ENABLED = 'unn_cbt_music_enabled';
const STORE_VOLUME = 'unn_cbt_music_volume';
const STORE_TRACK = 'unn_cbt_music_track';

class FocusMusicEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private padBus: GainNode | null = null;
  private pluckBus: GainNode | null = null;
  private padFilter: BiquadFilterNode | null = null;
  private noiseNodes: { src: AudioBufferSourceNode; gain: GainNode } | null =
    null;
  private playing = false;
  private chordIndex = 0;
  private chordTimer: number | null = null;
  private pluckTimer: number | null = null;
  private playListeners = new Set<PlayListener>();
  private trackListeners = new Set<TrackListener>();
  private volume = 0.5;
  private trackId = MUSIC_TRACKS[0].id;
  private unlocked = false;

  constructor() {
    try {
      const v = localStorage.getItem(STORE_VOLUME);
      if (v) this.volume = Math.min(1, Math.max(0, Number(v)));
      const t = localStorage.getItem(STORE_TRACK);
      if (t && MUSIC_TRACKS.some((m) => m.id === t)) this.trackId = t;
    } catch {
      /* ignore */
    }
  }

  get preset(): MusicPreset {
    return MUSIC_TRACKS.find((m) => m.id === this.trackId) || MUSIC_TRACKS[0];
  }

  getTrackId(): string {
    return this.trackId;
  }

  setTrack(id: string): void {
    if (!MUSIC_TRACKS.some((m) => m.id === id)) return;
    this.trackId = id;
    try {
      localStorage.setItem(STORE_TRACK, id);
    } catch {
      /* ignore */
    }
    this.trackListeners.forEach((fn) => fn(id));
    if (this.playing) this.applyPresetLive();
  }

  isEnabledPreference(): boolean {
    try {
      const raw = localStorage.getItem(STORE_ENABLED);
      return raw === null ? true : raw === '1';
    } catch {
      return true;
    }
  }

  isPlaying(): boolean {
    return this.playing;
  }

  getVolume(): number {
    return this.volume;
  }

  subscribe(fn: PlayListener): () => void {
    this.playListeners.add(fn);
    return () => {
      this.playListeners.delete(fn);
    };
  }

  onTrackChange(fn: TrackListener): () => void {
    this.trackListeners.add(fn);
    return () => {
      this.trackListeners.delete(fn);
    };
  }

  private emit(): void {
    this.playListeners.forEach((fn) => fn(this.playing));
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return null;
      const preset = this.preset;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume * 0.6;
      this.master.connect(this.ctx.destination);

      this.padBus = this.ctx.createGain();
      this.padBus.gain.value = preset.padLevel;
      this.padFilter = this.ctx.createBiquadFilter();
      this.padFilter.type = 'lowpass';
      this.padFilter.frequency.value = preset.padCutoff;
      this.padFilter.Q.value = 0.6;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 320;
      lfo.connect(lfoGain);
      lfoGain.connect(this.padFilter.frequency);
      lfo.start();
      this.padBus.connect(this.padFilter);
      this.padFilter.connect(this.master);

      this.pluckBus = this.ctx.createGain();
      this.pluckBus.gain.value = preset.pluckLevel;
      const pluckFilter = this.ctx.createBiquadFilter();
      pluckFilter.type = 'lowpass';
      pluckFilter.frequency.value = 2400;
      this.pluckBus.connect(pluckFilter);
      const delay = this.ctx.createDelay(1);
      delay.delayTime.value = 0.42;
      const feedback = this.ctx.createGain();
      feedback.gain.value = 0.32;
      const wet = this.ctx.createGain();
      wet.gain.value = 0.5;
      pluckFilter.connect(this.master);
      pluckFilter.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(wet);
      wet.connect(this.master);
    }
    return this.ctx;
  }

  /** Browsers require a user gesture before audio; call on first interaction. */
  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    if (this.isEnabledPreference() && !this.playing) {
      this.play().catch(() => undefined);
    }
  }

  async play(): Promise<void> {
    const ctx = this.ensureContext();
    if (!ctx || !this.master || !this.padBus || !this.pluckBus) return;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        /* ignore */
      }
    }
    if (this.playing) return;
    this.playing = true;
    try {
      localStorage.setItem(STORE_ENABLED, '1');
    } catch {
      /* ignore */
    }
    this.applyPresetLive();
    this.emit();
  }

  /** (Re)start chord + pluck + noise schedulers for the current preset. */
  private applyPresetLive(): void {
    const preset = this.preset;
    if (this.padBus && this.ctx) {
      this.padBus.gain.setTargetAtTime(
        preset.padLevel,
        this.ctx.currentTime,
        0.4
      );
    }
    if (this.pluckBus && this.ctx) {
      this.pluckBus.gain.setTargetAtTime(
        preset.pluckLevel,
        this.ctx.currentTime,
        0.4
      );
    }
    if (this.padFilter && this.ctx) {
      this.padFilter.frequency.setTargetAtTime(
        preset.padCutoff,
        this.ctx.currentTime,
        0.4
      );
    }
    if (this.chordTimer) window.clearInterval(this.chordTimer);
    if (this.pluckTimer) window.clearTimeout(this.pluckTimer);
    this.scheduleChord();
    this.chordTimer = window.setInterval(
      () => this.scheduleChord(),
      preset.chordMs
    );
    this.schedulePluck();
    this.restartNoise();
  }

  pause(): void {
    if (!this.playing) return;
    this.playing = false;
    try {
      localStorage.setItem(STORE_ENABLED, '0');
    } catch {
      /* ignore */
    }
    if (this.chordTimer) {
      window.clearInterval(this.chordTimer);
      this.chordTimer = null;
    }
    if (this.pluckTimer) {
      window.clearTimeout(this.pluckTimer);
      this.pluckTimer = null;
    }
    this.stopNoise(0.4);
    const ctx = this.ctx;
    const master = this.master;
    if (ctx && master) {
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(0.0001, t + 0.6);
      window.setTimeout(() => {
        if (!this.playing) void ctx.suspend().catch(() => undefined);
      }, 700);
    }
    this.emit();
  }

  async toggle(): Promise<boolean> {
    if (this.playing) {
      this.pause();
      return false;
    }
    this.restoreVolume();
    await this.play();
    return true;
  }

  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, v));
    try {
      localStorage.setItem(STORE_VOLUME, String(this.volume));
    } catch {
      /* ignore */
    }
    if (this.ctx && this.master && this.playing) {
      this.master.gain.setTargetAtTime(
        this.volume * 0.6,
        this.ctx.currentTime,
        0.1
      );
    }
  }

  private restoreVolume(): void {
    if (this.ctx && this.master) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setValueAtTime(0.0001, t);
      this.master.gain.linearRampToValueAtTime(this.volume * 0.6, t + 1.2);
    }
  }

  private scheduleChord(): void {
    const ctx = this.ctx;
    if (!ctx || !this.padBus || !this.playing) return;
    const preset = this.preset;
    const chord = preset.chords[this.chordIndex % preset.chords.length];
    this.chordIndex += 1;
    const t = ctx.currentTime;
    const dur = preset.chordMs / 1000 + 2.5;
    chord.forEach((freq, i) => {
      [-4, 3].forEach((cents) => {
        const osc = ctx.createOscillator();
        osc.type = i < 2 ? 'sine' : 'triangle';
        osc.frequency.value = freq;
        osc.detune.value = cents;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.028, t + 2.2);
        g.gain.setValueAtTime(0.028, t + Math.max(0.1, dur - 2.5));
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        osc.connect(g);
        g.connect(this.padBus!);
        osc.start(t);
        osc.stop(t + dur + 0.1);
      });
    });
  }

  private schedulePluck(): void {
    if (!this.playing) return;
    const ctx = this.ctx;
    const preset = this.preset;
    if (ctx && this.pluckBus && Math.random() < preset.pluckDensity) {
      const scale = preset.pluckScale;
      const freq = scale[Math.floor(Math.random() * scale.length)];
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.09, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      osc.connect(g);
      g.connect(this.pluckBus);
      osc.start(t);
      osc.stop(t + 1.8);
      if (Math.random() < 0.4) {
        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = freq * 2;
        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0.0001, t + 0.05);
        g2.gain.linearRampToValueAtTime(0.02, t + 0.08);
        g2.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
        osc2.connect(g2);
        g2.connect(this.pluckBus);
        osc2.start(t + 0.05);
        osc2.stop(t + 1.4);
      }
    }
    const next =
      preset.pluckGapMin +
      Math.random() * (preset.pluckGapMax - preset.pluckGapMin);
    this.pluckTimer = window.setTimeout(() => this.schedulePluck(), next);
  }

  private restartNoise(): void {
    this.stopNoise(0.3);
    const ctx = this.ctx;
    const preset = this.preset;
    if (!ctx || !this.master || preset.noiseLevel <= 0 || !this.playing) return;
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) {
      // Soft pinkish rain: average of random walk
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2800;
    filter.Q.value = 0.4;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.gain.setTargetAtTime(preset.noiseLevel, ctx.currentTime, 1.2);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
    this.noiseNodes = { src, gain };
  }

  private stopNoise(fadeSeconds: number): void {
    const ctx = this.ctx;
    const nodes = this.noiseNodes;
    this.noiseNodes = null;
    if (!ctx || !nodes) return;
    try {
      nodes.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, fadeSeconds / 2);
      window.setTimeout(() => {
        try {
          nodes.src.stop();
        } catch {
          /* already stopped */
        }
      }, fadeSeconds * 1000 + 200);
    } catch {
      /* ignore */
    }
  }

  /** Small UI blip for correct/wrong/click feedback. */
  sfx(kind: 'correct' | 'wrong' | 'click' | 'finish'): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.master || !this.playing) return;
    const t = ctx.currentTime;
    const notes: Record<string, number[]> = {
      correct: [659.25, 783.99, 1046.5],
      wrong: [220.0, 174.61],
      click: [880.0],
      finish: [523.25, 659.25, 783.99, 1046.5, 1318.5],
    };
    notes[kind].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      const start = t + i * 0.09;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.linearRampToValueAtTime(0.12, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
      osc.connect(g);
      g.connect(this.master!);
      osc.start(start);
      osc.stop(start + 0.6);
    });
  }
}

export const focusMusic = new FocusMusicEngine();
