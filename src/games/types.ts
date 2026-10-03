import type { CatStyle } from '../core/draw';
import type { InputApi } from '../core/input';
import type { WorldSize } from '../core/stage';

export interface HudApi {
  /** Левый чип: подпись и крупное значение (очки, высота, дистанция). */
  setScore(label: string, value: string): void;
  /** Полоса прогресса (сытость, чистота) — 0…1. */
  setProgress(label: string, ratio: number, valueText?: string): void;
  hideProgress(): void;
  /** Правый чип: комбо, таймер, подсказка состояния. */
  setStatus(text: string | null, tone?: 'good' | 'bad' | 'neutral'): void;
  /** Короткая всплывающая подпись поверх игры: «Ням!», «Идеально!». */
  toast(text: string, tone?: 'good' | 'bad'): void;
}

export interface StatLine {
  label: string;
  value: string;
}

export interface FinishPayload {
  result: 'win' | 'lose';
  score: number;
  title: string;
  message: string;
  scoreLabel: string;
  stats?: StatLine[];
}

export interface GameHost {
  readonly world: WorldSize;
  readonly input: InputApi;
  readonly hud: HudApi;
  readonly style: CatStyle;
  /** Рекорд на момент старта партии. */
  readonly best: number;
  /** Игра сообщает о победе или поражении. */
  finish(payload: FinishPayload): void;
  /** Короткая тряска рамки — отклик на удар или промах. */
  shake(strength?: number): void;
}

export interface GameInstance {
  update(dt: number, time: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  dispose(): void;
}

export interface GameDefinition {
  id: string;
  path: string;
  title: string;
  /** Короткий слоган для карточки на главной. */
  tagline: string;
  /** Что происходит в игре — крупный текст на стартовом экране. */
  description: string;
  emoji: string;
  accent: string;
  accentSoft: string;
  /** Цель партии, например «Цель: 100% сытости». */
  goal: string;
  /** Строки правил на стартовом экране. */
  rules: string[];
  /** Подсказка по управлению под игровым полем. */
  controls: string;
  /** Суффикс рекорда: «очков», «котов», «метров». */
  bestSuffix: string;
  /** Нужны ли экранные кнопки влево-вправо. */
  pad?: boolean;
  create(host: GameHost): GameInstance;
}

/** Итог партии — используется экраном результата. */
export const RESULT_TEXT = {
  win: { emoji: '🏆', label: 'Победа' },
  lose: { emoji: '🙀', label: 'Партия окончена' },
} as const;
