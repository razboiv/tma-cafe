// frontend/js/persist-mb.js
// Персистентный хук Telegram MainButton:
// - на главной показывает "MY CART · N" и ведёт в корзину;
// - на деталке может показывать "ADD TO CART";
// - на странице корзины (hash=/cart или dataset.mainbutton==='checkout') кнопку ВСЕГДА скрывает.

(function persistMainButton() {
  function goCart() {
    if (window.navigateTo) window.navigateTo("cart");
    else {
      location.hash = "#/cart";
      window.handleLocation?.();
    }
  }

  function hook() {
    const W = window.Telegram?.WebApp;
    if (!W) return;
    const MB = W.MainButton;

    // На странице корзины — принудительно скрываем.
    const onCartPage =
      /(^|#\/)cart/.test(location.hash) ||
      document.body.dataset.mainbutton === "checkout";
    if (onCartPage) {
      try { MB.hide?.(); } catch {}
      return;
    }

    const mode = document.body.dataset.mainbutton || "";     // 'cart' | 'add' | ''
    const label = document.body.dataset.mainbuttonText || ""; // текст, если его задаём где-то

    if (mode === "cart") {
      try {
        MB.onClick?.(goCart);
        W.onEvent?.("mainButtonClicked", goCart);
        if (label) MB.setText?.(label);
        MB.enable?.();
        MB.show?.();
      } catch {}
      return;
    }

    if (mode === "add") {
      try {
        MB.setText?.("ADD TO CART");
        MB.enable?.();
        MB.show?.();
      } catch {}
      return;
    }

    // Любой другой режим — кнопка скрыта
    try { MB.hide?.(); } catch {}
  }

  // Первичный вызов и поддержка «в живом» состоянии
  window.addEventListener("load", hook);
  setInterval(hook, 800);
})();