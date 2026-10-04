import { audio } from '../core/audio';
import { drawCatBlock, drawStar, roundRect, shape, type CatStyle } from '../core/draw';
import { clamp, formatScore, lerp, rand } from '../core/math';
import type { GameDefinition, GameHost, GameInstance } from './types';

interface Block {
  x: number;
  w: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
}

const BLOCK_H = 46;
const BASE_Y = 640;
const PERFECT = 6;
const GOAL = 25;

const BLOCK_STYLES: CatStyle[] = [
  { fur: '#FFB877', furDark: '#EE9A46', ink: '#2A1F17', pink: '#FF8FA8', cream: '#FFF4E4' },
  { fur: '#FFF1DC', furDark: '#E4D3BC', ink: '#2A1F17', pink: '#FF8FA8', cream: '#FFF6E4' },
  { fur: '#9E9E9E', furDark: '#7C7C7C', ink: '#2A1F17', pink: '#FF8FA8', cream: '#FFF6E4' },
  { fur: '#F5C26B', furDark: '#DCA544', ink: '#2A1F17', pink: '#FF8FA8', cream: '#FFF6E4' },
];

class CatTowerGame implements GameInstance {
  private readonly host: GameHost;
  private readonly w: number;
  private readonly h: number;

  private stack: Block[] = [];
  private swing = { x: 240, w: 168 };
  private swingPhase = 0;
  private falling: { x: number; y: number; vy: number; w: number } | null = null;
  private camY = 0;
  private camTarget = 0;
  private score = 0;
  private combo = 0;
  private time = 0;
  private particles: Particle[] = [];
  private stars: Array<{ x: number; y: number; r: number; phase: number }> = [];
  private finished = false;
  private perfectFlash = 0;

  constructor(host: GameHost) {
    this.host = host;
    this.w = host.world.w;
    this.h = host.world.h;

    for (let i = 0; i < 40; i += 1) {
      this.stars.push({
        x: rand(0, this.w),
        y: rand(0, this.h),
        r: rand(1, 2.6),
        phase: rand(0, Math.PI * 2),
      });
    }

    host.hud.setScore('Коты', '0');
    host.hud.setStatus('Тап — сбросить');
    host.input.onTap(() => this.drop());
  }

  private get topBlock(): Block | null {
    return this.stack.length ? this.stack[this.stack.length - 1] ?? null : null;
  }

  private screenY(index: number): number {
    return BASE_Y - index * BLOCK_H + this.camY;
  }

  /** Позиция падающего кота по вертикали. */
  private get landingY(): number {
    return this.screenY(this.stack.length) - BLOCK_H * 2.2;
  }

  private drop(): void {
    if (this.finished || this.falling) return;
    audio.play('drop');
    this.falling = { x: this.swing.x, y: this.landingY, vy: 260, w: this.swing.w };
  }

  private burst(x: number, y: number, color: string, amount = 8): void {
    for (let i = 0; i < amount; i += 1) {
      this.particles.push({
        x,
        y,
        vx: rand(-160, 160),
        vy: rand(-220, -40),
        life: rand(0.4, 0.9),
        max: 0.9,
        color,
      });
    }
  }

  private land(): void {
    const falling = this.falling;
    this.falling = null;
    if (!falling) return;

    const below = this.topBlock;
    if (!below) {
    this.stack.push({ x: falling.x, w: falling.w });
      this.afterPlacement();
      return;
    }

    const left = Math.max(falling.x - falling.w / 2, below.x - below.w / 2);
    const right = Math.min(falling.x + falling.w / 2, below.x + below.w / 2);
    const overlap = right - left;

    if (overlap <= 14) {
      // Полный промах: кот улетает вниз вместе с куском башни.
      audio.play('bad');
      this.host.shake(10);
      this.burst(falling.x, this.screenY(this.stack.length - 1), '#FF8FA8', 16);
      this.finishGame(false);
      return;
    }

    const width = overlap;
    const center = (left + right) / 2;
    const offset = Math.abs(falling.x - below.x);

    this.stack.push({ x: center, w: width });

    if (offset <= PERFECT) {
      this.combo += 1;
      this.score += 2;
      this.perfectFlash = 1;
      audio.play('perfect');
      this.host.hud.toast(this.combo > 1 ? `Идеально ×${this.combo}` : 'Идеально!');
      this.burst(center, this.screenY(this.stack.length - 1), '#FFC94A', 14);
      this.host.hud.setStatus(`Идеально ×${this.combo}`, 'good');
    } else {
      this.combo = 0;
      audio.play('land');
      this.host.hud.setStatus('Тап — сбросить');
      this.burst(center, this.screenY(this.stack.length - 1), '#FFD9B8', 6);
    }

    this.afterPlacement();
  }

  private afterPlacement(): void {
    this.score += 1;
    // Следующий кот по ширине равен верхнему блоку башни — как в классической «башне».
    const top = this.topBlock;
    if (top) this.swing.w = Math.max(28, top.w);

    if (this.stack.length >= GOAL && !this.finished) {
      this.finishGame(true);
    }
  }

  private finishGame(win: boolean): void {
    if (this.finished) return;
    this.finished = true;
    const total = this.score;
    const height = this.stack.length;
    if (win) {
      audio.play('win');
      this.host.finish({
        result: 'win',
        score: total,
        title: 'Башня из котов построена!',
        message: 'Двадцать пять котов стоят ровно, не шелохнутся. Нижний, правда, уже спит.',
        scoreLabel: 'очков',
        stats: [
          { label: 'Высота', value: `${height} котов` },
          { label: 'Лучшее комбо', value: `${this.combo}` },
        ],
      });
    } else {
      audio.play('lose');
      this.host.finish({
        result: 'lose',
        score: total,
        title: 'Башня рассыпалась',
        message: 'Кот промахнулся и утащил за собой всю конструкцию. Коты разбежались по комнате.',
        scoreLabel: 'очков',
        stats: [{ label: 'Высота', value: `${Math.max(0, this.stack.length)} котов` }],
      });
    }
  }

  update(dt: number, time: number): void {
    this.time = time;
    this.perfectFlash = Math.max(0, this.perfectFlash - dt * 3);

    if (!this.finished) {
      this.swingPhase += dt * (1.6 + this.stack.length * 0.045);
      const amplitude = Math.min(150, 96 + this.stack.length * 3);
      this.swing.x = this.w / 2 + Math.sin(this.swingPhase) * amplitude;
    }

    if (this.falling) {
      this.falling.vy += 2200 * dt;
      this.falling.y += this.falling.vy * dt;

      const target = this.screenY(this.stack.length);
      if (this.falling.y >= target - BLOCK_H / 2) {
        this.falling.y = target - BLOCK_H / 2;
        this.land();
        if (this.finished) return;
      }
    }

    this.camTarget = Math.max(0, (this.stack.length - 5) * BLOCK_H);
    this.camY = lerp(this.camY, this.camTarget, 1 - Math.pow(0.0008, dt));

    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const particle = this.particles[i];
      if (!particle) continue;
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 380 * dt;
      if (particle.life <= 0) this.particles.splice(i, 1);
    }

    this.host.hud.setScore('Коты', formatScore(this.stack.length));
    if (this.stack.length > 0 && !this.falling) {
      this.host.hud.setProgress('До золотой башни', this.stack.length / GOAL, `${this.stack.length}/${GOAL}`);
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Ночное небо
    const gradient = ctx.createLinearGradient(0, 0, 0, this.h);
    gradient.addColorStop(0, '#3B3054');
    gradient.addColorStop(1, '#6C5B8C');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.w, this.h);

    for (const star of this.stars) {
      const twinkle = 0.45 + Math.sin(this.time * 2 + star.phase) * 0.35;
      ctx.globalAlpha = twinkle;
      drawStar(ctx, star.x, (star.y + this.camY * 0.25) % this.h, star.r * 3, 4, 0, '#FFF6E4');
    }
    ctx.globalAlpha = 1;

    ctx.beginPath();
    ctx.arc(this.w - 84, 96, 42, 0, Math.PI * 2);
    ctx.fillStyle = '#FFF3D6';
    ctx.fill();

    // Земля
    roundRect(ctx, -20, BASE_Y + BLOCK_H / 2 - 6, this.w + 40, 140, 26);
    shape(ctx, '#5C4C7C', '#2A1F17', 4);
    roundRect(ctx, -20, BASE_Y + BLOCK_H / 2 - 6, this.w + 40, 12, 6);
    shape(ctx, '#8674B0', null);

    // Башня
    this.stack.forEach((block, index) => {
      const y = this.screenY(index);
      if (y < -80 || y > this.h + 80) return;
      const style = BLOCK_STYLES[index % BLOCK_STYLES.length] ?? BLOCK_STYLES[0]!;
      drawCatBlock(ctx, {
        x: block.x,
        y,
        w: block.w,
        h: BLOCK_H,
        style,
        flip: index % 2 === 1,
        t: this.time + index,
        highlight: index === this.stack.length - 1,
      });
    });

    // Падающий кот
    if (this.falling) {
      const style = BLOCK_STYLES[this.stack.length % BLOCK_STYLES.length] ?? BLOCK_STYLES[0]!;
      drawCatBlock(ctx, {
        x: this.falling.x,
        y: this.falling.y + BLOCK_H / 2,
        w: this.falling.w,
        h: BLOCK_H,
        style,
        flip: this.stack.length % 2 === 1,
        t: this.time,
      });
    } else if (!this.finished) {
      // Качающийся кот с пунктиром прицела
      const y = this.landingY + Math.sin(this.time * 4) * 4;
      const style = BLOCK_STYLES[this.stack.length % BLOCK_STYLES.length] ?? BLOCK_STYLES[0]!;

      ctx.save();
      ctx.setLineDash([8, 9]);
      ctx.strokeStyle = 'rgba(255, 246, 228, 0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(this.swing.x, y + BLOCK_H / 2 + 6);
      ctx.lineTo(this.swing.x, this.screenY(this.stack.length) - BLOCK_H);
      ctx.stroke();
      ctx.restore();

      drawCatBlock(ctx, {
        x: this.swing.x,
        y,
        w: this.swing.w,
        h: BLOCK_H,
        style,
        t: this.time,
        flip: this.stack.length % 2 === 1,
      });
    }

    for (const particle of this.particles) {
      ctx.globalAlpha = clamp(particle.life / particle.max, 0, 1);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (this.perfectFlash > 0) {
      ctx.save();
      ctx.globalAlpha = this.perfectFlash * 0.5;
      ctx.fillStyle = '#FFC94A';
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.restore();
    }
  }

  dispose(): void {
    this.particles = [];
    this.stack = [];
  }
}

export const catTowerGame: GameDefinition = {
  id: 'tower',
  path: '/game/tower',
    title: 'Башня котов',
  tagline: 'Роняйте котов точно друг на друга — выше и выше',
  description: 'Кот качается сверху и ждёт команды. Тапните вовремя, чтобы он упал ровно на башню.',
  emoji: '🗼',
  accent: '#9B8CFF',
  accentSoft: '#E7E2FF',
  goal: 'Цель: 25 котов в башне',
  rules: [
    'Тап или клик — кот падает вниз.',
    'Точное попадание сохраняет ширину и даёт комбо.',
    'Промах обрезает блок, полный промах рушит башню.',
  ],
  controls: 'Управление: тап · клик · Space · Enter · P — пауза · R — заново',
  bestSuffix: 'очков',
  create: (host) => new CatTowerGame(host),
};
