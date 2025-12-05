// frontend/js/index.js
import TelegramSDK from "./telegram/telegram.js";
import { handleLocation, navigateTo } from "./routing/router.js";

// прокидываем, как было
window.navigateTo = navigateTo;
window.handleLocation = handleLocation;

// Telegram SDK
TelegramSDK.ready();
TelegramSDK.expand();

// первый рендер
handleLocation();

// SPA-навигация по хэшу
window.addEventListener("hashchange", handleLocation);

// Перехватываем клики по внутренним ссылкам, чтобы не было «пустых страниц»
document.addEventListener("click", (e) => {
  const a = e.target.closest('a[href^="#/"]');
  if (!a) return;
  e.preventDefault();
  const href = a.getAttribute("href");
  if (href && href !== location.hash) {
    location.hash = href;         // это триггерит handleLocation
  }
});

// Фэйлсейф: если хэш пустой — отправляем на главную
if (!location.hash) location.hash = "#/";