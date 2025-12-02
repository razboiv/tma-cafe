// frontend/js/index.js
import TelegramSDK from "./telegram/telegram.js";
import { Cart } from "./cart/cart.js";
import { handleLocation, navigateTo } from "./routing/router.js";

// --- инициализация Telegram + роутера ---
TelegramSDK.ready();
TelegramSDK.expand();
handleLocation();

// --- переход в корзину (универсально) ---
function goCart() {
  if (typeof navigateTo === "function") {
    navigateTo("cart");
  } else {
    window.location.hash = "#/cart";
    if (typeof handleLocation === "function") handleLocation();
  }
}

// --- жёсткая подписка на MainButton кликом двумя путями ---
let mbHooked = false;
function attachMainButtonHandlers() {
  const W = window.Telegram?.WebApp;
  const MB = W?.MainButton;
  if (!W || !MB) return;

  // Снять старые и навесить заново — иногда кто-то «сбрасывает» обработчики
  try { MB.offClick(goCart); } catch {}
  try { W.offEvent?.("mainButtonClicked", goCart); } catch {}

  try { MB.onClick(goCart); } catch {}
  try { W.onEvent?.("mainButtonClicked", goCart); } catch {}

  mbHooked = true;
}

// --- обновление текста/видимости кнопки ---
let lastCount = -1;
function countItems() {
  const items = (Cart.getItems && Cart.getItems()) || [];
  return items.reduce((s, it) => s + Number(it?.quantity || 0), 0);
}

function refreshMainButton(force = false) {
  const count = countItems();
  if (force || count !== lastCount) {
    if (count > 0) {
      TelegramSDK.showMainButton(`MY CART · ${count}`, goCart);
      attachMainButtonHandlers(); // на всякий повторно закрепим хендлер
    } else {
      TelegramSDK.hideMainButton();
    }
    lastCount = count;
  }
}

// --- регулярные «подпинывания» (боремся с редкими глитчами WebApp) ---
refreshMainButton(true);
attachMainButtonHandlers();

// обновляем кнопку и переподписываемся раз в 700 мс
setInterval(() => {
  refreshMainButton();
  if (!mbHooked) attachMainButtonHandlers();
}, 700);

// подстрахуемся на смену видимости/фокуса
window.addEventListener("focus", () => {
  mbHooked = false;
  refreshMainButton(true);
  setTimeout(attachMainButtonHandlers, 0);
});
document.addEventListener("visibilitychange", () => {
  mbHooked = false;
  refreshMainButton(true);
  setTimeout(attachMainButtonHandlers, 0);
});