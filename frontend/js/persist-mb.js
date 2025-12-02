// frontend/js/persist-mb.js
// Гарантированный клик по Telegram MainButton ("MY CART")

function goCart() {
  if (window.navigateTo) {
    window.navigateTo("cart");
  } else {
    // запасной маршрут
    location.hash = "#/cart";
    if (window.handleLocation) window.handleLocation();
  }
}

function hook() {
  const W = window.Telegram?.WebApp;
  const MB = W?.MainButton;
  if (!W || !MB) return;

  try { MB.onClick(goCart); } catch {}
  try { W.onEvent?.("mainButtonClicked", goCart); } catch {}

  try { MB.enable(); } catch {}
  try { MB.show(); } catch {}
}

// После загрузки страницы навешиваем и поддерживаем «в живом» состоянии
window.addEventListener("load", () => {
  hook();
  setInterval(hook, 800);
});
