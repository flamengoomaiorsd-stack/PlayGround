import './style.css';
import { Game } from './game/game.js';

function fail(message, error) {
  console.error('[Turbo Strike]', error || message);
  const loading = document.getElementById('loading');
  const text = document.getElementById('loading-text');
  const fill = document.getElementById('load-fill');
  if (fill) fill.style.width = '100%';
  if (text) text.textContent = message;
  if (loading) {
    loading.classList.add('failed');
    const sub = document.getElementById('loading-text');
    if (sub) {
      const hint = document.createElement('div');
      hint.className = 'load-error-hint';
      hint.textContent = 'Recarregue a página para tentar novamente.';
      sub.after(hint);
    }
  }
}

function boot() {
  const canvas = document.getElementById('game');
  if (!canvas) {
    fail('Arena não encontrada na página.');
    return;
  }

  const loading = document.getElementById('loading');
  const fill = document.getElementById('load-fill');
  const text = document.getElementById('loading-text');

  try {
    const game = new Game(canvas);
    window.turboStrike = game;
    window.__game = game;

    if (fill) fill.style.width = '100%';
    const dismiss = () => {
      if (!loading) return;
      loading.classList.add('done');
      setTimeout(() => { loading.style.display = 'none'; }, 600);
    };
    if (text) text.textContent = 'ARENA PRONTA!';
    requestAnimationFrame(() => setTimeout(dismiss, 380));
  } catch (error) {
    fail('NÃO FOI POSSÍVEL INICIAR A ARENA', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
