const PREFIX = 'murchalnya';

function readNumber(key: string, fallback = 0): number {
  try {
    const raw = localStorage.getItem(`${PREFIX}.${key}`);
    const value = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(`${PREFIX}.${key}`, value);
  } catch {
    /* приватный режим браузера — рекорды просто не сохранятся */
  }
}

export function getBest(gameId: string): number {
  return readNumber(`best.${gameId}`);
}

/** Сохраняет результат, если он лучше прежнего. Возвращает true для нового рекорда. */
export function saveBest(gameId: string, score: number): boolean {
  const best = getBest(gameId);
  if (score > best) {
    write(`best.${gameId}`, String(Math.round(score)));
    return true;
  }
  return false;
}

export function getPlays(gameId: string): number {
  return readNumber(`plays.${gameId}`);
}

export function addPlay(gameId: string): void {
  write(`plays.${gameId}`, String(getPlays(gameId) + 1));
}

export function isMuted(): boolean {
  try {
    return localStorage.getItem(`${PREFIX}.muted`) === '1';
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean): void {
  write('muted', muted ? '1' : '0');
}