// frontend/js/persist-mb.js
// Универсальный хук к Telegram MainButton, который НИКОГДА
// не переназначает кнопку на страницах с режимом "add".

(function () {
  function goCart() {
    if (window.navigateTo) window.navigateTo("cart");
    else { location.hash = "#/cart"; window.handleLocation?.(); }
  }

  function attach() {
    const W  = window.Telegram?.WebApp;
    const MB = W?.MainButton;
    if (!W || !MB) return;

    const mode = document.body.dataset.mainbutton || ""; // "", "add", "cart"

    // В режиме "cart" — гарантируем клик в корзину и показываем кнопку
    if (mode === "cart") {
      try { MB.onClick(goCart); } catch {}
      try { W.onEvent?.("mainButtonClicked", goCart); } catch {}
      try { MB.enable(); MB.show(); } catch {}
      return;
    }

    // В любом другом режиме НИЧЕГО НЕ ДЕЛАЕМ и ничего не перехватываем.
  }

  window.addEventListener("load", attach);
  setInterval(attach, 800); // поддерживаем хук «в живом» состоянии
})();