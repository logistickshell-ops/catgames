/**
 * Интеграция с Telegram Mini App.
 *
 * Официальный скрипт telegram-web-app.js подключён в index.html.
 * Здесь мы аккуратно используем window.Telegram.WebApp: вне Telegram
 * модуль ничего не делает, поэтому сайт работает и как обычный веб-сервис.
 */

interface Insets {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

interface TgWebApp {
  initData?: string;
  initDataUnsafe?: { user?: { first_name?: string; username?: string } };
  version?: string;
  platform?: string;
  colorScheme?: 'light' | 'dark';
  themeParams?: Record<string, string>;
  viewportHeight?: number;
  viewportStableHeight?: number;
  safeAreaInset?: Insets;
  contentSafeAreaInset?: Insets;
  isExpanded?: boolean;
  ready(): void;
  expand(): void;
  disableVerticalSwipes?(): void;
  enableVerticalSwipes?(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  isVerticalSwipesEnabled?: boolean;
  onEvent?(event: string, handler: () => void): void;
  offEvent?(event: string, handler: () => void): void;
  openTelegramLink?(url: string): void;
  openLink?(url: string): void;
  BackButton?: {
    isVisible?: boolean;
    show(): void;
    hide(): void;
    onClick(handler: () => void): void;
    offClick(handler: () => void): void;
  };
  HapticFeedback?: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
    selectionChanged(): void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}

const webApp: TgWebApp | undefined = typeof window === 'undefined' ? undefined : window.Telegram?.WebApp;

/** Открыт ли сервис внутри клиента Telegram. */
export function isTelegram(): boolean {
  return Boolean(webApp && (webApp.platform ?? 'unknown') !== 'unknown');
}

function applyInsets(prefix: string, insets: Insets | undefined): void {
  if (!insets) return;
  const root = document.documentElement;
  if (typeof insets.top === 'number') root.style.setProperty(`--${prefix}-top`, `${insets.top}px`);
  if (typeof insets.bottom === 'number') root.style.setProperty(`--${prefix}-bottom`, `${insets.bottom}px`);
  if (typeof insets.left === 'number') root.style.setProperty(`--${prefix}-left`, `${insets.left}px`);
  if (typeof insets.right === 'number') root.style.setProperty(`--${prefix}-right`, `${insets.right}px`);
}

function syncViewport(): void {
  if (!webApp) return;
  const height = webApp.viewportStableHeight ?? webApp.viewportHeight;
  if (typeof height === 'number' && height > 0) {
    document.documentElement.style.setProperty('--app-height', `${height}px`);
  }
  applyInsets('tg-safe', webApp.safeAreaInset);
  applyInsets('tg-content', webApp.contentSafeAreaInset);
}

function applyTheme(): void {
  const root = document.documentElement;
  if (webApp?.colorScheme) {
    root.dataset.theme = webApp.colorScheme === 'dark' ? 'dark' : 'light';
  } else if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    root.dataset.theme = 'dark';
  }
}

function syncChrome(): void {
  if (!webApp) return;
  const dark = document.documentElement.dataset.theme === 'dark';
  const background = dark ? '#221A13' : '#FFF4E4';
  try {
    webApp.setHeaderColor?.(background);
    webApp.setBackgroundColor?.(background);
  } catch {
    /* старые версии клиента не поддерживают эти методы */
  }
}

const listeners: Array<[string, () => void]> = [];

/** Инициализация мини-приложения. Возвращает true, если мы внутри Telegram. */
export function initTelegram(): boolean {
  applyTheme();
  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  if (media && !webApp?.colorScheme) {
    const onChange = (): void => applyTheme();
    media.addEventListener('change', onChange);
    listeners.push(['media', onChange]);
  }

  if (!webApp) return false;
  // Официальный скрипт подключается всегда, но вне Telegram (platform === 'unknown')
  // его вызовы бессмысленны и только пишут предупреждения в консоль.
  if ((webApp.platform ?? 'unknown') === 'unknown') return false;

  webApp.ready();
  webApp.expand();

  // Отключаем вертикальные свайпы, чтобы жест не закрывал мини-приложение
  // во время игры; скролл внутри страницы работает штатно.
  try {
    webApp.disableVerticalSwipes?.();
  } catch {
    /* метод появился в Bot API 7.7 */
  }

  syncViewport();
  syncChrome();

  const onViewport = (): void => syncViewport();
  const onTheme = (): void => {
    applyTheme();
    syncChrome();
  };

  webApp.onEvent?.('viewportChanged', onViewport);
  webApp.onEvent?.('themeChanged', onTheme);
  webApp.onEvent?.('safeAreaChanged', onViewport);
  webApp.onEvent?.('contentSafeAreaChanged', onViewport);

  document.documentElement.classList.add('is-telegram');
  document.documentElement.dataset.platform = webApp.platform ?? 'unknown';

  return true;
}

let backHandler: (() => void) | null = null;

/** Показывает кнопку «назад» Telegram и связывает её с навигацией приложения. */
export function setTelegramBackButton(visible: boolean, handler?: () => void): void {
  if (!isTelegram()) return;
  const button = webApp?.BackButton;
  if (!button) return;

  if (backHandler) {
    button.offClick(backHandler);
    backHandler = null;
  }
  if (visible && handler) {
    backHandler = handler;
    button.onClick(handler);
    button.show();
  } else {
    button.hide();
  }
}

export type HapticKind = 'tap' | 'success' | 'error' | 'warning' | 'impact';

/** Тактильный отклик — только внутри Telegram, в браузере просто ничего не происходит. */
export function haptic(kind: HapticKind = 'tap'): void {
  const feedback = webApp?.HapticFeedback;
  if (!feedback) return;
  try {
    if (kind === 'success') feedback.notificationOccurred('success');
    else if (kind === 'error') feedback.notificationOccurred('error');
    else if (kind === 'warning') feedback.notificationOccurred('warning');
    else if (kind === 'impact') feedback.impactOccurred('medium');
    else feedback.selectionChanged();
  } catch {
    /* вызовы не критичны */
  }
}

/** Открывает ссылку в Telegram (для кнопки «Поделиться»). */
export function openTelegramLink(url: string): boolean {
  if (webApp?.openTelegramLink && url.startsWith('https://t.me/')) {
    webApp.openTelegramLink(url);
    return true;
  }
  return false;
}

export function telegramUserName(): string | null {
  return webApp?.initDataUnsafe?.user?.first_name ?? null;
}

export function disposeTelegram(): void {
  for (const [event, handler] of listeners.splice(0)) {
    if (event === 'media') {
      window.matchMedia?.('(prefers-color-scheme: dark)').removeEventListener('change', handler);
    } else {
      webApp?.offEvent?.(event, handler);
    }
  }
}
