import { audio } from '../core/audio';
import { formatScore } from '../core/math';
import { getBest, getPlays } from '../core/storage';
import { GAMES } from '../games';
import { el } from './dom';

const HERO_ART = '/assets/hero-cat.webp';
const LOGO_ART = '/assets/logo-cat.png';

function makeLogo(): HTMLElement {
  const mark = el('span', { class: 'logo__mark' });
  const image = el('img', { class: 'logo__image', src: LOGO_ART, alt: '', 'aria-hidden': 'true' });
  image.addEventListener('error', () => image.remove());
  mark.append(image);
  return el('a', { class: 'logo', href: '/', 'data-nav': '' }, [
    mark,
    el('span', { class: 'logo__text' }, [
      el('b', { text: 'Мурчальня' }),
      el('i', { text: 'пятнадцать кошачьих аркад' }),
    ]),
  ]);
}

function makeSoundButton(): HTMLElement {
  const button = el('button', { class: 'icon-btn icon-btn--sound', type: 'button' });
  const sync = (): void => {
    const muted = audio.isMuted;
    button.textContent = muted ? '🔇' : '🔊';
    button.classList.toggle('is-off', muted);
    button.setAttribute('aria-label', muted ? 'Включить звук' : 'Выключить звук');
  };
  button.addEventListener('click', () => { audio.toggleMute(); sync(); });
  sync();
  return button;
}

function makeGameCard(index: number, game: (typeof GAMES)[number]): HTMLElement {
  const best = getBest(game.id);
  const plays = getPlays(game.id);
  const rotation = index % 2 === 0 ? -1.4 : 1.2;
  return el('article', { class: 'card', style: `--accent:${game.accent};--accent-soft:${game.accentSoft};--rot:${rotation}deg` }, [
    el('div', { class: 'card__top' }, [
      el('span', { class: 'card__num', text: String(index + 1).padStart(2, '0') }),
      el('span', { class: 'card__emoji', text: game.emoji }),
    ]),
    el('h3', { class: 'card__title', text: game.title }),
    el('p', { class: 'card__tagline', text: game.tagline }),
    el('p', { class: 'card__goal', text: game.goal }),
    el('div', { class: 'card__meta' }, [
      el('span', { class: 'chip', text: best > 0 ? `Рекорд: ${formatScore(best)} ${game.bestSuffix}` : 'Рекорда пока нет' }),
      el('span', { class: 'chip chip--muted', text: plays > 0 ? `Партий: ${plays}` : 'Не начата' }),
    ]),
    el('a', { class: 'btn btn--primary btn--block', href: game.path, 'data-nav': '', text: 'Играть' }),
  ]);
}

export function renderHome(container: HTMLElement, navigate: (path: string) => void): () => void {
  const totalPlays = GAMES.reduce((sum, game) => sum + getPlays(game.id), 0);
  const totalBest = GAMES.reduce((sum, game) => sum + getBest(game.id), 0);
  const randomButton = el('button', { class: 'btn btn--ghost', type: 'button', text: 'Случайная игра' });
  const onRandom = (): void => {
    audio.play('click');
    const game = GAMES[Math.floor(Math.random() * GAMES.length)];
    if (game) navigate(game.path);
  };
  randomButton.addEventListener('click', onRandom);

  const heroArt = el('img', { class: 'hero__image', src: HERO_ART, alt: 'Кот в окружении мини-игр Мурчальни', loading: 'eager' });
  heroArt.addEventListener('error', () => heroArt.classList.add('is-broken'));

  const header = el('header', { class: 'site-header' }, [
    makeLogo(),
    el('nav', { class: 'site-header__nav' }, [el('a', { class: 'site-header__link', href: '#games', text: 'Игры' })]),
    makeSoundButton(),
  ]);

  const hero = el('section', { class: 'hero' }, [
    el('div', { class: 'hero__text' }, [
      el('span', { class: 'sticker', text: '15 игр · вход свободный' }),
      el('h1', { class: 'hero__title', text: 'Мурчальня' }),
      el('p', { class: 'hero__lead', text: 'Пятнадцать лёгких кошачьих аркад в одном кармане. Накормите кота, ловите мячики и клубки, раскрашивайте, собирайте тройки и ставьте новые рекорды.' }),
      el('div', { class: 'hero__actions' }, [
        el('a', { class: 'btn btn--primary btn--lg', href: GAMES[0]?.path ?? '/', 'data-nav': '', text: 'Начать с еды' }),
        randomButton,
      ]),
      el('ul', { class: 'hero__facts' }, [
        el('li', { text: 'Тач, мышь и клавиатура' }),
        el('li', { text: 'Рекорды хранятся на устройстве' }),
        el('li', { text: '15 разных механик' }),
      ]),
    ]),
    el('figure', { class: 'hero__art' }, [heroArt]),
  ]);

  const cards = el('div', { class: 'cards' }, GAMES.map((game, index) => makeGameCard(index, game)));
  const shelf = el('section', { class: 'shelf', id: 'games' }, [
    el('div', { class: 'section-head' }, [
      el('h2', { class: 'section-head__title', text: 'Полка игр' }),
      el('p', { class: 'section-head__lead', text: 'Пять больших аркад и десять новых быстрых игр — выбирайте любую карточку.' }),
    ]),
    cards,
  ]);
  const footer = el('footer', { class: 'site-footer' }, [
    el('div', { class: 'site-footer__row' }, [
      el('span', { text: totalPlays > 0 ? `Партий сыграно: ${totalPlays}. Сумма рекордов: ${formatScore(totalBest)}.` : 'Партий пока не было — начинайте с любой игры.' }),
      el('span', { text: 'Мурчальня · сделано для котов и их людей' }),
    ]),
  ]);
  const main = el('main', { class: 'home' }, [hero, shelf]);
  document.querySelectorAll<HTMLElement>('.card').forEach((card, index) => card.style.setProperty('--rot', `${index % 2 === 0 ? -1.4 : 1.2}deg`));
  container.append(header, main, footer);
  return () => { randomButton.removeEventListener('click', onRandom); header.remove(); main.remove(); footer.remove(); };
}
