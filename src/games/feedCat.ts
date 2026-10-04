import { audio } from '../core/audio';
import {
  drawBubble,
  drawCat,
  drawDonut,
  drawFish,
  drawHeart,
  drawMilk,
  drawPawPattern,
  drawSausage,
  drawSky,
  drawSlipper,
  roundRect,
  shape,
} from '../core/draw';
import { clamp, formatScore, lerp, rand } from '../core/math';
import type { GameDefinition, GameHost, GameInstance } from './types';

type ItemKind = 'fish' | 'milk' | 'sausage' | 'donut' | 'slipper';

interface Item {
  kind: ItemKind;
  x: number;
  y: number;
  vy: number;
  rot: number;
  vrot: number;
  good: boolean;
}

interface Particle {
  kind: 'heart' | 'puff' | 'spark';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  text?: string;
}

const GOOD_KINDS: ItemKind[] = ['fish', 'milk', 'sausage', 'donut'];
const FLOOR_Y = 636;
const CAT_Y = 520;
const CAT_R = 58;
const DURATION = 60;

class FeedCatGame implements GameInstance {
  private readonly w: number;
  private readonly h: number;
  private readonly host: GameHost;

  private catTarget = 240;
  private catX = 240;
  private satiety = 0;
  private timeLeft = DURATION;
  private score = 0;
  private combo = 0;
  private items: Item[] = [];
  private particles: Particle[] = [];
  private spawnTimer = 0.6;
  private chew = 0;
  private time = 0;
  private elapsed = 0;

  constructor(host: GameHost) {
    this.host = host;
    this.w = host.world.w;
    this.h = host.world.h;
    this.catTarget = this.w / 2;
    this.catX = this.w / 2;
    host.hud.setScore('Очки', '0');
    host.hud.setProgress('Сытость', 0, '0%');
    host.hud.setStatus(`⏱ ${DURATION} с`);
  }

  private spawn(): void {
    const progress = 1 - this.timeLeft / DURATION;
    const isBad = Math.random() < 0.16 + progress * 0.1;
    const kind: ItemKind = isBad ? 'slipper' : GOOD_KINDS[Math.floor(Math.random() * GOOD_KINDS.length)] ?? 'fish';
    this.items.push({
      kind,
      x: rand(56, this.w - 56),
      y: -40,
      vy: rand(150, 210) + progress * 190,
      rot: rand(-0.4, 0.4),
      vrot: rand(-1.6, 1.6),
      good: kind !== 'slipper',
    });
  }

  private particlesFor(kind: Particle['kind'], x: number, y: number, amount: number): void {
    for (let i = 0; i < amount; i += 1) {
      this.particles.push({
        kind,
        x: x + rand(-14, 14),
        y: y + rand(-10, 10),
        vx: rand(-60, 60),
        vy: rand(-140, -40),
        life: rand(0.5, 1.1),
        max: 1.1,
      });
    }
  }

  update(dt: number, time: number): void {
    this.time = time;
    this.elapsed += dt;
    this.timeLeft = Math.max(0, this.timeLeft - dt);

    // Управление: палец/мышь ведут кота, стрелки и A/D дублируют на клавиатуре.
    const axis = this.host.input.axisX();
    const pointer = this.host.input.pointer;
    if (axis !== 0) this.catTarget += axis * 340 * dt;
    else if (pointer.active) this.catTarget = pointer.x;
    this.catTarget = clamp(this.catTarget, 54, this.w - 54);
    this.catX = lerp(this.catX, this.catTarget, 1 - Math.pow(0.0005, dt));

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawn();
      const progress = 1 - this.timeLeft / DURATION;
      this.spawnTimer = rand(0.52, 0.86) * (1 - progress * 0.28);
    }

    this.chew = Math.max(0, this.chew - dt);

    for (let i = this.items.length - 1; i >= 0; i -= 1) {
      const item = this.items[i];
      if (!item) continue;
      item.y += item.vy * dt;
      item.x += Math.sin(item.y / 60) * 14 * dt;
      item.rot += item.vrot * dt;

      const nearX = Math.abs(item.x - this.catX) < CAT_R + 12;
      const nearY = item.y > CAT_Y - 10 && item.y < CAT_Y + 66;

      if (nearX && nearY) {
        this.items.splice(i, 1);
        this.chew = 0.45;
        if (item.good) {
          this.combo += 1;
          this.satiety = Math.min(100, this.satiety + 7);
          this.score += 10 + (this.combo - 1) * 3;
          this.particlesFor('heart', item.x, item.y, 2);
          audio.play(this.combo >= 5 ? 'combo' : 'eat');
          this.host.hud.toast(this.combo >= 3 ? `Комбо ×${this.combo}` : 'Ням!');
        } else {
          this.combo = 0;
          this.satiety = Math.max(0, this.satiety - 12);
          this.score = Math.max(0, this.score - 5);
          this.particlesFor('puff', item.x, item.y, 4);
          audio.play('bad');
          this.host.shake(7);
          this.host.hud.toast('Фу, тапок!', 'bad');
        }
        continue;
      }

      if (item.y > FLOOR_Y + 26) {
        this.items.splice(i, 1);
        if (item.good) {
          this.combo = 0;
          this.particlesFor('spark', item.x, FLOOR_Y, 3);
        }
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const particle = this.particles[i];
      if (!particle) continue;
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 120 * dt;
      if (particle.life <= 0) this.particles.splice(i, 1);
    }

    this.host.hud.setProgress('Сытость', this.satiety / 100, `${Math.round(this.satiety)}%`);
    this.host.hud.setScore('Очки', formatScore(this.score));
    this.host.hud.setStatus(`⏱ ${Math.ceil(this.timeLeft)} с`, this.timeLeft <= 10 ? 'bad' : 'neutral');

    if (this.satiety >= 100) {
      this.host.finish({
        result: 'win',
        score: this.score,
        title: 'Кот накормлен!',
        message: 'Мурчальня довольна: кот сыт, доволен и уже вылизывает лапу.',
        scoreLabel: 'очков',
        stats: [
          { label: 'Сытость', value: '100%' },
          { label: 'Осталось времени', value: `${Math.ceil(this.timeLeft)} с` },
        ],
      });
      return;
    }

    if (this.timeLeft <= 0) {
      this.host.finish({
        result: 'lose',
        score: this.score,
        title: 'Кот остался голодным',
        message: 'Время вышло. Кот смотрит на тебя очень выразительно и очень громко.',
        scoreLabel: 'очков',
        stats: [{ label: 'Сытость', value: `${Math.round(this.satiety)}%` }],
      });
    }
  }

  private drawBackground(ctx: CanvasRenderingContext2D): void {
    drawSky(ctx, this.w, this.h, '#FFF3DE', '#FFD9A8');
    drawPawPattern(ctx, this.w, FLOOR_Y, 92, '#E7B785', 0.35);

    // Полка с банками
    roundRect(ctx, 42, 120, this.w - 84, 14, 7);
    shape(ctx, '#D8A46E', '#2A1F17', 3);
    const jars = ['#FF9C6B', '#8FCFF5', '#FFE066'];
    jars.forEach((color, index) => {
      const x = 78 + index * 92;
      roundRect(ctx, x, 62, 58, 60, 12);
      shape(ctx, color, '#2A1F17', 3);
      roundRect(ctx, x - 6, 52, 70, 14, 6);
      shape(ctx, '#FFF6E4', '#2A1F17', 3);
    });

    // Пол в клетку
    roundRect(ctx, 0, FLOOR_Y, this.w, this.h - FLOOR_Y, 0);
    shape(ctx, '#E8B27C', null);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, FLOOR_Y, this.w, this.h - FLOOR_Y);
    ctx.clip();
    const cell = 48;
    for (let row = 0; row * cell < this.h - FLOOR_Y; row += 1) {
      for (let col = 0; col * cell < this.w; col += 1) {
        if ((row + col) % 2 === 0) continue;
        ctx.fillStyle = '#D89B63';
        ctx.fillRect(col * cell, FLOOR_Y + row * cell, cell, cell);
      }
    }
    ctx.restore();
    roundRect(ctx, 0, FLOOR_Y, this.w, 6, 0);
    shape(ctx, '#C98A52', null);
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.drawBackground(ctx);

    const mouthOpen = this.chew > 0;
    const mood = mouthOpen ? 'eat' : this.satiety > 60 ? 'happy' : 'idle';
    const bob = Math.sin(this.time * 2) * 3;

    drawCat(ctx, {
      x: this.catX,
      y: CAT_Y + bob,
      r: CAT_R,
      t: this.time,
      mood,
    });

    for (const item of this.items) {
      switch (item.kind) {
        case 'fish':
          drawFish(ctx, item.x, item.y, 22, item.rot);
          break;
        case 'milk':
          drawMilk(ctx, item.x, item.y, 26, item.rot);
          break;
        case 'sausage':
          drawSausage(ctx, item.x, item.y, 26, item.rot);
          break;
        case 'donut':
          drawDonut(ctx, item.x, item.y, 24, item.rot);
          break;
        case 'slipper':
          drawSlipper(ctx, item.x, item.y, 26, item.rot);
          break;
        default:
          break;
      }
    }

    for (const particle of this.particles) {
      const alpha = clamp(particle.life / particle.max, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      if (particle.kind === 'heart') drawHeart(ctx, particle.x, particle.y, 14);
      else if (particle.kind === 'spark') drawBubble(ctx, particle.x, particle.y, 5 * alpha + 2, alpha);
      else {
        ctx.fillStyle = '#8C7B95';
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, 7 * alpha + 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Подсказка на старте партии
    if (this.elapsed < 3.2) {
      ctx.save();
      ctx.globalAlpha = clamp(3.2 - this.elapsed, 0, 1);
      roundRect(ctx, this.w / 2 - 128, 640, 256, 44, 22);
      shape(ctx, '#FFF6E4', '#2A1F17', 3);
      ctx.fillStyle = '#2A1F17';
      ctx.font = '600 19px "Nunito", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Веди кота пальцем или мышью', this.w / 2, 662);
      ctx.restore();
    }
  }

  dispose(): void {
    this.items = [];
    this.particles = [];
  }
}

export const feedCatGame: GameDefinition = {
  id: 'feed',
  path: '/game/feed',
  title: 'Покорми кота',
  tagline: 'Ловите падающую еду и не подставляйте морду под тапок',
  description: 'Кот ужасно голоден. Веди его по кухне и ловите всё съедобное, пока не заполнится шкала сытости.',
  emoji: '🐟',
  accent: '#FF7A2F',
  accentSoft: '#FFE2C9',
  goal: 'Цель: 100% сытости за 60 секунд',
  rules: [
    'Ведите кота пальцем, мышью или стрелками.',
    'Рыбка, молоко, сосиска и пончик — плюс сытость.',
    'Тапок — минус сытость и минус комбо.',
  ],
  controls: 'Управление: палец · мышь · ← → · A / D · P — пауза · R — заново',
  bestSuffix: 'очков',
  create: (host) => new FeedCatGame(host),
};
