import { audio } from '../core/audio';
import { GINGER } from '../core/draw';
import { createInput } from '../core/input';
import { createLoop, type AnimationLoop } from '../core/loop';
import { formatScore } from '../core/math';
import { Stage } from '../core/stage';
import { addPlay, getBest, saveBest } from '../core/storage';
import { haptic, setTelegramBackButton } from '../tg';
import type { FinishPayload, GameDefinition, GameHost, GameInstance, HudApi, StatLine } from '../games/types';
import { el, clear } from './dom';

interface OverlayAction {
  label: string;
  kind: 'primary' | 'ghost';
  onClick: () => void;
}

interface OverlayContent {
  emoji: string;
  title: string;
  message: string;
  score?: { value: string; label: string };
  stats?: StatLine[];
  actions: OverlayAction[];
  variant?: 'win' | 'lose' | 'neutral';
}

function createHud(): {
  element: HTMLDivElement;
  api: HudApi;
  scoreValue: HTMLElement;
  scoreLabel: HTMLElement;
  status: HTMLElement;
  meter: HTMLElement;
  meterLabel: HTMLElement;
  meterValue: HTMLElement;
  meterFill: HTMLElement;
} {
  const scoreLabel = el('span', { class: 'hud__label', text: 'Очки' });
  const scoreValue = el('b', { class: 'hud__value', text: '0' });
  const status = el('div', { class: 'hud__status', hidden: true });
  const meterLabel = el('span', { class: 'hud__meterLabel', text: 'Прогресс' });
  const meterValue = el('span', { class: 'hud__meterValue', text: '0%' });
  const meterFill = el('i', { class: 'hud__fill' });
  const meter = el('div', { class: 'hud__meter', hidden: true }, [
    el('div', { class: 'hud__meterHead' }, [meterLabel, meterValue]),
    el('div', { class: 'hud__bar' }, [meterFill]),
  ]);

  const element = el('div', { class: 'hud' }, [
    el('div', { class: 'hud__row' }, [
      el('div', { class: 'hud__chip' }, [scoreLabel, scoreValue]),
      status,
    ]),
    meter,
  ]);

  const api: HudApi = {
    setScore(label, value) {
      scoreLabel.textContent = label;
      scoreValue.textContent = value;
    },
    setProgress(label, ratio, valueText) {
      const safe = Math.max(0, Math.min(1, ratio));
      meter.hidden = false;
      meterLabel.textContent = label;
      meterValue.textContent = valueText ?? `${Math.round(safe * 100)}%`;
      meterFill.style.width = `${(safe * 100).toFixed(1)}%`;
    },
    hideProgress() {
      meter.hidden = true;
    },
    setStatus(text, tone = 'neutral') {
      if (!text) {
        status.hidden = true;
        return;
      }
      status.hidden = false;
      status.textContent = text;
      status.dataset.tone = tone;
    },
    toast() {
      /* подменяется на реальную реализацию внутри mountGame */
    },
  };

  return { element, api, scoreValue, scoreLabel, status, meter, meterLabel, meterValue, meterFill };
}

export function mountGame(
  container: HTMLElement,
  definition: GameDefinition,
  navigate: (path: string) => void,
): () => void {
  const root = el('section', {
    class: 'game',
    style: `--accent:${definition.accent};--accent-soft:${definition.accentSoft}`,
  });

  const backButton = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Вернуться в меню' }, [
    el('span', { text: '←' }),
    el('span', { class: 'icon-btn__text', text: 'Меню' }),
  ]);
  const soundButton = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Звук' });
  const pauseButton = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Пауза' }, [
    el('span', { text: '⏸' }),
    el('span', { class: 'icon-btn__text', text: 'Пауза' }),
  ]);

  const header = el('header', { class: 'game__bar' }, [
    backButton,
    el('div', { class: 'game__heading' }, [
      el('span', { class: 'game__emoji', text: definition.emoji }),
      el('div', { class: 'game__titles' }, [
        el('h1', { class: 'game__title', text: definition.title }),
        el('p', { class: 'game__goal', text: definition.goal }),
      ]),
    ]),
    el('div', { class: 'game__tools' }, [soundButton, pauseButton]),
  ]);

  const stageHost = el('div', { class: 'game__stage' });
  const pad = el('div', { class: 'pad', hidden: true }, [
    el('button', { class: 'pad__btn', type: 'button', 'data-dir': '-1', 'aria-label': 'Влево' }, [
      el('span', { text: '◀' }),
    ]),
    el('button', { class: 'pad__btn', type: 'button', 'data-dir': '1', 'aria-label': 'Вправо' }, [
      el('span', { text: '▶' }),
    ]),
  ]);
  const hint = el('p', { class: 'game__hint', text: definition.controls });

  root.append(header, stageHost, pad, hint);
  container.append(root);

  const stage = new Stage(stageHost);
  const input = createInput(stage);
  const hudParts = createHud();
  const overlay = el('div', { class: 'overlay', hidden: true });
  const toast = el('div', { class: 'toast', hidden: true });
  stage.frame.append(hudParts.element, toast, overlay);

  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  if (definition.pad && coarsePointer) {
    pad.hidden = false;
    input.bindPad(pad);
  } else {
    input.bindPad(null);
  }

  let instance: GameInstance | null = null;
  let finished = false;
  let paused = false;
  let started = false;

  const loop: AnimationLoop = createLoop((dt, time) => {
    const ctx = stage.ctx;
    ctx.save();
    ctx.clearRect(0, 0, stage.world.w, stage.world.h);
    if (instance) {
      if (!paused && !finished) instance.update(dt, time);
      instance.render(ctx);
    }
    ctx.restore();
  });

  function updateSoundButton(): void {
    const muted = audio.isMuted;
    soundButton.textContent = muted ? '🔇' : '🔊';
    soundButton.classList.toggle('is-off', muted);
    soundButton.setAttribute('aria-label', muted ? 'Включить звук' : 'Выключить звук');
  }

  function showToast(text: string, tone: 'good' | 'bad' = 'good'): void {
    toast.hidden = false;
    toast.textContent = text;
    toast.dataset.tone = tone;
    toast.classList.remove('is-visible');
    // перезапуск анимации
    void toast.offsetWidth;
    toast.classList.add('is-visible');
    window.setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 1400);
  }

  hudParts.api.toast = showToast;

  function shake(strength = 7): void {
    stage.frame.style.setProperty('--shake', `${strength}px`);
    stage.frame.classList.remove('is-shaking');
    void stage.frame.offsetWidth;
    stage.frame.classList.add('is-shaking');
    window.setTimeout(() => stage.frame.classList.remove('is-shaking'), 320);
  }

  function showOverlay(content: OverlayContent): void {
    clear(overlay);
    const card = el('div', { class: 'overlay__card', 'data-variant': content.variant ?? 'neutral' }, [
      el('span', { class: 'overlay__emoji', text: content.emoji }),
      el('h2', { class: 'overlay__title', text: content.title }),
    ]);
    if (content.score) {
      card.append(
        el('div', { class: 'overlay__score' }, [
          el('b', { text: content.score.value }),
          el('span', { text: content.score.label }),
        ]),
      );
    }
    card.append(el('p', { class: 'overlay__message', text: content.message }));
    if (content.stats?.length) {
      card.append(
        el(
          'ul',
          { class: 'overlay__stats' },
          content.stats.map((stat) =>
            el('li', {}, [el('span', { text: stat.label }), el('b', { text: stat.value })]),
          ),
        ),
      );
    }
    card.append(
      el(
        'div',
        { class: 'overlay__actions' },
        content.actions.map((action) =>
          el('button', {
            class: `btn btn--${action.kind}`,
            type: 'button',
            text: action.label,
            onclick: () => {
              audio.play('click');
              haptic('tap');
              action.onClick();
            },
          }),
        ),
      ),
    );
    overlay.append(card);
    overlay.hidden = false;
    requestAnimationFrame(() => card.classList.add('is-in'));
  }

  function hideOverlay(): void {
    overlay.hidden = true;
    clear(overlay);
  }

  function hud(): HudApi {
    return hudParts.api;
  }

  const host: GameHost = {
    world: stage.world,
    input,
    hud: hud(),
    style: GINGER,
    get best() {
      return getBest(definition.id);
    },
    finish(payload: FinishPayload) {
      handleFinish(payload);
    },
    shake,
  };

  function startGame(): void {
    hideOverlay();
    instance?.dispose();
    finished = false;
    paused = false;
    started = true;
    hudParts.api.setScore('Очки', '0');
    hudParts.api.setStatus(null);
    hudParts.api.hideProgress();
    instance = definition.create(host);
    addPlay(definition.id);
  }

  function handleFinish(payload: FinishPayload): void {
    if (finished) return;
    finished = true;
    const isRecord = saveBest(definition.id, payload.score);
    audio.play(payload.result === 'win' ? 'win' : 'lose');
    haptic(payload.result === 'win' ? 'success' : 'error');
    if (payload.result === 'lose') shake(5);

    const stats: StatLine[] = [...(payload.stats ?? [])];
    stats.push({ label: 'Рекорд', value: `${formatScore(Math.max(getBest(definition.id), payload.score))} ${definition.bestSuffix}` });
    if (isRecord) stats.push({ label: 'Новый рекорд', value: 'да' });

    showOverlay({
      emoji: payload.result === 'win' ? '🏆' : '🙀',
      title: payload.title,
      message: payload.message,
      variant: payload.result,
      score: { value: formatScore(payload.score), label: payload.scoreLabel },
      stats,
      actions: [
        { label: 'Ещё раз', kind: 'primary', onClick: () => startGame() },
        { label: 'В меню', kind: 'ghost', onClick: () => navigate('/') },
      ],
    });
  }

  function openPause(): void {
    if (!started || finished || paused) return;
    paused = true;
    showOverlay({
      emoji: '⏸',
      title: 'Пауза',
      message: 'Кот никуда не убежит. Продолжай, когда будешь готов.',
      actions: [
        {
          label: 'Продолжить',
          kind: 'primary',
          onClick: () => {
            paused = false;
            hideOverlay();
          },
        },
        { label: 'Заново', kind: 'ghost', onClick: () => startGame() },
        { label: 'В меню', kind: 'ghost', onClick: () => navigate('/') },
      ],
    });
  }

  function togglePause(): void {
    if (paused) {
      paused = false;
      hideOverlay();
    } else {
      openPause();
    }
  }

  function showStart(): void {
    showOverlay({
      emoji: definition.emoji,
      title: definition.title,
      message: definition.description,
      stats: definition.rules.map((rule, index) => ({ label: `${index + 1}.`, value: rule })),
      actions: [{ label: 'Начать игру', kind: 'primary', onClick: () => startGame() }],
    });
  }

  backButton.addEventListener('click', () => navigate('/'));
  pauseButton.addEventListener('click', togglePause);
  soundButton.addEventListener('click', () => {
    audio.toggleMute();
    updateSoundButton();
  });

  const onKey = (event: KeyboardEvent): void => {
    if (event.repeat) return;
    if (event.code === 'KeyP') togglePause();
    if (event.code === 'KeyR') startGame();
    if (event.code === 'Escape') navigate('/');
  };
  const onVisibility = (): void => {
    if (document.hidden) openPause();
  };

  window.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('blur', openPause);
  setTelegramBackButton(true, () => navigate('/'));

  updateSoundButton();

  // ?autostart=1 — сразу начать партию (удобно для скриншотов и отладки)
  const params = new URLSearchParams(window.location.search);
  if (params.has('autostart')) startGame();
  else showStart();

  return () => {
    loop.stop();
    instance?.dispose();
    input.dispose();
    stage.dispose();
    window.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('blur', openPause);
    setTelegramBackButton(false);
    root.remove();
  };
}
