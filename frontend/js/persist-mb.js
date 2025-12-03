// frontend/js/persist-mb.js
// Гарантированный переход в корзину: дергаем ВСЕ возможные триггеры навигации.

function toCart() {
  try { console.log("[persist-mb] toCart() start, hash:", location.hash); } catch {}

  // 1) Нормальный путь — если есть navigateTo, он главный
  try { if (window.navigateTo) window.navigateTo("cart"); } catch {}

  // 2) Обновляем hash (вдруг роутер слушает hashchange)
  try { if (location.hash !== "#/cart") location.hash = "#/cart"; } catch {}

  // 3) Насильно кидаем hashchange
  try { window.dispatchEvent(new HashChangeEvent("hashchange")); } catch {}
  try { if (typeof window.onhashchange === "function") window.onhashchange(); } catch {}

  // 4) Пинаем history (на случай, если роутер на popstate)
  try {
    const url = location.pathname + "?r=cart" + (location.hash || "");
    history.pushState({ r: "cart" }, "", url);
  } catch {}
  try { window.dispatchEvent(new PopStateEvent("popstate")); } catch {}

  // 5) Прямой вызов обработчика роутера
  try { if (window.handleLocation) window.handleLocation(); } catch {}

  // 6) Подстраховочные повторы — некоторые роутеры просыпаются с задержкой
  setTimeout(() => {
    try { window.dispatchEvent(new HashChangeEvent("hashchange")); } catch {}
    try { window.dispatchEvent(new PopStateEvent("popstate")); } catch {}
    try { window.handleLocation && window.handleLocation(); } catch {}
  }, 60);

  setTimeout(() => {
    try { window.handleLocation && window.handleLocation(); } catch {}
  }, 180);

  try { console.log("[persist-mb] toCart() forced"); } catch {}
}

function hook() {
  var W = (window.Telegram && window.Telegram.WebApp) || null;
  if (!W || !W.MainButton) return;

  // Двойная подписка — какой-то точно сработает
  try { W.MainButton.onClick(toCart); } catch {}
  try { typeof W.onEvent === "function" && W.onEvent("mainButtonClicked", toCart); } catch {}

  try { W.MainButton.enable(); } catch {}
  try { W.MainButton.show(); } catch {}

  try { console.log("[persist-mb] hook() attached"); } catch {}
}

window.addEventListener("load", function () {
  hook();
  // периодически «переподвешиваем», если чей-то код снимает обработчик
  setInterval(hook, 800);
});