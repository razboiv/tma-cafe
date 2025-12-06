// frontend/js/index.js
import TelegramSDK from "./telegram/telegram.js";
import { bootRouter, handleLocation } from "./routing/router.js";

// Телеграм UI
TelegramSDK.ready();
TelegramSDK.expand();

// Роутер
bootRouter();
window.addEventListener("hashchange", handleLocation);