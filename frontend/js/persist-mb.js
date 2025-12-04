// frontend/js/persist-mb.js
// Читает document.body.dataset.mainbutton и НЕ навязывает своё.
// Режимы: '' | 'cart' | 'add' | 'checkout'. Текст — в mainbuttonText.

(function persistMainButton() {
  function goCart() {
    if (window.navigateTo) window.navigateTo("cart");
    else { location.hash = "#/cart"; window.handleLocation?.(); }
  }

  function apply() {
    const W = window.Telegram?.WebApp;
    if (!W) return;
    const MB = W.MainButton;
    const mode = document.body.dataset.mainbutton || "";
    const text = document.body.dataset.mainbuttonText || "";

    // На странице корзины или в режиме checkout — скрываем
    const onCart = /(^|#\/)cart/.test(location.hash);
    if (onCart || mode === "checkout") { try { MB.hide?.(); } catch {} return; }

    if (mode === "cart" && text) {
      try {
        MB.setText?.(text);
        MB.onClick?.(goCart);
        W.onEvent?.("mainButtonClicked", goCart);
        MB.enable?.(); MB.show?.();
      } catch {}
      return;
    }

    if (mode === "add") {
      try { MB.setText?.("ADD TO CART"); MB.enable?.(); MB.show?.(); } catch {}
      return;
    }

    try { MB.hide?.(); } catch {}
  }

  window.addEventListener("load", apply);
  setInterval(apply, 700); // просто поддерживаем текущее состояние
})();