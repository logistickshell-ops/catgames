import { catTowerGame } from './catTower';
import { feedCatGame } from './feedCat';
import { bubblePopGame } from './bubblePop';
import { ballCatGame } from './ballCat';
import { colorCatGame } from './colorCat';
import { gardenCatGame } from './gardenCat';
import { hideSeekGame } from './hideSeek';
import { jumpingGame } from './jumping';
import { laserCatGame } from './laserCat';
import { matchCatsGame } from './matchCats';
import { rayCatGame } from './rayCat';
import { runnerGame } from './runner';
import type { GameDefinition } from './types';
import { washCatGame } from './washCat';
import { yarnCatchGame } from './yarnCatch';
import { zumaCatsGame } from './zumaCats';

/** Порядок игр на главной странице. */
export const GAMES: GameDefinition[] = [
  feedCatGame, washCatGame, catTowerGame, jumpingGame, runnerGame,
  bubblePopGame, yarnCatchGame, laserCatGame, gardenCatGame, hideSeekGame,
  ballCatGame, colorCatGame, rayCatGame, matchCatsGame, zumaCatsGame,
];

export function findGame(id: string): GameDefinition | undefined {
  return GAMES.find((game) => game.id === id);
}

export type { GameDefinition } from './types';
