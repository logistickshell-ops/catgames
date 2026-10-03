import { audio } from '../core/audio';
import { drawCat, drawSky, roundRect, shape } from '../core/draw';
import { clamp, formatScore, rand } from '../core/math';
import type { GameDefinition, GameHost, GameInstance } from './types';

interface Yarn { x: number; y: number; vy: number; color: string }
const COLORS = ['#FF7A2F', '#9B8CFF', '#3FC1A5', '#FF6FA5'];

class YarnCatchGame implements GameInstance {
  private readonly host: GameHost; private readonly w: number; private readonly h: number;
  private catX = 240; private targetX = 240; private yarns: Yarn[] = []; private timer = 0.4; private caught = 0; private score = 0; private timeLeft = 45; private t = 0; private done = false;
  constructor(host: GameHost) { this.host = host; this.w = host.world.w; this.h = host.world.h; host.hud.setScore('Клубки', '0'); host.hud.setProgress('Цель', 0, '0 / 20'); host.hud.setStatus('Лови клубки'); }
  private spawn(): void { this.yarns.push({ x: rand(38, this.w - 38), y: -30, vy: rand(130, 190), color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? COLORS[0] }); }
  update(dt: number, time: number): void {
    if (this.done) return; this.t = time; this.timeLeft = Math.max(0, this.timeLeft - dt);
    const axis = this.host.input.axisX(); const p = this.host.input.pointer; if (axis) this.targetX += axis * 320 * dt; else if (p.active) this.targetX = p.x; this.targetX = clamp(this.targetX, 44, this.w - 44); this.catX += (this.targetX - this.catX) * Math.min(1, dt * 10);
    this.timer -= dt; if (this.timer <= 0) { this.spawn(); this.timer = 0.5; }
    for (const yarn of this.yarns) yarn.y += yarn.vy * dt;
    for (let i = this.yarns.length - 1; i >= 0; i -= 1) { const y = this.yarns[i]; if (!y) continue; if (y.y > 510 && y.y < 610 && Math.abs(y.x - this.catX) < 58) { this.yarns.splice(i, 1); this.caught += 1; this.score += 12; audio.play('pickup'); this.host.hud.toast('Клубок пойман!'); } else if (y.y > this.h + 30) this.yarns.splice(i, 1); }
    this.host.hud.setScore('Клубки', formatScore(this.caught)); this.host.hud.setProgress('Цель', this.caught / 20, `${this.caught} / 20`); this.host.hud.setStatus(`⏱ ${Math.ceil(this.timeLeft)} с`, this.timeLeft < 8 ? 'bad' : 'neutral');
    if (this.caught >= 20) { this.done = true; audio.play('win'); this.host.finish({ result: 'win', score: this.score, title: 'Кот связал целый шарф!', message: 'Все клубки пойманы — можно вязать тёплые носки.', scoreLabel: 'очков', stats: [{ label: 'Клубков', value: '20' }] }); }
    else if (this.timeLeft <= 0) { this.done = true; audio.play('lose'); this.host.finish({ result: 'lose', score: this.score, title: 'Клубки укатились', message: 'Кот отвлёкся на хвост. Попробуйте ещё раз.', scoreLabel: 'очков', stats: [{ label: 'Поймано', value: `${this.caught} / 20` }] }); }
  }
  render(ctx: CanvasRenderingContext2D): void {
    drawSky(ctx, this.w, this.h, '#FFF1D8', '#FFD5E5');
    roundRect(ctx, 0, 620, this.w, 100, 0); shape(ctx, '#E8B27C', null);
    for (const yarn of this.yarns) { ctx.save(); ctx.translate(yarn.x, yarn.y); ctx.strokeStyle = '#2A1F17'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 19, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = yarn.color; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(0, 0, 14, 0.3, 5.5); ctx.stroke(); ctx.restore(); }
    drawCat(ctx, { x: this.catX, y: 548, r: 42, t: this.t, mood: 'happy' });
  }
  dispose(): void { this.yarns = []; }
}
export const yarnCatchGame: GameDefinition = { id: 'yarn', path: '/game/yarn', title: 'Кот и клубки', tagline: 'Ловите разноцветные клубки прямо лапками', description: 'Клубки падают сверху, а кот бегает под ними. Поймайте 20 штук за 45 секунд.', emoji: '🧶', accent: '#FF6FA5', accentSoft: '#FFE1EC', goal: 'Цель: поймать 20 клубков', rules: ['Ведите кота пальцем, мышью или стрелками.', 'Пойманный клубок даёт очки.', 'Успейте собрать 20 клубков за 45 секунд.'], controls: 'Управление: палец · мышь · ← → · A / D · P — пауза · R — заново', bestSuffix: 'очков', pad: true, create: (host) => new YarnCatchGame(host) };
