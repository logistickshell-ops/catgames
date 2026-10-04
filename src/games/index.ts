import { catTowerGame } from './catTower';
import { feedCatGame } from './feedCat';
import { jumpingGame } from './jumping';
import { runnerGame } from './runner';
import type { GameDefinition } from './types';
import { washCatGame } from './washCat';

/** Пять основных игр Мурчальни. */
export const GAMES: GameDefinition[] = [
  feedCatGame,
  washCatGame,
  catTowerGame,
  jumpingGame,
  runnerGame,
];

export function findGame(id: string): GameDefinition | undefined {
  return GAMES.find((game) => game.id === id);
}

export type { GameDefinition } from './types';
