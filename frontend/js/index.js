// /frontend/js/index.js
console.log("[BOOT] index.js loaded");

import TelegramSDK from "./telegram/telegram.js";
import { handleLocation, navigateTo } from "./routing/router.js";

// Сделаем доступными в консоли на всякий случай
window.navigateTo = navigateTo;
window.handleLocation = handleLocation;

// Старт Telegram SDK и наш роутер
TelegramSDK.ready();
TelegramSDK.expand();
handleLocation();

// Глобальная ловушка ошибок, чтобы они не терялись
window.addEventListener("error", (e) => {
  console.error("[GLOBAL ERROR]", e.message, e.error);
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("[UNHANDLED REJECTION]", e.reason);
});