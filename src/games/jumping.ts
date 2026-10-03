import { audio } from '../core/audio';
import { drawCat, drawPawPattern, drawSky, drawStar, roundRect, shape } from '../core/draw';
import { clamp, formatScore, lerp, rand, TAU } from '../core/math';
import type { GameDefinition, GameHost, GameInstance } from './types';

type PlatformKind = 'normal' | 'moving' | 'spring';

interface Platform {
  x: number;
  y: number;
  w: number;
  kind: PlatformKind;
  vx: number;
  baseX: number;
}

interface Milestone {
  y: number;
  text: string;
  life: number;
}

const GRAVITY = 1750;
const JUMP_V = -760;
const SPRING_V = -1180;
const CAT_R = 40;
const GOAL_METERS = 300;

class JumpingGame implements GameInstance {
  private readonly host: GameHost;
  private readonly w: number;
  private readonly h: number;

  private catX = 240;
  private catY = 560;
  private vy = 0;
  private camY = 0;
  private platforms: Platform[] = [];
  private highestY = 0;
  private generationY = 0;
  private maxHeight = 0;
  private time = 0;
  private squash = 0;
  private milestone: Milestone | null = null;
  private nextMilestone = 100;
  private finished = false;

  constructor(host: GameHost) {
    this.host = host;
    this.w = host.world.w;
    this.h = host.world.h;

    // Стартовая площадка и первый «этаж» платформ
    this.platforms.push({ x: this.w / 2 - 60, y: 620, w: 120, kind: 'normal', vx: 0, baseX: this.w / 2 - 60 });
    this.generationY = 620;
    this.highestY = 620;
    for (let i = 0; i < 7; i += 1) this.spawnPlatform();

    host.hud.setScore('Высота', '0 м');
    host.hud.setProgress('До цели', 0, `0 / ${GOAL_METERS} м`);
    host.hud.setStatus('← →');
  }

  private spawnPlatform(): void {
    const progress = clamp(this.maxHeight / (GOAL_METERS * 10), 0, 1);
    const gap = rand(66, 108 + progress * 30);
    this.generationY -= gap;
    const w = rand(74, 118);
    const roll = Math.random();

    let kind: PlatformKind = 'normal';
    if (roll < 0.14) kind = 'spring';
    else if (roll < 0.45) kind = 'moving';

    const x = rand(10, this.w - w - 10);
    // Первые платформы ставим над котом, чтобы подъём начинался сразу
    const centered = this.platforms.length < 4;
    this.platforms.push({
      x: centered ? rand(this.w / 2 - 70, this.w / 2 - 20) : x,
      y: this.generationY,
      w,
      kind,
      vx: kind === 'moving' ? rand(50, 110) * (Math.random() < 0.5 ? -1 : 1) : 0,
      baseX: centered ? this.w / 2 - 70 : x,
    });
    this.highestY = this.generationY;
  }

  private resetJump(strength = JUMP_V): void {
    this.vy = strength;
    this.squash = 1;
    audio.play('jump');
  }

  update(dt: number, time: number): void {
    this.time = time;
    this.squash = Math.max(0, this.squash - dt * 4);
    if (this.milestone) this.milestone.life -= dt;

    const input = this.host.input;
    const axis = input.axisX();
    const pointer = input.pointer;

    let target = this.catX;
    if (pointer.active && pointer.down) target = pointer.x;
    else target += axis * 300 * dt;

    if (pointer.active && pointer.down) {
      this.catX = lerp(this.catX, target, 1 - Math.pow(0.0002, dt));
    } else if (axis !== 0) {
      this.catX += axis * 300 * dt;
    }

    // Кот выходит с одной стороны и появляется с другой
    if (this.catX < -CAT_R) this.catX = this.w + CAT_R;
    if (this.catX > this.w + CAT_R) this.catX = -CAT_R;

    this.vy += GRAVITY * dt;
    this.catY += this.vy * dt;

    // Движущиеся платформы
    for (const platform of this.platforms) {
      if (platform.kind !== 'moving') continue;
      platform.x += platform.vx * dt;
      if (platform.x < 6 || platform.x + platform.w > this.w - 6) {
        platform.vx *= -1;
        platform.x = clamp(platform.x, 6, this.w - platform.w - 6);
      }
    }

    // Столкновение с платформой — только если кот падает сверху
    if (this.vy > 0) {
      for (const platform of this.platforms) {
        const feet = this.catY + CAT_R * 0.86;
        if (feet < platform.y || feet > platform.y + 34) continue;
        if (this.catX + CAT_R * 0.6 < platform.x || this.catX - CAT_R * 0.6 > platform.x + platform.w) continue;
        const previous = feet - this.vy * dt;
        if (previous > platform.y + 6) continue;

        this.catY = platform.y - CAT_R * 0.86;
        if (platform.kind === 'spring') {
          this.resetJump(SPRING_V);
          audio.play('combo');
          this.host.hud.toast('Пружина!');
        } else {
          this.resetJump(JUMP_V);
        }
        break;
      }
    }

    // Камера: держим кота в верхней части экрана, когда он поднимается
    const cameraLine = 300;
    const targetCam = Math.min(0, this.catY - cameraLine);
    if (targetCam < this.camY) {
      this.camY = lerp(this.camY, targetCam, 1 - Math.pow(0.0001, dt));
    }

    // Достраиваем платформы выше видимой области
    while (this.highestY > this.camY - 260) this.spawnPlatform();

    // Чистим платформы, ушедшие вниз
    this.platforms = this.platforms.filter((platform) => platform.y < this.camY + this.h + 220);

    const meters = Math.max(0, Math.floor(-this.camY / 10));
    this.maxHeight = Math.max(this.maxHeight, meters * 10);

    this.host.hud.setScore('Высота', `${formatScore(meters)} м`);
    this.host.hud.setProgress('До цели', meters / GOAL_METERS, `${meters} / ${GOAL_METERS} м`);
    this.host.hud.setStatus(
      this.host.input.axisX() === 0 ? '← →' : this.host.input.axisX() < 0 ? '← влево' : 'вправо →',
    );

    if (meters >= this.nextMilestone) {
      this.milestone = { y: this.catY - 90, text: `${this.nextMilestone} м!`, life: 1.4 };
      this.nextMilestone += 100;
      audio.play('combo');
    }

    if (meters >= GOAL_METERS && !this.finished) {
      this.finished = true;
      audio.play('win');
      this.host.finish({
        result: 'win',
        score: meters,
        title: `Кот взлетел на ${GOAL_METERS} метров!`,
        message: 'Выше облаков, выше антенн. Кот сидит на самой верхней платформе и мурчит.',
        scoreLabel: 'метров',
        stats: [{ label: 'Платформ пройдено', value: `${this.platforms.length}` }],
      });
      return;
    }

    // Падение ниже экрана
    if (this.catY - this.camY > this.h + 80 && !this.finished) {
      this.finished = true;
      audio.play('lose');
      this.host.shake(8);
      this.host.finish({
        result: 'lose',
        score: meters,
        title: 'Кот упал',
        message: 'Платформа кончилась раньше, чем терпение. Кот мягко приземлился... в самом низу.',
        scoreLabel: 'метров',
        stats: [{ label: 'Высота', value: `${meters} м` }],
      });
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Небо темнеет постепенно — по мере подъёма к цели, а не на первых метрах
    const progress = clamp(this.maxHeight / (GOAL_METERS * 10), 0, 1);
    drawSky(ctx, this.w, this.h, '#BFE6FF', '#E9F7FF');
    if (progress > 0.02) {
      ctx.save();
      ctx.globalAlpha = progress;
      drawSky(ctx, this.w, this.h, '#2E2340', '#5B4B7A');
      for (let i = 0; i < 26; i += 1) {
        const x = ((i * 137) % 460) + 10;
        const y = ((i * 251) % 700) + 10;
        drawStar(ctx, x, y, 4 + (i % 3), 4, i, '#FFF6E4');
      }
      ctx.restore();
    }
    drawPawPattern(ctx, this.w, this.h, 130, '#7FB0D8', 0.12);

    ctx.save();
    ctx.translate(0, -this.camY);

    for (const platform of this.platforms) {
      if (platform.y < this.camY - 60 || platform.y > this.camY + this.h + 60) continue;
      const color = platform.kind === 'spring' ? '#FFC94A' : platform.kind === 'moving' ? '#8FD9C4' : '#FFFFFF';
      roundRect(ctx, platform.x, platform.y, platform.w, 20, 10);
      shape(ctx, color, '#2A1F17', 3.5);
      roundRect(ctx, platform.x + 8, platform.y + 5, platform.w - 16, 5, 3);
      shape(ctx, 'rgba(255,255,255,0.75)', null);
      if (platform.kind === 'spring') {
        ctx.beginPath();
        ctx.moveTo(platform.x + platform.w / 2 - 14, platform.y - 4);
        ctx.quadraticCurveTo(platform.x + platform.w / 2, platform.y - 22, platform.x + platform.w / 2 + 14, platform.y - 4);
        ctx.strokeStyle = '#2A1F17';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }

    const squash = 1 - this.squash * 0.18;
    ctx.save();
    ctx.translate(this.catX, this.catY + CAT_R * 0.8 * (1 - squash));
    ctx.scale(1 / squash, squash);
    ctx.translate(-this.catX, -(this.catY + CAT_R * 0.8));
    drawCat(ctx, {
      x: this.catX,
      y: this.catY,
      r: CAT_R,
      t: this.time,
      mood: this.vy < -100 ? 'happy' : 'focus',
    });
    ctx.restore();

    ctx.restore();

    if (this.milestone && this.milestone.life > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(this.milestone.life, 0, 1);
      ctx.fillStyle = '#2A1F17';
      ctx.font = '800 34px "Baloo 2", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.milestone.text, this.w / 2, 180);
      ctx.restore();
    }

    // Индикатор высоты слева
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.translate(24, this.h / 2);
    roundRect(ctx, -6, -110, 12, 220, 6);
    shape(ctx, '#FFF6E4', '#2A1F17', 3);
    const ratio = clamp(this.maxHeight / (GOAL_METERS * 10), 0, 1);
    roundRect(ctx, -3, 110 - 220 * ratio, 6, 220 * ratio, 3);
    shape(ctx, '#FF7A2F', null);
    ctx.restore();

    // Облака-декор под котом
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < 3; i += 1) {
      const y = ((this.time * 12 + i * 260) % (this.h + 260)) - 130;
      const x = 70 + i * 130;
      const cy = this.h - y;
      ctx.beginPath();
      ctx.ellipse(x, cy, 28, 20, 0, 0, TAU);
      ctx.ellipse(x + 26, cy - 8, 34, 26, 0, 0, TAU);
      ctx.ellipse(x + 60, cy + 2, 24, 18, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  dispose(): void {
    this.platforms = [];
  }
}

export const jumpingGame: GameDefinition = {
  id: 'jump',
  path: '/game/jump',
  title: 'Джампинг',
  tagline: 'Прыгайте по платформам всё выше и не падайте',
  description: 'Кот прыгает сам, а ваше дело — вести его влево и вправо по появляющимся платформам.',
  emoji: '🪜',
  accent: '#3FC1A5',
  accentSoft: '#D5F4EC',
  goal: 'Цель: подняться на 300 метров',
  rules: [
    'Ведите кота пальцем или кнопками ← →.',
    'Белые платформы — обычные, зелёные — движутся, жёлтые — пружины.',
    'Упали ниже экрана — партия окончена.',
  ],
  controls: 'Управление: палец · ← → · A / D · P — пауза · R — заново',
  bestSuffix: 'метров',
  pad: true,
  create: (host) => new JumpingGame(host),
};
