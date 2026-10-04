import { audio } from '../core/audio';
import { drawCat, drawFish, drawMilk, drawPawPattern, drawPlant, drawSky, roundRect, shape } from '../core/draw';
import { clamp, formatScore, rand, randInt, TAU } from '../core/math';
import type { GameDefinition, GameHost, GameInstance } from './types';

interface Platform {
  x: number;
  w: number;
}

interface Pickup {
  x: number;
  y: number;
  kind: 'fish' | 'milk';
  taken: boolean;
  phase: number;
}

interface Pot {
  x: number;
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

const GROUND_Y = 596;
const GRAVITY = 2000;
const JUMP_V = -640;
const DOUBLE_JUMP_V = -540;
const CAT_R = 34;
const GOAL_METERS = 400;
const RUN_X = 150;

class RunnerGame implements GameInstance {
  private readonly host: GameHost;
  private readonly w: number;
  private readonly h: number;

  private catY = GROUND_Y - CAT_R;
  private vy = 0;
  private grounded = true;
  private jumps = 0;
  private distance = 0;
  private speed = 250;
  private score = 0;
  private collected = 0;
  private combo = 0;
  private comboTimer = 0;
  private bestCombo = 0;
  private platforms: Platform[] = [];
  private pickups: Pickup[] = [];
  private pots: Pot[] = [];
  private particles: Particle[] = [];
  private nextPlatformX = 0;
  private time = 0;
  private finished = false;
  private legPhase = 0;
  private hintTimer = 0;
  private coyote = 0;
  private jumpBuffer = 0;

  constructor(host: GameHost) {
    this.host = host;
    this.w = host.world.w;
    this.h = host.world.h;

    this.platforms.push({ x: -100, w: 620 });
    this.nextPlatformX = 520;
    for (let i = 0; i < 4; i += 1) this.generate();

    host.hud.setScore('Дистанция', '0 м');
    host.hud.setStatus('Комбо —');
    host.input.onTap(() => this.jump());
  }

  private generate(): void {
    const progress = clamp(this.distance / GOAL_METERS, 0, 1);
    const gap = rand(78, 108 + progress * 72);
    const w = rand(220, 420);
    const x = this.nextPlatformX + gap;
    this.platforms.push({ x, w });
    this.nextPlatformX = x + w;

    const items = randInt(2, 4);
    for (let i = 0; i < items; i += 1) {
      const px = x + 40 + ((w - 90) * i) / Math.max(1, items - 1);
      this.pickups.push({
        x: px,
        y: GROUND_Y - rand(70, 150),
        kind: Math.random() < 0.5 ? 'fish' : 'milk',
        taken: false,
        phase: rand(0, TAU),
      });
    }

    if (this.distance > 25 && Math.random() < 0.55) {
      this.pots.push({ x: x + w * rand(0.35, 0.7) });
    }
  }

  private jump(): void {
    if (this.finished) return;
    if (this.grounded || this.coyote > 0) {
      this.vy = JUMP_V;
      this.grounded = false;
      this.coyote = 0;
      this.jumps = 1;
      this.jumpBuffer = 0;
      audio.play('jump');
    } else if (this.jumps < 2) {
      this.vy = DOUBLE_JUMP_V;
      this.jumps = 2;
      this.jumpBuffer = 0;
      audio.play('jump');
      for (let i = 0; i < 6; i += 1) {
        this.particles.push({
          x: RUN_X + rand(-14, 14),
          y: this.catY + CAT_R,
          vx: rand(-90, 90),
          vy: rand(-60, 60),
          life: 0.4,
          max: 0.4,
          color: '#FFF6E4',
        });
      }
    } else {
      // Прыжок в буфере: игрок нажал чуть раньше приземления
      this.jumpBuffer = 0.22;
    }
  }

  private burst(x: number, y: number, color: string, amount = 6): void {
    for (let i = 0; i < amount; i += 1) {
      this.particles.push({
        x,
        y,
        vx: rand(-140, 140),
        vy: rand(-180, -20),
        life: rand(0.3, 0.7),
        max: 0.7,
        color,
      });
    }
  }

  private groundAt(x: number): Platform | null {
    for (const platform of this.platforms) {
      if (x >= platform.x && x <= platform.x + platform.w) return platform;
    }
    return null;
  }

  private finishGame(win: boolean, reason: string): void {
    if (this.finished) return;
    this.finished = true;
    const meters = Math.floor(this.distance);
    if (win) {
      audio.play('win');
      this.host.finish({
        result: 'win',
        score: this.score,
        title: 'Кот пробежал всю карту!',
        message: 'Четыреста метров, полная корзинка корма и ни одной потерянной рыбки.',
        scoreLabel: 'очков',
        stats: [
          { label: 'Дистанция', value: `${meters} м` },
          { label: 'Собрано корма', value: `${this.collected}` },
          { label: 'Лучшее комбо', value: `${this.bestCombo}` },
        ],
      });
    } else {
      audio.play('lose');
      this.host.shake(8);
      this.host.finish({
        result: 'lose',
        score: this.score,
        title: reason,
        message:
          reason === 'Кот упал в яму'
            ? 'Яма оказалась шире, чем кот готов прыгать. Кот обиженно сидит на дне.'
            : 'Горшок с цветком оказался прямо на пути. Кот отряхивается и делает вид, что так и планировал.',
        scoreLabel: 'очков',
        stats: [
          { label: 'Дистанция', value: `${meters} м` },
          { label: 'Собрано корма', value: `${this.collected}` },
        ],
      });
    }
  }

  update(dt: number, time: number): void {
    this.time = time;
    if (this.finished) return;

    this.hintTimer += dt;
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.speed = Math.min(470, 250 + this.distance * 0.16);
    // Дистанция растёт медленнее скорости, иначе забег заканчивается за 15 секунд
    this.distance += (this.speed * dt) / 40;

    // Непрерывный бег вправо: двигаем не кота, а мир вокруг него.
    const worldShift = this.speed * dt;
    for (const platform of this.platforms) platform.x -= worldShift;
    for (const pickup of this.pickups) pickup.x -= worldShift;
    for (const pot of this.pots) pot.x -= worldShift;
    this.nextPlatformX -= worldShift;

    this.platforms = this.platforms.filter((platform) => platform.x + platform.w > -220);
    this.pickups = this.pickups.filter((pickup) => pickup.x > -80 && !pickup.taken);
    this.pots = this.pots.filter((pot) => pot.x > -80);

    const lastPlatform = this.platforms[this.platforms.length - 1];
    if (!lastPlatform || lastPlatform.x + lastPlatform.w < this.w + 400) this.generate();

    // Физика кота
    this.vy += GRAVITY * dt;
    this.catY += this.vy * dt;

    // Небольшая «фора» у края платформы: бегущий кот не падает за 1 пиксель до обрыва
    const ground = this.groundAt(RUN_X) ?? (this.grounded ? this.groundAt(RUN_X + 14) : null);
    const feet = this.catY + CAT_R;
    if (ground && feet >= GROUND_Y && this.vy >= 0) {
      if (!this.grounded) {
        audio.play('land');
        this.burst(RUN_X, GROUND_Y, '#E8D3B4', 5);
        if (this.combo > 0 && this.comboTimer <= 0) this.combo = 0;
      }
      this.catY = GROUND_Y - CAT_R;
      this.vy = 0;
      this.grounded = true;
      this.jumps = 0;
      this.coyote = 0.1;
      this.legPhase += dt * (8 + this.speed / 90);
      if (this.jumpBuffer > 0) {
        this.jumpBuffer = 0;
        this.jump();
      }
    } else {
      if (this.grounded) this.coyote = 0.12;
      this.grounded = false;
      this.coyote = Math.max(0, this.coyote - dt);
    }

    // Корм и комбо
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (this.comboTimer <= 0 && this.combo > 0) {
      this.combo = 0;
      this.host.hud.setStatus('Комбо —');
    }

    for (const pickup of this.pickups) {
      if (pickup.taken) continue;
      const dx = Math.abs(pickup.x - RUN_X);
      const dy = Math.abs(pickup.y - this.catY);
      if (dx < 40 && dy < 46) {
        pickup.taken = true;
        this.collected += 1;
        this.combo += 1;
        this.comboTimer = 2.4;
        this.bestCombo = Math.max(this.bestCombo, this.combo);
        const bonus = 10 + (this.combo - 1) * 6;
        this.score += bonus;
        this.burst(pickup.x, pickup.y, pickup.kind === 'fish' ? '#8FCFF5' : '#FFFFFF', 6);
        audio.play(this.combo >= 4 ? 'combo' : 'pickup');
        this.host.hud.setStatus(`Комбо ×${this.combo}`, 'good');
        if (this.combo === 5 || this.combo === 10) {
          this.host.hud.toast(`Комбо ×${this.combo}! +${bonus}`);
        }
      }
    }
    this.pickups = this.pickups.filter((pickup) => !pickup.taken);

    // Препятствия
    for (const pot of this.pots) {
      const overlapX = Math.abs(pot.x - RUN_X) < 34;
      const overlapY = this.catY + CAT_R > GROUND_Y - 46;
      if (overlapX && overlapY) {
        this.finishGame(false, 'Кот врезался в горшок');
        return;
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const particle = this.particles[i];
      if (!particle) continue;
      particle.life -= dt;
      particle.x += particle.vx * dt - worldShift;
      particle.y += particle.vy * dt;
      particle.vy += 420 * dt;
      if (particle.life <= 0) this.particles.splice(i, 1);
    }

    const meters = Math.floor(this.distance);
    this.host.hud.setScore('Дистанция', `${formatScore(meters)} м`);
    this.host.hud.setProgress('До финиша', meters / GOAL_METERS, `${meters} / ${GOAL_METERS} м`);
    this.host.hud.setStatus(this.combo > 0 ? `Комбо ×${this.combo}` : 'Комбо —', this.combo > 0 ? 'good' : 'neutral');

    if (this.catY - CAT_R > this.h + 60) {
      this.finishGame(false, 'Кот упал в яму');
      return;
    }

    if (meters >= GOAL_METERS) {
      this.score += Math.round(this.collected * 10 + this.bestCombo * 25);
      this.finishGame(true, '');
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    drawSky(ctx, this.w, this.h, '#D9F0FF', '#FFF0DC');
    drawPawPattern(ctx, this.w, this.h, 150, '#9CC6E0', 0.1);

    // Дальние холмы
    ctx.save();
    ctx.globalAlpha = 0.45;
    const offset = (this.distance * 6) % 220;
    for (let i = -1; i < 4; i += 1) {
      const x = i * 220 - offset;
      ctx.beginPath();
      ctx.ellipse(x + 110, GROUND_Y + 40, 140, 90, 0, Math.PI, 0);
      ctx.fillStyle = '#BFD9A8';
      ctx.fill();
    }
    ctx.restore();

    // Платформы
    for (const platform of this.platforms) {
      if (platform.x > this.w + 40 || platform.x + platform.w < -40) continue;
      roundRect(ctx, platform.x, GROUND_Y, platform.w, 160, 14);
      shape(ctx, '#D9A96A', '#2A1F17', 3.5);
      roundRect(ctx, platform.x, GROUND_Y, platform.w, 18, 9);
      shape(ctx, '#7FC97F', '#2A1F17', 3.5);
    }

    // Горшки
    for (const pot of this.pots) {
      if (pot.x < -60 || pot.x > this.w + 60) continue;
      drawPlant(ctx, pot.x, GROUND_Y - 34, 26);
    }

    // Корм
    for (const pickup of this.pickups) {
      if (pickup.x < -60 || pickup.x > this.w + 60) continue;
      const bob = Math.sin(this.time * 4 + pickup.phase) * 5;
      if (pickup.kind === 'fish') drawFish(ctx, pickup.x, pickup.y + bob, 20, Math.sin(this.time * 2 + pickup.phase) * 0.2);
      else drawMilk(ctx, pickup.x, pickup.y + bob, 22, Math.sin(this.time * 2 + pickup.phase) * 0.1);
    }

    this.particles.forEach((particle) => {
      ctx.globalAlpha = clamp(particle.life / particle.max, 0, 1);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 5, 0, TAU);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    drawCat(ctx, {
      x: RUN_X,
      y: this.catY,
      r: CAT_R,
      t: this.time,
      mood: this.grounded ? 'focus' : 'happy',
      legPhase: this.grounded ? this.legPhase * 6 : undefined,
      tilt: this.grounded ? Math.sin(this.legPhase * 3) * 0.04 : -0.12,
    });

    if (this.hintTimer < 3.4) {
      ctx.save();
      ctx.globalAlpha = clamp(3.4 - this.hintTimer, 0, 1);
      roundRect(ctx, this.w / 2 - 140, 640, 280, 44, 22);
      shape(ctx, '#FFF6E4', '#2A1F17', 3);
      ctx.fillStyle = '#2A1F17';
      ctx.font = '600 19px "Nunito", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Тап — прыжок, тап в воздухе — двойной', this.w / 2, 662);
      ctx.restore();
    }
  }

  dispose(): void {
    this.platforms = [];
    this.pickups = [];
    this.pots = [];
    this.particles = [];
  }
}

export const runnerGame: GameDefinition = {
  id: 'run',
  path: '/game/run',
  title: 'Бег кота',
  tagline: 'Бегите вправо по платформам и собирайте корм',
  description: 'Кот бежит сам — вам остаётся прыгать через ямы и горшки и собирать рыбок с молочком.',
  emoji: '🏃',
  accent: '#FF6FA5',
  accentSoft: '#FFE0EC',
  goal: 'Цель: 400 метров дистанции',
  rules: [
    'Тап или клик — прыжок; второй тап в воздухе — двойной прыжок.',
    'Собирайте рыбок и молочко: подряд идут комбо-очки.',
    'Яма или горшок на пути — конец партии.',
  ],
  controls: 'Управление: тап · клик · Space · P — пауза · R — заново',
  bestSuffix: 'очков',
  create: (host) => new RunnerGame(host),
};
