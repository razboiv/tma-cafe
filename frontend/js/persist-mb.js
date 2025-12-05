// frontend/js/persist-mb.js
// Показываем MY CART только когда страница пометит режимом 'cart'

function goCart() {
  if (window.navigateTo) {
    window.navigateTo('cart');
  } else {
    location.hash = '#/cart';
    if (window.handleLocation) window.handleLocation();
  }
}

function hook() {
  const W  = window.Telegram && window.Telegram.WebApp;
  const MB = W && W.MainButton;
  if (!W || !MB) return;

  // ВАЖНО: не вмешиваемся, пока страница не попросит режим 'cart'
  if (document.body.dataset.mainbutton !== 'cart') return;

  try { MB.onClick(goCart); } catch {}
  try { W.onEvent && W.onEvent('mainButtonClicked', goCart); } catch {}
  try { MB.enable(); MB.show(); } catch {}
}

window.addEventListener('load', () => {
  hook();
  setInterval(hook, 800);
});