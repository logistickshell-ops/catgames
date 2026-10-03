export interface AnimationLoop {
  /** Останавливает цикл и освобождает кадр. Повторный вызов безопасен. */
  stop(): void;
  readonly running: boolean;
}

/**
 * Общий цикл отрисовки: один requestAnimationFrame на игру, dt ограничен,
 * чтобы после сворачивания вкладки физика не «взрывалась».
 */
export function createLoop(step: (dt: number, time: number) => void): AnimationLoop {
  let frame = 0;
  let last = performance.now();
  let stopped = false;

  const tick = (now: number): void => {
    if (stopped) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    step(dt, now / 1000);
    frame = requestAnimationFrame(tick);
  };

  frame = requestAnimationFrame(tick);

  return {
    stop(): void {
      stopped = true;
      cancelAnimationFrame(frame);
    },
    get running(): boolean {
      return !stopped;
    },
  };
}