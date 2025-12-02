// frontend/js/index.js
import TelegramSDK from "./telegram/telegram.js";
import { Cart } from "./cart/cart.js";
import { handleLocation, navigateTo } from "./routing/router.js";

// Инициализация Telegram и приложения
TelegramSDK.ready();
TelegramSDK.expand();
handleLocation();

// Глобальная логика MainButton "MY CART"
function goCart() {
  // предпочитаем router.navigateTo; если нет — fallback на hash
  if (typeof navigateTo === "function") {
    navigateTo("cart");
  } else {
    window.location.hash = "#/cart";
    if (typeof handleLocation === "function") handleLocation();
  }
}

let lastCount = -1;
function getCount() {
  const items = (Cart.getItems && Cart.getItems()) || [];
  return items.reduce((s, it) => s + Number(it?.quantity || 0), 0);
}

function refreshMainButton(force = false) {
  const count = getCount();
  if (force || count !== lastCount) {
    if (count > 0) {
      TelegramSDK.showMainButton(`MY CART · ${count}`, goCart);
    } else {
      TelegramSDK.hideMainButton();
    }
    lastCount = count;
  }
}

// Пытаемся обновлять счётчик регулярно (если нет своего event-bus)
refreshMainButton(true);
const intervalId = setInterval(refreshMainButton, 500);
window.addEventListener("focus", () => refreshMainButton(true));
document.addEventListener("visibilitychange", () => refreshMainButton(true));

// Если у тебя есть события Cart.onChange — можно вместо setInterval:
// Cart.onChange(() => refreshMainButton(true));
