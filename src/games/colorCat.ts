import { audio } from '../core/audio';
import { drawCat, drawPawPattern, drawSky, roundRect, shape, type CatStyle } from '../core/draw';
import { clamp, formatScore } from '../core/math';
import type { GameDefinition, GameHost, GameInstance } from './types';

const PALETTE: CatStyle[] = [
  { fur: '#F4F1EA', furDark: '#2A1F17', ink: '#2A1F17', pink: '#FFFFFF', cream: '#FFFFFF' },
  { fur: '#D9DEE5', furDark: '#7E8794', ink: '#2A1F17', pink: '#B7C0CC', cream: '#FFFFFF' },
  { fur: '#B7B0A3', furDark: '#6B6257', ink: '#2A1F17', pink: '#8D8478', cream: '#F4F1EA' },
  { fur: '#22242A', furDark: '#0B0C0F', ink: '#0B0C0F', pink: '#F4F1EA', cream: '#545965' },
  { fur: '#2F5B71', furDark: '#183744', ink: '#111820', pink: '#C5E8F2', cream: '#EFFAFF' },
];
class ColorCatGame implements GameInstance {
  private readonly host: GameHost; private readonly w: number; private readonly h: number; private selected = 0; private colored = 0; private score = 0; private t = 0; private done = false;
  constructor(host: GameHost) { this.host = host; this.w = host.world.w; this.h = host.world.h; host.hud.setScore('Раскрашено', '0'); host.hud.setProgress('Цель', 0, '0 / 5'); host.hud.setStatus('Выбери цвет'); host.input.onTap((x, y) => this.tap(x, y)); }
  private tap(x: number, y: number): void { if (y > 590) { this.selected = clamp(Math.floor(x / (this.w / PALETTE.length)), 0, PALETTE.length - 1); audio.play('click'); this.host.hud.toast('Цвет выбран'); return; } if (y > 180 && y < 570) { this.colored = Math.min(5, this.colored + 1); this.score += 20; audio.play('pickup'); this.host.hud.toast('Кот становится ярче!'); if (this.colored >= 5) { this.done = true; this.host.finish({ result: 'win', score: this.score, title: 'Кот раскрашен!', message: 'Новый чёрно-белый герой получил свой особенный образ.', scoreLabel: 'очков', stats: [{ label: 'Цветов', value: '5' }] }); } } }
  update(_dt: number, time: number): void { if (this.done) return; this.t = time; this.host.hud.setScore('Раскрашено', formatScore(this.colored)); this.host.hud.setProgress('Цель', this.colored / 5, `${this.colored} / 5`); }
  render(ctx: CanvasRenderingContext2D): void { drawSky(ctx, this.w, this.h, '#FFF4E4', '#E6E1FF'); drawPawPattern(ctx, this.w, this.h, 130, '#9B8CFF', 0.12); drawCat(ctx, { x: this.w / 2, y: 360, r: 70, t: this.t, mood: 'happy', style: PALETTE[this.selected] }); ctx.fillStyle = '#2A1F17'; ctx.font = '800 22px Nunito, system-ui'; ctx.textAlign = 'center'; ctx.fillText('Выбирай палитру и тапай по коту', this.w / 2, 555); PALETTE.forEach((color, i) => { const x = (i + 0.5) * (this.w / PALETTE.length); ctx.beginPath(); ctx.arc(x, 640, 24, 0, Math.PI * 2); ctx.fillStyle = color.fur; ctx.fill(); ctx.strokeStyle = i === this.selected ? '#FF7A2F' : '#2A1F17'; ctx.lineWidth = i === this.selected ? 6 : 3; ctx.stroke(); }); roundRect(ctx, 24, 682, this.w - 48, 22, 11); shape(ctx, '#FFF6E4', '#2A1F17', 2); }
  dispose(): void { }
}
export const colorCatGame: GameDefinition = { id: 'color', path: '/game/color', title: 'Раскрась кота', tagline: 'Подберите коту новый стиль и цвет', description: 'Выбирайте цвет в палитре и тапайте по коту, чтобы собрать пять образов.', emoji: '🎨', accent: '#9B8CFF', accentSoft: '#E7E2FF', goal: 'Цель: создать 5 образов', rules: ['Выберите цвет снизу.', 'Тапайте по коту, чтобы применить образ.', 'Соберите пять образов для победы.'], controls: 'Управление: тап · клик · P — пауза · R — заново', bestSuffix: 'очков', create: (host) => new ColorCatGame(host) };
