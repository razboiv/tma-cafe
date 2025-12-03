// frontend/js/persist-mb.js
// Умный хук: реагируем на клик MainButton только когда он в режиме "MY CART".
// Контекст кнопки передают страницы через: document.body.dataset.mainbutton = 'cart' | 'add' | ''.

function isCartMode() {
  return document?.body?.dataset?.mainbutton === 'cart';
}

function toCart() {
  // Пинаем все возможные триггеры роутера
  try { if (window.navigateTo) window.navigateTo('cart'); } catch {}
  try { if (location.hash !== '#/cart') location.hash = '#/cart'; } catch {}
  try { window.dispatchEvent(new HashChangeEvent('hashchange')); } catch {}
  try { typeof window.onhashchange === 'function' && window.onhashchange(); } catch {}
  try {
    const url = location.pathname + '?dest=cart' + (location.hash || '');
    history.pushState({ dest: 'cart' }, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  } catch {}
  try { window.handleLocation && window.handleLocation(); } catch {}
}

let attached = false;

function attach() {
  const W = (window.Telegram && window.Telegram.WebApp) || null;
  if (!W || !W.MainButton) return;

  // Вешаем хендлер только в режиме корзины
  if (isCartMode() && !attached) {
    try { W.MainButton.onClick(toCart); } catch {}
    try { typeof W.onEvent === 'function' && W.onEvent('mainButtonClicked', toCart); } catch {}
    attached = true;
    try { console.log('[persist-mb] attached (cart mode)'); } catch {}
  }

  // Если режим не cart — очищаем, чтобы не ломать ADD TO CART
  if (!isCartMode() && attached) {
    try { W.MainButton.offClick(toCart); } catch {}
    // offEvent не у всех клиентов есть — молча игнорируем
    attached = false;
    try { console.log('[persist-mb] detached (not cart mode)'); } catch {}
  }

  // Держим кнопку живой
  try { W.MainButton.enable(); } catch {}
  try { W.MainButton.show(); } catch {}
}

window.addEventListener('load', function () {
  attach();
  // Периодически проверяем смену режима и пере-подвешиваем хендлер
  setInterval(attach, 700);
});