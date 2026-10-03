import { audio } from './audio';
import type { Stage } from './stage';

type TapHandler = (x: number, y: number) => void;
type VoidHandler = () => void;

export interface InputApi {
  /** Позиция указателя в мировых координатах и состояние нажатия. */
  readonly pointer: { x: number; y: number; down: boolean; active: boolean };
  isDown(code: string): boolean;
  /** Управление по горизонтали: клавиши + экранные кнопки, значение −1…1. */
  axisX(): number;
  onDown(handler: TapHandler): void;
  onMove(handler: TapHandler): void;
  onUp(handler: VoidHandler): void;
  onTap(handler: TapHandler): void;
  bindPad(element: HTMLElement | null): void;
  dispose(): void;
}

const LEFT_KEYS = ['ArrowLeft', 'KeyA'];
const RIGHT_KEYS = ['ArrowRight', 'KeyD'];

export function createInput(stage: Stage): InputApi {
  const keys = new Set<string>();
  const downHandlers: TapHandler[] = [];
  const moveHandlers: TapHandler[] = [];
  const upHandlers: VoidHandler[] = [];
  const tapHandlers: TapHandler[] = [];

  const pointer = { x: stage.world.w / 2, y: stage.world.h / 2, down: false, active: false };
  const pad = { left: false, right: false };

  let startPoint: { x: number; y: number } | null = null;
  let moved = false;

  const canvas = stage.canvas;

  const handleDown = (event: PointerEvent): void => {
    event.preventDefault();
    audio.unlock();
    const point = stage.toWorld(event.clientX, event.clientY);
    pointer.x = point.x;
    pointer.y = point.y;
    pointer.down = true;
    pointer.active = true;
    startPoint = { ...point };
    moved = false;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      /* некоторые браузеры не поддерживают захват — не критично */
    }
    for (const handler of downHandlers) handler(point.x, point.y);
  };

  const handleMove = (event: PointerEvent): void => {
    const point = stage.toWorld(event.clientX, event.clientY);
    pointer.x = point.x;
    pointer.y = point.y;
    pointer.active = true;
    if (startPoint) {
      const dx = point.x - startPoint.x;
      const dy = point.y - startPoint.y;
      if (Math.hypot(dx, dy) > 12) moved = true;
    }
    for (const handler of moveHandlers) handler(point.x, point.y);
  };

  const handleUp = (event: PointerEvent): void => {
    if (!pointer.down) return;
    const point = stage.toWorld(event.clientX, event.clientY);
    pointer.down = false;
    pointer.x = point.x;
    pointer.y = point.y;
    if (!moved && startPoint) {
      for (const handler of tapHandlers) handler(point.x, point.y);
    }
    startPoint = null;
    for (const handler of upHandlers) handler();
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) {
      keys.add(event.code);
      return;
    }
    audio.unlock();
    keys.add(event.code);
    if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
    if (event.code === 'Space' || event.code === 'Enter') {
      const x = pointer.x;
      const y = pointer.y;
      for (const handler of tapHandlers) handler(x, y);
    }
  };

  const handleKeyUp = (event: KeyboardEvent): void => {
    keys.delete(event.code);
  };

  const handleBlur = (): void => {
    keys.clear();
    pad.left = false;
    pad.right = false;
    if (pointer.down) {
      pointer.down = false;
      for (const handler of upHandlers) handler();
    }
  };

  canvas.addEventListener('pointerdown', handleDown);
  canvas.addEventListener('pointermove', handleMove);
  canvas.addEventListener('pointerup', handleUp);
  canvas.addEventListener('pointercancel', handleUp);
  canvas.addEventListener('pointerleave', (event) => {
    if (pointer.down) handleUp(event);
    pointer.active = false;
  });
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('blur', handleBlur);

  let padElement: HTMLElement | null = null;
  const padCleanup: Array<() => void> = [];

  const bindPad = (element: HTMLElement | null): void => {
    for (const cleanup of padCleanup.splice(0)) cleanup();
    padElement = element;
    if (!element) return;

    for (const button of Array.from(element.querySelectorAll<HTMLButtonElement>('[data-dir]'))) {
      const dir = button.dataset.dir === '-1' ? 'left' : 'right';
      const press = (event: Event): void => {
        event.preventDefault();
        audio.unlock();
        pad[dir] = true;
        button.classList.add('is-active');
      };
      const release = (): void => {
        pad[dir] = false;
        button.classList.remove('is-active');
      };
      button.addEventListener('pointerdown', press);
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('pointerleave', release);
      button.addEventListener('contextmenu', (event) => event.preventDefault());
      padCleanup.push(() => {
        button.removeEventListener('pointerdown', press);
        button.removeEventListener('pointerup', release);
        button.removeEventListener('pointercancel', release);
        button.removeEventListener('pointerleave', release);
      });
    }
  };

  return {
    pointer,
    isDown(code: string): boolean {
      return keys.has(code);
    },
    axisX(): number {
      let value = 0;
      if (LEFT_KEYS.some((code) => keys.has(code)) || pad.left) value -= 1;
      if (RIGHT_KEYS.some((code) => keys.has(code)) || pad.right) value += 1;
      return value;
    },
    onDown(handler: TapHandler): void {
      downHandlers.push(handler);
    },
    onMove(handler: TapHandler): void {
      moveHandlers.push(handler);
    },
    onUp(handler: VoidHandler): void {
      upHandlers.push(handler);
    },
    onTap(handler: TapHandler): void {
      tapHandlers.push(handler);
    },
    bindPad,
    dispose(): void {
      canvas.removeEventListener('pointerdown', handleDown);
      canvas.removeEventListener('pointermove', handleMove);
      canvas.removeEventListener('pointerup', handleUp);
      canvas.removeEventListener('pointercancel', handleUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      bindPad(null);
      if (padElement) padElement = null;
    },
  };
}