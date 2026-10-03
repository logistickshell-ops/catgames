import { audio } from '../core/audio';
import { drawBubble, drawCat, drawSky, roundRect, shape } from '../core/draw';
import { formatScore, rand } from '../core/math';
import type { GameDefinition, GameHost, GameInstance } from './types';

interface Bubble { x: number; y: number; r: number; vy: number; phase: number; popped: boolean }

class BubblePopGame implements GameInstance {
  private readonly host: GameHost;
  private readonly w: number;
  private readonly h: number;
  private bubbles: Bubble[] = [];
  private spawn = 0;
  private score = 0;
  private popped = 0;
  private time = 0;
  private finished = false;

  constructor(host: GameHost) {
    this.host = host; this.w = host.world.w; this.h = host.world.h;
    host.hud.setScore('Лопнуло', '0'); host.hud.setProgress('Цель', 0, '0 / 25'); host.hud.setStatus('Тапай по пузырям');
    host.input.onTap((x, y) => this.pop(x, y));
  }
  private pop(x: number, y: number): void {
    for (let i = this.bubbles.length - 1; i >= 0; i -= 1) {
      const b = this.bubbles[i]; if (!b) continue;
      if (!b.popped && Math.hypot(b.x - x, b.y - y) < b.r + 10) {
        b.popped = true; this.popped += 1; this.score += 10 + Math.max(0, 5 - i);
        audio.play('pickup'); this.host.hud.toast(this.popped % 5 === 0 ? 'Пузырьковая серия!' : 'Плюх!');
        break;
      }
    }
  }
  update(dt: number, time: number): void {
    if (this.finished) return; this.time = time; this.spawn -= dt;
    if (this.spawn <= 0) { this.bubbles.push({ x: rand(42, this.w - 42), y: this.h + 36, r: rand(18, 31), vy: rand(-70, -38), phase: rand(0, 6), popped: false }); this.spawn = rand(0.32, 0.65); }
    for (const b of this.bubbles) { b.y += b.vy * dt; b.x += Math.sin(time * 2 + b.phase) * 18 * dt; }
    this.bubbles = this.bubbles.filter((b) => !b.popped && b.y > -60);
    this.host.hud.setScore('Лопнуло', formatScore(this.popped)); this.host.hud.setProgress('Цель', this.popped / 25, `${this.popped} / 25`);
    if (this.popped >= 25) { this.finished = true; audio.play('win'); this.host.finish({ result: 'win', score: this.score, title: 'Пузырьки закончились!', message: 'Кот доволен: в комнате снова тихо и чисто.', scoreLabel: 'очков', stats: [{ label: 'Пузырей', value: '25' }] }); }
  }
  render(ctx: CanvasRenderingContext2D): void {
    drawSky(ctx, this.w, this.h, '#DDF7FF', '#F6E6FF');
    for (const b of this.bubbles) { ctx.save(); ctx.globalAlpha = 0.85; drawBubble(ctx, b.x, b.y, b.r, 0.8); ctx.restore(); }
    drawCat(ctx, { x: this.w / 2, y: 595, r: 40, t: this.time, mood: 'happy' });
    roundRect(ctx, 30, 655, this.w - 60, 28, 14); shape(ctx, '#FFFFFF', '#2A1F17', 3);
    ctx.fillStyle = '#6B5748'; ctx.font = '600 17px Nunito, system-ui'; ctx.textAlign = 'center'; ctx.fillText('Тапай по пузырям, пока они не улетели', this.w / 2, 674);
  }
  dispose(): void { this.bubbles = []; }
}

export const bubblePopGame: GameDefinition = { id: 'bubble', path: '/game/bubble', title: 'Пузырьковый кот', tagline: 'Лопайте мыльные пузыри раньше, чем они улетят', description: 'Пузырьки летают по комнате. Поймайте 25 штук лёгким тапом.', emoji: '🫧', accent: '#4FA8FF', accentSoft: '#DDF2FF', goal: 'Цель: лопнуть 25 пузырей', rules: ['Тапайте по пузырям пальцем или мышью.', 'Пузырьки движутся и слегка меняют траекторию.', 'Лопните 25 штук — кот устроит праздник пены.'], controls: 'Управление: тап · клик · P — пауза · R — заново', bestSuffix: 'очков', create: (host) => new BubblePopGame(host) };
