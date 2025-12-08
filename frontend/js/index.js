// frontend/js/index.js

import TelegramSDK from "./telegram/telegram.js";
// версию в query оставляем для перебития кэша в браузере
import { bootRouter, handleLocation } from "./routing/router.js?v=13";

// корректная и безопасная инициализация Telegram WebApp
TelegramSDK.ready?.();
TelegramSDK.expand?.();

// запуск роутера (ТОЛЬКО ОДИН РАЗ!)
bootRouter();

// слушаем смену хэша и передаём в роутер
window.addEventListener("hashchange", handleLocation, { passive: true });