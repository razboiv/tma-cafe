// Глобальная инициализация и рабочая кнопка "MY CART"

import TelegramSDK from "./telegram/telegram.js";
import { Cart } from "./cart/cart.js";
import { handleLocation, navigateTo } from "./routing/router.js";

// --- Старт приложения ---
TelegramSDK.ready();
TelegramSDK.expand();
handleLocation();

// --- Переход в корзину ---
function goCart() {
  if (typeof navigateTo === "function") {
    navigateTo("cart");
  } else {
    window.location.hash = "#/cart";
    if (typeof handleLocation === "function") handleLocation();
  }
}

// --- Управление MainButton ---
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

// первый рендер + периодическое «переподвешивание» на всякий случай
refreshMainButton(true);
setInterval(refreshMainButton, 700);

// подстрахуемся на смену фокуса/видимости
window.addEventListener("focus", () => refreshMainButton(true));
document.addEventListener("visibilitychange", () => refreshMainButton(true));