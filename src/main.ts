import './styles.css';
import { GAMES } from './games';
import { createRouter } from './router';
import { disposeTelegram, haptic, initTelegram, setTelegramBackButton } from './tg';
import { mountGame } from './ui/gameShell';
import { renderHome } from './ui/home';

const root = document.querySelector<HTMLElement>('[data-app-root]') ?? document.body;

initTelegram();

const router = createRouter(
  [
    {
      path: '/',
      handler: () => renderHome(root, (path) => router.navigate(path)),
    },
    ...GAMES.map((game) => ({
      path: game.path,
      handler: () =>
        mountGame(root, game, (path) => {
          haptic('tap');
          router.navigate(path);
        }),
    })),
  ],
  {
    fallback: '/',
    onChange: (path) => {
      const game = GAMES.find((item) => item.path === path);
      document.title = game ? `${game.title} — Мурчальня` : 'Мурчальня — пять мини-игр про кота';
      setTelegramBackButton(path !== '/', () => router.navigate('/'));
    },
  },
);

router.start();

window.addEventListener('pagehide', () => {
  router.dispose();
  disposeTelegram();
});