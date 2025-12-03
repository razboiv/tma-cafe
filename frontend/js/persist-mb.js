// frontend/js/persist-mb.js
// Гарантированный клик по MainButton: принудительный переход на #/cart

function toCart() {
  var target = "#/cart";
  var moved = false;

  // 1) если есть navigateTo — используем его
  try {
    if (window.navigateTo) {
      window.navigateTo("cart");
      moved = true;
    }
  } catch (e) {}

  // 2) ставим хэш, если он другой
  if (location.hash !== target) {
    try { location.hash = target; moved = true; } catch (e) {}
  } else {
    // 3) он уже #/cart → насильно триггерим роутер
    try { window.dispatchEvent(new HashChangeEvent("hashchange")); } catch (e) {
      try { window.onhashchange && window.onhashchange(); } catch (e2) {}
    }
    try { window.handleLocation && window.handleLocation(); } catch (e) {}
  }

  // отладка — можно убрать позже
  try { console.log("[persist-mb] toCart(), moved:", moved, "hash:", location.hash); } catch(e){}
}

function hook() {
  var W = (window.Telegram && window.Telegram.WebApp) || null;
  if (!W || !W.MainButton) return;

  // двойная подписка — какой-то канал точно сработает
  try { W.MainButton.onClick(toCart); } catch (e) {}
  try { typeof W.onEvent === "function" && W.onEvent("mainButtonClicked", toCart); } catch (e) {}

  try { W.MainButton.enable(); } catch (e) {}
  try { W.MainButton.show(); } catch (e) {}

  try { console.log("[persist-mb] hook() attached"); } catch(e){}
}

window.addEventListener("load", function () {
  hook();
  // периодически «переподвешиваем», если кто-то сбросил обработчик
  setInterval(hook, 800);
});