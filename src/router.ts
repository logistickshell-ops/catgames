export interface RouteMatch {
  handler: (params: Record<string, string>) => (() => void) | void;
  pattern: RegExp;
  keys: string[];
}

export interface Router {
  start(): void;
  navigate(path: string): void;
  current(): string;
  dispose(): void;
}

function compile(path: string): { pattern: RegExp; keys: string[] } {
  const keys: string[] = [];
  const source = path
    .split('/')
    .map((segment) => {
      if (segment.startsWith(':')) {
        keys.push(segment.slice(1));
        return '([^/]+)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { pattern: new RegExp(`^${source}/?$`), keys };
}

/**
 * history-роутер без зависимостей: одна страница, два вида экранов
 * (главная и игра). Каждый обработчик возвращает функцию очистки,
 * поэтому игровой цикл и слушатели гарантированно снимаются.
 */
export function createRouter(
  routes: Array<{ path: string; handler: RouteMatch['handler'] }>,
  options: { fallback?: string; onChange?: (path: string) => void } = {},
): Router {
  const compiled: RouteMatch[] = routes.map((route) => ({ ...compile(route.path), handler: route.handler }));
  let cleanup: (() => void) | void;
  let currentPath = window.location.pathname;

  const run = (): void => {
    const path = window.location.pathname;
    currentPath = path === '/' ? '/' : path.replace(/\/+$/, '');

    for (const route of compiled) {
      const match = route.pattern.exec(currentPath);
      if (!match) continue;
      if (typeof cleanup === 'function') cleanup();
      const params: Record<string, string> = {};
      route.keys.forEach((key, index) => {
        params[key] = decodeURIComponent(match[index + 1] ?? '');
      });
      cleanup = route.handler(params) ?? undefined;
      options.onChange?.(currentPath);
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }

    const fallback = options.fallback ?? '/';
    if (currentPath !== fallback) {
      window.history.replaceState({}, '', fallback);
      run();
    }
  };

  const onClick = (event: MouseEvent): void => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    const target = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a[data-nav]');
    if (!target) return;
    const href = target.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('#')) return;
    event.preventDefault();
    navigate(href);
  };

  const onPopState = (): void => run();

  const navigate = (path: string): void => {
    if (path === currentPath) {
      run();
      return;
    }
    window.history.pushState({}, '', path);
    run();
  };

  window.addEventListener('popstate', onPopState);
  document.addEventListener('click', onClick);

  return {
    start: run,
    navigate,
    current: () => currentPath,
    dispose(): void {
      window.removeEventListener('popstate', onPopState);
      document.removeEventListener('click', onClick);
      if (typeof cleanup === 'function') cleanup();
    },
  };
}