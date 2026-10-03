import { TAU } from './math';

export interface CatStyle {
  fur: string;
  furDark: string;
  ink: string;
  pink: string;
  cream: string;
}

export const GINGER: CatStyle = {
  fur: '#FFB877',
  furDark: '#EE9A46',
  ink: '#2A1F17',
  pink: '#FF8FA8',
  cream: '#FFF4E4',
};

export const SNOW: CatStyle = {
  fur: '#FFFFFF',
  furDark: '#E8DFD2',
  ink: '#2A1F17',
  pink: '#FF8FA8',
  cream: '#FFF4E4',
};

export type Mood = 'idle' | 'blink' | 'happy' | 'eat' | 'sad' | 'focus';

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export function shape(
  ctx: CanvasRenderingContext2D,
  fill: string | null,
  stroke: string | null = null,
  lineWidth = 3,
): void {
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

function ellipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  rotation = 0,
): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, TAU);
}

/** Общий «мягкий» силуэт: кот целиком — голова, тело, лапы, хвост. */
export interface CatOptions {
  x: number;
  y: number;
  /** Радиус головы: он же единица масштаба всей фигуры. */
  r: number;
  t?: number;
  mood?: Mood;
  flip?: boolean;
  body?: boolean;
  style?: CatStyle;
  lineWidth?: number;
  /** Фаза шага: если задана, лапы двигаются как при беге. */
  legPhase?: number;
  /** Наклон всей фигуры в радианах. */
  tilt?: number;
}

export function drawCat(ctx: CanvasRenderingContext2D, options: CatOptions): void {
  const {
    x,
    y,
    r,
    t = 0,
    mood = 'idle',
    flip = false,
    body = true,
    style = GINGER,
    lineWidth = 3,
    legPhase,
    tilt = 0,
  } = options;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(flip ? -1 : 1, 1);

  const wag = Math.sin(t * 3) * 0.25;

  if (body) {
    // хвост
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0.7 * r, 1.5 * r);
    ctx.quadraticCurveTo(1.85 * r, 1.75 * r, 1.7 * r + wag * r, 0.4 * r);
    ctx.strokeStyle = style.ink;
    ctx.lineWidth = 0.42 * r + lineWidth * 0.6;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.strokeStyle = style.fur;
    ctx.lineWidth = 0.26 * r;
    ctx.stroke();
    ctx.restore();

    // лапы
    const swing = legPhase === undefined ? 0 : Math.sin(legPhase) * 0.18 * r;
    const swing2 = legPhase === undefined ? 0 : Math.sin(legPhase + Math.PI) * 0.18 * r;
    for (const [dx, dy] of [
      [-0.52 * r + swing, 2.02 * r],
      [0.52 * r + swing2, 2.02 * r],
    ] as const) {
      ellipse(ctx, dx, dy, 0.36 * r, 0.24 * r);
      shape(ctx, style.fur, style.ink, lineWidth);
    }

    // тело
    ellipse(ctx, 0, 1.3 * r, 0.95 * r, 0.82 * r);
    shape(ctx, style.fur, style.ink, lineWidth);
    ellipse(ctx, 0, 1.5 * r, 0.55 * r, 0.55 * r);
    shape(ctx, style.cream, null);
  }

  // уши
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 0.95 * r, -0.5 * r);
    ctx.lineTo(side * 0.42 * r, -1.32 * r);
    ctx.lineTo(side * 0.05 * r, -0.62 * r);
    ctx.closePath();
    shape(ctx, style.fur, style.ink, lineWidth);
    ctx.beginPath();
    ctx.moveTo(side * 0.78 * r, -0.56 * r);
    ctx.lineTo(side * 0.45 * r, -1.06 * r);
    ctx.lineTo(side * 0.24 * r, -0.62 * r);
    ctx.closePath();
    shape(ctx, style.pink, null);
  }

  // голова
  ellipse(ctx, 0, 0, r, 0.92 * r);
  shape(ctx, style.fur, style.ink, lineWidth);

  // полоски на лбу
  ctx.strokeStyle = style.furDark;
  ctx.lineWidth = 0.09 * r;
  ctx.lineCap = 'round';
  for (const dx of [-0.2, 0, 0.2]) {
    ctx.beginPath();
    ctx.moveTo(dx * r, -0.62 * r);
    ctx.lineTo(dx * r * 0.7, -0.42 * r);
    ctx.stroke();
  }

  // глаза
  const eyeX = 0.36 * r;
  const eyeY = -0.02 * r;
  const eyeR = 0.13 * r;
  ctx.fillStyle = style.ink;
  ctx.strokeStyle = style.ink;
  ctx.lineWidth = 0.1 * r;
  ctx.lineCap = 'round';

  const closed = mood === 'blink' || mood === 'happy';
  if (closed) {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * eyeX - eyeR, mood === 'happy' ? eyeY : eyeY);
      ctx.quadraticCurveTo(side * eyeX, eyeY - (mood === 'happy' ? 0.2 * r : 0.16 * r), side * eyeX + eyeR, eyeY);
      ctx.stroke();
    }
  } else if (mood === 'sad') {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * eyeX - eyeR, eyeY - 0.06 * r);
      ctx.quadraticCurveTo(side * eyeX, eyeY + 0.12 * r, side * eyeX + eyeR, eyeY - 0.06 * r);
      ctx.stroke();
    }
  } else {
    for (const side of [-1, 1]) {
      ellipse(ctx, side * eyeX, eyeY, eyeR, eyeR * 1.12);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ellipse(ctx, side * eyeX + 0.045 * r, eyeY - 0.05 * r, eyeR * 0.34, eyeR * 0.34);
      ctx.fill();
      ctx.fillStyle = style.ink;
    }
  }

  // щёки
  ctx.globalAlpha = 0.4;
  for (const side of [-1, 1]) {
    ellipse(ctx, side * 0.62 * r, 0.28 * r, 0.16 * r, 0.11 * r);
    shape(ctx, style.pink, null);
  }
  ctx.globalAlpha = 1;

  // нос и рот
  ctx.beginPath();
  ctx.moveTo(-0.09 * r, 0.3 * r);
  ctx.lineTo(0.09 * r, 0.3 * r);
  ctx.lineTo(0, 0.42 * r);
  ctx.closePath();
  shape(ctx, style.pink, null);

  ctx.strokeStyle = style.ink;
  ctx.lineWidth = 0.07 * r;
  if (mood === 'eat') {
    const open = 0.16 * r + Math.abs(Math.sin(t * 12)) * 0.1 * r;
    ellipse(ctx, 0, 0.56 * r + open * 0.4, 0.2 * r, open);
    shape(ctx, '#C2436A', style.ink, 0.07 * r);
  } else if (mood === 'happy') {
    ctx.beginPath();
    ctx.moveTo(-0.22 * r, 0.46 * r);
    ctx.quadraticCurveTo(0, 0.72 * r, 0.22 * r, 0.46 * r);
    ctx.stroke();
  } else if (mood === 'sad') {
    ctx.beginPath();
    ctx.moveTo(-0.18 * r, 0.6 * r);
    ctx.quadraticCurveTo(0, 0.46 * r, 0.18 * r, 0.6 * r);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(0, 0.44 * r);
    ctx.lineTo(0, 0.5 * r);
    ctx.moveTo(0, 0.5 * r);
    ctx.quadraticCurveTo(-0.12 * r, 0.64 * r, -0.24 * r, 0.5 * r);
    ctx.moveTo(0, 0.5 * r);
    ctx.quadraticCurveTo(0.12 * r, 0.64 * r, 0.24 * r, 0.5 * r);
    ctx.stroke();
  }

  // усы
  ctx.lineWidth = 0.06 * r;
  for (const side of [-1, 1]) {
    for (const [dy, len] of [
      [-0.06, 0.5],
      [0.08, 0.56],
      [0.22, 0.46],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(side * 0.6 * r, (0.24 + dy) * r);
      ctx.lineTo(side * (0.6 + len) * r, (0.16 + dy * 1.6) * r);
      ctx.stroke();
    }
  }

  ctx.restore();
}

/** Кот-блок для «Башни из котов»: ушастая коробочка с мордой. */
export interface CatBlockOptions {
  x: number;
  y: number;
  w: number;
  h: number;
  flip?: boolean;
  style?: CatStyle;
  t?: number;
  highlight?: boolean;
}

export function drawCatBlock(ctx: CanvasRenderingContext2D, options: CatBlockOptions): void {
  const { x, y, w, h, flip = false, style = GINGER, t = 0, highlight = false } = options;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip ? -1 : 1, 1);
  const unit = h / 2;

  // уши над блоком
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * w * 0.42, -h / 2 + 2);
    ctx.lineTo(side * w * 0.26, -h / 2 - unit * 0.5);
    ctx.lineTo(side * w * 0.06, -h / 2 + 2);
    ctx.closePath();
    shape(ctx, style.furDark, style.ink, 3);
  }

  roundRect(ctx, -w / 2, -h / 2, w, h, Math.min(12, h * 0.3));
  shape(ctx, style.fur, style.ink, 3.5);

  if (highlight) {
    roundRect(ctx, -w / 2 + 4, h / 2 - 9, w - 8, 5, 3);
    shape(ctx, '#FFF6E4', null);
  }

  // морда
  const faceScale = Math.min(1, w / (h * 1.9));
  const r = h * 0.32 * faceScale + h * 0.1;
  const eyeX = Math.min(w * 0.22, r * 0.9);
  ctx.fillStyle = style.ink;

  if (w > h * 1.15) {
    const blink = Math.sin(t * 0.9) > 0.985;
    ctx.strokeStyle = style.ink;
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      if (blink) {
        ctx.beginPath();
        ctx.moveTo(side * eyeX - 5, 0);
        ctx.quadraticCurveTo(side * eyeX, -3, side * eyeX + 5, 0);
        ctx.stroke();
      } else {
        ellipse(ctx, side * eyeX, -2, 4.2, 4.6);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ellipse(ctx, side * eyeX + 1.4, -3.4, 1.5, 1.5);
        ctx.fill();
        ctx.fillStyle = style.ink;
      }
    }
    ctx.beginPath();
    ctx.moveTo(-4, 7);
    ctx.lineTo(4, 7);
    ctx.lineTo(0, 11);
    ctx.closePath();
    shape(ctx, style.pink, null);
    ctx.beginPath();
    ctx.moveTo(0, 11);
    ctx.quadraticCurveTo(-4, 16, -8, 12);
    ctx.moveTo(0, 11);
    ctx.quadraticCurveTo(4, 16, 8, 12);
    ctx.stroke();
  } else {
    // Узкий блок — рисуем сжатое лицо по вертикали.
    for (const side of [-1, 1]) {
      ellipse(ctx, side * 4, -h * 0.08, 2.6, 3);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, h * 0.1);
    ctx.moveTo(0, h * 0.1);
    ctx.quadraticCurveTo(-3, h * 0.2, -6, h * 0.1);
    ctx.moveTo(0, h * 0.1);
    ctx.quadraticCurveTo(3, h * 0.2, 6, h * 0.1);
    ctx.strokeStyle = style.ink;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.restore();
}

export function drawFish(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(0.55 * s, 0);
  ctx.lineTo(1.05 * s, -0.42 * s);
  ctx.lineTo(1.05 * s, 0.42 * s);
  ctx.closePath();
  shape(ctx, '#5AA9E6', '#2A1F17', 2.4);
  ellipse(ctx, 0, 0, 0.62 * s, 0.42 * s);
  shape(ctx, '#8FCFF5', '#2A1F17', 2.4);
  ctx.fillStyle = '#2A1F17';
  ellipse(ctx, -0.28 * s, -0.08 * s, 0.07 * s, 0.07 * s);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-0.1 * s, -0.3 * s);
  ctx.quadraticCurveTo(0.1 * s, 0, -0.1 * s, 0.3 * s);
  ctx.strokeStyle = '#5AA9E6';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

export function drawMilk(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  roundRect(ctx, -0.42 * s, -0.6 * s, 0.84 * s, 1.2 * s, 0.16 * s);
  shape(ctx, '#FFFFFF', '#2A1F17', 2.6);
  roundRect(ctx, -0.2 * s, -0.82 * s, 0.4 * s, 0.28 * s, 0.08 * s);
  shape(ctx, '#5AA9E6', '#2A1F17', 2.6);
  roundRect(ctx, -0.42 * s, -0.06 * s, 0.84 * s, 0.42 * s, 0);
  shape(ctx, '#5AA9E6', null);
  ctx.restore();
}

export function drawSausage(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  roundRect(ctx, -0.6 * s, -0.24 * s, 1.2 * s, 0.48 * s, 0.24 * s);
  shape(ctx, '#F19A5B', '#2A1F17', 2.6);
  ctx.beginPath();
  ctx.moveTo(-0.2 * s, -0.24 * s);
  ctx.lineTo(-0.28 * s, -0.45 * s);
  ctx.moveTo(0.25 * s, 0.24 * s);
  ctx.lineTo(0.34 * s, 0.44 * s);
  ctx.strokeStyle = '#2A1F17';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

export function drawDonut(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ellipse(ctx, 0, 0, 0.6 * s, 0.6 * s);
  shape(ctx, '#F0B267', '#2A1F17', 2.6);
  ctx.beginPath();
  ctx.ellipse(0, -0.06 * s, 0.52 * s, 0.5 * s, 0, 0, TAU);
  ctx.ellipse(0, -0.02 * s, 0.2 * s, 0.19 * s, 0, 0, TAU, true);
  shape(ctx, '#FF8FB8', null);
  for (const [dx, dy] of [
    [-0.28, -0.2],
    [0.2, -0.28],
    [0.32, 0.12],
    [-0.12, 0.28],
  ] as const) {
    roundRect(ctx, dx * s - 0.06 * s, dy * s - 0.03 * s, 0.12 * s, 0.06 * s, 0.03 * s);
    shape(ctx, ['#FFE066', '#7ED6A5', '#8FCFF5'][Math.abs(Math.round(dx * 10)) % 3], null);
  }
  ctx.restore();
}

/** Тапок — единственный «плохой» предмет в игре про кормление. */
export function drawSlipper(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ellipse(ctx, 0, 0, 0.62 * s, 0.34 * s);
  shape(ctx, '#7A6C8F', '#2A1F17', 2.6);
  ctx.beginPath();
  ctx.moveTo(-0.15 * s, -0.05 * s);
  ctx.quadraticCurveTo(0.05 * s, -0.4 * s, 0.28 * s, -0.05 * s);
  ctx.strokeStyle = '#2A1F17';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
}

export function drawPlant(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#2A1F17';
  ctx.lineWidth = 2.6;
  ctx.fillStyle = '#5FAE72';
  for (const [dx, dy] of [
    [0, -1],
    [-0.5, -0.7],
    [0.5, -0.7],
  ] as const) {
    ellipse(ctx, dx * s, dy * s, 0.32 * s, 0.42 * s, dx * 0.5);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-0.42 * s, -0.1 * s);
  ctx.lineTo(-0.3 * s, 0.75 * s);
  ctx.lineTo(0.3 * s, 0.75 * s);
  ctx.lineTo(0.42 * s, -0.1 * s);
  ctx.closePath();
  shape(ctx, '#D97C4E', '#2A1F17', 2.6);
  ctx.restore();
}

export function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number): void {
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fill();
  ctx.strokeStyle = '#8FCFF5';
  ctx.lineWidth = Math.max(1, r * 0.16);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.34, r * 0.22, 0, TAU);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function drawPaw(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot = 0, color = '#2A1F17'): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ellipse(ctx, 0, 0.18 * s, 0.42 * s, 0.34 * s);
  ctx.fill();
  for (const [dx, dy] of [
    [-0.36, -0.24],
    [-0.12, -0.4],
    [0.14, -0.4],
    [0.38, -0.22],
  ] as const) {
    ellipse(ctx, dx * s, dy * s, 0.14 * s, 0.18 * s);
    ctx.fill();
  }
  ctx.restore();
}

export function drawStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  points = 5,
  rot = 0,
  fill = '#FFC94A',
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? r : r * 0.46;
    const angle = (i / (points * 2)) * TAU - Math.PI / 2;
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  shape(ctx, fill, null);
  ctx.restore();
}

export function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color = '#FF6FA5'): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, 0.35 * s);
  ctx.bezierCurveTo(-0.9 * s, -0.3 * s, -0.35 * s, -1.05 * s, 0, -0.45 * s);
  ctx.bezierCurveTo(0.35 * s, -1.05 * s, 0.9 * s, -0.3 * s, 0, 0.35 * s);
  ctx.closePath();
  shape(ctx, color, null);
  ctx.restore();
}

/** Красивый фон сцены: мягкое небо и узор из лап. */
export function drawSky(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  top: string,
  bottom: string,
): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

export function drawPawPattern(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  step: number,
  color: string,
  alpha = 0.12,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  let index = 0;
  for (let y = step * 0.6; y < h; y += step) {
    for (let x = step * 0.6; x < w; x += step) {
      const offset = (index % 2) * (step / 2);
      drawPaw(ctx, x + offset, y, 18, ((index % 3) - 1) * 0.3, color);
      index += 1;
    }
  }
  ctx.restore();
}