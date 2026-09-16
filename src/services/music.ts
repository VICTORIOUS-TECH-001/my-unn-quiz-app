/**
 * FocusMusic — a tiny generative "smooth gaming" ambient engine built on Web Audio.
 * No audio files needed: warm detuned pads + soft pentatonic plucks + airy shimmer,
 * designed to loop forever while students study. Students can toggle it on/off and
 * adjust volume; the preference persists in localStorage.
 */

type Listener = (playing: boolean) => void;

const STORE_ENABLED = 'unn_cbt_music_enabled';
const STORE_VOLUME = 'unn_cbt_music_volume';

// Dreamy lo-fi progression (Hz): Cmaj9 → Am9 → Fmaj9 → Gadd9
const CHORDS: number[][] = [
  [130.81, 164.81, 196.0, 246.94, 293.66], // C3 E3 G3 B3 D4
  [110.0, 130.81, 164.81, 196.0, 246.94], // A2 C3 E3 G3 B3
  [87.31, 130.81, 174.61, 220.0, 261.63], // F2 C3 F3 A3 C4
  [98.0, 146.83, 196.0, 246.94, 293.66], // G2 D3 G3 B3 D4
];
const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]; // C5..C6 pentatonic-ish
const CHORD_MS = 9000;

class FocusMusicEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private padBus: GainNode | null = null;
  private pluckBus: GainNode | null = null;
  private playing = false;
  private chordIndex = 0;
  private chordTimer: number | null = null;
  private pluckTimer: number | null = null;
  private listeners = new Set<Listener>();
  private volume = 0.5;
  private unlocked = false;

  constructor() {
    try {
      const v = localStorage.getItem(STORE_VOLUME);
      if (v) this.volume = Math.min(1, Math.max(0, Number(v)));
    } catch {
      /* ignore */
    }
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

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn(this.playing));
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume * 0.6;
      this.master.connect(this.ctx.destination);

      this.padBus = this.ctx.createGain();
      this.padBus.gain.value = 0.5;
      const padFilter = this.ctx.createBiquadFilter();
      padFilter.type = 'lowpass';
      padFilter.frequency.value = 900;
      padFilter.Q.value = 0.6;
      // Slow breathing LFO on the filter for a "smooth" evolving feel.
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 320;
      lfo.connect(lfoGain);
      lfoGain.connect(padFilter.frequency);
      lfo.start();
      this.padBus.connect(padFilter);
      padFilter.connect(this.master);

      this.pluckBus = this.ctx.createGain();
      this.pluckBus.gain.value = 0.35;
      const pluckFilter = this.ctx.createBiquadFilter();
      pluckFilter.type = 'lowpass';
      pluckFilter.frequency.value = 2400;
      this.pluckBus.connect(pluckFilter);
      // Simple feedback-delay "space" for the plucks.
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
    this.scheduleChord();
    this.chordTimer = window.setInterval(() => this.scheduleChord(), CHORD_MS);
    this.schedulePluck();
    this.emit();
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
    // Fade out gracefully, then suspend to save battery.
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
    const chord = CHORDS[this.chordIndex % CHORDS.length];
    this.chordIndex += 1;
    const t = ctx.currentTime;
    const dur = CHORD_MS / 1000 + 2.5;
    chord.forEach((freq, i) => {
      [-4, 3].forEach((cents) => {
        const osc = ctx.createOscillator();
        osc.type = i < 2 ? 'sine' : 'triangle';
        osc.frequency.value = freq;
        osc.detune.value = cents;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.028, t + 2.2);
        g.gain.setValueAtTime(0.028, t + dur - 2.5);
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
    if (ctx && this.pluckBus && Math.random() < 0.85) {
      const freq = PENTA[Math.floor(Math.random() * PENTA.length)];
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
      // Soft octave shimmer
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
    const next = 1400 + Math.random() * 3200;
    this.pluckTimer = window.setTimeout(() => this.schedulePluck(), next);
  }

  /** Small UI blip for correct/wrong/click feedback. */
  sfx(kind: 'correct' | 'wrong' | 'click' | 'finish'): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.master || !this.playing) return;
    // SFX respects music toggle; still play softly if ctx running.
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
