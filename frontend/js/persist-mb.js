// frontend/js/persist-mb.js
// Один раз вешаем MainButton, НИКУДА сами не навигируем.
// Переход в корзину происходит ТОЛЬКО по клику по MainButton.

(function persistMainButton() {
  if (window.__MB_HOOKED__) return;
  window.__MB_HOOKED__ = true;

  function goCart() {
    // Без автопереходов. Только по клику.
    const target = "#/cart";
    if (location.hash !== target) location.hash = target;
    if (window.handleLocation) window.handleLocation();
  }

  function hook() {
    const W = window.Telegram && Telegram.WebApp;
    if (!W || !W.MainButton) return;

    try { W.MainButton.offClick?.(); } catch {}
    try { W.offEvent?.("mainButtonClicked"); } catch {}

    try { W.MainButton.onClick(goCart); } catch {}
    try { W.onEvent?.("mainButtonClicked", goCart); } catch {}

    try { W.MainButton.enable(); } catch {}
    try { W.MainButton.show(); } catch {}
  }

  // Один запуск и больше ничего; без setInterval.
  if (document.readyState === "complete" || document.readyState === "interactive") {
    hook();
  } else {
    window.addEventListener("DOMContentLoaded", hook, { once: true });
  }
})();