import { isMuted, setMuted } from './storage';

export type Sfx =
  | 'click'
  | 'eat'
  | 'bad'
  | 'scrub'
  | 'splash'
  | 'drop'
  | 'perfect'
  | 'land'
  | 'jump'
  | 'pickup'
  | 'combo'
  | 'win'
  | 'lose';

interface Tone {
  type: OscillatorType;
  from: number;
  to: number;
  duration: number;
  volume: number;
}

const TONES: Record<Exclude<Sfx, 'scrub' | 'splash'>, Tone> = {
  click: { type: 'triangle', from: 520, to: 720, duration: 0.09, volume: 0.16 },
  eat: { type: 'square', from: 320, to: 190, duration: 0.12, volume: 0.14 },
  bad: { type: 'sawtooth', from: 200, to: 90, duration: 0.22, volume: 0.14 },
  drop: { type: 'sine', from: 660, to: 260, duration: 0.14, volume: 0.14 },
  perfect: { type: 'triangle', from: 880, to: 1320, duration: 0.18, volume: 0.16 },
  land: { type: 'sine', from: 180, to: 120, duration: 0.1, volume: 0.12 },
  jump: { type: 'triangle', from: 420, to: 780, duration: 0.12, volume: 0.12 },
  pickup: { type: 'square', from: 780, to: 1180, duration: 0.1, volume: 0.13 },
  combo: { type: 'triangle', from: 960, to: 1480, duration: 0.16, volume: 0.15 },
  win: { type: 'triangle', from: 520, to: 1180, duration: 0.5, volume: 0.18 },
  lose: { type: 'sawtooth', from: 320, to: 110, duration: 0.5, volume: 0.16 },
};

/**
 * Звук синтезируется на месте — никаких внешних файлов.
 * AudioContext создаётся только после первого действия пользователя,
 * иначе браузер всё равно не даст воспроизвести звук.
 */
class AudioKit {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  private muted = isMuted();
  private lastScrub = 0;

  get isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    setMuted(this.muted);
    if (!this.muted) this.play('click');
    return this.muted;
  }

  /** Вызывается по первому касанию/нажатию клавиши. */
  unlock(): void {
    this.context();
  }

  private context(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      try {
        this.ctx = new Ctor();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.noise) {
      const length = Math.floor(ctx.sampleRate * 0.4);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      this.noise = buffer;
    }
    return this.noise;
  }

  play(name: Sfx): void {
    const ctx = this.context();
    if (!ctx) return;

    if (name === 'scrub' || name === 'splash') {
      const now = ctx.currentTime;
      // Скребок звучит часто, поэтому держим паузу между шумовыми всплесками.
      if (now - this.lastScrub < 0.09) return;
      this.lastScrub = now;
      this.playNoise(ctx, name === 'scrub' ? 0.14 : 0.3, name === 'scrub' ? 0.06 : 0.18);
      return;
    }

    const tone = TONES[name];
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = tone.type;
    osc.frequency.setValueAtTime(tone.from, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, tone.to), now + tone.duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(tone.volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + tone.duration + 0.02);
  }

  private playNoise(ctx: AudioContext, duration: number, volume: number): void {
    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(now);
    source.stop(now + duration + 0.02);
  }
}

export const audio = new AudioKit();