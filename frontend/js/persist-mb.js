// Гарантированный переход в корзину: дергаем все возможные триггеры роутера.

function toCart() {
  try { console.log("[persist-mb] toCart() start, hash:", location.hash); } catch {}

  // 1) нормальный путь
  try { if (window.navigateTo) window.navigateTo("cart"); } catch {}

  // 2) меняем hash в любом случае
  try { if (location.hash !== "#/cart") location.hash = "#/cart"; } catch {}

  // 3) насильно триггерим роутер
  try { window.dispatchEvent(new HashChangeEvent("hashchange")); } catch {}
  try { if (window.handleLocation) window.handleLocation(); } catch {}

  // 4) подстраховка — повторим через короткие таймеры (иногда роутер «просыпается» с задержкой)
  setTimeout(() => { try { window.dispatchEvent(new HashChangeEvent("hashchange")); } catch {} }, 50);
  setTimeout(() => { try { window.handleLocation && window.handleLocation(); } catch {} }, 80);
  setTimeout(() => { try { window.handleLocation && window.handleLocation(); } catch {} }, 200);

  try { console.log("[persist-mb] toCart() forced"); } catch {}
}

function hook() {
  var W = (window.Telegram && window.Telegram.WebApp) || null;
  if (!W || !W.MainButton) return;

  // Двойная подписка — какой-то канал точно сработает
  try { W.MainButton.onClick(toCart); } catch {}
  try { typeof W.onEvent === "function" && W.onEvent("mainButtonClicked", toCart); } catch {}

  try { W.MainButton.enable(); } catch {}
  try { W.MainButton.show(); } catch {}

  try { console.log("[persist-mb] hook() attached"); } catch {}
}

window.addEventListener("load", function () {
  hook();
  // периодически «переподвешиваем» — если чей-то код снимает обработчик
  setInterval(hook, 800);
});