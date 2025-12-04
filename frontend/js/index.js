// frontend/js/index.js
import TelegramSDK from "./telegram/telegram.js";
import { handleLocation, navigateTo } from "./routing/router.js";

// пробросим наружу — удобно для отладки в консоли
window.navigateTo = navigateTo;
window.handleLocation = handleLocation;

// инициализация Telegram WebApp
TelegramSDK.ready();
TelegramSDK.expand();

// первый рендер страницы
handleLocation();

/* ---------- Микро-страховка роутера ---------- */

// 1) если hash меняется — перерисовываем
window.addEventListener("hashchange", () => {
  // rAF чтобы избежать двойных рендеров в один тик
  requestAnimationFrame(() => handleLocation());
});

// 2) переходы по истории (кнопка «назад/вперёд»)
window.addEventListener("popstate", () => {
  requestAnimationFrame(() => handleLocation());
});

// 3) делегирование кликов по ссылкам/кнопкам с маршрутом
document.addEventListener("click", (e) => {
  const link = e.target.closest('[data-route], a[href^="#/"]');
  if (!link) return;

  e.preventDefault();
  const to =
    link.dataset.route ||
    link.getAttribute("href").replace(/^#\//, "");

  navigateTo(to);
});

// 4) сторож: иногда Telegram не шлёт события — проверяем хеш сами
let lastHash = location.hash;
setInterval(() => {
  if (location.hash !== lastHash) {
    lastHash = location.hash;
    handleLocation();
  }
}, 700);