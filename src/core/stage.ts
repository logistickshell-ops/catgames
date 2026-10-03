export interface WorldSize {
  w: number;
  h: number;
}

/**
 * Игровая сцена. Мир у всех игр один — 480×720, поэтому механика одинакова
 * на телефоне и на десктопе. Сцена вписывает рамку в доступную область с
 * сохранением пропорций, а масштаб уходит в font-size рамки: HUD и оверлеи
 * масштабируются вместе с картинкой.
 */
export class Stage {
  readonly world: WorldSize = { w: 480, h: 720 };
  readonly frame: HTMLDivElement;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;

  private readonly host: HTMLElement;
  private readonly observer: ResizeObserver;
  private scale = 1;

  constructor(host: HTMLElement) {
    this.host = host;

    this.frame = document.createElement('div');
    this.frame.className = 'game-frame';

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'game-canvas';
    this.frame.append(this.canvas);
    host.append(this.frame);

    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D недоступен в этом браузере');
    this.ctx = ctx;

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
  }

  /** Текущий коэффициент перевода мировых единиц в CSS-пиксели. */
  get currentScale(): number {
    return this.scale;
  }

  resize(): void {
    const rect = this.host.getBoundingClientRect();
    const availableW = Math.max(160, rect.width);
    const availableH = Math.max(200, rect.height);
    const scale = Math.min(availableW / this.world.w, availableH / this.world.h);
    this.scale = scale;

    const cssW = Math.round(this.world.w * scale);
    const cssH = Math.round(this.world.h * scale);
    this.frame.style.width = `${cssW}px`;
    this.frame.style.height = `${cssH}px`;
    this.frame.style.fontSize = `${(16 * scale).toFixed(2)}px`;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.canvas.width = Math.round(this.world.w * scale * dpr);
    this.canvas.height = Math.round(this.world.h * scale * dpr);
    this.ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
  }

  /** Пересчитывает координаты события указателя в мировые единицы. */
  toWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / Math.max(1, rect.width)) * this.world.w;
    const y = ((clientY - rect.top) / Math.max(1, rect.height)) * this.world.h;
    return { x, y };
  }

  dispose(): void {
    this.observer.disconnect();
    this.frame.remove();
  }
}