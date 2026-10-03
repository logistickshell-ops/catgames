import { audio } from '../core/audio';
import { drawBubble, drawCat, drawPawPattern, drawSky, roundRect, shape, SNOW } from '../core/draw';
import { clamp, formatScore, rand, TAU } from '../core/math';
import type { GameDefinition, GameHost, GameInstance } from './types';

interface Bubble {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
}

interface Drop {
  x: number;
  y: number;
  vy: number;
  length: number;
}

const DURATION = 75;
const CAT_X = 240;
const CAT_Y = 380;
const CAT_R = 118;
const WIN_CLEAN = 0.97;

class WashCatGame implements GameInstance {
  private readonly host: GameHost;
  private readonly w: number;
  private readonly h: number;
  private readonly dirt: HTMLCanvasElement;
  private readonly dirtCtx: CanvasRenderingContext2D;
  private readonly initialDirty: number;

  private timeLeft = DURATION;
  private elapsed = 0;
  private time = 0;
  private clean = 0;
  private score = 0;
  private scrubX = CAT_X;
  private scrubY = CAT_Y;
  private scrubbing = false;
  private bubbles: Bubble[] = [];
  private drops: Drop[] = [];
  private checkTimer = 0;
  private finished = false;
  private lastScrubSound = 0;

  constructor(host: GameHost) {
    this.host = host;
    this.w = host.world.w;
    this.h = host.world.h;

    this.dirt = document.createElement('canvas');
    this.dirt.width = this.w;
    this.dirt.height = this.h;
    const dirtCtx = this.dirt.getContext('2d');
    if (!dirtCtx) throw new Error('Не удалось создать слой грязи');
    this.dirtCtx = dirtCtx;

    this.paintDirt();
    this.initialDirty = Math.max(1, this.sampleDirt());

    for (let i = 0; i < 26; i += 1) {
      this.drops.push({ x: rand(30, this.w - 30), y: rand(-400, 0), vy: rand(240, 420), length: rand(10, 26) });
    }

    host.hud.setScore('Очки', '0');
    host.hud.setProgress('Чистота', 0, '0%');
    host.hud.setStatus(`⏱ ${DURATION} с`);

    host.input.onDown((x, y) => {
      this.scrubbing = true;
      this.scrubX = x;
      this.scrubY = y;
      this.scrub(x, y, 1);
    });
    host.input.onMove((x, y) => {
      this.scrubX = x;
      this.scrubY = y;
      if (this.scrubbing) this.scrub(x, y, 1);
    });
    host.input.onUp(() => {
      this.scrubbing = false;
    });
    // Мышь без зажатой кнопки тоже моет — так удобнее на десктопе.
    if (!(window.matchMedia?.('(pointer: coarse)').matches ?? false)) {
      host.input.onMove((x, y) => this.scrub(x, y, 0.45));
    }
  }

  /** Разбрасывает грязные пятна по коту. */
  private paintDirt(): void {
    const ctx = this.dirtCtx;
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.save();

    const blobs = 22;
    for (let i = 0; i < blobs; i += 1) {
      const angle = rand(0, TAU);
      const radius = rand(0, 1);
      const x = CAT_X + Math.cos(angle) * radius * CAT_R * 0.85;
      const y = CAT_Y + Math.sin(angle) * radius * CAT_R * 1.5;
      const r = rand(22, 44);
      const gradient = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
      gradient.addColorStop(0, 'rgba(104, 74, 44, 0.95)');
      gradient.addColorStop(0.6, 'rgba(122, 92, 58, 0.82)');
      gradient.addColorStop(1, 'rgba(122, 92, 58, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(x, y, r * rand(0.8, 1.2), r * rand(0.7, 1.1), rand(0, TAU), 0, TAU);
      ctx.fill();
    }

    // мелкие брызги грязи
    for (let i = 0; i < 90; i += 1) {
      const angle = rand(0, TAU);
      const radius = rand(0.4, 1.2);
      const x = CAT_X + Math.cos(angle) * radius * CAT_R * 0.9;
      const y = CAT_Y + Math.sin(angle) * radius * CAT_R * 1.6;
      ctx.fillStyle = 'rgba(104, 74, 44, 0.85)';
      ctx.beginPath();
      ctx.arc(x, y, rand(2, 6), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Считает оставшуюся грязь по выборке пикселей (шаг 4 px). */
  private sampleDirt(): number {
    const data = this.dirtCtx.getImageData(0, 0, this.w, this.h).data;
    let count = 0;
    for (let y = 0; y < this.h; y += 4) {
      const rowOffset = y * this.w * 4;
      for (let x = 0; x < this.w; x += 4) {
        if (data[rowOffset + x * 4 + 3] > 12) count += 1;
      }
    }
    return count;
  }

  private scrub(x: number, y: number, strength: number): void {
    const ctx = this.dirtCtx;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    const radius = 40;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(0,0,0,${0.95 * strength})`);
    gradient.addColorStop(0.65, `rgba(0,0,0,${0.7 * strength})`);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
    ctx.restore();

    if (strength > 0.6) {
      for (let i = 0; i < 2; i += 1) {
        this.bubbles.push({
          x: x + rand(-18, 18),
          y: y + rand(-14, 14),
          r: rand(6, 17),
          vx: rand(-30, 30),
          vy: rand(-90, -20),
          life: rand(0.7, 1.6),
          max: 1.6,
        });
      }
      this.score += 1;
      if (this.time - this.lastScrubSound > 0.14) {
        this.lastScrubSound = this.time;
        audio.play('scrub');
      }
    }
  }

  update(dt: number, time: number): void {
    this.time = time;
    this.elapsed += dt;
    this.timeLeft = Math.max(0, this.timeLeft - dt);

    this.checkTimer -= dt;
    if (this.checkTimer <= 0) {
      this.checkTimer = 0.22;
      const dirty = this.sampleDirt();
      this.clean = clamp(1 - dirty / this.initialDirty, 0, 1);
    }

    for (let i = this.bubbles.length - 1; i >= 0; i -= 1) {
      const bubble = this.bubbles[i];
      if (!bubble) continue;
      bubble.life -= dt;
      bubble.x += bubble.vx * dt;
      bubble.y += bubble.vy * dt;
      bubble.vy += 40 * dt;
      if (bubble.life <= 0) this.bubbles.splice(i, 1);
    }

    for (const drop of this.drops) {
      drop.y += drop.vy * dt;
      if (drop.y > this.h + 40) {
        drop.y = rand(-200, -20);
        drop.x = rand(30, this.w - 30);
      }
    }

    this.host.hud.setProgress('Чистота', this.clean, `${Math.round(this.clean * 100)}%`);
    this.host.hud.setScore('Очки', formatScore(this.score));
    this.host.hud.setStatus(`⏱ ${Math.ceil(this.timeLeft)} с`, this.timeLeft <= 10 ? 'bad' : 'neutral');

    if (this.finished) return;

    if (this.clean >= WIN_CLEAN) {
      this.finished = true;
      const bonus = Math.round(this.timeLeft) * 5;
      const total = this.score + bonus;
      audio.play('splash');
      this.host.finish({
        result: 'win',
        score: total,
        title: 'Кот чистый и пушистый!',
        message: 'Смыто всё, даже пятно за ухом. Кот гордо вышагивает по квартире.',
        scoreLabel: 'очков',
        stats: [
          { label: 'Чистота', value: `${Math.round(this.clean * 100)}%` },
          { label: 'Бонус за скорость', value: `+${bonus}` },
        ],
      });
      return;
    }

    if (this.timeLeft <= 0) {
      this.host.finish({
        result: 'lose',
        score: this.score,
        title: 'Кот остался чумазым',
        message: 'Вода остыла, а пятна остались. Кот вырвался из ванной и ушёл под диван.',
        scoreLabel: 'очков',
        stats: [{ label: 'Чистота', value: `${Math.round(this.clean * 100)}%` }],
      });
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    drawSky(ctx, this.w, this.h, '#E9F6FF', '#BFE3F7');

    // Кафель ванной
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#A9D6EE';
    ctx.lineWidth = 3;
    for (let y = 60; y < this.h; y += 66) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.w, y);
      ctx.stroke();
    }
    for (let x = 0; x < this.w; x += 66) {
      ctx.beginPath();
      ctx.moveTo(x, 60);
      ctx.lineTo(x, this.h);
      ctx.stroke();
    }
    ctx.restore();
    drawPawPattern(ctx, this.w, this.h, 110, '#7FB8D8', 0.18);

    // Лейка душа и струи
    roundRect(ctx, 180, 24, 120, 26, 12);
    shape(ctx, '#C9D6DE', '#2A1F17', 3);
    ctx.strokeStyle = 'rgba(143, 207, 245, 0.65)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (const drop of this.drops) {
      ctx.beginPath();
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x, drop.y + drop.length);
      ctx.stroke();
    }

    // Ванна
    roundRect(ctx, -20, 560, this.w + 40, 200, 40);
    shape(ctx, '#F4FBFF', '#2A1F17', 4);

    const mood = this.clean > 0.85 ? 'happy' : this.time < 12 ? 'sad' : 'idle';
    drawCat(ctx, { x: CAT_X, y: CAT_Y, r: CAT_R, t: this.time, mood, style: SNOW });

    // Слой грязи поверх кота
    ctx.drawImage(this.dirt, 0, 0, this.w, this.h);

    for (const bubble of this.bubbles) {
      drawBubble(ctx, bubble.x, bubble.y, bubble.r, clamp(bubble.life / bubble.max, 0, 1) * 0.9);
    }

    // Кружок-мочалка под пальцем
    if (this.scrubbing) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = '#4FA8FF';
      ctx.lineWidth = 4;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.arc(this.scrubX, this.scrubY, 34, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    if (this.elapsed < 3.4) {
      ctx.save();
      ctx.globalAlpha = clamp(3.4 - this.elapsed, 0, 1);
      roundRect(ctx, this.w / 2 - 132, 640, 264, 44, 22);
      shape(ctx, '#FFF6E4', '#2A1F17', 3);
      ctx.fillStyle = '#2A1F17';
      ctx.font = '600 19px "Nunito", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Три пятна — три движения пальцем', this.w / 2, 662);
      ctx.restore();
    }
  }

  dispose(): void {
    this.bubbles = [];
    this.drops = [];
  }
}

export const washCatGame: GameDefinition = {
  id: 'wash',
  path: '/game/wash',
  title: 'Помой кота',
  tagline: 'Оттрите пятна, пока кот не вырвался из ванной',
  description: 'Кот вернулся с прогулки чумазым. Стирайте пятна пальцем или мышью — пена и брызги прилагаются.',
  emoji: '🧼',
  accent: '#4FA8FF',
  accentSoft: '#D8ECFF',
  goal: 'Цель: чистота 97% за 75 секунд',
  rules: [
    'Трите пятна пальцем или зажатой мышью.',
    'Пена появляется там, где вы моете.',
    'Успейте до конца таймера, иначе кот убежит.',
  ],
  controls: 'Управление: палец · зажатая мышь · P — пауза · R — заново',
  bestSuffix: 'очков',
  create: (host) => new WashCatGame(host),
};
